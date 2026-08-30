use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::errors::PrimatesError;
use crate::events::Settled;
use crate::state::{vault_for, Desk, Engine, ACC_SCALE, DESK_SEED, ENGINE_SEED};

/// Delivers one stock's owed balance into one desk's vault. Permissionless —
/// anyone can settle anyone's desk, and several fit in a transaction.
///
/// Settling is only ever a delivery step. The desk's claim exists from the
/// moment the round runs whether or not anybody cranks this, so a desk that is
/// never settled loses nothing.
// Every sizeable account is boxed. Unboxed, this context deserialises Engine
// (~660B) plus Desk plus two token accounts and a mint into one SBF stack frame,
// which is only 4KB — it overruns during account validation and the program dies
// with a null read before the handler is ever reached.
#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,

    #[account(mut, seeds = [ENGINE_SEED], bump = engine.bump)]
    pub engine: Box<Account<'info, Engine>>,

    #[account(mut, seeds = [DESK_SEED, desk.asset.as_ref()], bump = desk.bump)]
    pub desk: Box<Account<'info, Desk>>,

    pub stock_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = stock_mint,
        associated_token::authority = engine,
    )]
    pub holding: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: matched against the Core asset signer PDA derived from the desk.
    pub vault: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = stock_mint,
        associated_token::authority = vault,
    )]
    pub vault_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn settle_handler(ctx: Context<Settle>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.vault.key(),
        vault_for(&ctx.accounts.desk.asset),
        PrimatesError::NotADesk
    );

    let slot = ctx
        .accounts
        .engine
        .rotation
        .iter()
        .position(|mint| mint == &ctx.accounts.stock_mint.key())
        .ok_or(PrimatesError::WrongStock)?;

    let acc = ctx.accounts.engine.acc_per_weight[slot];
    let owed = (acc.saturating_sub(ctx.accounts.desk.stamp[slot]))
        .checked_mul(ctx.accounts.desk.weight as u128)
        .ok_or(PrimatesError::Overflow)?
        / ACC_SCALE;
    let owed = u64::try_from(owed).map_err(|_| PrimatesError::Overflow)?;
    require!(owed > 0, PrimatesError::NothingToSettle);

    ctx.accounts.desk.stamp[slot] = acc;
    ctx.accounts.engine.outstanding[slot] = ctx.accounts.engine.outstanding[slot]
        .checked_sub(owed)
        .ok_or(PrimatesError::Overflow)?;

    let bump = ctx.accounts.engine.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[ENGINE_SEED, &[bump]]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.holding.to_account_info(),
                mint: ctx.accounts.stock_mint.to_account_info(),
                to: ctx.accounts.vault_ata.to_account_info(),
                authority: ctx.accounts.engine.to_account_info(),
            },
            signer_seeds,
        ),
        owed,
        ctx.accounts.stock_mint.decimals,
    )?;

    emit!(Settled {
        asset: ctx.accounts.desk.asset,
        stock: ctx.accounts.stock_mint.key(),
        amount: owed,
    });

    Ok(())
}
