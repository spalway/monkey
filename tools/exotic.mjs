import fs from 'fs';
import { createRequire } from 'module';
import { SPRITES } from '../src/art/sprites.js';
import { toGrid } from '../src/art/render.js';
import { resolvePalette, BACKDROP } from '../src/art/palette.js';
const { encodePNG } = createRequire(import.meta.url)('./encode.cjs');
const hx = (c) => [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)];

const SETS = {
  kong: [
    ['Blood',       { fur:'#c1272d', crown:'#2b0d0f', face:'#4a1518', eye:'#ffc95e' }],
    ['Neon Viper',  { fur:'#39d914', crown:'#0a2f08', face:'#12380c', eye:'#ff4d4d' }],
    ['Voltage',     { fur:'#1b6bff', crown:'#06133d', face:'#0d1c47', eye:'#5ff0ff' }],
    ['Bullion',     { fur:'#e0a80f', crown:'#4a2f05', face:'#6b4708', eye:'#fffefb' }],
    ['Ultraviolet', { fur:'#9d4edd', crown:'#2b0a45', face:'#3d1259', eye:'#5ff0ff' }],
    ['Magma',       { fur:'#ff5714', crown:'#2e0a02', face:'#591b06', eye:'#ffd166' }],
  ],
  monkey: [
    ['Neon Green',  { fur:'#39ff14', limb:'#1f7a3c', face:'#eaffe0' }],
    ['Hot Pink',    { fur:'#ff2d95', limb:'#8a2760', face:'#ffe4f2' }],
    ['Cyan',        { fur:'#00e5ff', limb:'#20687e', face:'#e0fbff' }],
    ['Amethyst',    { fur:'#a855f7', limb:'#573091', face:'#f3e8ff' }],
    ['Solar',       { fur:'#ffb703', limb:'#96631f', face:'#fff4d6' }],
    ['Toxic',       { fur:'#b6ff00', limb:'#57701a', face:'#f4ffcc' }],
  ],
  ape: [
    ['Crimson',     { fur:'#d32f2f', skin:'#ffd6b0', eye:'#fffefb' }],
    ['Toxic',       { fur:'#7cff2f', skin:'#d9ffb0', eye:'#ff4d4d' }],
    ['Cobalt',      { fur:'#2b57c4', skin:'#b8d4ff', eye:'#ffc95e' }],
    ['Bullion',     { fur:'#e0a80f', skin:'#fff0c2', eye:'#fffefb' }],
    ['Fuchsia',     { fur:'#e91e8c', skin:'#ffd0ea', eye:'#5ff0ff' }],
    ['Ultraviolet', { fur:'#7c3aed', skin:'#ddc4ff', eye:'#5ff0ff' }],
  ],
};

function sheet(sprite, sets, scale = 6, pad = 6, gap = 4) {
  const tw = sprite.w + pad*2, th = sprite.h + pad*2;
  const W = (tw*sets.length + gap*(sets.length-1)) * scale, H = th*scale;
  const buf = Buffer.alloc(W*H*4, 0);
  const put = (px,py,[r,g,b]) => {
    for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
      const x=px*scale+dx, y=py*scale+dy;
      if(x<0||y<0||x>=W||y>=H)return;
      const o=(y*W+x)*4; buf[o]=r;buf[o+1]=g;buf[o+2]=b;buf[o+3]=255;
    }
  };
  sets.forEach(([, colors], i) => {
    const ox = i*(tw+gap);
    colors.bg = BACKDROP;
    for(let y=0;y<th;y++)for(let x=0;x<tw;x++) put(ox+x, y, hx(colors.bg));
    const grid = toGrid(sprite, colors);
    for(let y=0;y<sprite.h;y++)for(let x=0;x<sprite.w;x++)
      if (grid[y][x] !== null) put(ox+pad+x, pad+y, hx(grid[y][x]));
  });
  return { W, H, buf };
}

fs.mkdirSync('samples', { recursive: true });
for (const [name, sets] of Object.entries(SETS)) {
  const sprite = SPRITES[name];
  const r = sheet(sprite, sets);
  fs.writeFileSync(`samples/${name}-exotic.png`, encodePNG(r.W, r.H, r.buf));
  console.log(`\n=== ${name}-exotic.png  ${r.W}x${r.H}   [${sets.map(s=>s[0]).join(' | ')}]`);
  // show the fur ramp each one resolves to, so flat-looking results are visible as numbers
  for (const [label, colors] of sets) {
    const pal = resolvePalette(sprite, colors);
    const fur = sprite.slots.map((s,i)=>[s,pal[i]]).filter(([s])=>s[0]==='fur')
      .sort((a,b)=>(a[0][1]<0?2-(-a[0][1]):a[0][1])-(b[0][1]<0?2-(-b[0][1]):b[0][1]));
    console.log(`  ${label.padEnd(12)} fur tones: ${fur.map(([s,h])=>h).join(' ')}`);
  }
}
