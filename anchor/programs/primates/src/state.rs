use anchor_lang::prelude::*;

pub const CONFIG_SEED: &[u8] = b"config";

/// Number of desk tiers. Index 0 = Monkey, 1 = Ape, 2 = Kong.
pub const TIER_COUNT: usize = 3;

pub const TIER_NAMES: [&str; TIER_COUNT] = ["Monkey", "Ape", "Kong"];
pub const TIER_SLUGS: [&str; TIER_COUNT] = ["monkey", "ape", "kong"];

/// Allocation weight per tier. Each step up is triple the one below, so a Kong
/// desk counts for nine Chimp desks when a drop is split.
pub const TIER_WEIGHTS: [u32; TIER_COUNT] = [1, 3, 9];

pub const MAX_URI_BASE: usize = 96;

/// Single global account, PDA at `["config"]`.
///
/// It doubles as the update authority of the Core collection: the collection is
/// created off-chain with this PDA as its authority, so `mint_desk` can sign the
/// Core CPI with the config seeds and nothing else can mint into the collection.
#[account]
#[derive(InitSpace)]
pub struct Config {
    /// Admin allowed to call `set_config`.
    pub authority: Pubkey,
    /// The Metaplex Core collection every desk is minted into.
    pub collection: Pubkey,
    /// Destination for mint proceeds.
    pub treasury: Pubkey,
    /// Mint price per tier, in lamports.
    pub prices: [u64; TIER_COUNT],
    /// Hard supply cap per tier.
    pub supply: [u32; TIER_COUNT],
    /// Desks minted so far per tier.
    pub minted: [u32; TIER_COUNT],
    /// Metadata host, no trailing slash. Asset uri is `{uri_base}/{slug}.json`.
    #[max_len(MAX_URI_BASE)]
    pub uri_base: String,
    pub bump: u8,
}

// ---------------------------------------------------------------- drop engine

pub const ENGINE_SEED: &[u8] = b"engine";
pub const DESK_SEED: &[u8] = b"desk";

/// Stocks in the rotation.
pub const ROTATION_LEN: usize = 10;

/// Fixed-point scale for the per-weight accumulator. Rounding dust stays in the
/// holding account and is swept into the next round for that stock.
pub const ACC_SCALE: u128 = 1_000_000_000_000;

/// Global drop state, PDA at `["engine"]`.
///
/// A round is O(1) no matter how many desks exist: it credits one number per
/// stock rather than paying every desk. What a desk is owed is the distance
/// between that number and the desk's own stamp, times its weight.
///
/// The engine PDA also owns the holding token accounts the bot swaps into, so
/// `run_round` only ever credits tokens it can see in its own balance.
#[account]
#[derive(InitSpace)]
pub struct Engine {
    pub authority: Pubkey,
    /// Stock mints, bought in order.
    pub rotation: [Pubkey; ROTATION_LEN],
    /// Cumulative units of each stock owed per 1 allocation weight, x ACC_SCALE.
    pub acc_per_weight: [u128; ROTATION_LEN],
    /// Credited to desks but not yet settled out of the holding account.
    pub outstanding: [u64; ROTATION_LEN],
    /// Sum of the weights of every registered desk.
    pub total_weight: u64,
    /// Index into `rotation` for the next round.
    pub cursor: u8,
    pub last_round: i64,
    /// Seconds a round must wait behind the previous one.
    pub min_interval: i64,
    /// Smallest token delta worth crediting. Guards against dust rounds.
    pub dust_floor: u64,
    pub bump: u8,
}

/// Per-desk drop state, PDA at `["desk", asset]`.
#[account]
#[derive(InitSpace)]
pub struct Desk {
    pub asset: Pubkey,
    pub weight: u32,
    /// Where this desk last stood against each stock's accumulator.
    pub stamp: [u128; ROTATION_LEN],
    pub bump: u8,
}

/// The Core asset signer PDA — the desk's vault.
pub fn vault_for(asset: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"mpl-core-execute", asset.as_ref()], &mpl_core::ID).0
}
