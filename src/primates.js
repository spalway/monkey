// Shared client for the Primates program. Used by both the setup scripts and
// the web page.
//
// The instructions are hand-encoded rather than driven off the Anchor IDL: the
// CLI is anchor 1.1.2 but the newest @coral-xyz/anchor on npm is 0.32.1, and a
// silent IDL-format mismatch is a far worse thing to debug than forty lines of
// Buffer writes. Discriminators below are sha256("global:<name>")[0..8].

import { Buffer } from 'buffer';
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('CGcSojUL6xeXatcZ9RDzrqUqSucVnAR83fjv7KTrgJrm');
export const MPL_CORE_PROGRAM_ID = new PublicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d');

export const TIERS = [
  { id: 0, name: "Monkey", slug: "monkey", weight: 1, blurb: "One terminal. The entry desk." },
  { id: 1, name: "Ape", slug: "ape", weight: 3, blurb: "Three terminals. The standard desk." },
  { id: 2, name: "Kong", slug: "kong", weight: 9, blurb: "Six terminals. Only 100 exist." },
];

const DISCRIMINATORS = {
  initialize: [175, 175, 109, 31, 13, 152, 155, 237],
  setConfig: [108, 158, 154, 175, 212, 98, 52, 66],
  mintDesk: [13, 78, 211, 198, 47, 173, 187, 207],
};

export function configPda() {
  return PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID)[0];
}

/// Every Core asset has a signer PDA that only its current owner can spend
/// from. That is the desk's vault — we derive it, we never store it.
export function vaultPda(asset) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('mpl-core-execute'), new PublicKey(asset).toBuffer()],
    MPL_CORE_PROGRAM_ID,
  )[0];
}

// ---------------------------------------------------------------- encoding

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}

function u64(n) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
}

function borshString(s) {
  const bytes = Buffer.from(s, 'utf8');
  return Buffer.concat([u32(bytes.length), bytes]);
}

// ------------------------------------------------------------ instructions

export function initializeIx({
  authority,
  collection,
  treasury,
  prices,
  supply,
  uriBase,
}) {
  const data = Buffer.concat([
    Buffer.from(DISCRIMINATORS.initialize),
    new PublicKey(collection).toBuffer(),
    new PublicKey(treasury).toBuffer(),
    ...prices.map(u64),
    ...supply.map(u32),
    borshString(uriBase),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: configPda(), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function mintDeskIx({ minter, asset, collection, treasury, tier }) {
  const data = Buffer.concat([
    Buffer.from(DISCRIMINATORS.mintDesk),
    Buffer.from([tier]),
  ]);

  // Order must match the MintDesk accounts struct in the program.
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: minter, isSigner: true, isWritable: true },
      { pubkey: configPda(), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(collection), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(asset), isSigner: true, isWritable: true },
      { pubkey: new PublicKey(treasury), isSigner: false, isWritable: true },
      { pubkey: MPL_CORE_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

// ---------------------------------------------------------------- decoding

/// Layout: 8 discriminator, 3x pubkey, 3x u64 prices, 3x u32 supply,
/// 3x u32 minted, borsh string, u8 bump.
export function decodeConfig(data) {
  let o = 8;
  const pubkey = () => {
    const k = new PublicKey(data.subarray(o, o + 32));
    o += 32;
    return k;
  };
  const readU64 = () => {
    const v = Buffer.from(data.subarray(o, o + 8)).readBigUInt64LE();
    o += 8;
    return v;
  };
  const readU32 = () => {
    const v = Buffer.from(data.subarray(o, o + 4)).readUInt32LE();
    o += 4;
    return v;
  };

  const authority = pubkey();
  const collection = pubkey();
  const treasury = pubkey();
  const prices = [readU64(), readU64(), readU64()];
  const supply = [readU32(), readU32(), readU32()];
  const minted = [readU32(), readU32(), readU32()];
  const uriLen = readU32();
  const uriBase = Buffer.from(data.subarray(o, o + uriLen)).toString('utf8');
  o += uriLen;
  const bump = data[o];

  return { authority, collection, treasury, prices, supply, minted, uriBase, bump };
}

/// Decode the fixed head of a Core `AssetV1` account.
///
/// Layout: u8 key (1 = AssetV1), pubkey owner, UpdateAuthority enum
/// (0 None | 1 Address+32 | 2 Collection+32), borsh string name, borsh string uri.
/// Anything past the uri is the plugin registry, which we do not need — the
/// tier is recoverable from the name.
export function decodeCoreAsset(address, data) {
  if (data[0] !== 1) return null;

  let o = 1;
  const owner = new PublicKey(data.subarray(o, o + 32));
  o += 32;

  const authorityKind = data[o];
  o += 1;
  let updateAuthority = null;
  if (authorityKind === 1 || authorityKind === 2) {
    updateAuthority = new PublicKey(data.subarray(o, o + 32));
    o += 32;
  }

  const readString = () => {
    const len = Buffer.from(data.subarray(o, o + 4)).readUInt32LE();
    o += 4;
    const s = Buffer.from(data.subarray(o, o + len)).toString('utf8');
    o += len;
    return s;
  };

  const name = readString();
  const uri = readString();
  const tier = TIERS.find((t) => name.startsWith(t.name)) ?? null;

  return {
    address: new PublicKey(address),
    owner,
    updateAuthority,
    inCollection: authorityKind === 2,
    name,
    uri,
    tier,
    vault: vaultPda(address),
  };
}

/// All desks in our collection owned by `owner`.
///
/// Filters on the Core program by key byte and owner, which is selective enough
/// that public devnet RPC will serve it. If a provider ever refuses the scan,
/// swap this one function for a DAS `getAssetsByOwner` call.
export async function fetchDesks(connection, owner, collection) {
  const accounts = await connection.getProgramAccounts(MPL_CORE_PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: '2' } }, // base58 of [1] = Key::AssetV1
      { memcmp: { offset: 1, bytes: new PublicKey(owner).toBase58() } },
    ],
  });

  return accounts
    .map(({ pubkey, account }) => decodeCoreAsset(pubkey, account.data))
    .filter((a) => a && a.inCollection && a.updateAuthority.equals(new PublicKey(collection)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ------------------------------------------------------------- drop engine

export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

/// Token-2022. Mainnet xStocks are all issued under it, the devnet mocks are
/// classic SPL Token, and the two have different program ids — so an
/// instruction built for one fails account validation against the other. Every
/// builder below takes the program rather than assuming, and the caller reads
/// it out of deploy.json. The on-chain program already accepts either: its
/// accounts are  over , not .
/// Token-2022. Mainnet xStocks are all issued under it; the devnet mocks are
/// classic SPL Token. The two have different program ids, so an instruction
/// built for one fails account validation against the other — and the
/// associated-token address is derived from the program id too, so even the
/// account it points at would be wrong.
///
/// Every builder below therefore takes the program instead of assuming it, and
/// callers read it from deploy.json. The on-chain program already accepts
/// either: its accounts are InterfaceAccount over TokenInterface, not
/// Program<Token>.
export const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

/// Stocks in the rotation. Fixed at 10 in the program.
export const ROTATION_LEN = 10;

/// Fixed-point scale for the per-weight accumulator. Must match the program.
export const ACC_SCALE = 10n ** 12n;

const ENGINE_DISCRIMINATORS = {
  initEngine: [253, 71, 163, 152, 77, 21, 254, 42],
  registerDesk: [96, 61, 156, 237, 24, 68, 209, 89],
  runRound: [82, 55, 203, 200, 140, 117, 4, 81],
  settle: [175, 42, 185, 87, 144, 131, 102, 212],
  closeDesk: [56, 128, 16, 111, 210, 111, 3, 107],
};

/// base58 of the Desk account discriminator, for getProgramAccounts filters.
export const DESK_ACCOUNT_FILTER = "6YE18V3xW24";

export function enginePda() {
  return PublicKey.findProgramAddressSync([Buffer.from('engine')], PROGRAM_ID)[0];
}

export function deskPda(asset) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('desk'), new PublicKey(asset).toBuffer()],
    PROGRAM_ID,
  )[0];
}

/// ATAs here are always for PDA owners (the engine, and each desk's vault), so
/// the off-curve path is the normal case rather than the exception.
export function ataFor(mint, owner, tokenProgram = TOKEN_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(
    [
      new PublicKey(owner).toBuffer(),
      new PublicKey(tokenProgram).toBuffer(),
      new PublicKey(mint).toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

export function initEngineIx({ authority, rotation, minInterval, dustFloor }) {
  if (rotation.length !== ROTATION_LEN) {
    throw new Error(`rotation must hold exactly ${ROTATION_LEN} mints`);
  }
  const interval = Buffer.alloc(8);
  interval.writeBigInt64LE(BigInt(minInterval));

  const data = Buffer.concat([
    Buffer.from(ENGINE_DISCRIMINATORS.initEngine),
    ...rotation.map((m) => new PublicKey(m).toBuffer()),
    interval,
    u64(dustFloor),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: enginePda(), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function registerDeskIx({ payer, asset }) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: configPda(), isSigner: false, isWritable: false },
      { pubkey: enginePda(), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(asset), isSigner: false, isWritable: false },
      { pubkey: deskPda(asset), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(ENGINE_DISCRIMINATORS.registerDesk),
  });
}

export function runRoundIx({ cranker, stockMint, tokenProgram = TOKEN_PROGRAM_ID }) {
  const engine = enginePda();
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: cranker, isSigner: true, isWritable: false },
      { pubkey: engine, isSigner: false, isWritable: true },
      { pubkey: new PublicKey(stockMint), isSigner: false, isWritable: false },
      { pubkey: ataFor(stockMint, engine, tokenProgram), isSigner: false, isWritable: false },
      // Last, matching the RunRound accounts struct. The program needs it to
      // derive the associated-token address the same way this client just did.
      { pubkey: new PublicKey(tokenProgram), isSigner: false, isWritable: false },
    ],
    data: Buffer.from(ENGINE_DISCRIMINATORS.runRound),
  });
}

export function settleIx({ cranker, asset, stockMint, tokenProgram = TOKEN_PROGRAM_ID }) {
  const engine = enginePda();
  const vault = vaultPda(asset);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: cranker, isSigner: true, isWritable: true },
      { pubkey: engine, isSigner: false, isWritable: true },
      { pubkey: deskPda(asset), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(stockMint), isSigner: false, isWritable: false },
      { pubkey: ataFor(stockMint, engine, tokenProgram), isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: false },
      { pubkey: ataFor(stockMint, vault, tokenProgram), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(tokenProgram), isSigner: false, isWritable: false },
    ],
    data: Buffer.from(ENGINE_DISCRIMINATORS.settle),
  });
}

// ----------------------------------------------------- engine account decode

function readerFor(data) {
  let o = 8;
  return {
    pubkey: () => {
      const k = new PublicKey(data.subarray(o, o + 32));
      o += 32;
      return k;
    },
    u128: () => {
      let v = 0n;
      for (let i = 15; i >= 0; i--) v = (v << 8n) | BigInt(data[o + i]);
      o += 16;
      return v;
    },
    u64: () => {
      const v = Buffer.from(data.subarray(o, o + 8)).readBigUInt64LE();
      o += 8;
      return v;
    },
    i64: () => {
      const v = Buffer.from(data.subarray(o, o + 8)).readBigInt64LE();
      o += 8;
      return v;
    },
    u32: () => {
      const v = Buffer.from(data.subarray(o, o + 4)).readUInt32LE();
      o += 4;
      return v;
    },
    u8: () => data[o++],
  };
}

export function decodeEngine(data) {
  const r = readerFor(data);
  const times = (n, fn) => Array.from({ length: n }, fn);

  const authority = r.pubkey();
  const rotation = times(ROTATION_LEN, r.pubkey);
  const accPerWeight = times(ROTATION_LEN, r.u128);
  const outstanding = times(ROTATION_LEN, r.u64);
  const totalWeight = r.u64();
  const cursor = r.u8();
  const lastRound = r.i64();
  const minInterval = r.i64();
  const dustFloor = r.u64();
  const bump = r.u8();

  return {
    authority,
    rotation,
    accPerWeight,
    outstanding,
    totalWeight,
    cursor,
    lastRound,
    minInterval,
    dustFloor,
    bump,
  };
}

export function decodeDesk(data) {
  const r = readerFor(data);
  const asset = r.pubkey();
  const weight = r.u32();
  const stamp = Array.from({ length: ROTATION_LEN }, r.u128);
  return { asset, weight, stamp, bump: r.u8() };
}

/// What a desk is owed for each rotation slot, undelivered.
///
/// This is the same arithmetic the program runs in `settle`, so the UI can show
/// a desk's position without anybody having cranked anything.
export function owedFor(engine, desk) {
  return engine.accPerWeight.map((acc, slot) => {
    const delta = acc > desk.stamp[slot] ? acc - desk.stamp[slot] : 0n;
    return (delta * BigInt(desk.weight)) / ACC_SCALE;
  });
}

/// Borsh `Option<T>`: a 0 byte for None, or a 1 byte followed by the value.
function option(value, encode) {
  return value === null || value === undefined
    ? Buffer.from([0])
    : Buffer.concat([Buffer.from([1]), encode(value)]);
}

export function setConfigIx({ authority, treasury, prices, supply, uriBase }) {
  const data = Buffer.concat([
    Buffer.from(DISCRIMINATORS.setConfig),
    option(treasury, (t) => new PublicKey(t).toBuffer()),
    option(prices, (p) => Buffer.concat(p.map(u64))),
    option(supply, (s) => Buffer.concat(s.map(u32))),
    option(uriBase, borshString),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: configPda(), isSigner: false, isWritable: true },
    ],
    data,
  });
}

export function closeDeskIx({ authority, asset }) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: enginePda(), isSigner: false, isWritable: true },
      { pubkey: deskPda(asset), isSigner: false, isWritable: true },
    ],
    data: Buffer.from(ENGINE_DISCRIMINATORS.closeDesk),
  });
}


/// Desk PDAs for many assets in one call.
export async function fetchDeskStates(connection, assets) {
  if (!assets.length) return new Map();
  const accounts = await connection.getMultipleAccountsInfo(assets.map(deskPda));
  return new Map(
    assets.map((asset, i) => [
      asset.toBase58(),
      accounts[i] ? decodeDesk(accounts[i].data) : null,
    ]),
  );
}

/// Every vault's balance of every rotation stock, in a single RPC call.
///
/// Deliberately not `getParsedTokenAccountsByOwner` per vault — that is one
/// request per desk and public devnet RPC starts returning 429 well before it
/// scales. Deriving the ATAs lets the whole grid go in one
/// `getMultipleAccountsInfo` (capped at 100 addresses, so 10 desks x 10 stocks).
///
/// Token account layout: mint(32), owner(32), amount(u64 LE at offset 64).
export async function fetchHoldingsGrid(
  connection, vaults, mints, decimals = 6, tokenProgram = TOKEN_PROGRAM_ID,
) {
  if (!vaults.length || !mints.length) return new Map();

  // The associated-token address depends on the token program, so reading a
  // Token-2022 balance from a classic-derived address does not return zero — it
  // returns an account that does not exist, and every vault reads as empty.
  const pairs = [];
  for (const vault of vaults) {
    for (const mint of mints) pairs.push({ vault, mint, ata: ataFor(mint, vault, tokenProgram) });
  }

  const accounts = [];
  for (let i = 0; i < pairs.length; i += 100) {
    const slice = pairs.slice(i, i + 100).map((p) => p.ata);
    accounts.push(...(await connection.getMultipleAccountsInfo(slice)));
  }

  const grid = new Map(vaults.map((v) => [v.toBase58(), []]));
  pairs.forEach(({ vault, mint }, i) => {
    const account = accounts[i];
    if (!account) return;
    const raw = Buffer.from(account.data.subarray(64, 72)).readBigUInt64LE();
    if (raw === 0n) return;
    grid.get(vault.toBase58()).push({
      mint: mint.toBase58(),
      amount: Number(raw) / 10 ** decimals,
      // Base units as a decimal string. Sweeping percentages of a balance has
      // to be exact — 100% must empty the account — and neither the float above
      // nor a BigInt in React state can do that. Parsed back at the point the
      // instruction is built.
      raw: raw.toString(),
    });
  });

  return grid;
}

export function setEngineIx({ authority, minInterval, dustFloor }) {
  const i64 = (n) => {
    const b = Buffer.alloc(8);
    b.writeBigInt64LE(BigInt(n));
    return b;
  };

  const data = Buffer.concat([
    Buffer.from([66, 87, 78, 112, 218, 132, 52, 45]),
    option(minInterval, i64),
    option(dustFloor, u64),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: enginePda(), isSigner: false, isWritable: true },
    ],
    data,
  });
}

/// Every desk in the collection, whoever holds it.
///
/// Filtered entirely server-side: the key byte, the UpdateAuthority variant, and
/// the collection pubkey are all at fixed offsets in a Core asset, so the RPC
/// returns only our assets rather than every Core asset on the cluster.
///
/// Layout: key(1) owner(32) update-authority variant(1) pubkey(32).
export async function fetchCollectionDesks(connection, collection) {
  const accounts = await connection.getProgramAccounts(MPL_CORE_PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: '2' } }, // base58 of [1] = Key::AssetV1
      { memcmp: { offset: 33, bytes: '3' } }, // base58 of [2] = UpdateAuthority::Collection
      { memcmp: { offset: 34, bytes: new PublicKey(collection).toBase58() } },
    ],
  });

  return accounts
    .map(({ pubkey, account }) => decodeCoreAsset(pubkey, account.data))
    .filter(Boolean)
    .map((asset) => ({ ...asset, serial: serialOf(asset.name) }));
}

/// The number a desk was minted as, parsed off "<Tier> Desk #<n>".
///
/// Counters are per tier, so this is mint order within a tier and only an
/// approximation of it across the whole collection. Nothing in a Core asset
/// records when it was created, so a true global ordering needs a DAS index.
export function serialOf(name) {
  const match = /#(\d+)\s*$/.exec(name ?? '');
  return match ? Number(match[1]) : 0;
}

// ------------------------------------------------------------------- sweep
//
// Pulling tokens out of a vault needs no program of ours. Core's `ExecuteV1`
// lets the *current owner* of an asset make that asset's signer PDA sign one
// arbitrary instruction, and the signer PDA is the vault. So a sweep is a
// plain SPL transfer whose authority happens to be the vault, wrapped in
// Execute and authorised by the NFT.
//
// That is the whole point of deriving the vault instead of storing it: the
// right to spend it is ownership of the NFT, checked by Core, and it moves to
// the buyer the instant the desk sells.

const CORE_EXECUTE_DISCRIMINATOR = 31;
const TOKEN_TRANSFER_CHECKED = 12;

/// SPL Token `TransferChecked`. Checked rather than bare `Transfer` so a wrong
/// decimals or mint fails in the token program rather than moving the wrong
/// number of units.
export function transferCheckedIx({
  source, mint, destination, authority, amount, decimals, tokenProgram = TOKEN_PROGRAM_ID,
}) {
  const data = Buffer.alloc(10);
  data.writeUInt8(TOKEN_TRANSFER_CHECKED, 0);
  data.writeBigUInt64LE(BigInt(amount), 1);
  data.writeUInt8(decimals, 9);

  return new TransactionInstruction({
    programId: new PublicKey(tokenProgram),
    keys: [
      { pubkey: new PublicKey(source), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(mint), isSigner: false, isWritable: false },
      { pubkey: new PublicKey(destination), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(authority), isSigner: false, isWritable: false },
    ],
    data,
  });
}

/// Wrap one instruction so the asset's vault signs it.
///
/// Accounts 0-6 are fixed and the inner instruction's own accounts follow from
/// index 7. The vault is passed at index 2 *and* again among the inner
/// accounts; in both places it is marked non-signer, because no signature for
/// it exists — Core sets the signer flag itself when it invoke_signed's. Marking
/// it a signer here would make the transaction ask the wallet for a signature
/// nobody can produce.
export function coreExecuteIx({ asset, collection, owner, payer, inner }) {
  const length = Buffer.alloc(4);
  length.writeUInt32LE(inner.data.length);

  return new TransactionInstruction({
    programId: MPL_CORE_PROGRAM_ID,
    keys: [
      { pubkey: new PublicKey(asset), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(collection), isSigner: false, isWritable: true },
      { pubkey: vaultPda(asset), isSigner: false, isWritable: false },
      { pubkey: new PublicKey(payer ?? owner), isSigner: true, isWritable: true },
      { pubkey: new PublicKey(owner), isSigner: true, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(inner.programId), isSigner: false, isWritable: false },
      ...inner.keys.map((k) => ({ ...k, isSigner: false })),
    ],
    data: Buffer.concat([Buffer.from([CORE_EXECUTE_DISCRIMINATOR]), length, inner.data]),
  });
}

/// Move `amount` raw units of one stock from a desk's vault to its owner.
export function sweepIx({
  asset, collection, owner, mint, amount, decimals = 6, tokenProgram = TOKEN_PROGRAM_ID,
}) {
  const vault = vaultPda(asset);
  return coreExecuteIx({
    asset,
    collection,
    owner,
    inner: transferCheckedIx({
      source: ataFor(mint, vault, tokenProgram),
      mint,
      destination: ataFor(mint, owner, tokenProgram),
      authority: vault,
      amount,
      decimals,
      tokenProgram,
    }),
  });
}

/// Associated-token-account `CreateIdempotent`.
///
/// Hand-encoded like everything else here rather than imported from
/// @solana/spl-token: that package touches `Buffer` while its module is being
/// evaluated, and ESM runs every import before the first line of `main.jsx`, so
/// the global polyfill installed there is provably too late. One byte of data
/// and six accounts is a much smaller thing to own than that ordering problem.
export function createAtaIdempotentIx({ payer, owner, mint, tokenProgram = TOKEN_PROGRAM_ID }) {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: new PublicKey(payer), isSigner: true, isWritable: true },
      { pubkey: ataFor(mint, owner, tokenProgram), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(owner), isSigner: false, isWritable: false },
      { pubkey: new PublicKey(mint), isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(tokenProgram), isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}
