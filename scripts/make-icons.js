// Generates the app icons (a plate with a green calorie ring) as PNGs, with no dependencies.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x + 0.5, y + 0.5, size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const GREEN = [31, 122, 85];
const PLATE = [250, 249, 244];
const RING = [255, 196, 64];
const TRACK = [226, 222, 210];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function pixel(x, y, s) {
  const cx = s / 2, cy = s / 2;
  const d = Math.hypot(x - cx, y - cy) / s; // 0 at center
  const ang = (Math.atan2(y - cy, x - cx) + Math.PI * 2.5) % (Math.PI * 2); // 0 at top, clockwise
  const aa = 1 / s;
  const edge = (r) => Math.min(Math.max((r - d) / aa + 0.5, 0), 1); // inside-ness of circle radius r
  let c = GREEN;
  c = mix(c, PLATE, edge(0.34));
  const inRing = edge(0.29) * (1 - edge(0.215));
  const ringColor = ang < Math.PI * 1.45 ? RING : TRACK;
  c = mix(c, ringColor, inRing);
  return c;
}

for (const size of [180, 192, 512]) {
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png(size, pixel));
}
console.log('Icons written to', outDir);
