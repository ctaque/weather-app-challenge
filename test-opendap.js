const fetch = require('node-fetch');

async function test() {
  try {
    // Get latest forecast run
    const now = new Date();
    const utcHours = now.getUTCHours();
    let forecastHour = utcHours >= 18 ? 12 : utcHours >= 12 ? 6 : utcHours >= 6 ? 0 : 18;

    // If forecastHour is 18 and current hour < 6, go to previous day
    let forecastDate = new Date(now);
    if (forecastHour === 18 && utcHours < 6) {
      forecastDate.setUTCDate(forecastDate.getUTCDate() - 1);
    }

    const year = forecastDate.getUTCFullYear();
    const month = String(forecastDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(forecastDate.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    const hourStr = String(forecastHour).padStart(2, '0');

    console.log(`Fetching GFS data for ${dateStr} ${hourStr}Z using OpenDAP...`);

    // OpenDAP ASCII service - get metadata first
    const baseUrl = `https://nomads.ncep.noaa.gov/dods/gfs_0p50/gfs${dateStr}/gfs_0p50_${hourStr}z`;
    console.log('Base URL:', baseUrl);

    // Try to get DAS (attributes)
    const dasUrl = `${baseUrl}.das`;
    console.log('\nFetching DAS (attributes)...');
    const dasResponse = await fetch(dasUrl, { timeout: 10000 });

    if (!dasResponse.ok) {
      throw new Error(`DAS request failed: ${dasResponse.status} ${dasResponse.statusText}`);
    }

    const dasText = await dasResponse.text();
    console.log('DAS response length:', dasText.length);
    console.log('First 500 chars:', dasText.substring(0, 500));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
