import fs from 'fs';
import { createRequire } from 'module';
import { SPRITES } from '../src/art/sprites.js';
import { toGrid } from '../src/art/render.js';
const { encodePNG } = createRequire(import.meta.url)('./encode.cjs');
const hx=(c)=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];

// Left of each pair: the gorilla's own face anchor (fur x 0.924, a dark plate).
// Right: the monkey's anchor (fur lightened 79% to white, a pale mask).
const kong = SPRITES.kong;
const PALE = { ...kong, anchors: { ...kong.anchors, face: SPRITES.monkey.anchors.face } };
const CASES = [
  ['grey',  { fur:'#57595d', crown:'#493b29', face:'#554e47', eye:'#fffdf9' }],
  ['blood', { fur:'#c1272d', crown:'#2b0d0f', face:'#554e47', eye:'#ffc95e' }],
  ['neon',  { fur:'#39d914', crown:'#0a2f08', face:'#554e47', eye:'#ff4d4d' }],
];
const BG='#0b0d10', scale=5, pad=4, gap=4;
const tw=kong.w+pad*2, th=kong.h+pad*2, n=CASES.length*2;
const W=(tw*n+gap*(n-1))*scale, H=th*scale;
const buf=Buffer.alloc(W*H*4,0);
const put=(px,py,c)=>{for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
  const x=px*scale+dx,y=py*scale+dy; if(x<0||y<0||x>=W||y>=H)return;
  const o=(y*W+x)*4;buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2];buf[o+3]=255;}};
let col=0;
for (const [,colors] of CASES) for (const sp of [kong, PALE]) {
  const ox=col*(tw+gap); col++;
  for(let y=0;y<th;y++)for(let x=0;x<tw;x++) put(ox+x,y,hx(BG));
  const g=toGrid(sp,{...colors,bg:BG},{});
  for(let y=0;y<sp.h;y++)for(let x=0;x<sp.w;x++) if(g[y][x]!==null) put(ox+pad+x,pad+y,hx(g[y][x]));
}
fs.writeFileSync('samples/face-anchor-alt.png', encodePNG(W,H,buf));
console.log(`samples/face-anchor-alt.png ${W}x${H}`);
console.log('pairs: grey [own | pale] , blood [own | pale] , neon [own | pale]');
