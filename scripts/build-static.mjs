import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "public", "edition");
const output = resolve(root, "dist", "server", "index.js");

const [html, css, js] = await Promise.all([
  readFile(resolve(source, "index.html"), "utf8"),
  readFile(resolve(source, "styles.css"), "utf8"),
  readFile(resolve(source, "app.js"), "utf8"),
]);

const worker = `const html = ${JSON.stringify(html)};
const css = ${JSON.stringify(css)};
const js = ${JSON.stringify(js)};

export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname.endsWith("/styles.css")) {
      return new Response(css, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=300" } });
    }
    if (pathname.endsWith("/app.js")) {
      return new Response(js, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=300" } });
    }
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
  }
};
`;

await rm(resolve(root, "dist"), { recursive: true, force: true });
await mkdir(dirname(output), { recursive: true });
await writeFile(output, worker);
