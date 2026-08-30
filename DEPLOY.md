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
| Secrets | `.gitignore` excludes `public/dev-wallet.json`, `creator-wallet.json`, `.env.local`. Verified absent from the committed tree. |

---

## Blocking — mainnet will not work without these

### 1. Wallet adapter

The site has never had one. On devnet it signs with a throwaway key fetched from
`/public`; that path is now hard-gated to devnet, which means **on mainnet the
site currently cannot sign anything at all**. Minting and sweeping both need a
real adapter (`@solana/wallet-adapter-react`, or `@solana/kit` + `@solana/react`)
wired into `useChain`.

This is the largest remaining piece of work and nothing else on this list
matters until it is done.

### 2. Program deploy to mainnet

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

### 3. Real xStock mints

`public/deploy.json` holds ten **mock devnet mints**. Mainnet xStocks are real
Backed Finance tokens and — importantly — **Token-2022, not classic SPL Token**.
Two consequences:

- Every mint address in the rotation has to be replaced with the real one.
- `settleIx` and `sweepIx` currently hardcode `TOKEN_PROGRAM_ID`. They must pass
  the Token-2022 program id for these mints, or every transfer will fail account
  validation. The program already links `anchor-spl` with the `token_2022`
  feature; the client is what needs updating.

Confirm the decimals per mint rather than assuming 6 — `STOCK_DECIMALS` in
`useChain.js` and the `decimals` argument in `fetchHoldingsGrid` both assume it.

### 4. Paid RPC

`VITE_RPC` must point at Helius/QuickNode/Triton. The public mainnet endpoint
will rate-limit the collection scan (`getProgramAccounts`) immediately.

### 5. Unresolved before taking anyone's money

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

1. Wallet adapter (above).
2. `anchor build` and deploy to mainnet; note the program id.
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
9. Railway env: `VITE_CLUSTER=mainnet`, `VITE_RPC=<paid endpoint>`,
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
