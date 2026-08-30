// Writes the program's ["config"] PDA. Run once, after `npm run collection`.

import { LAMPORTS_PER_SOL, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { configPda, initializeIx, TIERS } from '../src/primates.js';
import { config, connection, deployment, saveDeployment, wallet } from './shared.mjs';

const payer = wallet();
const conn = connection();
const { collection } = deployment();

if (!collection) {
  console.error('No collection in public/deploy.json. Run: npm run collection');
  process.exit(1);
}

const pda = configPda();
if (await conn.getAccountInfo(pda)) {
  console.log('Config already initialized at', pda.toBase58());
  console.log('Use set_config to change prices or the uri base.');
  process.exit(0);
}

const prices = TIERS.map((t) => Math.round(config.prices[t.slug] * LAMPORTS_PER_SOL));
const supply = TIERS.map((t) => config.supply[t.slug]);
const treasury = deployment().treasury ?? payer.publicKey.toBase58();

console.log('Initializing config at', pda.toBase58());
TIERS.forEach((t, i) => {
  console.log(`  ${t.name.padEnd(6)} ${config.prices[t.slug]} SOL  x${t.weight}  supply ${supply[i]}`);
});
console.log('  uriBase ', config.uriBase);
console.log('  treasury', treasury);

const tx = new Transaction().add(
  initializeIx({
    authority: payer.publicKey,
    collection,
    treasury,
    prices,
    supply,
    uriBase: config.uriBase,
  }),
);

const sig = await sendAndConfirmTransaction(conn, tx, [payer], { commitment: 'confirmed' });
saveDeployment({ treasury });

console.log('');
console.log('Done:', `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
console.log('Next: npm run dev');
