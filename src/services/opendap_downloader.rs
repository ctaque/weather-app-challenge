use anyhow::{Context, Result};
use chrono::{DateTime, Datelike, Duration, Timelike, Utc};
use reqwest;
use tracing::{error, info};

use crate::models::{PrecipitationPoint, WindMetadata, WindPoint};
use crate::utils::opendap_parser::{
    parse_opendap_ascii, parse_opendap_precipitation_ascii,
};
use crate::utils::png_converter::convert_to_png;

#[derive(Debug, Clone)]
pub struct ForecastRun {
    pub date: String,      // YYYYMMDD
    pub hour: String,      // HH (00, 06, 12, 18)
    pub full_date: DateTime<Utc>,
    pub hours_waited: f64,
}

#[derive(Debug, Clone)]
pub struct DownloadedWindData {
    pub png_buffer: Vec<u8>,
    pub metadata: WindMetadata,
    pub wind_points: Vec<WindPoint>,
    pub run_name: String,
    pub data_time: String,
    pub forecast_offset: i32,
}

#[derive(Debug, Clone)]
pub struct DownloadedPrecipitationData {
    pub precip_points: Vec<PrecipitationPoint>,
    pub run_name: String,
    pub data_time: String,
    pub forecast_offset: i32,
}

/// Get available GFS forecast runs in order of preference
/// GFS runs at 00Z, 06Z, 12Z, 18Z and takes ~5-6 hours to be fully available
pub fn get_available_forecast_runs() -> Vec<ForecastRun> {
    let now = Utc::now();
    let mut runs = Vec::new();

    // Get the last 8 runs (48 hours of coverage) for maximum reliability
    for i in 0..8 {
        let hours_ago = i * 6;
        let run_time = now - Duration::hours(hours_ago);

        // Round down to nearest 6-hour interval
        let utc_hours = run_time.hour();
        let forecast_hour = if utc_hours >= 18 {
            18
        } else if utc_hours >= 12 {
            12
        } else if utc_hours >= 6 {
            6
        } else {
            0
        };

        let mut forecast_time = run_time;
        forecast_time = forecast_time
            .with_hour(forecast_hour)
            .unwrap()
            .with_minute(0)
            .unwrap()
            .with_second(0)
            .unwrap()
            .with_nanosecond(0)
            .unwrap();

        // Calculate hours since this run
        let hours_waited = (now - forecast_time).num_milliseconds() as f64 / (60.0 * 60.0 * 1000.0);

        let date = format!(
            "{}{}{}",
            forecast_time.year(),
            format!("{:02}", forecast_time.month()),
            format!("{:02}", forecast_time.day())
        );
        let hour = format!("{:02}", forecast_hour);

        runs.push(ForecastRun {
            date,
            hour,
            full_date: forecast_time,
            hours_waited,
        });
    }

    // Remove duplicates
    runs.dedup_by(|a, b| a.date == b.date && a.hour == b.hour);

    // Sort by readiness: prefer runs with > 5.5 hours wait time
    runs.sort_by(|a, b| {
        // Heavily prefer runs with enough wait time
        let a_ready = if a.hours_waited >= 5.5 { 1 } else { 0 };
        let b_ready = if b.hours_waited >= 5.5 { 1 } else { 0 };

        if a_ready != b_ready {
            b_ready.cmp(&a_ready)
        } else {
            // Otherwise prefer more recent
            b.full_date.cmp(&a.full_date)
        }
    });

    runs
}

/// Get a specific historical GFS run based on how many hours back
pub fn get_historical_forecast_run(run_age: i64) -> Vec<ForecastRun> {
    let now = Utc::now();
    let target_time = now - Duration::hours(run_age);

    // Round down to nearest 6-hour interval
    let utc_hours = target_time.hour();
    let forecast_hour = if utc_hours >= 18 {
        18
    } else if utc_hours >= 12 {
        12
    } else if utc_hours >= 6 {
        6
    } else {
        0
    };

    let mut target_run = target_time;
    target_run = target_run
        .with_hour(forecast_hour)
        .unwrap()
        .with_minute(0)
        .unwrap()
        .with_second(0)
        .unwrap()
        .with_nanosecond(0)
        .unwrap();

    let date = format!(
        "{}{}{}",
        target_run.year(),
        format!("{:02}", target_run.month()),
        format!("{:02}", target_run.day())
    );
    let hour = format!("{:02}", forecast_hour);
    let hours_waited = (now - target_run).num_milliseconds() as f64 / (60.0 * 60.0 * 1000.0);

    let mut runs = vec![ForecastRun {
        date: date.clone(),
        hour: hour.clone(),
        full_date: target_run,
        hours_waited,
    }];

    // Add nearby runs as fallbacks (±6h)
    for offset in [-6, 6] {
        let fallback_time = target_run + Duration::hours(offset);
        let fallback_hour = fallback_time.hour();

        let fb_date = format!(
            "{}{}{}",
            fallback_time.year(),
            format!("{:02}", fallback_time.month()),
            format!("{:02}", fallback_time.day())
        );
        let fb_hour = format!("{:02}", fallback_hour);
        let fb_hours_waited =
            (now - fallback_time).num_milliseconds() as f64 / (60.0 * 60.0 * 1000.0);

        runs.push(ForecastRun {
            date: fb_date,
            hour: fb_hour,
            full_date: fallback_time,
            hours_waited: fb_hours_waited,
        });
    }

    runs
}

/// Download wind data from NOAA OpenDAP service with automatic fallback
pub async fn download_wind_data_opendap(
    forecast_offset: i32,
    run_age: i64,
    lat_min: f64,
    lat_max: f64,
    lon_min: f64,
    lon_max: f64,
) -> Result<DownloadedWindData> {
    // If runAge is specified, calculate the specific historical run to fetch
    let available_runs = if run_age > 0 {
        info!("Targeting historical run from {}h ago", run_age);
        get_historical_forecast_run(run_age)
    } else {
        info!("Available forecast runs to try (in order):");
        get_available_forecast_runs()
    };

    for (i, run) in available_runs.iter().enumerate() {
        info!(
            "  {}. {} {}Z ({:.1}h ago)",
            i + 1,
            run.date,
            run.hour,
            run.hours_waited
        );
    }

    // Try each run until we find one that works
    let mut last_error = None;

    for run in &available_runs {
        info!(
            "Attempting to fetch GFS data for {} {}Z f{:03} via OpenDAP...",
            run.date, run.hour, forecast_offset
        );

        match download_wind_data_for_run(
            &run.date,
            &run.hour,
            forecast_offset,
            lat_min,
            lat_max,
            lon_min,
            lon_max,
        )
        .await
        {
            Ok(mut data) => {
                info!("✓ Successfully fetched data from {} {}Z", run.date, run.hour);
                data.run_name = format!("{} {}Z", run.date, run.hour);
                data.data_time = run.full_date.to_rfc3339();
                data.forecast_offset = forecast_offset;
                return Ok(data);
            }
            Err(e) => {
                error!("✗ Failed to fetch {} {}Z: {}", run.date, run.hour, e);
                last_error = Some(e);
            }
        }
    }

    Err(last_error.unwrap_or_else(|| anyhow::anyhow!("All forecast runs failed")))
}

/// Download wind data for a specific forecast run
async fn download_wind_data_for_run(
    date: &str,
    hour: &str,
    forecast_offset: i32,
    lat_min: f64,
    lat_max: f64,
    lon_min: f64,
    lon_max: f64,
) -> Result<DownloadedWindData> {
    let base_url = format!(
        "https://nomads.ncep.noaa.gov/dods/gfs_0p50/gfs{}/gfs_0p50_{}z",
        date, hour
    );

    // Calculate latitude indices
    let lat_start_index = ((lat_min + 90.0) / 0.5).floor() as i32;
    let lat_end_index = ((lat_max + 90.0) / 0.5).floor() as i32;

    // Handle longitude wraparound
    let needs_wrap = lon_min < 0.0;

    info!(
        "Grid indices: time={}, lat={}:{}",
        forecast_offset, lat_start_index, lat_end_index
    );
    info!("Zone: {}° to {}° (Global coverage)", lon_min, lon_max);

    let (all_lat_values, all_lon_values, all_u_values, all_v_values) = if needs_wrap {
        info!("Handling longitude wraparound with two requests...");

        // Western part: lonMin to 0° (converted to 360+lonMin to 359.5°)
        let west_lon_start = ((360.0 + lon_min) / 0.5).floor() as i32;
        let west_lon_end = 719; // Last index (359.5°)

        info!(
            "  West: lon indices {}:{} ({}° to -0.5°)",
            west_lon_start, west_lon_end, lon_min
        );

        let west_constraint = format!(
            ".ascii?ugrd10m[{}:1:{}][{}:1:{}][{}:1:{}],vgrd10m[{}:1:{}][{}:1:{}][{}:1:{}],lat[{}:1:{}],lon[{}:{}]",
            forecast_offset, forecast_offset,
            lat_start_index, lat_end_index,
            west_lon_start, west_lon_end,
            forecast_offset, forecast_offset,
            lat_start_index, lat_end_index,
            west_lon_start, west_lon_end,
            lat_start_index, lat_end_index,
            west_lon_start, west_lon_end
        );
        let west_url = format!("{}{}", base_url, west_constraint);

        info!("Fetching west: {}...", &west_url[..150.min(west_url.len())]);

        let client = reqwest::Client::new();
        let west_response = client
            .get(&west_url)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await
            .context("West data request failed")?;

        if !west_response.status().is_success() {
            anyhow::bail!("West data request failed: {}", west_response.status());
        }

        let west_ascii = west_response.text().await?;

        if west_ascii.trim().starts_with('<') || west_ascii.contains("<!DOCTYPE") {
            let error_msg = extract_opendap_error(&west_ascii);
            anyhow::bail!("OpenDAP error (west): {}", error_msg);
        }

        let west_data = parse_opendap_ascii(&west_ascii)?;

        // Convert longitudes from 350-359.5 to -10 to -0.5
        let west_lons: Vec<f64> = west_data.lon_values.iter().map(|lon| lon - 360.0).collect();

        // Eastern part: 0° to lonMax°
        let east_lon_start = 0;
        let east_lon_end = (lon_max / 0.5).floor() as i32;

        info!("  East: lon indices {}:{} (0° to {}°)", east_lon_start, east_lon_end, lon_max);

        let east_constraint = format!(
            ".ascii?ugrd10m[{}:1:{}][{}:1:{}][{}:1:{}],vgrd10m[{}:1:{}][{}:1:{}][{}:1:{}],lat[{}:1:{}],lon[{}:{}]",
            forecast_offset, forecast_offset,
            lat_start_index, lat_end_index,
            east_lon_start, east_lon_end,
            forecast_offset, forecast_offset,
            lat_start_index, lat_end_index,
            east_lon_start, east_lon_end,
            lat_start_index, lat_end_index,
            east_lon_start, east_lon_end
        );
        let east_url = format!("{}{}", base_url, east_constraint);

        info!("Fetching east: {}...", &east_url[..150.min(east_url.len())]);

        let east_response = client
            .get(&east_url)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await
            .context("East data request failed")?;

        if !east_response.status().is_success() {
            anyhow::bail!("East data request failed: {}", east_response.status());
        }

        let east_ascii = east_response.text().await?;

        if east_ascii.trim().starts_with('<') || east_ascii.contains("<!DOCTYPE") {
            let error_msg = extract_opendap_error(&east_ascii);
            anyhow::bail!("OpenDAP error (east): {}", error_msg);
        }

        let east_data = parse_opendap_ascii(&east_ascii)?;

        // Combine west and east data
        let all_lat_values = west_data.lat_values.clone();
        let west_lon_count = west_data.lon_values.len();
        let east_lon_count = east_data.lon_values.len();
        let all_lon_values = [west_lons, east_data.lon_values].concat();

        // Wind data: interleave by rows
        let num_lats = all_lat_values.len();

        let mut all_u_values = Vec::new();
        let mut all_v_values = Vec::new();

        for lat_idx in 0..num_lats {
            let west_row_start = lat_idx * west_lon_count;
            let east_row_start = lat_idx * east_lon_count;

            // Add west row
            for i in 0..west_lon_count {
                all_u_values.push(west_data.u_data[west_row_start + i]);
                all_v_values.push(west_data.v_data[west_row_start + i]);
            }

            // Add east row
            for i in 0..east_lon_count {
                all_u_values.push(east_data.u_data[east_row_start + i]);
                all_v_values.push(east_data.v_data[east_row_start + i]);
            }
        }

        info!(
            "Combined: {} lats, {} lons, {} total points",
            all_lat_values.len(),
            all_lon_values.len(),
            all_u_values.len()
        );

        (all_lat_values, all_lon_values, all_u_values, all_v_values)
    } else {
        // Single request: no wraparound
        let lon_start = (lon_min / 0.5).floor() as i32;
        let lon_end = (lon_max / 0.5).floor() as i32;

        info!("Single request: lon indices {}:{}", lon_start, lon_end);

        let constraint = format!(
            ".ascii?ugrd10m[{}:1:{}][{}:1:{}][{}:1:{}],vgrd10m[{}:1:{}][{}:1:{}][{}:1:{}],lat[{}:1:{}],lon[{}:{}]",
            forecast_offset, forecast_offset,
            lat_start_index, lat_end_index,
            lon_start, lon_end,
            forecast_offset, forecast_offset,
            lat_start_index, lat_end_index,
            lon_start, lon_end,
            lat_start_index, lat_end_index,
            lon_start, lon_end
        );
        let data_url = format!("{}{}", base_url, constraint);

        info!("Fetching: {}...", &data_url[..150.min(data_url.len())]);

        let client = reqwest::Client::new();
        let data_response = client
            .get(&data_url)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await
            .context("Data request failed")?;

        if !data_response.status().is_success() {
            anyhow::bail!("Data request failed: {}", data_response.status());
        }

        let ascii_data = data_response.text().await?;
        info!("Downloaded {} bytes of ASCII data", ascii_data.len());

        if ascii_data.trim().starts_with('<')
            || ascii_data.contains("<!DOCTYPE")
            || ascii_data.contains("<html")
        {
            let error_msg = extract_opendap_error(&ascii_data);
            anyhow::bail!("OpenDAP error: {}", error_msg);
        }

        let parsed_data = parse_opendap_ascii(&ascii_data)?;

        (
            parsed_data.lat_values,
            parsed_data.lon_values,
            parsed_data.u_data,
            parsed_data.v_data,
        )
    };

    // Build final wind data structure
    let width = all_lon_values.len();
    let height = all_lat_values.len();

    if width == 0 || height == 0 || all_u_values.is_empty() {
        anyhow::bail!(
            "Invalid parsed data: width={}, height={}, uValues={}",
            width,
            height,
            all_u_values.len()
        );
    }

    // Calculate min/max
    let u_min = all_u_values
        .iter()
        .cloned()
        .fold(f64::INFINITY, f64::min);
    let u_max = all_u_values
        .iter()
        .cloned()
        .fold(f64::NEG_INFINITY, f64::max);
    let v_min = all_v_values
        .iter()
        .cloned()
        .fold(f64::INFINITY, f64::min);
    let v_max = all_v_values
        .iter()
        .cloned()
        .fold(f64::NEG_INFINITY, f64::max);

    // Convert to PNG
    let wind_png_data =
        convert_to_png(width, height, &all_u_values, &all_v_values, u_min, u_max, v_min, v_max)?;

    // Create wind points
    let mut wind_points = Vec::with_capacity(width * height);
    for y in 0..height {
        for x in 0..width {
            let idx = y * width + x;
            let lat = all_lat_values[y];
            let lon = all_lon_values[x];
            let u = all_u_values[idx];
            let v = all_v_values[idx];

            wind_points.push(WindPoint::new(lat, lon, u, v));
        }
    }

    let metadata = WindMetadata {
        source: "NOAA GFS 0.5° via OpenDAP".to_string(),
        date: Utc::now().to_rfc3339(),
        width,
        height,
        u_min,
        u_max,
        v_min,
        v_max,
        tiles: vec!["/api/windgl/wind.png".to_string()],
    };

    Ok(DownloadedWindData {
        png_buffer: wind_png_data.png_buffer,
        metadata,
        wind_points,
        run_name: String::new(),
        data_time: String::new(),
        forecast_offset: 0,
    })
}

/// Download precipitation data from NOAA OpenDAP service
pub async fn download_precipitation_data_opendap(
    forecast_offset: i32,
    run_age: i64,
    lat_min: f64,
    lat_max: f64,
    lon_min: f64,
    lon_max: f64,
) -> Result<DownloadedPrecipitationData> {
    let available_runs = if run_age > 0 {
        info!("Targeting historical precipitation run from {}h ago", run_age);
        get_historical_forecast_run(run_age)
    } else {
        info!("Available forecast runs to try for precipitation (in order):");
        get_available_forecast_runs()
    };

    for (i, run) in available_runs.iter().enumerate() {
        info!(
            "  {}. {} {}Z ({:.1}h ago)",
            i + 1,
            run.date,
            run.hour,
            run.hours_waited
        );
    }

    let mut last_error = None;

    for run in &available_runs {
        info!(
            "Attempting to fetch precipitation data for {} {}Z f{:03} via OpenDAP...",
            run.date, run.hour, forecast_offset
        );

        match download_precipitation_data_for_run(
            &run.date,
            &run.hour,
            forecast_offset,
            lat_min,
            lat_max,
            lon_min,
            lon_max,
        )
        .await
        {
            Ok(mut data) => {
                info!("✓ Successfully fetched precipitation from {} {}Z", run.date, run.hour);
                data.run_name = format!("{} {}Z", run.date, run.hour);
                data.data_time = run.full_date.to_rfc3339();
                data.forecast_offset = forecast_offset;
                return Ok(data);
            }
            Err(e) => {
                error!("✗ Failed to fetch precipitation {} {}Z: {}", run.date, run.hour, e);
                last_error = Some(e);
            }
        }
    }

    Err(last_error.unwrap_or_else(|| anyhow::anyhow!("All forecast runs failed for precipitation")))
}

/// Download precipitation data for a specific forecast run
async fn download_precipitation_data_for_run(
    date: &str,
    hour: &str,
    forecast_offset: i32,
    lat_min: f64,
    lat_max: f64,
    lon_min: f64,
    lon_max: f64,
) -> Result<DownloadedPrecipitationData> {
    let base_url = format!(
        "https://nomads.ncep.noaa.gov/dods/gfs_0p50/gfs{}/gfs_0p50_{}z",
        date, hour
    );

    let lat_start_index = ((lat_min + 90.0) / 0.5).floor() as i32;
    let lat_end_index = ((lat_max + 90.0) / 0.5).floor() as i32;
    let needs_wrap = lon_min < 0.0;

    info!(
        "Grid indices: time={}, lat={}:{}",
        forecast_offset, lat_start_index, lat_end_index
    );
    info!("Zone: {}° to {}° (Global coverage)", lon_min, lon_max);

    let (all_lat_values, all_lon_values, all_prate_values) = if needs_wrap {
        info!("Handling longitude wraparound with two requests...");

        // Western part
        let west_lon_start = ((360.0 + lon_min) / 0.5).floor() as i32;
        let west_lon_end = 719;

        info!(
            "  West: lon indices {}:{} ({}° to -0.5°)",
            west_lon_start, west_lon_end, lon_min
        );

        let west_constraint = format!(
            ".ascii?pratesfc[{}:1:{}][{}:1:{}][{}:1:{}],lat[{}:1:{}],lon[{}:{}]",
            forecast_offset, forecast_offset,
            lat_start_index, lat_end_index,
            west_lon_start, west_lon_end,
            lat_start_index, lat_end_index,
            west_lon_start, west_lon_end
        );
        let west_url = format!("{}{}", base_url, west_constraint);

        info!("Fetching west precipitation: {}...", &west_url[..150.min(west_url.len())]);

        let client = reqwest::Client::new();
        let west_response = client
            .get(&west_url)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await?;

        if !west_response.status().is_success() {
            anyhow::bail!("West precipitation request failed: {}", west_response.status());
        }

        let west_ascii = west_response.text().await?;

        if west_ascii.trim().starts_with('<') || west_ascii.contains("<!DOCTYPE") {
            let error_msg = extract_opendap_error(&west_ascii);
            anyhow::bail!("OpenDAP error (west precipitation): {}", error_msg);
        }

        let west_data = parse_opendap_precipitation_ascii(&west_ascii)?;
        let west_lons: Vec<f64> = west_data.lon_values.iter().map(|lon| lon - 360.0).collect();

        // Eastern part
        let east_lon_start = 0;
        let east_lon_end = (lon_max / 0.5).floor() as i32;

        info!("  East: lon indices {}:{} (0° to {}°)", east_lon_start, east_lon_end, lon_max);

        let east_constraint = format!(
            ".ascii?pratesfc[{}:1:{}][{}:1:{}][{}:1:{}],lat[{}:1:{}],lon[{}:{}]",
            forecast_offset, forecast_offset,
            lat_start_index, lat_end_index,
            east_lon_start, east_lon_end,
            lat_start_index, lat_end_index,
            east_lon_start, east_lon_end
        );
        let east_url = format!("{}{}", base_url, east_constraint);

        info!("Fetching east precipitation: {}...", &east_url[..150.min(east_url.len())]);

        let east_response = client
            .get(&east_url)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await?;

        if !east_response.status().is_success() {
            anyhow::bail!("East precipitation request failed: {}", east_response.status());
        }

        let east_ascii = east_response.text().await?;

        if east_ascii.trim().starts_with('<') || east_ascii.contains("<!DOCTYPE") {
            let error_msg = extract_opendap_error(&east_ascii);
            anyhow::bail!("OpenDAP error (east precipitation): {}", error_msg);
        }

        let east_data = parse_opendap_precipitation_ascii(&east_ascii)?;

        // Combine west and east data
        let all_lat_values = west_data.lat_values.clone();
        let west_lon_count = west_data.lon_values.len();
        let east_lon_count = east_data.lon_values.len();
        let all_lon_values = [west_lons, east_data.lon_values].concat();

        let num_lats = all_lat_values.len();

        let mut all_prate_values = Vec::new();

        for lat_idx in 0..num_lats {
            let west_row_start = lat_idx * west_lon_count;
            let east_row_start = lat_idx * east_lon_count;

            for i in 0..west_lon_count {
                all_prate_values.push(west_data.prate_data[west_row_start + i]);
            }

            for i in 0..east_lon_count {
                all_prate_values.push(east_data.prate_data[east_row_start + i]);
            }
        }

        info!(
            "Combined precipitation: {} lats, {} lons, {} total points",
            all_lat_values.len(),
            all_lon_values.len(),
            all_prate_values.len()
        );

        (all_lat_values, all_lon_values, all_prate_values)
    } else {
        // Single request: no wraparound
        let lon_start = (lon_min / 0.5).floor() as i32;
        let lon_end = (lon_max / 0.5).floor() as i32;

        info!("Single request: lon indices {}:{}", lon_start, lon_end);

        let constraint = format!(
            ".ascii?pratesfc[{}:1:{}][{}:1:{}][{}:1:{}],lat[{}:1:{}],lon[{}:{}]",
            forecast_offset, forecast_offset,
            lat_start_index, lat_end_index,
            lon_start, lon_end,
            lat_start_index, lat_end_index,
            lon_start, lon_end
        );
        let data_url = format!("{}{}", base_url, constraint);

        info!("Fetching precipitation: {}...", &data_url[..150.min(data_url.len())]);

        let client = reqwest::Client::new();
        let data_response = client
            .get(&data_url)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await?;

        if !data_response.status().is_success() {
            anyhow::bail!("Precipitation data request failed: {}", data_response.status());
        }

        let ascii_data = data_response.text().await?;
        info!("Downloaded {} bytes of precipitation ASCII data", ascii_data.len());

        if ascii_data.trim().starts_with('<')
            || ascii_data.contains("<!DOCTYPE")
            || ascii_data.contains("<html")
        {
            let error_msg = extract_opendap_error(&ascii_data);
            anyhow::bail!("OpenDAP error: {}", error_msg);
        }

        let parsed_data = parse_opendap_precipitation_ascii(&ascii_data)?;

        (
            parsed_data.lat_values,
            parsed_data.lon_values,
            parsed_data.prate_data,
        )
    };

    // Create precipitation points
    // Convert kg/m²/s to mm/h (1 kg/m²/s = 3600 mm/h)
    let width = all_lon_values.len();
    let height = all_lat_values.len();
    let mut precip_points = Vec::with_capacity(width * height);

    for y in 0..height {
        for x in 0..width {
            let idx = y * width + x;
            let lat = all_lat_values[y];
            let lon = all_lon_values[x];
            let rate_kg_per_m2s = all_prate_values[idx];
            let rate_mm_per_hour = rate_kg_per_m2s * 3600.0; // Convert to mm/h

            precip_points.push(PrecipitationPoint::new(lat, lon, rate_mm_per_hour));
        }
    }

    Ok(DownloadedPrecipitationData {
        precip_points,
        run_name: String::new(),
        data_time: String::new(),
        forecast_offset: 0,
    })
}

/// Extract error message from OpenDAP HTML error page
fn extract_opendap_error(html: &str) -> String {
    if let Some(start) = html.find("<b>") {
        if let Some(end) = html[start..].find("</b>") {
            let error_text = &html[start + 3..start + end];
            if error_text.contains("is not an available dataset") {
                return error_text.to_string();
            }
        }
    }
    "Unknown OpenDAP error".to_string()
}
