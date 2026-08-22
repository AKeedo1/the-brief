import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "public", "edition");
const port = Number(process.argv[2] || 8790);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  const name = pathname === "/" ? "index.html" : pathname.replace(/^\/edition\//, "").replace(/^\//, "");
  if (!new Set(["index.html", "styles.css", "app.js", "og.png"]).has(name)) {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    const body = await readFile(resolve(root, name));
    response.writeHead(200, { "content-type": name === "og.png" ? "image/png" : (types[extname(name)] || "application/octet-stream"), "cache-control": "no-cache" }).end(body);
  } catch {
    response.writeHead(500).end("Preview error");
  }
}).listen(port, "127.0.0.1", () => console.log(`Daily Edition preview: http://127.0.0.1:${port}`));
