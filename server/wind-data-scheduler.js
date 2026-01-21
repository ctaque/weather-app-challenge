const cron = require("node-cron");
const { getWindData, getPrecipitationData } = require("./opendap-downloader");
const {
  setWindData,
  setBinaryData,
  setWindDataWithIndex,
  setBinaryDataWithIndex,
  isRedisConnected,
} = require("./redis-client");

// Keys for different data types in Redis
const REDIS_KEYS = {
  WIND_POINTS: "wind:points",
  WIND_PNG: "wind:png",
  WIND_METADATA: "wind:metadata",
  LAST_UPDATE: "wind:last_update",
  PRECIPITATION_POINTS: "precipitation:points",
};

let isSchedulerRunning = false;
let lastFetchStatus = {
  success: false,
  timestamp: null,
  error: null,
};

/**
 * Calculate the GFS run name (e.g., "20260121_00Z", "20260121_06Z")
 * @param {number} runAge - How many hours back the run is (0 = current, 6 = 6h ago, etc.)
 * @returns {string} - Run name in format YYYYMMDD_HHZ
 */
function calculateRunName(runAge) {
  const runTime = new Date(Date.now() - runAge * 3600000);

  // Round down to the nearest 6-hour cycle
  const hours = runTime.getUTCHours();
  const cycleHour = Math.floor(hours / 6) * 6;

  // Format: YYYYMMDD_HHZ
  const year = runTime.getUTCFullYear();
  const month = String(runTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(runTime.getUTCDate()).padStart(2, '0');
  const cycle = String(cycleHour).padStart(2, '0');

  return `${year}${month}${day}_${cycle}Z`;
}

/**
 * Fetch wind and precipitation data for a specific forecast offset from a specific run
 * @param {number} forecastOffset - Forecast offset (0, 3, 6, etc.)
 * @param {number} runAge - How many hours back to look for the run (0 = current, 6 = 6h ago, etc.)
 */
async function fetchAndStoreSingleForecast(forecastOffset, runAge = 0) {
  // Calculate the actual time this data represents
  // Formula: hoursBack = runAge - forecastOffset
  // Example: Run from 6h ago with f+3 = data for 3h ago (6 - 3 = 3)
  const effectiveHoursBack = runAge - forecastOffset;
  const runName = calculateRunName(runAge);

  console.log(
    `\n=== Fetching data: Run ${runName} + f+${forecastOffset} (${effectiveHoursBack}h ago) ===`,
  );

  try {
    if (!isRedisConnected()) {
      throw new Error("Redis is not connected");
    }

    // Check if this run+offset combination already exists
    const { getAvailableIndices } = require("./redis-client");
    const existingIndices = await getAvailableIndices(REDIS_KEYS.WIND_POINTS);

    const alreadyExists = existingIndices.some(idx =>
      idx.runName === runName && idx.forecastOffset === forecastOffset
    );

    if (alreadyExists) {
      console.log(
        `⏭️  Run ${runName} + f+${forecastOffset} already exists in Redis, skipping`,
      );
      return true; // Return success since data is present
    }

    // Calculate the actual time this data represents (in the past)
    const dataTime = new Date(Date.now() - effectiveHoursBack * 3600000);

    // Download wind data from NOAA GFS via OpenDAP
    console.log(
      `Downloading wind data for run -${runAge}h + f${forecastOffset}...`,
    );
    const { windPoints, pngBuffer, metadata } = await getWindData(
      forecastOffset,
      runAge,
    );

    console.log(`Successfully fetched ${windPoints.length} wind data points`);

    // Store wind points data
    const windData = {
      timestamp: new Date().toISOString(),
      runName: runName, // GFS run identifier (e.g., "20260121_00Z")
      forecastOffset: forecastOffset,
      runAge: runAge,
      dataTime: dataTime.toISOString(), // The actual time this data represents
      hoursBack: effectiveHoursBack,
      source: metadata.source,
      resolution: 0.5,
      points: windPoints,
      region: "Global",
      bounds: {
        lat: [-90, 90],
        lon: [-180, 180],
      },
    };

    // Store data with index (keeps last 20 versions to ensure 2+ complete 24h forecasts)
    const currentIndex = await setWindDataWithIndex(
      windData,
      REDIS_KEYS.WIND_POINTS,
      20,
    );
    console.log(
      `Stored wind points at index ${currentIndex} (${effectiveHoursBack}h ago)`,
    );

    // Store PNG image for windgl with index
    await setBinaryDataWithIndex(pngBuffer, REDIS_KEYS.WIND_PNG, currentIndex);
    console.log(`Stored wind PNG at index ${currentIndex}`);

    // Store metadata with same index
    const metadataIndexedKey = `${REDIS_KEYS.WIND_METADATA}:${currentIndex}`;
    await setWindData(metadata, metadataIndexedKey);
    // Also store as latest for backward compatibility (only for current run f+0)
    if (runAge === 0 && forecastOffset === 0) {
      await setWindData(metadata, REDIS_KEYS.WIND_METADATA);
    }
    console.log(`Stored wind metadata at index ${currentIndex}`);

    // Download and store precipitation data
    console.log(
      `Downloading precipitation data for run -${runAge}h + f${forecastOffset}...`,
    );
    try {
      const { precipPoints, metadata: precipMetadata } =
        await getPrecipitationData(forecastOffset, runAge);
      console.log(
        `Successfully fetched ${precipPoints.length} precipitation data points`,
      );

      const precipData = {
        timestamp: new Date().toISOString(),
        runName: runName, // GFS run identifier (e.g., "20260121_00Z")
        forecastOffset: forecastOffset,
        runAge: runAge,
        dataTime: dataTime.toISOString(),
        hoursBack: effectiveHoursBack,
        source: precipMetadata.source,
        resolution: 0.5,
        points: precipPoints,
        unit: precipMetadata.unit,
        bounds: {
          lat: [-90, 90],
          lon: [-180, 180],
        },
      };

      // Store precipitation data with index (keeps last 20 versions to ensure 2+ complete 24h forecasts)
      const precipIndex = await setWindDataWithIndex(
        precipData,
        REDIS_KEYS.PRECIPITATION_POINTS,
        20,
      );
      console.log(
        `Stored precipitation data at index ${precipIndex} (${effectiveHoursBack}h ago)`,
      );

      // Also store as latest for backward compatibility (only for current run f+0)
      if (runAge === 0 && forecastOffset === 0) {
        await setWindData(precipData, REDIS_KEYS.PRECIPITATION_POINTS);
      }
      console.log("Precipitation data successfully stored in Redis");
    } catch (precipError) {
      console.error(
        `Failed to fetch/store precipitation data for +${forecastOffset}h:`,
        precipError.message,
      );
      // Don't fail the whole process if precipitation fails
    }

    console.log(`=== Data for +${forecastOffset}h successfully stored ===\n`);
    return true;
  } catch (error) {
    console.error(
      `=== Error fetching/storing data for +${forecastOffset}h ===`,
    );
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
    return false;
  }
}

/**
 * Calculate which GFS runs and offsets to fetch to cover the last 24h
 * Returns an array of {runAge, offset} where runAge is hours back from now
 *
 * GFS runs are available every 6h: 00Z, 06Z, 12Z, 18Z
 * To get 8 points over 24h (spaced every 3h), we need:
 * - Data for 0h, 3h, 6h, 9h, 12h, 15h, 18h, 21h in the past
 *
 * Formula: hoursBack = runAge - forecastOffset
 * Example: Run from 6h ago with f+3 = data for 3h ago (6 - 3 = 3)
 */
function calculateHistoricalForecastTargets() {
  const targets = [];

  // We want 8 time points: 0h, 3h, 6h, 9h, 12h, 15h, 18h, 21h ago
  const desiredHoursBack = [0, 3, 6, 9, 12, 15, 18, 21];

  for (const hoursBack of desiredHoursBack) {
    // Find the best run and offset combination
    // We need: runAge - forecastOffset = hoursBack
    // So: forecastOffset = runAge - hoursBack

    // Try to use recent runs with appropriate offsets
    // Prefer using runs at 0h, 6h, 12h, 18h, 24h ago
    let found = false;

    // Try different run ages (prioritize closer runs)
    for (const runAge of [6, 12, 18, 24]) {
      const forecastOffset = runAge - hoursBack;

      // Check if this gives a valid forecast offset (0, 3, 6, 9, etc.)
      // GFS forecasts are available at 3h intervals: 0, 3, 6, 9, 12, etc.
      if (
        forecastOffset >= 0 &&
        forecastOffset % 3 === 0 &&
        forecastOffset <= 24
      ) {
        targets.push({ runAge, offset: forecastOffset });
        found = true;
        break;
      }
    }

    // If no combination found (shouldn't happen with our setup), skip this point
    if (!found) {
      console.warn(`Could not find GFS run/offset for ${hoursBack}h ago`);
    }
  }

  return targets;
}

/**
 * Fetch wind data for the last 24 hours using historical runs
 * Fetches from 4 GFS runs (current, -6h, -12h, -18h) with f+0 and f+3 each
 * This gives 8 data points covering the last 24 hours
 * Note: fetchAndStoreSingleForecast now checks for existing runs automatically
 */
async function fetchHistorical24h() {
  console.log("\n========================================");
  console.log("=== Starting 24h historical data fetch ===");
  console.log("========================================\n");

  const targets = calculateHistoricalForecastTargets();
  let successCount = 0;
  let failureCount = 0;

  console.log("Targets to fetch:");
  targets.forEach((t) => {
    const hoursBack = t.runAge - t.offset;
    const runName = calculateRunName(t.runAge);
    console.log(
      `  ${runName} + f+${t.offset} = data for ${hoursBack}h ago`,
    );
  });
  console.log();

  for (const target of targets) {
    try {
      // fetchAndStoreSingleForecast now checks if run already exists
      const success = await fetchAndStoreSingleForecast(
        target.offset,
        target.runAge,
      );
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }

      // Small delay between fetches to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(
        `Failed to fetch run -${target.runAge}h f+${target.offset}:`,
        error.message,
      );
      failureCount++;
    }
  }

  // Store last update summary
  try {
    await setWindData(
      {
        timestamp: new Date().toISOString(),
        success: successCount > 0,
        successCount: successCount,
        failureCount: failureCount,
        totalForecasts: targets.length,
        targets: targets,
      },
      REDIS_KEYS.LAST_UPDATE,
    );

    lastFetchStatus = {
      success: successCount > 0,
      timestamp: new Date().toISOString(),
      error: failureCount > 0 ? `${failureCount} forecast(s) failed` : null,
      successCount: successCount,
      failureCount: failureCount,
    };
  } catch (redisError) {
    console.error("Failed to store summary in Redis:", redisError);
  }

  console.log("\n========================================");
  console.log(
    `=== Fetch complete: ${successCount} success, ${failureCount} failures ===`,
  );
  console.log("========================================\n");

  return successCount > 0;
}

/**
 * Fetch only the latest forecast (current run, f+0)
 * Only stores if it's different from the last stored forecast
 */
async function fetchLatestForecast() {
  console.log("\n=== Checking for latest forecast ===");

  try {
    const { getAvailableIndices } = require("./redis-client");

    // Calculate the current run name
    const currentRunName = calculateRunName(0);
    const forecastOffset = 0;

    // Get existing indices to check if this run already exists
    const existingIndices = await getAvailableIndices(REDIS_KEYS.WIND_POINTS);

    // Check if we already have this run + forecast offset
    const alreadyExists = existingIndices.some(idx =>
      idx.runName === currentRunName && idx.forecastOffset === forecastOffset
    );

    if (alreadyExists) {
      console.log(
        `Latest forecast ${currentRunName} + f+${forecastOffset} already exists, skipping`,
      );
      return true;
    }

    // Fetch the latest forecast (run age 0, forecast offset 0)
    console.log(`Fetching latest forecast ${currentRunName} + f+0...`);
    const success = await fetchAndStoreSingleForecast(0, 0);

    if (success) {
      console.log("=== Latest forecast stored successfully ===\n");
    } else {
      console.log("=== Failed to fetch latest forecast ===\n");
    }

    return success;
  } catch (error) {
    console.error("Error fetching latest forecast:", error.message);
    return false;
  }
}

/**
 * Start the scheduler
 * Runs every 5 minutes
 * Fetches the latest forecast if it's new
 */
function startScheduler() {
  if (isSchedulerRunning) {
    console.log("Wind data scheduler is already running");
    return;
  }

  console.log("Starting wind data scheduler...");
  console.log("Schedule: Every 5 minutes (cron: */5 * * * *)");
  console.log("Initial: Fetch last 24h | Recurring: Check for latest forecast\n");

  // Run 24h historical fetch on startup (automatically skips existing runs)
  console.log("Running initial 24h historical data fetch...");
  fetchHistorical24h().catch((err) => {
    console.error("Initial 24h fetch failed:", err.message);
  });

  // Schedule recurring fetches - every 5 minutes
  // Only fetches latest if it's new
  cron.schedule("*/5 * * * *", async () => {
    console.log(
      `\n[${new Date().toISOString()}] Scheduled latest forecast check triggered`,
    );
    await fetchLatestForecast();
  });

  isSchedulerRunning = true;
  console.log("Wind data scheduler started successfully\n");
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
  return {
    running: isSchedulerRunning,
    lastFetch: lastFetchStatus,
  };
}

/**
 * Manually trigger a 24h historical fetch (for debugging/testing)
 */
async function triggerManualFetch() {
  console.log("Manual 24h fetch triggered");
  return await fetchHistorical24h();
}

/**
 * Manually trigger a latest forecast fetch (for debugging/testing)
 */
async function triggerLatestFetch() {
  console.log("Manual latest fetch triggered");
  return await fetchLatestForecast();
}

module.exports = {
  startScheduler,
  getSchedulerStatus,
  triggerManualFetch,
  triggerLatestFetch,
  fetchHistorical24h,
  fetchLatestForecast,
  REDIS_KEYS,
};
