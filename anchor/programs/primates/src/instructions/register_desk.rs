use anchor_lang::prelude::*;
use mpl_core::accounts::BaseAssetV1;
use mpl_core::types::UpdateAuthority;

use crate::errors::PrimatesError;
use crate::events::DeskRegistered;
use crate::state::{
    Config, Desk, Engine, CONFIG_SEED, DESK_SEED, ENGINE_SEED, TIER_NAMES, TIER_WEIGHTS,
};

/// Puts a minted desk into the drop engine.
///
/// Permissionless and idempotent by construction — the `init` on the desk PDA
/// means a desk can only be registered once, and anyone can pay to register
/// anyone's desk. The weight is read off the asset itself rather than passed in,
/// so there is nothing here to lie about.
#[derive(Accounts)]
pub struct RegisterDesk<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,

    #[account(mut, seeds = [ENGINE_SEED], bump = engine.bump)]
    pub engine: Box<Account<'info, Engine>>,

    /// CHECK: owner-checked as an mpl-core account, then deserialized as a Core
    /// asset and matched against our collection.
    #[account(owner = mpl_core::ID)]
    pub asset: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + Desk::INIT_SPACE,
        seeds = [DESK_SEED, asset.key().as_ref()],
        bump,
    )]
    pub desk: Box<Account<'info, Desk>>,

    pub system_program: Program<'info, System>,
}

pub fn register_desk_handler(ctx: Context<RegisterDesk>) -> Result<()> {
    let weight = {
        let data = ctx.accounts.asset.try_borrow_data()?;
        let base = BaseAssetV1::from_bytes(&data).map_err(|_| PrimatesError::NotADesk)?;

        // Only assets in our collection count. A Core asset carries its
        // collection in the update authority.
        match base.update_authority {
            UpdateAuthority::Collection(collection) => {
                require_keys_eq!(
                    collection,
                    ctx.accounts.config.collection,
                    PrimatesError::NotADesk
                );
            }
            _ => return err!(PrimatesError::NotADesk),
        }

        // Names are minted as "<Tier> Desk #<serial>". No tier name is a prefix
        // of another, so a prefix match is unambiguous.
        let tier = TIER_NAMES
            .iter()
            .position(|name| base.name.starts_with(name))
            .ok_or(PrimatesError::UnknownTier)?;

        TIER_WEIGHTS[tier]
    };

    let engine = &mut ctx.accounts.engine;

    // Stamping at the current accumulator is what stops a desk claiming rounds
    // that happened before it existed.
    ctx.accounts.desk.set_inner(Desk {
        asset: ctx.accounts.asset.key(),
        weight,
        stamp: engine.acc_per_weight,
        bump: ctx.bumps.desk,
    });

    engine.total_weight = engine
        .total_weight
        .checked_add(weight as u64)
        .ok_or(PrimatesError::Overflow)?;

    emit!(DeskRegistered {
        asset: ctx.accounts.asset.key(),
        weight,
        total_weight: engine.total_weight,
    });

    Ok(())
}
