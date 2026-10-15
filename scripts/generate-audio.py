"""Generate recorded audio with the existing local Kokoro service.

No browser speech fallback. Manifest is replaced only when all selected recordings
exist and the measured briefing is between three and five minutes.
"""
import argparse
import json
from pathlib import Path
from audio_generation import AudioEngine, atomic_write, digest, generation_lock

ROOT = Path(__file__).resolve().parents[1]
VOICES = {'bf_emma': 'Emma · British', 'bm_george': 'George · British', 'am_michael': 'Michael · American'}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--samples-only', action='store_true')
    parser.add_argument('--voices', nargs='+', choices=list(VOICES), default=['am_michael'])
    parser.add_argument('--budget-seconds', type=int, default=600)
    args = parser.parse_args()
    if args.budget_seconds <= 0:
        parser.error('--budget-seconds must be positive')
    with generation_lock(ROOT / '.cache/daymark/audio.lock'):
        engine = AudioEngine(ROOT / '.cache/daymark/audio', budget=args.budget_seconds)
        try:
            generate(args, engine)
        except Exception as error:
            engine.report(ROOT / '.cache/daymark/audio-timing.json', 'failed', str(error))
            raise
        engine.report(ROOT / '.cache/daymark/audio-timing.json', 'passed')


def generate(args, engine):
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
    previous_durations = {}
    for name in ['audio-manifest.json', 'audio-samples.json']:
        try:
            previous = json.loads((ROOT / 'content' / name).read_text(encoding='utf-8'))
            recordings = [v['sample'] for v in previous.get('voices', [])]
            recordings += [r for t in previous.get('tracks', {}).values() for r in t.get('recordings', {}).values()]
            previous_durations.update({r['src']: r['duration'] for r in recordings})
        except (FileNotFoundError, json.JSONDecodeError, KeyError, TypeError):
            pass

    def generate(voice, key, text):
        audio_hash = digest((voice + '\n1.0\n' + text).encode())[:12]
        file = audio_root / f'{voice}-{key}-{audio_hash}.mp3'
        print(f'Preparing {voice}: {key}', flush=True)
        seconds = engine.generate(file, voice, text, previous_durations.get(file.relative_to(ROOT / 'public/edition').as_posix()))
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
    atomic_write(target, (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode())
    print(f'Saved {target.name}', flush=True)

if __name__ == '__main__':
    main()
