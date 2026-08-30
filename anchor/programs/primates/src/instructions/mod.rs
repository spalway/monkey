pub mod close_desk;
pub mod init_engine;
pub mod initialize;
pub mod mint_desk;
pub mod register_desk;
pub mod run_round;
pub mod set_config;
pub mod set_engine;
pub mod settle;

// Glob re-export: the `#[program]` macro needs the generated
// `__client_accounts_*` modules alongside the Accounts structs. Each handler is
// named after its instruction so the globs never collide.
pub use close_desk::*;
pub use init_engine::*;
pub use initialize::*;
pub use mint_desk::*;
pub use register_desk::*;
pub use run_round::*;
pub use set_config::*;
pub use set_engine::*;
pub use settle::*;
