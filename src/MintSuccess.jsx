// What a holder sees the moment a mint confirms.
//
// The two addresses are the point of the dialog. A desk and its vault are the
// only things a holder ever needs, they are unguessable, and this is the one
// moment they are guaranteed to be looking — so both are copyable and both link
// out to the chain rather than being described.

import { useEffect, useMemo, useRef, useState } from 'react';
import { explorer } from './cluster.js';
import { Check, Copy, X } from 'lucide-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WALKS } from './art/frames.js';
import { PixelWalk } from './PixelArt.jsx';
import { deskLook } from './DeskList.jsx';


const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/// Ordinary party colours. Deliberately not the desk's own palette: tinting the
/// paper to match the primate made a rolled-green monkey rain green paper, which
/// read as part of the artwork rather than as celebration.
const CONFETTI = [
  '#ff3b52', '#ffb020', '#ffe14d', '#3fcf6a',
  '#2f9bff', '#a45cff', '#ff5fae', '#ffffff',
];

/// Falling paper over the whole viewport.
///
/// Canvas rather than a few hundred DOM nodes: this runs for six seconds at
/// 60fps over a page that is also animating three sprites, and that many
/// elements being laid out every frame is what makes confetti stutter.
function Confetti() {
  const ref = useRef(null);

  // No dependencies, so it runs once on mount and no parent render can restart
  // it. Not a micro optimisation: `useChain` ticks a clock every second, which
  // re-renders this dialog, and while anything derived was in the dependency
  // array the whole animation was torn down and reseeded once a second — every
  // piece was still above the top edge when it got destroyed, so nothing was
  // ever visible.
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || reducedMotion()) return undefined;
    const palette = CONFETTI;

    const ctx = canvas.getContext('2d');
    // Capped at 2: past that the pixel count costs more than the sharpness is
    // worth for shapes this small.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Staggered above the top edge rather than all released at once, so it
    // falls as a shower instead of a curtain.
    const bits = Array.from({ length: 150 }, () => ({
      x: Math.random() * window.innerWidth,
      y: -20 - Math.random() * window.innerHeight,
      w: 5 + Math.random() * 6,
      h: 8 + Math.random() * 7,
      vx: -1 + Math.random() * 2,
      vy: 2.2 + Math.random() * 3,
      rot: Math.random() * Math.PI,
      vr: -0.12 + Math.random() * 0.24,
      color: palette[Math.floor(Math.random() * palette.length)],
    }));

    let raf = 0;
    let stopped = false;
    const start = performance.now();

    const frame = (t) => {
      const age = t - start;
      const fade = age > 4600 ? Math.max(0, 1 - (age - 4600) / 1400) : 1;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      let live = 0;
      for (const b of bits) {
        b.x += b.vx;
        b.y += b.vy;
        b.vy += 0.03;
        b.rot += b.vr;
        if (b.y < window.innerHeight + 40) live++;

        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillStyle = b.color;
        // Scaled on one axis by the rotation so each piece reads as a flat
        // rectangle tumbling in three dimensions rather than a spinning square.
        ctx.scale(1, Math.cos(b.rot * 1.6));
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.restore();
      }

      if (!stopped && live > 0 && fade > 0) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas className="confetti" ref={ref} aria-hidden />;
}

/// An address: readable, linked to the chain, and copyable in one click.
function CopyLine({ value, label }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <div className="copyline">
      <a href={explorer(value)} target="_blank" rel="noreferrer">
        {value}
      </a>
      <button
        type="button"
        className="copyline-btn"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            // Clipboard blocked (insecure origin, or denied): the address is
            // still selectable, so say nothing rather than throwing a dialog.
          }
        }}
      >
        {copied ? <Check size={12} strokeWidth={2.4} /> : <Copy size={12} strokeWidth={2.2} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export default function MintSuccess({ minted, config, engine, onClose }) {
  const { asset, vault, tier, name } = minted;
  // Memoised for the same reason: a palette roll plus a full sprite render on
  // every clock tick is real work, and a fresh object each render would defeat
  // the frame cache inside PixelWalk.
  const look = useMemo(() => deskLook({ address: asset, tier }), [asset, tier]);

  const price = config ? config.prices[tier.id] / LAMPORTS_PER_SOL : null;
  // Read off the engine rather than written down: the cadence is on-chain and
  // settable, and this dialog should not be a second place that disagrees.
  const everyMinutes = engine ? Math.round(engine.minInterval / 60) : null;

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const tweet = [
    `Just minted ${name}${price === null ? '' : ` for ${price} SOL`} at primates.app.`,
    '',
    explorer(asset),
    '',
    'Monkey Business, On-chain  @primatespl',
  ].join('\n');

  return (
    <div
      className="win-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <Confetti />

      <div className="win" role="dialog" aria-modal="true" aria-label={`Minted ${name}`}>
        <button className="win-close" type="button" onClick={onClose} aria-label="Close">
          <X size={15} strokeWidth={2.2} />
        </button>

        <h2>Congratulations!</h2>
        <p className="win-sub">
          You are now the owner of <b style={{ color: look.metal }}>{name}</b>
        </p>

        <div className="win-art" style={{ '--metal': look.metal }}>
          <PixelWalk
            walk={WALKS[look.slug]}
            colors={look.colors}
            nudges={look.nudges}
            playing={!reducedMotion()}
          />
        </div>

        <p className="win-line">Your asset is verifiable on-chain at:</p>
        <CopyLine value={asset.toBase58()} label="asset address" />

        <p className="win-line">
          As you hold it, every {everyMinutes ?? 15} minutes it receives a{' '}
          <b style={{ color: look.metal }}>{tier.weight}×</b> allocation of the
          xStocks the protocol buys, sent to the vault made for this desk alone.
          As it accumulates, you can sweep those tokens into your wallet at any
          time — or sell the desk with them still inside.
        </p>
        <CopyLine value={vault.toBase58()} label="vault address" />

        <div className="win-actions">
          <a
            className="win-btn share"
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(tweet)}`}
            target="_blank"
            rel="noreferrer"
          >
            Share on X
          </a>
          <button className="win-btn done" type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
