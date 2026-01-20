const fetch = require('node-fetch');

async function test() {
  const url = 'https://nomads.ncep.noaa.gov/dods/gfs_0p50/gfs20260120/gfs_0p50_06z.ascii?ugrd10m[3:1:3][76:1:98][710:1:720],vgrd10m[3:1:3][76:1:98][710:1:720],lat[76:1:98],lon[710:1:720]';

  console.log('Fetching:', url);

  const response = await fetch(url, { timeout: 30000 });
  const text = await response.text();

  console.log('\nResponse length:', text.length);
  console.log('\n=== First 2000 chars ===');
  console.log(text.substring(0, 2000));
  console.log('\n=== Last 500 chars ===');
  console.log(text.substring(text.length - 500));
}

test().catch(console.error);
