// The whole fur pool, one row per colourway, all three species.
//
// Use it to review the pool after editing FUR: every entry should read as vibrant
// rather than muddy, none should disappear into the backdrop, and the accents
// should have shaded into the fur rather than staying their original colour.
import fs from 'fs';
import { createRequire } from 'module';
import { WALKS, frameSprite } from '../src/art/frames.js';
import { FUR } from '../src/art/colorways.js';
import { toGrid } from '../src/art/render.js';
import { originalColors } from '../src/art/palette.js';
const { encodePNG } = createRequire(import.meta.url)('./encode.cjs');
const hx=(c)=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];

const walks = [WALKS.monkey, WALKS.ape, WALKS.kong];
const PAD = 5, scale = 3, gap = 4;
const cw = Math.max(...walks.map(w=>w.w)) + PAD*2, ch = Math.max(...walks.map(w=>w.h)) + PAD*2;
const W = (cw*walks.length + gap*(walks.length-1))*scale;
const H = (ch*FUR.length + gap*(FUR.length-1))*scale;
const buf = Buffer.alloc(W*H*4, 0);
const put=(px,py,c)=>{for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
  const x=px*scale+dx,y=py*scale+dy;if(x<0||y<0||x>=W||y>=H)return;
  const o=(y*W+x)*4;buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2];buf[o+3]=255;}};

FUR.forEach(([name, fur], row) => {
  const oy = row*(ch+gap);
  walks.forEach((w, i) => {
    const colors = { ...originalColors(w), fur };
    const g = toGrid(frameSprite(w, 0), colors, {});
    const ox = i*(cw+gap);
    for (let y=0;y<ch;y++) for (let x=0;x<cw;x++) put(ox+x, oy+y, hx(colors.bg));
    for (let y=0;y<w.h;y++) for (let x=0;x<w.w;x++)
      if (g[y][x] !== null) put(ox+PAD+x, oy+PAD+y, hx(g[y][x]));
  });
  console.log(`${String(row).padStart(2)}  ${name.padEnd(9)} ${fur}`);
});
fs.writeFileSync('samples/fur-pool.png', encodePNG(W,H,buf));
console.log(`\nsamples/fur-pool.png ${W}x${H}  ${FUR.length} colourways`);
