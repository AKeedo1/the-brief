import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "public", "edition");
const port = Number(process.argv[2] || 8790);
const host = process.argv[3] || "127.0.0.1";
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  const name = pathname === "/" ? "index.html" : pathname.replace(/^\/edition\//, "").replace(/^\//, "");
  if (!new Set(["index.html", "styles.css", "app.js", "og.png"]).has(name)) {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    const filePath = name === "og.png" ? resolve(root, "..", "og.png") : resolve(root, name);
    const body = await readFile(filePath);
    const payload = name === "index.html" ? body.toString("utf8").replaceAll("{{SITE_ORIGIN}}", `http://${request.headers.host}`) : body;
    response.writeHead(200, { "content-type": name === "og.png" ? "image/png" : (types[extname(name)] || "application/octet-stream"), "cache-control": "no-cache" }).end(payload);
  } catch {
    response.writeHead(500).end("Preview error");
  }
}).listen(port, host, () => console.log(`Daily Edition: http://${host}:${port}`));
