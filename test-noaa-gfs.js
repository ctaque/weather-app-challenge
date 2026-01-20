const noaaGFS = require('noaa-gfs-js');

async function test() {
  try {
    console.log('Fetching GFS data using noaa-gfs-js...');

    // Get U and V components at 10m for France region
    const uData = await noaaGFS.get_gfs_data({
      variable: 'ugrd10m',  // U-component at 10m
      resolution: 0.5,       // 0.5 degree resolution
      forecast_offset: 3,    // 3 hours ahead
      lat_range: [41, 52],   // France latitude range
      lon_range: [-5, 10]    // France longitude range (OpenDAP uses -180 to 180)
    });

    console.log('\nU-component data:');
    console.log('- Dimensions:', uData.dimensions);
    console.log('- Data points:', uData.data.length);
    console.log('- Sample values:', uData.data.slice(0, 5));

    const vData = await noaaGFS.get_gfs_data({
      variable: 'vgrd10m',  // V-component at 10m
      resolution: 0.5,
      forecast_offset: 3,
      lat_range: [41, 52],
      lon_range: [-5, 10]
    });

    console.log('\nV-component data:');
    console.log('- Dimensions:', vData.dimensions);
    console.log('- Data points:', vData.data.length);
    console.log('- Sample values:', vData.data.slice(0, 5));

    console.log('\nSuccess! noaa-gfs-js works correctly.');

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

test();
