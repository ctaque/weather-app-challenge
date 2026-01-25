use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrecipitationPoint {
    pub lat: f64,
    pub lon: f64,
    pub rate: f64, // kg/m^2/s (precipitation rate)
}

impl PrecipitationPoint {
    pub fn new(lat: f64, lon: f64, rate: f64) -> Self {
        Self { lat, lon, rate }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrecipitationBounds {
    pub lat: [f64; 2],
    pub lon: [f64; 2],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrecipitationData {
    pub timestamp: String,
    pub source: String,
    pub resolution: f64,
    pub points: Vec<PrecipitationPoint>,
    pub region: String,
    pub bounds: PrecipitationBounds,
}
