const fetch = require('node-fetch');
const { createCanvas } = require('canvas');

/**
 * Download wind data from Open-Meteo API (which uses GFS data)
 */
async function downloadWindDataOpenMeteo(options = {}) {
  const {
    latMin = 41,
    latMax = 52,
    lonMin = -5,
    lonMax = 10,
    resolution = 0.5
  } = options;

  // Calculate grid points
  const lats = [];
  const lons = [];
  for (let lat = latMin; lat <= latMax; lat += resolution) {
    lats.push(lat);
  }
  for (let lon = lonMin; lon <= lonMax; lon += resolution) {
    lons.push(lon);
  }

  console.log(`Fetching wind data for ${lats.length} x ${lons.length} grid points from Open-Meteo...`);

  const allResults = [];

  // Fetch in batches to avoid overwhelming the API
  const batchSize = 100;
  let processed = 0;

  for (let latIdx = 0; latIdx < lats.length; latIdx++) {
    for (let lonIdx = 0; lonIdx < lons.length; lonIdx++) {
      allResults.push({
        lat: lats[latIdx],
        lon: lons[lonIdx],
        u: 0, // Will be filled below
        v: 0
      });
    }
  }

  // Fetch data in batches
  for (let i = 0; i < allResults.length; i += batchSize) {
    const batch = allResults.slice(i, Math.min(i + batchSize, allResults.length));

    // Build query for multiple points
    const latQuery = batch.map(p => p.lat).join(',');
    const lonQuery = batch.map(p => p.lon).join(',');

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latQuery}&longitude=${lonQuery}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&forecast_days=1`;

    try {
      const response = await fetch(url, { timeout: 10000 });

      if (!response.ok) {
        console.warn(`Batch ${i / batchSize + 1} failed: ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Process results
      if (Array.isArray(data)) {
        for (let j = 0; j < data.length && j < batch.length; j++) {
          const windSpeed = data[j].current?.wind_speed_10m || 0;
          const windDir = data[j].current?.wind_direction_10m || 0;

          // Convert speed/direction to U/V components
          const windDirRad = (windDir - 180) * Math.PI / 180; // Meteorological to math convention
          batch[j].u = windSpeed * Math.cos(windDirRad);
          batch[j].v = windSpeed * Math.sin(windDirRad);
        }
      } else if (data.current) {
        // Single point response
        const windSpeed = data.current.wind_speed_10m || 0;
        const windDir = data.current.wind_direction_10m || 0;

        const windDirRad = (windDir - 180) * Math.PI / 180;
        batch[0].u = windSpeed * Math.cos(windDirRad);
        batch[0].v = windSpeed * Math.sin(windDirRad);
      }

      processed += batch.length;
      console.log(`Progress: ${processed}/${allResults.length} points`);

      // Rate limiting
      if (i + batchSize < allResults.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      console.warn(`Batch ${i / batchSize + 1} error:`, error.message);
    }
  }

  // Extract U/V data
  const uData = allResults.map(p => p.u);
  const vData = allResults.map(p => p.v);

  const uMin = Math.min(...uData);
  const uMax = Math.max(...uData);
  const vMin = Math.min(...vData);
  const vMax = Math.max(...vData);

  console.log(`Wind data ranges: U[${uMin.toFixed(2)}, ${uMax.toFixed(2)}] V[${vMin.toFixed(2)}, ${vMax.toFixed(2)}]`);

  return {
    width: lons.length,
    height: lats.length,
    uData,
    vData,
    uMin,
    uMax,
    vMin,
    vMax,
    lats: allResults.map(p => p.lat),
    lons: allResults.map(p => p.lon)
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
    source: 'GFS via Open-Meteo API',
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
 * Get wind data via Open-Meteo
 */
async function getWindData() {
  try {
    const windData = await downloadWindDataOpenMeteo({
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
        direction: parseFloat((Math.atan2(windData.vData[i], windData.uData[i]) * 180 / Math.PI).toFixed(0)),
        gusts: 0
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
  downloadWindDataOpenMeteo,
  convertToPNG
};
