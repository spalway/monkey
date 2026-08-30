// Creates ten mock stock mints on devnet and writes them into deploy.json.
//
// xStocks are mainnet-only — Backed Finance has no devnet deployment — so there
// is nothing real to buy here. These stand in for the rotation so the whole
// allocation loop is testable end to end. On mainnet, swap this file out for the
// real xStock mint addresses; nothing else changes.

import {
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { connection, deployment, saveDeployment, wallet } from './shared.mjs';

const TICKERS = [
  'AAPLx', 'MSFTx', 'NVDAx', 'AMZNx', 'METAx',
  'GOOGLx', 'TSLAx', 'SPYx', 'COINx', 'AVGOx',
];

const DECIMALS = 6;

const payer = wallet();
const conn = connection();

if (deployment().stocks) {
  console.log('Stocks already created:');
  for (const [ticker, mint] of Object.entries(deployment().stocks)) {
    console.log(`  ${ticker.padEnd(7)} ${mint}`);
  }
  console.log('\nDelete the "stocks" key in public/deploy.json to make new ones.');
  process.exit(0);
}

const rent = await getMinimumBalanceForRentExemptMint(conn);
const stocks = {};

// Four mints per transaction keeps us well inside the size limit.
for (let batch = 0; batch < TICKERS.length; batch += 4) {
  const slice = TICKERS.slice(batch, batch + 4);
  const keypairs = slice.map(() => Keypair.generate());
  const tx = new Transaction();

  slice.forEach((ticker, i) => {
    const mint = keypairs[i].publicKey;
    tx.add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint,
        space: MINT_SIZE,
        lamports: rent,
        programId: TOKEN_PROGRAM_ID,
      }),
      // Mint authority stays with the controller wallet: on devnet the "buy"
      // step mints tokens instead of swapping for them.
      createInitializeMint2Instruction(mint, DECIMALS, payer.publicKey, null),
    );
    stocks[ticker] = mint.toBase58();
  });

  const sig = await sendAndConfirmTransaction(conn, tx, [payer, ...keypairs], {
    commitment: 'confirmed',
  });
  console.log(`created ${slice.join(', ')}  ${sig.slice(0, 16)}…`);
}

saveDeployment({ stocks, stockDecimals: DECIMALS });

console.log('');
for (const [ticker, mint] of Object.entries(stocks)) {
  console.log(`  ${ticker.padEnd(7)} ${mint}`);
}
console.log('\nNext: npm run engine');
