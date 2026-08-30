// A walking Kong in the browser tab.
//
// Not a GIF: Chrome renders the first frame of an animated GIF favicon and
// stops, so a .gif would be a still image everywhere it matters. What does work
// in every current browser is swapping the <link rel="icon"> href on a timer,
// so each frame of the existing walk cycle is rasterised to a PNG once at
// startup and then cycled.
//
// The frames come from the same art the site draws, so the tab and the page
// cannot show different gorillas.

import { WALKS, frameSprite } from './art/frames.js';
import { toSVG } from './art/render.js';
import { originalColors } from './art/palette.js';

/// 64 rather than 32: browsers downscale for the tab strip, and the extra
/// resolution survives that better than an upscaled 32 would.
const SIZE = 64;

/// A transparent 1x1, so the tab shows nothing rather than a stale icon while
/// the frames are being rasterised.
const BLANK =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const loadSvg = (svg) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

/// Every frame of a walk as a PNG data URL.
async function rasterise(walk) {
  const colors = originalColors(walk);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  const urls = [];
  for (let i = 0; i < walk.frames.length; i++) {
    // Transparent backdrop: a tab strip is light in one theme and near-black in
    // another, and a painted tile would be the wrong colour in one of them.
    const svg = toSVG(frameSprite(walk, i), { ...colors, bg: null }, { pad: 1 });
    // eslint-disable-next-line no-await-in-loop -- four frames, once, at startup
    const img = await loadSvg(svg);

    // Fit inside the square without distorting: the sprite is taller than it is
    // wide, so scaling to the box would stretch him.
    const scale = Math.min(SIZE / img.width, SIZE / img.height);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round((SIZE - w) / 2), Math.round((SIZE - h) / 2), w, h);
    urls.push(canvas.toDataURL('image/png'));
  }
  return urls;
}

function iconLink() {
  let link = document.querySelector('link[rel~="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/png';
  return link;
}

/// Start the tab walking. Safe to call once, at startup; failures leave the
/// existing icon alone rather than clearing it.
export async function startWalkingFavicon(slug = 'kong') {
  const walk = WALKS[slug];
  if (!walk) return;

  let urls;
  try {
    urls = await rasterise(walk);
  } catch {
    return;
  }
  if (!urls.length) return;

  const link = iconLink();

  // Same reasoning as the sprites on the page: a looping animation is exactly
  // what this setting exists to suppress. The still pose still gets used.
  let reduced = false;
  try {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { /* no matchMedia: animate */ }

  if (reduced) {
    link.href = urls[0];
    return;
  }

  // Chained timeouts on the walk's own per-frame holds, not one interval — the
  // passing poses are meant to read quicker than the contact poses, and that is
  // the difference between a walk and a flicker.
  //
  // Deliberately not paused while the tab is hidden: a hidden tab is precisely
  // when its icon is the only part of the page anyone can see.
  let i = 0;
  const tick = () => {
    link.href = urls[i];
    const hold = walk.timing[i];
    i = (i + 1) % urls.length;
    setTimeout(tick, hold);
  };
  tick();
}

export { BLANK };
