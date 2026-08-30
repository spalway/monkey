import { resolvePalette } from './palette.js';

/// Cells of margin around a primate on a tile. Enough that it is not jammed
/// against the edge, small enough that the art still dominates its box.
export const TILE_PAD = 6;

/// Per-cell hex grid (null = transparent), the common form both renderers use.
export function toGrid(sprite, colors, nudges) {
  const pal = resolvePalette(sprite, colors, nudges);
  return sprite.rows.map((row) => [...row].map((ch) => pal[parseInt(ch, 16)]));
}

/// Cells sharing the backdrop colour, which the padded background rect covers.
const isBackdrop = (sprite) => sprite.slots.map(([role]) => role === 'bg');

/// Render to SVG. Cells are merged into horizontal runs, which cuts the element
/// count by roughly 10x versus one rect per pixel and keeps the data URI small
/// enough to sit directly in token metadata.
///
/// `pad` adds that many cells of margin on every side so the primate is not
/// jammed against the edge of its tile. It grows the viewBox rather than scaling
/// the art: the grid is untouched, every cell stays exactly one unit, and the
/// sprite loses no detail — it simply occupies less of the box. Scaling the
/// artwork down to make room is what would cost detail.
export function toSVG(sprite, colors, { scale = 1, nudges, pad = 0 } = {}) {
  const grid = toGrid(sprite, colors, nudges);
  const bgCell = isBackdrop(sprite);
  // The backdrop is one flat colour, so it is painted once across the whole
  // padded canvas instead of per cell. That fills the margin as well, and drops
  // a few hundred rects from the output.
  const backdrop = 'bg' in colors ? colors.bg : sprite.base.bg;

  const parts = [];
  if (backdrop != null) {
    parts.push(`<rect x="${-pad}" y="${-pad}" width="${sprite.w + pad * 2}" ` +
      `height="${sprite.h + pad * 2}" fill="${backdrop}"/>`);
  }
  for (let y = 0; y < sprite.h; y++) {
    let x = 0;
    while (x < sprite.w) {
      const c = grid[y][x];
      let run = 1;
      while (x + run < sprite.w && grid[y][x + run] === c) run++;
      const covered = c === null || (backdrop != null && bgCell[parseInt(sprite.rows[y][x], 16)]);
      if (!covered) parts.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${c}"/>`);
      x += run;
    }
  }
  const vw = sprite.w + pad * 2, vh = sprite.h + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${vw * scale}" height="${vh * scale}" ` +
    `viewBox="${-pad} ${-pad} ${vw} ${vh}" shape-rendering="crispEdges">` +
    parts.join('') + '</svg>';
}

/// Render to a raw RGBA buffer at an integer scale.
export function toRGBA(sprite, colors, scale = 1, nudges) {
  const grid = toGrid(sprite, colors, nudges);
  const W = sprite.w * scale, H = sprite.h * scale;
  const buf = new Uint8Array(W * H * 4);
  for (let y = 0; y < sprite.h; y++) {
    for (let x = 0; x < sprite.w; x++) {
      const c = grid[y][x];
      const [r, g, b, a] = c === null ? [0, 0, 0, 0]
        : [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255];
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const o = (((y * scale + dy) * W) + (x * scale + dx)) * 4;
          buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = a;
        }
      }
    }
  }
  return { w: W, h: H, buf };
}
