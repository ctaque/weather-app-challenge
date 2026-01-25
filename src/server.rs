use crate::routes;
use crate::{misc::Env, models::AppData};
use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use sqlx::PgPool;

pub async fn run(pool: PgPool, app_env: Env) -> std::io::Result<()> {
    let env_clone = app_env.clone();
    let is_prod = app_env.is_prod;
    let server = HttpServer::new(move || {
        let cors = if is_prod {
            Cors::permissive()
        } else {
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
        };

        App::new()
            .wrap(cors)
            .app_data(web::Data::new(AppData {
                db: pool.clone(),
                env: env_clone.clone(),
            }))
            .route("/health", web::get().to(routes::health))
            .route("/api/login", web::post().to(routes::login))
            .route("/api/logout", web::post().to(routes::logout))
            .route("/api/register", web::post().to(routes::register))
            .route("/api/otc", web::post().to(routes::send_one_time_code))
            .route("/api/me", web::get().to(routes::me))
            .route("/oauth/gsi", web::post().to(routes::gsi))
            .route("/{filename:.*\\.[^/]+}", web::get().to(routes::serve))
            .default_service(web::to(routes::index)) // Matches any path not matched by other routes
    })
    .bind((app_env.http_host, app_env.http_port))?
    .run()
    .await
    .expect("Failed to run server");
    Ok(server)
}
