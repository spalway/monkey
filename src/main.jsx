import { Buffer } from 'buffer';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import App from './App.jsx';
import { RPC } from './cluster.js';
import { startWalkingFavicon } from './favicon.js';
import './styles.css';

// web3.js v1 reaches for these off the global object.
globalThis.Buffer = Buffer;

// Independent of React: the tab icon outlives any particular page.
startWalkingFavicon();

// An empty wallet list on purpose. Every wallet worth supporting now implements
// the Wallet Standard, which the provider discovers from the page itself — so
// the list stays correct as wallets come and go, and we do not ship forty
// adapter bundles to serve the two people are actually using.
const WALLETS = [];

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConnectionProvider endpoint={RPC}>
      <WalletProvider wallets={WALLETS} autoConnect>
        <App />
      </WalletProvider>
    </ConnectionProvider>
  </React.StrictMode>,
);
