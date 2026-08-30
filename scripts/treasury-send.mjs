// Move a project wallet's SOL out to a wallet you control.
//
//   node scripts/treasury-send.mjs <address>                  # treasury, dry run
//   node scripts/treasury-send.mjs <address> --from pot       # pot, dry run
//   node scripts/treasury-send.mjs <address> --send           # actually transfers
//
// For running the buyback and burn by hand instead of on the cron. The treasury
// fills itself from every mint, so this is the tap.
//
// Leaves a little behind: an account drained to exactly zero cannot pay the fee
// on its own next transaction, and topping it up again to move dust is a silly
// place to end up.

import fs from 'node:fs';
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL,
} from '@solana/web3.js';

function loadEnvLocal() {
  try {
    for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* no file, use the real environment */ }
}
loadEnvLocal();

const args = process.argv.slice(2);
const SEND = args.includes('--send');
const fromIdx = args.indexOf('--from');
// The `fromIdx >= 0` guard matters: with no --from, indexOf returns -1 and
// -1 + 1 is 0 — which is exactly where the address sits, so the destination
// was being skipped and every plain run printed the usage line.
const destination = args.find(
  (a, i) => !a.startsWith('--') && !(fromIdx >= 0 && i === fromIdx + 1),
);

const RPC = process.env.HELIUS_RPC ?? process.env.RPC ?? 'https://api.mainnet-beta.solana.com';
const KEEP_SOL = Number(process.env.TREASURY_KEEP_SOL ?? 0.002);

const log = (...a) => process.stdout.write(`${a.join(' ')}\n`);

if (!destination) {
  log('usage: node scripts/treasury-send.mjs <address> [--send]');
  process.exit(1);
}

let to;
try {
  to = new PublicKey(destination);
} catch {
  log(`not a valid address: ${destination}`);
  process.exit(1);
}

/// Which wallet to drain. Named rather than a file path so a typo cannot
/// silently reach for the upgrade authority.
const FROM = { treasury: 'treasury-wallet.json', pot: 'pot-wallet.json' };
// Same -1 guard as above: without it this read the destination address as the
// wallet name and rejected every plain run.
const which = (fromIdx >= 0 ? (args[fromIdx + 1] ?? '') : 'treasury').toLowerCase();
const keyFile = FROM[which];
if (!keyFile) {
  log(`--from must be one of: ${Object.keys(FROM).join(', ')}`);
  process.exit(1);
}

const envKey = which === 'treasury' ? process.env.TREASURY_SECRET : process.env.POT_SECRET;
const treasury = Keypair.fromSecretKey(
  Uint8Array.from(envKey ? JSON.parse(envKey) : JSON.parse(fs.readFileSync(keyFile, 'utf8'))),
);

const connection = new Connection(RPC, 'confirmed');

async function main() {
  const lamports = await connection.getBalance(treasury.publicKey);
  const keep = Math.floor(KEEP_SOL * LAMPORTS_PER_SOL);
  // The fee comes out of the sender, so it has to be left behind too.
  const fee = 5000;
  const amount = lamports - keep - fee;

  log(`from      ${which}  ${treasury.publicKey.toBase58()}`);
  log(`to        ${to.toBase58()}`);
  log(`balance   ${(lamports / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (amount <= 0) {
    log(`\nNothing to send after keeping ${KEEP_SOL} SOL for fees.`);
    return;
  }
  log(`sending   ${(amount / LAMPORTS_PER_SOL).toFixed(4)} SOL  (keeping ${KEEP_SOL} for fees)`);

  if (!SEND) {
    log('\nDry run. Add --send to transfer.');
    return;
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: to,
      lamports: amount,
    }),
  );
  tx.feePayer = treasury.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(treasury);

  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  log(`\nsent      ${sig}`);
}

main().catch((e) => {
  log(`error: ${e.message}`);
  process.exit(1);
});
