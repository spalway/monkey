const fs = require('fs');
const { decodePNG } = require('./png.cjs');
const { quantize } = require('./q.cjs');

const PER = 8.63; // measured cell size, consistent across all three sources

function snap(lo, hiExclusive) {
  const span = hiExclusive - lo;
  const n = Math.round(span / PER);
  return { n, cell: span / n, origin: lo };
}

function extract(name) {
  const img = decodePNG(`images/${name}.png`);
  const q = quantize(img, 26);
  // background is the most populous color (index 0 by construction)
  let x0=1e9,y0=1e9,x1=-1,y1=-1;
  for (let y=0;y<img.h;y++) for (let x=0;x<img.w;x++)
    if (q.idx[y*img.w+x] !== 0) { if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }

  const gx = snap(x0, x1+1), gy = snap(y0, y1+1);
  const W = gx.n, H = gy.n;
  const grid = new Uint16Array(W*H);

  for (let cy=0; cy<H; cy++) for (let cx=0; cx<W; cx++) {
    // sample the inner 60% of the cell to dodge resample bleed at the seams
    const ax = gx.origin + cx*gx.cell, bx = ax + gx.cell;
    const ay = gy.origin + cy*gy.cell, by = ay + gy.cell;
    const ix0 = Math.round(ax + gx.cell*0.2), ix1 = Math.round(bx - gx.cell*0.2);
    const iy0 = Math.round(ay + gy.cell*0.2), iy1 = Math.round(by - gy.cell*0.2);
    const tally = new Map();
    for (let y=iy0;y<iy1;y++) for (let x=ix0;x<ix1;x++) {
      if (x<0||y<0||x>=img.w||y>=img.h) continue;
      const v = q.idx[y*img.w+x];
      tally.set(v, (tally.get(v)||0)+1);
    }
    let best=0,bn=-1;
    for (const [v,n] of tally) if (n>bn) { bn=n; best=v; }
    grid[cy*W+cx] = best;
  }

  // remap to only the colors actually used
  const used = new Map();
  for (const v of grid) if (!used.has(v)) used.set(v, used.size);
  const palette = [...used.keys()].map(v => {
    const c = q.centers[v];
    return '#' + [c.r,c.g,c.b].map(x=>x.toString(16).padStart(2,'0')).join('');
  });
  const out = new Uint8Array(W*H);
  for (let i=0;i<grid.length;i++) out[i] = used.get(grid[i]);

  const hist = new Array(palette.length).fill(0);
  for (const v of out) hist[v]++;

  return { name, W, H, palette, grid: out, hist, img, q, gx, gy };
}

for (const name of process.argv.slice(2)) {
  const r = extract(name);
  console.log(`\n=== ${r.name}  grid ${r.W}x${r.H}  cell=${r.gx.cell.toFixed(3)}x${r.gy.cell.toFixed(3)}  ${r.palette.length} colors`);
  r.palette.map((hex,i)=>({hex,n:r.hist[i],i})).sort((a,b)=>b.n-a.n)
    .forEach(p => console.log(`  [${String(p.i).padStart(2)}] ${p.hex}  ${p.n} cells  ${(100*p.n/(r.W*r.H)).toFixed(1)}%`));
  fs.mkdirSync('art', { recursive: true });
  fs.writeFileSync(`art/${r.name}.json`, JSON.stringify({
    name: r.name, w: r.W, h: r.H, palette: r.palette,
    rows: Array.from({length:r.H}, (_,y) => Array.from(r.grid.slice(y*r.W,(y+1)*r.W))),
  }, null, 0));
}
