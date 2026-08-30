// Shell and router. Signing is the visitor's own wallet, via the adapter.

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { explorer } from './cluster.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PROGRAM_ID, TIERS } from './primates.js';
import { useChain } from './useChain.js';
import Landing from './Landing.jsx';
import Contracts from './Contracts.jsx';
import Mint from './Mint.jsx';
import Vaults from './Vaults.jsx';
import Docs from './Docs.jsx';
import Changelog from './Changelog.jsx';
import Testing from './Testing.jsx';

const TWITTER = 'https://x.com/primatespl';

/// lucide dropped its brand icons, and its `X` is the close cross, not this.
function XLogo(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const short = (key) => {
  const s = key.toString();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
};

/// Connect, then disconnect, from one button.
///
/// The same control does both because there is only ever one sensible action:
/// connected, the address is showing and the thing you might want is to drop
/// it. Hovering a connected button says Disconnect so the click is never a
/// surprise.
///
/// With no wallet chosen yet it opens the browser's own wallet picker via the
/// adapter's `select`; every wallet worth supporting registers itself through
/// the Wallet Standard, so the list is whatever the visitor actually has
/// installed rather than a hardcoded set.
function ConnectButton({ chain }) {
  const { wallet, connected, connect, disconnect, select, wallets } = chain;
  const [hover, setHover] = useState(false);
  const [busy, setBusy] = useState(false);

  const ready = wallets?.filter((w) => w.readyState === 'Installed') ?? [];

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (connected) {
        await disconnect();
      } else if (wallet) {
        // Already selected, just not connected — reconnect the same one.
        await connect();
      } else if (ready.length) {
        // `autoConnect` on the provider means selecting is enough; the adapter
        // raises the wallet's own approval prompt from here.
        select(ready[0].adapter.name);
      } else {
        window.open('https://solana.com/solana-wallets', '_blank', 'noreferrer');
      }
    } catch {
      // The adapter surfaces its own errors, and a user rejecting the prompt is
      // not one worth showing.
    } finally {
      setBusy(false);
    }
  };

  const label = connected && wallet
    ? (hover ? 'Disconnect' : short(wallet))
    : 'Connect';

  return (
    <button
      className={`connect ${connected ? 'on' : ''}`}
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={connected && wallet ? wallet.toBase58() : 'Connect a wallet'}
    >
      {label}
    </button>
  );
}

/// Hash routing — two pages do not justify a router dependency, and it keeps
/// the site deployable as static files with no server rewrites.
function useRoute() {
  const [route, setRoute] = useState(() => window.location.hash.slice(2) || '');
  useEffect(() => {
    const onHash = () => {
      setRoute(window.location.hash.slice(2) || '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  // "changelog/introducing-primates-app" -> section + param. One split is the
  // whole router; nesting deeper than this would be the point to take a
  // dependency rather than to grow this.
  const [section, param] = route.split('/');
  const chain = useChain();
  const { wallet, balance, config } = chain;

  // Allocation bought per SOL, measured against the entry tier. Derived from the
  // on-chain prices rather than written down, so it cannot go stale when prices
  // change. Only shown where the edge is real.
  const valueMultiple = (tier) => {
    if (!config) return null;
    const perWeight = (t) => config.prices[t.id] / t.weight;
    const multiple = perWeight(TIERS[0]) / perWeight(tier);
    return multiple >= 1.05 ? `${multiple.toFixed(1)}× value` : null;
  };

  return (
    <div className="page">
      <header className="masthead">
        <div className="nav-shell">
          {/* The wordmark is the way home now, so it carries the arrow rather
              than a separate Home item repeating what a logo already means.
              The arrow only appears off the home page: on the home page it
              would point at the page you are already on. */}
          <a className="wordmark" href="#/" aria-label="Primates.fun — home">
            {section !== '' && (
              <ArrowLeft className="wordmark-back" size={15} strokeWidth={2.6} aria-hidden />
            )}
            Primates<b>.fun</b>
          </a>

          <nav className="nav">
            <a href="#/mint" className={section === 'mint' ? 'active' : ''}>
              Mint
            </a>
            <a href="#/docs" className={section === 'docs' ? 'active' : ''}>
              Docs
            </a>
            <a href="#/changelog" className={section === 'changelog' ? 'active' : ''}>
              Changelog
            </a>
          </nav>

          <a
            className="nav-x"
            href={TWITTER}
            target="_blank"
            rel="noreferrer"
            aria-label="Primates on X"
          >
            <XLogo width={12} height={12} />
            <span>@primatespl</span>
          </a>

          <ConnectButton chain={chain} />
        </div>
      </header>

      {section === 'mint' ? (
        <Mint {...chain} valueMultiple={valueMultiple} />
      ) : section === 'docs' ? (
        <Docs {...chain} />
      ) : section === 'changelog' ? (
        <Changelog slug={param} />
      ) : section === 'vaults' ? (
        // Off the nav — the desks and their vaults live on the mint page now —
        // but the route still resolves so old links do not break.
        <Vaults {...chain} />
      ) : section === 'testing' ? (
        <Testing {...chain} valueMultiple={valueMultiple} />
      ) : (
        <Landing {...chain} valueMultiple={valueMultiple} />
      )}

      {section !== '' && <Contracts config={config} balance={balance} />}
    </div>
  );
}


