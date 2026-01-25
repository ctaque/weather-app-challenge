use actix_web::{get, web, HttpRequest, HttpResponse, Result};
use std::sync::Arc;
use tracing::{error, info};

use crate::services::{RedisClient, WIND_METADATA_KEY, WIND_PNG_KEY};

/// GET /api/windgl/metadata.json - Get latest windgl metadata
#[get("/windgl/metadata.json")]
pub async fn get_windgl_metadata(redis: web::Data<Arc<RedisClient>>) -> Result<HttpResponse> {
    info!("Request for windgl metadata");

    match redis.get_wind_data(WIND_METADATA_KEY).await {
        Ok(Some(data)) => Ok(HttpResponse::Ok()
            .content_type("application/json")
            .insert_header(("Cache-Control", "public, max-age=300"))
            .json(data)),
        Ok(None) => {
            error!("Wind metadata not found in Redis");
            Ok(HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "Wind metadata not yet available"
            })))
        }
        Err(e) => {
            error!("Failed to fetch wind metadata: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch wind metadata"
            })))
        }
    }
}

/// GET /api/windgl/metadata.json/{index} - Get windgl metadata by index
#[get("/windgl/metadata.json/{index}")]
pub async fn get_windgl_metadata_by_index(
    index: web::Path<u32>,
    redis: web::Data<Arc<RedisClient>>,
) -> Result<HttpResponse> {
    let index = index.into_inner();
    info!("Request for windgl metadata at index {}", index);

    let indexed_key = format!("{}:{}", WIND_METADATA_KEY, index);

    match redis.get_wind_data(&indexed_key).await {
        Ok(Some(data)) => Ok(HttpResponse::Ok()
            .content_type("application/json")
            .insert_header(("Cache-Control", "public, max-age=300"))
            .json(data)),
        Ok(None) => {
            error!("Wind metadata not found at index {}", index);
            Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": format!("Wind metadata not found at index {}", index)
            })))
        }
        Err(e) => {
            error!("Failed to fetch wind metadata at index {}: {}", index, e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch wind metadata"
            })))
        }
    }
}

/// GET /api/windgl/wind.png - Get latest windgl PNG
#[get("/windgl/wind.png")]
pub async fn get_windgl_png(
    redis: web::Data<Arc<RedisClient>>,
    req: HttpRequest,
) -> Result<HttpResponse> {
    info!("Request for windgl PNG from {}", req.connection_info().peer_addr().unwrap_or("unknown"));

    match redis.get_binary_data(WIND_PNG_KEY).await {
        Ok(Some(png_buffer)) => Ok(HttpResponse::Ok()
            .content_type("image/png")
            .insert_header(("Cache-Control", "public, max-age=300"))
            .body(png_buffer)),
        Ok(None) => {
            error!("Wind PNG not found in Redis");
            Ok(HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "Wind PNG not yet available"
            })))
        }
        Err(e) => {
            error!("Failed to fetch wind PNG: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch wind PNG"
            })))
        }
    }
}

/// GET /api/windgl/wind.png/{index} - Get windgl PNG by index
#[get("/windgl/wind.png/{index}")]
pub async fn get_windgl_png_by_index(
    index: web::Path<u32>,
    redis: web::Data<Arc<RedisClient>>,
) -> Result<HttpResponse> {
    let index = index.into_inner();
    info!("Request for windgl PNG at index {}", index);

    match redis.get_binary_data_by_index(WIND_PNG_KEY, index).await {
        Ok(Some(png_buffer)) => Ok(HttpResponse::Ok()
            .content_type("image/png")
            .insert_header(("Cache-Control", "public, max-age=300"))
            .body(png_buffer)),
        Ok(None) => {
            error!("Wind PNG not found at index {}", index);
            Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": format!("Wind PNG not found at index {}", index)
            })))
        }
        Err(e) => {
            error!("Failed to fetch wind PNG at index {}: {}", index, e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch wind PNG"
            })))
        }
    }
}
