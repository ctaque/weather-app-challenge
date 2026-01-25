use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuccessResponse {
    pub success: bool,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindStatusResponse {
    pub running: bool,
    #[serde(rename = "lastFetch")]
    pub last_fetch: Option<LastFetchInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LastFetchInfo {
    pub success: bool,
    pub timestamp: String,
    #[serde(rename = "dataPoints")]
    pub data_points: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindRefreshResponse {
    pub success: bool,
    pub status: WindStatusResponse,
}
