import { readFile } from 'node:fs/promises';

// Range requests make seeking work in native audio controls, including Safari.
export async function serveFile(request, response, path, type) {
  const body = await readFile(path);
  const headers = { 'content-type': type, 'cache-control': 'no-cache', 'accept-ranges': 'bytes' };
  let start = 0, end = body.length - 1, code = 200;
  if (request.headers.range) {
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
    if (!range || (!range[1] && !range[2])) {
      response.writeHead(416, { 'content-range': `bytes */${body.length}` }).end(); return;
    }
    start = range[1] ? Number(range[1]) : Math.max(0, body.length - Number(range[2]));
    end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end;
    if (start > end || start >= body.length) {
      response.writeHead(416, { 'content-range': `bytes */${body.length}` }).end(); return;
    }
    code = 206;
    headers['content-range'] = `bytes ${start}-${end}/${body.length}`;
  }
  headers['content-length'] = end - start + 1;
  response.writeHead(code, headers).end(request.method === 'HEAD' ? undefined : body.subarray(start, end + 1));
}
