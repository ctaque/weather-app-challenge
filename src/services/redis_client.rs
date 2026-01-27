use anyhow::{Context, Result};
use base64::{engine::general_purpose, Engine as _};
use redis::{aio::ConnectionManager, AsyncCommands, Client};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::info;

const REDIS_TTL: u64 = 60 * 60; // 1 hour in seconds
const MAX_SIZE: usize = 8 * 1024 * 1024; // 8 MB

#[derive(Clone)]
pub struct RedisClient {
    conn: Arc<ConnectionManager>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexEntry {
    pub index: u32,
    pub timestamp: String,
    #[serde(rename = "dataPoints")]
    pub data_points: usize,
    #[serde(rename = "runName")]
    pub run_name: Option<String>,
    #[serde(rename = "dataTime")]
    pub data_time: Option<String>,
    #[serde(rename = "hoursBack")]
    pub hours_back: Option<f64>,
    #[serde(rename = "forecastOffset")]
    pub forecast_offset: Option<i32>,
    #[serde(rename = "runAge")]
    pub run_age: Option<String>,
}

impl RedisClient {
    pub async fn new(redis_url: &str) -> Result<Self> {
        info!("Connecting to Redis at {}", redis_url);

        let client = Client::open(redis_url)
            .context("Failed to create Redis client")?;

        let conn = ConnectionManager::new(client)
            .await
            .context("Failed to connect to Redis")?;

        info!("Redis: Connected and ready");

        Ok(Self {
            conn: Arc::new(conn),
        })
    }

    /// Store wind data in Redis with automatic chunking for large datasets
    pub async fn set_wind_data(&self, data: &serde_json::Value, key: &str) -> Result<()> {
        let data_string = serde_json::to_string(data)?;
        let data_size = data_string.as_bytes().len();

        if data_size > MAX_SIZE {
            // Check if data is an array or object with large 'points' property
            if let Some(arr) = data.as_array() {
                self.store_chunked_array(arr, key).await?;
            } else if let Some(obj) = data.as_object() {
                if let Some(points) = obj.get("points").and_then(|p| p.as_array()) {
                    self.store_chunked_object(obj, points, key).await?;
                } else {
                    anyhow::bail!(
                        "Data too large ({} bytes) and cannot be chunked automatically",
                        data_size
                    );
                }
            } else {
                anyhow::bail!(
                    "Data too large ({} bytes) and cannot be chunked automatically",
                    data_size
                );
            }
        } else {
            // Store normally if small enough
            let mut conn = self.conn.as_ref().clone();
            conn.set_ex::<_, _, ()>(key, data_string, REDIS_TTL).await?;
            info!("Redis: Stored wind data at key '{}' with TTL {}s", key, REDIS_TTL);
        }

        Ok(())
    }

    async fn store_chunked_array(&self, arr: &[serde_json::Value], key: &str) -> Result<()> {
        let data_string = serde_json::to_string(arr)?;
        let data_size = data_string.as_bytes().len();

        let chunk_size = (arr.len() as f64 / (data_size as f64 / MAX_SIZE as f64).ceil()).ceil() as usize;
        let chunks: Vec<&[serde_json::Value]> = arr.chunks(chunk_size).collect();

        info!(
            "Redis: Array too large ({} bytes), splitting into {} chunks...",
            data_size,
            chunks.len()
        );

        let mut conn = self.conn.as_ref().clone();

        // Store chunk count
        conn.set_ex::<_, _, ()>(
            format!("{}:chunks", key),
            chunks.len().to_string(),
            REDIS_TTL,
        )
        .await?;

        // Store each chunk
        for (i, chunk) in chunks.iter().enumerate() {
            let chunk_key = format!("{}:chunk:{}", key, i);
            let chunk_string = serde_json::to_string(chunk)?;
            conn.set_ex::<_, _, ()>(chunk_key, chunk_string, REDIS_TTL).await?;
        }

        info!(
            "Redis: Stored {} items in {} chunks at key '{}' with TTL {}s",
            arr.len(),
            chunks.len(),
            key,
            REDIS_TTL
        );

        Ok(())
    }

    async fn store_chunked_object(
        &self,
        obj: &serde_json::Map<String, serde_json::Value>,
        points: &[serde_json::Value],
        key: &str,
    ) -> Result<()> {
        let data_string = serde_json::to_string(obj)?;
        let data_size = data_string.as_bytes().len();

        let chunk_size = (points.len() as f64 / (data_size as f64 / MAX_SIZE as f64).ceil()).ceil() as usize;
        let chunks: Vec<&[serde_json::Value]> = points.chunks(chunk_size).collect();

        info!(
            "Redis: Object with large points array ({} bytes), splitting points into {} chunks...",
            data_size,
            chunks.len()
        );

        // Create metadata without points
        let mut meta = obj.clone();
        meta.remove("points");

        let mut conn = self.conn.as_ref().clone();

        // Store metadata
        conn.set_ex::<_, _, ()>(
            format!("{}:meta", key),
            serde_json::to_string(&meta)?,
            REDIS_TTL,
        )
        .await?;

        // Store chunk count
        conn.set_ex::<_, _, ()>(
            format!("{}:chunks", key),
            chunks.len().to_string(),
            REDIS_TTL,
        )
        .await?;

        // Store each chunk
        for (i, chunk) in chunks.iter().enumerate() {
            let chunk_key = format!("{}:chunk:{}", key, i);
            let chunk_string = serde_json::to_string(chunk)?;
            conn.set_ex::<_, _, ()>(chunk_key, chunk_string, REDIS_TTL).await?;
        }

        info!(
            "Redis: Stored {} points in {} chunks at key '{}' with TTL {}s",
            points.len(),
            chunks.len(),
            key,
            REDIS_TTL
        );

        Ok(())
    }

    /// Get wind data from Redis with automatic chunk reassembly
    pub async fn get_wind_data(&self, key: &str) -> Result<Option<serde_json::Value>> {
        let mut conn = self.conn.as_ref().clone();

        // Check if data is chunked
        let chunk_count: Option<String> = conn.get(format!("{}:chunks", key)).await?;

        if let Some(chunk_count_str) = chunk_count {
            let num_chunks: usize = chunk_count_str.parse()?;

            info!("Redis: Retrieving {} chunks from key '{}'...", num_chunks, key);

            // Check if there's metadata
            let meta_data: Option<String> = conn.get(format!("{}:meta", key)).await?;

            // Retrieve all chunks
            let mut points = Vec::new();
            for i in 0..num_chunks {
                let chunk_key = format!("{}:chunk:{}", key, i);
                let chunk_data: Option<String> = conn.get(&chunk_key).await?;

                if let Some(chunk_str) = chunk_data {
                    let chunk: Vec<serde_json::Value> = serde_json::from_str(&chunk_str)?;
                    points.extend(chunk);
                }
            }

            if let Some(meta_str) = meta_data {
                // Reconstruct object with points
                let mut metadata: serde_json::Map<String, serde_json::Value> =
                    serde_json::from_str(&meta_str)?;
                metadata.insert("points".to_string(), serde_json::json!(points));

                info!(
                    "Redis: Retrieved and merged {} chunks ({} points) from key '{}'",
                    num_chunks,
                    points.len(),
                    key
                );

                Ok(Some(serde_json::Value::Object(metadata)))
            } else {
                // Return merged array
                info!(
                    "Redis: Retrieved and merged {} chunks ({} items) from key '{}'",
                    num_chunks,
                    points.len(),
                    key
                );

                Ok(Some(serde_json::json!(points)))
            }
        } else {
            // Retrieve normal (non-chunked) data
            let data: Option<String> = conn.get(key).await?;

            if let Some(data_str) = data {
                info!("Redis: Retrieved wind data from key '{}'", key);
                Ok(Some(serde_json::from_str(&data_str)?))
            } else {
                info!("Redis: No data found at key '{}'", key);
                Ok(None)
            }
        }
    }

    /// Store binary data (PNG image) in Redis with base64 encoding
    pub async fn set_binary_data(&self, buffer: &[u8], key: &str) -> Result<()> {
        let base64_data = general_purpose::STANDARD.encode(buffer);

        let mut conn = self.conn.as_ref().clone();
        conn.set_ex::<_, _, ()>(key, base64_data, REDIS_TTL).await?;

        info!(
            "Redis: Stored binary data at key '{}' ({} bytes) with TTL {}s",
            key,
            buffer.len(),
            REDIS_TTL
        );

        Ok(())
    }

    /// Get binary data from Redis with base64 decoding
    pub async fn get_binary_data(&self, key: &str) -> Result<Option<Vec<u8>>> {
        let mut conn = self.conn.as_ref().clone();
        let base64_data: Option<String> = conn.get(key).await?;

        if let Some(data_str) = base64_data {
            let buffer = general_purpose::STANDARD.decode(&data_str)?;

            info!(
                "Redis: Retrieved binary data from key '{}' ({} bytes)",
                key,
                buffer.len()
            );

            Ok(Some(buffer))
        } else {
            info!("Redis: No binary data found at key '{}'", key);
            Ok(None)
        }
    }

    /// Store wind data with index for historical tracking
    pub async fn set_wind_data_with_index(
        &self,
        data: &serde_json::Value,
        base_key: &str,
        max_history: usize,
    ) -> Result<u32> {
        let mut conn = self.conn.as_ref().clone();

        // Get current index
        let current_index_str: Option<String> = conn.get(format!("{}:current_index", base_key)).await?;
        let mut current_index: u32 = current_index_str
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        // Get existing indices list
        let indices_str: Option<String> = conn.get(format!("{}:indices", base_key)).await?;
        let mut indices: Vec<IndexEntry> = indices_str
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();

        // Extract metadata from data
        let data_time = data.get("dataTime").and_then(|v| v.as_str()).map(String::from);
        let run_name = data.get("runName").and_then(|v| v.as_str()).map(String::from);
        let hours_back = data.get("hoursBack").and_then(|v| v.as_f64());
        let forecast_offset = data.get("forecastOffset").and_then(|v| v.as_i64()).map(|v| v as i32);
        let run_age = data.get("runAge").and_then(|v| v.as_str()).map(String::from);

        // Check for duplicate entry (within 2h tolerance)
        let tolerance_ms = 2 * 60 * 60 * 1000; // 2 hours
        let existing_entry_index = if let Some(dt) = &data_time {
            if let Ok(data_time_ms) = chrono::DateTime::parse_from_rfc3339(dt) {
                indices.iter().position(|idx| {
                    if let Some(existing_dt) = &idx.data_time {
                        if let Ok(existing_time_ms) = chrono::DateTime::parse_from_rfc3339(existing_dt) {
                            let diff = (data_time_ms.timestamp_millis() - existing_time_ms.timestamp_millis()).abs();
                            return diff < tolerance_ms;
                        }
                    }
                    false
                })
            } else {
                None
            }
        } else {
            None
        };

        // Update or create entry
        if let Some(idx_pos) = existing_entry_index {
            let existing_entry = &indices[idx_pos];
            info!(
                "Redis: Updating existing entry at index {} for {:?}",
                existing_entry.index, data_time
            );
            current_index = existing_entry.index;

            indices[idx_pos] = IndexEntry {
                index: current_index,
                timestamp: chrono::Utc::now().to_rfc3339(),
                data_points: Self::count_data_points(data),
                run_name: run_name.clone(),
                data_time: data_time.clone(),
                hours_back,
                forecast_offset,
                run_age: run_age.clone(),
            };
        } else {
            // Create new entry
            let index_entry = IndexEntry {
                index: current_index,
                timestamp: chrono::Utc::now().to_rfc3339(),
                data_points: Self::count_data_points(data),
                run_name: run_name.clone(),
                data_time: data_time.clone(),
                hours_back,
                forecast_offset,
                run_age: run_age.clone(),
            };

            indices.push(index_entry);
        }

        // Store the data with the index
        let indexed_key = format!("{}:{}", base_key, current_index);
        self.set_wind_data(data, &indexed_key).await?;

        // Keep only the last maxHistory entries
        if indices.len() > max_history {
            let old_indices: Vec<_> = indices.drain(..indices.len() - max_history).collect();

            // Delete old data
            for old_index in old_indices {
                let old_key = format!("{}:{}", base_key, old_index.index);
                self.delete_data(&old_key).await?;
                info!("Redis: Deleted old data at index {}", old_index.index);
            }
        }

        // Store updated indices list
        conn.set_ex::<_, _, ()>(
            format!("{}:indices", base_key),
            serde_json::to_string(&indices)?,
            REDIS_TTL,
        )
        .await?;

        // Update current index for next time (only if we created a new entry)
        if existing_entry_index.is_none() {
            let next_index = current_index + 1;
            conn.set_ex::<_, _, ()>(
                format!("{}:current_index", base_key),
                next_index.to_string(),
                REDIS_TTL,
            )
            .await?;
        }

        // Also store as latest (backward compatibility)
        self.set_wind_data(data, base_key).await?;

        info!(
            "Redis: Stored data at index {}, total history: {}",
            current_index,
            indices.len()
        );

        Ok(current_index)
    }

    /// Store binary data with index
    pub async fn set_binary_data_with_index(
        &self,
        buffer: &[u8],
        base_key: &str,
        index: u32,
    ) -> Result<()> {
        let indexed_key = format!("{}:{}", base_key, index);
        self.set_binary_data(buffer, &indexed_key).await?;

        // Also store as latest (backward compatibility)
        self.set_binary_data(buffer, base_key).await?;

        info!("Redis: Stored binary data at index {}", index);
        Ok(())
    }

    /// Get wind data by index
    pub async fn get_wind_data_by_index(
        &self,
        base_key: &str,
        index: u32,
    ) -> Result<Option<serde_json::Value>> {
        let indexed_key = format!("{}:{}", base_key, index);
        self.get_wind_data(&indexed_key).await
    }

    /// Get binary data by index
    pub async fn get_binary_data_by_index(
        &self,
        base_key: &str,
        index: u32,
    ) -> Result<Option<Vec<u8>>> {
        let indexed_key = format!("{}:{}", base_key, index);
        self.get_binary_data(&indexed_key).await
    }

    /// Get list of available indices with timestamps
    pub async fn get_available_indices(&self, base_key: &str) -> Result<Vec<IndexEntry>> {
        let mut conn = self.conn.as_ref().clone();
        let indices_str: Option<String> = conn.get(format!("{}:indices", base_key)).await?;

        if let Some(indices_json) = indices_str {
            let mut indices: Vec<IndexEntry> = serde_json::from_str(&indices_json)?;

            // Sort by dataTime (newest first, oldest last)
            indices.sort_by(|a, b| {
                let date_a = a.data_time.as_ref()
                    .and_then(|dt| chrono::DateTime::parse_from_rfc3339(dt).ok())
                    .map(|dt| dt.timestamp_millis())
                    .unwrap_or(0);
                let date_b = b.data_time.as_ref()
                    .and_then(|dt| chrono::DateTime::parse_from_rfc3339(dt).ok())
                    .map(|dt| dt.timestamp_millis())
                    .unwrap_or(0);
                date_b.cmp(&date_a) // Descending order (newest first)
            });

            Ok(indices)
        } else {
            Ok(Vec::new())
        }
    }

    /// Helper to delete data (including chunks)
    async fn delete_data(&self, key: &str) -> Result<()> {
        let mut conn = self.conn.as_ref().clone();

        // Check if chunked
        let chunk_count: Option<String> = conn.get(format!("{}:chunks", key)).await?;

        if let Some(chunk_count_str) = chunk_count {
            let num_chunks: usize = chunk_count_str.parse()?;

            for i in 0..num_chunks {
                let _: () = conn.del(format!("{}:chunk:{}", key, i)).await?;
            }

            let _: () = conn.del(format!("{}:chunks", key)).await?;
            let _: () = conn.del(format!("{}:meta", key)).await?;
        } else {
            let _: () = conn.del(key).await?;
        }

        Ok(())
    }

    /// Helper to count data points
    fn count_data_points(data: &serde_json::Value) -> usize {
        if let Some(arr) = data.as_array() {
            arr.len()
        } else if let Some(obj) = data.as_object() {
            obj.get("points")
                .and_then(|p| p.as_array())
                .map(|a| a.len())
                .unwrap_or(0)
        } else {
            0
        }
    }
}
