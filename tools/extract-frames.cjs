// Trace the walk-cycle frames of every species onto one shared canvas each.
//
// Unlike extract.cjs, which snaps each image to its own bounding box, frames must
// land on a common grid or the primate jitters as the cycle plays. Kong made that
// easy — its four frames happened to share a bounding-box height. The chimp and
// ape do not: their bodies genuinely rise and fall between poses. So frames are
// registered vertically on the ground, where the feet stay put, and horizontally
// on a head marker, rather than on their bounding boxes.
//
// Colours map onto the static sprite's palette rather than being re-quantised per
// frame, so the same fur cannot land on different indices between frames.

const fs = require('fs');
const { execFileSync } = require('child_process');
const { decodePNG } = require('./png.cjs');

const SPECIES = {
  monkey: {
    frames: ['frame1', 'frame2', 'frame3'],
    // The pale mask is the only thing wearing the face role, so it is the head.
    anchor: 'face', anchorTop: 1,
    extra: [],
  },
  ape: {
    frames: ['frame1', 'frame2', 'frame3'],
    // Skin covers the face *and* the hands and feet, which swing. Restricting it
    // to the upper part of the body leaves only the face.
    anchor: 'skin', anchorTop: 0.45,
    extra: [],
  },
  kong: {
    frames: ['frame1', 'frame2', 'frame3', 'frame4'],
    anchor: 'crown', anchorTop: 1,
    // The walk frames are a profile view whose muzzle carries a neutral mid-tone
    // the front-facing static pose never shows. Its two nearest matches in the
    // static palette are both fur, so without this the mouth recolours as fur and
    // goes grey.
    extra: [['#69686d', 'face']],
  },
};

const SPRITES_SRC = fs.readFileSync('src/art/sprites.js', 'utf8');

/// Role of each palette index, and each role's base colour, read out of the
/// generated sprite module so this cannot drift from the slot table.
function spriteMeta(name) {
  const block = SPRITES_SRC.split(`export const ${name} = {`)[1];
  const roles = [...(/slots: \[(.*?)\]\]/s.exec(block)[1].matchAll(/\['(\w+)'/g))].map((m) => m[1]);
  const base = JSON.parse(/base: (\{.*?\}),/s.exec(block)[1]);
  return { roles, base };
}

function bbox(img) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const o = (y * img.w + x) * 4;
      if (img.rgba[o] + img.rgba[o + 1] + img.rgba[o + 2] > 24) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/// One logical pixel, in source pixels. Every image in this project — the three
/// static sprites and all ten frames — comes out of the same pipeline at this
/// scale, measured by fitting the grid period to where colour changes fall
/// (tools/cellsize.cjs). It is deliberately a constant rather than measured per
/// frame: a per-frame fit lands anywhere in 8.57–8.70, and over seventy rows that
/// spread is enough to change the row count by one and shift a frame off the grid.
const CELL = 8.643;

/// Cell count along one axis, with a warning when the content box is not close to
/// a whole number of cells — that means CELL is wrong for this image.
function cells(px, what) {
  const exact = px / CELL;
  const n = Math.round(exact);
  if (Math.abs(exact - n) > 0.15) {
    console.log(`  WARNING: ${what} is ${px}px = ${exact.toFixed(2)} cells, not close to a whole number`);
  }
  return n;
}

function trace(file, refRgb) {
  const img = decodePNG(file);
  const b = bbox(img);
  const cols = cells(b.w, `${file} width`), rows = cells(b.h, `${file} height`);
  const cw = b.w / cols, ch = b.h / rows;

  const grid = [];
  for (let cy = 0; cy < rows; cy++) {
    const row = [];
    for (let cx = 0; cx < cols; cx++) {
      // Classify every pixel in the inner 60% of the cell, then take the majority.
      // Averaging the pixels and matching once blends across a colour boundary —
      // a cell straddling the muzzle and the fur averages into the grey between
      // them, which is what turned Kong's mouth grey. A vote keeps edges hard.
      const ix0 = Math.round(b.x0 + cx * cw + cw * 0.2), ix1 = Math.round(b.x0 + (cx + 1) * cw - cw * 0.2);
      const iy0 = Math.round(b.y0 + cy * ch + ch * 0.2), iy1 = Math.round(b.y0 + (cy + 1) * ch - ch * 0.2);
      const votes = new Array(refRgb.length).fill(0);
      let n = 0;
      for (let y = iy0; y < iy1; y++) {
        for (let x = ix0; x < ix1; x++) {
          if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
          const o = (y * img.w + x) * 4;
          const r = img.rgba[o], g = img.rgba[o + 1], bl = img.rgba[o + 2];
          let best = 0, bd = Infinity;
          refRgb.forEach((c, i) => {
            const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - bl) ** 2;
            if (d < bd) { bd = d; best = i; }
          });
          votes[best]++; n++;
        }
      }
      if (!n) { row.push(0); continue; }
      let best = 0;
      for (let i = 1; i < votes.length; i++) if (votes[i] > votes[best]) best = i;
      row.push(best);
    }
    grid.push(row);
  }
  return { cols, rows, cw, ch, grid };
}

/// Any bulk colour the palette covers poorly is one these frames need and we have
/// not declared. Better to be told than to have it snap to whichever neighbour
/// happens to be nearest — that is how Kong's mouth became fur.
function auditColours(files, refRgb) {
  const tally = new Map();
  for (const f of files) {
    const img = decodePNG(f);
    for (let i = 0; i < img.w * img.h; i++) {
      const r = img.rgba[i * 4], g = img.rgba[i * 4 + 1], b = img.rgba[i * 4 + 2];
      const k = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
      const e = tally.get(k) || { r: 0, g: 0, b: 0, n: 0 };
      e.r += r; e.g += g; e.b += b; e.n++; tally.set(k, e);
    }
  }
  for (const e of tally.values()) {
    if (e.n < 2000) continue;
    const c = [e.r / e.n, e.g / e.n, e.b / e.n];
    let bd = Infinity;
    for (const q of refRgb) bd = Math.min(bd, Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]));
    if (bd > 8) {
      const hex = '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
      console.log(`  WARNING: ${hex} (${e.n}px) is ${bd.toFixed(1)} from the nearest palette entry` +
        ' — add it to that species\' `extra` with a role');
    }
  }
}

/// Measure tones out of process; toneBetween lives in an ESM module.
function tones(pairs) {
  if (!pairs.length) return [];
  fs.writeFileSync('tools/.tone.mjs',
    `import{toneBetween}from'../src/art/shade.js';console.log(JSON.stringify(${JSON.stringify(pairs)}.map(([a,b])=>toneBetween(a,b))));`);
  const out = execFileSync(process.execPath, ['tools/.tone.mjs'], { encoding: 'utf8' });
  fs.unlinkSync('tools/.tone.mjs');
  return JSON.parse(out);
}

for (const [name, spec] of Object.entries(SPECIES)) {
  console.log(`\n=== ${name}`);
  const ref = JSON.parse(fs.readFileSync(`art/${name}.json`, 'utf8'));
  const { roles, base } = spriteMeta(name);
  const palette = [...ref.palette, ...spec.extra.map(([hex]) => hex)];
  const allRoles = [...roles, ...spec.extra.map(([, role]) => role)];
  const refRgb = palette.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const files = spec.frames.map((f) => `images/${name}/${f}.png`);

  auditColours(files, refRgb);
  const traced = files.map((f) => trace(f, refRgb));
  traced.forEach((t, i) => console.log(
    `  ${spec.frames[i]}: ${t.cols}x${t.rows}  cell ${t.cw.toFixed(3)}/${t.ch.toFixed(3)}`));

  // Horizontal anchor: the leftmost cell of the head marker. Restricted to the
  // upper body where the marker's role also covers limbs.
  const anchorIdx = new Set(allRoles.map((r, i) => (r === spec.anchor ? i : -1)).filter((i) => i >= 0));
  const anchors = traced.map((t) => {
    const limit = Math.round(t.rows * spec.anchorTop);
    let x0 = Infinity, n = 0;
    for (let y = 0; y < limit; y++) {
      for (let x = 0; x < t.cols; x++) if (anchorIdx.has(t.grid[y][x])) { if (x < x0) x0 = x; n++; }
    }
    return { x0: x0 === Infinity ? 0 : x0, n };
  });
  anchors.forEach((a, i) => console.log(`  ${spec.frames[i]}: ${spec.anchor} left ${a.x0} (${a.n} cells)`));
  const counts = new Set(anchors.map((a) => a.n));
  if (counts.size !== 1) {
    console.log(`  note: ${spec.anchor} cell counts differ (${[...counts].join(', ')}) —` +
      ' the marker is not drawn identically, so registration is approximate');
  }

  // Vertical: align the bottom row. The feet stay on the ground; it is the body
  // that rises and falls, so the lowest row is the fixed reference.
  const H = Math.max(...traced.map((t) => t.rows));
  const lefts = traced.map((t, i) => anchors[0].x0 - anchors[i].x0);
  const minLeft = Math.min(...lefts);
  const placedX = lefts.map((l) => l - minLeft);
  const W = Math.max(...placedX.map((p, i) => p + traced[i].cols));

  const frames = traced.map((t, i) => {
    const top = H - t.rows;
    const out = Array.from({ length: H }, () => new Array(W).fill(0));
    for (let y = 0; y < t.rows; y++) {
      for (let x = 0; x < t.cols; x++) out[top + y][placedX[i] + x] = t.grid[y][x];
    }
    return out;
  });

  const extraSlots = spec.extra.map(([hex, role], i) =>
    [role, tones(spec.extra.map(([h, r]) => [base[r], h]))[i], hex]);
  extraSlots.forEach(([role, tone, hex]) => console.log(`  extra slot: ${hex} -> ${role} tone ${tone}`));
  console.log(`  canvas ${W}x${H}, x offsets ${placedX.join(', ')}`);

  fs.writeFileSync(`art/${name}-frames.json`, JSON.stringify({ w: W, h: H, palette, extraSlots, frames }));
  console.log(`  wrote art/${name}-frames.json`);
}
