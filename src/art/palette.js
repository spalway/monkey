import { shade } from './shade.js';
import { relight, lightnessOf, tintToward, rgbToOklch, oklchToRgb, hexToRgb, rgbToHex } from './color.js';
import * as CW from './colorways.js';

/// splitmix64. Chosen because it is trivial to mirror in the on-chain program:
/// the same seed must produce the same primate on chain, in the indexer, and in
/// the browser, so the generator cannot depend on a language's stdlib RNG.
const MASK = (1n << 64n) - 1n;
export function splitmix64(seed) {
  let s = BigInt(seed) & MASK;
  return () => {
    s = (s + 0x9e3779b97f4a7c15n) & MASK;
    let z = s;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
    return (z ^ (z >> 31n)) & MASK;
  };
}

/// Weighted pick. A pool entry is [name, hex, weight, nudge?].
function pick(pool, r) {
  const total = pool.reduce((a, e) => a + e[2], 0);
  let t = Number(r % BigInt(total));
  for (const [name, hex, w, nudge] of pool) {
    if (t < w) return { name, hex, nudge: nudge ?? 1 };
    t -= w;
  }
  const [name, hex, , nudge] = pool[0];
  return { name, hex, nudge: nudge ?? 1 };
}

/// Which trait pool feeds each sprite role. Draw order is fixed so a seed always
/// yields the same primate regardless of object key ordering.
const ROLE_POOLS = {
  fur: CW.FUR,
  skin: CW.SKIN,
  crown: CW.CROWN,
  face: null, // resolved per species below - the gorilla and monkey differ
  limb: CW.LIMB,
  eye: CW.EYE,
};
const FACE_POOL = { kong: CW.FACE_PLATE, monkey: CW.MASK };
const PER_SPECIES = { face: FACE_POOL };
const DRAW_ORDER = ['fur', 'skin', 'crown', 'face', 'limb', 'eye'];

/// The backdrop behind every primate.
///
/// Flat and shared, not derived from the fur: the collection reads as one set
/// when every tile sits on the same ground, and the tiles appear next to each
/// other far more often than alone.
export const BACKDROP = '#222222';

/// Seed for a minted asset, from the first 8 bytes of its address.
///
/// Costs nothing on chain and anyone can recompute it from the address alone, so
/// a token's colours are verifiable without trusting our metadata. Takes bytes
/// rather than a PublicKey so this module stays free of the web3 dependency.
export function seedFromBytes(bytes) {
  let s = 0n;
  for (let i = 0; i < 8; i++) s = (s << 8n) | BigInt(bytes[i]);
  return s;
}

/// Roll a full trait set for one sprite from a seed.
export function generate(sprite, seed) {
  const rng = splitmix64(seed);
  const roles = new Set(sprite.slots.map(([role]) => role));
  const traits = {};
  const colors = {};
  const nudges = {};

  for (const role of DRAW_ORDER) {
    if (!roles.has(role)) continue;
    const pool = PER_SPECIES[role]?.[sprite.name] ?? ROLE_POOLS[role];
    const p = pick(pool, rng());
    traits[role] = p.name;
    colors[role] = p.hex;
    nudges[role] = p.nudge;
  }
  colors.bg = BACKDROP;
  return { seed: String(seed), species: sprite.name, traits, colors, nudges };
}

/// Place accent colours at the lightness the source art gives them *relative to
/// the fur*, keeping only their hue and chroma from the trait pool.
///
/// In the originals no accent is an absolute colour: the gorilla's face plate is
/// fur x 0.924, its head patch fur x 0.781, the chimp's skin is fur lightened 74%
/// towards white. Pinning accents to fixed hexes instead makes the face read as a
/// hole the moment fur goes bright - the body races away while the accent stays
/// put. Anchoring holds that relationship at any fur brightness.
///
/// `nudges[role]` is the pool entry's own tone, applied on top of the anchor, so
/// a colourway can still be the darker or lighter member of its role.
///
/// Accents are then tinted into the rolled fur colour. Without it the coat is the
/// only thing that changes and the animal reads as two unrelated halves — the
/// chimp's grey tail and the ape's tan hands stayed put whatever colour the fur
/// became, which is most of why the shading looked flat.
/// How far each accent moves toward the fur's hue. High across the board — the
/// head, face and hands are meant to read as the rolled colour, not as leftovers
/// from the original art. Eyes are never anchored, so never tinted.
const TINT = { skin: 0.8, face: 0.8, limb: 0.85, crown: 0.8 };

function anchorAccents(sprite, colors, nudges) {
  if (!sprite.anchors) return colors;
  const fur = colors.fur ?? sprite.base.fur;
  if (!fur) return colors;

  const out = { ...colors };
  for (const [role, anchor] of Object.entries(sprite.anchors)) {
    const picked = colors[role];
    if (!picked) continue;
    const lit = relight(picked, lightnessOf(shade(shade(fur, anchor), nudges[role] ?? 1)));
    // Only tint a rolled colourway. Rendering the sprite in its own colours has
    // nothing to tint toward — the source art already has its accents in the
    // right relationship to its fur, and pulling them toward a near-neutral coat
    // would grey out the chimp's tan hands and the gorilla's brown crown.
    out[role] = fur === sprite.base.fur ? lit : tintToward(lit, fur, TINT[role] ?? 0.75);
  }
  return out;
}

/// Resolve a sprite's palette indices to concrete hex per index.
/// This is the step that gives a picked fur colour its matching shadow: the slot
/// carries the tone the original art used, and shade() applies it.
export function resolvePalette(sprite, colors, nudges = {}) {
  const c = anchorAccents(sprite, colors, nudges);
  return sprite.slots.map(([role, tone]) => {
    // `in`, not `??`: a role set to null means "render transparent" (the Clear
    // backdrop), and `??` would fall through to the sprite's own opaque default.
    const base = role in c ? c[role] : (sprite.base[role] ?? '#000000');
    return base === null ? null : shade(base, tone);
  });
}

/// The sprite's own colours, for the "as drawn" rendering.
export function originalColors(sprite) {
  return { ...sprite.base, bg: BACKDROP };
}
