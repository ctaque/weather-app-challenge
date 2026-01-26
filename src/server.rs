use crate::routes;
use crate::{models::auth::AppData, utils::misc::Env};
use actix_cors::Cors;
use actix_governor::{Governor, GovernorConfigBuilder};
use actix_web::{middleware, HttpServer};
use actix_web::{web, App};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;
use tracing_subscriber;

use crate::services::{AnthropicClient, RedisClient, Scheduler};
use crate::utils::config::Config;

pub async fn run(pool: PgPool, app_env: Env) -> std::io::Result<()> {
    let env_clone = app_env.clone();
    let is_prod = app_env.is_prod;
    println!("{}", is_prod);
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting PlanMyTrip App Rust Server...");

    // Load configuration
    let config = Config::from_env().expect("Failed to load configuration");
    let port = config.port;
    let is_production = config.is_production;

    info!("Configuration loaded:");
    info!("  Port: {}", config.port);
    info!("  Redis URL: {}", config.redis_url);
    info!("  Is Production: {}", config.is_production);

    // Initialize Redis client
    let redis_client = Arc::new(
        RedisClient::new(&config.redis_url)
            .await
            .expect("Failed to connect to Redis"),
    );

    // Initialize Anthropic client
    let anthropic_client = Arc::new(AnthropicClient::new(config.anthropic_api_key.clone()));

    // Initialize scheduler
    let scheduler = Scheduler::new(redis_client.clone());
    let scheduler = Arc::new(RwLock::new(scheduler));

    // Start scheduler
    {
        let scheduler = scheduler.read().await;
        scheduler.start().await;
    }
    let governor_conf = if is_production {
        GovernorConfigBuilder::default()
            .per_second(60)
            .burst_size(5)
            .finish()
            .unwrap()
    } else {
        // In development, allow more requests
        GovernorConfigBuilder::default()
            .per_second(3600)
            .burst_size(100)
            .finish()
            .unwrap()
    };
    let server = HttpServer::new(move || {
        let cors = if is_prod == true {
            Cors::default()
                .allowed_origin(&env_clone.http_domain)
                .allowed_methods(vec!["GET", "POST", "PUT", "DELETE"])
                .allowed_headers(vec![
                    actix_web::http::header::AUTHORIZATION,
                    actix_web::http::header::ACCEPT,
                    actix_web::http::header::CONTENT_TYPE,
                ])
                .supports_credentials()
                .max_age(3600)
        } else {
            Cors::permissive().into()
        };

        App::new()
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .wrap(middleware::Compress::default())
            .app_data(web::Data::new(config.clone()))
            .app_data(web::Data::new(redis_client.clone()))
            .app_data(web::Data::new(anthropic_client.clone()))
            .app_data(web::Data::new(scheduler.clone()))
            .app_data(web::Data::new(AppData {
                db: pool.clone(),
                env: env_clone.clone(),
            }))
            .route("/health", web::get().to(routes::health))
            .route("/oauth/gsi", web::post().to(routes::gsi))
            .service(
                web::scope("/api")
                    .route("/login", web::post().to(routes::login))
                    .route("/ogout", web::post().to(routes::logout))
                    .route("/register", web::post().to(routes::register))
                    .route("/otc", web::post().to(routes::send_one_time_code))
                    .route("/me", web::get().to(routes::me))
                    .route("/route", web::post().to(routes::routes::post_routing))
                    .route("/route/{uuid}", web::get().to(routes::routes::get_routing))
                    .route("/route/{uuid}", web::put().to(routes::routes::put_routing))
                    // Weather routes
                    .service(routes::weather::get_weather)
                    // Wind routes
                    .service(routes::wind::get_wind_global)
                    .service(routes::wind::get_wind_indices)
                    .service(routes::wind::get_wind_global_by_index)
                    .service(routes::wind::get_precipitation_global)
                    .service(routes::wind::get_precipitation_indices)
                    .service(routes::wind::get_precipitation_global_by_index)
                    // Windgl routes
                    .service(routes::windgl::get_windgl_metadata)
                    .service(routes::windgl::get_windgl_metadata_by_index)
                    .service(routes::windgl::get_windgl_png)
                    .service(routes::windgl::get_windgl_png_by_index)
                    // AI routes (with rate limiting in production)
                    .service(
                        web::scope("")
                            .wrap(Governor::new(&governor_conf))
                            .service(routes::ai::post_weather_summary)
                            .service(routes::ai::post_chart_analysis)
                            .service(routes::routing::post_routing)
                            .service(routes::scheduler::get_wind_status)
                            .service(routes::scheduler::post_wind_refresh)
                            .service(routes::scheduler::post_wind_refresh_latest),
                    ), // Routing routes
                       // Scheduler routes
            )
            .route("/{filename:.*\\.[^/]+}", web::get().to(routes::serve))
            .default_service(web::to(routes::index)) // Matches any path not matched by other routes
    })
    .bind((app_env.http_host, app_env.http_port))?
    .run()
    .await
    .expect("Failed to run server");
    Ok(server)
}
