import fs from 'fs';
import { createRequire } from 'module';
import { SPRITES } from '../src/art/sprites.js';
import { toGrid } from '../src/art/render.js';
import { BACKDROP, originalColors } from '../src/art/palette.js';
const { encodePNG } = createRequire(import.meta.url)('./encode.cjs');
const hx=(c)=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];

const FURS=[['Void','#191622'],['Soot','#332f2c'],['Oxblood','#6e2b2b'],['Umber','#4a413a']];
const rows=['monkey','ape','kong'];
const scale=5,pad=5,gap=4;
const cw=Math.max(...rows.map(r=>SPRITES[r].w))+pad*2, ch=Math.max(...rows.map(r=>SPRITES[r].h))+pad*2;
const W=(cw*FURS.length+gap*(FURS.length-1))*scale, H=(ch*rows.length+gap*(rows.length-1))*scale;
const buf=Buffer.alloc(W*H*4,0);
const put=(px,py,c)=>{for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
  const x=px*scale+dx,y=py*scale+dy;if(x<0||y<0||x>=W||y>=H)return;
  const o=(y*W+x)*4;buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2];buf[o+3]=255;}};
rows.forEach((n,ri)=>{
  const sp=SPRITES[n], oy=ri*(ch+gap);
  FURS.forEach(([label,fur],ci)=>{
    const ox=ci*(cw+gap), bd=BACKDROP;
    for(let y=0;y<ch;y++)for(let x=0;x<cw;x++) put(ox+x,oy+y,hx(bd));
    const g=toGrid(sp,{...originalColors(sp),fur,bg:bd},{});
    const dx=Math.floor((cw-sp.w)/2), dy=Math.floor((ch-sp.h)/2);
    for(let y=0;y<sp.h;y++)for(let x=0;x<sp.w;x++) if(g[y][x]!==null) put(ox+dx+x,oy+dy+y,hx(g[y][x]));
  });
});
fs.writeFileSync('samples/backdrop-worstcase.png',encodePNG(W,H,buf));
console.log('samples/backdrop-worstcase.png  cols: '+FURS.map(f=>f[0]).join(' | ')+`  bg ${BACKDROP}`);
