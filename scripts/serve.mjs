// Minimal static server for tests: serves `root` under `/prefix/`, plus an empty /sdk.js stub.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const [, , root = 'dist', port = '4173', prefix = '/'] = process.argv;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    if (url === '/sdk.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end('/* no SDK locally */');
      return;
    }
    if (!url.startsWith(prefix)) {
      res.writeHead(404).end();
      return;
    }
    let rel = url.slice(prefix.length);
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = normalize(join(root, rel));
    if (!file.startsWith(normalize(root))) {
      res.writeHead(403).end();
      return;
    }
    await stat(file);
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(Number(port), () => console.log(`serving ${root} at http://localhost:${port}${prefix}`));
