import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateAudio, formatTime } from '../scripts/audio-contract.mjs';
import { serveFile } from '../scripts/serve-file.mjs';

const edition = await readFile(new URL('../content/edition.json', import.meta.url));
const script = await readFile(new URL('../content/audio-script.json', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../content/audio-manifest.json', import.meta.url), 'utf8'));

test('every advertised track has a real recording in the deployable build', async () => {
  const recordings = validateAudio(edition, script, manifest);
  for (const recording of recordings) {
    const audio = await readFile(new URL(`../dist/site/${recording.src}`, import.meta.url));
    assert.ok(audio.length > 1000, recording.src);
    assert.ok(audio.subarray(0, 3).toString() === 'ID3' || audio[0] === 0xff, recording.src);
  }
  const html = await readFile(new URL('../dist/site/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes(formatTime(manifest.tracks.briefing.recordings[manifest.defaultVoice].duration)));
  assert.equal((html.match(/data-listen-story=/g) || []).length, JSON.parse(edition).stories.length + 1);
  const app = await readFile(new URL('../dist/site/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /speechSynthesis|SpeechSynthesisUtterance/);
});

test('new edition or changed script cannot silently reuse old audio', () => {
  const next = JSON.parse(edition); next.date.edition = 'next';
  assert.throws(() => validateAudio(Buffer.from(JSON.stringify(next)), script, manifest), /stale/);
  assert.throws(() => validateAudio(edition, Buffer.from(script.toString() + ' '), manifest), /stale/);
});

test('Windows and Pages line endings validate the same edition', () => {
  const asWindows = bytes => Buffer.from(bytes.toString().replaceAll('\r\n', '\n').replaceAll('\n', '\r\n'));
  assert.doesNotThrow(() => validateAudio(asWindows(edition), asWindows(script), manifest));
});

test('incomplete voices, unsafe paths and an overlong briefing fail validation', () => {
  let bad = structuredClone(manifest);
  delete bad.tracks.briefing.recordings[bad.defaultVoice];
  assert.throws(() => validateAudio(edition, script, bad), /recording/);
  bad = structuredClone(manifest);
  bad.voices[0].sample.src = '../../secret.mp3';
  assert.throws(() => validateAudio(edition, script, bad), /recording/);
  bad = structuredClone(manifest);
  bad.tracks.briefing.recordings[bad.defaultVoice].duration = 301;
  assert.throws(() => validateAudio(edition, script, bad), /three to five/);
});

test('audio seeking returns correct byte ranges and rejects invalid ranges', async () => {
  const src = manifest.tracks.briefing.recordings[manifest.defaultVoice].src;
  const file = fileURLToPath(new URL(`../dist/site/${src}`, import.meta.url));
  const all = await readFile(file);
  const server = createServer((req, res) => serveFile(req, res, file, 'audio/mpeg').catch(() => res.writeHead(500).end()));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/sample.mp3`;
    const partial = await fetch(url, {headers:{Range:'bytes=12-99'}});
    assert.equal(partial.status, 206);
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), all.subarray(12,100));
    const suffix = await fetch(url, {headers:{Range:'bytes=-32'}});
    assert.equal(suffix.status, 206);
    assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), all.subarray(-32));
    const invalid = await fetch(url, {headers:{Range:`bytes=${all.length}-`}});
    assert.equal(invalid.status, 416);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
