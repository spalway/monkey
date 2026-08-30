// A tier tile: the generated sprite, its metal, and its banana rating.

import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as sprites from './art/sprites.js';
import { WALKS } from './art/frames.js';
import { toSVG, TILE_PAD } from './art/render.js';
import { originalColors } from './art/palette.js';
import { PixelArt, PixelWalk } from './PixelArt.jsx';

/// Per tier: which sprite, which metal, and how many bananas.
///
/// Bananas are the allocation weight read at a glance — one, two, three — rather
/// than the raw 1/3/9, which does not fit a card.
/// `art` is the rendered height in px.
///
/// All three used to draw at a flat 100px, which made a 50x54 monkey occupy the
/// same space as a 64x70 kong — so the tier ladder read as three equal animals
/// rather than as a hierarchy. Sizing them apart is the point: the card should
/// say which tier it is before you read the weight.
export const TIER_STYLE = {
  0: { sprite: 'monkey', metal: 'var(--bronze)', bananas: 1, art: 64 },
  1: { sprite: 'ape', metal: 'var(--silver)', bananas: 2, art: 86 },
  2: { sprite: 'kong', metal: 'var(--gold)', bananas: 3, art: 112 },
};

/// The still pose, rendered once at module load rather than per paint. Each
/// sprite is a few hundred merged rects; re-running that every render is wasted
/// work. This is also what shows when motion is off — the primate facing the
/// viewer rather than mid-stride.
const STILL = Object.fromEntries(
  Object.entries(TIER_STYLE).map(([id, { sprite }]) => [
    id,
    toSVG(sprites[sprite], originalColors(sprites[sprite]), { pad: TILE_PAD }),
  ]),
);

/// Default colours for each walk cycle, for cards showing no particular token.
const WALK_STILL = Object.fromEntries(
  Object.entries(TIER_STYLE).map(([id, { sprite }]) => [id, originalColors(WALKS[sprite])]),
);

export default function Tier({
  tier, config, badge, animate = false, colors, nudges, frame, selected = false, onSelect,
}) {
  const style = TIER_STYLE[tier.id];
  const price = config ? config.prices[tier.id] / LAMPORTS_PER_SOL : null;
  const minted = config?.minted[tier.id] ?? 0;
  const supply = config?.supply[tier.id] ?? 0;
  const soldOut = config && minted >= supply;

  return (
    <article
      className={[
        'tier',
        tier.slug === 'kong' ? 'kong' : '',
        onSelect ? 'selectable' : '',
        selected ? 'selected' : '',
        soldOut ? 'sold-out' : '',
      ].filter(Boolean).join(' ')}
      style={{ '--metal': style.metal, '--art-h': `${style.art}px` }}
      {...(onSelect && !soldOut
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-pressed': selected,
            onClick: () => onSelect(tier),
            onKeyDown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(tier); }
            },
          }
        : {})}
    >
      {badge && <span className="badge">{badge}</span>}

      {animate ? (
        <PixelWalk
          walk={WALKS[TIER_STYLE[tier.id].sprite]}
          colors={colors ?? WALK_STILL[tier.id]}
          nudges={nudges}
          frame={frame}
        />
      ) : colors ? (
        // Motion off but a colourway was handed down: keep the colour, drop the
        // movement, rather than snapping back to the default palette.
        <PixelArt sprite={sprites[TIER_STYLE[tier.id].sprite]} colors={colors} nudges={nudges} />
      ) : (
        <figure dangerouslySetInnerHTML={{ __html: STILL[tier.id] }} />
      )}

      {/* Paired rows rather than five stacked lines: the name earns its bananas
          and the price earns its weight, so each fact sits beside the thing it
          qualifies instead of below it. */}
      <div className="body">
        <div className="tier-row">
          <h3>{tier.name} Desk</h3>
          <div className="bananas" title={`${tier.weight}x allocation weight`}>
            {Array.from({ length: style.bananas }, (_, i) => (
              <img key={i} className="banana-pip" src="/website_logo.png" alt="" aria-hidden />
            ))}
          </div>
        </div>

        <div className="tier-row">
          <div className="price">{price === null ? '—' : `${price} SOL`}</div>
          <div className="weight">{tier.weight}× allocation</div>
        </div>

        <div className="supply">
          {config ? `${minted} / ${supply} minted` : 'loading'}
        </div>
      </div>
    </article>
  );
}

