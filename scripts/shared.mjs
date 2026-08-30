import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Connection, Keypair } from '@solana/web3.js';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const read = (name) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));

export const config = read('primates.config.json');

/// Which chain these scripts act on. `CLUSTER=mainnet npm run …`.
///
/// Devnet by default, and deliberately so: every script in here signs
/// transactions, and the one that costs real money should be the one you had to
/// ask for. The signing key and the deploy manifest both follow this, so there
/// is no combination where a mainnet RPC is driven by the devnet key.
const CLUSTER = (process.env.CLUSTER ?? 'devnet').toLowerCase();
export const IS_MAINNET = CLUSTER === 'mainnet' || CLUSTER === 'mainnet-beta';

const WALLET_FILE = IS_MAINNET ? 'mainnet-authority.json' : 'public/dev-wallet.json';
const DEPLOY_FILE = IS_MAINNET ? 'public/deploy.mainnet.json' : 'public/deploy.json';

export function wallet() {
  const path = resolve(root, WALLET_FILE);
  if (!existsSync(path)) {
    throw new Error(
      IS_MAINNET
        ? 'No mainnet-authority.json in the repo root.'
        : 'No dev-wallet.json. Run: npm run wallet',
    );
  }
  return Keypair.fromSecretKey(Uint8Array.from(read(WALLET_FILE)));
}

/// The endpoint every script talks to. Exported because umi builds its own
/// client and would otherwise reach for config.rpc directly — which is how a
/// mainnet key ends up pointed at devnet.
export function rpcUrl() {
  const rpc = process.env.HELIUS_RPC
    ?? process.env.RPC
    ?? (IS_MAINNET ? config.rpcMainnet : config.rpc);
  if (!rpc) throw new Error('No RPC configured. Set HELIUS_RPC.');
  return rpc;
}

export function connection() {
  return new Connection(rpcUrl(), 'confirmed');
}

export function deployment() {
  const path = resolve(root, DEPLOY_FILE);
  return existsSync(path) ? read(DEPLOY_FILE) : {};
}

export function saveDeployment(patch) {
  const next = { ...deployment(), ...patch };
  writeFileSync(resolve(root, DEPLOY_FILE), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

/// Treasury defaults to the controller wallet. Milestone 2 replaces this with a
/// program-owned pot PDA.
export function treasury() {
  return config.treasury ?? wallet().publicKey.toBase58();
}
