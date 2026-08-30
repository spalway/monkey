// Every walk cycle, as drawn and recoloured, to confirm one roll lights all frames.
import fs from 'fs';
import { createRequire } from 'module';
import { WALKS, frameSprite, cycleMs } from '../src/art/frames.js';
import { toGrid } from '../src/art/render.js';
import { generate, originalColors } from '../src/art/palette.js';
const { encodePNG } = createRequire(import.meta.url)('./encode.cjs');
const hx=(c)=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];

const walks = Object.values(WALKS);
const SEEDS = [null, 42n, 8675309n];
const scale=4, gap=3;
const cw = Math.max(...walks.map(w=>w.w)), ch = Math.max(...walks.map(w=>w.h));
const cols = Math.max(...walks.map(w=>w.frames.length));
const W=(cw*cols+gap*(cols-1))*scale, H=(ch*walks.length*SEEDS.length + gap*(walks.length*SEEDS.length-1))*scale;
const buf=Buffer.alloc(W*H*4,0);
const put=(px,py,c)=>{for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
  const x=px*scale+dx,y=py*scale+dy;if(x<0||y<0||x>=W||y>=H)return;
  const o=(y*W+x)*4;buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2];buf[o+3]=255;}};

let row=0;
for (const seed of SEEDS) {
  for (const w of walks) {
    const { colors, nudges } = seed === null
      ? { colors: originalColors(frameSprite(w,0)), nudges: {} }
      : generate(frameSprite(w,0), seed);
    const oy = row*(ch+gap);
    w.frames.forEach((_, i) => {
      const ox = i*(cw+gap);
      const g = toGrid(frameSprite(w,i), colors, nudges);
      for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)
        put(ox+x, oy+y, hx((y<w.h&&x<w.w ? g[y][x] : null) ?? colors.bg));
    });
    console.log(`${(seed===null?'as drawn':'seed '+seed).padEnd(14)} ${w.name.padEnd(7)} ${w.frames.length} frames  bg ${colors.bg}`);
    row++;
  }
}
fs.writeFileSync('samples/walk-cycles.png', encodePNG(W,H,buf));
console.log(`\nsamples/walk-cycles.png ${W}x${H}`);
