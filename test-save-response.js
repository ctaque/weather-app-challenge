const fetch = require('node-fetch');
const fs = require('fs').promises;

async function test() {
  const url = 'https://nomads.ncep.noaa.gov/dods/gfs_0p50/gfs20260120/gfs_0p50_06z.ascii?ugrd10m[3:1:3][76:1:78][0:1:10],vgrd10m[3:1:3][76:1:78][0:1:10],lat[76:1:78],lon[0:1:10]';

  console.log('Fetching small sample...');
  const response = await fetch(url, { timeout: 30000 });
  const text = await response.text();

  await fs.writeFile('opendap-response.txt', text);
  console.log('Saved to opendap-response.txt');
  console.log('Length:', text.length);
}

test().catch(console.error);
