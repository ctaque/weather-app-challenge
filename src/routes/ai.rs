use actix_web::{post, web, HttpResponse, Result};
use serde::Deserialize;
use std::sync::Arc;
use tracing::{error, info};

use crate::services::AnthropicClient;

#[derive(Debug, Deserialize)]
pub struct WeatherSummaryRequest {
    #[serde(rename = "weatherData")]
    weather_data: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct ChartAnalysisRequest {
    #[serde(rename = "chartDescription")]
    chart_description: String,
}

/// POST /api/weather-summary - Generate weather summary using Claude
#[post("/weather-summary")]
pub async fn post_weather_summary(
    req: web::Json<WeatherSummaryRequest>,
    anthropic: web::Data<Arc<AnthropicClient>>,
) -> Result<HttpResponse> {
    info!("Request for weather summary");

    let weather_data_str = serde_json::to_string_pretty(&req.weather_data).unwrap_or_default();

    match anthropic.generate_weather_summary(&weather_data_str).await {
        Ok(summary) => Ok(HttpResponse::Ok().json(serde_json::json!({
            "summary": summary
        }))),
        Err(e) => {
            error!("Failed to generate weather summary: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to generate weather summary"
            })))
        }
    }
}

/// POST /api/chart-analysis - Analyze chart using Claude
#[post("/chart-analysis")]
pub async fn post_chart_analysis(
    req: web::Json<ChartAnalysisRequest>,
    anthropic: web::Data<Arc<AnthropicClient>>,
) -> Result<HttpResponse> {
    info!("Request for chart analysis");

    match anthropic.analyze_chart(&req.chart_description).await {
        Ok(analysis) => Ok(HttpResponse::Ok().json(serde_json::json!({
            "analysis": analysis
        }))),
        Err(e) => {
            error!("Failed to analyze chart: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to analyze chart"
            })))
        }
    }
}
