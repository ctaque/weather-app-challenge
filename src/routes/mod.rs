pub mod addresses;
pub mod ai;
pub mod auth;
pub mod routes;
pub mod routing;
pub mod scheduler;
pub mod weather;
pub mod wind;
pub mod windgl;

// Re-export auth functions for convenience
pub use auth::{gsi, health, index, login, logout, me, register, send_one_time_code, serve};

// Re-export addresses functions for convenience
pub use addresses::*;
