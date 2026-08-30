import { SPRITES } from '../src/art/sprites.js';
import { shade } from '../src/art/shade.js';
import { rgbToOklch, hexToRgb } from '../src/art/color.js';
const dE=(a,b)=>{const[L1,C1,h1]=rgbToOklch(hexToRgb(a)),[L2,C2,h2]=rgbToOklch(hexToRgb(b));
  const a1=C1*Math.cos(h1*Math.PI/180),b1=C1*Math.sin(h1*Math.PI/180);
  const a2=C2*Math.cos(h2*Math.PI/180),b2=C2*Math.sin(h2*Math.PI/180);
  return Math.hypot(L1-L2,a1-a2,b1-b2);};
for (const s of Object.values(SPRITES)) {
  console.log(`\n=== ${s.name}  bases: ${JSON.stringify(s.base)}`);
  s.source.forEach((src,i)=>{
    const [curRole,curMul]=s.slots[i];
    if (curRole==='bg') return;
    const opts=[];
    for (const [role,base] of Object.entries(s.base)) {
      // exact multiplier that matches lightness, then measure residual hue/chroma error
      const mul = rgbToOklch(hexToRgb(src))[0] / rgbToOklch(hexToRgb(base))[0];
      opts.push({ role, mul:+mul.toFixed(3), d: dE(shade(base,+mul.toFixed(3)), src) });
    }
    opts.sort((a,b)=>a.d-b.d);
    const cur = dE(shade(s.base[curRole]??'#000000', curMul), src);
    const b=opts[0];
    const flag = (b.role!==curRole && cur-b.d > 0.008) ? '  <-- reassign' : '';
    console.log(`  [${String(i).padStart(2)}] ${src}  current ${curRole}x${curMul} dE=${cur.toFixed(4)}   best ${b.role}x${b.mul} dE=${b.d.toFixed(4)}${flag}`);
  });
}
