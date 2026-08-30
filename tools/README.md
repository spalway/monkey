# art pipeline

Regenerating the sprite data from `images/*.png`:

    node tools/extract.cjs ape kong monkey   # PNG -> art/*.json (grid + palette)
    node tools/mkspr.cjs                     # art/*.json -> src/art/sprites.js

Checks:

    node tools/verify.cjs ape kong monkey    # traced grid vs the source pixels
    node tools/checkdefault.mjs              # regenerated palette vs source palette
    node tools/samples.mjs                   # samples/*-sheet.png
    node tools/rampdemo.mjs                  # samples/ramps.png

Where the shading constants came from: `tools/sweep2.mjs` (shadows are a plain
lightness multiply at constant hue and chroma) and `tools/lighten.mjs`
(highlights fit equally well as a blend towards white, and unlike a multiply
they do not clip on pale fur). `tools/fitslots.mjs` and `tools/where.cjs` were
used to assign each palette index to a role.

## Accent anchoring

Accent roles (the gorilla's crown and face plate, the chimp's skin, the monkey's
limbs and mask) are not absolute colours. In the source art each sits at a fixed
lightness *relative to the fur* — the gorilla's face plate is only 8% darker than
its body — so `mkspr.cjs` measures that relationship into `anchors` and
`palette.js` reapplies it at render time. A trait pool entry contributes hue and
chroma; its optional 4th field nudges lightness around the anchor.

Without this the face reads as a hole on bright fur: the body races away while a
hardcoded accent stays put. `node tools/anchors.mjs` prints the measured ratios.

### Why the face anchors stay per-species

The gorilla's muzzle plate and the monkey's mask are both the `face` role but
draw from separate pools (`FACE_PLATE`, `MASK`) and sit at very different
anchors — fur x 0.924 versus fur lightened 79% to white. `node tools/facealt.mjs`
shows why that is not worth unifying: giving the gorilla the monkey's pale anchor
flattens its brow and muzzle into a white blob.

### Backdrop

Every primate sits on the same flat `BACKDROP` (`#222222`, in `palette.js`), so
the collection reads as one set. Not a rolled trait, not derived from the fur.

`node tools/contrast.mjs` audits every fur colourway against it. The pool used to
carry greys and near-blacks whose darkest tone landed on the backdrop and vanished
(Soot at a gap of 0.001, Void at 0.004); the vibrant pool below clears it by a
wide margin — worst is now Cobalt at 0.151.

### Fur, and tinting the accents

`FUR` holds only vibrant mid-range colours: chroma at or above 0.095, OKLCH
lightness between 0.48 and 0.84. Greys and near-blacks read as "no colour was
picked" rather than as a colourway, and the upper bound keeps Kong's silverback
saddle from compressing (above about 0.87 there is no headroom above the base).

Accents — face, crown, hands, tail — are then **tinted into the rolled fur**
(`TINT` in `palette.js`, via `tintToward`). Anchoring alone only matched their
*lightness* to the fur, so the coat was the only thing that changed colour and the
animal read as two unrelated halves: the chimp kept grey limbs and the ape kept
tan hands whatever the fur became. That is most of why the shading looked flat —
the ape shows only two fur tones of its own, so without tinted accents there is
barely a gradient to see. Chroma lands short of the fur's own so skin stays softer
than the coat.

Tinting applies **only to a rolled colourway**. Rendering a sprite in its own
colours has nothing to tint toward, and pulling its accents at a near-neutral coat
would grey out the very warmth the source art has. `node tools/checkdefault.mjs`
confirms the as-drawn render still matches the source.

## Walk cycles

    node tools/extract-frames.cjs   # images/*/frame*.png -> art/*-frames.json
    node tools/mkframes.cjs         # -> src/art/frames.js
    node tools/framestrip.cjs monkey ape kong   # alignment overlay
    node tools/walkstrip.mjs        # recoloured cycles, samples/walk-cycles.png

Kong has four frames, the monkey and ape three. Frames are traced against their
species' static palette rather than re-quantised, so a colour cannot land on a
different index between frames.

**Cell size is a constant, not a measurement.** Every image here comes out of the
same pipeline at 8.643 source pixels per logical pixel (`node tools/cellsize.cjs
<file>` fits it). Measuring per frame lands anywhere in 8.57–8.70, and over
seventy rows that is enough to change the row count by one and throw a frame off
the grid. `extract-frames.cjs` warns if a content box is not close to a whole
number of cells.

**Registration.** Vertically the frames align on the ground — the feet stay put
while the body rises and falls, which is why the ape's frame 3 sits two rows
lower than the others (it is mid-stride, and `node tools/vertcheck.cjs` shows
head-aligning it instead leaves it hovering). Horizontally they align on a head
marker: Kong's brown head patch, the ape's face skin restricted to the upper body
so the swinging hands do not count, the monkey's pale mask. Aligning on maximum
silhouette overlap instead lets the limbs drag the body sideways, and the animal
slides rather than walks. `framestrip.cjs` renders the overlay that shows this:
body solid grey, only the limbs red/cyan.

**Colour.** Cells are decided by a majority vote of their pixels, not by
averaging: averaging a cell that straddles the muzzle and the fur lands on the
grey between them, which turned Kong's mouth grey. Kong's frames are also a
profile view carrying one muzzle tone the front-facing static pose never shows,
declared in its `extra` — without it that tone's two nearest matches are both
fur, so the mouth recoloured as fur. The tool warns about any other bulk colour
the palette covers poorly, so a new frame set says so rather than silently
snapping to a neighbour. `node tools/headcheck.mjs` renders the mouth across
colourways.

Per-frame hold times live in `mkframes.cjs` (`TIMING`), per species. The player
chains timeouts rather than using one interval, so the quick passing poses and the
held contact poses can differ.

**All three cycles total 900ms** even though Kong has four frames and the others
three. The landing page stands them side by side and recolours them together on
each cycle boundary; with unequal cycles there is no shared boundary to switch on.

## Landing parade

The landing page shows all three walking, **each in its own colourway**, all three
advancing together on the cycle boundary. `PARADE` in `colorways.js` holds eight,
ordered so each step jumps about 225 degrees around the hue wheel — past opposite.
That spacing is what keeps three consecutive entries looking like three different
colours rather than three shades of one. Entries are FUR *names*, resolved from
the pool itself, so the parade can only show colours the generator can roll and
editing a fur value cannot leave a stale one here. `node tools/parade.mjs` renders
every cycle.

`useCycleSync` derives every sprite's frame *and* the colour index from one
elapsed clock. Three independent timers drift apart within seconds, and side by
side that reads as one primate changing late. Motion also pauses while the tab is
hidden, and the toggle defaults to the visitor's `prefers-reduced-motion` setting.

**The static sprites are not walk frames.** Each is a distinct pose — 60% identical
to Kong's frames, 65–68% to the ape's, 75–78% to the monkey's. They remain the
default/on-chain art while the frames animate only on the site.

## Tile padding

`toSVG(..., { pad })` adds margin by growing the viewBox, never by scaling the
art — the grid is untouched and every cell stays one unit, so nothing is
resampled and no detail is lost. `TILE_PAD` in `render.js` is the shared value.
The backdrop is painted as one rect across the padded canvas rather than per
cell, which fills the margin and drops a few hundred rects (Kong: 40.5KB -> 29.5KB).
`node tools/padcheck.mjs` renders the comparison.
