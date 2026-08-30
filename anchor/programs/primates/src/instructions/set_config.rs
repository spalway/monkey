use anchor_lang::prelude::*;

use crate::errors::PrimatesError;
use crate::state::{Config, CONFIG_SEED, MAX_URI_BASE, TIER_COUNT};

#[derive(Accounts)]
pub struct SetConfig<'info> {
    #[account(address = config.authority)]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
}

/// Admin knob. Every field is optional so this doubles as "point the metadata
/// somewhere else" without a redeploy. `minted` is never writable.
pub fn set_config_handler(
    ctx: Context<SetConfig>,
    treasury: Option<Pubkey>,
    prices: Option<[u64; TIER_COUNT]>,
    supply: Option<[u32; TIER_COUNT]>,
    uri_base: Option<String>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;

    if let Some(treasury) = treasury {
        config.treasury = treasury;
    }
    if let Some(prices) = prices {
        config.prices = prices;
    }
    if let Some(supply) = supply {
        for tier in 0..TIER_COUNT {
            require!(supply[tier] >= config.minted[tier], PrimatesError::TierSoldOut);
        }
        config.supply = supply;
    }
    if let Some(uri_base) = uri_base {
        require!(uri_base.len() <= MAX_URI_BASE, PrimatesError::UriBaseTooLong);
        config.uri_base = uri_base;
    }

    Ok(())
}
