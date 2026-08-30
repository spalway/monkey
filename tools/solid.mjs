// Flat silhouettes of the three primates in one colour, transparent elsewhere.
//
// Every non-background cell becomes the same fill — no shading, no accents — so
// what comes out is the shape alone, for use as a mark or stencil.
import fs from 'fs';
import { createRequire } from 'module';
import { SPRITES } from '../src/art/sprites.js';
const { encodePNG } = createRequire(import.meta.url)('./encode.cjs');

const FILL = '#FFC822';
const SCALE = 10;

const [r, g, b] = [1, 3, 5].map((i) => parseInt(FILL.slice(i, i + 2), 16));
fs.mkdirSync('samples/solid', { recursive: true });

for (const sprite of Object.values(SPRITES)) {
  // Which palette indices are background — those stay transparent.
  const isBg = sprite.slots.map(([role]) => role === 'bg');
  const W = sprite.w * SCALE, H = sprite.h * SCALE;
  const buf = Buffer.alloc(W * H * 4, 0);

  for (let y = 0; y < sprite.h; y++) {
    for (let x = 0; x < sprite.w; x++) {
      if (isBg[parseInt(sprite.rows[y][x], 16)]) continue;
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const o = (((y * SCALE + dy) * W) + (x * SCALE + dx)) * 4;
          buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = 255;
        }
      }
    }
  }

  const filled = sprite.rows.join('').split('').filter((c) => !isBg[parseInt(c, 16)]).length;
  const out = `samples/solid/${sprite.name}-solid.png`;
  fs.writeFileSync(out, encodePNG(W, H, buf));
  console.log(`${out.padEnd(34)} ${W}x${H}  ${filled} cells filled  ${FILL}`);
}
