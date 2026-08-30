// Rendering a primate into the page: one static, one walking.

import { useEffect, useMemo, useState } from 'react';
import { toSVG, TILE_PAD } from './art/render.js';
import { frameSprite } from './art/frames.js';

/// A single sprite at one set of rolled colours.
export function PixelArt({ sprite, colors, nudges, className }) {
  const svg = useMemo(
    () => toSVG(sprite, colors, { nudges, pad: TILE_PAD }),
    [sprite, colors, nudges],
  );
  return <figure className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/// A walk cycle.
///
/// Every frame is rendered once per colour set and then held: recolouring is the
/// expensive half and it does not change between frames, so re-running it on each
/// tick would burn work to produce identical output.
///
/// Frames advance on their own hold time via a chained timeout rather than one
/// interval — the passing poses are meant to read quicker than the contact poses,
/// which a fixed interval cannot express.
export function PixelWalk({ walk, colors, nudges, playing = true, frame, className }) {
  const [i, setI] = useState(0);
  const svgs = useMemo(
    () => walk.frames.map((_, n) => toSVG(frameSprite(walk, n), colors, { nudges, pad: TILE_PAD })),
    [walk, colors, nudges],
  );

  const controlled = frame !== undefined;
  useEffect(() => {
    if (controlled || !playing) return undefined;
    const id = setTimeout(
      () => setI((n) => (n + 1) % walk.frames.length),
      walk.timing[i],
    );
    return () => clearTimeout(id);
  }, [i, playing, controlled, walk]);

  const shown = controlled ? frame % walk.frames.length : i;
  return <figure className={className} dangerouslySetInnerHTML={{ __html: svgs[shown] }} />;
}
