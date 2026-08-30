import { TriangleAlert } from 'lucide-react';
import { explorer } from './cluster.js';
import Countdown from './Countdown.jsx';
import MintedList from './MintedList.jsx';
import Contracts from './Contracts.jsx';
import { LogoLoop, StockLogo, brandFor } from './Logos.jsx';
import { TIERS } from './primates.js';
import Tier, { TIER_STYLE } from './Tier.jsx';
import { WALKS } from './art/frames.js';
import { originalColors } from './art/palette.js';
import { useAnimated, MotionToggle } from './useAnimated.jsx';
import { useCycleSync } from './useCycleSync.jsx';


const LANDING_WALKS = TIERS.map((t) => WALKS[TIER_STYLE[t.id].sprite]);
const LANDING_TIMINGS = LANDING_WALKS.map((w) => w.timing);

const short = (key) => {
  const s = key.toString();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
};

/// Every section is a green shell wrapping its own grey cards.
function Shell({ title, aside, children }) {
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

export default function Landing({
  config, balance, engine, minted, tickers, now, valueMultiple, vaultHoldings, loadHoldings,
}) {
  const [animate, toggleMotion, motionOn] = useAnimated();
  // One clock for all three, so they stride and change colour in step.
  const { frames } = useCycleSync(LANDING_TIMINGS, animate);
  // Default colours, the same ones the mint page shows. The clock is still shared
  // so the three stay in step with each other rather than drifting apart.
  const looks = LANDING_WALKS.map((walk) => ({ colors: originalColors(walk) }));
  const rotationTickers = engine
    ? engine.rotation.map((mint) => tickers[mint.toBase58()]).filter(Boolean)
    : [];
  const totalMinted = config ? config.minted.reduce((a, b) => a + b, 0) : null;
  const totalSupply = config ? config.supply.reduce((a, b) => a + b, 0) : null;

  // The rotation buys in order, so what it bought last is simply the slot before
  // the cursor.
  const nextTicker = engine ? tickers[engine.rotation[engine.cursor].toBase58()] : null;
  const lastSlot = engine
    ? (engine.cursor - 1 + engine.rotation.length) % engine.rotation.length
    : null;
  const lastMint = engine ? engine.rotation[lastSlot] : null;
  const lastTicker = lastMint ? tickers[lastMint.toBase58()] : null;

  return (
    <>
      {/* Pitch and picker are one module: the three things being pitched sit
          directly under the copy that pitches them. */}
      <section className="hero">
        {/* Not tied to the Animations switch: that one governs the primate walk
            cycles, and a frozen row of logos reads as a broken carousel rather
            than a deliberate still. It still stops under prefers-reduced-motion. */}
        <LogoLoop
          tickers={rotationTickers}
          size={88}
          gap={44}
          speed={60}
        />

        <h1>Monkey Business Done On-Chain</h1>

        <p className="lede">
          Select a desk tier, mint the NFT, own the allocation and yield generated.
        </p>


        <p>
          Desks are weighted by tier, and every drop is divided by those weights. A
          Monkey Desk earns 1× the allocation, an Ape Desk 3×, and a Kong Desk 9×.
          Protocol revenue buys tokenised real-world assets on a rotation, and each
          desk&apos;s share lands in a vault only its holder can spend from.
        </p>

        <ol className="steps">
          <li>
            <b>01</b> Creator fees are swept and split — 20% to the protocol, 80% to
            the pot.
          </li>
          <li>
            <b>02</b> Every fifteen minutes the pot buys the next stock in the
            rotation.
          </li>
          <li>
            <b>03</b> What it bought is divided across every desk by weight and
            delivered into the vaults.
          </li>
        </ol>


        <div className="notice">
          <TriangleAlert size={16} strokeWidth={2} aria-hidden />
          <span>
            Note: each desk is tied to a set supply that can be minted, shown below.
            Once all Primates from a given desk are fully minted, that desk will no
            longer be available to purchase.
          </span>
        </div>

        <div className="tiers-head">
          <span>Choose your desk</span>
          <MotionToggle on={motionOn} onToggle={toggleMotion} />
        </div>

        <div className="tiers">
          {TIERS.map((tier) => (
            <Tier
              key={tier.id}
              tier={tier}
              config={config}
              badge={valueMultiple(tier)}
              animate={animate}
              colors={looks[tier.id].colors}
              frame={frames[tier.id]}
            />
          ))}
        </div>

        <a className="cta" href="#/mint">
          Ape in →
        </a>


      </section>

      <Shell>
        <Contracts config={config} balance={balance} bare />

        <div className="live-countdown">
          <span className="live-countdown-label">Next round</span>
          <Countdown engine={engine} now={now} />
        </div>


        <dl className="strip">
          <div>
            <dt>Desks</dt>
            <dd>{totalMinted === null ? '—' : `${totalMinted} / ${totalSupply}`}</dd>
          </div>
          <div>
            <dt>Total weight</dt>
            <dd>{engine ? engine.totalWeight : '—'}</dd>
          </div>
          <div className="lit" style={{ '--brand': brandFor(nextTicker) }}>
            <dt>Buys next</dt>
            <dd>
              {engine ? (
                <>
                  <StockLogo ticker={nextTicker} size={20} />
                  {nextTicker ?? `#${String(engine.cursor).padStart(2, '0')}`}
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>

          {/* Same tile, same colour treatment, but unlit: it is a record rather
              than something about to happen. */}
          <div className="stock-tile" style={{ '--brand': brandFor(lastTicker) }}>
            <dt>Last allocation</dt>
            <dd>
              {engine && lastMint ? (
                <a href={explorer(lastMint)} target="_blank" rel="noreferrer">
                  <StockLogo ticker={lastTicker} size={20} />
                  {lastTicker ?? `#${String(lastSlot).padStart(2, '0')}`}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>

        {engine && (
          <>
            <div className="tiers-head">
              <span>Rotation</span>
              <span>Bought in order</span>
            </div>
            <div className="rotation">
              {engine.rotation.map((mint, slot) => {
                const ticker = tickers[mint.toBase58()];
                return (
                  <span
                    key={mint.toBase58()}
                    className={slot === engine.cursor ? 'next' : slot < engine.cursor ? 'done' : ''}
                    style={{ '--brand': brandFor(ticker) }}
                  >
                    <StockLogo ticker={ticker} size={16} />
                    <span className="slot">{String(slot).padStart(2, '0')}</span>
                    {ticker ?? short(mint)}
                  </span>
                );
              })}
            </div>
          </>
        )}

        <div className="tiers-head">
          <span>Every desk minted</span>
        </div>
        <MintedList
          minted={minted}
          tickers={tickers}
          vaultHoldings={vaultHoldings}
          loadHoldings={loadHoldings}
          animate={animate}
        />
      </Shell>

    </>
  );
}


