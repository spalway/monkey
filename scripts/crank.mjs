// The 10-minute loop.
//
// Real sequence on mainnet:
//   1. collect_creator_fee on pump.fun          (needs the creator key to sign)
//   2. keep the protocol cut, pot takes the rest
//   3. Jupiter swap SOL -> next stock, output straight into the engine holding ATA
//   4. run_round()                              (credits every desk by weight, O(1))
//   5. settle()                                 (delivery, batched, anyone can crank)
//
// On devnet steps 1-3 have nothing real behind them: pump.fun fees and xStocks
// are both mainnet-only. `--simulate` stands in for them by minting mock stock
// straight into the holding account, which is exactly what a swap would deposit.
// Steps 4 and 5 are the real program and run identically either way.

import {
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAccount,
} from '@solana/spl-token';
import {
  ataFor,
  decodeDesk,
  decodeEngine,
  DESK_ACCOUNT_FILTER,
  enginePda,
  owedFor,
  PROGRAM_ID,
  runRoundIx,
  settleIx,
  vaultPda,
} from '../src/primates.js';
import { config, connection, deployment, wallet } from './shared.mjs';

const SIMULATE = process.argv.includes('--simulate');
const ONCE = process.argv.includes('--once');
// Delivery is independent of rounds and permissionless, so it is worth being
// able to crank on its own — catching up desks after a round, or after someone
// buys a desk that was behind.
const SETTLE_ONLY = process.argv.includes('--settle');

const payer = wallet();
const conn = connection();
const engine = enginePda();

const deploy = deployment();
if (!deploy.stocks) {
  console.error('No stocks in public/deploy.json. Run: npm run stocks');
  process.exit(1);
}

const tickerFor = (mint) =>
  Object.entries(deploy.stocks).find(([, m]) => m === mint.toBase58())?.[0] ?? '???';

const units = (raw) => Number(raw) / 10 ** (deploy.stockDecimals ?? 6);

async function loadEngine() {
  const account = await conn.getAccountInfo(engine);
  if (!account) throw new Error('Engine not initialized. Run: npm run engine');
  return decodeEngine(account.data);
}

/// Stands in for "collect fees, take the cut, swap SOL for stock". The only
/// thing the program ever sees is stock arriving in its holding account, so a
/// mint and a swap are indistinguishable from its side.
async function simulateBuy(stockMint, potSol) {
  const forHolders = potSol * (1 - config.protocolBps / 10_000);
  // Mock fill: 1 SOL buys 10 units of whatever the stock is.
  const amount = BigInt(Math.floor(forHolders * 10 * 10 ** (deploy.stockDecimals ?? 6)));
  const holding = ataFor(stockMint, engine);

  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      holding,
      engine,
      stockMint,
    ),
    createMintToInstruction(stockMint, holding, payer.publicKey, amount),
  );
  await sendAndConfirmTransaction(conn, tx, [payer], { commitment: 'confirmed' });

  console.log(
    `  bought ${units(amount)} ${tickerFor(stockMint)}` +
      `  (${forHolders.toFixed(3)} SOL of ${potSol} pot, ${config.protocolBps / 100}% kept)`,
  );
  return amount;
}

/// Everything registered with the engine. One desk PDA per desk, so a single
/// program scan finds them all.
async function allDesks() {
  const accounts = await conn.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: DESK_ACCOUNT_FILTER } }],
  });
  return accounts.map(({ account }) => decodeDesk(account.data));
}

async function settleAll(stockMint, slot) {
  const desks = await allDesks();
  const eng = await loadEngine();

  const owing = desks.filter((desk) => owedFor(eng, desk)[slot] > 0n);
  if (!owing.length) {
    console.log('  nothing to settle');
    return;
  }

  // Four settles per transaction stays inside the account limit comfortably.
  for (let batch = 0; batch < owing.length; batch += 4) {
    const slice = owing.slice(batch, batch + 4);
    const tx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    );

    for (const desk of slice) {
      const vault = vaultPda(desk.asset);
      tx.add(
        // Idempotent: the desk's token account may or may not exist yet, and
        // creating it here means a holder never has to "activate" anything.
        createAssociatedTokenAccountIdempotentInstruction(
          payer.publicKey,
          ataFor(stockMint, vault),
          vault,
          stockMint,
        ),
        settleIx({ cranker: payer.publicKey, asset: desk.asset, stockMint }),
      );
    }

    await sendAndConfirmTransaction(conn, tx, [payer], { commitment: 'confirmed' });
    for (const desk of slice) {
      console.log(
        `  settled ${desk.asset.toBase58().slice(0, 8)}…  weight ${desk.weight}`,
      );
    }
  }
}

async function cycle() {
  const eng = await loadEngine();
  const slot = eng.cursor;
  const stockMint = eng.rotation[slot];
  const now = Math.floor(Date.now() / 1000);
  const waitFor = Number(eng.lastRound) + Number(eng.minInterval) - now;

  console.log(`\n[${new Date().toISOString()}]`);
  console.log(`  next stock  ${tickerFor(stockMint)} (slot ${slot})`);
  console.log(`  total weight ${eng.totalWeight}`);

  if (eng.totalWeight === 0n) {
    console.log('  no registered desks — nothing to do');
    return;
  }
  if (waitFor > 0) {
    console.log(`  ${waitFor}s until the next round is allowed`);
    return;
  }

  if (SIMULATE) {
    const pot = config.roundPotSol ?? 1;
    await simulateBuy(stockMint, pot);
  }

  const holding = await getAccount(conn, ataFor(stockMint, engine)).catch(() => null);
  const arrived = (holding?.amount ?? 0n) - eng.outstanding[slot];
  if (arrived < eng.dustFloor) {
    console.log(`  only ${units(arrived)} ${tickerFor(stockMint)} unallocated — under the floor`);
    return;
  }

  const sig = await sendAndConfirmTransaction(
    conn,
    new Transaction().add(runRoundIx({ cranker: payer.publicKey, stockMint })),
    [payer],
    { commitment: 'confirmed' },
  );
  console.log(`  round: credited ${units(arrived)} ${tickerFor(stockMint)}  ${sig.slice(0, 16)}…`);

  await settleAll(stockMint, slot);
}

console.log('Primates crank');
console.log('  engine    ', engine.toBase58());
console.log('  cranker   ', payer.publicKey.toBase58());
console.log('  balance   ', (await conn.getBalance(payer.publicKey)) / LAMPORTS_PER_SOL, 'SOL');
console.log('  simulate  ', SIMULATE);

if (SETTLE_ONLY) {
  const eng = await loadEngine();
  // Settle every slot that anybody is behind on, not just the last round.
  for (let slot = 0; slot < eng.rotation.length; slot++) {
    if (eng.accPerWeight[slot] === 0n) continue;
    console.log(`\nslot ${slot} — ${tickerFor(eng.rotation[slot])}`);
    await settleAll(eng.rotation[slot], slot);
  }
} else if (ONCE) {
  await cycle();
} else {
  const eng = await loadEngine();
  const period = Number(eng.minInterval) * 1000;
  console.log(`  interval  ${Number(eng.minInterval)}s\n`);
  await cycle();
  setInterval(() => cycle().catch((e) => console.error('  cycle failed:', e.message)), period);
}
