use actix_web::{get, web, HttpResponse, Result};
use reqwest;
use serde::Deserialize;
use tracing::{error, info};

use crate::utils::config::Config;

#[derive(Debug, Deserialize)]
pub struct WeatherQuery {
    q: String,
    #[serde(default = "default_days")]
    days: u8,
    #[serde(default = "default_lang")]
    lang: String,
}

fn default_days() -> u8 {
    3
}

fn default_lang() -> String {
    "fr".to_string()
}

/// GET /api/weather - Proxy to WeatherAPI.com
#[get("/weather")]
pub async fn get_weather(
    query: web::Query<WeatherQuery>,
    config: web::Data<Config>,
) -> Result<HttpResponse> {
    info!("Weather request for location: {}", query.q);

    let url = format!(
        "https://api.weatherapi.com/v1/forecast.json?key={}&q={}&days={}&lang={}",
        config.weatherapi_key, query.q, query.days, query.lang
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| {
            error!("Failed to fetch from WeatherAPI: {}", e);
            actix_web::error::ErrorInternalServerError("Failed to fetch weather data")
        })?;

    if !response.status().is_success() {
        let status_code = response.status().as_u16();
        let error_text = response.text().await.unwrap_or_default();
        error!("WeatherAPI error {}: {}", status_code, error_text);
        return Ok(HttpResponse::build(actix_web::http::StatusCode::from_u16(status_code).unwrap_or(actix_web::http::StatusCode::INTERNAL_SERVER_ERROR)).body(error_text));
    }

    let data = response.json::<serde_json::Value>().await.map_err(|e| {
        error!("Failed to parse WeatherAPI response: {}", e);
        actix_web::error::ErrorInternalServerError("Failed to parse weather data")
    })?;

    Ok(HttpResponse::Ok().json(data))
}
