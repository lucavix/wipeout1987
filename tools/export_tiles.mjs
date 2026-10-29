// Writes the procedural default textures as PNGs into public/textures/ (run: npm run textures:generate).
// Compiles src/gfx/tilegen.ts with tsc into a temp dir, then encodes each tile with a minimal PNG writer.
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const out = 'public/textures';
mkdirSync(out, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'tilegen-'));
execSync(`npx tsc src/gfx/tilegen.ts --outDir ${tmp} --module es2020 --target es2020 --moduleResolution bundler --skipLibCheck`, { stdio: 'inherit' });
writeFileSync(join(tmp, 'package.json'), '{"type":"module"}');
const { TILE_SPECS } = await import(pathToFileURL(join(tmp, 'tilegen.js')).href);

const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (buf) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
function png(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const col = px(x, y);
      const o = y * (w * 4 + 1) + 1 + x * 4;
      if (col) { const [r, g, b] = hex(col); raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255; }
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const force = process.argv.includes('--force');
let readme = '# Texture della pista\n\nUn PNG per tile, pixel netti, nessuna trasparenza necessaria (tranne dove indicato).\n' +
  'Asse x = lungo la direzione di marcia, asse y = attraverso la striscia (y=0 lato esterno/sinistro).\n' +
  'Le tile si ripetono lungo la pista ogni 32 px (= 80 unita\' mondo, 1 px = 2.5 unita\').\n' +
  'Rigenera le versioni procedurali con `npm run textures:generate` (non sovrascrive i file esistenti; `-- --force` per farlo).\n\n' +
  '| file | dimensione | uso |\n|---|---|---|\n';
for (const s of TILE_SPECS) {
  const file = join(out, `${s.name}.png`);
  readme += `| ${s.name}.png | ${s.w}x${s.h} | ${s.note} |\n`;
  if (existsSync(file) && !force) { console.log('keep  ', file); continue; }
  writeFileSync(file, png(s.w, s.h, s.px));
  console.log('write ', file);
}
readme += '| kerb_right.png | 32x22 | opzionale: se manca, kerb_left specchiato |\n| pit_kerb_right.png | 32x12 | opzionale: se manca, pit_kerb_left specchiato |\n';
writeFileSync(join(out, 'README.md'), readme);
