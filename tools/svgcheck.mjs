import fs from 'fs';
import { SPRITES } from '../src/art/sprites.js';
import { generate, originalColors } from '../src/art/palette.js';
import { toSVG } from '../src/art/render.js';
for (const s of Object.values(SPRITES)) {
  const orig = toSVG(s, originalColors(s));
  const g = generate(s, 1337n);
  const gen = toSVG(s, g.colors);
  fs.writeFileSync(`samples/${s.name}.svg`, orig);
  const b64 = Buffer.from(gen).toString('base64');
  console.log(`${s.name.padEnd(7)} svg ${String(orig.length).padStart(5)} B  rects=${(orig.match(/<rect/g)||[]).length}/${s.w*s.h} cells  data-uri ${(b64.length/1024).toFixed(1)} KB`);
}
