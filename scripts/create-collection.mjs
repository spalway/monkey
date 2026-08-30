// Creates the Metaplex Core collection every desk is minted into.
//
// The collection's update authority is the program's ["config"] PDA, which is
// what lets `mint_desk` sign the Core CPI — and what stops anyone else minting
// into the collection. Run this once, before `npm run init`.

import { createSignerFromKeypair, publicKey, signerIdentity } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createCollection, ruleSet } from '@metaplex-foundation/mpl-core';
import { configPda } from '../src/primates.js';
import { config, deployment, rpcUrl, saveDeployment, treasury, wallet } from './shared.mjs';

const payer = wallet();
const existing = deployment().collection;

if (existing) {
  console.log('Collection already created:', existing);
  console.log('Delete the "collection" key in public/deploy.json to make a new one.');
  process.exit(0);
}

const umi = createUmi(rpcUrl());
const signer = createSignerFromKeypair(umi, umi.eddsa.createKeypairFromSecretKey(payer.secretKey));
umi.use(signerIdentity(signer));

const collection = umi.eddsa.generateKeypair();
const authority = configPda();

console.log('Creating collection...');
console.log('  name           ', config.collectionName);
console.log('  address        ', collection.publicKey);
console.log('  updateAuthority', authority.toBase58(), '(config PDA)');
console.log('  royalties      ', `${config.royaltyBasisPoints / 100}% -> ${treasury()}`);

await createCollection(umi, {
  collection: createSignerFromKeypair(umi, collection),
  name: config.collectionName,
  uri: `${config.uriBase}/collection.json`,
  updateAuthority: publicKey(authority.toBase58()),
  plugins: [
    {
      type: 'Royalties',
      basisPoints: config.royaltyBasisPoints,
      creators: [{ address: publicKey(treasury()), percentage: 100 }],
      ruleSet: ruleSet('None'),
    },
  ],
}).sendAndConfirm(umi);

saveDeployment({ collection: collection.publicKey, treasury: treasury() });

console.log('');
console.log('Done. Next: npm run init');
