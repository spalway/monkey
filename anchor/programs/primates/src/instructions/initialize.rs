use anchor_lang::prelude::*;

use crate::errors::PrimatesError;
use crate::state::{Config, CONFIG_SEED, MAX_URI_BASE, TIER_COUNT};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_handler(
    ctx: Context<Initialize>,
    collection: Pubkey,
    treasury: Pubkey,
    prices: [u64; TIER_COUNT],
    supply: [u32; TIER_COUNT],
    uri_base: String,
) -> Result<()> {
    require!(uri_base.len() <= MAX_URI_BASE, PrimatesError::UriBaseTooLong);

    ctx.accounts.config.set_inner(Config {
        authority: ctx.accounts.authority.key(),
        collection,
        treasury,
        prices,
        supply,
        minted: [0; TIER_COUNT],
        uri_base,
        bump: ctx.bumps.config,
    });

    Ok(())
}
