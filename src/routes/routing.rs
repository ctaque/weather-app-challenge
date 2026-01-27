use actix_web::{post, web, HttpResponse, Result};
use reqwest;
use serde::Deserialize;
use tracing::{error, info};

use crate::utils::config::Config;

#[derive(Debug, Deserialize)]
pub struct RoutingRequest {
    coordinates: Vec<[f64; 2]>,
    #[serde(default = "default_profile")]
    profile: String,
    #[serde(rename = "extra_info")]
    extra_info: Option<Vec<String>>,
    instructions: Option<bool>,
    elevation: Option<bool>,
    language: Option<String>,
    format: Option<String>,
}

fn default_profile() -> String {
    "driving-car".to_string()
}

/// POST /api/routing - Proxy to OpenRouteService
#[post("/routing")]
pub async fn post_routing(
    req: web::Json<RoutingRequest>,
    config: web::Data<Config>,
) -> Result<HttpResponse> {
    info!("Routing request with {} coordinates", req.coordinates.len());

    if req.coordinates.len() < 2 {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "At least 2 coordinates are required"
        })));
    }

    println!("Using API key: {:#?}", &config.openrouteservice_token[..10]); // premiers caractères seulement

    // Format goes in the URL path, not the body
    let format_path = req.format.as_deref().unwrap_or("json");
    let url = format!(
        "https://api.openrouteservice.org/v2/directions/{}/{}",
        req.profile, format_path
    );

    let mut body = serde_json::json!({
        "coordinates": req.coordinates,
    });

    if let Some(extra_info) = &req.extra_info {
        body["extra_info"] = serde_json::json!(extra_info);
    }

    if let Some(instructions) = req.instructions {
        body["instructions"] = serde_json::json!(instructions);
    }

    if let Some(elevation) = req.elevation {
        body["elevation"] = serde_json::json!(elevation);
    }

    if let Some(language) = &req.language {
        body["language"] = serde_json::json!(language);
    }

    // Note: format is in the URL path, not the body

    info!("Request URL: {}", url);
    info!("Request body to OpenRouteService: {}", serde_json::to_string_pretty(&body).unwrap_or_default());

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header(
            "Accept",
            "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
        )
        .header("Authorization", config.openrouteservice_token.as_str())
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            error!("Failed to fetch from OpenRouteService: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to fetch routing data")
        })?;

    if !response.status().is_success() {
        let status_code = response.status().as_u16();
        let error_text = response.text().await.unwrap_or_default();
        error!("OpenRouteService error {}: {}", status_code, error_text);
        return Ok(HttpResponse::build(
            actix_web::http::StatusCode::from_u16(status_code)
                .unwrap_or(actix_web::http::StatusCode::INTERNAL_SERVER_ERROR),
        )
        .body(error_text));
    }

    let data = response.json::<serde_json::Value>().await.map_err(|e| {
        error!("Failed to parse OpenRouteService response: {}", e);
        actix_web::error::ErrorInternalServerError("Failed to parse routing data")
    })?;

    info!("OpenRouteService response: {}", serde_json::to_string_pretty(&data).unwrap_or_default());

    Ok(HttpResponse::Ok().json(data))
}
