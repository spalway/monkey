// Which chain the site is talking to.
//
// One place, read by both the page and the scripts, because a half-configured
// cluster is the failure mode that looks like everything working right up until
// it moves real money. `VITE_CLUSTER` is the switch; everything else is derived
// from it so there is no combination of settings that can disagree.

const RAW = (import.meta.env?.VITE_CLUSTER ?? 'devnet').toLowerCase();

export const CLUSTER = RAW === 'mainnet' || RAW === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';
export const IS_MAINNET = CLUSTER === 'mainnet-beta';

/// Public endpoints are rate-limited hard and are not suitable for mainnet
/// traffic — set VITE_RPC to a paid endpoint before launch.
const DEFAULT_RPC = IS_MAINNET
  ? 'https://api.mainnet-beta.solana.com'
  : 'https://api.devnet.solana.com';

export const RPC = import.meta.env?.VITE_RPC ?? DEFAULT_RPC;

/// Explorer links carry the cluster on devnet and omit it on mainnet, which is
/// what the explorer expects — a `?cluster=mainnet-beta` query works but reads
/// as a testnet link to anyone hovering it.
export function explorer(address) {
  const base = `https://explorer.solana.com/address/${address}`;
  return IS_MAINNET ? base : `${base}?cluster=${CLUSTER}`;
}

export function explorerTx(signature) {
  const base = `https://explorer.solana.com/tx/${signature}`;
  return IS_MAINNET ? base : `${base}?cluster=${CLUSTER}`;
}

/// Whether the throwaway signing key in /public may be used.
///
/// Devnet only, and never merely "not mainnet" — this is the guard standing
/// between a convenience for testing and a private key served to every visitor
/// of a production site. It is deliberately an allowlist of one.
export const ALLOW_DEV_WALLET = CLUSTER === 'devnet';
