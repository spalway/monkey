use anchor_lang::prelude::*;

use crate::state::{Engine, ENGINE_SEED};

/// Admin knob for the round cadence. `init_engine` can only run once, so without
/// this the interval is fixed for the life of the deployment.
///
/// The rotation and the accumulators are deliberately not writable here —
/// changing either behind a live round would strand credited tokens.
#[derive(Accounts)]
pub struct SetEngine<'info> {
    #[account(address = engine.authority)]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [ENGINE_SEED], bump = engine.bump)]
    pub engine: Box<Account<'info, Engine>>,
}

pub fn set_engine_handler(
    ctx: Context<SetEngine>,
    min_interval: Option<i64>,
    dust_floor: Option<u64>,
) -> Result<()> {
    let engine = &mut ctx.accounts.engine;

    if let Some(min_interval) = min_interval {
        engine.min_interval = min_interval;
    }
    if let Some(dust_floor) = dust_floor {
        engine.dust_floor = dust_floor;
    }

    Ok(())
}
