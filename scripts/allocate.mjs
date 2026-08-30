// One allocation round: buy the next stock, hand it to the engine, credit
// every desk.
//
//   node scripts/allocate.mjs           # dry run — quotes and prints, sends nothing
//   node scripts/allocate.mjs --send    # signs and submits
//
// This is the half of the mechanism that is not on-chain. The program credits
// whatever xStock has arrived in its holding account and divides it by weight;
// nothing in it can buy. So this script does the buying, moves the result into
// the holding account, and then calls `run_round` to do the dividing.
//
// It does NOT settle. Settlement is permissionless and a desk accrues whether
// or not anyone runs it — doing it here would mean one transaction per desk per
// round, which stops being viable somewhere in the low hundreds of desks.

import fs from 'node:fs';
import {
  Connection, Keypair, PublicKey, Transaction,
  VersionedTransaction, LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  ataFor, createAtaIdempotentIx, decodeEngine, enginePda,
  runRoundIx, transferCheckedIx, TOKEN_PROGRAM_ID,
} from '../src/primates.js';

/// Load .env.local if it is there. Node does not do this, and having to paste
/// an RPC URL with a key in it onto every command line is how keys end up in
/// shell history.
function loadEnvLocal() {
  try {
    for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* no file, use the real environment */ }
}
loadEnvLocal();

const SEND = process.argv.includes('--send');
const RPC = process.env.HELIUS_RPC ?? process.env.RPC ?? 'https://api.mainnet-beta.solana.com';

const WSOL = 'So11111111111111111111111111111111111111112';

/// Left behind for fees. Spending to zero means the next round cannot pay for
/// itself, and the account has to be topped up before anything can recover.
const KEEP_SOL = Number(process.env.ALLOCATE_KEEP_SOL ?? 0.02);
/// Below this the fees and slippage cost more than the round delivers.
const MIN_SOL = Number(process.env.ALLOCATE_MIN_SOL ?? 0.05);
const SLIPPAGE_BPS = Number(process.env.ALLOCATE_SLIPPAGE_BPS ?? 200);

const deploy = JSON.parse(fs.readFileSync('public/deploy.mainnet.json', 'utf8'));

/// Env first, file second — a hosted cron has no gitignored file to read.
function loadPot() {
  const fromEnv = process.env.POT_SECRET;
  if (fromEnv) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fromEnv)));
  if (fs.existsSync('pot-wallet.json')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync('pot-wallet.json', 'utf8'))));
  }
  throw new Error('no pot key: set POT_SECRET or provide pot-wallet.json');
}

const pot = loadPot();
const connection = new Connection(RPC, 'confirmed');
const log = (...a) => process.stdout.write(`${a.join(' ')}\n`);

const tokenProgram = new PublicKey(deploy.tokenProgram ?? TOKEN_PROGRAM_ID);
const decimals = deploy.stockDecimals ?? 6;
const tickerOf = Object.fromEntries(Object.entries(deploy.stocks).map(([t, m]) => [m, t]));

async function confirm(sig, label) {
  await connection.confirmTransaction(sig, 'confirmed');
  log(`${label.padEnd(9)} ${sig}`);
}

async function main() {
  log(`pot       ${pot.publicKey.toBase58()}`);
  log(`rpc       ${RPC.replace(/api-key=.*/, 'api-key=***')}`);

  const engine = enginePda();
  const account = await connection.getAccountInfo(engine);
  if (!account) throw new Error('engine account does not exist — run: CLUSTER=mainnet npm run engine');
  const state = decodeEngine(account.data);

  // The rotation buys in order; the cursor is simply which slot is next.
  const mint = state.rotation[state.cursor];
  const ticker = tickerOf[mint.toBase58()] ?? mint.toBase58().slice(0, 8);
  log(`slot      #${String(state.cursor).padStart(2, '0')}  ${ticker}`);
  log(`weight    ${state.totalWeight} across all registered desks`);

  if (Number(state.totalWeight) === 0) {
    log('\nNo registered desks — run_round would reject this. Nothing to do.');
    return;
  }

  const lamports = await connection.getBalance(pot.publicKey);
  const sol = lamports / LAMPORTS_PER_SOL;
  log(`balance   ${sol} SOL`);

  const spend = sol - KEEP_SOL;
  if (spend < MIN_SOL) {
    log(`\nOnly ${spend.toFixed(4)} SOL spendable (keeping ${KEEP_SOL}); minimum ${MIN_SOL}. Nothing to do.`);
    return;
  }

  const inLamports = Math.floor(spend * LAMPORTS_PER_SOL);
  log(`\nbuying    ${(inLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL of ${ticker}`);

  const quote = await fetch(
    `https://lite-api.jup.ag/swap/v1/quote?inputMint=${WSOL}&outputMint=${mint.toBase58()}`
    + `&amount=${inLamports}&slippageBps=${SLIPPAGE_BPS}`,
  ).then((r) => r.json());
  if (!quote?.outAmount) throw new Error(`quote failed: ${JSON.stringify(quote).slice(0, 240)}`);
  log(`quote     ${(Number(quote.outAmount) / 10 ** decimals).toFixed(6)} ${ticker}`
    + ` · impact ${quote.priceImpactPct ?? '?'}%`);

  const holding = ataFor(mint, engine, tokenProgram);
  log(`holding   ${holding.toBase58()}`);

  if (!SEND) {
    log('\nDry run. Pass --send to buy, deliver and run the round.');
    return;
  }

  // 1. Swap. Jupiter delivers into the pot's own token account.
  const swapRes = await fetch('https://lite-api.jup.ag/swap/v1/swap', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: pot.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  }).then((r) => r.json());
  if (!swapRes?.swapTransaction) {
    throw new Error(`swap build failed: ${JSON.stringify(swapRes).slice(0, 240)}`);
  }

  const swapTx = VersionedTransaction.deserialize(Buffer.from(swapRes.swapTransaction, 'base64'));
  swapTx.sign([pot]);
  await confirm(await connection.sendTransaction(swapTx, { maxRetries: 3 }), 'swapped');

  // 2. Move the whole balance into the engine's holding account, and run the
  //    round in the same transaction. Together, because a transfer that lands
  //    without its round leaves tokens sitting uncredited until someone
  //    notices — and `run_round` is idempotent about what it has already seen,
  //    so pairing them costs nothing.
  const potAta = ataFor(mint, pot.publicKey, tokenProgram);
  const arrived = BigInt((await connection.getTokenAccountBalance(potAta)).value.amount);
  if (arrived === 0n) {
    log('nothing arrived from the swap');
    return;
  }
  log(`arrived   ${(Number(arrived) / 10 ** decimals).toFixed(6)} ${ticker}`);

  const tx = new Transaction();
  if (!(await connection.getAccountInfo(holding))) {
    tx.add(createAtaIdempotentIx({
      payer: pot.publicKey, owner: engine, mint, tokenProgram,
    }));
  }
  tx.add(transferCheckedIx({
    source: potAta,
    mint,
    destination: holding,
    authority: pot.publicKey,
    amount: arrived,
    decimals,
    tokenProgram,
  }));
  tx.add(runRoundIx({ cranker: pot.publicKey, stockMint: mint, tokenProgram }));

  tx.feePayer = pot.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(pot);
  await confirm(await connection.sendRawTransaction(tx.serialize()), 'credited');

  log(`\nRound complete. Desks are owed their share of ${ticker}; settlement is`);
  log('separate and permissionless, so nothing here has to deliver it.');
}

main().catch((e) => {
  log(`error: ${e.message}`);
  process.exit(1);
});
