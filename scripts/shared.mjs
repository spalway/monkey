import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Connection, Keypair } from '@solana/web3.js';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const read = (name) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));

export const config = read('primates.config.json');

export function wallet() {
  const path = resolve(root, 'public/dev-wallet.json');
  if (!existsSync(path)) {
    throw new Error('No dev-wallet.json. Run: npm run wallet');
  }
  return Keypair.fromSecretKey(Uint8Array.from(read('public/dev-wallet.json')));
}

export function connection() {
  return new Connection(config.rpc, 'confirmed');
}

export function deployment() {
  const path = resolve(root, 'public/deploy.json');
  return existsSync(path) ? read('public/deploy.json') : {};
}

export function saveDeployment(patch) {
  const next = { ...deployment(), ...patch };
  writeFileSync(resolve(root, 'public/deploy.json'), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

/// Treasury defaults to the controller wallet. Milestone 2 replaces this with a
/// program-owned pot PDA.
export function treasury() {
  return config.treasury ?? wallet().publicKey.toBase58();
}
