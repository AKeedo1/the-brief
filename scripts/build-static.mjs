import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "public", "edition");
const output = resolve(root, "dist", "server", "index.js");

const [html, css, js, ogImage] = await Promise.all([
  readFile(resolve(source, "index.html"), "utf8"),
  readFile(resolve(source, "styles.css"), "utf8"),
  readFile(resolve(source, "app.js"), "utf8"),
  readFile(resolve(root, "public", "og.png")),
]);

const worker = `const html = ${JSON.stringify(html)};
const css = ${JSON.stringify(css)};
const js = ${JSON.stringify(js)};
const ogBase64 = ${JSON.stringify(Buffer.from(ogImage).toString("base64"))};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;
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

await rm(resolve(root, "dist"), { recursive: true, force: true });
await mkdir(dirname(output), { recursive: true });
await writeFile(output, worker);
