use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindPoint {
    pub lat: f64,
    pub lon: f64,
    pub u: f64,
    pub v: f64,
    pub speed: f64,
    pub direction: f64,
    pub gusts: f64,
}

impl WindPoint {
    pub fn new(lat: f64, lon: f64, u: f64, v: f64) -> Self {
        let speed = (u * u + v * v).sqrt();
        let direction = (270.0 - (v.atan2(u) * 180.0 / std::f64::consts::PI)) % 360.0;

        Self {
            lat,
            lon,
            u,
            v,
            speed,
            direction,
            gusts: 0.0, // Not available in NOAA GFS data
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindBounds {
    pub lat: [f64; 2],
    pub lon: [f64; 2],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindData {
    pub timestamp: String,
    pub source: String,
    pub resolution: f64,
    pub points: Vec<WindPoint>,
    pub region: String,
    pub bounds: WindBounds,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindMetadata {
    pub source: String,
    pub date: String,
    pub width: usize,
    pub height: usize,
    #[serde(rename = "uMin")]
    pub u_min: f64,
    #[serde(rename = "uMax")]
    pub u_max: f64,
    #[serde(rename = "vMin")]
    pub v_min: f64,
    #[serde(rename = "vMax")]
    pub v_max: f64,
    pub tiles: Vec<String>,
}
