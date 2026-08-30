// Recover each frame's true cell size from where colour changes actually fall,
// rather than assuming it from the static sprite's row count.
const { decodePNG } = require('./png.cjs');
const { quantize, energy, peaks } = require('./q.cjs');

for (const spec of process.argv.slice(2)) {
  const img = decodePNG(spec);
  const q = quantize(img, 26);
  const out = {};
  for (const axis of ['x', 'y']) {
    const p = peaks(energy(q.idx, img.w, img.h, axis));
    let best = null;
    for (let per = 7.0; per <= 11.5; per += 0.001) {
      for (let off = 0; off < per; off += 0.25) {
        let err = 0;
        for (const v of p) { const d = (v - off) / per; err += (d - Math.round(d)) ** 2; }
        err /= p.length || 1;
        if (!best || err < best.err) best = { per: +per.toFixed(3), off: +off.toFixed(2), err };
      }
    }
    out[axis] = best;
  }
  // content box, to turn the period into a cell count
  let x0=1e9,y0=1e9,x1=-1,y1=-1;
  for (let y=0;y<img.h;y++) for (let x=0;x<img.w;x++) {
    const o=(y*img.w+x)*4;
    if (img.rgba[o]+img.rgba[o+1]+img.rgba[o+2] > 24) { if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  }
  const bw = x1-x0+1, bh = y1-y0+1;
  const cell = (out.x.per + out.y.per) / 2;
  console.log(`${spec.padEnd(28)} cellX=${out.x.per} cellY=${out.y.per} (err ${out.x.err.toFixed(4)}/${out.y.err.toFixed(4)})` +
    `  bbox ${bw}x${bh} -> ${(bw/cell).toFixed(2)} x ${(bh/cell).toFixed(2)} cells`);
}
