use anchor_lang::prelude::*;

use crate::errors::PrimatesError;
use crate::state::{Desk, Engine, ACC_SCALE, DESK_SEED, ENGINE_SEED};

/// Removes a desk from the engine and refunds its rent.
///
/// Admin only, and refuses while the desk is owed anything — closing a desk mid
/// claim would strand those tokens in `outstanding` with nothing left to deliver
/// them to. Settle first, then close.
#[derive(Accounts)]
pub struct CloseDesk<'info> {
    #[account(mut, address = engine.authority)]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [ENGINE_SEED], bump = engine.bump)]
    pub engine: Box<Account<'info, Engine>>,

    #[account(
        mut,
        close = authority,
        seeds = [DESK_SEED, desk.asset.as_ref()],
        bump = desk.bump,
    )]
    pub desk: Box<Account<'info, Desk>>,
}

pub fn close_desk_handler(ctx: Context<CloseDesk>) -> Result<()> {
    let weight = ctx.accounts.desk.weight as u128;

    for slot in 0..ctx.accounts.engine.rotation.len() {
        let owed = ctx.accounts.engine.acc_per_weight[slot]
            .saturating_sub(ctx.accounts.desk.stamp[slot])
            .checked_mul(weight)
            .ok_or(PrimatesError::Overflow)?
            / ACC_SCALE;
        require!(owed == 0, PrimatesError::DeskNotSettled);
    }

    ctx.accounts.engine.total_weight = ctx
        .accounts
        .engine
        .total_weight
        .checked_sub(weight as u64)
        .ok_or(PrimatesError::Overflow)?;

    Ok(())
}
