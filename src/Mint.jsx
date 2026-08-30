import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TIERS } from './primates.js';
import Tier from './Tier.jsx';
import DeskList, { Shell } from './DeskList.jsx';
import MintSuccess from './MintSuccess.jsx';
import { useAnimated, MotionToggle } from './useAnimated.jsx';

export default function Mint({
  wallet,
  config,
  engine,
  desks,
  tickers,
  busy,
  log,
  error,
  mint,
  sweep,
  justMinted,
  clearMinted,
  valueMultiple,
}) {
  const [animate, toggleMotion, motionOn] = useAnimated();
  const [chosen, setChosen] = useState(null);

  // One button for all three tiers. What it says and whether it is live are both
  // derived from the same three facts, so the label can never disagree with
  // whether the click will work.
  const picked = chosen === null ? null : TIERS[chosen];
  const price = picked && config ? config.prices[picked.id] / LAMPORTS_PER_SOL : null;
  const soldOut = picked && config && config.minted[picked.id] >= config.supply[picked.id];
  // `busy` is a tier id while minting and the string 'sweep' while sweeping;
  // only the former should turn this button into "Minting…".
  const minting = typeof busy === 'number';
  const ready = Boolean(wallet && config && picked && !soldOut && busy === null);
  const label = minting ? 'Minting…'
    : !wallet ? 'Connecting wallet…'
    : !picked ? 'Select a desk'
    : soldOut ? `${picked.name} Desk sold out`
    : `Mint 1 ${picked.name} Desk for ${price} SOL`;

  return (
    <>
      {justMinted && (
        <MintSuccess
          minted={justMinted}
          config={config}
          engine={engine}
          onClose={clearMinted}
        />
      )}

      {/* Same merged module as the landing: the pitch and the three options. */}
      <section className="hero">
        <h1>Mint a desk.</h1>

        <p className="lede">
          Every desk owns a vault only its holder can spend from.
        </p>

        <p>
          Sell the desk and the vault goes with it, with whatever is in it. Desks are
          weighted by tier: a Monkey Desk earns 1× the allocation, an Ape Desk 3×, and
          a Kong Desk 9×.
        </p>

        <div className="notice">
          <TriangleAlert size={16} strokeWidth={2} aria-hidden />
          <span>
            Note: each desk is tied to a set supply that can be minted, shown below.
            Once all Primates from a given desk are fully minted, that desk will no
            longer be available to purchase.
          </span>
        </div>

        {error && <div className="note error">{error}</div>}

        <div className="tiers-head">
          <span>Choose your desk</span>
        </div>

        <div className="tiers">
          {TIERS.map((tier) => (
            <Tier
              key={tier.id}
              tier={tier}
              config={config}
              badge={valueMultiple(tier)}
              selected={chosen === tier.id}
              // Clicking the chosen desk again clears it, so there is a way back
              // to having picked nothing.
              onSelect={() => setChosen((c) => (c === tier.id ? null : tier.id))}
              // Only the chosen desk moves: three sprites walking at once pulls
              // the eye away from the choice being made.
              animate={chosen === tier.id}
            />
          ))}
        </div>

        <button
          className={`mint-cta ${ready ? 'ready' : ''}`}
          onClick={() => ready && mint(picked)}
          disabled={!ready}
        >
          {label}
        </button>
      </section>

      <Shell
        title="Your desks"
        aside={<MotionToggle on={motionOn} onToggle={toggleMotion} />}
      >
        <DeskList
          desks={desks}
          engine={engine}
          tickers={tickers}
          animate={animate}
          onSweep={sweep}
          busy={busy}
          empty="No desks yet. Mint one above."
        />
      </Shell>

      {log.length > 0 && (
        <Shell title="Log">
          <div className="log">{log.join('\n')}</div>
        </Shell>
      )}
    </>
  );
}
