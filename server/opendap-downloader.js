const fetch = require('node-fetch');

// Make canvas optional (not needed on Heroku, requires system dependencies)
let createCanvas;
try {
  const canvas = require('canvas');
  createCanvas = canvas.createCanvas;
} catch (err) {
  console.warn('Canvas module not available (system dependencies missing). PNG generation disabled.');
  createCanvas = null;
}

/**
 * Get available GFS forecast runs in order of preference
 * GFS runs at 00Z, 06Z, 12Z, 18Z and takes ~5-6 hours to be fully available
 * Returns array of runs to try, most recent first
 */
function getAvailableForecastRuns() {
  const now = new Date();
  const runs = [];

  // Get the last 8 runs (48 hours of coverage) for maximum reliability
  for (let i = 0; i < 8; i++) {
    const hoursAgo = i * 6;
    const runTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

    // Round down to nearest 6-hour interval
    const utcHours = runTime.getUTCHours();
    let forecastHour;
    if (utcHours >= 18) forecastHour = 18;
    else if (utcHours >= 12) forecastHour = 12;
    else if (utcHours >= 6) forecastHour = 6;
    else forecastHour = 0;

    const forecastTime = new Date(runTime);
    forecastTime.setUTCHours(forecastHour, 0, 0, 0);

    // Calculate hours since this run
    const hoursWaited = (now - forecastTime) / (60 * 60 * 1000);

    const year = forecastTime.getUTCFullYear();
    const month = String(forecastTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(forecastTime.getUTCDate()).padStart(2, '0');
    const hour = String(forecastHour).padStart(2, '0');

    runs.push({
      date: `${year}${month}${day}`,
      hour: hour,
      fullDate: forecastTime,
      hoursWaited: hoursWaited
    });
  }

  // Remove duplicates (can happen at run boundaries)
  const uniqueRuns = runs.filter((run, index, self) =>
    index === self.findIndex(r => r.date === run.date && r.hour === run.hour)
  );

  // Sort by readiness: prefer runs with > 5.5 hours wait time
  uniqueRuns.sort((a, b) => {
    // Heavily prefer runs with enough wait time (increased to 5.5h)
    const aReady = a.hoursWaited >= 5.5 ? 1 : 0;
    const bReady = b.hoursWaited >= 5.5 ? 1 : 0;
    if (aReady !== bReady) return bReady - aReady;

    // Otherwise prefer more recent
    return b.fullDate.getTime() - a.fullDate.getTime();
  });

  return uniqueRuns;
}

/**
 * Download wind data from NOAA OpenDAP service with automatic fallback
 */
async function downloadWindDataOpenDAP(options = {}) {
  const {
    forecastOffset = 3,
    latMin = 35, // Toute l'Europe : du sud de l'Espagne
    latMax = 71, // au nord de la Scandinavie
    lonMin = -10, // De l'ouest du Portugal
    lonMax = 45 // À l'est de la Russie européenne
  } = options;

  const availableRuns = getAvailableForecastRuns();
  console.log(`\nAvailable forecast runs to try (in order):`);
  availableRuns.forEach((run, i) => {
    console.log(`  ${i + 1}. ${run.date} ${run.hour}Z (${run.hoursWaited.toFixed(1)}h ago)`);
  });

  // Try each run until we find one that works
  let lastError = null;
  for (const run of availableRuns) {
    try {
      console.log(`\nAttempting to fetch GFS data for ${run.date} ${run.hour}Z f${String(forecastOffset).padStart(3, '0')} via OpenDAP...`);
      const windData = await downloadWindDataForRun(run.date, run.hour, forecastOffset, latMin, latMax, lonMin, lonMax);
      console.log(`✓ Successfully fetched data from ${run.date} ${run.hour}Z`);
      return windData;
    } catch (error) {
      console.log(`✗ Failed to fetch ${run.date} ${run.hour}Z: ${error.message}`);
      lastError = error;
      // Continue to next run
    }
  }

  // If we get here, all runs failed
  throw new Error(`All forecast runs failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Download wind data for a specific forecast run
 */
async function downloadWindDataForRun(date, hour, forecastOffset, latMin, latMax, lonMin, lonMax) {

  // OpenDAP base URL
  const baseUrl = `https://nomads.ncep.noaa.gov/dods/gfs_0p50/gfs${date}/gfs_0p50_${hour}z`;

  // No try-catch here - let errors bubble up to the retry logic
    // First, get grid info to calculate indices
    const infoUrl = `${baseUrl}.info`;
    const infoResponse = await fetch(infoUrl, { timeout: 10000 });

    if (!infoResponse.ok) {
      throw new Error(`Info request failed: ${infoResponse.status}`);
    }

    // GFS 0.5deg grid: 720x361 (lon x lat)
    // Lon: 0 to 359.5 by 0.5 (index = lon / 0.5)
    // Lat: -90 to 90 by 0.5 (formula: lat = (index × 0.5) - 90, so index = (lat + 90) / 0.5)

    // Calculate latitude indices (corrected formula)
    // For Europe: 35°N to 71°N
    // latMin=35 → index = (35 + 90) / 0.5 = 250
    // latMax=71 → index = (71 + 90) / 0.5 = 322
    const latStartIndex = Math.floor((latMin + 90) / 0.5);
    const latEndIndex = Math.floor((latMax + 90) / 0.5);

    // Handle longitude wraparound for western Europe
    // GFS uses 0-359.5° (not -180 to +180)
    // For -10°, we need 350° (360 - 10)
    const needsWrap = lonMin < 0;

    console.log(`Grid indices: time=${forecastOffset}, lat=${latStartIndex}:${latEndIndex}`);
    console.log(`Zone: ${lonMin}° to ${lonMax}°E (Europe: Portugal to Russia)`);

      let allLatValues = [];
      let allLonValues = [];
      let allUValues = [];
      let allVValues = [];

      if (needsWrap) {
        // Two requests: western part (350-359.5°) and eastern part (0-lonMax°)
        console.log('Handling longitude wraparound with two requests...');

        // Western part: lonMin to 0° (converted to 360+lonMin to 359.5°)
        const westLonStart = Math.floor((360 + lonMin) / 0.5); // e.g., -10 → 350/0.5 = 700
        const westLonEnd = 719; // Last index (359.5°)

        console.log(`  West: lon indices ${westLonStart}:${westLonEnd} (${lonMin}° to -0.5°)`);

        const westConstraint = `.ascii?ugrd10m[${forecastOffset}:1:${forecastOffset}][${latStartIndex}:1:${latEndIndex}][${westLonStart}:1:${westLonEnd}],vgrd10m[${forecastOffset}:1:${forecastOffset}][${latStartIndex}:1:${latEndIndex}][${westLonStart}:1:${westLonEnd}],lat[${latStartIndex}:1:${latEndIndex}],lon[${westLonStart}:${westLonEnd}]`;
        const westUrl = baseUrl + westConstraint;

        console.log('Fetching west:', westUrl.substring(0, 150) + '...');
        const westResponse = await fetch(westUrl, { timeout: 30000 });

        if (!westResponse.ok) {
          throw new Error(`West data request failed: ${westResponse.status}`);
        }

        const westAscii = await westResponse.text();

        if (westAscii.trim().startsWith('<') || westAscii.includes('<!DOCTYPE')) {
          const errorMatch = westAscii.match(/<b>([^<]+is not an available dataset[^<]*)<\/b>/);
          const errorMsg = errorMatch ? errorMatch[1] : 'Unknown error';
          throw new Error(`OpenDAP error (west): ${errorMsg}`);
        }

        const westData = parseOpenDAPASCII(westAscii);

        // Convert longitudes from 350-359.5 to -10 to -0.5
        const westLons = westData.lonValues.map(lon => lon - 360);

        // Eastern part: 0° to lonMax°
        const eastLonStart = 0;
        const eastLonEnd = Math.floor(lonMax / 0.5);

        console.log(`  East: lon indices ${eastLonStart}:${eastLonEnd} (0° to ${lonMax}°)`);

        const eastConstraint = `.ascii?ugrd10m[${forecastOffset}:1:${forecastOffset}][${latStartIndex}:1:${latEndIndex}][${eastLonStart}:1:${eastLonEnd}],vgrd10m[${forecastOffset}:1:${forecastOffset}][${latStartIndex}:1:${latEndIndex}][${eastLonStart}:1:${eastLonEnd}],lat[${latStartIndex}:1:${latEndIndex}],lon[${eastLonStart}:${eastLonEnd}]`;
        const eastUrl = baseUrl + eastConstraint;

        console.log('Fetching east:', eastUrl.substring(0, 150) + '...');
        const eastResponse = await fetch(eastUrl, { timeout: 30000 });

        if (!eastResponse.ok) {
          throw new Error(`East data request failed: ${eastResponse.status}`);
        }

        const eastAscii = await eastResponse.text();

        if (eastAscii.trim().startsWith('<') || eastAscii.includes('<!DOCTYPE')) {
          const errorMatch = eastAscii.match(/<b>([^<]+is not an available dataset[^<]*)<\/b>/);
          const errorMsg = errorMatch ? errorMatch[1] : 'Unknown error';
          throw new Error(`OpenDAP error (east): ${errorMsg}`);
        }

        const eastData = parseOpenDAPASCII(eastAscii);

        // Combine west and east data
        // Latitude is the same for both
        allLatValues = westData.latValues;

        // Longitude: concat west (converted) + east
        allLonValues = [...westLons, ...eastData.lonValues];

        // Wind data: interleave by rows (each lat has west lons + east lons)
        const numLats = allLatValues.length;
        const westLonCount = westLons.length;
        const eastLonCount = eastData.lonValues.length;

        for (let latIdx = 0; latIdx < numLats; latIdx++) {
          const westRowStart = latIdx * westLonCount;
          const eastRowStart = latIdx * eastLonCount;

          // Add west row
          for (let i = 0; i < westLonCount; i++) {
            allUValues.push(westData.uData[westRowStart + i]);
            allVValues.push(westData.vData[westRowStart + i]);
          }

          // Add east row
          for (let i = 0; i < eastLonCount; i++) {
            allUValues.push(eastData.uData[eastRowStart + i]);
            allVValues.push(eastData.vData[eastRowStart + i]);
          }
        }

        console.log(`Combined: ${allLatValues.length} lats, ${allLonValues.length} lons, ${allUValues.length} total points`);

      } else {
        // Single request: no wraparound
        const lonStart = Math.floor(lonMin / 0.5);
        const lonEnd = Math.floor(lonMax / 0.5);

        console.log(`Single request: lon indices ${lonStart}:${lonEnd}`);

        const constraint = `.ascii?ugrd10m[${forecastOffset}:1:${forecastOffset}][${latStartIndex}:1:${latEndIndex}][${lonStart}:1:${lonEnd}],vgrd10m[${forecastOffset}:1:${forecastOffset}][${latStartIndex}:1:${latEndIndex}][${lonStart}:1:${lonEnd}],lat[${latStartIndex}:1:${latEndIndex}],lon[${lonStart}:${lonEnd}]`;
        const dataUrl = baseUrl + constraint;

        console.log('Fetching:', dataUrl.substring(0, 150) + '...');

        const dataResponse = await fetch(dataUrl, { timeout: 30000 });

        if (!dataResponse.ok) {
          throw new Error(`Data request failed: ${dataResponse.status}`);
        }

        const asciiData = await dataResponse.text();
        console.log(`Downloaded ${asciiData.length} bytes of ASCII data`);

        // Check if response is HTML error page
        if (asciiData.trim().startsWith('<') || asciiData.includes('<!DOCTYPE') || asciiData.includes('<html')) {
          console.error('OpenDAP returned HTML error page instead of data');
          const errorMatch = asciiData.match(/<b>([^<]+is not an available dataset[^<]*)<\/b>/);
          const errorMsg = errorMatch ? errorMatch[1] : 'Unknown error';
          throw new Error(`OpenDAP error: ${errorMsg}. The requested dataset may not be available yet. Try an earlier forecast run.`);
        }

        const parsedData = parseOpenDAPASCII(asciiData);
        allLatValues = parsedData.latValues;
        allLonValues = parsedData.lonValues;
        allUValues = parsedData.uData;
        allVValues = parsedData.vData;
      }

      // Build final wind data structure
      const width = allLonValues.length;
      const height = allLatValues.length;

      if (width === 0 || height === 0 || allUValues.length === 0) {
        throw new Error(`Invalid parsed data: width=${width}, height=${height}, uValues=${allUValues.length}`);
      }

      const uMin = Math.min(...allUValues);
      const uMax = Math.max(...allUValues);
      const vMin = Math.min(...allVValues);
      const vMax = Math.max(...allVValues);

      // Create arrays with all lat/lon combinations
      const allLats = [];
      const allLons = [];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          allLats.push(allLatValues[y]);
          allLons.push(allLonValues[x]);
        }
      }

      return {
        width,
        height,
        uData: allUValues,
        vData: allVValues,
        uMin,
        uMax,
        vMin,
        vMax,
        lats: allLats,
        lons: allLons,
        latValues: allLatValues,
        lonValues: allLonValues
      };
}

/**
 * Parse OpenDAP ASCII response
 */
function parseOpenDAPASCII(asciiData) {
  const lines = asciiData.split('\n');

  let latValues = [];
  let lonValues = [];
  let uValues = [];
  let vValues = [];

  let currentVariable = null;
  let inDataSection = false;

  // Track which variables we've already parsed (lat/lon appear multiple times)
  let parsedVars = {
    lat: false,
    lon: false,
    ugrd: false,
    vgrd: false,
    time: false
  };

  // Save response for debugging
  const fs = require('fs');
  fs.writeFileSync('debug-opendap-response.txt', asciiData, 'utf8');
  console.log('Saved OpenDAP response to debug-opendap-response.txt');

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect variable declarations - these reset the current variable
    if (trimmed.startsWith('lat,') || trimmed.startsWith('lat[')) {
      if (!parsedVars.lat) {
        currentVariable = 'lat';
        inDataSection = true; // For 1D arrays, data comes on next line
        parsedVars.lat = true;
      } else {
        currentVariable = null;
        inDataSection = false;
      }
      continue;
    }

    if (trimmed.startsWith('lon,') || trimmed.startsWith('lon[')) {
      if (!parsedVars.lon) {
        currentVariable = 'lon';
        inDataSection = true; // For 1D arrays, data comes on next line
        parsedVars.lon = true;
      } else {
        currentVariable = null;
        inDataSection = false;
      }
      continue;
    }

    if (trimmed.startsWith('ugrd10m,')) {
      if (!parsedVars.ugrd) {
        currentVariable = 'ugrd';
        inDataSection = false; // For 3D arrays, wait for [index] lines
        parsedVars.ugrd = true;
      } else {
        currentVariable = null;
        inDataSection = false;
      }
      continue;
    }

    if (trimmed.startsWith('vgrd10m,')) {
      if (!parsedVars.vgrd) {
        currentVariable = 'vgrd';
        inDataSection = false; // For 3D arrays, wait for [index] lines
        parsedVars.vgrd = true;
      } else {
        currentVariable = null;
        inDataSection = false;
      }
      continue;
    }

    // Skip time variable (we don't need it)
    if (trimmed.startsWith('time,') || trimmed.startsWith('time[')) {
      currentVariable = null;
      inDataSection = false;
      continue;
    }

    // Skip empty lines
    if (!trimmed) continue;

    // For wind data: lines start with [index][index]
    if (trimmed.match(/^\[[\d,]+\]/)) {
      inDataSection = true;
      // Extract numbers from this line
      const nums = trimmed.replace(/^\[[\d,]+\],?\s*/, '').split(/[,\s]+/).filter(s => s && !isNaN(parseFloat(s))).map(parseFloat);

      if (currentVariable === 'ugrd') {
        uValues.push(...nums);
      } else if (currentVariable === 'vgrd') {
        vValues.push(...nums);
      }
      continue;
    }

    // Data line with only numbers (for lat/lon and continuation lines)
    if (inDataSection && trimmed && !trimmed.match(/^[a-z]/i)) {
      const nums = trimmed.split(/[,\s]+/).filter(s => s && !isNaN(parseFloat(s))).map(parseFloat);

      if (currentVariable === 'lat') {
        latValues.push(...nums);
      } else if (currentVariable === 'lon') {
        lonValues.push(...nums);
      } else if (currentVariable === 'ugrd') {
        uValues.push(...nums);
      } else if (currentVariable === 'vgrd') {
        vValues.push(...nums);
      }
    }
  }

  console.log(`Parsed: ${latValues.length} lats, ${lonValues.length} lons, ${uValues.length} U values, ${vValues.length} V values`);

  // Debug: show first few values
  if (latValues.length > 0) {
    console.log('Sample lat values:', latValues.slice(0, 5));
    console.log('Sample lon values:', lonValues.slice(0, 5));
    console.log('Sample U values:', uValues.slice(0, 5));
    console.log('Sample V values:', vValues.slice(0, 5));
  }

  // Safety check
  if (latValues.length === 0 || lonValues.length === 0 || uValues.length === 0 || vValues.length === 0) {
    throw new Error(`Invalid parsed data: lats=${latValues.length}, lons=${lonValues.length}, uValues=${uValues.length}, vValues=${vValues.length}. Check debug-opendap-response.txt for the raw response.`);
  }

  return {
    latValues,
    lonValues,
    uData: uValues,
    vData: vValues
  };
}

/**
 * Convert wind data to PNG for windgl
 */
function convertToPNG(windData) {
  const { width, height, uData, vData, uMin, uMax, vMin, vMax } = windData;

  const metadata = {
    source: 'NOAA GFS 0.5° via OpenDAP',
    date: new Date().toISOString(),
    width,
    height,
    uMin,
    uMax,
    vMin,
    vMax
  };

  // If canvas is not available, return empty PNG buffer
  // (Frontend uses canvas-based rendering now, so this is optional)
  if (!createCanvas) {
    console.log('Canvas not available, skipping PNG generation');
    return { pngBuffer: Buffer.alloc(0), metadata };
  }

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

  console.log('PNG created:', pngBuffer.length, 'bytes');

  return { pngBuffer, metadata };
}

/**
 * Get wind data via OpenDAP
 */
async function getWindData() {
  try {
    const windData = await downloadWindDataOpenDAP({
      forecastOffset: 3,
      latMin: 35,  // Toute l'Europe : du sud de l'Espagne/Grèce
      latMax: 71,  // au nord de la Scandinavie
      lonMin: -10, // De l'ouest du Portugal/Irlande
      lonMax: 45   // À l'est de la Russie européenne
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
  downloadWindDataOpenDAP,
  downloadWindDataForRun,
  convertToPNG
};
