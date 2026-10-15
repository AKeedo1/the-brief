import argparse
import http.client
import importlib.util
import io
from pathlib import Path
import sys
import struct
import tempfile
import unittest
from unittest.mock import Mock, patch
import urllib.error
import wave

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from audio_generation import AudioEngine, finalize_wave, generation_lock, join_waves, read_wave, split_text


def wav(frames=2400):
    output = io.BytesIO()
    with wave.open(output, 'wb') as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(24000)
        stream.writeframes(b'\0\0' * frames)
    return output.getvalue()


class NarrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.engine = AudioEngine(self.root, sleep=lambda _: None)
        self.engine.wait_ready = Mock()

    def test_chunking_preserves_words_and_order(self):
        text = ('A sentence about history. Another useful explanation!\n\n' * 80).strip()
        parts = split_text(text)
        self.assertGreater(len(parts), 1)
        self.assertEqual(' '.join(text.split()), ' '.join(' '.join(parts).split()))
        self.assertTrue(all(len(p) <= 1200 for p in parts))

    def test_disconnect_retries_and_cached_segment_survives_new_engine(self):
        self.engine.request_wave = Mock(side_effect=[http.client.RemoteDisconnected(), wav()])
        result = self.engine.segment('am_michael', 'A complete sentence.')
        self.assertEqual(self.engine.request_wave.call_count, 2)
        another = AudioEngine(self.root)
        another.request_wave = Mock(side_effect=AssertionError('Cached audio must not be requested'))
        self.assertEqual(another.segment('am_michael', 'A complete sentence.'), result)

    def test_invalid_input_does_not_loop(self):
        error = urllib.error.HTTPError('local', 400, 'invalid', {}, io.BytesIO(b'Unknown voice'))
        self.engine.request_wave = Mock(side_effect=error)
        with self.assertRaisesRegex(RuntimeError, 'invalid input'):
            self.engine.segment('bad', 'A sentence.')
        self.assertEqual(self.engine.request_wave.call_count, 1)

    def test_encoder_error_is_retried(self):
        error = urllib.error.HTTPError('local', 400, 'bad', {}, io.BytesIO(b'avcodec encoder failure'))
        self.engine.request_wave = Mock(side_effect=[error, wav()])
        self.engine.segment('am_michael', 'A sentence.')
        self.assertEqual(self.engine.request_wave.call_count, 2)

    def test_failures_are_bounded_and_resume_keeps_good_segments(self):
        self.engine.request_wave = Mock(side_effect=[wav(), OSError(), OSError(), OSError()])
        self.engine.segment('am_michael', 'First segment.')
        with self.assertRaisesRegex(RuntimeError, '3 attempts'):
            self.engine.segment('am_michael', 'Second segment.')
        self.assertEqual(len(list((self.root / 'segments').glob('*.wav'))), 1)
        self.engine.request_wave = Mock(return_value=wav())
        self.engine.segment('am_michael', 'First segment.')
        self.engine.segment('am_michael', 'Second segment.')
        self.assertEqual(self.engine.request_wave.call_count, 1)

    def test_truncated_wave_never_enters_cache(self):
        self.engine.request_wave = Mock(return_value=wav()[:-20])
        with self.assertRaises(RuntimeError):
            self.engine.segment('am_michael', 'A sentence.')
        self.assertFalse((self.root / 'segments').exists())

    def test_join_preserves_all_frames(self):
        params, frames = read_wave(join_waves([wav(100), wav(200)]))
        self.assertEqual(params, (1, 2, 24000))
        self.assertEqual(len(frames), 600)

    def test_completed_streaming_wave_header_is_finalized(self):
        data = bytearray(wav())
        struct.pack_into('<I', data, 4, 0xffffffff)
        struct.pack_into('<I', data, 40, 0xffffffff)
        self.assertEqual(read_wave(finalize_wave(bytes(data))), read_wave(wav()))
        with self.assertRaises(ValueError):
            finalize_wave(wav()[:-20])

    def test_exhausted_budget_fails(self):
        engine = AudioEngine(self.root, budget=1, clock=lambda: 10)
        engine.clock = lambda: 12
        with self.assertRaises(TimeoutError):
            engine.remaining(30)

    def test_shortened_cached_recording_is_regenerated(self):
        path = self.root / 'track.mp3'
        path.write_bytes(b'old' * 500)
        self.engine.duration = Mock(side_effect=[0.05, 0.1])
        self.engine.segment = Mock(return_value=wav())
        self.engine.encode = Mock(return_value=b'complete recording')
        self.assertEqual(self.engine.generate(path, 'am_michael', 'A sentence.', expected_duration=1), 0.1)
        self.engine.segment.assert_called_once()
        self.assertEqual(path.read_bytes(), b'complete recording')

    def test_failed_encoding_keeps_existing_recording(self):
        path = self.root / 'track.mp3'
        original = b'old' * 500
        path.write_bytes(original)
        self.engine.duration = Mock(return_value=0.05)
        self.engine.segment = Mock(return_value=wav())
        self.engine.encode = Mock(side_effect=RuntimeError('encoder failed'))
        with self.assertRaisesRegex(RuntimeError, 'encoder failed'):
            self.engine.generate(path, 'am_michael', 'A sentence.', expected_duration=1)
        self.assertEqual(path.read_bytes(), original)

    def test_lock_blocks_concurrent_generator_and_releases(self):
        path = self.root / 'audio.lock'
        with generation_lock(path):
            with self.assertRaisesRegex(RuntimeError, 'Another Daymark'):
                with generation_lock(path):
                    pass
        with generation_lock(path):
            pass

    def test_failed_generation_preserves_previous_manifest(self):
        spec = importlib.util.spec_from_file_location('generate_audio', Path(__file__).resolve().parents[1] / 'scripts/generate-audio.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        content = self.root / 'content'
        content.mkdir()
        (content / 'edition.json').write_text('{"date":{"edition":"001","display":"today"},"stories":[],"history":{"id":"history","title":"History","deck":"A deck","sections":[]}}')
        (content / 'audio-script.json').write_text('{"edition":"001","date":"today","stories":{},"briefing":{"title":"Brief","text":"A briefing"},"defaultVoice":"am_michael","sample":"sample"}')
        manifest = content / 'audio-manifest.json'
        manifest.write_text('previous manifest')
        self.engine.generate = Mock(side_effect=RuntimeError('service failed'))
        with patch.object(module, 'ROOT', self.root), self.assertRaises(RuntimeError):
            module.generate(argparse.Namespace(voices=['am_michael'], samples_only=False), self.engine)
        self.assertEqual(manifest.read_text(), 'previous manifest')


if __name__ == '__main__':
    unittest.main()
