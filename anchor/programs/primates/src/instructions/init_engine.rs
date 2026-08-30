use anchor_lang::prelude::*;

use crate::state::{Engine, ENGINE_SEED, ROTATION_LEN};

#[derive(Accounts)]
pub struct InitEngine<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Engine::INIT_SPACE,
        seeds = [ENGINE_SEED],
        bump,
    )]
    pub engine: Account<'info, Engine>,

    pub system_program: Program<'info, System>,
}

pub fn init_engine_handler(
    ctx: Context<InitEngine>,
    rotation: [Pubkey; ROTATION_LEN],
    min_interval: i64,
    dust_floor: u64,
) -> Result<()> {
    ctx.accounts.engine.set_inner(Engine {
        authority: ctx.accounts.authority.key(),
        rotation,
        acc_per_weight: [0; ROTATION_LEN],
        outstanding: [0; ROTATION_LEN],
        total_weight: 0,
        cursor: 0,
        last_round: 0,
        min_interval,
        dust_floor,
        bump: ctx.bumps.engine,
    });

    Ok(())
}
