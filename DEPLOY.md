# Deploying Primates

Read this top to bottom before the first mainnet transaction. The items under
**Blocking** are not polish — each one is a way for the launch to lose money or
leak a key.

---

## What is already wired

| Piece | State |
|---|---|
| Cluster switch | `VITE_CLUSTER=devnet\|mainnet` in `src/cluster.js`. RPC, explorer links and the dev-wallet guard all derive from it. |
| Dev signing key | `public/dev-wallet.json` is only loaded when the cluster is exactly `devnet`. Outside devnet the site refuses to sign rather than falling back. |
| Token metadata | Program writes `<uri_base>/<tier>/<asset>.json`. `server/index.mjs` renders that JSON and the matching SVG from the asset address — no upload step, no database. |
| Collection metadata | `public/meta/collection.json`, image `collection_pfp.png`. |
| security.txt | `security.json` at the repo root, ready for the write command below. |
| Build | `npm run build` → `dist/`. `npm start` serves `dist` plus the metadata routes on `$PORT`. |
| Wallet | Solana wallet adapter, Wallet Standard discovery. One button connects and disconnects. Public page data (collection, engine, rotation) loads with no wallet connected. |
| RPC | Browser calls same-origin `/rpc`; server forwards to `HELIUS_RPC`. Key never enters the bundle. |
| Mainnet authority | `Gim1sRE6sf7hMXyKQERhaWkAgNUMNtmc129Wnp3iQ9E8` — secret in `mainnet-authority.json` (gitignored). Needs funding. |
| Secrets | `.gitignore` excludes `public/dev-wallet.json`, `creator-wallet.json`, `.env.local`. Verified absent from the committed tree. |

---

## Blocking — mainnet will not work without these

### 1. Program deploy to mainnet

The program has only ever been deployed to devnet, and it has just changed (the
per-asset metadata URI), so devnet is stale too.

```
wsl -d Ubuntu -- bash -lc "cd ~/dev/primates && anchor build"
solana config set --url mainnet-beta
solana program deploy target/deploy/primates.so
```

Budget roughly **3 SOL** for the deploy buffer at the current program size.
Decide first whether to keep the program id `CGcSojUL6xeXatcZ9RDzrqUqSucVnAR83fjv7KTrgJrm`
(requires the same program keypair) or generate a fresh one for mainnet.

### 2. Point the client at the real xStock mints

`public/deploy.mainnet.json` already holds all ten, verified against a public
token API — **no xStocks API key is needed for any of this.** Their API is for
market data; mint addresses are on-chain public record.

Copy it over `public/deploy.json` when switching. Two things in it matter:

- **decimals = 8**, not 6. The devnet mocks are 6. Any code that assumes one
  silently mis-scales the other by 100x. This now comes from `deploy.json`
  rather than a constant, so it follows the file.
- **tokenProgram = Token-2022** (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`).
  `settleIx`, `sweepIx`, `ataFor` and `createAtaIdempotentIx` still default to
  classic SPL Token. **This is the remaining code change**: thread
  `chainCfg.tokenProgram` through them, or every mainnet transfer fails account
  validation. The program is already built for it (`anchor-spl` has the
  `token_2022` feature); only the client assumes.

### 3. Paid RPC

Done for devnet, and it is a one-line switch. The key lives in `HELIUS_RPC` in
`.env.local` — **server-side only**. The browser calls `/rpc` on our own origin
and the server forwards. Verified: the key does not appear in the built bundle.

For mainnet, change the `HELIUS_RPC` line in `.env.local` (and the Railway env)
to the `mainnet.helius-rpc.com` variant already commented in that file.

Do **not** put the key in `VITE_RPC` — anything VITE_-prefixed is inlined into
the client bundle at build time and published to everyone who loads the site.

### 4. Unresolved before taking anyone's money

- The program is **unaudited** and holds a mint price path and a distribution path.
- **Fee sweeping is not autonomous.** Creator fees are collected by an operator
  key. pump.fun's fee-sharing config would make the 20/80 split on-chain and
  permissionless — designed, not built.
- **Buying is off-chain.** The engine credits whatever arrives in its holding
  account; it does not buy anything itself. Closing that means a program-owned
  pot and a swap CPI.
- **Securities and jurisdiction.** xStocks exclude U.S. persons. That question
  needs answering before mainnet, not after.

---

## Order of operations

1. `anchor build` and deploy to mainnet; note the program id.
3. Write security.txt:
   ```
   npx @solana-program/program-metadata@latest write security <PROGRAM_ID> ./security.json
   ```
   Fill in `source_code` in `security.json` first — it currently says `REPLACE-ME`.
4. Create the mainnet collection: `npm run collection`, with `uriBase` set to
   `https://primates.app/meta`.
5. `npm run init` with mainnet prices, supply and treasury.
6. `npm run stocks` is **devnet only** — on mainnet, put the ten real xStock
   mints into `deploy.json` by hand.
7. `npm run engine` to initialise the rotation and cadence.
8. Push to GitHub, connect the repo to Railway.
9. Railway env: `VITE_CLUSTER=mainnet`, `HELIUS_RPC=<mainnet helius url>`,
   `PUBLIC_URL=https://primates.app`. Build `npm run build`, start `npm start`.
10. Point `primates.app` at the Railway service, then re-check that the token
    metadata URLs resolve publicly — wallets fetch them from outside your network.

---

## The desks

Nothing needs clearing. Mainnet is a fresh program, a fresh config PDA and a
fresh collection, so `minted` starts at zero for every tier. The ~26 devnet
desks live under a different program on a different cluster and are invisible to
a mainnet build.

If you want the devnet ones gone anyway, `close_desk` unregisters a settled desk
from the engine but does not burn the NFT; burning needs a Core `BurnV1` per
asset, signed by the owner.
