// Generates simple PWA icons (a white "key" glyph on brand blue) with no
// external dependencies. Run: node scripts/generate-icons.mjs
// Replace public/icon-*.png with a real logo whenever you have one.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(publicDir, { recursive: true });

const BG = [37, 99, 235, 255]; // #2563eb
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

const CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(size, pixel) {
  const rowLen = size * 4 + 1;
  const raw = Buffer.alloc(rowLen * size);
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const c = pixel(x + 0.5, y + 0.5, size);
      const o = y * rowLen + 1 + x * 4;
      raw[o] = c[0];
      raw[o + 1] = c[1];
      raw[o + 2] = c[2];
      raw[o + 3] = c[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function keyPixel(rounded) {
  return (x, y, size) => {
    // rounded-corner mask for the background
    if (rounded) {
      const r = size * 0.22;
      let dx = 0;
      let dy = 0;
      if (x < r) dx = r - x;
      else if (x > size - r) dx = x - (size - r);
      if (y < r) dy = r - y;
      else if (y > size - r) dy = y - (size - r);
      if (dx * dx + dy * dy > r * r) return CLEAR;
    }
    // white key glyph
    const cx = size * 0.4;
    const cy = size * 0.5;
    const outerR = size * 0.165;
    const innerR = size * 0.085;
    const d = Math.hypot(x - cx, y - cy);
    const onRing = d <= outerR && d >= innerR;
    const stem =
      x >= cx && x <= size * 0.8 && y >= cy - size * 0.035 && y <= cy + size * 0.035;
    const toothY = y >= cy + size * 0.035 && y <= cy + size * 0.1;
    const tooth =
      toothY &&
      ((x >= size * 0.66 && x <= size * 0.685) ||
        (x >= size * 0.745 && x <= size * 0.77));
    return onRing || stem || tooth ? WHITE : BG;
  };
}

const targets = [
  { name: "icon-192x192.png", size: 192, rounded: true },
  { name: "icon-512x512.png", size: 512, rounded: true },
  { name: "icon-maskable-512x512.png", size: 512, rounded: false },
];

for (const t of targets) {
  const png = encodePng(t.size, keyPixel(t.rounded));
  writeFileSync(join(publicDir, t.name), png);
  console.log(`wrote public/${t.name} (${png.length} bytes)`);
}
console.log("Icons generated.");
