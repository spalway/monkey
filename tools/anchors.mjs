import { SPRITES } from '../src/art/sprites.js';
import { toneBetween } from '../src/art/shade.js';
import { rgbToOklch, hexToRgb } from '../src/art/color.js';
const L=(h)=>rgbToOklch(hexToRgb(h))[0];
for (const s of Object.values(SPRITES)) {
  const fur = s.base.fur;
  console.log(`\n${s.name}: fur ${fur} L=${L(fur).toFixed(3)}`);
  for (const [role, hex] of Object.entries(s.base)) {
    if (role === 'fur' || role === 'bg') continue;
    console.log(`  ${role.padEnd(6)} ${hex} L=${L(hex).toFixed(3)}   L/Lfur=${(L(hex)/L(fur)).toFixed(3)}   tone vs fur = ${toneBetween(fur, hex)}`);
  }
}
