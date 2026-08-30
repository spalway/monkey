// Which chain the site is talking to.
//
// One place, read by both the page and the scripts, because a half-configured
// cluster is the failure mode that looks like everything working right up until
// it moves real money. `VITE_CLUSTER` is the switch; everything else is derived
// from it so there is no combination of settings that can disagree.

const RAW = (import.meta.env?.VITE_CLUSTER ?? 'devnet').toLowerCase();

export const CLUSTER = RAW === 'mainnet' || RAW === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';
export const IS_MAINNET = CLUSTER === 'mainnet-beta';

/// Same-origin by default, proxied to the real provider by the server (and by
/// Vite in dev). That indirection exists for one reason: anything in `VITE_RPC`
/// is inlined into the client bundle at build time, so putting a paid endpoint's
/// API key there publishes it to everyone who loads the site. The key lives in
/// `HELIUS_RPC`, server-side, and never reaches the browser.
///
/// Setting VITE_RPC still works and skips the proxy — use it only for endpoints
/// that carry no secret, or a key you have domain-locked with the provider.
const RAW_RPC = import.meta.env?.VITE_RPC || '/rpc';

/// web3.js needs an absolute endpoint, so the same-origin default is resolved
/// against the page rather than passed through as a path.
export const RPC =
  RAW_RPC.startsWith('http') || typeof window === 'undefined'
    ? RAW_RPC
    : new URL(RAW_RPC, window.location.origin).toString();

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
