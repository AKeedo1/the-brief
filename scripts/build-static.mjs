import { mkdir, readFile, readdir, rm, writeFile, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { validateAudio } from './audio-contract.mjs';

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "public", "edition");
const output = resolve(root, "dist", "server", "index.js");
const staticOutput = resolve(root, 'dist', 'site');
const manifest = JSON.parse(await readFile(resolve(root, 'content/audio-manifest.json'), 'utf8'));
const currentEditionBytes = await readFile(resolve(root, 'content/edition.json'));
const recordings = validateAudio(currentEditionBytes, await readFile(resolve(root, 'content/audio-script.json')), manifest);
const audioJs = await readFile(resolve(source, 'audio-player.js'), 'utf8');
const brandAssets = ['manifest.webmanifest', ...[32, 180, 192, 512].map(size => `daymark-icon-${size}-v1.png`)];
const brandFiles = Object.fromEntries(await Promise.all(brandAssets.map(async name => [name, (await readFile(resolve(source, name))).toString('base64')])));

const [html, css, js, ogImage] = await Promise.all([
  readFile(resolve(source, "index.html"), "utf8"),
  readFile(resolve(source, "styles.css"), "utf8"),
  readFile(resolve(source, "app.js"), "utf8"),
  readFile(resolve(root, "public", "og.png")),
]);

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const archiveDir = resolve(root, 'content', 'archive');
const archiveNames = (await readdir(archiveDir)).filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
const archiveEditions = await Promise.all(archiveNames.map(async name => ({
  key: name.slice(0, -5),
  data: JSON.parse(await readFile(resolve(archiveDir, name), 'utf8')),
})));

function sourceLinks(sources = []) {
  return sources.map(source => `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.label)} ↗</a>`).join('');
}

function archiveCards(editions, prefix = 'archive/') {
  return [...editions].reverse().map(({ key, data }) => `<a class="archive-card" href="${prefix}${key}/">
    <span>${esc(data.date.display)}</span>
    <strong>Edition ${esc(data.date.edition)} · ${data.stories.length} headlines</strong>
    <p>${esc(data.worldSentence)}</p>
    <em>Read edition →</em>
  </a>`).join('');
}

function archiveIndexPage(editions) {
  return `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Every previous Daymark daily edition.">
  <title>Daymark Archive</title>
  <link rel="icon" href="../daymark-icon-32-v1.png"><link rel="stylesheet" href="../styles.css">
</head><body class="archive-page">
  <header class="masthead"><div class="masthead__top wrap"><a class="wordmark" href="../"><span class="wordmark__symbol"><img src="../daymark-icon-192-v1.png" alt=""></span>Daymark</a></div><div class="edition-line wrap"><span>ARCHIVE</span><span>${editions.length} PREVIOUS EDITIONS</span><span>DOHA</span></div></header>
  <nav class="archive-return wrap"><a href="../">← Today’s edition</a></nav>
  <main class="subpage wrap"><header class="subpage__intro"><p class="kicker">Archive</p><h1>Every day, still here.</h1><p>Open any previous Daymark edition.</p></header><div class="archive-grid">${archiveCards(editions, '')}</div></main>
</body></html>`;
}

function injectArchiveIndex(sourceHtml, editions) {
  const library = `<section class="view subpage wrap" data-view-panel="library">
      <header class="subpage__intro"><p class="kicker">Archive</p><h1>Every day, still here.</h1><p>Missed an edition? Open any previous day without losing your place in today’s briefing.</p></header>
      <div class="archive-grid" data-archive-grid>${archiveCards(editions)}</div>
      <section class="saved-section">
        <header class="subpage__intro"><p class="kicker">Saved stories</p><h2>What you chose to remember.</h2><p>Your saved stories stay on this device.</p></header>
        <div class="library-empty" data-library-empty><span>＋</span><p>Save a story from Today and it will appear here.</p></div>
        <div class="saved-grid" data-saved-grid></div>
      </section>
    </section>`;
  return sourceHtml
    .replace(/<button type="button" class="nav-link" data-view="library">Library <span data-library-count>\d+<\/span><\/button>/, `<button type="button" class="nav-link" data-view="library">Archive <span>${editions.length}</span></button>`)
    .replace(/<section class="view subpage wrap" data-view-panel="library">[\s\S]*?<\/section>/, library);
}

function archivePage(record, previous, next) {
  const { key, data } = record;
  const stories = data.stories.map(story => `<article class="archive-story">
      <p class="micro-label">${esc(story.category)}</p>
      <h2>${esc(story.title)}</h2>
      <details>
        <summary>Read the briefing</summary>
        <div class="archive-story__body">
          <section><span>What changed</span><p>${esc(story.changed)}</p></section>
          <section><span>Why it mattered</span><p>${esc(story.matters)}</p></section>
          <section><span>What came next</span><p>${esc(story.watch)}</p></section>
          <nav class="source-links">${sourceLinks(story.sources)}</nav>
        </div>
      </details>
    </article>`).join('');
  const longView = data.history ? `<details class="archive-long-view">
      <summary><span>The Long View · ${esc(data.history.readTime)}</span><strong>${esc(data.history.title)}</strong></summary>
      <p class="archive-long-view__deck">${esc(data.history.deck)}</p>
      <blockquote>${esc(data.history.thesis)}</blockquote>
      ${data.history.sections.map((section, index) => `<section><span>${index + 1} · ${esc(section.title)}</span><p>${esc(section.text)}</p></section>`).join('')}
      <nav class="source-links">${sourceLinks(data.history.sources)}</nav>
    </details>` : '';
  const previousLink = previous ? `<a href="../${previous.key}/">← ${esc(previous.data.date.display)}</a>` : '<span></span>';
  const nextLink = next ? `<a href="../${next.key}/">${esc(next.data.date.display)} →</a>` : '<a href="../../">Today →</a>';
  return `<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Daymark archive edition for ${esc(data.date.display)}.">
  <title>Daymark Archive — ${esc(data.date.display)}</title>
  <link rel="icon" href="../../daymark-icon-32-v1.png"><link rel="stylesheet" href="../../styles.css">
</head><body class="archive-page" data-archive-date="${key}">
  <header class="masthead"><div class="masthead__top wrap"><a class="wordmark" href="../../"><span class="wordmark__symbol"><img src="../../daymark-icon-192-v1.png" alt=""></span>Daymark</a></div><div class="edition-line wrap"><span>${esc(data.date.display.toUpperCase())}</span><span>ARCHIVE · EDITION ${esc(data.date.edition)}</span><span>DOHA</span></div></header>
  <nav class="archive-return wrap"><a href="../../">← Today’s edition</a><a href="../">All previous days</a></nav>
  <main class="archive-edition wrap">
    <header class="archive-hero"><p class="kicker">The world in one sentence</p><h1>${esc(data.worldSentence)}</h1><p>${esc(data.standfirst)}</p></header>
    <section class="archive-headlines"><header><p class="micro-label">${data.stories.length} headlines</p><h2>The day at a glance.</h2></header>${stories}</section>
    ${longView}
    <nav class="archive-pager" aria-label="Adjacent editions">${previousLink}${nextLink}</nav>
  </main>
</body></html>`;
}

const siteHtml = injectArchiveIndex(html, archiveEditions);
const archivePages = Object.fromEntries(archiveEditions.map((record, index) => [record.key, archivePage(record, archiveEditions[index - 1], archiveEditions[index + 1])]));
const archiveIndex = archiveIndexPage(archiveEditions);

const worker = `const html = ${JSON.stringify(siteHtml)};
const archivePages = ${JSON.stringify(archivePages)};
const archiveIndex = ${JSON.stringify(archiveIndex)};
const css = ${JSON.stringify(css)};
const js = ${JSON.stringify(js)};
const audioJs = ${JSON.stringify(audioJs)};
const brandFiles = ${JSON.stringify(brandFiles)};
const ogBase64 = ${JSON.stringify(Buffer.from(ogImage).toString("base64"))};

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    const { pathname } = url;
    const archiveMatch = pathname.match(/\\/archive\\/(\\d{4}-\\d{2}-\\d{2})(?:\\/|\\/index\\.html)?$/);
    if (archiveMatch && archivePages[archiveMatch[1]]) return new Response(archivePages[archiveMatch[1]].replaceAll("{{SITE_ORIGIN}}", url.origin), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
    if (/\\/archive(?:\\/|\\/index\\.html)?$/.test(pathname)) return new Response(archiveIndex.replaceAll("{{SITE_ORIGIN}}", url.origin), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
    const brandName = pathname.split('/').pop();
    if (Object.hasOwn(brandFiles, brandName)) {
      const bytes = Uint8Array.from(atob(brandFiles[brandName]), character => character.charCodeAt(0));
      return new Response(bytes, { headers: { 'content-type': brandName.endsWith('.png') ? 'image/png' : 'application/manifest+json', 'cache-control': 'public, max-age=300' } });
    }
    if (pathname.endsWith('/audio-player.js')) return new Response(audioJs, { headers: { 'content-type': 'text/javascript; charset=utf-8' } });
    if (pathname.includes('/audio/')) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Audio assets unavailable', {status:404});
    if (pathname.endsWith("/og.png")) {
      const bytes = Uint8Array.from(atob(ogBase64), character => character.charCodeAt(0));
      return new Response(bytes, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    }
    if (pathname.endsWith("/styles.css")) return new Response(css, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=300" } });
    if (pathname.endsWith("/app.js")) return new Response(js, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=300" } });
    return new Response(html.replaceAll("{{SITE_ORIGIN}}", url.origin), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
  }
};
`;

const dist = resolve(root, 'dist');
if (dirname(dist) !== root) throw new Error('Build output must remain inside the project.');
await rm(dist, { recursive: true, force: true });
await mkdir(dirname(output), { recursive: true });
await writeFile(output, worker);
await mkdir(staticOutput, { recursive: true });
for (const name of ['styles.css', 'app.js', 'audio-player.js', ...brandAssets, ...new Set(recordings.map(recording => recording.src))]) {
  const target = resolve(staticOutput, name);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(source, name), target);
}
await writeFile(resolve(staticOutput, 'index.html'), siteHtml);
await mkdir(resolve(staticOutput, 'archive'), { recursive: true });
await writeFile(resolve(staticOutput, 'archive', 'index.html'), archiveIndex);
for (const [key, page] of Object.entries(archivePages)) {
  const target = resolve(staticOutput, 'archive', key, 'index.html');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, page);
}
await copyFile(resolve(root, 'public/og.png'), resolve(staticOutput, 'og.png'));
await writeFile(resolve(staticOutput, '.nojekyll'), '');
console.log(`Built static site with ${recordings.length} validated recordings and ${archiveEditions.length} archived editions.`);
