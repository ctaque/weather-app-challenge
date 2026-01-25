use actix_web::{get, web, HttpResponse, Result};
use std::sync::Arc;
use tracing::{error, info};

use crate::services::{RedisClient, PRECIPITATION_POINTS_KEY, WIND_POINTS_KEY};

/// GET /api/wind-global - Get latest wind data
#[get("/wind-global")]
pub async fn get_wind_global(redis: web::Data<Arc<RedisClient>>) -> Result<HttpResponse> {
    info!("Request for wind-global");

    match redis.get_wind_data(WIND_POINTS_KEY).await {
        Ok(Some(data)) => Ok(HttpResponse::Ok().json(data)),
        Ok(None) => {
            error!("Wind data not found in Redis");
            Ok(HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "Wind data not yet available. Please try again in a few minutes."
            })))
        }
        Err(e) => {
            error!("Failed to fetch wind data: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch wind data"
            })))
        }
    }
}

/// GET /api/wind-indices - Get list of available wind data indices
#[get("/wind-indices")]
pub async fn get_wind_indices(redis: web::Data<Arc<RedisClient>>) -> Result<HttpResponse> {
    info!("Request for wind-indices");

    match redis.get_available_indices(WIND_POINTS_KEY).await {
        Ok(indices) => Ok(HttpResponse::Ok().json(indices)),
        Err(e) => {
            error!("Failed to fetch wind indices: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch wind indices"
            })))
        }
    }
}

/// GET /api/wind-global/{index} - Get wind data by index
#[get("/wind-global/{index}")]
pub async fn get_wind_global_by_index(
    index: web::Path<u32>,
    redis: web::Data<Arc<RedisClient>>,
) -> Result<HttpResponse> {
    let index = index.into_inner();
    info!("Request for wind-global at index {}", index);

    match redis.get_wind_data_by_index(WIND_POINTS_KEY, index).await {
        Ok(Some(data)) => Ok(HttpResponse::Ok().json(data)),
        Ok(None) => {
            error!("Wind data not found at index {}", index);
            Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": format!("Wind data not found at index {}", index)
            })))
        }
        Err(e) => {
            error!("Failed to fetch wind data at index {}: {}", index, e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch wind data"
            })))
        }
    }
}

/// GET /api/precipitation-global - Get latest precipitation data
#[get("/precipitation-global")]
pub async fn get_precipitation_global(redis: web::Data<Arc<RedisClient>>) -> Result<HttpResponse> {
    info!("Request for precipitation-global");

    match redis.get_wind_data(PRECIPITATION_POINTS_KEY).await {
        Ok(Some(data)) => Ok(HttpResponse::Ok().json(data)),
        Ok(None) => {
            error!("Precipitation data not found in Redis");
            Ok(HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "Precipitation data not yet available. Please try again in a few minutes."
            })))
        }
        Err(e) => {
            error!("Failed to fetch precipitation data: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch precipitation data"
            })))
        }
    }
}

/// GET /api/precipitation-indices - Get list of available precipitation data indices
#[get("/precipitation-indices")]
pub async fn get_precipitation_indices(
    redis: web::Data<Arc<RedisClient>>,
) -> Result<HttpResponse> {
    info!("Request for precipitation-indices");

    match redis.get_available_indices(PRECIPITATION_POINTS_KEY).await {
        Ok(indices) => Ok(HttpResponse::Ok().json(indices)),
        Err(e) => {
            error!("Failed to fetch precipitation indices: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch precipitation indices"
            })))
        }
    }
}

/// GET /api/precipitation-global/{index} - Get precipitation data by index
#[get("/precipitation-global/{index}")]
pub async fn get_precipitation_global_by_index(
    index: web::Path<u32>,
    redis: web::Data<Arc<RedisClient>>,
) -> Result<HttpResponse> {
    let index = index.into_inner();
    info!("Request for precipitation-global at index {}", index);

    match redis
        .get_wind_data_by_index(PRECIPITATION_POINTS_KEY, index)
        .await
    {
        Ok(Some(data)) => Ok(HttpResponse::Ok().json(data)),
        Ok(None) => {
            error!("Precipitation data not found at index {}", index);
            Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": format!("Precipitation data not found at index {}", index)
            })))
        }
        Err(e) => {
            error!(
                "Failed to fetch precipitation data at index {}: {}",
                index, e
            );
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch precipitation data"
            })))
        }
    }
}
