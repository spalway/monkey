// Does regenerating each sprite from its base colours reproduce the source art?
import { SPRITES } from '../src/art/sprites.js';
import { resolvePalette, originalColors } from '../src/art/palette.js';
import { rgbToOklch, hexToRgb } from '../src/art/color.js';
const dE=(a,b)=>{const[L1,C1,h1]=rgbToOklch(hexToRgb(a)),[L2,C2,h2]=rgbToOklch(hexToRgb(b));
  const a1=C1*Math.cos(h1*Math.PI/180),b1=C1*Math.sin(h1*Math.PI/180);
  const a2=C2*Math.cos(h2*Math.PI/180),b2=C2*Math.sin(h2*Math.PI/180);
  return Math.hypot(L1-L2,a1-a2,b1-b2);};
let worst=0;
for (const s of Object.values(SPRITES)) {
  const gen = resolvePalette(s, originalColors(s));
  console.log(`\n${s.name}:`);
  s.source.forEach((src,i)=>{
    const d=dE(src, gen[i]); worst=Math.max(worst,d);
    console.log(`  [${String(i).padStart(2)}] ${s.slots[i][0].padEnd(5)} x${String(s.slots[i][1]).padEnd(5)}  source ${src} -> generated ${gen[i]}   dE=${d.toFixed(4)} ${d<0.02?'ok':'!!'}`);
  });
}
console.log(`\nworst dE across all three sprites = ${worst.toFixed(4)}`);
