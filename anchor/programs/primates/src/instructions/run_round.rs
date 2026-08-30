use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::errors::PrimatesError;
use crate::events::RoundRun;
use crate::state::{Engine, ACC_SCALE, ENGINE_SEED, ROTATION_LEN};

/// One round. Permissionless.
///
/// The bot buys the stock off-chain and sends it to the engine's holding
/// account; this credits whatever new balance actually arrived. That is the
/// whole trust model — the program never takes the bot's word for the amount,
/// it reads its own balance. Overstating a purchase is not possible.
///
/// Cost is constant in the number of desks: one accumulator write, not N
/// transfers. Delivery happens later in `settle`, which anyone can crank.
#[derive(Accounts)]
pub struct RunRound<'info> {
    pub cranker: Signer<'info>,

    #[account(mut, seeds = [ENGINE_SEED], bump = engine.bump)]
    pub engine: Box<Account<'info, Engine>>,

    pub stock_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        associated_token::mint = stock_mint,
        associated_token::authority = engine,
    )]
    pub holding: Box<InterfaceAccount<'info, TokenAccount>>,
}

pub fn run_round_handler(ctx: Context<RunRound>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let engine = &mut ctx.accounts.engine;

    require!(
        now.saturating_sub(engine.last_round) >= engine.min_interval,
        PrimatesError::RoundTooSoon
    );
    require!(engine.total_weight > 0, PrimatesError::NoDesks);

    let slot = engine.cursor as usize;
    require_keys_eq!(
        ctx.accounts.stock_mint.key(),
        engine.rotation[slot],
        PrimatesError::WrongStock
    );

    // Anything above what we still owe from earlier rounds is new money.
    let arrived = ctx
        .accounts
        .holding
        .amount
        .checked_sub(engine.outstanding[slot])
        .ok_or(PrimatesError::Overflow)?;
    require!(
        arrived >= engine.dust_floor,
        PrimatesError::NothingToDistribute
    );

    // Integer division leaves dust in the holding account. It is not added to
    // `outstanding`, so the next round for this stock picks it up.
    let per_weight = (arrived as u128)
        .checked_mul(ACC_SCALE)
        .ok_or(PrimatesError::Overflow)?
        / engine.total_weight as u128;

    engine.acc_per_weight[slot] = engine.acc_per_weight[slot]
        .checked_add(per_weight)
        .ok_or(PrimatesError::Overflow)?;
    engine.outstanding[slot] = engine.outstanding[slot]
        .checked_add(arrived)
        .ok_or(PrimatesError::Overflow)?;

    engine.cursor = ((slot + 1) % ROTATION_LEN) as u8;
    engine.last_round = now;

    emit!(RoundRun {
        stock: ctx.accounts.stock_mint.key(),
        slot: slot as u8,
        amount: arrived,
        total_weight: engine.total_weight,
        next_slot: engine.cursor,
    });

    Ok(())
}
