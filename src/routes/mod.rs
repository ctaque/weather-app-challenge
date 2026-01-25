pub mod ai;
pub mod auth;
pub mod routing;
pub mod scheduler;
pub mod weather;
pub mod wind;
pub mod windgl;

// Re-export auth functions for convenience
pub use auth::{health, gsi, login, logout, register, send_one_time_code, me, serve, index};
