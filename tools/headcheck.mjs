// The mouth must follow the face colour, not the fur. Render the head large in
// a few colourways where fur and face are far apart.
import fs from 'fs';
import { createRequire } from 'module';
import { KONG_WALK, frameSprite } from '../src/art/frames.js';
import { toGrid } from '../src/art/render.js';
import { generate, originalColors } from '../src/art/palette.js';
const { encodePNG } = createRequire(import.meta.url)('./encode.cjs');
const hx=(c)=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
const w=KONG_WALK;
const SETS=[
  ['as drawn', originalColors(frameSprite(w,0)), {}],
  ['neon',  {fur:'#39d914', crown:'#493b29', face:'#554e47', eye:'#ff4d4d', bg:'#08210a'}, {}],
  ['blood', {fur:'#c1272d', crown:'#493b29', face:'#554e47', eye:'#ffc95e', bg:'#210708'}, {}],
  ['bullion',{fur:'#e0a80f', crown:'#493b29', face:'#554e47', eye:'#fffefb', bg:'#211803'}, {}],
];
const X0=4,Y0=10,CW=22,CH=20,z=14;
const W=CW*z*SETS.length + 8*(SETS.length-1), H=CH*z;
const buf=Buffer.alloc(W*H*4,0);
SETS.forEach(([label,colors,nudges],i)=>{
  const g=toGrid(frameSprite(w,0),colors,nudges);
  const ox=i*(CW*z+8);
  for(let y=0;y<CH*z;y++)for(let x=0;x<CW*z;x++){
    const cx=X0+Math.floor(x/z), cy=Y0+Math.floor(y/z);
    const c=hx((cx<w.w&&cy<w.h?g[cy][cx]:null) ?? colors.bg);
    const o=((y*W)+(ox+x))*4;
    buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2];buf[o+3]=255;
  }
  console.log(label.padEnd(9),'fur',colors.fur,'face',colors.face);
});
fs.writeFileSync('samples/kong-mouth.png',encodePNG(W,H,buf));
console.log('\nsamples/kong-mouth.png '+W+'x'+H);
