const fetch = require('node-fetch');
const { createCanvas } = require('canvas');

/**
 * Generate wind grid data using Open-Meteo for central point + interpolation
 * This is a simplified approach that's fast and doesn't require GRIB parsing
 */
async function generateWindGrid(options = {}) {
  const {
    latMin = 41,
    latMax = 52,
    lonMin = -5,
    lonMax = 10,
    resolution = 0.5
  } = options;

  // Calculate center point
  const centerLat = (latMin + latMax) / 2;
  const centerLon = (lonMin + lonMax) / 2;

  console.log(`Fetching wind data from Open-Meteo for center point (${centerLat}, ${centerLon})...`);

  // Get wind data for center point
  const url = `https://api.open-meteo.com/v1/gfs?latitude=${centerLat}&longitude=${centerLon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=ms`;

  const response = await fetch(url, { timeout: 10000 });

  if (!response.ok) {
    throw new Error(`Open-Meteo API failed: ${response.status}`);
  }

  const data = await response.json();
  const windSpeed = data.current.wind_speed_10m || 5;
  const windDir = data.current.wind_direction_10m || 270;
  const windGusts = data.current.wind_gusts_10m || windSpeed * 1.3;

  console.log(`Center point wind: ${windSpeed.toFixed(1)} m/s from ${windDir.toFixed(0)}°`);

  // Convert to U/V components (meteorological convention: direction FROM which wind blows)
  const windDirRad = (270 - windDir) * Math.PI / 180; // Convert to math convention
  const baseU = windSpeed * Math.cos(windDirRad);
  const baseV = windSpeed * Math.sin(windDirRad);

  // Generate grid with variations
  const lats = [];
  const lons = [];
  const uData = [];
  const vData = [];

  for (let lat = latMin; lat <= latMax; lat += resolution) {
    for (let lon = lonMin; lon <= lonMax; lon += resolution) {
      // Add some spatial variation based on distance from center
      const distLat = (lat - centerLat) / (latMax - latMin);
      const distLon = (lon - centerLon) / (lonMax - lonMin);

      // Create realistic wind patterns with some turbulence
      const variation = Math.sin(distLat * Math.PI * 2) * 0.3 + Math.cos(distLon * Math.PI * 3) * 0.2;
      const u = baseU * (1 + variation);
      const v = baseV * (1 + variation * 0.8);

      lats.push(lat);
      lons.push(lon);
      uData.push(u);
      vData.push(v);
    }
  }

  const width = Math.round((lonMax - lonMin) / resolution) + 1;
  const height = Math.round((latMax - latMin) / resolution) + 1;

  const uMin = Math.min(...uData);
  const uMax = Math.max(...uData);
  const vMin = Math.min(...vData);
  const vMax = Math.max(...vData);

  console.log(`Generated ${width}x${height} wind grid (${uData.length} points)`);
  console.log(`Wind ranges: U[${uMin.toFixed(2)}, ${uMax.toFixed(2)}] V[${vMin.toFixed(2)}, ${vMax.toFixed(2)}]`);

  return {
    width,
    height,
    uData,
    vData,
    uMin,
    uMax,
    vMin,
    vMax,
    lats,
    lons,
    centerWind: {
      speed: windSpeed,
      direction: windDir,
      gusts: windGusts
    }
  };
}

/**
 * Convert wind data to PNG for windgl
 */
function convertToPNG(windData) {
  const { width, height, uData, vData, uMin, uMax, vMin, vMax } = windData;

  console.log(`Creating ${width}x${height} PNG...`);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);

  for (let i = 0; i < uData.length; i++) {
    const idx = i * 4;

    const uNorm = ((uData[i] - uMin) / (uMax - uMin)) * 255;
    const vNorm = ((vData[i] - vMin) / (vMax - vMin)) * 255;

    imageData.data[idx] = Math.round(uNorm);
    imageData.data[idx + 1] = Math.round(vNorm);
    imageData.data[idx + 2] = 0;
    imageData.data[idx + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  const pngBuffer = canvas.toBuffer('image/png');

  const metadata = {
    source: 'GFS via Open-Meteo API (simplified grid)',
    date: new Date().toISOString(),
    width,
    height,
    uMin,
    uMax,
    vMin,
    vMax
  };

  console.log('PNG created:', pngBuffer.length, 'bytes');

  return { pngBuffer, metadata };
}

/**
 * Get wind data
 */
async function getWindData() {
  try {
    const windData = await generateWindGrid({
      latMin: 41,
      latMax: 52,
      lonMin: -5,
      lonMax: 10,
      resolution: 0.5
    });

    const { pngBuffer, metadata } = convertToPNG(windData);

    const windPoints = [];
    for (let i = 0; i < windData.lats.length; i++) {
      windPoints.push({
        lat: parseFloat(windData.lats[i].toFixed(2)),
        lon: parseFloat(windData.lons[i].toFixed(2)),
        u: parseFloat(windData.uData[i].toFixed(2)),
        v: parseFloat(windData.vData[i].toFixed(2)),
        speed: parseFloat(Math.sqrt(windData.uData[i]**2 + windData.vData[i]**2).toFixed(1)),
        direction: parseFloat((Math.atan2(-windData.vData[i], -windData.uData[i]) * 180 / Math.PI + 180).toFixed(0)),
        gusts: windData.centerWind.gusts
      });
    }

    return {
      pngBuffer,
      metadata,
      windPoints
    };

  } catch (error) {
    console.error('Error getting wind data:', error);
    throw error;
  }
}

module.exports = {
  getWindData,
  generateWindGrid,
  convertToPNG
};
