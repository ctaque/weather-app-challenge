use serde::{Deserialize, Serialize};

// These structures mirror the WeatherAPI.com response format
// We don't need to define all fields, just the ones we use

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherApiResponse {
    // This is a pass-through, so we can use serde_json::Value
    // to avoid defining the entire structure
}

// For now, we'll just use serde_json::Value for weather responses
// since we're proxying them directly to the frontend
