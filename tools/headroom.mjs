import fs from 'fs';
import { createRequire } from 'module';
import { SPRITES } from '../src/art/sprites.js';
import { toGrid } from '../src/art/render.js';
import { rgbToOklch, hexToRgb } from '../src/art/color.js';
import { resolvePalette } from '../src/art/palette.js';
const { encodePNG } = createRequire(import.meta.url)('./encode.cjs');
const hx=(c)=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
const L=(h)=>rgbToOklch(hexToRgb(h))[0];

// Kong's saddle is the lightest fur tone; how far does it separate from the body
// as the picked fur colour gets lighter?
const TEST = ['#1f6b0a','#2ba010','#39d914','#39ff14','#8bff6e','#c9ffbb'];
const k = SPRITES.kong;
const saddleTone = k.slots.find((s,i)=>s[0]==='fur' && s[1]===-0.2046)[1];
console.log('fur base    baseL   body -> saddle        separation (dL)');
for (const f of TEST) {
  const pal = resolvePalette(k, { fur:f, crown:'#0a2f08', face:'#12380c', eye:'#ff4d4d', bg:'#050d04' });
  const body = pal[6], saddle = pal[1];
  console.log(`${f}   ${L(f).toFixed(3)}   ${body} -> ${saddle}   ${(L(saddle)-L(body)).toFixed(4)}`);
}

const sets = TEST.map(f => [f, { fur:f, crown:'#0a2f08', face:'#12380c', eye:'#ff4d4d', bg:'#050d04' }]);
const scale=5, pad=5, tw=k.w+pad*2, th=k.h+pad*2, gap=4;
const W=(tw*sets.length+gap*(sets.length-1))*scale, H=th*scale;
const buf=Buffer.alloc(W*H*4,0);
const put=(px,py,c)=>{for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
  const x=px*scale+dx,y=py*scale+dy; if(x<0||y<0||x>=W||y>=H)return;
  const o=(y*W+x)*4;buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2];buf[o+3]=255;}};
sets.forEach(([,colors],i)=>{
  const ox=i*(tw+gap);
  for(let y=0;y<th;y++)for(let x=0;x<tw;x++) put(ox+x,y,hx(colors.bg));
  const g=toGrid(k,colors);
  for(let y=0;y<k.h;y++)for(let x=0;x<k.w;x++) if(g[y][x]!==null) put(ox+pad+x,pad+y,hx(g[y][x]));
});
fs.writeFileSync('samples/kong-headroom.png', encodePNG(W,H,buf));
console.log(`\nsamples/kong-headroom.png ${W}x${H}`);
