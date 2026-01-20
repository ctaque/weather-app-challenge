const fetch = require('node-fetch');

async function test() {
  // Test with simplified lon range (0-15 instead of -5 to 10)
  const forecastOffset = 3;
  const latStart = 76; // ~52°N
  const latEnd = 98;   // ~41°N
  const lonStart = 0;  // 0°E
  const lonEnd = 30;   // 15°E

  const baseUrl = 'https://nomads.ncep.noaa.gov/dods/gfs_0p50/gfs20260120/gfs_0p50_06z';
  const constraint = `.ascii?ugrd10m[${forecastOffset}:1:${forecastOffset}][${latStart}:1:${latEnd}][${lonStart}:1:${lonEnd}],vgrd10m[${forecastOffset}:1:${forecastOffset}][${latStart}:1:${latEnd}][${lonStart}:1:${lonEnd}],lat[${latStart}:1:${latEnd}],lon[${lonStart}:1:${lonEnd}]`;
  const url = baseUrl + constraint;

  console.log('Testing URL:', url.substring(0, 150) + '...');

  const response = await fetch(url, { timeout: 30000 });
  const text = await response.text();

  console.log('\nResponse status:', response.status);
  console.log('Response length:', text.length);
  console.log('\n=== First 1000 chars ===');
  console.log(text.substring(0, 1000));
}

test().catch(console.error);
