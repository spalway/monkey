import fs from 'fs';
import { createRequire } from 'module';
import { SPRITES } from '../src/art/sprites.js';
import { generate, resolvePalette, originalColors } from '../src/art/palette.js';
import { toGrid } from '../src/art/render.js';
const { encodePNG } = createRequire(import.meta.url)('./encode.cjs');

const hx = (c) => [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)];

/// Composite N variants of one sprite into a single contact sheet.
function sheet(sprite, variants, scale = 6, pad = 6, gap = 4) {
  const tw = sprite.w + pad*2, th = sprite.h + pad*2;
  const W = (tw*variants.length + gap*(variants.length-1)) * scale, H = th*scale;
  const buf = Buffer.alloc(W*H*4, 0);
  const put = (px,py,[r,g,b]) => {
    for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
      const x=px*scale+dx, y=py*scale+dy;
      if(x<0||y<0||x>=W||y>=H)continue;
      const o=(y*W+x)*4; buf[o]=r;buf[o+1]=g;buf[o+2]=b;buf[o+3]=255;
    }
  };
  variants.forEach((v, i) => {
    const ox = i*(tw+gap);
    const back = v.colors.bg ?? '#0b0d10';
    for(let y=0;y<th;y++)for(let x=0;x<tw;x++) put(ox+x, y, hx(back));
    const grid = toGrid(sprite, v.colors);
    for(let y=0;y<sprite.h;y++)for(let x=0;x<sprite.w;x++){
      const c = grid[y][x];
      if (c !== null && !(v.colors.bg === null && sprite.slots[parseInt(sprite.rows[y][x],16)][0]==='bg'))
        put(ox+pad+x, pad+y, hx(c));
    }
  });
  return { W, H, buf };
}

fs.mkdirSync('samples', { recursive: true });
const SEEDS = [7n, 42n, 1337n, 90210n, 555555n];

for (const sprite of Object.values(SPRITES)) {
  const variants = [{ label:'Original', colors: originalColors(sprite), traits:{} }];
  for (const s of SEEDS) {
    const g = generate(sprite, s);
    variants.push({ label:`seed ${s}`, colors:g.colors, traits:g.traits });
  }
  const r = sheet(sprite, variants);
  fs.writeFileSync(`samples/${sprite.name}-sheet.png`, encodePNG(r.W, r.H, r.buf));
  console.log(`\n=== ${sprite.name}  (${r.W}x${r.H})`);
  variants.forEach(v => console.log(`  ${v.label.padEnd(13)} ${Object.entries(v.traits).map(([k,x])=>`${k}=${x}`).join(' ')  || '(as drawn)'}`));
}
