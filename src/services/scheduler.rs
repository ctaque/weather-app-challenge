use anyhow::Result;
use chrono::{Datelike, DateTime, Duration, Timelike, Utc};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info};

use crate::models::api_responses::LastFetchInfo;
use crate::services::opendap_downloader::{
    download_precipitation_data_opendap, download_wind_data_opendap,
};
use crate::services::RedisClient;

// Redis keys
pub const WIND_POINTS_KEY: &str = "wind:points";
pub const WIND_PNG_KEY: &str = "wind:png";
pub const WIND_METADATA_KEY: &str = "wind:metadata";
pub const PRECIPITATION_POINTS_KEY: &str = "precipitation:points";
pub const LAST_UPDATE_KEY: &str = "wind:last_update";

#[derive(Debug, Clone)]
pub struct ForecastTarget {
    pub run_age: i64,
    pub offset: i32,
}

#[derive(Debug, Clone)]
pub struct SchedulerStatus {
    pub running: bool,
    pub last_fetch: Option<LastFetchInfo>,
}

impl Default for SchedulerStatus {
    fn default() -> Self {
        Self {
            running: false,
            last_fetch: None,
        }
    }
}

pub struct Scheduler {
    redis_client: Arc<RedisClient>,
    status: Arc<RwLock<SchedulerStatus>>,
}

impl Scheduler {
    pub fn new(redis_client: Arc<RedisClient>) -> Self {
        Self {
            redis_client,
            status: Arc::new(RwLock::new(SchedulerStatus::default())),
        }
    }

    /// Start the scheduler
    pub async fn start(&self) {
        info!("Starting wind data scheduler...");
        info!("Schedule: Every 5 minutes");
        info!("Initial: Fetch last 24h | Recurring: Check for latest forecast");

        // Update status
        {
            let mut status = self.status.write().await;
            status.running = true;
        }

        // Run 24h historical fetch on startup
        info!("Running initial 24h historical data fetch...");
        if let Err(e) = self.fetch_historical_24h().await {
            error!("Initial 24h fetch failed: {}", e);
        }

        // Schedule recurring fetches
        let redis_client = self.redis_client.clone();
        let status = self.status.clone();

        tokio::spawn(async move {
            use tokio_cron_scheduler::{Job, JobScheduler};

            let sched = JobScheduler::new().await.unwrap();

            // Every 5 minutes
            let job = Job::new_async("0 */5 * * * *", move |_uuid, _l| {
                let redis_client = redis_client.clone();
                let status = status.clone();

                Box::pin(async move {
                    info!("[{}] Scheduled latest forecast check triggered", Utc::now());
                    let scheduler = Scheduler {
                        redis_client,
                        status,
                    };
                    if let Err(e) = scheduler.fetch_latest_forecast().await {
                        error!("Latest forecast fetch failed: {}", e);
                    }
                })
            })
            .unwrap();

            sched.add(job).await.unwrap();
            sched.start().await.unwrap();

            // Keep the scheduler running
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(60)).await;
            }
        });

        info!("Wind data scheduler started successfully");
    }

    /// Calculate the GFS run name (e.g., "20260121_00Z")
    fn calculate_run_name(run_age: i64) -> String {
        let run_time = Utc::now() - Duration::hours(run_age);
        let hours = run_time.hour();
        let cycle_hour = (hours / 6) * 6;

        format!(
            "{}{}{}_{:02}Z",
            run_time.year(),
            format!("{:02}", run_time.month()),
            format!("{:02}", run_time.day()),
            cycle_hour
        )
    }

    /// Fetch and store a single forecast
    async fn fetch_and_store_single_forecast(
        &self,
        forecast_offset: i32,
        run_age: i64,
    ) -> Result<bool> {
        let effective_hours_back = run_age - forecast_offset as i64;
        let run_name = Self::calculate_run_name(run_age);

        info!(
            "\n=== Fetching data: Run {} + f+{} ({}h ago) ===",
            run_name, forecast_offset, effective_hours_back
        );

        // Calculate the actual time this data represents
        let data_time = Utc::now() - Duration::hours(effective_hours_back);

        // Check if we already have data for this time period (within 2h tolerance)
        let existing_indices = self.redis_client.get_available_indices(WIND_POINTS_KEY).await?;
        let tolerance_ms = 2 * 60 * 60 * 1000; // 2 hours

        let already_exists = existing_indices.iter().any(|idx| {
            if let Some(existing_dt) = &idx.data_time {
                if let (Ok(data_time_ms), Ok(existing_time_ms)) = (
                    DateTime::parse_from_rfc3339(&data_time.to_rfc3339()),
                    DateTime::parse_from_rfc3339(existing_dt),
                ) {
                    let diff = (data_time_ms.timestamp_millis() - existing_time_ms.timestamp_millis()).abs();
                    return diff < tolerance_ms;
                }
            }
            false
        });

        if already_exists {
            info!(
                "⏭️  Data for {} (±2h) already exists in Redis, skipping",
                data_time.to_rfc3339()
            );
            return Ok(true);
        }

        // Download wind data
        info!("Downloading wind data for run -{}h + f{}...", run_age, forecast_offset);

        let wind_data = download_wind_data_opendap(
            forecast_offset,
            run_age,
            -90.0,  // Global coverage
            90.0,
            -180.0,
            180.0,
        )
        .await?;

        info!("Successfully fetched {} wind data points", wind_data.wind_points.len());

        // Create wind data structure
        let wind_data_json = serde_json::json!({
            "timestamp": Utc::now().to_rfc3339(),
            "runName": run_name,
            "forecastOffset": forecast_offset,
            "runAge": run_age,
            "dataTime": data_time.to_rfc3339(),
            "hoursBack": effective_hours_back,
            "source": wind_data.metadata.source,
            "resolution": 0.5,
            "points": wind_data.wind_points,
            "region": "Global",
            "bounds": {
                "lat": [-90, 90],
                "lon": [-180, 180]
            }
        });

        // Store data with index (keeps last 20 versions)
        let current_index = self
            .redis_client
            .set_wind_data_with_index(&wind_data_json, WIND_POINTS_KEY, 20)
            .await?;

        info!(
            "Stored wind points at index {} ({}h ago)",
            current_index, effective_hours_back
        );

        // Store PNG image with index
        self.redis_client
            .set_binary_data_with_index(&wind_data.png_buffer, WIND_PNG_KEY, current_index)
            .await?;

        info!("Stored wind PNG at index {}", current_index);

        // Store metadata with same index
        let metadata_indexed_key = format!("{}:{}", WIND_METADATA_KEY, current_index);
        self.redis_client
            .set_wind_data(&serde_json::to_value(&wind_data.metadata)?, &metadata_indexed_key)
            .await?;

        // Also store as latest for backward compatibility (only for current run f+0)
        if run_age == 0 && forecast_offset == 0 {
            self.redis_client
                .set_wind_data(&serde_json::to_value(&wind_data.metadata)?, WIND_METADATA_KEY)
                .await?;
        }

        info!("Stored wind metadata at index {}", current_index);

        // Download and store precipitation data
        info!("Downloading precipitation data for run -{}h + f{}...", run_age, forecast_offset);

        match download_precipitation_data_opendap(
            forecast_offset,
            run_age,
            -90.0,
            90.0,
            -180.0,
            180.0,
        )
        .await
        {
            Ok(precip_data) => {
                info!(
                    "Successfully fetched {} precipitation data points",
                    precip_data.precip_points.len()
                );

                let precip_data_json = serde_json::json!({
                    "timestamp": Utc::now().to_rfc3339(),
                    "runName": run_name,
                    "forecastOffset": forecast_offset,
                    "runAge": run_age,
                    "dataTime": data_time.to_rfc3339(),
                    "hoursBack": effective_hours_back,
                    "source": "NOAA GFS 0.5° via OpenDAP",
                    "resolution": 0.5,
                    "points": precip_data.precip_points,
                    "unit": "mm/h",
                    "bounds": {
                        "lat": [-90, 90],
                        "lon": [-180, 180]
                    }
                });

                let precip_index = self
                    .redis_client
                    .set_wind_data_with_index(&precip_data_json, PRECIPITATION_POINTS_KEY, 20)
                    .await?;

                info!(
                    "Stored precipitation data at index {} ({}h ago)",
                    precip_index, effective_hours_back
                );

                // Also store as latest for backward compatibility (only for current run f+0)
                if run_age == 0 && forecast_offset == 0 {
                    self.redis_client
                        .set_wind_data(&precip_data_json, PRECIPITATION_POINTS_KEY)
                        .await?;
                }

                info!("Precipitation data successfully stored in Redis");
            }
            Err(e) => {
                error!(
                    "Failed to fetch/store precipitation data for +{}h: {}",
                    forecast_offset, e
                );
                // Don't fail the whole process if precipitation fails
            }
        }

        info!("=== Data for +{}h successfully stored ===\n", forecast_offset);
        Ok(true)
    }

    /// Calculate which GFS runs and offsets to fetch to cover the last 24h
    fn calculate_historical_forecast_targets() -> Vec<ForecastTarget> {
        let mut targets = Vec::new();
        let desired_hours_back = [0, 3, 6, 9, 12, 15, 18, 21];

        for hours_back in desired_hours_back {
            let mut found = false;

            // Try different run ages (prioritize closer runs)
            for run_age in [6, 12, 18, 24] {
                let forecast_offset = run_age - hours_back;

                // Check if this gives a valid forecast offset
                if forecast_offset >= 0 && forecast_offset % 3 == 0 && forecast_offset <= 24 {
                    targets.push(ForecastTarget {
                        run_age: run_age as i64,
                        offset: forecast_offset as i32,
                    });
                    found = true;
                    break;
                }
            }

            if !found {
                error!("Could not find GFS run/offset for {}h ago", hours_back);
            }
        }

        targets
    }

    /// Fetch wind data for the last 24 hours using historical runs
    pub async fn fetch_historical_24h(&self) -> Result<bool> {
        info!("\n========================================");
        info!("=== Starting 24h historical data fetch ===");
        info!("========================================\n");

        let targets = Self::calculate_historical_forecast_targets();
        let mut success_count = 0;
        let mut failure_count = 0;

        info!("Targets to fetch:");
        for target in &targets {
            let hours_back = target.run_age - target.offset as i64;
            let run_name = Self::calculate_run_name(target.run_age);
            info!(
                "  {} + f+{} = data for {}h ago",
                run_name, target.offset, hours_back
            );
        }
        info!("");

        for target in &targets {
            match self
                .fetch_and_store_single_forecast(target.offset, target.run_age)
                .await
            {
                Ok(true) => success_count += 1,
                _ => failure_count += 1,
            }

            // Small delay between fetches
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }

        // Store last update summary
        let summary = serde_json::json!({
            "timestamp": Utc::now().to_rfc3339(),
            "success": success_count > 0,
            "successCount": success_count,
            "failureCount": failure_count,
            "totalForecasts": targets.len(),
        });

        self.redis_client
            .set_wind_data(&summary, LAST_UPDATE_KEY)
            .await?;

        // Update status
        {
            let mut status = self.status.write().await;
            status.last_fetch = Some(LastFetchInfo {
                success: success_count > 0,
                timestamp: Utc::now().to_rfc3339(),
                data_points: success_count,
            });
        }

        info!("\n========================================");
        info!(
            "=== Fetch complete: {} success, {} failures ===",
            success_count, failure_count
        );
        info!("========================================\n");

        Ok(success_count > 0)
    }

    /// Fetch only the latest forecast (current run, f+0)
    pub async fn fetch_latest_forecast(&self) -> Result<bool> {
        info!("\n=== Checking for latest forecast ===");

        let current_run_name = Self::calculate_run_name(0);
        let forecast_offset = 0;

        // Get existing indices to check if this run already exists
        let existing_indices = self.redis_client.get_available_indices(WIND_POINTS_KEY).await?;

        let already_exists = existing_indices.iter().any(|idx| {
            idx.run_name.as_ref() == Some(&current_run_name)
                && idx.forecast_offset == Some(forecast_offset)
        });

        if already_exists {
            info!(
                "Latest forecast {} + f+{} already exists, skipping",
                current_run_name, forecast_offset
            );
            return Ok(true);
        }

        info!("Fetching latest forecast {} + f+0...", current_run_name);
        let success = self.fetch_and_store_single_forecast(0, 0).await?;

        if success {
            info!("=== Latest forecast stored successfully ===\n");
        } else {
            info!("=== Failed to fetch latest forecast ===\n");
        }

        Ok(success)
    }

    /// Get scheduler status
    pub async fn get_status(&self) -> SchedulerStatus {
        self.status.read().await.clone()
    }
}
