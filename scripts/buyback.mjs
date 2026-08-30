// Treasury buyback and burn.
//
// Takes the SOL that mint payments have accumulated in the treasury, swaps it
// for the project token, and burns what it bought.
//
//   node scripts/buyback.mjs           # dry run — quotes and prints, sends nothing
//   node scripts/buyback.mjs --send    # signs and submits
//
// Dry run is the default deliberately: this spends real money, and a script
// that moves funds the first time you run it by accident is a bad script.
//
// With no token configured it does nothing but report the balance. That is the
// intended behaviour before the token exists — the treasury simply holds, and
// the same command starts buying the day `tokenMint` is filled in.

import fs from 'node:fs';
import {
  Connection, Keypair, PublicKey, Transaction, TransactionInstruction,
  VersionedTransaction, LAMPORTS_PER_SOL,
} from '@solana/web3.js';

const SEND = process.argv.includes('--send');
const RPC = process.env.HELIUS_RPC
  ?? process.env.RPC
  ?? 'https://api.mainnet-beta.solana.com';

const WSOL = 'So11111111111111111111111111111111111111112';
const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022 = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const ATA_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

/// Left behind for rent and fees. Swapping the account to zero would make the
/// next run fail on fees before it could do anything about it.
const KEEP_SOL = Number(process.env.BUYBACK_KEEP_SOL ?? 0.02);
/// Below this it is not worth the fees and slippage.
const MIN_SOL = Number(process.env.BUYBACK_MIN_SOL ?? 0.05);
const SLIPPAGE_BPS = Number(process.env.BUYBACK_SLIPPAGE_BPS ?? 300);

const deploy = JSON.parse(fs.readFileSync('public/deploy.mainnet.json', 'utf8'));
const treasury = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('treasury-wallet.json', 'utf8'))),
);

const connection = new Connection(RPC, 'confirmed');
const log = (...a) => process.stdout.write(`${a.join(' ')}\n`);

const ataFor = (mint, owner, program = TOKEN_PROGRAM) =>
  PublicKey.findProgramAddressSync(
    [owner.toBuffer(), program.toBuffer(), new PublicKey(mint).toBuffer()],
    ATA_PROGRAM,
  )[0];

/// SPL Token `Burn`: discriminator 8, then the amount as u64.
function burnIx({ account, mint, owner, amount, program }) {
  const data = Buffer.alloc(9);
  data.writeUInt8(8, 0);
  data.writeBigUInt64LE(BigInt(amount), 1);
  return new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: new PublicKey(mint), isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  });
}

async function main() {
  log(`treasury  ${treasury.publicKey.toBase58()}`);
  log(`rpc       ${RPC.replace(/api-key=.*/, 'api-key=***')}`);

  const lamports = await connection.getBalance(treasury.publicKey);
  const sol = lamports / LAMPORTS_PER_SOL;
  log(`balance   ${sol} SOL`);

  const tokenMint = deploy.tokenMint || null;
  if (!tokenMint) {
    log('\nNo tokenMint in public/deploy.mainnet.json — holding.');
    log('Fill it in and re-run; the SOL accumulated so far is bought then.');
    return;
  }
  log(`token     ${tokenMint}`);

  const spend = sol - KEEP_SOL;
  if (spend < MIN_SOL) {
    log(`\nOnly ${spend.toFixed(4)} SOL spendable (keeping ${KEEP_SOL}); minimum is ${MIN_SOL}. Nothing to do.`);
    return;
  }

  const inLamports = Math.floor(spend * LAMPORTS_PER_SOL);
  log(`\nswapping  ${(inLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL -> token`);

  const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${WSOL}`
    + `&outputMint=${tokenMint}&amount=${inLamports}&slippageBps=${SLIPPAGE_BPS}`;
  const quote = await fetch(quoteUrl).then((r) => r.json());
  if (!quote?.outAmount) {
    log(`quote failed: ${JSON.stringify(quote).slice(0, 300)}`);
    process.exit(1);
  }
  log(`quote     ${quote.outAmount} base units out, impact ${quote.priceImpactPct ?? '?'}%`);

  if (!SEND) {
    log('\nDry run. Pass --send to swap and burn.');
    return;
  }

  const swapRes = await fetch('https://lite-api.jup.ag/swap/v1/swap', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: treasury.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  }).then((r) => r.json());

  if (!swapRes?.swapTransaction) {
    log(`swap build failed: ${JSON.stringify(swapRes).slice(0, 300)}`);
    process.exit(1);
  }

  const tx = VersionedTransaction.deserialize(Buffer.from(swapRes.swapTransaction, 'base64'));
  tx.sign([treasury]);
  const swapSig = await connection.sendTransaction(tx, { maxRetries: 3 });
  await connection.confirmTransaction(swapSig, 'confirmed');
  log(`swapped   ${swapSig}`);

  // Burn whatever actually arrived, rather than the quoted amount — slippage
  // means those differ, and burning the quote would either leave dust or fail.
  const mintInfo = await connection.getAccountInfo(new PublicKey(tokenMint));
  const program = mintInfo?.owner?.equals(TOKEN_2022) ? TOKEN_2022 : TOKEN_PROGRAM;
  const tokenAta = ataFor(tokenMint, treasury.publicKey, program);
  const bal = await connection.getTokenAccountBalance(tokenAta);
  const amount = BigInt(bal.value.amount);
  if (amount === 0n) {
    log('nothing arrived to burn');
    return;
  }

  const burnTx = new Transaction().add(
    burnIx({
      account: tokenAta,
      mint: tokenMint,
      owner: treasury.publicKey,
      amount,
      program,
    }),
  );
  burnTx.feePayer = treasury.publicKey;
  burnTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  burnTx.sign(treasury);
  const burnSig = await connection.sendRawTransaction(burnTx.serialize());
  await connection.confirmTransaction(burnSig, 'confirmed');

  log(`burned    ${bal.value.uiAmountString} tokens · ${burnSig}`);
}

main().catch((e) => {
  log(`error: ${e.message}`);
  process.exit(1);
});
