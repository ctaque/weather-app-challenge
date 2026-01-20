const { downloadGribData } = require('./server/grib-downloader');
const fs = require('fs').promises;

async function test() {
  try {
    console.log('Downloading GRIB data...');
    const gribBuffer = await downloadGribData({
      forecastHour: 3,
      leftLon: -5,
      rightLon: 10,
      topLat: 52,
      bottomLat: 41
    });

    console.log('Buffer length:', gribBuffer.length);
    console.log('First 500 bytes as text:');
    console.log(gribBuffer.toString('utf8', 0, Math.min(500, gribBuffer.length)));

    // Save to file for inspection
    await fs.writeFile('/tmp/test.grib2', gribBuffer);
    console.log('\nSaved to /tmp/test.grib2');

    // Check if it's HTML
    const text = gribBuffer.toString('utf8', 0, Math.min(1000, gribBuffer.length));
    if (text.includes('<html') || text.includes('<!DOCTYPE')) {
      console.log('\nWARNING: Downloaded data appears to be HTML, not GRIB!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
