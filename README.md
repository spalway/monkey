# Primates — milestone 1

Devnet proof that the on-chain half works: mint one of three desk passes, get a
real Metaplex Core NFT in a real collection, and get a vault address that belongs
to the NFT rather than to you.

Nothing here is the website. This is the machine the website will sit on top of.

## What a desk is

A desk is a Metaplex Core NFT. Every Core asset has a signer PDA at
`["mpl-core-execute", asset]` under the Core program — it holds SOL and SPL
tokens, and Core only lets the asset's **current owner** spend from it.

That PDA is the vault. We do not create it, store it, or track it. It is derived
from the NFT, so when the desk sells on Magic Eden the vault goes with it, with
everything in it. There is no custom vault code in this program and nothing to
withdraw before a sale.

| Tier   | Weight | Mint    | Supply | SOL per weight |
| ------ | ------ | ------- | ------ | -------------- |
| Monkey | 1×     | 0.1 SOL | 2,500  | 0.100          |
| Ape    | 3×     | 0.3 SOL | 750    | 0.100          |
| Kong   | 9×     | 0.5 SOL | 100    | 0.056          |

Each step up is triple the one below. Weight is what a drop divides by — a wallet
holding 2 Monkey + 1 Ape + 1 Kong has 2(1) + 1(3) + 1(9) = 14 allocation points.

Note the last column: Monkey and Ape buy allocation at the same rate, but Kong
buys it **1.8× cheaper**. That is deliberate — a whale discount, bounded by the
100-unit supply cap. At full mint Kong holders would pay 9.5% of mint revenue for
15.9% of allocation, subsidised by the other two tiers.

## Layout

```
anchor/          program source (rsynced into WSL to build — never builds on Windows)
scripts/         setup + inspection, plain node
src/primates.js  instruction builders and account decoders, shared by scripts and page
src/App.jsx      the devnet test page
public/meta/     tier metadata and artwork
public/deploy.json   generated: collection + treasury addresses
public/dev-wallet.json  generated: the controller key (gitignored)
```

## Setup

```bash
npm install
```

Create the controller wallet, then fund it at <https://faucet.solana.com> (Devnet):

```bash
npm run wallet
```

Create the Core collection, then write the program config:

```bash
npm run collection
npm run init
```

Run the page:

```bash
npm run dev
```

The page loads the controller key straight from `/dev-wallet.json`. There is no
wallet extension and no approval popup — pick a tier, click mint, watch the desk
and its vault appear.

Check state from the terminal at any time:

```bash
npm run status
```

## Rebuilding the program

Program sources cannot compile on native Windows. `scripts/build.sh` rsyncs
`anchor/` into `~/dev/primates` inside WSL and builds there.

```bash
wsl -d Ubuntu -- bash -lc "bash /mnt/c/Users/skizp/crypto/new_projects/primates/scripts/build.sh"
```

```bash
wsl -d Ubuntu -- bash -lc "cd ~/dev/primates && anchor deploy --provider.cluster devnet"
```

## Instructions

| Instruction  | Who      | Does                                                                                    |
| ------------ | -------- | --------------------------------------------------------------------------------------- |
| `initialize` | admin    | Writes the `["config"]` PDA: collection, treasury, prices, supply caps, metadata host.    |
| `set_config` | admin    | Changes any of the above. `minted` is never writable.                                     |
| `mint_desk`  | anyone   | Takes the tier price in SOL, CPIs Core `CreateV2` into the collection, owner = minter.    |

The collection's update authority is the `["config"]` PDA, so `mint_desk` signing
with the config seeds is the only way anything gets minted into the collection.

## Milestone 2 — the drop engine

Every 10 minutes: sweep pump.fun creator fees, keep 20%, spend the rest on the
next stock in the rotation, and credit it to every desk by allocation weight.

### Why a round is one transaction

Paying every holder per round does not scale — 5,000 desks × 10 stocks is 50,000
transfers every ten minutes. Instead a round writes a single number.

The engine keeps a running total per stock of *units owed per 1 weight*. Each
desk keeps a stamp of where it last stood. What a desk is owed is the distance
between the two, times its weight:

```
owed = (acc_per_weight[stock] − desk.stamp[stock]) × desk.weight / ACC_SCALE
```

So `run_round` costs the same whether there are three desks or fifty thousand.
Delivery is a separate `settle` call that anyone can crank, batched a few desks
per transaction. A desk that is never settled loses nothing — its claim exists
from the moment the round ran.

A desk joins via `register_desk`, which stamps it at the *current* accumulator.
That is what stops a desk minted today from claiming last week. The weight is
read off the asset on-chain rather than passed in, so there is nothing to lie
about — and because it reads the asset, desks minted before the engine existed
register fine.

Rounding dust stays in the holding account and is not counted as outstanding, so
the next round for that stock sweeps it up. Nothing is stranded.

### What the program will and will not trust

The bot buys the stock off-chain and deposits it into the holding account owned
by the engine PDA. `run_round` then credits **the balance delta it can see
itself** — it never takes the bot's word for an amount, so a purchase cannot be
overstated. Jupiter is deliberately not CPI'd; it burns compute and account slots
for no gain in guarantees.

What the bot *is* trusted for is the 20/80 split and buying at a fair price. Both
are public transactions, but neither is enforced. Making that trustless needs a
program-owned pot and a swap CPI — a later milestone.

### Instructions

| Instruction     | Who    | Does                                                                   |
| --------------- | ------ | ---------------------------------------------------------------------- |
| `init_engine`   | admin  | Writes the rotation, round interval and dust floor.                     |
| `register_desk` | anyone | Adds a desk to the engine. Weight is read off the asset, not passed in. |
| `run_round`     | anyone | Credits new holding balance to all desks by weight. O(1) in desk count. |
| `settle`        | anyone | Delivers one stock's owed balance into one desk's vault.                |
| `close_desk`    | admin  | Removes a fully-settled desk and refunds its rent. Refuses if owed.     |

Every sizeable account in these contexts is `Box`ed. Unboxed, `settle`
deserialises `Engine` (~660B) plus `Desk` plus two token accounts and a mint into
one 4KB SBF stack frame, overruns it during account validation, and dies with a
null read *before the handler runs*. The symptom is
`Access violation reading 8 bytes at address 0x0` with no CPI in the logs.

### Changing weights or prices

Weights live in two places: `TIER_WEIGHTS` in the program, read at registration,
and a copy stored in each `Desk` PDA. Changing the constant only affects new
registrations, so existing desks must be closed and re-registered:

```bash
npm run crank -- --settle
```

```bash
npm run reweight
```

`reweight` pushes current prices into config and re-registers any desk whose
stored weight no longer matches a tier. Rounds already delivered are untouched —
the accumulator is denominated in stock units, not weights.

### Running it

```bash
npm run stocks
```

```bash
npm run engine
```

```bash
npm run crank -- --simulate --once
```

Drop `--once` to leave it looping on the interval. `--simulate` mints mock stock
into the holding account in place of the fee sweep and the swap, which are both
mainnet-only. The crank creates each desk's token account idempotently as it
settles, so holders never have to "activate" anything.

## Where the money comes from

pump.fun creator fees, swept on the same 10-minute beat. Two ways to do it, and
the difference is who has to be trusted.

### `collect` — the obvious way

`collectCoinCreatorFeeInstructions(creator, feePayer)` returns instructions for
both vaults at once: the bonding-curve vault (native SOL at
`["creator-vault", creator]`) and the AMM vault (WSOL). **The creator must
sign**, so this is automatable by a bot holding the deployer key but not
permissionless.

Fees land in one wallet, and the 20/80 split then happens off-chain in a wallet
we control. Holders have to take our word for it.

### `share` — the better way, and the default here

pump.fun splits creator fees natively. `createFeeSharingConfig` plus
`updateFeeShares` names shareholders and their shares once, signed by the
creator. After that `distributeCreatorFees` is **permissionless** — the
shareholders are passed as plain non-signer accounts, so anyone can crank it and
the money lands in each address directly.

Name two shareholders — the protocol wallet at 20% and the pot at 80% — and the
split stops being something we can get wrong or be accused of getting wrong. No
creator key in the recurring loop at all.

This removes half the trust gap described above. What remains is the swap itself
buying at a fair price, which still wants a program-owned pot and a swap CPI.

### Running it

```bash
npm run fees
```

Dry run. Prints accrued fees across both programs and what it would send.
Add `--send` to execute. **Mainnet only** — there is no pump.fun on devnet, so
none of this can be tested until there is a real token.

Set `pump.mint`, `pump.creator`, `pump.protocolWallet` and `pump.potWallet` in
`primates.config.json` first. The deployer key goes in `creator-wallet.json`,
which is gitignored and is only needed for the one-time sharing setup.

## The floating nav

One element with two looks, cross-faded by a single CSS custom property `--p`
(0 = floating pill, 1 = docked yellow bar). A scroll listener writes `--p` once
per animation frame from rAF, so the entire morph — position, height, radius,
background cross-fade, and every text colour — is one custom-property write per
frame rather than a pile of style mutations.

Colours interpolate with `color-mix(in srgb, A, B calc(var(--p) * 100%))`, which
is what makes the merge continuous instead of a snap at a threshold:

| | Floating | Docked |
| --- | --- | --- |
| Shell | dark yellow → grey gradient, hairline yellow edge | flat yellow |
| `.fun` | yellow | black |
| Nav idle | grey | dark olive |
| Nav selected + underline | yellow | white |
| Connect | flat yellow on dark | dark on yellow |

**Do not add a `transition` to anything `--p` drives.** The morph rewrites those
properties every frame, so a per-frame tween lags the scroll and reads as mush.
The nav links lost their hover colour transition for exactly this reason.

## RPC

The page makes six RPC calls on load and public devnet RPC rate-limits at around
that. web3.js retries through the 429s so it works, just slowly. A free
Helius or QuickNode devnet URL removes it:

    echo "VITE_RPC=https://devnet.helius-rpc.com/?api-key=..." > .env.local

The scripts read `rpc` from `primates.config.json` separately.

## Known limits of milestone 1

- **Metadata is served from `localhost`.** Magic Eden and explorers cannot fetch
  it, so the artwork will not render off this machine. The NFTs themselves are
  real and correctly in-collection. Point `uriBase` at a public host and run
  `set_config` when there is one.
- **Treasury is the controller wallet**, not a program-owned pot. Mint SOL
  currently returns to the payer.
- **Nothing fills the vaults yet.** That is the next milestone.
- **`fetchDesks` uses `getProgramAccounts`** against the Core program, filtered
  on the key byte and owner. It works on public devnet RPC. If a provider ever
  refuses the scan, replace that one function with a DAS `getAssetsByOwner` call.

## Devnet only

`public/dev-wallet.json` is an unencrypted private key that gets loaded into a
browser. It exists so the test page needs no wallet extension. Never point it at
mainnet and never put real funds in it.
