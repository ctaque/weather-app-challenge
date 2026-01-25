use anyhow::{Context, Result};
use reqwest;
use serde::{Deserialize, Serialize};
use tracing::info;

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const MODEL: &str = "claude-sonnet-4-20250514";
const MAX_TOKENS: u32 = 1024;

#[derive(Debug, Clone)]
pub struct AnthropicClient {
    api_key: String,
    client: reqwest::Client,
}

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<Message>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<Content>,
}

#[derive(Debug, Deserialize)]
struct Content {
    text: String,
}

impl AnthropicClient {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: reqwest::Client::new(),
        }
    }

    /// Send a prompt to Claude and get a response
    pub async fn send_prompt(&self, prompt: &str) -> Result<String> {
        info!("Sending prompt to Anthropic API");

        let request = AnthropicRequest {
            model: MODEL.to_string(),
            max_tokens: MAX_TOKENS,
            messages: vec![Message {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
        };

        let response = self
            .client
            .post(ANTHROPIC_API_URL)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request)
            .send()
            .await
            .context("Failed to send request to Anthropic API")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!("Anthropic API error {}: {}", status, error_text);
        }

        let anthropic_response: AnthropicResponse = response
            .json()
            .await
            .context("Failed to parse Anthropic API response")?;

        if let Some(content) = anthropic_response.content.first() {
            Ok(content.text.clone())
        } else {
            anyhow::bail!("No content in Anthropic API response");
        }
    }

    /// Generate weather summary
    pub async fn generate_weather_summary(&self, weather_data: &str) -> Result<String> {
        let prompt = format!(
            "Tu es un assistant météo. Analyse les données météo suivantes et fournis un résumé concis et utile en français.\n\nDonnées météo:\n{}\n\nRésumé:",
            weather_data
        );

        self.send_prompt(&prompt).await
    }

    /// Analyze chart/image
    pub async fn analyze_chart(&self, chart_description: &str) -> Result<String> {
        let prompt = format!(
            "Analyse ce graphique météo et fournis des insights utiles en français.\n\nDescription du graphique:\n{}\n\nAnalyse:",
            chart_description
        );

        self.send_prompt(&prompt).await
    }
}
