// Every rendered sprite tone must stay clear of the derived backdrop.
import { SPRITES } from '../src/art/sprites.js';
import { FUR } from '../src/art/colorways.js';
import { resolvePalette, BACKDROP, originalColors } from '../src/art/palette.js';
import { lightnessOf } from '../src/art/color.js';

let worst = { gap: Infinity };
console.log('fur          bgL     closest sprite tone   gap');
for (const [name, fur] of FUR.map((f) => [f[0], f[1]])) {
  const bd = BACKDROP;
  const bgL = lightnessOf(bd);
  let closest = null;
  for (const sp of Object.values(SPRITES)) {
    const pal = resolvePalette(sp, { ...originalColors(sp), fur, bg: bd }, {});
    sp.slots.forEach(([role], i) => {
      if (role === 'bg') return;
      const gap = Math.abs(lightnessOf(pal[i]) - bgL);
      if (!closest || gap < closest.gap) closest = { gap, hex: pal[i], sp: sp.name, role };
    });
  }
  if (closest.gap < worst.gap) worst = { ...closest, name, bd };
  const flag = closest.gap < 0.06 ? ' !!' : '';
  console.log(`${name.padEnd(12)} ${bgL.toFixed(3)}   ${closest.hex} ${closest.sp}/${closest.role}`.padEnd(52) +
    `${closest.gap.toFixed(3)}${flag}`);
}
console.log(`\nworst: ${worst.name} bg ${worst.bd} vs ${worst.sp}/${worst.role} ${worst.hex}  gap ${worst.gap.toFixed(3)}`);
