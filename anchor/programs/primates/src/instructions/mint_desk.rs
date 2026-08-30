use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use mpl_core::instructions::CreateV2CpiBuilder;
use mpl_core::types::{
    Attribute, Attributes, DataState, Plugin, PluginAuthority, PluginAuthorityPair,
};

use crate::errors::PrimatesError;
use crate::events::DeskMinted;
use crate::state::{
    Config, CONFIG_SEED, TIER_COUNT, TIER_NAMES, TIER_SLUGS, TIER_WEIGHTS,
};

#[derive(Accounts)]
pub struct MintDesk<'info> {
    #[account(mut)]
    pub minter: Signer<'info>,

    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    /// CHECK: pinned to `config.collection`; mpl-core validates the account body.
    #[account(mut, address = config.collection)]
    pub collection: UncheckedAccount<'info>,

    /// CHECK: a fresh keypair supplied by the client. mpl-core creates and owns it.
    #[account(mut)]
    pub asset: Signer<'info>,

    /// CHECK: pinned to `config.treasury`; only ever receives lamports.
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: pinned to the mpl-core program id.
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Mints one desk pass of `tier` to the minter.
///
/// The asset's vault needs no account here: every Core asset has a signer PDA at
/// `["mpl-core-execute", asset]` under the Core program, and Core only lets the
/// asset's current owner spend from it. That is the vault, and it follows the
/// NFT on a sale without us tracking anything.
pub fn mint_desk_handler(ctx: Context<MintDesk>, tier: u8) -> Result<()> {
    let t = tier as usize;
    require!(t < TIER_COUNT, PrimatesError::InvalidTier);

    // Read what we need before the CPIs so the config borrow is released.
    let (price, serial, uri, bump) = {
        let config = &ctx.accounts.config;
        require!(
            config.minted[t] < config.supply[t],
            PrimatesError::TierSoldOut
        );
        (
            config.prices[t],
            config.minted[t] + 1,
            // Per asset, not per tier. Each desk's artwork is rolled from its
            // own address, so a shared `<tier>.json` would show every holder the
            // same picture while the site showed them theirs. The tier stays in
            // the path so whatever serves this can answer from the URL alone,
            // without an RPC round trip to find out what tier the asset is.
            format!(
                "{}/{}/{}.json",
                config.uri_base,
                TIER_SLUGS[t],
                ctx.accounts.asset.key()
            ),
            config.bump,
        )
    };

    if price > 0 {
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.minter.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            price,
        )?;
    }

    let plugins = vec![PluginAuthorityPair {
        plugin: Plugin::Attributes(Attributes {
            attribute_list: vec![
                Attribute {
                    key: "tier".to_string(),
                    value: TIER_NAMES[t].to_string(),
                },
                Attribute {
                    key: "weight".to_string(),
                    value: TIER_WEIGHTS[t].to_string(),
                },
                Attribute {
                    key: "serial".to_string(),
                    value: serial.to_string(),
                },
            ],
        }),
        authority: Some(PluginAuthority::UpdateAuthority),
    }];

    // The config PDA is the collection's update authority, so it is what signs
    // the mint into the collection.
    let signer_seeds: &[&[&[u8]]] = &[&[CONFIG_SEED, &[bump]]];

    CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .asset(&ctx.accounts.asset.to_account_info())
        .collection(Some(&ctx.accounts.collection.to_account_info()))
        .authority(Some(&ctx.accounts.config.to_account_info()))
        .payer(&ctx.accounts.minter.to_account_info())
        .owner(Some(&ctx.accounts.minter.to_account_info()))
        .system_program(&ctx.accounts.system_program.to_account_info())
        .data_state(DataState::AccountState)
        .name(format!("{} Desk #{}", TIER_NAMES[t], serial))
        .uri(uri)
        .plugins(plugins)
        .invoke_signed(signer_seeds)?;

    ctx.accounts.config.minted[t] = serial;

    emit!(DeskMinted {
        asset: ctx.accounts.asset.key(),
        owner: ctx.accounts.minter.key(),
        tier,
        weight: TIER_WEIGHTS[t],
        serial,
    });

    Ok(())
}
