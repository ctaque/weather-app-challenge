use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub redis_url: String,
    pub weatherapi_key: String,
    pub anthropic_api_key: String,
    pub openrouteservice_token: String,
    pub is_production: bool,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        // Load .env file if it exists
        dotenvy::dotenv().ok();

        let port = env::var("PORT")
            .unwrap_or_else(|_| "3000".to_string())
            .parse()
            .map_err(|_| "Invalid PORT value")?;

        let redis_url = env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://localhost:6379".to_string());

        let weatherapi_key = env::var("WEATHERAPI_KEY")
            .map_err(|_| "WEATHERAPI_KEY not found in environment")?;

        let anthropic_api_key = env::var("ANTHROPIC_API_KEY")
            .map_err(|_| "ANTHROPIC_API_KEY not found in environment")?;

        let openrouteservice_token = env::var("OPENROUTESERVICE_TOKEN")
            .map_err(|_| "OPENROUTESERVICE_TOKEN not found in environment")?;

        let is_production = env::var("NODE_ENV")
            .unwrap_or_else(|_| "development".to_string())
            == "production";

        Ok(Config {
            port,
            redis_url,
            weatherapi_key,
            anthropic_api_key,
            openrouteservice_token,
            is_production,
        })
    }
}
