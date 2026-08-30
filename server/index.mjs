// Serves the built site, and the per-asset token metadata that goes with it.
//
// Every desk's artwork is rolled from its own address, so the image for an asset
// is a pure function of that address — no database, no pre-rendering, and no
// upload step when a desk is minted. The program writes
// `<uri_base>/<tier>/<asset>.json` into the NFT at mint time and this answers it.
//
// The tier is in the path on purpose: it means a request can be answered from
// the URL alone, with no RPC round trip to discover what tier the asset is.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PublicKey } from '@solana/web3.js';
import * as sprites from '../src/art/sprites.js';
import { generate, seedFromBytes } from '../src/art/palette.js';
import { toSVG, TILE_PAD } from '../src/art/render.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT ?? 8080);

/// Where this deployment is reachable, for absolute URLs inside the metadata.
/// Token metadata is fetched by wallets and marketplaces, not by the page, so a
/// relative image path would resolve against *their* origin and 404.
const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/$/, '');

const TIERS = {
  monkey: { name: 'Monkey', weight: 1, blurb: 'The entry desk.' },
  ape: { name: 'Ape', weight: 3, blurb: 'The standard desk.' },
  kong: { name: 'Kong', weight: 9, blurb: 'The senior desk.' },
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

/// Reject anything that is not a real address before it reaches the renderer:
/// the seed is derived from the decoded bytes, so a malformed key would either
/// throw or quietly produce art for an asset that cannot exist.
function parseAsset(raw) {
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}

function artFor(slug, asset) {
  const roll = generate(sprites[slug], seedFromBytes(asset.toBytes()));
  return toSVG(sprites[slug], roll.colors, { nudges: roll.nudges, pad: TILE_PAD });
}

/// The vault, derived the same way the program and the site derive it.
const MPL_CORE = new PublicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d');
const vaultFor = (asset) =>
  PublicKey.findProgramAddressSync([Buffer.from('mpl-core-execute'), asset.toBuffer()], MPL_CORE)[0];

function metadataFor(slug, asset) {
  const tier = TIERS[slug];
  const image = `${PUBLIC_URL}/img/${slug}/${asset.toBase58()}.svg`;

  return {
    name: `${tier.name} Desk`,
    symbol: 'DESK',
    description:
      `${tier.blurb} Carries ${tier.weight}x allocation weight when a drop is split across ` +
      'desks. This desk owns a vault derived from the NFT itself, which only its current ' +
      'owner can spend from and which transfers with the NFT when it is sold.',
    image,
    external_url: 'https://primates.app',
    attributes: [
      { trait_type: 'Tier', value: tier.name },
      { trait_type: 'Allocation Weight', value: tier.weight },
      { trait_type: 'Vault', value: vaultFor(asset).toBase58() },
    ],
    properties: {
      files: [{ uri: image, type: 'image/svg+xml' }],
      category: 'image',
    },
  };
}

const send = (res, status, type, body, cache) => {
  res.writeHead(status, {
    'content-type': type,
    ...(cache ? { 'cache-control': cache } : {}),
  });
  res.end(body);
};

async function serveStatic(res, urlPath) {
  // normalize() collapses "..", and the prefix check is what stops a crafted
  // path from reading outside dist.
  const rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const file = join(DIST, rel);
  if (!file.startsWith(DIST)) return send(res, 403, 'text/plain', 'forbidden');

  try {
    const info = await stat(file);
    if (info.isDirectory()) throw new Error('dir');
    const body = await readFile(file);
    return send(res, 200, MIME[extname(file)] ?? 'application/octet-stream', body, 'public, max-age=3600');
  } catch {
    // Hash routing means every unknown path is a page, not a 404.
    try {
      return send(res, 200, MIME['.html'], await readFile(join(DIST, 'index.html')));
    } catch {
      return send(res, 404, 'text/plain', 'not found');
    }
  }
}

/// Where JSON-RPC actually goes.
///
/// Server-side so the provider's API key never reaches a browser: anything the
/// client can read, everyone can read. If it is unset the site has no chain to
/// talk to at all, which is a louder and far better failure than silently
/// falling back to a public node that will rate-limit under real traffic.
const UPSTREAM_RPC = process.env.HELIUS_RPC ?? process.env.UPSTREAM_RPC ?? '';

async function proxyRpc(req, res) {
  if (!UPSTREAM_RPC) return send(res, 503, 'text/plain', 'no upstream rpc configured');

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  try {
    const upstream = await fetch(UPSTREAM_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: Buffer.concat(chunks),
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    return send(res, upstream.status, 'application/json', body);
  } catch {
    return send(res, 502, 'text/plain', 'rpc upstream unreachable');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const path = decodeURIComponent(url.pathname);

  if (path === '/rpc') {
    if (req.method !== 'POST') return send(res, 405, 'text/plain', 'post only');
    return proxyRpc(req, res);
  }

  // Metadata and images are immutable for a given asset — the art is a pure
  // function of the address — so they can be cached hard.
  const IMMUTABLE = 'public, max-age=31536000, immutable';

  let m = /^\/meta\/(monkey|ape|kong)\/([1-9A-HJ-NP-Za-km-z]{32,44})\.json$/.exec(path);
  if (m) {
    const asset = parseAsset(m[2]);
    if (!asset) return send(res, 400, 'text/plain', 'bad asset');
    return send(res, 200, MIME['.json'], JSON.stringify(metadataFor(m[1], asset), null, 2), IMMUTABLE);
  }

  m = /^\/img\/(monkey|ape|kong)\/([1-9A-HJ-NP-Za-km-z]{32,44})\.svg$/.exec(path);
  if (m) {
    const asset = parseAsset(m[2]);
    if (!asset) return send(res, 400, 'text/plain', 'bad asset');
    return send(res, 200, MIME['.svg'], artFor(m[1], asset), IMMUTABLE);
  }

  // The collection's own metadata is fixed, so it stays a file in /public.
  return serveStatic(res, path === '/' ? '/index.html' : path);
});

server.listen(PORT, () => {
  process.stdout.write(`primates on :${PORT} (public url ${PUBLIC_URL})\n`);
});
