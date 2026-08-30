// OKLCH colour helpers. Shading happens in OKLCH because it keeps hue and
// perceived lightness independent — multiplying L in sRGB darkens and desaturates
// unevenly across hues, which is exactly the artefact the source art avoids.

function srgb2lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function lin2srgb(c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055; }

export function rgbToOklch([r, g, b]) {
  const R = srgb2lin(r), G = srgb2lin(g), B = srgb2lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return [L, Math.hypot(A, Bb), (Math.atan2(Bb, A) * 180 / Math.PI + 360) % 360];
}

function oklchToLinear([L, C, h]) {
  const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

const inGamut = (rgb) => rgb.every((c) => c >= -0.0002 && c <= 1.0002);

/// OKLCH -> sRGB, reducing chroma until the colour is representable.
/// Without this, a vivid base pushed to a highlight step clips per-channel and
/// the hue visibly shifts.
export function oklchToRgb([L, C, h]) {
  L = Math.max(0, Math.min(1, L));
  let lo = 0, hi = C;
  if (!inGamut(oklchToLinear([L, C, h]))) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear([L, mid, h]))) lo = mid; else hi = mid;
    }
    C = lo;
  }
  return oklchToLinear([L, C, h]).map((c) => Math.max(0, Math.min(255, Math.round(lin2srgb(c) * 255))));
}

export const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const rgbToHex = (rgb) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');

/// Re-lightness a colour: keep its hue and chroma, move it to `targetL`.
/// Used to place an accent colour at a lightness derived from the fur, so the
/// face plate stays as readable against neon fur as it is against grey.
export function relight(hex, targetL) {
  const [, C, h] = rgbToOklch(hexToRgb(hex));
  return rgbToHex(oklchToRgb([targetL, C, h]));
}

export const lightnessOf = (hex) => rgbToOklch(hexToRgb(hex))[0];

/// Move a colour's hue and chroma toward another's, keeping its lightness.
///
/// Used to shade an accent — a face, a crown, hands, a tail — into the fur colour
/// the generator rolled. Lightness is left alone because the anchor has already
/// placed it: this only decides *which* colour the accent is, not how light.
/// Chroma lands short of the fur's own (`chromaShare`) so skin and muzzle stay
/// visibly softer than the coat rather than becoming a second block of it.
export function tintToward(hex, target, amount, chromaShare = 0.55) {
  if (!amount) return hex;
  const [L, C, h] = rgbToOklch(hexToRgb(hex));
  const [, tC, tH] = rgbToOklch(hexToRgb(target));
  const arc = ((tH - h + 540) % 360) - 180; // shortest way round
  return rgbToHex(oklchToRgb([
    L,
    Math.max(0, C + (tC * chromaShare - C) * amount),
    (h + arc * amount + 360) % 360,
  ]));
}
