// /testing — a bench for the two things that are hard to check any other way:
// that a mint actually lands on devnet, and that the generated art looks right
// across seeds. Not linked from the marketing pages.

import { useState } from 'react';
import { explorer } from './cluster.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TIERS } from './primates.js';
import Tier from './Tier.jsx';
import * as sprites from './art/sprites.js';
import { generate } from './art/palette.js';
import { WALKS, cycleMs, frameSprite } from './art/frames.js';
import { PixelArt, PixelWalk } from './PixelArt.jsx';

const SPRITE_FOR = { 0: sprites.monkey, 1: sprites.ape, 2: sprites.kong };

export default function Testing({ config, desks, busy, log, error, mint, valueMultiple }) {
  const [seed, setSeed] = useState('1337');
  const [playing, setPlaying] = useState(true);
  const [step, setStep] = useState(null);

  // One roll drives every preview on the page, so the three tiers can be read
  // against each other rather than against three unrelated seeds.
  const seedBig = (() => {
    try { return BigInt(seed || '0'); } catch { return 0n; }
  })();
  const rolls = Object.fromEntries(
    TIERS.map((t) => [t.id, generate(SPRITE_FOR[t.id], seedBig)]),
  );
  const walkRolls = Object.fromEntries(
    TIERS.map((t) => {
      const walk = WALKS[SPRITE_FOR[t.id].name];
      return [t.id, { walk, roll: generate(frameSprite(walk, 0), seedBig) }];
    }),
  );

  return (
    <>
      <section className="hero" style={{ padding: '48px 0 32px' }}>
        <h1>Testing.</h1>
        <p>
          Mint against devnet and preview generated art. Nothing here is linked from
          the public pages.
        </p>
      </section>

      {error && <div className="note error">{error}</div>}

      <section>
        <div className="label">
          <span>Mint</span>
          <span>{config ? 'devnet · live' : 'loading config'}</span>
        </div>
        <div className="tiers">
          {TIERS.map((tier) => (
            <Tier
              key={tier.id}
              tier={tier}
              config={config}
              busy={busy}
              onMint={mint}
              badge={valueMultiple?.(tier)}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="label">
          <span>Walk cycles</span>
          <span>one seed, all three tiers</span>
        </div>

        <div className="bench">
          {TIERS.map((tier) => {
            const { walk, roll } = walkRolls[tier.id];
            return (
              <div key={tier.id}>
                <PixelWalk
                  walk={walk}
                  colors={roll.colors}
                  nudges={roll.nudges}
                  playing={playing}
                  frame={step ?? undefined}
                  className="bench-art"
                />
                <div className="bench-caption">
                  {tier.name} · {walk.frames.length} frames · {cycleMs(walk)}ms ·{' '}
                  {walk.w}×{walk.h}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bench-controls">
          <button onClick={() => { setStep(null); setPlaying((p) => !p); }}>
            {step === null && playing ? 'pause' : 'play'}
          </button>
          {/* Kong has four frames, the other two have three; a step past a
              species' last frame wraps, which PixelWalk handles. */}
          {Array.from({ length: Math.max(...Object.values(WALKS).map((w) => w.frames.length)) }, (_, i) => (
            <button
              key={i}
              className={step === i ? 'active' : ''}
              onClick={() => { setPlaying(false); setStep(i); }}
            >
              frame {i + 1}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="label">
          <span>Seed</span>
          <span>same seed across all three tiers</span>
        </div>

        <div className="bench-controls">
          <input
            value={seed}
            onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))}
            placeholder="seed"
            inputMode="numeric"
          />
          <button onClick={() => setSeed(String(Math.floor(Math.random() * 1e9)))}>
            roll
          </button>
        </div>

        <div className="tiers">
          {TIERS.map((tier) => {
            const roll = rolls[tier.id];
            return (
              <article className="tier" key={tier.id}>
                <PixelArt
                  sprite={SPRITE_FOR[tier.id]}
                  colors={roll.colors}
                  nudges={roll.nudges}
                />
                <div className="body">
                  <h3>{tier.name}</h3>
                  <div className="rows">
                    {Object.entries(roll.traits).map(([k, v]) => (
                      <div className="row" key={k}>
                        <span>{k}</span>
                        <span>{v}</span>
                      </div>
                    ))}
                    <div className="row">
                      <span>backdrop</span>
                      <span>{roll.colors.bg}</span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <div className="label">
          <span>Minted this session</span>
          <span>{desks.length} held</span>
        </div>
        {desks.length === 0 ? (
          <div className="note">Nothing minted yet.</div>
        ) : (
          desks.map((desk) => (
            <div className="desk" key={desk.address.toBase58()}>
              <div className="desk-head">
                <h3>{desk.name}</h3>
                {desk.weight ? <span className="weight">{desk.weight}×</span> : null}
              </div>
              <div className="rows">
                <div className="row">
                  <span>asset</span>
                  <a href={explorer(desk.address)} target="_blank" rel="noreferrer">
                    {desk.address.toBase58()}
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      {log.length > 0 && (
        <section>
          <div className="label">
            <span>Log</span>
          </div>
          <div className="log">{log.join('\n')}</div>
        </section>
      )}
    </>
  );
}
