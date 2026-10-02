// Minimal static server: serves ./dist under /game/ (to verify relative paths work from a
// sub-folder) and an empty /sdk.js like the platform would provide. Optional mock SDK.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || 4173);
const mockSdk = process.env.MOCK_SDK ? fs.readFileSync(path.resolve('tests/e2e/mock-sdk.js'), 'utf8') : '';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/sdk.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(mockSdk || '/* platform sdk stub */');
    return;
  }
  if (url === '/' || url === '/game') { res.writeHead(302, { Location: '/game/' }); res.end(); return; }
  if (!url.startsWith('/game/')) { res.writeHead(404); res.end(); return; }
  let file = path.join(root, url.slice('/game/'.length) || 'index.html');
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
server.listen(port, () => console.log(`serving ${root} at http://localhost:${port}/game/`));
