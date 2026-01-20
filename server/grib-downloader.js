const fetch = require("node-fetch");
const grib2 = require("grib2-simple");
const { createCanvas } = require("canvas");
const fs = require("fs").promises;
const path = require("path");

// NOAA GFS GRIB filter URL
const NOMADS_BASE_URL =
  "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p50.pl";

// Cache directory
const CACHE_DIR = path.join(__dirname, "../.cache/grib");

/**
 * Get the latest GFS forecast run info
 * @returns {Object} - {date, hour}
 */
function getLatestForecastRun() {
  const now = new Date();
  const utcHours = now.getUTCHours();

  // GFS runs at 00, 06, 12, 18 UTC with ~3.5 hours delay
  let forecastHour;
  if (utcHours >= 21 || utcHours < 3) {
    forecastHour = 18;
  } else if (utcHours >= 15) {
    forecastHour = 12;
  } else if (utcHours >= 9) {
    forecastHour = 6;
  } else {
    forecastHour = 0;
  }

  // If current time is before the forecast became available, use previous run
  const forecastTime = new Date(now);
  forecastTime.setUTCHours(forecastHour, 0, 0, 0);

  if (now - forecastTime < 3.5 * 60 * 60 * 1000) {
    // Use previous 6-hour cycle
    forecastHour = (forecastHour - 6 + 24) % 24;
    if (forecastHour === 18) {
      forecastTime.setUTCDate(forecastTime.getUTCDate() - 1);
    }
  }

  const year = forecastTime.getUTCFullYear();
  const month = String(forecastTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(forecastTime.getUTCDate()).padStart(2, "0");
  const hour = String(forecastHour).padStart(2, "0");

  return {
    date: `${year}${month}${day}`,
    hour: hour,
    fullDate: forecastTime,
  };
}

/**
 * Download GRIB data from NOAA NOMADS
 * @param {Object} options - Download options
 * @returns {Promise<Buffer>} - GRIB data buffer
 */
async function downloadGribData(options = {}) {
  const {
    forecastHour = 3, // Forecast offset in hours
    leftLon = -5, // France bounds
    rightLon = 10,
    topLat = 52,
    bottomLat = 41,
  } = options;

  const { date, hour } = getLatestForecastRun();
  const forecastOffset = String(forecastHour).padStart(3, "0");

  console.log(
    `Downloading GFS data for ${date} ${hour}Z f${forecastOffset}...`,
  );

  // Construct filter URL
  // Request U and V wind components at 10m above ground
  const params = new URLSearchParams({
    file: `gfs.t${hour}z.pgrb2full.0p50.f${forecastOffset}`,
    lev_10_m_above_ground: "on", // 10m level
    var_UGRD: "on", // U-component of wind
    var_VGRD: "on", // V-component of wind
    subregion: "",
    leftlon: leftLon,
    rightlon: rightLon,
    toplat: topLat,
    bottomlat: bottomLat,
    dir: `/gfs.${date}/${hour}/atmos`,
  });

  const url = `${NOMADS_BASE_URL}?${params.toString()}`;
  console.log("GRIB URL:", url);

  try {
    const response = await fetch(url, {
      timeout: 30000,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    console.log(`Downloaded ${buffer.length} bytes of GRIB data`);

    return buffer;
  } catch (error) {
    console.error("Error downloading GRIB:", error);
    throw error;
  }
}

/**
 * Decode GRIB2 data and extract U/V wind components
 * @param {Buffer} gribBuffer - GRIB data
 * @returns {Object} - {width, height, uData, vData, uMin, uMax, vMin, vMax, lats, lons}
 */
function decodeGribData(gribBuffer) {
  console.log("Decoding GRIB data...");

  try {
    const gribData = grib2(gribBuffer);
    console.log(`Found ${gribData.length} GRIB records`);

    // Debug: show what we got
    console.log("GRIB data type:", typeof gribData);
    console.log("Is array:", Array.isArray(gribData));

    let uRecord = null;
    let vRecord = null;

    // Find U and V components
    for (const record of gribData) {
      const discipline = record.discipline;
      const category = record.parameterCategory;
      const parameter = record.parameterNumber;

      // Meteorological products (discipline 0), Momentum (category 2)
      if (discipline === 0 && category === 2) {
        if (parameter === 2) {
          // U-component (eastward)
          uRecord = record;
          console.log("Found U-component:", {
            name: record.parameterName,
            unit: record.parameterUnit,
            level: record.firstFixedSurfaceValue,
          });
        } else if (parameter === 3) {
          // V-component (northward)
          vRecord = record;
          console.log("Found V-component:", {
            name: record.parameterName,
            unit: record.parameterUnit,
            level: record.firstFixedSurfaceValue,
          });
        }
      }
    }

    if (!uRecord || !vRecord) {
      throw new Error("Could not find U or V wind components in GRIB data");
    }

    // Validate record structure
    if (!uRecord.sections || !uRecord.sections[3]) {
      throw new Error("Invalid U-component record: missing section 3");
    }
    if (!vRecord.sections || !vRecord.sections[3]) {
      throw new Error("Invalid V-component record: missing section 3");
    }
    if (typeof uRecord.getValue !== 'function') {
      throw new Error("Invalid U-component record: missing getValue method");
    }
    if (typeof vRecord.getValue !== 'function') {
      throw new Error("Invalid V-component record: missing getValue method");
    }

    // Get grid definition from section 3
    const gridDef = uRecord.sections[3];
    const width = gridDef.nx;
    const height = gridDef.ny;
    const lat1 = gridDef.la1 / 1000000; // First grid point latitude
    const lon1 = gridDef.lo1 / 1000000; // First grid point longitude
    const lat2 = gridDef.la2 / 1000000; // Last grid point latitude
    const lon2 = gridDef.lo2 / 1000000; // Last grid point longitude

    console.log(`Grid dimensions: ${width}x${height}`);
    console.log(`Grid bounds: lat ${lat1} to ${lat2}, lon ${lon1} to ${lon2}`);

    // Calculate step sizes
    const latStep = (lat2 - lat1) / (height - 1);
    const lonStep = (lon2 - lon1) / (width - 1);

    // Extract wind values
    const uValues = [];
    const vValues = [];
    let uMin = Infinity,
      uMax = -Infinity;
    let vMin = Infinity,
      vMax = -Infinity;

    // Get lat/lon for each grid point
    const lats = [];
    const lons = [];

    for (let y = 0; y < height; y++) {
      const lat = lat1 + y * latStep;
      for (let x = 0; x < width; x++) {
        const lon = lon1 + x * lonStep;

        // Get values at this coordinate
        const uValue = uRecord.getValue(lon, lat);
        const vValue = vRecord.getValue(lon, lat);

        uValues.push(uValue);
        vValues.push(vValue);
        lats.push(lat);
        lons.push(lon);

        if (uValue < uMin) uMin = uValue;
        if (uValue > uMax) uMax = uValue;
        if (vValue < vMin) vMin = vValue;
        if (vValue > vMax) vMax = vValue;
      }
    }

    console.log("Wind data ranges:", {
      uMin,
      uMax,
      vMin,
      vMax,
    });

    return {
      width,
      height,
      uData: uValues,
      vData: vValues,
      uMin,
      uMax,
      vMin,
      vMax,
      lats,
      lons,
    };
  } catch (error) {
    console.error("Error decoding GRIB:", error.message);
    console.error("Stack:", error.stack);
    throw error;
  }
}

/**
 * Convert wind data to PNG for windgl
 * @param {Object} windData - Decoded wind data
 * @returns {Object} - {pngBuffer, metadata}
 */
function convertToPNG(windData) {
  const { width, height, uData, vData, uMin, uMax, vMin, vMax } = windData;

  console.log(`Creating ${width}x${height} PNG...`);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);

  // Encode U/V into R/G channels (normalized to 0-255)
  for (let i = 0; i < uData.length; i++) {
    const idx = i * 4;

    // Normalize to 0-255 range
    const uNorm = ((uData[i] - uMin) / (uMax - uMin)) * 255;
    const vNorm = ((vData[i] - vMin) / (vMax - vMin)) * 255;

    imageData.data[idx] = Math.round(uNorm); // R = U
    imageData.data[idx + 1] = Math.round(vNorm); // G = V
    imageData.data[idx + 2] = 0; // B = unused
    imageData.data[idx + 3] = 255; // A = opaque
  }

  ctx.putImageData(imageData, 0, 0);
  const pngBuffer = canvas.toBuffer("image/png");

  const metadata = {
    source: "NOAA GFS 0.5° via NOMADS",
    date: new Date().toISOString(),
    width,
    height,
    uMin,
    uMax,
    vMin,
    vMax,
  };

  console.log("PNG created:", pngBuffer.length, "bytes");

  return { pngBuffer, metadata };
}

/**
 * Get wind data (download and decode GRIB, or use cache)
 * @returns {Promise<Object>} - {pngBuffer, metadata, windPoints}
 */
async function getWindData() {
  try {
    // Ensure cache directory exists

    // Download GRIB
    const gribBuffer = await downloadGribData({
      forecastHour: 3,
      leftLon: -5,
      rightLon: 10,
      topLat: 52,
      bottomLat: 41,
    });

    // Decode GRIB
    const windData = decodeGribData(gribBuffer);

    // Convert to PNG
    const { pngBuffer, metadata } = convertToPNG(windData);

    // Also create JSON format for backward compatibility
    const windPoints = [];
    for (let i = 0; i < windData.lats.length; i++) {
      windPoints.push({
        lat: parseFloat(windData.lats[i].toFixed(2)),
        lon: parseFloat(windData.lons[i].toFixed(2)),
        u: parseFloat(windData.uData[i].toFixed(2)),
        v: parseFloat(windData.vData[i].toFixed(2)),
        speed: parseFloat(
          Math.sqrt(windData.uData[i] ** 2 + windData.vData[i] ** 2).toFixed(1),
        ),
        direction: parseFloat(
          (
            (Math.atan2(windData.vData[i], windData.uData[i]) * 180) /
            Math.PI
          ).toFixed(0),
        ),
        gusts: 0, // Not available in GFS 10m data
      });
    }

    return {
      pngBuffer,
      metadata,
      windPoints,
    };
  } catch (error) {
    console.error("Error getting wind data:", error.message);
    console.error("Stack:", error.stack);
    throw error;
  }
}

module.exports = {
  getWindData,
  downloadGribData,
  decodeGribData,
  convertToPNG,
};
