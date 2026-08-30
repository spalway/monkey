//! Primates — desk passes.
//!
//! Three tiers of Metaplex Core NFT (Monkey / Ape / Kong) minted into one
//! collection whose update authority is this program's `["config"]` PDA. Each
//! desk owns a vault: the Core asset signer PDA at `["mpl-core-execute", asset]`,
//! which only the asset's current owner can spend from.

use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;
use state::{ROTATION_LEN, TIER_COUNT};

declare_id!("CGcSojUL6xeXatcZ9RDzrqUqSucVnAR83fjv7KTrgJrm");

#[program]
pub mod primates {
    use super::*;

    /// One-time setup. Run after the Core collection has been created off-chain
    /// with the `["config"]` PDA as its update authority.
    pub fn initialize(
        ctx: Context<Initialize>,
        collection: Pubkey,
        treasury: Pubkey,
        prices: [u64; TIER_COUNT],
        supply: [u32; TIER_COUNT],
        uri_base: String,
    ) -> Result<()> {
        initialize_handler(ctx, collection, treasury, prices, supply, uri_base)
    }

    /// Admin-only. Any argument left as `None` is untouched.
    pub fn set_config(
        ctx: Context<SetConfig>,
        treasury: Option<Pubkey>,
        prices: Option<[u64; TIER_COUNT]>,
        supply: Option<[u32; TIER_COUNT]>,
        uri_base: Option<String>,
    ) -> Result<()> {
        set_config_handler(ctx, treasury, prices, supply, uri_base)
    }

    /// Mint one desk pass. `tier` is 0 (Monkey), 1 (Ape) or 2 (Kong).
    pub fn mint_desk(ctx: Context<MintDesk>, tier: u8) -> Result<()> {
        mint_desk_handler(ctx, tier)
    }

    // ------------------------------------------------------------ drop engine

    /// One-time setup for the allocation engine.
    pub fn init_engine(
        ctx: Context<InitEngine>,
        rotation: [Pubkey; ROTATION_LEN],
        min_interval: i64,
        dust_floor: u64,
    ) -> Result<()> {
        init_engine_handler(ctx, rotation, min_interval, dust_floor)
    }

    /// Admin: change the round cadence or the dust floor.
    pub fn set_engine(
        ctx: Context<SetEngine>,
        min_interval: Option<i64>,
        dust_floor: Option<u64>,
    ) -> Result<()> {
        set_engine_handler(ctx, min_interval, dust_floor)
    }

    /// Puts a minted desk into the engine so rounds start counting it.
    /// Permissionless; the weight is read off the asset.
    pub fn register_desk(ctx: Context<RegisterDesk>) -> Result<()> {
        register_desk_handler(ctx)
    }

    /// Credit whatever stock has arrived in the holding account to every
    /// registered desk, by weight. Permissionless, and O(1) in desk count.
    pub fn run_round(ctx: Context<RunRound>) -> Result<()> {
        run_round_handler(ctx)
    }

    /// Admin: remove a fully-settled desk from the engine and refund its rent.
    pub fn close_desk(ctx: Context<CloseDesk>) -> Result<()> {
        close_desk_handler(ctx)
    }

    /// Deliver one desk's owed balance for one stock into its vault.
    /// Permissionless.
    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        settle_handler(ctx)
    }
}
