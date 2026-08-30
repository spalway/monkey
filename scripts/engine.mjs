// Initializes the drop engine and registers every desk that exists.
// Run after `npm run stocks`. Safe to re-run — it skips what is already done.

import { Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  configPda,
  decodeConfig,
  decodeEngine,
  deskPda,
  enginePda,
  fetchDesks,
  initEngineIx,
  registerDeskIx,
  ROTATION_LEN,
} from '../src/primates.js';
import { config, connection, deployment, wallet } from './shared.mjs';

const payer = wallet();
const conn = connection();
const deploy = deployment();

if (!deploy.stocks) {
  console.error('No stocks in public/deploy.json. Run: npm run stocks');
  process.exit(1);
}

const rotation = Object.values(deploy.stocks);
if (rotation.length !== ROTATION_LEN) {
  console.error(`Need exactly ${ROTATION_LEN} stocks, found ${rotation.length}`);
  process.exit(1);
}

const engine = enginePda();
const decimals = deploy.stockDecimals ?? 6;
const dustFloor = Math.max(1, Math.round((config.dustFloorUnits ?? 0) * 10 ** decimals));

if (await conn.getAccountInfo(engine)) {
  console.log('Engine already initialized at', engine.toBase58());
} else {
  console.log('Initializing engine at', engine.toBase58());
  Object.entries(deploy.stocks).forEach(([ticker, mint], i) => {
    console.log(`  ${String(i).padStart(2)}  ${ticker.padEnd(7)} ${mint}`);
  });
  console.log(`  interval  ${config.roundIntervalSeconds}s`);
  console.log(`  dustFloor ${dustFloor} raw units`);

  await sendAndConfirmTransaction(
    conn,
    new Transaction().add(
      initEngineIx({
        authority: payer.publicKey,
        rotation,
        minInterval: config.roundIntervalSeconds,
        dustFloor,
      }),
    ),
    [payer],
    { commitment: 'confirmed' },
  );
  console.log('  done');
}

// Register every desk the controller holds that is not registered yet.
const cfg = decodeConfig((await conn.getAccountInfo(configPda())).data);
const desks = await fetchDesks(conn, payer.publicKey, cfg.collection);

console.log(`\nRegistering desks (${desks.length} found)`);
for (const desk of desks) {
  if (await conn.getAccountInfo(deskPda(desk.address))) {
    console.log(`  ${desk.name.padEnd(16)} already registered`);
    continue;
  }
  await sendAndConfirmTransaction(
    conn,
    new Transaction().add(
      registerDeskIx({ payer: payer.publicKey, asset: desk.address }),
    ),
    [payer],
    { commitment: 'confirmed' },
  );
  console.log(`  ${desk.name.padEnd(16)} registered  weight ${desk.tier?.weight}`);
}

const eng = decodeEngine((await conn.getAccountInfo(engine)).data);
console.log(`\ntotal weight: ${eng.totalWeight}`);
console.log('Next: npm run crank -- --simulate --once');
