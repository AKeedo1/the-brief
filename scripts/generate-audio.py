"""Generate recorded audio with the existing local Kokoro service.

No browser speech fallback. Manifest is replaced only when all selected recordings
exist and the measured briefing is between three and five minutes.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
VOICES = {'bf_emma': 'Emma · British', 'bm_george': 'George · British', 'am_michael': 'Michael · American'}

def digest(value):
    return hashlib.sha256(value.replace(b'\r\n', b'\n')).hexdigest()

def duration(data):
    result = subprocess.run(['docker', 'exec', '-i', 'kokoro', 'ffprobe', '-v', 'error', '-i', 'pipe:0', '-show_entries', 'packet=duration_time', '-of', 'csv=p=0'], input=data, capture_output=True, check=True)
    seconds = sum(float(line.strip().strip(',')) for line in result.stdout.decode().splitlines() if line.strip())
    if seconds <= 0:
        raise ValueError('No playable audio duration')
    return round(seconds, 2)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--samples-only', action='store_true')
    parser.add_argument('--voices', nargs='+', choices=list(VOICES), default=['am_michael'])
    args = parser.parse_args()
    edition_bytes = (ROOT / 'content/edition.json').read_bytes()
    script_bytes = (ROOT / 'content/audio-script.json').read_bytes()
    edition, script = json.loads(edition_bytes), json.loads(script_bytes)
    if script['edition'] != edition['date']['edition'] or script['date'] != edition['date']['display']:
        raise ValueError('Audio script does not match the current edition')
    if set(script['stories']) != {s['id'] for s in edition['stories']}:
        raise ValueError('Audio story IDs do not match the current edition')
    history = edition['history']
    tracks = {'briefing': script['briefing'], **{s['id']: {'title': s['title'], 'text': script['stories'][s['id']]} for s in edition['stories']}, history['id']: {'title': history['title'], 'text': '\n\n'.join([history['title'], history['deck'], *[section['title'] + '. ' + section['text'] for section in history['sections']]])}}
    audio_root = ROOT / 'public/edition/audio' / script['edition']
    audio_root.mkdir(parents=True, exist_ok=True)
    manifest = {'version': 1, 'edition': script['edition'], 'date': script['date'], 'editionHash': digest(edition_bytes), 'scriptHash': digest(script_bytes), 'defaultVoice': script['defaultVoice'] if script['defaultVoice'] in args.voices else args.voices[0], 'voices': [], 'tracks': {key: {**value, 'recordings': {}} for key, value in tracks.items()}}

    def generate(voice, key, text):
        audio_hash = digest((voice + '\n1.0\n' + text).encode())[:12]
        file = audio_root / f'{voice}-{key}-{audio_hash}.mp3'
        if not file.exists():
            payload = json.dumps({'model':'kokoro', 'voice':voice, 'input':text, 'response_format':'mp3', 'speed':1.0, 'stream':False}).encode()
            request = urllib.request.Request('http://127.0.0.1:8880/v1/audio/speech', data=payload, headers={'Content-Type':'application/json'})
            print(f'Generating {voice}: {key}', flush=True)
            with urllib.request.urlopen(request, timeout=900) as response:
                data = response.read()
            seconds = duration(data)
            file.write_bytes(data)
        else:
            seconds = duration(file.read_bytes())
        print(f'  {key}: {seconds:.1f}s', flush=True)
        return {'src': file.relative_to(ROOT / 'public/edition').as_posix(), 'duration': seconds}

    for voice in args.voices:
        sample = generate(voice, 'sample', script['sample'])
        manifest['voices'].append({'id': voice, 'label': VOICES[voice], 'sample': sample})
        if not args.samples_only:
            for key, track in tracks.items():
                recording = generate(voice, key, track['text'])
                if key == 'briefing' and not 180 <= recording['duration'] <= 300:
                    raise ValueError(f'Briefing duration {recording["duration"]}s is outside 3–5 minutes; revise the spoken script')
                manifest['tracks'][key]['recordings'][voice] = recording
    target = ROOT / 'content' / ('audio-samples.json' if args.samples_only else 'audio-manifest.json')
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(target)
    print(f'Saved {target.name}', flush=True)

if __name__ == '__main__':
    main()
