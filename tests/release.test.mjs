import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { verifyLive } from '../scripts/verify-release.mjs';

const editionBytes = await readFile(new URL('../content/edition.json', import.meta.url));
const scriptBytes = await readFile(new URL('../content/audio-script.json', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../content/audio-manifest.json', import.meta.url)));
const assetBytes = name => readFile(new URL('../dist/site/' + name, import.meta.url));
const page = await assetBytes('index.html');

function fetcher({ badPage, badRange, badAsset, wrongBytes } = {}) {
  return async (url, options) => {
    const path = new URL(url).pathname.replace('/the-brief/', '');
    if (!path) return new Response(badPage ?? page);
    const data = await assetBytes(path);
    if (!path.endsWith('.mp3')) return new Response(badAsset ? 'wrong player' : data.toString().replaceAll('\r\n', '\n'));
    if (badRange) return new Response(data, { status: 200 });
    const [, start, end] = options.headers.Range.match(/bytes=(\d+)-(\d+)/).map(Number);
    return new Response(wrongBytes ? Buffer.alloc(end - start + 1) : data.subarray(start, end + 1), {
      status: 206, headers: { 'content-range': 'bytes ' + start + '-' + end + '/' + data.length },
    });
  };
}
const verify = overrides => verifyLive({
  base: 'https://test.invalid/the-brief/', editionBytes, scriptBytes, manifest, assetBytes,
  fetcher: fetcher(overrides),
});

test('valid published edition, Windows line endings and all audio ranges pass', async () => {
  assert.equal((await verify()).status, 'passed');
});
test('old or incomplete edition fails before audio verification', async () => {
  await assert.rejects(verify({ badPage: '<html>Yesterday</html>' }), /manifest/);
});
test('stale player assets are rejected', async () => {
  await assert.rejects(verify({ badAsset: true }), /Stale live asset/);
});
test('HTTP 200 alone does not prove seekable audio', async () => {
  await assert.rejects(verify({ badRange: true }), /cannot seek/);
});
test('wrong recording bytes are rejected even with correct range headers', async () => {
  await assert.rejects(verify({ wrongBytes: true }), /Wrong audio bytes/);
});
