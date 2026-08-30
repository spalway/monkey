// Changes the round cadence. `npm run interval -- 900` for fifteen minutes.

import { Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { decodeEngine, enginePda, setEngineIx } from '../src/primates.js';
import { connection, wallet } from './shared.mjs';

const seconds = Number(process.argv[2]);
if (!Number.isFinite(seconds) || seconds <= 0) {
  console.error('Usage: npm run interval -- <seconds>');
  process.exit(1);
}

const conn = connection();
const payer = wallet();
const before = decodeEngine((await conn.getAccountInfo(enginePda())).data);

console.log(`interval ${before.minInterval}s -> ${seconds}s`);

const sig = await sendAndConfirmTransaction(
  conn,
  new Transaction().add(
    setEngineIx({ authority: payer.publicKey, minInterval: seconds }),
  ),
  [payer],
  { commitment: 'confirmed' },
);

const after = decodeEngine((await conn.getAccountInfo(enginePda())).data);
console.log(`now ${after.minInterval}s  ${sig.slice(0, 16)}…`);
