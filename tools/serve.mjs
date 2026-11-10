/**
 * خادم معاينة محلي يحاكي سلوك Vercel:
 * cleanUrls (روابط بدون .html) + مجلدات index.html + صفحة 404.
 *
 * التشغيل: node tools/serve.mjs   ثم افتح http://127.0.0.1:8081
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, dirname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8081;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const isFile = async (path) => {
  try {
    return (await stat(path)).isFile();
  } catch (e) {
    return false;
  }
};

const send = async (res, file, status = 200) => {
  const body = await readFile(file);
  res.writeHead(status, {
    'Content-Type': MIME[extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  res.end(body);
};

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const decoded = decodeURIComponent(url.pathname);

    // يحاكي trailingSlash: false في Vercel
    if (decoded.length > 1 && decoded.endsWith('/')) {
      res.writeHead(308, { Location: encodeURI(decoded.replace(/\/+$/, '')) + url.search });
      res.end();
      return;
    }

    const target = normalize(join(ROOT, decoded));

    if (!target.startsWith(ROOT + sep) && target !== ROOT) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    if (await isFile(target)) {
      await send(res, target);
      return;
    }
    if (await isFile(`${target}.html`)) {
      await send(res, `${target}.html`);
      return;
    }
    const indexFile = join(target, 'index.html');
    if (await isFile(indexFile)) {
      await send(res, indexFile);
      return;
    }

    const notFound = join(ROOT, '404.html');
    if (await isFile(notFound)) {
      await send(res, notFound, 404);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('500');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`معاينة محلية: http://127.0.0.1:${PORT}`);
});
