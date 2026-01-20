const fetch = require('node-fetch');

async function test() {
  const url = 'https://nomads.ncep.noaa.gov/dods/gfs_0p50/gfs20260120/gfs_0p50_06z.ascii?lat[76:1:98],lon[0:1:30]';

  console.log('Fetching lat/lon only...');
  const response = await fetch(url, { timeout: 30000 });
  const text = await response.text();

  console.log('\nResponse:');
  console.log(text);
}

test().catch(console.error);
