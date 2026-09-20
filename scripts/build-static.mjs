import { mkdir, readFile, rm, writeFile, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { validateAudio } from './audio-contract.mjs';

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "public", "edition");
const output = resolve(root, "dist", "server", "index.js");
const staticOutput = resolve(root, 'dist', 'site');
const manifest = JSON.parse(await readFile(resolve(root, 'content/audio-manifest.json'), 'utf8'));
const recordings = validateAudio(await readFile(resolve(root, 'content/edition.json')), await readFile(resolve(root, 'content/audio-script.json')), manifest);
const audioJs = await readFile(resolve(source, 'audio-player.js'), 'utf8');

const [html, css, js, ogImage] = await Promise.all([
  readFile(resolve(source, "index.html"), "utf8"),
  readFile(resolve(source, "styles.css"), "utf8"),
  readFile(resolve(source, "app.js"), "utf8"),
  readFile(resolve(root, "public", "og.png")),
]);

const worker = `const html = ${JSON.stringify(html)};
const css = ${JSON.stringify(css)};
const js = ${JSON.stringify(js)};
const audioJs = ${JSON.stringify(audioJs)};
const ogBase64 = ${JSON.stringify(Buffer.from(ogImage).toString("base64"))};

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname.endsWith('/audio-player.js')) return new Response(audioJs, { headers: { 'content-type': 'text/javascript; charset=utf-8' } });
    if (pathname.includes('/audio/')) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Audio assets unavailable', {status:404});
    if (pathname.endsWith("/og.png")) {
      const bytes = Uint8Array.from(atob(ogBase64), character => character.charCodeAt(0));
      return new Response(bytes, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    }
    if (pathname.endsWith("/styles.css")) {
      return new Response(css, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=300" } });
    }
    if (pathname.endsWith("/app.js")) {
      return new Response(js, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=300" } });
    }
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
for (const name of ['index.html', 'styles.css', 'app.js', 'audio-player.js', ...new Set(recordings.map(recording => recording.src))]) {
  const target = resolve(staticOutput, name);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(source, name), target);
}
for (const name of ['og.png', 'favicon.svg']) await copyFile(resolve(root, 'public', name), resolve(staticOutput, name));
await writeFile(resolve(staticOutput, '.nojekyll'), '');
console.log(`Built static site with ${recordings.length} validated recordings.`);
