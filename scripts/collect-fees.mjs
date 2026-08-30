// Sweeps pump.fun creator fees. MAINNET ONLY — pump.fun has no devnet presence.
//
// Dry run unless you pass --send. Nothing here moves money without that flag.
//
// Two modes, set as `pump.mode` in primates.config.json:
//
//   "collect"  The creator wallet signs and sweeps its own fees to itself.
//              Simple, works today, but the 20/80 split then happens off-chain
//              in a wallet we control — holders have to trust us for it.
//
//   "share"    pump.fun splits the fees itself. A one-time fee-sharing config
//              names the protocol wallet and the pot as shareholders with fixed
//              shares, after which `distribute` is PERMISSIONLESS — anyone can
//              crank it and the money lands in both places directly. No creator
//              key in the loop, and the split is enforced on-chain.
//
// "share" is the one to run in production. See README.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import pumpSdk from '@pump-fun/pump-sdk';
import { config, root } from './shared.mjs';

const { OnlinePumpSdk, PumpSdk, feeSharingConfigPda } = pumpSdk;

const SEND = process.argv.includes('--send');
const pump = config.pump ?? {};

if (!pump.mint || !pump.creator) {
  console.error('Set pump.mint and pump.creator in primates.config.json first.');
  console.error('Both are mainnet values — there is no pump.fun on devnet.');
  process.exit(1);
}

const conn = new Connection(pump.rpc ?? 'https://api.mainnet-beta.solana.com', 'confirmed');
const online = new OnlinePumpSdk(conn);
const offline = new PumpSdk();

const mint = new PublicKey(pump.mint);
const creator = new PublicKey(pump.creator);

const sol = (lamports) => `${(Number(lamports) / LAMPORTS_PER_SOL).toFixed(6)} SOL`;

function creatorWallet() {
  const path = resolve(root, 'creator-wallet.json');
  if (!existsSync(path)) {
    throw new Error(
      'creator-wallet.json missing. It must hold the pump.fun deployer key ' +
        'that created the token. Never commit it.',
    );
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, 'utf8'))));
}

async function send(instructions, signers, label) {
  if (!SEND) {
    console.log(`  DRY RUN — would send ${instructions.length} ix (${label})`);
    console.log('  re-run with --send to execute');
    return null;
  }
  const sig = await sendAndConfirmTransaction(
    conn,
    new Transaction().add(...instructions),
    signers,
    { commitment: 'confirmed' },
  );
  console.log(`  sent: https://solscan.io/tx/${sig}`);
  return sig;
}

// -------------------------------------------------------------------- modes

/// Creator signs, fees land in the creator wallet. Covers both the bonding
/// curve vault (native SOL) and the AMM vault (WSOL) in one transaction.
async function collect() {
  const wallet = creatorWallet();
  if (!wallet.publicKey.equals(creator)) {
    throw new Error(
      `creator-wallet.json is ${wallet.publicKey.toBase58()} but pump.creator is ${creator.toBase58()}`,
    );
  }

  const instructions = await online.collectCoinCreatorFeeInstructions(
    creator,
    wallet.publicKey,
  );
  console.log(`  ${instructions.length} instructions (bonding curve + AMM)`);
  await send(instructions, [wallet], 'collect');
}

/// Permissionless. Fees go straight to the shareholders named in the sharing
/// config — no creator signature, and the split is not ours to get wrong.
async function distribute() {
  const sharingConfigAddress = feeSharingConfigPda(mint);
  const account = await conn.getAccountInfo(sharingConfigAddress);
  if (!account) {
    console.error('  No fee-sharing config for this mint.');
    console.error('  Run `npm run fees -- --setup --send` once, from the creator wallet.');
    process.exit(1);
  }

  const minimum = await online.getMinimumDistributableFee(mint);
  console.log(`  minimum distributable: ${sol(minimum)}`);

  const sharingConfig = await online.fetchFeeSharingConfig?.(mint);
  const instruction = await offline.distributeCreatorFees({
    mint,
    sharingConfig,
    sharingConfigAddress,
  });
  await send([instruction], [creatorWallet()], 'distribute');
}

// ---------------------------------------------------------------------- run

console.log('pump.fun creator fees');
console.log('  mint    ', mint.toBase58());
console.log('  creator ', creator.toBase58());
console.log('  mode    ', pump.mode ?? 'collect');
console.log('  network ', pump.rpc ?? 'mainnet-beta');

const accrued = await online.getCreatorVaultBalanceBothPrograms(creator);
console.log('  accrued ', sol(accrued.toString()));

const floor = (pump.minSweepSol ?? 0.05) * LAMPORTS_PER_SOL;
if (Number(accrued.toString()) < floor) {
  console.log(`  below the ${pump.minSweepSol ?? 0.05} SOL sweep floor — nothing to do`);
  process.exit(0);
}

if ((pump.mode ?? 'collect') === 'share') {
  await distribute();
} else {
  await collect();
}
