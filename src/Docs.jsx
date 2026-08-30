// The long-form documentation, laid out as chapters against a fixed rail.
//
// Every figure that exists on-chain is read from `config` and `engine` rather
// than typed in, so the page cannot drift from the program the way a
// hand-maintained numbers table always eventually does. Figures that came from
// measurement rather than from state are marked as measured where they appear.

import { useEffect, useState } from 'react';
import { explorer } from './cluster.js';
import { TriangleAlert } from 'lucide-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ACC_SCALE, PROGRAM_ID, MPL_CORE_PROGRAM_ID, ROTATION_LEN, TIERS } from './primates.js';
import { StockLogo, brandFor } from './Logos.jsx';
import { PixelArt } from './PixelArt.jsx';
import { TIER_STYLE } from './Tier.jsx';
import * as sprites from './art/sprites.js';
import { WALKS } from './art/frames.js';
import { originalColors } from './art/palette.js';


const CHAPTERS = [
  ['overview', 'Overview'],
  ['desks', 'Desks and tiers'],
  ['palettes', 'Artwork · palettes'],
  ['walks', 'Artwork · walk cycles'],
  ['vault', 'The vault'],
  ['xstocks', 'xStocks'],
  ['rotation', 'The rotation'],
  ['rounds', 'Rounds and the split'],
  ['settlement', 'Settlement'],
  ['sweeping', 'Sweeping'],
  ['selling', 'Selling a desk'],
  ['reference', 'Program reference'],
  ['status', 'Devnet status'],
];

/// Which chapter the reader is in.
///
/// Keyed off the topmost heading that has crossed the upper third of the
/// viewport rather than off whatever is merely intersecting: with short
/// chapters several are on screen at once, and "topmost visible" is the one a
/// reader would say they are looking at.
function useChapterSpy() {
  const [active, setActive] = useState(CHAPTERS[0][0]);

  useEffect(() => {
    const onScroll = () => {
      let current = CHAPTERS[0][0];
      for (const [id] of CHAPTERS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.33) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return active;
}

function Chapter({ id, title, aside, children }) {
  return (
    <section id={id} className="chapter">
      <div className="shell">
        <div className="label">
          <span>{title}</span>
          {aside && <span>{aside}</span>}
        </div>
        <div className="doc">{children}</div>
      </div>
    </section>
  );
}

/// A figure with its caption, for the art sheets.
function Plate({ src, alt, caption }) {
  return (
    <figure className="plate">
      <img src={src} alt={alt} loading="lazy" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export default function Docs({ config, engine, tickers }) {
  const active = useChapterSpy();

  const price = (tier) => (config ? `${config.prices[tier.id] / LAMPORTS_PER_SOL} SOL` : '—');
  const supply = (tier) => (config ? config.supply[tier.id] : '—');
  const minted = (tier) => (config ? config.minted[tier.id] : '—');

  // ticker -> mint, inverted from the map the site already loads.
  const mintOf = Object.fromEntries(Object.entries(tickers ?? {}).map(([m, t]) => [t, m]));
  const rotation = engine ? engine.rotation.map((m) => tickers[m.toBase58()] ?? '—') : [];

  // Two worked examples. Picked because their marks are the most recognisable
  // in the set, not because the program treats them differently.
  const examples = ['NVDAx', 'AAPLx'];

  return (
    <div className="docs-layout">
      <nav className="docs-rail" aria-label="Chapters">
        <span className="docs-rail-head">Contents</span>
        <ol>
          {CHAPTERS.map(([id, label], i) => (
            // The index drives the stagger on the entrance animation; it is a
            // presentation detail, so it rides as a custom property rather than
            // as thirteen inline animation-delays.
            <li key={id} style={{ '--i': i }}>
              <a href={`#${id}`} className={active === id ? 'on' : ''}>
                <span className="docs-rail-n">{String(i + 1).padStart(2, '0')}</span>
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="docs-body">
        <section className="hero">
          <h1>How Primates works.</h1>

          <p className="lede">
            A desk is an NFT that owns a vault. The vault fills with tokenised
            real-world assets bought out of protocol revenue, and it travels with
            the desk when the desk is sold.
          </p>

          <p>
            There is no staking, no lock-up and no claim window. Holding the NFT is
            the whole position. Everything below is a consequence of that one fact,
            and this page is the long version — the mechanism, the arithmetic, the
            artwork, and the addresses.
          </p>
        </section>

        {/* ------------------------------------------------------------ 01 */}
        <Chapter id="overview" title="01 · Overview" aside="The shape of it">
          <p>
            Three things exist on-chain: a <b>collection</b> of desk NFTs, an{' '}
            <b>engine</b> that buys assets on a rotation and divides them by tier
            weight, and one <b>vault per desk</b> that the buying ends up inside.
            Nothing else is stateful, and no part of it holds a balance on a
            holder&apos;s behalf.
          </p>

          <ol className="steps">
            <li>
              <b>01</b> Creator fees are swept and split — 20% to the protocol, 80%
              to the pot.
            </li>
            <li>
              <b>02</b> On a cadence set on-chain, the pot buys the next tokenised
              stock in a {ROTATION_LEN}-stock rotation.
            </li>
            <li>
              <b>03</b> The purchase is credited to every registered desk by weight,
              then delivered into the vaults.
            </li>
            <li>
              <b>04</b> A holder either sweeps the vault into their wallet, or sells
              the desk with the vault still inside it.
            </li>
          </ol>

          <p>
            The unusual part is step four, and it comes from a property of Metaplex
            Core rather than from anything written here: a desk&apos;s vault is
            derived from the desk&apos;s own address, and only its current owner can
            spend from it. That removes the custody problem instead of solving it.
          </p>
        </Chapter>

        {/* ------------------------------------------------------------ 02 */}
        <Chapter id="desks" title="02 · Desks and tiers" aside="Metaplex Core">
          <p>
            Each desk is a Metaplex Core asset in one collection whose update
            authority is the program&apos;s <code>config</code> PDA. There are three
            tiers. The tier fixes the weight, and the weight is the only input to
            how much of each drop the desk receives.
          </p>

          <div className="tier-gallery">
            {TIERS.map((tier) => (
              <div className="tier-plate" key={tier.id} style={{ '--metal': TIER_STYLE[tier.id].metal }}>
                <PixelArt
                  sprite={sprites[TIER_STYLE[tier.id].sprite]}
                  colors={originalColors(sprites[TIER_STYLE[tier.id].sprite])}
                />
                <b>{tier.name} Desk</b>
                <span>{tier.weight}× weight</span>
              </div>
            ))}
          </div>

          <div className="doc-table">
            <div className="doc-table-head">
              <span>Tier</span>
              <span>Weight</span>
              <span>Price</span>
              <span>Minted</span>
              <span>Supply</span>
            </div>
            {TIERS.map((tier) => (
              <div className="doc-table-row" key={tier.id}>
                <span>{tier.name} Desk</span>
                <span>{tier.weight}×</span>
                <span>{price(tier)}</span>
                <span>{minted(tier)}</span>
                <span>{supply(tier)}</span>
              </div>
            ))}
          </div>

          <p>
            A Kong Desk earns nine times what a Monkey Desk earns from the same
            drop, every time, because the split is arithmetic on those weights and
            nothing else. Weights are read off the asset when it is registered and
            stored on its <code>Desk</code> PDA, so a desk cannot change tier after
            the fact.
          </p>

          <p>
            Supply is enforced by the program, per tier. When{' '}
            <code>minted[tier] == supply[tier]</code> the mint instruction fails —
            the site greys the tier out, but the site is not what stops it.
          </p>
        </Chapter>

        {/* ------------------------------------------------------------ 03 */}
        <Chapter id="palettes" title="03 · Artwork · palettes" aside="Deterministic">
          <p>
            Every desk looks like itself. The colourway is rolled from the
            asset&apos;s own address — <code>seedFromBytes(asset)</code> into a
            splitmix64 stream — so it is recomputable by anyone holding the address
            and stored by nobody. The program records no seed and the site keeps no
            table.
          </p>

          <Plate
            src="/docs_content_kong.png"
            alt="Six Kong sprites in different rolled colourways"
            caption="One Kong sprite, six seeds. Fur, backdrop and eye colour are rolled together; the face and hands keep their own slots so the animal stays readable at every hue."
          />

          <Plate
            src="/docs_content_apes.png"
            alt="Six Ape sprites in different rolled colourways"
            caption="The same generator on the Ape sprite. Shading is derived from the base hue rather than picked per palette, which is why the darker planes stay consistent across all six."
          />

          <p>
            Each sprite declares <b>slots</b> — fur, shade, face, backdrop, eyes —
            and the roll fills them. Because shading is computed from the rolled base
            rather than chosen independently, no seed can produce a flat or muddy
            animal; the relationship between the light and dark planes is fixed even
            though the colour is not.
          </p>

          <p>
            The site renders these as SVG, merging runs of same-coloured cells into
            single rects. That cuts the element count by roughly ten times against
            one rect per pixel, which is what makes it small enough to sit in token
            metadata rather than needing a hosted PNG.
          </p>
        </Chapter>

        {/* ------------------------------------------------------------ 04 */}
        <Chapter id="walks" title="04 · Artwork · walk cycles" aside="Hand-timed">
          <p>
            Each tier has its own walk. Monkey and Ape run three frames, Kong runs
            four — a heavier animal needs the extra contact pose to not read as a
            trot.
          </p>

          <Plate
            src="/docs_content_animations.png"
            alt="Walk cycle frame sheets for all three primates, with near and far limbs marked in cyan and red"
            caption="Each pair of rows is one walk: the frames as drawn, then the same frames with near-side limbs in cyan and far-side in red. Separating the limb sets is what stops the far leg reading as a shadow of the near one."
          />

          <p>
            Frames advance on per-frame hold times rather than a fixed interval. The
            passing poses are meant to read quicker than the contact poses, which a
            single interval cannot express — it is the difference between a walk and
            a flicker.
          </p>

          <p>
            Recolouring is the expensive half and does not change between frames, so
            every frame is rendered once per colourway and then held. The three
            primates on the home page also share one clock, so they stride in step
            instead of drifting apart.
          </p>

          <p>
            The tab icon is the same Kong walk: its frames are rasterised to PNG at
            startup and the <code>&lt;link rel=&quot;icon&quot;&gt;</code> href is
            swapped on the walk&apos;s own timing. An animated GIF favicon would not
            have worked — Chrome renders the first frame and stops.
          </p>
        </Chapter>

        {/* ------------------------------------------------------------ 05 */}
        <Chapter id="vault" title="05 · The vault" aside="Derived, not stored">
          <p>
            Every Core asset has a signer PDA at{' '}
            <code>[&quot;mpl-core-execute&quot;, asset]</code> under the Core
            program. That address is the desk&apos;s vault. It is derived from the
            asset, recorded nowhere, and can hold SOL and any SPL token.
          </p>

          <p>
            Only the asset&apos;s <em>current</em> owner can make it sign, and Core
            enforces that — not this program. Three things follow, and they are the
            reason the design is shaped this way:
          </p>

          <ul className="doc-list">
            <li>
              There is no custody contract to withdraw from before a sale, and no
              step that can be forgotten.
            </li>
            <li>
              Selling the desk transfers the vault with it, contents included. The
              buyer can spend it the moment the transfer confirms; the seller cannot,
              in the same instant, without any migration step.
            </li>
            <li>
              No code of ours stands between a holder and their own balance. The
              permission check is Core&apos;s, on ownership of the NFT.
            </li>
          </ul>

          <p>
            The cost of this is that the vault is a plain account, not a program
            account: it cannot enforce rules about what leaves it. That is the trade
            being made — no rules, but also no trusted party and no upgrade that
            could add one.
          </p>
        </Chapter>

        {/* ------------------------------------------------------------ 06 */}
        <Chapter id="xstocks" title="06 · xStocks" aside="What the vaults fill with">
          <p>
            The assets in the rotation are <b>xStocks</b> — tokenised equities issued
            by Backed Finance, each 1:1 against a share held with a custodian, and
            redeemable through the issuer. On Solana they are SPL tokens with the
            ticker suffixed <code>x</code>: an xStock of Apple is <code>AAPLx</code>.
          </p>

          <div className="ticker-cards">
            {examples.map((ticker) => (
              <div className="ticker-card" key={ticker} style={{ '--brand': brandFor(ticker) }}>
                <div className="ticker-card-head">
                  <StockLogo ticker={ticker} size={34} />
                  <div>
                    <b>{ticker}</b>
                    <span>{ticker === 'NVDAx' ? 'NVIDIA Corporation' : 'Apple Inc.'}</span>
                  </div>
                </div>
                <div className="ticker-card-row">
                  <span>devnet mint</span>
                  {mintOf[ticker] ? (
                    <a href={explorer(mintOf[ticker])} target="_blank" rel="noreferrer">
                      {`${mintOf[ticker].slice(0, 6)}…${mintOf[ticker].slice(-6)}`}
                    </a>
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <div className="ticker-card-row">
                  <span>rotation slot</span>
                  <span>
                    {rotation.indexOf(ticker) >= 0
                      ? `#${String(rotation.indexOf(ticker)).padStart(2, '0')}`
                      : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p>
            Mainnet xStocks are <b>Token-2022</b> mints, not classic SPL Token. That
            is a real constraint rather than a detail: the two programs have
            different ids, so an instruction built for one will not validate against
            the other. The program links <code>anchor-spl</code> with the{' '}
            <code>token</code>, <code>token_2022</code> and{' '}
            <code>associated_token</code> features for exactly this reason, and every
            transfer goes through <code>transfer_checked</code> so decimals and mint
            are validated by the token program rather than trusted from the caller.
          </p>

          <div className="notice">
            <TriangleAlert size={16} strokeWidth={2} aria-hidden />
            <span>
              On devnet the rotation uses mock mints with the same tickers and six
              decimals, because xStocks only exist on mainnet. They are classic SPL
              Token, not Token-2022, and they are worth nothing.
            </span>
          </div>

          <p>
            xStocks are not offered to U.S. persons and carry the issuer&apos;s own
            eligibility and redemption terms. Nothing here changes that, and the
            jurisdictional question is a live one for this project rather than a
            settled one.
          </p>
        </Chapter>

        {/* ------------------------------------------------------------ 07 */}
        <Chapter id="rotation" title="07 · The rotation" aside={`${ROTATION_LEN} slots`}>
          <p>
            The engine holds a fixed array of {ROTATION_LEN} mints and a cursor. Each
            round buys the mint at the cursor, then advances one slot and wraps. Not
            a basket, not a weighting — a queue, so that over{' '}
            {ROTATION_LEN} rounds every desk accrues every stock in the same
            proportion.
          </p>

          <div className="rotation docs-rotation">
            {rotation.length
              ? rotation.map((ticker, slot) => (
                  <span
                    key={ticker + slot}
                    className={engine && slot === engine.cursor ? 'next' : ''}
                    style={{ '--brand': brandFor(ticker) }}
                  >
                    <StockLogo ticker={ticker} size={16} />
                    <span className="slot">{String(slot).padStart(2, '0')}</span>
                    {ticker}
                  </span>
                ))
              : TIERS.slice(0, 0)}
            {!rotation.length && <span>Loading rotation…</span>}
          </div>

          <p>
            The rotation is fixed at {ROTATION_LEN} in the program — it is an array
            in the <code>Engine</code> account, not a vector — so changing which
            stocks are in it is a matter of re-initialising, and changing how many
            there are is a redeploy.
          </p>
        </Chapter>

        {/* ------------------------------------------------------------ 08 */}
        <Chapter id="rounds" title="08 · Rounds and the split" aside="O(1) in desks">
          <p>
            The obvious way to divide a purchase across every desk is to loop over
            the desks. That does not survive contact with a collection of a few
            thousand: it is unbounded work in one transaction, and it gets slower
            precisely as the project succeeds.
          </p>

          <p>
            So a round writes <b>one number</b>. Each rotation slot carries a
            per-weight accumulator, and a round adds the purchase to it:
          </p>

          <pre className="doc-code">
{`acc_per_weight[slot] += amount * ACC_SCALE / total_weight`}
          </pre>

          <p>
            Each desk separately remembers the accumulator value it last settled at.
            What it is owed is the distance the accumulator has travelled since,
            times its own weight:
          </p>

          <pre className="doc-code">
{`owed = (acc_per_weight[slot] - desk.stamp[slot]) * desk.weight / ACC_SCALE`}
          </pre>

          <p>
            A round is therefore constant cost whether ten desks exist or ten
            thousand, and a desk that has never been touched since minting is still
            owed everything it accrued in the meantime. This is the accumulator
            pattern used by staking-reward contracts, applied per rotation slot
            rather than to a single pool.
          </p>

          <div className="stat-grid">
            <div>
              <dt>ACC_SCALE</dt>
              <dd>1e{String(ACC_SCALE).length - 1}</dd>
              <small>fixed-point scale on the accumulator</small>
            </div>
            <div>
              <dt>Total weight</dt>
              <dd>{engine ? engine.totalWeight : '—'}</dd>
              <small>sum over every registered desk</small>
            </div>
            <div>
              <dt>Rotation</dt>
              <dd>{ROTATION_LEN}</dd>
              <small>slots, fixed in the program</small>
            </div>
            <div>
              <dt>Cursor</dt>
              <dd>{engine ? `#${String(engine.cursor).padStart(2, '0')}` : '—'}</dd>
              <small>slot the next round buys</small>
            </div>
          </div>

          <p>
            Division truncates, so a round leaves a little dust uncredited rather
            than over-crediting. That dust stays in the holding account and is picked
            up by the next round instead of being written off — across two verified
            rounds, 7.999997 of 8 tokens reached the desks and the remainder carried
            forward.
          </p>
        </Chapter>

        {/* ------------------------------------------------------------ 09 */}
        <Chapter id="settlement" title="09 · Settlement" aside="Permissionless">
          <p>
            Crediting and delivering are separate. A round credits; <code>settle</code>{' '}
            moves one desk&apos;s owed balance for one stock out of the engine&apos;s
            holding account and into that desk&apos;s vault.
          </p>

          <p>
            <code>settle</code> takes no authority. Anyone can call it for any desk,
            because the only thing it can do is send a desk what it is already owed.
            That means a holder is never dependent on us to run a crank: their
            position accrues whether or not anybody settles, and they can settle it
            themselves.
          </p>

          <p>
            Until it is settled, a desk&apos;s share exists as arithmetic rather than
            as a token balance. The site computes it with the same formula the
            program uses and shows it as <em>pending</em> — which is why a desk can
            display a balance that a block explorer looking at the vault will not
            show yet.
          </p>
        </Chapter>

        {/* ------------------------------------------------------------ 10 */}
        <Chapter id="sweeping" title="10 · Sweeping" aside="Core Execute">
          <p>
            Sweeping moves tokens from the vault to the wallet that holds the desk.
            It needs no instruction of ours at all. Core&apos;s{' '}
            <code>ExecuteV1</code> lets the current owner of an asset make that
            asset&apos;s signer PDA sign one arbitrary instruction, so a sweep is a
            plain <code>transfer_checked</code> whose authority happens to be the
            vault:
          </p>

          <pre className="doc-code">
{`ExecuteV1  (discriminator 31, program CoREENx…hX7d)
  0  asset          writable
  1  collection     writable
  2  asset_signer   the vault — Core sets its signer flag itself
  3  payer          writable, signer
  4  authority      signer — must be the current owner
  5  system_program
  6  program_id     the program being invoked (SPL Token)
  7+ …the inner instruction's own accounts`}
          </pre>

          <p>
            The vault appears twice — once at index 2 and again among the inner
            accounts as the transfer authority — and is marked non-signer in both
            places. No signature for it exists; Core supplies one when it
            invoke_signed&apos;s. Marking it a signer would make the transaction ask
            the wallet for a signature nobody can produce.
          </p>

          <p>
            Percentages are computed on raw base units as integers, never on the
            display figure. 100% has to empty the account exactly, and a float
            round-trip through 1e6 will leave a millionth behind.
          </p>

          <div className="stat-grid">
            <div>
              <dt>~23,800 CU</dt>
              <dd>Execute</dd>
              <small>measured, one token transfer through Core</small>
            </div>
            <div>
              <dt>~13,400 CU</dt>
              <dd>ATA create</dd>
              <small>measured, only when the destination is missing</small>
            </div>
            <div>
              <dt>1033 B</dt>
              <dd>5 stocks</dd>
              <small>measured worst case against the 1232 B limit</small>
            </div>
            <div>
              <dt>5</dt>
              <dd>per transaction</dd>
              <small>so a full sweep is two signatures</small>
            </div>
          </div>

          <p>
            Each stock adds a mint, a source and a destination to the account table,
            and all {ROTATION_LEN} at once overrun the transaction size limit on the
            key list alone. Sweeps are therefore batched five at a time, measured at
            the worst case where every destination account still has to be created.
          </p>
        </Chapter>

        {/* ------------------------------------------------------------ 11 */}
        <Chapter id="selling" title="11 · Selling a desk" aside="The vault goes with it">
          <p>
            Listing a desk lists whatever is inside it. There is no withdrawal step
            before a sale and no way to strip the vault as part of one — the vault
            address is derived from the asset, so it follows the asset by
            construction.
          </p>

          <p>
            An unswept desk is therefore worth more than an empty one, and by a
            legible amount: the vault contents are public, and the site shows them on
            every desk in the collection whether or not you own it.
          </p>

          <p>
            Sweeping and then selling is equivalent to selling and letting the buyer
            sweep. The choice is about who ends up holding the stocks, not about how
            much there is. Magic Eden charges 5% on the sale.
          </p>
        </Chapter>

        {/* ------------------------------------------------------------ 12 */}
        <Chapter id="reference" title="12 · Program reference" aside="Instructions and PDAs">
          <div className="doc-table wide">
            <div className="doc-table-head">
              <span>Instruction</span>
              <span>Who</span>
              <span>What it does</span>
            </div>
            {[
              ['initialize', 'admin', 'One-time setup of collection, treasury, prices and supply.'],
              ['set_config', 'admin', 'Change treasury, prices, supply or metadata base.'],
              ['mint_desk', 'anyone', 'Mint one desk pass, paying the tier price to the treasury.'],
              ['init_engine', 'admin', 'One-time setup of the rotation, cadence and dust floor.'],
              ['set_engine', 'admin', 'Change the round cadence or the dust floor.'],
              ['register_desk', 'anyone', 'Put a minted desk into the engine. Weight is read off the asset.'],
              ['run_round', 'anyone', 'Credit the arrived purchase to every desk by weight.'],
              ['settle', 'anyone', 'Deliver one desk’s owed balance for one stock into its vault.'],
              ['close_desk', 'admin', 'Remove a fully-settled desk and refund its rent.'],
            ].map(([ix, who, what]) => (
              <div className="doc-table-row" key={ix}>
                <span><code>{ix}</code></span>
                <span>{who}</span>
                <span>{what}</span>
              </div>
            ))}
          </div>

          <p>
            Four of the nine are callable by anyone, and the three that matter to a
            holder — minting, registering and settling — are all in that group.
          </p>

          <div className="rows contracts-rows">
            <div className="row">
              <span>program</span>
              <a href={explorer(PROGRAM_ID)} target="_blank" rel="noreferrer">
                {PROGRAM_ID.toBase58()}
              </a>
            </div>
            <div className="row">
              <span>collection</span>
              {config ? (
                <a href={explorer(config.collection)} target="_blank" rel="noreferrer">
                  {config.collection.toBase58()}
                </a>
              ) : (
                <span>—</span>
              )}
            </div>
            <div className="row">
              <span>metaplex core</span>
              <a href={explorer(MPL_CORE_PROGRAM_ID)} target="_blank" rel="noreferrer">
                {MPL_CORE_PROGRAM_ID.toBase58()}
              </a>
            </div>
            <div className="row">
              <span>config pda</span>
              <span>[&quot;config&quot;]</span>
            </div>
            <div className="row">
              <span>engine pda</span>
              <span>[&quot;engine&quot;]</span>
            </div>
            <div className="row">
              <span>desk pda</span>
              <span>[&quot;desk&quot;, asset]</span>
            </div>
            <div className="row">
              <span>vault</span>
              <span>[&quot;mpl-core-execute&quot;, asset] · under Core</span>
            </div>
          </div>
        </Chapter>

        {/* ------------------------------------------------------------ 13 */}
        <Chapter id="status" title="13 · Devnet status" aside="What is not done">
          <p>
            Primates is running on devnet. The stocks are mock mints with no value,
            the SOL is test SOL, and the whole thing can be reset without warning.
            Known gaps, stated rather than buried:
          </p>

          <ul className="doc-list">
            <li>
              <b>Fee sweeping is not autonomous yet.</b> Creator fees are collected
              by an operator key. pump.fun&apos;s fee-sharing config can make the
              split on-chain and permissionless, which removes that key from the
              recurring loop — that is designed, not shipped.
            </li>
            <li>
              <b>Buying is not on-chain.</b> The engine credits what arrives in its
              holding account; the purchase itself happens off-chain. Closing that
              gap means a program-owned pot and a swap CPI.
            </li>
            <li>
              <b>Metadata still points at placeholder art</b> rather than the
              generated sprites the site renders.
            </li>
            <li>
              <b>Mint ordering is approximate.</b> Serial numbers are per tier, and a
              true global ordering needs a DAS index.
            </li>
            <li>
              <b>Securities and jurisdiction review has not happened.</b> xStocks
              exclude U.S. persons, and that question needs answering before mainnet
              rather than after.
            </li>
          </ul>

          <div className="notice">
            <TriangleAlert size={16} strokeWidth={2} aria-hidden />
            <span>
              Nothing here is an offer, and none of it is investment advice. Devnet
              assets have no value and are not redeemable for anything.
            </span>
          </div>
        </Chapter>
      </div>
    </div>
  );
}
