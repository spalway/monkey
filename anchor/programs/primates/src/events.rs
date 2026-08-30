use anchor_lang::prelude::*;

#[event]
pub struct DeskMinted {
    pub asset: Pubkey,
    pub owner: Pubkey,
    pub tier: u8,
    pub weight: u32,
    pub serial: u32,
}

#[event]
pub struct DeskRegistered {
    pub asset: Pubkey,
    pub weight: u32,
    pub total_weight: u64,
}

#[event]
pub struct RoundRun {
    pub stock: Pubkey,
    pub slot: u8,
    pub amount: u64,
    pub total_weight: u64,
    pub next_slot: u8,
}

#[event]
pub struct Settled {
    pub asset: Pubkey,
    pub stock: Pubkey,
    pub amount: u64,
}
