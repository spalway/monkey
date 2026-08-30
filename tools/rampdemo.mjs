import fs from 'fs';
import { createRequire } from 'module';
import { shade, TONE } from '../src/art/shade.js';
import { FUR } from '../src/art/colorways.js';
const { encodePNG } = createRequire(import.meta.url)('./encode.cjs');
const hx=(c)=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];

const ORDER = [['deep',TONE.deep],['shadow',TONE.shadow],['soft',TONE.soft],['base',1],['lift',TONE.lift],['light',TONE.light],['bright',TONE.bright]];
const SHOW = ['Umber','Rust','Slate','Moss','Cobalt','Ember','Bullion','Toxic','Glacier','Void'];
const rows = FUR.filter(([n])=>SHOW.includes(n));

console.log('fur         ' + ORDER.map(([n])=>n.padEnd(9)).join(''));
for (const [name, hex] of rows)
  console.log(name.padEnd(12) + ORDER.map(([,m])=>shade(hex,m).padEnd(9)).join(''));

const CELL=44, LBL=0, W=ORDER.length*CELL, H=rows.length*CELL;
const buf=Buffer.alloc(W*H*4);
rows.forEach((r,ri)=>ORDER.forEach(([,m],ci)=>{
  const [R,G,B]=hx(shade(r[1],m));
  for(let y=0;y<CELL;y++)for(let x=0;x<CELL;x++){
    const o=(((ri*CELL+y)*W)+(ci*CELL+x))*4;
    buf[o]=R;buf[o+1]=G;buf[o+2]=B;buf[o+3]=255;
  }
}));
fs.writeFileSync('samples/ramps.png', encodePNG(W,H,buf));
console.log(`\nsamples/ramps.png ${W}x${H}  (rows = fur colourway, columns = ${ORDER.map(o=>o[0]).join(' / ')})`);
