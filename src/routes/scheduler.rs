use actix_web::{get, post, web, HttpResponse, Result};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info};

use crate::models::api_responses::WindRefreshResponse;
use crate::services::Scheduler;

/// GET /api/wind-status - Get scheduler status
#[get("/wind-status")]
pub async fn get_wind_status(
    scheduler: web::Data<Arc<RwLock<Scheduler>>>,
) -> Result<HttpResponse> {
    info!("Request for wind status");

    let scheduler = scheduler.read().await;
    let status = scheduler.get_status().await;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "running": status.running,
        "lastFetch": status.last_fetch
    })))
}

/// POST /api/wind-refresh - Trigger manual 24h historical fetch
#[post("/wind-refresh")]
pub async fn post_wind_refresh(
    scheduler: web::Data<Arc<RwLock<Scheduler>>>,
) -> Result<HttpResponse> {
    info!("Manual 24h fetch triggered");

    let scheduler = scheduler.read().await;

    match scheduler.fetch_historical_24h().await {
        Ok(success) => {
            let status = scheduler.get_status().await;
            Ok(HttpResponse::Ok().json(WindRefreshResponse {
                success,
                status: crate::models::api_responses::WindStatusResponse {
                    running: status.running,
                    last_fetch: status.last_fetch,
                },
            }))
        }
        Err(e) => {
            error!("Manual 24h fetch failed: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to refresh wind data"
            })))
        }
    }
}

/// POST /api/wind-refresh-latest - Trigger manual latest forecast fetch
#[post("/wind-refresh-latest")]
pub async fn post_wind_refresh_latest(
    scheduler: web::Data<Arc<RwLock<Scheduler>>>,
) -> Result<HttpResponse> {
    info!("Manual latest fetch triggered");

    let scheduler = scheduler.read().await;

    match scheduler.fetch_latest_forecast().await {
        Ok(success) => {
            let status = scheduler.get_status().await;
            Ok(HttpResponse::Ok().json(WindRefreshResponse {
                success,
                status: crate::models::api_responses::WindStatusResponse {
                    running: status.running,
                    last_fetch: status.last_fetch,
                },
            }))
        }
        Err(e) => {
            error!("Manual latest fetch failed: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to refresh latest wind data"
            })))
        }
    }
}
