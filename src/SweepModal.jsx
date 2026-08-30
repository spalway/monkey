// Pulling a desk's tokens out of its vault and into the wallet that holds it.
//
// The whole dialog is one arithmetic problem shown three ways: a percentage per
// stock, the units that percentage buys, and the sum. All of it runs on the raw
// base-unit strings the chain gave us, never on the display floats — 100% has
// to empty the account exactly, and a float round-trip through 1e6 will not.

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { WALKS } from './art/frames.js';
import { PixelWalk } from './PixelArt.jsx';
import { deskLook } from './DeskList.jsx';
import { StockLogo, brandFor } from './Logos.jsx';

const DECIMALS = 6;
const STEPS = [25, 50, 75, 100];

/// Base units at `pct` of `raw`, as a string. Integer maths throughout, so the
/// 100% case returns the balance itself rather than something 0.000001 short.
const cut = (raw, pct) => ((BigInt(raw) * BigInt(pct)) / 100n).toString();

/// Base units as a display figure. Trailing zeros go, but a whole number keeps
/// none of the decimal point.
function units(raw) {
  const n = Number(raw) / 10 ** DECIMALS;
  return n.toFixed(DECIMALS).replace(/\.?0+$/, '');
}

export default function SweepModal({ desk, tickers, onClose, onSweep, busy }) {
  const held = useMemo(
    () => (desk.holdings ?? []).filter((h) => h.raw && BigInt(h.raw) > 0n),
    [desk.holdings],
  );

  // Percentage chosen per mint. Starts empty: this moves real balances, so the
  // amount should be something the holder picked rather than something they
  // have to notice and undo.
  const [pct, setPct] = useState({});
  const [all, setAll] = useState(false);

  // Escape closes, and the page behind must not scroll while the dialog is up.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, busy]);

  const look = deskLook(desk);

  // "Sweep all" is 100% of everything and overrides the per-stock picks rather
  // than editing them, so unchecking it puts the holder's own choices back.
  const amountFor = (h) => (all ? h.raw : cut(h.raw, pct[h.mint] ?? 0));

  // pendingRaw rides along so the hook knows which stocks need settling into
  // the vault before they can be transferred out of it.
  const picks = held
    .map((h) => ({ mint: h.mint, raw: amountFor(h), pendingRaw: h.pendingRaw ?? '0' }))
    .filter((p) => BigInt(p.raw) > 0n);

  const total = picks.reduce((sum, p) => sum + BigInt(p.raw), 0n).toString();

  return (
    <div className="sweep-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="sweep-panel" role="dialog" aria-modal="true" aria-label={`Sweep ${desk.name}`}>
        <div className="sweep-head">
          <h2>Sweep <span style={{ color: look.metal }}>{desk.name}</span></h2>
          <button className="sweep-close" type="button" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>

        <div className="sweep-art" style={{ '--metal': look.metal }}>
          <PixelWalk walk={WALKS[look.slug]} colors={look.colors} nudges={look.nudges} />
        </div>

        {held.length === 0 ? (
          <div className="note">This vault holds nothing yet.</div>
        ) : (
          <>
            <div className={`sweep-rows ${all ? 'muted' : ''}`}>
              {held.map((h) => {
                const ticker = tickers[h.mint];
                const take = amountFor(h);
                return (
                  <div className="sweep-row" key={h.mint} style={{ '--brand': brandFor(ticker) }}>
                    <span className="sweep-token">
                      <StockLogo ticker={ticker} size={20} />
                      <b>{ticker ?? `${h.mint.slice(0, 4)}…`}</b>
                      <span className="sweep-qty">{units(h.raw)}</span>
                      {BigInt(h.pendingRaw ?? 0) > 0n && (
                        <span className="sweep-pending" title="Credited by a round, not yet delivered. Sweeping delivers it.">
                          {units(h.pendingRaw)} pending
                        </span>
                      )}
                    </span>

                    <span className="sweep-steps">
                      {STEPS.map((step) => (
                        <button
                          key={step}
                          type="button"
                          className={!all && pct[h.mint] === step ? 'on' : ''}
                          disabled={all || busy}
                          onClick={() =>
                            setPct((p) => ({ ...p, [h.mint]: p[h.mint] === step ? 0 : step }))
                          }
                        >
                          {step}%
                        </button>
                      ))}
                    </span>

                    {/* Always rendered, even at zero: the column should not
                        jump about as percentages are picked. */}
                    <span className={`sweep-take ${BigInt(take) > 0n ? 'live' : ''}`}>
                      +{units(take)}
                    </span>
                  </div>
                );
              })}
            </div>

            <label className="sweep-all">
              <input
                type="checkbox"
                checked={all}
                disabled={busy}
                onChange={(e) => setAll(e.target.checked)}
              />
              <span>Sweep all tokens</span>
              {all && <span className="sweep-all-total">({units(total)})</span>}
            </label>

            <button
              className="sweep-go"
              type="button"
              disabled={!picks.length || busy}
              onClick={() => onSweep(desk, picks)}
            >
              {busy
                ? 'Sweeping…'
                : `Sweep ${picks.length} ${picks.length === 1 ? 'token' : 'tokens'}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
