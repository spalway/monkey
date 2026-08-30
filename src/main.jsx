import { Buffer } from 'buffer';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { startWalkingFavicon } from './favicon.js';
import './styles.css';

// web3.js v1 reaches for these off the global object.
globalThis.Buffer = Buffer;

// Independent of React: the tab icon outlives any particular page.
startWalkingFavicon();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
