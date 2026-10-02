// Packs ./dist into release/last-bastion.zip (index.html at the archive root).
// Pure Node implementation (zlib + CRC32) so it works without a zip CLI.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const src = path.resolve('dist');
const outDir = path.resolve('release');
const out = path.join(outDir, 'last-bastion.zip');
if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error('dist/index.html not found — run `npm run build` first');
  process.exit(1);
}

const table = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}

const files = walk(src).sort();
const locals = [];
const central = [];
let offset = 0;
const dosTime = 0, dosDate = (2026 - 1980) << 9 | 1 << 5 | 1;
for (const file of files) {
  const name = path.relative(src, file).split(path.sep).join('/');
  if (/[^\x21-\x7e]/.test(name)) throw new Error(`Non-ASCII or space in file name: ${name}`);
  const data = fs.readFileSync(file);
  const comp = zlib.deflateRawSync(data, { level: 9 });
  const useComp = comp.length < data.length;
  const body = useComp ? comp : data;
  const crc = crc32(data);
  const nameBuf = Buffer.from(name, 'utf8');
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(useComp ? 8 : 0, 8);
  lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12); lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
  locals.push(lh, nameBuf, body);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(useComp ? 8 : 0, 10);
  ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20);
  ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
  central.push(ch, nameBuf);
  offset += 30 + nameBuf.length + body.length;
}
const cdSize = central.reduce((s, b) => s + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(offset, 16);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(out, Buffer.concat([...locals, ...central, end]));
const unpacked = files.reduce((s, f) => s + fs.statSync(f).size, 0);
console.log(`${out}: ${files.length} files, ${(fs.statSync(out).size / 1024).toFixed(1)} KB (unpacked ${(unpacked / 1024).toFixed(1)} KB)`);
