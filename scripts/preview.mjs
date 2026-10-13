import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { serveFile } from './serve-file.mjs';

const root = resolve(import.meta.dirname, "..", "dist", "site");
const port = Number(process.argv[2] || 8790);
const host = process.argv[3] || "127.0.0.1";
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };

createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  const name = pathname === "/" ? "index.html" : `${pathname.replace(/^\//, "")}${pathname.endsWith('/') ? 'index.html' : ''}`;
  const filePath = resolve(root, name);
  const insideRoot = relative(root, filePath);
  if (insideRoot.startsWith('..') || resolve(root, insideRoot) !== filePath) {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    if (name.endsWith('.mp3')) { await serveFile(request, response, filePath, 'audio/mpeg'); return; }
    const body = await readFile(filePath);
    const payload = extname(name) === ".html" ? body.toString("utf8").replaceAll("{{SITE_ORIGIN}}", `http://${request.headers.host}`) : body;
    response.writeHead(200, { "content-type": types[extname(name)] || "application/octet-stream", "cache-control": "no-cache" }).end(payload);
  } catch {
    response.writeHead(500).end("Preview error");
  }
}).listen(port, host, () => console.log(`Daily Edition: http://${host}:${port}`));
