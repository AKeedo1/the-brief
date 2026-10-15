"""Resumable local narration with bounded retries and persistent segment caching."""
import contextlib
import hashlib
import http.client
import io
import json
import math
import os
from pathlib import Path
import re
import struct
import subprocess
import time
import urllib.error
import urllib.request
import wave


def digest(value):
    return hashlib.sha256(value.replace(b'\r\n', b'\n')).hexdigest()


def atomic_write(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    try:
        temporary.write_bytes(data)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


@contextlib.contextmanager
def generation_lock(path):
    """OS lock releases on process exit; no stale lock after a crashed job."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a+b') as handle:
        if handle.tell() == 0:
            handle.write(b'0')
            handle.flush()
        handle.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            raise RuntimeError('Another Daymark audio job is running; do not start a duplicate.') from exc
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == 'nt':
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle, fcntl.LOCK_UN)


def split_text(text, limit=1200):
    """Prefer sentence boundaries, preserving every word in its original order."""
    text = text.strip()
    if not text:
        raise ValueError('Empty narration text')
    chunks = []
    while len(text) > limit:
        window = text[:limit + 1]
        boundaries = [m.end() for m in re.finditer(r'\n\s*\n|(?<=[.!?])\s+', window)]
        cut = max((n for n in boundaries if n >= limit // 3), default=0)
        if not cut:
            cut = window.rfind(' ')
        if cut <= 0:
            raise ValueError('Narration contains an overlong unbroken token')
        chunks.append(text[:cut].strip())
        text = text[cut:].strip()
    if text:
        chunks.append(text)
    return chunks


def read_wave(data):
    with wave.open(io.BytesIO(data), 'rb') as source:
        params = (source.getnchannels(), source.getsampwidth(), source.getframerate())
        frames = source.readframes(source.getnframes())
        if not frames or len(frames) != source.getnframes() * params[0] * params[1]:
            raise ValueError('Empty or truncated WAV recording')
        if params[2] <= 0 or source.getcomptype() != 'NONE':
            raise ValueError('Unsupported WAV recording')
        return params, frames


def finalize_wave(data):
    """Kokoro sends streaming WAV headers even with stream=False.

    Only the explicit unknown-length sentinel is resolved from the completed
    HTTP response; ordinary length mismatches still fail validation.
    """
    if data[:4] != b'RIFF' or data[8:12] != b'WAVE':
        raise ValueError('Service did not return WAV audio')
    offset = 12
    while offset + 8 <= len(data):
        kind = data[offset:offset + 4]
        size = struct.unpack_from('<I', data, offset + 4)[0]
        if kind == b'data':
            if size == 0xffffffff:
                fixed = bytearray(data)
                struct.pack_into('<I', fixed, 4, len(data) - 8)
                struct.pack_into('<I', fixed, offset + 4, len(data) - offset - 8)
                data = bytes(fixed)
            read_wave(data)
            return data
        offset += 8 + size + (size % 2)
    raise ValueError('Missing WAV data')


def join_waves(parts):
    decoded = [read_wave(part) for part in parts]
    params = decoded[0][0]
    if any(p != params for p, _ in decoded):
        raise ValueError('Narration segments have incompatible audio formats')
    output = io.BytesIO()
    with wave.open(output, 'wb') as target:
        target.setnchannels(params[0])
        target.setsampwidth(params[1])
        target.setframerate(params[2])
        for _, frames in decoded:
            target.writeframes(frames)
    return output.getvalue()


class AudioEngine:
    def __init__(self, cache, budget=600, attempts=3, clock=time.monotonic, sleep=time.sleep):
        self.cache = Path(cache)
        self.clock, self.sleep = clock, sleep
        self.started = clock()
        self.deadline = self.started + budget
        self.attempts = attempts
        self.events = []
        self.base = 'http://127.0.0.1:8880'

    def remaining(self, cap):
        seconds = self.deadline - self.clock()
        if seconds <= 0:
            raise TimeoutError('Audio generation exceeded its time budget; cached work is safe.')
        return min(cap, seconds)

    def wait_ready(self):
        deadline = self.clock() + self.remaining(30)
        while True:
            try:
                with urllib.request.urlopen(self.base + '/health', timeout=self.remaining(3)) as response:
                    if json.load(response).get('status') == 'healthy':
                        return
            except (OSError, ValueError, http.client.HTTPException):
                pass
            if self.clock() >= deadline:
                raise TimeoutError('Kokoro did not become healthy within 30 seconds')
            self.sleep(min(2, max(0, deadline - self.clock())))

    def request_wave(self, voice, text):
        data = json.dumps({'model': 'kokoro', 'voice': voice, 'input': text,
                           'response_format': 'wav', 'speed': 1.0, 'stream': False}).encode()
        request = urllib.request.Request(self.base + '/v1/audio/speech', data=data,
                                         headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=self.remaining(90)) as response:
            return finalize_wave(response.read())

    def segment(self, voice, text):
        key = digest(('wav-v1\n' + voice + '\n1.0\n' + text).encode())
        path = self.cache / 'segments' / (key + '.wav')
        if path.exists():
            try:
                data = path.read_bytes()
                read_wave(data)
                self.events.append({'type': 'segment_cache', 'key': key})
                return data
            except (ValueError, wave.Error, EOFError):
                pass
        for attempt in range(1, self.attempts + 1):
            start = self.clock()
            try:
                self.wait_ready()
                data = self.request_wave(voice, text)
                read_wave(data)
                atomic_write(path, data)
                self.events.append({'type': 'segment_generated', 'key': key, 'attempt': attempt,
                                    'seconds': round(self.clock() - start, 3)})
                return data
            except urllib.error.HTTPError as exc:
                detail = exc.read(1000).decode('utf-8', errors='replace')
                transient = exc.code in (408, 429, 500, 502, 503, 504) or (
                    exc.code == 400 and any(word in detail.lower() for word in
                                            ('encoder', 'avcodec', 'mux', 'audio generation')))
                if not transient:
                    raise RuntimeError(f'Kokoro rejected the request (HTTP {exc.code}); invalid input is not retried.') from exc
                error = f'HTTP {exc.code}'
            except (OSError, http.client.HTTPException, ValueError, wave.Error, EOFError) as exc:
                error = type(exc).__name__
            self.events.append({'type': 'segment_retry', 'key': key, 'attempt': attempt,
                                'error': error, 'seconds': round(self.clock() - start, 3)})
            if attempt == self.attempts:
                raise RuntimeError(f'Audio segment failed after {attempt} attempts ({error}); rerun resumes cached work.')
            self.sleep(self.remaining(min(2 ** attempt, 5)))

    def command(self, args, data):
        return subprocess.run(['docker', 'exec', '-i', 'kokoro', *args], input=data,
                              capture_output=True, check=True, timeout=self.remaining(30)).stdout

    def duration(self, data):
        result = self.command(['ffprobe', '-v', 'error', '-i', 'pipe:0', '-show_entries',
                               'packet=duration_time', '-of', 'csv=p=0'], data)
        seconds = sum(float(line.strip().strip(',')) for line in result.decode().splitlines() if line.strip())
        if not math.isfinite(seconds) or seconds <= 0:
            raise ValueError('No playable audio duration')
        return round(seconds, 2)

    def encode(self, data):
        # Encode once after joining PCM, avoiding the service's MP3 muxer path.
        return self.command(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0',
                             '-codec:a', 'libmp3lame', '-b:a', '128k', '-f', 'mp3', 'pipe:1'], data)

    def generate(self, path, voice, text, expected_duration=None):
        start = self.clock()
        if path.exists():
            data = path.read_bytes()
            if len(data) > 1000:
                try:
                    seconds = self.duration(data)
                    if expected_duration is not None and abs(seconds - expected_duration) > 0.1:
                        raise ValueError('Cached audio length differs from the previous manifest')
                    self.events.append({'type': 'track_cache', 'file': path.name,
                                        'seconds': round(self.clock() - start, 3)})
                    return seconds
                except (ValueError, subprocess.CalledProcessError):
                    pass
        parts = [self.segment(voice, part) for part in split_text(text)]
        wav = join_waves(parts)
        data = self.encode(wav)
        seconds = self.duration(data)
        params, frames = read_wave(wav)
        expected = len(frames) / (params[0] * params[1] * params[2])
        if abs(seconds - expected) > max(0.5, expected * 0.01):
            raise ValueError('Encoded duration does not match the complete narration')
        atomic_write(path, data)
        self.events.append({'type': 'track_generated', 'file': path.name, 'segments': len(parts),
                            'duration': seconds, 'seconds': round(self.clock() - start, 3)})
        return seconds

    def report(self, path, status, error=None):
        atomic_write(path, (json.dumps({'status': status, 'error': error,
                                      'elapsedSeconds': round(self.clock() - self.started, 3),
                                      'events': self.events}, indent=2) + '\n').encode())
