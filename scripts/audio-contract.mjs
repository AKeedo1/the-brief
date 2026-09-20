import { createHash } from 'node:crypto';

// Git checks out CRLF on this Windows host and LF in Pages CI.
export const hash = bytes => createHash('sha256').update(bytes.toString('utf8').replaceAll('\r\n', '\n')).digest('hex');

export function validateAudio(editionBytes, scriptBytes, manifest) {
  const edition = JSON.parse(editionBytes);
  const script = JSON.parse(scriptBytes);
  if (manifest.editionHash !== hash(editionBytes) || manifest.scriptHash !== hash(scriptBytes)
      || manifest.edition !== edition.date.edition || manifest.date !== edition.date.display
      || script.edition !== edition.date.edition || script.date !== edition.date.display) {
    throw new Error('Recorded audio is stale; generate audio for this edition before publishing.');
  }
  const expected = ['briefing', ...edition.stories.map(story => story.id), edition.history.id];
  if (!manifest.voices?.length || !manifest.voices.some(voice => voice.id === manifest.defaultVoice)) {
    throw new Error('A recorded default narrator is required.');
  }
  const recordings = [];
  function checkRecording(recording) {
    if (!recording || !/^audio\/[\w-]+\/[\w-]+\.mp3$/.test(recording.src)
        || !Number.isFinite(recording.duration) || recording.duration <= 0) {
      throw new Error('Missing or invalid audio recording.');
    }
    recordings.push(recording);
  }
  for (const voice of manifest.voices) {
    checkRecording(voice.sample);
    for (const id of expected) {
      const track = manifest.tracks[id];
      if (!track?.title || !track?.text) throw new Error(`Missing spoken script: ${id}`);
      const recording = track.recordings[voice.id];
      checkRecording(recording);
      if (id === 'briefing' && (recording.duration < 180 || recording.duration > 300)) {
        throw new Error('The recorded briefing must last three to five minutes.');
      }
    }
  }
  return recordings;
}

export function formatTime(seconds) {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}
