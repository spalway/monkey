// Prints on-chain state. First thing to run when something looks wrong.

import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  configPda,
  decodeConfig,
  fetchDeskStates,
  fetchDesks,
  PROGRAM_ID,
  TIERS,
} from '../src/primates.js';
import { connection, deployment, wallet } from './shared.mjs';

const conn = connection();
const payer = wallet();
const pda = configPda();

console.log('program   ', PROGRAM_ID.toBase58());
console.log('config PDA', pda.toBase58());
console.log('controller', payer.publicKey.toBase58());
console.log('balance   ', (await conn.getBalance(payer.publicKey)) / LAMPORTS_PER_SOL, 'SOL');
console.log('');

const programAccount = await conn.getAccountInfo(PROGRAM_ID);
console.log('program deployed:', programAccount ? 'yes' : 'NO — run anchor deploy');

const configAccount = await conn.getAccountInfo(pda);
if (!configAccount) {
  console.log('config initialized: NO — run npm run collection && npm run init');
  process.exit(0);
}

const cfg = decodeConfig(configAccount.data);
console.log('config initialized: yes');
console.log('  collection', cfg.collection.toBase58());
console.log('  treasury  ', cfg.treasury.toBase58());
console.log('  uriBase   ', cfg.uriBase);
console.log('');
TIERS.forEach((t, i) => {
  console.log(
    `  ${t.name.padEnd(6)} ${(Number(cfg.prices[i]) / LAMPORTS_PER_SOL).toString().padEnd(6)} SOL` +
      `  x${String(t.weight).padEnd(3)} minted ${cfg.minted[i]}/${cfg.supply[i]}`,
  );
});

const desks = await fetchDesks(conn, payer.publicKey, cfg.collection);
console.log('');
console.log(`desks held by controller: ${desks.length}`);
for (const desk of desks) {
  console.log(`  ${desk.name.padEnd(18)} asset ${desk.address.toBase58()}`);
  console.log(`  ${''.padEnd(18)} vault ${desk.vault.toBase58()}`);
}

// Weight comes from the registered Desk PDA, not from the asset name. A tier
// rename leaves already-minted NFTs carrying their old name for ever — Core
// names are fixed at creation — so a name match under-reports them.
const states = await fetchDeskStates(conn, desks.map((d) => d.address));
const totalWeight = desks.reduce(
  (sum, d) => sum + (states.get(d.address.toBase58())?.weight ?? 0),
  0,
);
if (desks.length) console.log(`  allocation points: ${totalWeight}`);

console.log('');
console.log('deploy.json:', JSON.stringify(deployment()));
