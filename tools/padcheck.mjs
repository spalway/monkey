// Same art, no margin vs TILE_PAD, at identical box size — the art gets smaller
// inside the box, the grid is untouched.
import fs from 'fs';
import { createRequire } from 'module';
import { SPRITES } from '../src/art/sprites.js';
import { toGrid, TILE_PAD } from '../src/art/render.js';
import { originalColors } from '../src/art/palette.js';
const { encodePNG } = createRequire(import.meta.url)('./encode.cjs');
const hx=(c)=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];

const BOX = 260;
const names = ['monkey','ape','kong'];
const gap = 10;
const W = (BOX+gap)*names.length - gap, H = BOX*2 + gap;
const buf = Buffer.alloc(W*H*4, 0);

names.forEach((n, i) => {
  const sp = SPRITES[n], colors = originalColors(sp);
  const g = toGrid(sp, colors, {});
  [0, TILE_PAD].forEach((pad, r) => {
    const vw = sp.w + pad*2, vh = sp.h + pad*2;
    // fit the padded viewBox into a fixed box, exactly as the browser does
    const z = BOX / Math.max(vw, vh);
    const offX = i*(BOX+gap) + (BOX - vw*z)/2, offY = r*(BOX+gap) + (BOX - vh*z)/2;
    for (let y=0; y<Math.round(vh*z); y++) for (let x=0; x<Math.round(vw*z); x++) {
      const cx = Math.floor(x/z) - pad, cy = Math.floor(y/z) - pad;
      const inside = cx>=0 && cy>=0 && cx<sp.w && cy<sp.h;
      const c = hx((inside ? g[cy][cx] : null) ?? colors.bg);
      const px = Math.round(offX+x), py = Math.round(offY+y);
      if (px<0||py<0||px>=W||py>=H) continue;
      const o = (py*W+px)*4;
      buf[o]=c[0]; buf[o+1]=c[1]; buf[o+2]=c[2]; buf[o+3]=255;
    }
  });
});
fs.writeFileSync('samples/tile-padding.png', encodePNG(W,H,buf));
console.log(`samples/tile-padding.png ${W}x${H}  top row pad 0, bottom row pad ${TILE_PAD}`);
