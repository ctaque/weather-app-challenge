const cron = require('node-cron');
const { getWindData, getPrecipitationData } = require('./opendap-downloader');
const { setWindData, setBinaryData, setWindDataWithIndex, setBinaryDataWithIndex, isRedisConnected } = require('./redis-client');

// Keys for different data types in Redis
const REDIS_KEYS = {
  WIND_POINTS: 'wind:points',
  WIND_PNG: 'wind:png',
  WIND_METADATA: 'wind:metadata',
  LAST_UPDATE: 'wind:last_update',
  PRECIPITATION_POINTS: 'precipitation:points'
};

let isSchedulerRunning = false;
let lastFetchStatus = {
  success: false,
  timestamp: null,
  error: null
};

/**
 * Fetch wind data from OpenDAP and store in Redis
 */
async function fetchAndStoreGribData() {
  console.log('\n=== Starting wind data fetch ===');

  try {
    if (!isRedisConnected()) {
      throw new Error('Redis is not connected');
    }

    // Download wind data from NOAA GFS via OpenDAP
    console.log('Downloading wind data from NOAA GFS via OpenDAP...');
    const { windPoints, pngBuffer, metadata } = await getWindData();

    console.log(`Successfully fetched ${windPoints.length} wind data points`);

    // Store wind points data
    const windData = {
      timestamp: new Date().toISOString(),
      source: metadata.source,
      resolution: 0.5,
      points: windPoints,
      region: 'France',
      bounds: {
        lat: [41, 52],
        lon: [-5, 10]
      }
    };

    // Store data with index (keeps last 10 versions)
    const currentIndex = await setWindDataWithIndex(windData, REDIS_KEYS.WIND_POINTS, 10);
    console.log(`Stored wind points at index ${currentIndex}`);

    // Store PNG image for windgl with index
    await setBinaryDataWithIndex(pngBuffer, REDIS_KEYS.WIND_PNG, currentIndex);
    console.log(`Stored wind PNG at index ${currentIndex}`);

    // Store metadata with same index
    const metadataIndexedKey = `${REDIS_KEYS.WIND_METADATA}:${currentIndex}`;
    await setWindData(metadata, metadataIndexedKey);
    // Also store as latest for backward compatibility
    await setWindData(metadata, REDIS_KEYS.WIND_METADATA);
    console.log(`Stored wind metadata at index ${currentIndex}`);

    // Download and store precipitation data
    console.log('Downloading precipitation data from NOAA GFS via OpenDAP...');
    try {
      const { precipPoints, metadata: precipMetadata } = await getPrecipitationData();
      console.log(`Successfully fetched ${precipPoints.length} precipitation data points`);

      const precipData = {
        timestamp: new Date().toISOString(),
        source: precipMetadata.source,
        resolution: 0.5,
        points: precipPoints,
        unit: precipMetadata.unit,
        bounds: {
          lat: [-90, 90],
          lon: [-180, 180]
        }
      };

      // Store precipitation data with index (same as wind, keeps last 10 versions)
      const precipIndex = await setWindDataWithIndex(precipData, REDIS_KEYS.PRECIPITATION_POINTS, 10);
      console.log(`Stored precipitation data at index ${precipIndex}`);

      // Also store as latest for backward compatibility
      await setWindData(precipData, REDIS_KEYS.PRECIPITATION_POINTS);
      console.log('Precipitation data successfully stored in Redis');
    } catch (precipError) {
      console.error('Failed to fetch/store precipitation data:', precipError.message);
      // Don't fail the whole process if precipitation fails
    }

    // Store last update timestamp
    await setWindData({
      timestamp: new Date().toISOString(),
      success: true,
      dataPoints: windPoints.length,
      pngSize: pngBuffer.length
    }, REDIS_KEYS.LAST_UPDATE);

    lastFetchStatus = {
      success: true,
      timestamp: new Date().toISOString(),
      error: null,
      dataPoints: windPoints.length
    };

    console.log('=== Wind data successfully stored in Redis ===\n');
    return true;

  } catch (error) {
    console.error('=== Error fetching/storing wind data ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    lastFetchStatus = {
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message
    };

    // Store error status
    try {
      await setWindData({
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      }, REDIS_KEYS.LAST_UPDATE);
    } catch (redisError) {
      console.error('Failed to store error status in Redis:', redisError);
    }

    return false;
  }
}

/**
 * Start the scheduler
 * Runs every hour at minute 5 (e.g., 00:05, 01:05, 02:05, etc.)
 * This aligns well with GFS data availability
 */
function startScheduler() {
  if (isSchedulerRunning) {
    console.log('Wind data scheduler is already running');
    return;
  }

  console.log('Starting wind data scheduler...');
  console.log('Schedule: Every hour at minute 5 (cron: 5 * * * *)');

  // Run immediately on startup
  console.log('Running initial wind data fetch...');
  fetchAndStoreGribData().catch(err => {
    console.error('Initial fetch failed:', err.message);
  });

  // Schedule recurring fetches
  // Runs at minute 5 of every hour
  cron.schedule('5 * * * *', async () => {
    console.log(`\n[${new Date().toISOString()}] Scheduled wind data fetch triggered`);
    await fetchAndStoreGribData();
  });

  isSchedulerRunning = true;
  console.log('Wind data scheduler started successfully\n');
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
  return {
    running: isSchedulerRunning,
    lastFetch: lastFetchStatus
  };
}

/**
 * Manually trigger a fetch (for debugging/testing)
 */
async function triggerManualFetch() {
  console.log('Manual fetch triggered');
  return await fetchAndStoreGribData();
}

module.exports = {
  startScheduler,
  getSchedulerStatus,
  triggerManualFetch,
  fetchAndStoreGribData,
  REDIS_KEYS
};
