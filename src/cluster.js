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
const RAW_RPC = import.meta.env?.VITE_RPC || '';

/// A VITE_RPC that is not an http(s) URL is ignored rather than used.
///
/// This exists because of a real failure: an API key was pasted into VITE_RPC
/// on its own, with no URL around it. The old code treated any non-http value
/// as a relative path, so it resolved to `https://the-site/<the-key>`, the SPA
/// fallback answered with index.html, and every chain read died on
/// "Unexpected token '<'". The endpoint was wrong, the error named JSON, and
/// nothing pointed at the setting. Falling back to the proxy keeps the site
/// working, and the warning says which setting to fix.
const looksLikeUrl = /^https?:\/\//i.test(RAW_RPC);

if (RAW_RPC && !looksLikeUrl && typeof console !== 'undefined') {
  console.warn(
    `[primates] VITE_RPC is set to "${RAW_RPC.slice(0, 12)}…", which is not a URL. ` +
      'Ignoring it and using the /rpc proxy. If that was an API key, it belongs in ' +
      'HELIUS_RPC as a full endpoint — VITE_ variables are inlined into the public bundle.',
  );
}

/// web3.js needs an absolute endpoint, so the same-origin default is resolved
/// against the page rather than passed through as a path.
export const RPC = looksLikeUrl
  ? RAW_RPC
  : (typeof window === 'undefined' ? '/rpc' : new URL('/rpc', window.location.origin).toString());

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

/// What to call the network in user-facing text. Nothing in the UI hardcodes
/// "Devnet" any more: the word only appears when it is true, so flipping
/// VITE_CLUSTER removes every test-network disclaimer at once instead of
/// leaving one behind on a page nobody re-read.
export const CLUSTER_LABEL = IS_MAINNET ? 'Mainnet' : 'Devnet';

/// Which deploy manifest to load. Removes the "remember to copy the mainnet
/// file over the devnet one" step, which is exactly the kind of manual swap
/// that gets missed once and points a live site at test mints.
export const DEPLOY_MANIFEST = IS_MAINNET ? '/deploy.mainnet.json' : '/deploy.json';
