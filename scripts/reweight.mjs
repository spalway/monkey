// Re-registers every desk at the current TIER_WEIGHTS, and pushes the current
// prices into config.
//
// Weights live in two places: the constant in the program (read at registration)
// and the copy stored in each Desk PDA. Changing the constant only affects new
// registrations, so after a weight change existing desks have to be closed and
// re-registered. Rounds already delivered are untouched — the accumulator is in
// stock units, not weights.
//
// Devnet housekeeping. On mainnet the weights are fixed before launch.

import { LAMPORTS_PER_SOL, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  closeDeskIx,
  configPda,
  decodeConfig,
  decodeDesk,
  decodeEngine,
  DESK_ACCOUNT_FILTER,
  deskPda,
  enginePda,
  owedFor,
  PROGRAM_ID,
  registerDeskIx,
  setConfigIx,
  TIERS,
} from '../src/primates.js';
import { config, connection, wallet } from './shared.mjs';

const conn = connection();
const payer = wallet();

// ------------------------------------------------------------------ prices

const prices = TIERS.map((t) => Math.round(config.prices[t.slug] * LAMPORTS_PER_SOL));
const cfg = decodeConfig((await conn.getAccountInfo(configPda())).data);
const pricesChanged = prices.some((p, i) => BigInt(p) !== cfg.prices[i]);

if (pricesChanged) {
  console.log('Updating prices');
  TIERS.forEach((t, i) => {
    console.log(
      `  ${t.name.padEnd(6)} ${Number(cfg.prices[i]) / LAMPORTS_PER_SOL} -> ${config.prices[t.slug]} SOL`,
    );
  });
  await sendAndConfirmTransaction(
    conn,
    new Transaction().add(setConfigIx({ authority: payer.publicKey, prices })),
    [payer],
    { commitment: 'confirmed' },
  );
} else {
  console.log('Prices already current');
}

// ----------------------------------------------------------------- weights

const eng = decodeEngine((await conn.getAccountInfo(enginePda())).data);
const desks = (
  await conn.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: DESK_ACCOUNT_FILTER } }],
  })
).map(({ account }) => decodeDesk(account.data));

const stale = desks.filter((desk) => {
  const tier = TIERS.find((t) => t.weight === desk.weight);
  return !tier;
});

console.log(`\n${desks.length} desks registered, ${stale.length} on stale weights`);

if (!stale.length) {
  console.log(`total weight ${eng.totalWeight} — nothing to do`);
  process.exit(0);
}

const unsettled = stale.filter((desk) => owedFor(eng, desk).some((owed) => owed > 0n));
if (unsettled.length) {
  console.error(`\n${unsettled.length} of them are still owed tokens.`);
  console.error('Run `npm run crank -- --settle` first, then re-run this.');
  process.exit(1);
}

for (const desk of stale) {
  await sendAndConfirmTransaction(
    conn,
    new Transaction().add(
      closeDeskIx({ authority: payer.publicKey, asset: desk.asset }),
      registerDeskIx({ payer: payer.publicKey, asset: desk.asset }),
    ),
    [payer],
    { commitment: 'confirmed' },
  );
  const fresh = decodeDesk((await conn.getAccountInfo(deskPda(desk.asset))).data);
  console.log(
    `  ${desk.asset.toBase58().slice(0, 8)}…  weight ${desk.weight} -> ${fresh.weight}`,
  );
}

const after = decodeEngine((await conn.getAccountInfo(enginePda())).data);
console.log(`\ntotal weight ${eng.totalWeight} -> ${after.totalWeight}`);
