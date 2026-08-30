// Trait pools. Every entry is [name, hex, weight] or [name, hex, weight, nudge];
// weight is relative, so rarity is just "this one's share of the total". Names
// are the trait values that end up in the NFT metadata, so they need to read well
// on a marketplace.
//
// For accent roles only the hue and chroma of `hex` are used: the lightness comes
// from the fur via the sprite's anchor (see palette.js), and `nudge` is an extra
// tone on top so a pool can still have a darker and a lighter member. Fur, eye
// and backdrop entries are used as-is.

/// Fur is the headline trait and drives every fur tone on the sprite.
///
/// Every entry is deliberately vibrant and mid-range: chroma at or above 0.095
/// and OKLCH lightness between 0.48 and 0.84. The earlier pool carried greys and
/// near-blacks (Umber, Slate, Ash, Soot, Void) which read as "no colour was
/// picked" rather than as a colourway, and the darkest of them disappeared
/// against the #222222 backdrop entirely. The upper bound also keeps Kong's
/// silverback saddle from compressing — above about 0.87 there is no headroom
/// left above the base for it.
export const FUR = [
  // common
  ['Ember',    '#d4471f', 100],
  ['Rust',     '#c26a12',  95],
  ['Crimson',  '#e0304f',  90],
  ['Bullion',  '#e0b02a',  85],
  ['Fern',     '#4fb02f',  80],
  ['Azure',    '#2a8fe0',  80],
  // uncommon
  ['Coral',    '#f0704a',  55],
  ['Jade',     '#17a888',  55],
  ['Cobalt',   '#3a5fe0',  50],
  ['Amethyst', '#9a4fe0',  45],
  ['Toxic',    '#9ad12b',  40],
  ['Lagoon',   '#14b0c4',  40],
  // rare
  ['Fuchsia',  '#e03a95',  25],
  ['Indigo',   '#6a4fe0',  22],
  ['Orchid',   '#c74fd6',  18],
  ['Mint',     '#3fd6a0',  15],
  ['Glacier',  '#5cbfe8',  12],
];

/// Bare skin on the chimp: face, hands, feet.
export const SKIN = [
  ['Tan',      '#f2c08e', 100],
  ['Umber',    '#c08d5e',  70, 0.88],
  ['Rose',     '#f0a9a0',  40],
  ['Ash',      '#b8b2a8',  30],
  ['Slate',    '#8a8f96',  18, 0.94],
  ['Violet',   '#b98fd6',   8, 0.96],
];

/// The gorilla's brown head patch.
export const CROWN = [
  ['Bark',     '#493b29', 100],
  ['Char',     '#2e2a27',  70, 0.8],
  ['Copper',   '#7a4420',  45],
  ['Bone',     '#9b917f',  25, -0.32],
  ['Wine',     '#5a2333',  12, 0.9],
  ['Verdigris','#2f5a52',   8, 0.95],
];

/// The gorilla's face plate.
export const FACE_PLATE = [
  ['Stone',    '#554e47', 100],
  ['Coal',     '#33302e',  70, 0.84],
  ['Clay',     '#6d5346',  40],
  ['Pewter',   '#6b6f76',  25, -0.14],
  ['Plum',     '#4a3550',  10, 0.91],
];

/// The monkey's pale face mask.
export const MASK = [
  ['Bone',     '#dedfdc', 100],
  ['Cream',    '#efe3c4',  60],
  ['Ash',      '#a8a5a0',  35, 0.87],
  ['Blush',    '#e8c2c2',  22],
  ['Mint',     '#c2e0d4',  10, 0.97],
];

/// The monkey's darker limbs and tail.
export const LIMB = [
  ['Graphite', '#524d4a', 100],
  ['Coal',     '#2f2c2a',  60, 0.79],
  ['Walnut',   '#6b4a34',  40],
  ['Steel',    '#5b6673',  25, -0.07],
  ['Indigo',   '#3d3a63',  10, 0.88],
];

/// Eyes stay near-white almost always; a coloured pair is a real find.
export const EYE = [
  ['Ivory',    '#fffefb', 100],
  ['Amber',    '#ffc95e',   7],
  ['Crimson',  '#ff4d4d',   4],
  ['Cyan',     '#5ff0ff',   3],
];

// There is no backdrop pool: every primate sits on the same flat BACKDROP
// (palette.js), so the collection reads as one set.

