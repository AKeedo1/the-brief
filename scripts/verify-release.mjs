import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { validateAudio } from './audio-contract.mjs';

const root = resolve(import.meta.dirname, '..');
const esc = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const assert = (value, message) => { if (!value) throw new Error(message); };

export async function verifyLive({ base, editionBytes, scriptBytes, manifest, assetBytes, fetcher = fetch }) {
  const edition = JSON.parse(editionBytes);
  const expectedRecordings = validateAudio(editionBytes, scriptBytes, manifest);
  const response = await fetcher(base, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
  assert(response.ok, 'Live page returned HTTP ' + response.status);
  const html = await response.text();
  const match = html.match(/<script type="application\/json" id="edition-audio-data">([\s\S]*?)<\/script>/);
  assert(match, 'Live page has no recorded-audio manifest');
  const actualRecordings = validateAudio(editionBytes, scriptBytes, JSON.parse(match[1]));
  assert(JSON.stringify(actualRecordings) === JSON.stringify(expectedRecordings), 'Live audio differs from the validated edition');
  assert(html.includes('data-edition-date="' + esc(edition.date.display) + '"'), 'Live edition date is wrong');
  assert(html.includes('data-story-count="' + edition.stories.length + '"'), 'Live story count is wrong');
  for (const story of edition.stories) assert(html.includes(esc(story.title)), 'Missing live story: ' + story.id);
  assert(html.includes(esc(edition.history.title)), 'Missing live history');
  for (const item of edition.radar) assert(html.includes(esc(item.title)), 'Missing live radar/curiosity item');
  // Verify exact deployed player/style assets, not just their existence.
  for (const name of ['audio-player.js', 'app.js', 'styles.css']) {
    const res = await fetcher(new URL(name, base), { signal: AbortSignal.timeout(10000), cache: 'no-store' });
    assert(res.ok, 'Missing live asset: ' + name);
    const normalized = bytes => bytes.toString('utf8').replaceAll('\r\n', '\n');
    assert(normalized(Buffer.from(await res.arrayBuffer())) === normalized(await assetBytes(name)), 'Stale live asset: ' + name);
  }
  const recordings = [...new Map(actualRecordings.map(r => [r.src, r])).values()];
  // Small bounded batches check seeking and correct bytes for every recording.
  for (let i = 0; i < recordings.length; i += 3) {
    await Promise.all(recordings.slice(i, i + 3).map(async ({ src }) => {
      const local = await assetBytes(src);
      for (const [start, end] of [[0, 255], [local.length - 256, local.length - 1]]) {
        const res = await fetcher(new URL(src, base), {
          headers: { Range: 'bytes=' + start + '-' + end }, signal: AbortSignal.timeout(10000),
        });
        assert(res.status === 206, 'Live audio cannot seek: ' + src + ' (HTTP ' + res.status + ')');
        assert(res.headers.get('content-range') === 'bytes ' + start + '-' + end + '/' + local.length, 'Wrong recording size/range: ' + src);
        assert(Buffer.from(await res.arrayBuffer()).equals(local.subarray(start, end + 1)), 'Wrong audio bytes: ' + src);
      }
    }));
  }
  return { date: edition.date.display, tracks: recordings.length, status: 'passed' };
}

async function main() {
  const started = performance.now();
  const live = process.argv.includes('--live');
  const report = { startedAt: new Date().toISOString(), mode: live ? 'live' : 'local', steps: [] };
  async function step(name, action) {
    const begin = performance.now();
    try {
      const result = await action();
      report.steps.push({ name, status: 'passed', seconds: (performance.now() - begin) / 1000 });
      return result;
    } catch (error) {
      report.steps.push({ name, status: 'failed', error: error.message, seconds: (performance.now() - begin) / 1000 });
      throw error;
    }
  }
  function node(args) {
    const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 60000 });
    if (result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout || 'Failed: ' + args.join(' '));
    process.stdout.write(result.stdout);
  }
  try {
    const [editionBytes, scriptBytes, manifestBytes] = await Promise.all(['edition.json', 'audio-script.json', 'audio-manifest.json'].map(name => readFile(resolve(root, 'content', name))));
    const manifest = JSON.parse(manifestBytes);
    await step('audio-contract', () => validateAudio(editionBytes, scriptBytes, manifest));
    if (live) {
      const result = await step('deployed-edition-and-audio', () => verifyLive({
        base: 'https://akeedo1.github.io/the-brief/',
        editionBytes, scriptBytes, manifest,
        assetBytes: name => readFile(resolve(root, 'dist/site', name)),
      }));
      console.log(JSON.stringify(result));
    } else {
      await step('render', () => node(['scripts/render-edition.mjs']));
      await step('build', () => node(['scripts/build-static.mjs']));
      await step('audio-and-archive-tests', () => node(['--test', 'tests/audio.test.mjs', 'tests/archive.test.mjs']));
    }
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.error = error.message;
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    report.elapsedSeconds = (performance.now() - started) / 1000;
    await mkdir(resolve(root, '.cache/daymark'), { recursive: true });
    await writeFile(resolve(root, '.cache/daymark/validation-' + report.mode + '.json'), JSON.stringify(report, null, 2) + '\n');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
