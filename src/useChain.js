// All devnet state and the mint action, in one hook so the pages stay presentational.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import { ALLOW_DEV_WALLET, RPC } from './cluster.js';
import {
  ataFor,
  createAtaIdempotentIx,
  decodeCoreAsset,
  sweepIx,
  vaultPda,
  configPda,
  decodeConfig,
  decodeEngine,
  enginePda,
  fetchCollectionDesks,
  fetchDesks,
  fetchDeskStates,
  fetchHoldingsGrid,
  mintDeskIx,
  owedFor,
  registerDeskIx,
} from './primates.js';

// Public RPC rate-limits hard (HTTP 429) — web3.js retries through it, so the
// page works, just slowly. Set VITE_RPC to a paid endpoint; on mainnet that is
// not optional.

export const connection = new Connection(RPC, 'confirmed');

/// Fallback only. Real values come from deploy.json, because they differ by
/// cluster: the devnet mocks are 6-decimal classic SPL Token, and mainnet
/// xStocks are 8-decimal Token-2022. Assuming either one breaks the other.
const FALLBACK_DECIMALS = 6;

export function useChain() {
  // The connected wallet, from the adapter. `wallet` is a PublicKey or null —
  // this hook no longer holds a signing key of any kind.
  const { publicKey: wallet, sendTransaction, connected, disconnect, connect, select, wallets } = useWallet();
  const [balance, setBalance] = useState(null);
  const [config, setConfig] = useState(null);
  const [engine, setEngine] = useState(null);
  const [desks, setDesks] = useState([]);
  // Every desk in the collection, for the public list. Separate from `desks`,
  // which is only what this wallet holds.
  const [minted, setMinted] = useState([]);
  // Holdings for desks we do not own, fetched a page at a time by the lists that
  // show them. Fetching every minted desk up front would be vaults x mints
  // accounts — hundreds of RPC calls at full supply — for ten rows on screen.
  const [vaultHoldings, setVaultHoldings] = useState({});
  const pending = useRef(new Set());
  const [tickers, setTickers] = useState({});
  // Per-cluster token facts, from deploy.json. See FALLBACK_DECIMALS.
  const [chainCfg, setChainCfg] = useState({
    decimals: FALLBACK_DECIMALS,
    tokenProgram: null,
  });
  const [busy, setBusy] = useState(null);
  const [log, setLog] = useState([]);
  const [error, setError] = useState(null);
  /// The desk just minted, or null. Drives the success dialog.
  const [justMinted, setJustMinted] = useState(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  const say = (line) => setLog((prev) => [line, ...prev].slice(0, 6));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // mint address -> ticker, written by `npm run stocks`. Cosmetic only.
  useEffect(() => {
    fetch('/deploy.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((deploy) => {
        if (!deploy?.stocks) return;
        setTickers(Object.fromEntries(Object.entries(deploy.stocks).map(([t, m]) => [m, t])));
        setChainCfg({
          decimals: deploy.stockDecimals ?? FALLBACK_DECIMALS,
          tokenProgram: deploy.tokenProgram ?? null,
        });
      })
      .catch(() => {});
  }, []);

  /// Load holdings for a set of vaults, skipping any already known or in flight.
  const loadHoldings = useCallback(
    async (vaults) => {
      if (!engine) return;
      const want = vaults.filter(
        (v) => !(v.toBase58() in vaultHoldings) && !pending.current.has(v.toBase58()),
      );
      if (!want.length) return;
      want.forEach((v) => pending.current.add(v.toBase58()));
      try {
        const grid = await fetchHoldingsGrid(connection, want, engine.rotation);
        setVaultHoldings((prev) => ({ ...prev, ...Object.fromEntries(grid) }));
      } catch {
        // A failed page just leaves those rows unknown; the next render retries.
      } finally {
        want.forEach((v) => pending.current.delete(v.toBase58()));
      }
    },
    [engine, vaultHoldings],
  );

  const refresh = useCallback(async () => {
    try {
      // Everything down to `held` is public: the collection, the engine and the
      // rotation belong to the page, not to a visitor. Gating them on a
      // connected wallet meant the landing page was blank until someone
      // approved a wallet popup, which is backwards — the pitch has to render
      // before anyone has a reason to connect.
      setBalance(wallet ? await connection.getBalance(wallet) : null);

      const configAccount = await connection.getAccountInfo(configPda());
      if (!configAccount) {
        setError('Config not initialized. Run "npm run collection" then "npm run init".');
        return null;
      }
      const cfg = decodeConfig(configAccount.data);
      // Prices decode as BigInt lamports; see the note below on why none of that
      // is allowed into state.
      setConfig({ ...cfg, prices: cfg.prices.map(Number) });

      const engineAccount = await connection.getAccountInfo(enginePda());
      const eng = engineAccount ? decodeEngine(engineAccount.data) : null;

      // Never put BigInts in React state. React's dev-mode effect commit walks
      // state and serialises it, and a BigInt throws "Do not know how to
      // serialize a BigInt" from inside commitPassiveMountOnFiber — which
      // surfaces as an unrelated-looking scheduler crash. The BigInt arithmetic
      // stays in primates.js; only plain values cross into the components.
      setEngine(
        eng && {
          rotation: eng.rotation,
          cursor: eng.cursor,
          totalWeight: Number(eng.totalWeight),
          lastRound: Number(eng.lastRound),
          minInterval: Number(eng.minInterval),
        },
      );

      setMinted(await fetchCollectionDesks(connection, cfg.collection));

      // Past here is this visitor's own holdings, so it needs a wallet.
      if (!wallet) {
        setDesks([]);
        setError(null);
        return 0;
      }

      const held = await fetchDesks(connection, wallet, cfg.collection);

      // Two batched calls for the whole list, not two per desk — public devnet
      // RPC starts returning 429 at around a dozen requests per page load.
      const states = await fetchDeskStates(connection, held.map((d) => d.address));
      const grid = eng
        ? await fetchHoldingsGrid(connection, held.map((d) => d.vault), eng.rotation)
        : new Map();

      setDesks(
        held.map((desk) => {
          const registered = states.get(desk.address.toBase58()) ?? null;
          // Same rule: owed comes back as raw BigInt units, so convert here.
          const owed =
            eng && registered
              ? owedFor(eng, registered).map((raw) => Number(raw) / 10 ** chainCfg.decimals)
              : null;
          return {
            ...desk,
            weight: registered?.weight ?? null,
            owed,
            holdings: grid.get(desk.vault.toBase58()) ?? [],
          };
        }),
      );
      setError(null);
      return held.length;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, [wallet, chainCfg.decimals]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /// Restart the countdown once a round is actually due.
  ///
  /// `lastRound` only moves when someone cranks, so the clock reaching zero is
  /// not the same event as the round happening — it just means one is now
  /// allowed. Polling from that moment (rather than on a permanent timer) keeps
  /// the countdown honest without spending a request a second for the rest of
  /// the interval: it sits idle until due, then checks every ten seconds until
  /// the chain says a round landed, and stops again.
  useEffect(() => {
    if (!engine) return undefined;
    const dueAt = engine.lastRound + engine.minInterval;
    if (now < dueAt) return undefined;

    const id = setInterval(async () => {
      try {
        const account = await connection.getAccountInfo(enginePda());
        if (!account) return;
        const next = decodeEngine(account.data);
        if (Number(next.lastRound) > engine.lastRound) {
          setEngine({
            rotation: next.rotation,
            cursor: next.cursor,
            totalWeight: Number(next.totalWeight),
            lastRound: Number(next.lastRound),
            minInterval: Number(next.minInterval),
          });
          // The round moved balances, so what is on screen is now stale.
          refresh();
        }
      } catch {
        // A missed poll costs nothing; the next one is ten seconds away.
      }
    }, 10_000);

    return () => clearInterval(id);
    // `now` is deliberately absent: it ticks every second and would tear the
    // interval down and rebuild it each time. The effect only needs to re-run
    // when the round it is waiting for changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine?.lastRound, engine?.minInterval, now >= (engine?.lastRound ?? 0) + (engine?.minInterval ?? 0), refresh]);

  const mint = useCallback(
    async (tier) => {
      if (!wallet || !config) return;
      setBusy(tier.id);
      setError(null);
      try {
        // Core requires the asset address to sign its own creation, so each mint
        // needs a throwaway keypair. It is discarded immediately — the NFT
        // belongs to the minter, the account belongs to the Core program.
        const asset = Keypair.generate();

        const mintTx = new Transaction().add(
          mintDeskIx({
            minter: wallet,
            asset: asset.publicKey,
            collection: config.collection,
            treasury: config.treasury,
            tier: tier.id,
          }),
        );
        // The asset keypair rides along as an extra signer: Core requires the
        // new address to sign its own creation, and the wallet cannot do that
        // for a key it has never seen.
        const sig = await sendTransaction(mintTx, connection, { signers: [asset] });
        await connection.confirmTransaction(sig, 'confirmed');
        say(`minted ${tier.name} Desk · ${sig}`);

        // Registering is what puts the desk into the allocation engine.
        if (engine) {
          const regSig = await sendTransaction(
            new Transaction().add(
              registerDeskIx({ payer: wallet, asset: asset.publicKey }),
            ),
            connection,
          );
          await connection.confirmTransaction(regSig, 'confirmed');
          say(`registered · weight ${tier.weight}`);
        }

        // Everything the success dialog needs, read straight off the asset
        // rather than waiting for the collection scan below to catch up —
        // getProgramAccounts lags a confirmed transaction by a second or two and
        // the dialog should open the moment the mint lands.
        let name = `${tier.name} Desk`;
        try {
          const info = await connection.getAccountInfo(asset.publicKey);
          const decoded = info && decodeCoreAsset(asset.publicKey, info.data);
          if (decoded?.name) name = decoded.name;
        } catch {
          // Keep the tier name: a missed read should not cost the celebration.
        }
        setJustMinted({
          asset: asset.publicKey,
          vault: vaultPda(asset.publicKey),
          tier,
          name,
        });

        // getProgramAccounts lags a confirmed transaction by a second or two.
        const before = desks.length;
        for (let attempt = 0; attempt < 6; attempt++) {
          const count = await refresh();
          if (count === null || count > before) break;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (e) {
        const logs = e.logs ? `\n${e.logs.slice(-6).join('\n')}` : '';
        setError(`${e.message}${logs}`);
      } finally {
        setBusy(null);
      }
    },
    [wallet, config, engine, desks.length, refresh],
  );

  /// Move tokens out of one desk's vault into the wallet that holds it.
  ///
  /// `picks` is `[{ mint, raw }]`, raw being base units as a decimal string.
  /// Nothing of ours authorises this: Core checks that the signer owns the NFT
  /// and then signs as the vault. See `sweepIx`.
  const sweep = useCallback(
    async (desk, picks) => {
      if (!wallet || !config || !picks.length) return;
      setBusy('sweep');
      setError(null);
      try {
        const owner = wallet;
        const mints = picks.map((p) => new PublicKey(p.mint));
        const atas = mints.map((m) => ataFor(m, owner));

        // Create only the destination accounts that are actually missing. The
        // idempotent create is safe to repeat, but ten of them will not fit in
        // a transaction alongside ten Executes.
        const existing = await connection.getMultipleAccountsInfo(atas);

        // Five stocks per transaction, so a full ten-stock sweep is two
        // signatures rather than four. Each stock adds a mint, a source and a
        // destination to the account table, and all ten at once overrun the
        // 1232-byte limit on the key list alone. Measured at the worst case —
        // every destination account missing, so a create rides along with each
        // sweep — five comes to 1033 bytes and six would leave no margin.
        const PER_TX = 5;
        for (let i = 0; i < picks.length; i += PER_TX) {
          const tx = new Transaction();
          for (let j = i; j < Math.min(i + PER_TX, picks.length); j++) {
            if (!existing[j]) {
              tx.add(createAtaIdempotentIx({ payer: owner, owner, mint: mints[j] }));
            }
            tx.add(
              sweepIx({
                asset: desk.address,
                collection: config.collection,
                owner,
                mint: mints[j],
                amount: picks[j].raw,
                decimals: chainCfg.decimals,
              }),
            );
          }
          const sig = await sendTransaction(tx, connection);
          await connection.confirmTransaction(sig, 'confirmed');
          say(`swept ${Math.min(i + PER_TX, picks.length)}/${picks.length} · ${sig}`);
        }

        // The vault balances the page is showing are now stale, and they are
        // cached per vault, so drop this one rather than waiting for a reload.
        setVaultHoldings((prev) => {
          const next = { ...prev };
          delete next[desk.vault.toBase58()];
          return next;
        });
        await refresh();
      } catch (e) {
        const logs = e.logs ? `\n${e.logs.slice(-6).join('\n')}` : '';
        setError(`${e.message}${logs}`);
      } finally {
        setBusy(null);
      }
    },
    [wallet, config, refresh],
  );

  return {
    wallet, balance, config, engine, desks, minted, tickers, busy, log, error, now, mint,
    vaultHoldings, loadHoldings, sweep,
    justMinted, clearMinted: () => setJustMinted(null),
    // Wallet controls, passed through so the nav button does not have to reach
    // for the adapter separately and end up with a different idea of the state.
    connected, connect, disconnect, select, wallets,
  };
}

