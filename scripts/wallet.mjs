// Creates the devnet controller wallet the test page signs with.
//
// DEVNET ONLY. This key is written in the clear and loaded straight into the
// browser. Never point it at mainnet and never fund it with anything real.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = resolve(root, 'public/dev-wallet.json');

if (existsSync(path)) {
  const { default: existing } = await import(`file://${path}`, {
    with: { type: 'json' },
  });
  const keypair = Keypair.fromSecretKey(Uint8Array.from(existing));
  console.log('Controller wallet already exists:', keypair.publicKey.toBase58());
} else {
  const keypair = Keypair.generate();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(Array.from(keypair.secretKey)));
  console.log('Created controller wallet:', keypair.publicKey.toBase58());
  console.log('Written to dev-wallet.json (gitignored)');
}

const { default: secret } = await import(`file://${path}`, {
  with: { type: 'json' },
});
const wallet = Keypair.fromSecretKey(Uint8Array.from(secret));

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const balance = await connection.getBalance(wallet.publicKey);

console.log('');
console.log('Address:', wallet.publicKey.toBase58());
console.log('Balance:', balance / LAMPORTS_PER_SOL, 'SOL');

if (balance < 0.5 * LAMPORTS_PER_SOL) {
  console.log('');
  console.log('Low balance. Fund it at https://faucet.solana.com (pick Devnet),');
  console.log('then re-run: npm run wallet');
}
