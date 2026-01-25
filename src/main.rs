use dotenvy::dotenv;
use crate::utils::misc::{get_env, Env};
use crate::utils::queries::migrate_db;
use sqlx::PgPool;
use tokio;

mod models;
mod routes;
mod server;
mod services;
mod tests;
mod utils;

#[tokio::main]
async fn main() {
    dotenv().ok();

    let app_env: Env = get_env();
    let pool = PgPool::connect(&app_env.database_url)
        .await
        .expect("Failed to connect to DB");

    migrate_db(&pool).await;

    println!(
        "Starting server on http://{}:{}",
        app_env.http_host.clone(),
        app_env.http_port.clone()
    );
    server::run(pool, app_env).await.unwrap();
}
