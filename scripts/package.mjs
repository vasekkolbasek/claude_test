// Packs dist/ into release/neon-swarm.zip (index.html at the archive root) and validates it
// against the Yandex Games archive rules. Pure Node — no system zip needed.
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { deflateRawSync, crc32 } from 'node:zlib';

const DIST = 'dist';
const OUT_DIR = 'release';
const OUT = join(OUT_DIR, 'neon-swarm.zip');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const files = walk(DIST).sort();
if (!files.some((f) => relative(DIST, f) === 'index.html')) fail('dist/index.html is missing — run `npm run build` first');

let total = 0;
const problems = [];
for (const f of files) {
  const rel = relative(DIST, f).split(sep).join('/');
  if (/[\s]/.test(rel)) problems.push(`space in file name: ${rel}`);
  if (/[^\x20-\x7e]/.test(rel)) problems.push(`non-ASCII (e.g. Cyrillic) in file name: ${rel}`);
  total += statSync(f).size;
}
if (problems.length) fail(problems.join('\n'));
if (total > 100 * 1024 * 1024) fail(`uncompressed size ${total} exceeds 100 MB`);

// index.html must only use relative paths (except the platform SDK)
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const url = m[1];
  if (url === '/sdk.js' || url.startsWith('data:')) continue;
  if (url.startsWith('/') || /^https?:/.test(url)) fail(`absolute URL in index.html: ${url}`);
}
if (!html.includes('<script src="/sdk.js"></script>')) fail('index.html must include <script src="/sdk.js"></script>');
// no external hosts in the bundle
for (const f of files.filter((x) => x.endsWith('.js') || x.endsWith('.css') || x.endsWith('.html'))) {
  const src = readFileSync(f, 'utf8');
  const hits = src.match(/https?:\/\/(?!www\.w3\.org|github\.com\/KilledByAPixel|yandex\.ru\/dev)[a-z0-9.-]+\.[a-z]{2,}[^\s"'`)]*/gi) ?? [];
  const bad = hits.filter((u) => /fonts\.googleapis|cdn|analytics|googletagmanager|unpkg|jsdelivr/.test(u));
  if (bad.length) fail(`external resource in ${f}: ${bad.slice(0, 3).join(', ')}`);
}

// ---- minimal ZIP writer (deflate)
const chunks = [];
const central = [];
let offset = 0;
const dosTime = (() => {
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
})();
for (const f of files) {
  const name = Buffer.from(relative(DIST, f).split(sep).join('/'), 'utf8');
  const data = readFileSync(f);
  const crc = crc32(data) >>> 0;
  const comp = deflateRawSync(data, { level: 9 });
  const useStore = comp.length >= data.length;
  const body = useStore ? data : comp;
  const method = useStore ? 0 : 8;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(dosTime.time, 10);
  local.writeUInt16LE(dosTime.date, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  chunks.push(local, name, body);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0);
  cen.writeUInt16LE(20, 4);
  cen.writeUInt16LE(20, 6);
  cen.writeUInt16LE(0x0800, 8);
  cen.writeUInt16LE(method, 10);
  cen.writeUInt16LE(dosTime.time, 12);
  cen.writeUInt16LE(dosTime.date, 14);
  cen.writeUInt32LE(crc, 16);
  cen.writeUInt32LE(body.length, 20);
  cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(name.length, 28);
  cen.writeUInt32LE(offset, 42);
  central.push(cen, name);
  offset += local.length + name.length + body.length;
}
const cenBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cenBuf.length, 12);
end.writeUInt32LE(offset, 16);
mkdirSync(OUT_DIR, { recursive: true });
const zip = Buffer.concat([...chunks, cenBuf, end]);
writeFileSync(OUT, zip);
console.log(`✓ ${OUT}: ${files.length} files, ${(total / 1024).toFixed(0)} KB uncompressed, ${(zip.length / 1024).toFixed(0)} KB zipped`);
