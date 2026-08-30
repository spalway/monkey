use anchor_lang::prelude::*;

#[error_code]
pub enum PrimatesError {
    #[msg("Tier must be 0 (Monkey), 1 (Ape) or 2 (Kong)")]
    InvalidTier,
    #[msg("This tier is sold out")]
    TierSoldOut,
    #[msg("Metadata uri base is too long")]
    UriBaseTooLong,
    #[msg("Not enough time has passed since the last round")]
    RoundTooSoon,
    #[msg("No registered desks to allocate to")]
    NoDesks,
    #[msg("Nothing new in the holding account to distribute")]
    NothingToDistribute,
    #[msg("This desk is owed nothing for that stock")]
    NothingToSettle,
    #[msg("That mint is not in the rotation")]
    WrongStock,
    #[msg("That asset is not a Primates desk")]
    NotADesk,
    #[msg("Could not read the tier from the asset name")]
    UnknownTier,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Settle this desk before closing it")]
    DeskNotSettled,
}
