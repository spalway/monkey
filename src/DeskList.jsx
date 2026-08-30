// The holder's desks. Shared by the mint page and the vaults page so the two
// cannot drift apart, and sorted and paged by the same controls as the home
// page's minted list — they are lists of the same objects.

import { useState } from 'react';
import { explorer } from './cluster.js';
import { ExternalLink, Tag, Wallet } from 'lucide-react';
import * as sprites from './art/sprites.js';
import { WALKS } from './art/frames.js';
import { generate, seedFromBytes } from './art/palette.js';
import { serialOf } from './primates.js';
import { TIER_STYLE } from './Tier.jsx';
import { PixelArt, PixelWalk } from './PixelArt.jsx';
import { StockLogo, brandFor } from './Logos.jsx';
import { useSortedPage, Sorts, Pager } from './ListControls.jsx';
import SweepModal from './SweepModal.jsx';

/// Magic Eden's item page for a Core asset. The desk carries its vault with it,
/// so listing one is listing whatever it holds.
const magicEden = (asset) => `https://magiceden.io/item-details/solana/${asset}`;

const SPRITE_FOR = { 0: 'monkey', 1: 'ape', 2: 'kong' };

/// A desk's own look, rolled from its asset address.
///
/// Deterministic and recomputable by anyone holding the address, so every minted
/// desk already looks like itself without the program storing a seed or the site
/// keeping a table.
///
/// The art is rendered on a transparent backdrop so it sits directly on the well
/// behind it. Leaving the sprite's #222222 tile in place would draw a second,
/// slightly-off rectangle inside the frame.
export function deskLook(desk) {
  const id = desk.tier?.id ?? 0;
  const slug = SPRITE_FOR[id];
  const roll = generate(sprites[slug], seedFromBytes(desk.address.toBytes()));
  return {
    slug,
    colors: { ...roll.colors, bg: null },
    nudges: roll.nudges,
    metal: TIER_STYLE[id].metal,
  };
}

const short = (key) => {
  const s = key.toString();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
};

export function Shell({ title, aside, children }) {
  return (
    <section>
      <div className="shell">
        {title && (
          <div className="label">
            <span>{title}</span>
            {aside && <span>{aside}</span>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/// What a desk holds, as one bar rather than a divider rule.
///
/// Segments are sized by share of the vault, so two roughly equal holdings read
/// as roughly half each without anyone having to compare two numbers. Colour is
/// the stock's own, and the exact figure is on hover — the bar answers "what is
/// in here" at a glance and "how much" on demand.
export function AllocationBar({ holdings, tickers }) {
  const held = (holdings ?? []).filter((h) => h.amount > 0);
  const total = held.reduce((sum, h) => sum + h.amount, 0);

  // An empty vault gets the bar too, greyed: a desk that holds nothing should
  // look like a desk that holds nothing, not like a desk with no bar.
  if (!total) {
    return (
      <div className="alloc empty" role="img" aria-label="No tokens held">
        <div className="alloc-seg" style={{ width: '100%' }}>
          <span className="alloc-tip">0 tokens currently owned</span>
        </div>
      </div>
    );
  }

  return (
    <div className="alloc" role="img" aria-label="Vault allocation by stock">
      {held.map((h) => {
        const ticker = tickers[h.mint];
        const share = (h.amount / total) * 100;
        return (
          <div
            key={h.mint}
            className="alloc-seg"
            style={{ '--brand': brandFor(ticker), width: `${share}%` }}
            tabIndex={0}
          >
            <span className="alloc-tip">
              <StockLogo ticker={ticker} size={16} />
              <span className="alloc-tip-ticker">{ticker ?? short(h.mint)}</span>
              <b>{h.amount.toFixed(2)}</b>
              <span className="alloc-tip-share">{share.toFixed(0)}%</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function DeskList({
  desks, engine, tickers, empty, animate = false, onSweep, busy,
}) {
  // fetchDesks sorts by name and carries no serial; the shared sorts need one.
  const withSerial = desks.map((d) => (d.serial === undefined ? { ...d, serial: serialOf(d.name) } : d));
  const { rows, sort, choose, page, pages, setPage } = useSortedPage(withSerial);

  // Which desk's sweep dialog is open, by address. Held here rather than per
  // card so paging away closes it, and read back out of `desks` each render so
  // the dialog sees balances a completed sweep has already updated.
  const [sweeping, setSweeping] = useState(null);
  const open = sweeping ? desks.find((d) => d.address.toBase58() === sweeping) : null;

  if (desks.length === 0) return <div className="note">{empty}</div>;

  return (
    <>
      <Sorts sort={sort} choose={choose} count={desks.length} noun="held" />

      {rows.map((desk) => {
        const look = deskLook(desk);
        // Only balances that are actually there: a fully swept vault still owns
        // the token account, it is just empty.
        const held = desk.holdings?.filter((h) => h.amount > 0).length ?? 0;
        const blocked = busy !== null || held === 0;
        return (
          <div
            className="desk"
            key={desk.address.toBase58()}
            style={{ '--metal': look.metal, '--fur': look.colors.fur }}
          >
            <div className="desk-head">
              <div className="desk-title">
                <h3>{desk.name}</h3>
                {desk.weight ? (
                  <span className="weight">{desk.weight}× allocation</span>
                ) : (
                  <span className="chip">not registered</span>
                )}
              </div>

              {/* The two addresses were 44 characters of base58 each, which was
                  most of the card. They are the same two links either way. */}
              <div className="desk-links">
                <a className="linkbtn" href={explorer(desk.address)} target="_blank" rel="noreferrer">
                  Asset <ExternalLink size={11} strokeWidth={2} aria-hidden />
                </a>
                <a className="linkbtn" href={explorer(desk.vault)} target="_blank" rel="noreferrer">
                  Vault <ExternalLink size={11} strokeWidth={2} aria-hidden />
                </a>
              </div>
            </div>

            <div className="desk-well">
              {animate ? (
                <PixelWalk
                  walk={WALKS[look.slug]}
                  colors={look.colors}
                  nudges={look.nudges}
                  className="desk-art"
                />
              ) : (
                <PixelArt
                  sprite={sprites[look.slug]}
                  colors={look.colors}
                  nudges={look.nudges}
                  className="desk-art"
                />
              )}
            </div>

            {/* Both ways of realising what a desk is worth, side by side: take
                the tokens out, or sell the desk with them still in it. Above the
                allocation bar, so the bar stays the last thing in the card and
                reads as a summary of it rather than as a divider between rows. */}
            {onSweep && (
              <div className="desk-actions">
                {/* Answers the greyed-out button before anyone has to hover it,
                    and fills the space the buttons left when they moved right. */}
                <span className="held-count">
                  {held === 0 ? 'No tokens held' : `${held} token${held === 1 ? '' : 's'} held`}
                </span>

                <button
                  type="button"
                  className="act sweep"
                  // aria-disabled rather than disabled: a disabled button fires no
                  // mouse events, so the tooltip saying why it cannot be pressed
                  // would never appear. The click is guarded instead.
                  aria-disabled={blocked}
                  data-tip={held === 0 ? 'No tokens held to sweep' : undefined}
                  onClick={() => {
                    if (!blocked) setSweeping(desk.address.toBase58());
                  }}
                >
                  <Wallet size={11} strokeWidth={2} aria-hidden />
                  Sweep
                </button>

                <a
                  className="act sell"
                  href={magicEden(desk.address.toBase58())}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Tag size={11} strokeWidth={2} aria-hidden />
                  Sell on Magic Eden
                  <span className="fee">5%</span>
                </a>
              </div>
            )}

            {/* A holding wears its own company's colour, not the desk's animal —
                the chip is about which stock it is. Mark, ticker and amount all
                take the same colour so the chip reads as one object. */}
            <AllocationBar holdings={desk.holdings} tickers={tickers} />

            {(desk.holdings?.length > 0 || desk.owed?.some((a) => a > 0)) && (
              <div className="holdings">
                {desk.holdings?.map((holding) => {
                  const ticker = tickers[holding.mint];
                  return (
                    <span key={holding.mint} style={{ '--brand': brandFor(ticker) }}>
                      <StockLogo ticker={ticker} size={15} />
                      {ticker ?? short(holding.mint)} <b>{holding.amount.toFixed(2)}</b>
                    </span>
                  );
                })}
                {desk.owed?.map((amount, slot) => {
                  if (amount <= 0) return null;
                  const ticker = tickers[engine.rotation[slot].toBase58()];
                  return (
                    <span
                      key={`owed-${slot}`}
                      className="pending"
                      style={{ '--brand': brandFor(ticker) }}
                    >
                      <StockLogo ticker={ticker} size={15} />
                      {ticker ?? String(slot).padStart(2, '0')} <b>{amount.toFixed(2)}</b> pending
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <Pager page={page} pages={pages} setPage={setPage} />

      {open && (
        <SweepModal
          desk={open}
          tickers={tickers}
          busy={busy === 'sweep'}
          onClose={() => setSweeping(null)}
          onSweep={async (d, picks) => {
            await onSweep(d, picks);
            setSweeping(null);
          }}
        />
      )}
    </>
  );
}




