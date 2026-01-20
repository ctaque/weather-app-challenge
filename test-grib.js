const { downloadGribData } = require('./server/grib-downloader');
const grib2 = require('grib2-simple');

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

    console.log('Parsing GRIB data...');
    let gribData;
    try {
      gribData = grib2(gribBuffer);
    } catch (parseError) {
      console.error('Parse error message:', parseError.message);
      return;
    }

    console.log(`\nFound ${gribData.length} GRIB records\n`);

    // Examine first record structure
    if (gribData.length > 0) {
      const record = gribData[0];
      console.log('First record keys:', Object.keys(record));
      console.log('\nFirst record structure:');
      console.log('- discipline:', record.discipline);
      console.log('- parameterCategory:', record.parameterCategory);
      console.log('- parameterNumber:', record.parameterNumber);
      console.log('- parameterName:', record.parameterName);
      console.log('- parameterUnit:', record.parameterUnit);
      console.log('- firstFixedSurfaceValue:', record.firstFixedSurfaceValue);

      console.log('\nSections keys:', Object.keys(record.sections));
      console.log('\nSection 3 (Grid Definition):');
      console.log(JSON.stringify(record.sections[3], null, 2));

      // Test getValue
      console.log('\nTesting getValue(2.0, 46.0):');
      try {
        const value = record.getValue(2.0, 46.0);
        console.log('Value:', value);
      } catch (e) {
        console.error('getValue error:', e.message);
      }
    }

  } catch (error) {
    console.error('Error message:', error.message);
    console.error('Stack:', error.stack);
  }
}

test();
