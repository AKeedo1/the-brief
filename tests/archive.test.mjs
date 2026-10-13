import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const archiveSource = new URL('../content/archive/', import.meta.url);
const archiveOutput = new URL('../dist/site/archive/', import.meta.url);

test('every archived edition is reachable from the reader', async () => {
  const names = (await readdir(archiveSource)).filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
  assert.ok(names.length > 0, 'expected at least one archived edition');

  const index = await readFile(new URL('../dist/site/index.html', import.meta.url), 'utf8');
  assert.match(index, new RegExp(`Archive <span>${names.length}<\\/span>`));
  assert.match(index, /data-archive-grid/);

  const archiveIndex = await readFile(new URL('index.html', archiveOutput), 'utf8');
  for (const name of names) {
    const key = name.slice(0, -5);
    const data = JSON.parse(await readFile(new URL(name, archiveSource), 'utf8'));
    const page = await readFile(new URL(`${key}/index.html`, archiveOutput), 'utf8');
    assert.match(index, new RegExp(`archive/${key}/`));
    assert.match(archiveIndex, new RegExp(`${key}/`));
    assert.ok(page.includes(data.date.display));
    assert.ok(page.includes(data.worldSentence.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')));
    assert.equal((page.match(/class="archive-story"/g) || []).length, data.stories.length);
  }
});

test('archive pages keep headlines scannable and details available', async () => {
  const names = (await readdir(archiveSource)).filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
  const newestKey = names.at(-1).slice(0, -5);
  const page = await readFile(new URL(`${newestKey}/index.html`, archiveOutput), 'utf8');
  assert.match(page, /The day at a glance\./);
  assert.match(page, /<summary>Read the briefing<\/summary>/);
  assert.match(page, /What changed/);
  assert.match(page, /Why it mattered/);
  assert.match(page, /What came next/);
  assert.match(page, /Today →/);
});
