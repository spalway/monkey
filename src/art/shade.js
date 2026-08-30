import { rgbToOklch, oklchToRgb, hexToRgb, rgbToHex } from './color.js';

/// Derive a shading tone from a base colour.
///
/// Measured off the three source sprites (tools/sweep2.mjs, tools/lighten.mjs):
/// every tone in the original art sits at its base's hue and chroma and differs
/// only in OKLCH lightness. So shading keeps H and C and moves L alone. Chroma
/// is reduced only when the result would leave sRGB, which oklchToRgb handles.
///
/// `tone` encodes both directions in one number:
///   tone === 1     the base colour itself
///   0 < tone < 1   shadow - L is multiplied by tone
///   tone < 0       highlight - L moves |tone| of the way to white
///
/// Shadows multiply because that is what the source art does and it holds its
/// shape at any base lightness. Highlights blend towards white instead: they fit
/// the source equally well, but multiplying L would drive an already-pale fur
/// colour straight to #ffffff and collapse the top of the ramp.
export function shade(hex, tone) {
  if (tone === 1) return hex;
  const [L, C, h] = rgbToOklch(hexToRgb(hex));
  const l = tone > 0 ? L * tone : L + (1 - L) * -tone;
  return rgbToHex(oklchToRgb([l, C, h]));
}

/// The tone value that turns `base` into `target`, for deriving slot values
/// from the source art. Inverse of shade() in the lightness dimension.
export function toneBetween(base, target) {
  const lb = rgbToOklch(hexToRgb(base))[0];
  const lt = rgbToOklch(hexToRgb(target))[0];
  // a black base has no lightness to scale; treat the slot as flat.
  if (lb <= 0) return 1;
  const t = lt <= lb ? lt / lb : -(lt - lb) / (1 - lb);
  return Math.round(t * 1e4) / 1e4;
}

/// Named tones as used by the source sprites, for hand-authoring new art.
export const TONE = {
  deep: 0.755,
  shadow: 0.820,
  soft: 0.915,
  base: 1,
  lift: -0.058,
  light: -0.205,
  bright: -0.298,
};
