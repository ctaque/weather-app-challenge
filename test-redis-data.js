const { initRedis, getWindData, getBinaryData, closeRedis } = require('./server/redis-client');
const { REDIS_KEYS } = require('./server/wind-data-scheduler');

async function test() {
  try {
    console.log('Connecting to Redis...');
    await initRedis();

    console.log('\n1. Checking wind points data...');
    const windData = await getWindData(REDIS_KEYS.WIND_POINTS);
    if (windData) {
      console.log('✓ Wind points found:', windData.points?.length || 0, 'points');
      console.log('  Source:', windData.source);
      console.log('  Timestamp:', windData.timestamp);
    } else {
      console.log('✗ No wind points data in Redis');
    }

    console.log('\n2. Checking PNG data...');
    const pngData = await getBinaryData(REDIS_KEYS.WIND_PNG);
    if (pngData) {
      console.log('✓ PNG data found:', pngData.length, 'bytes');
    } else {
      console.log('✗ No PNG data in Redis');
    }

    console.log('\n3. Checking metadata...');
    const metadata = await getWindData(REDIS_KEYS.WIND_METADATA);
    if (metadata) {
      console.log('✓ Metadata found:');
      console.log('  Source:', metadata.source);
      console.log('  Width:', metadata.width);
      console.log('  Height:', metadata.height);
      console.log('  U range:', metadata.uMin, '-', metadata.uMax);
      console.log('  V range:', metadata.vMin, '-', metadata.vMax);
    } else {
      console.log('✗ No metadata in Redis');
    }

    console.log('\n4. Checking last update...');
    const lastUpdate = await getWindData(REDIS_KEYS.LAST_UPDATE);
    if (lastUpdate) {
      console.log('✓ Last update:');
      console.log('  Timestamp:', lastUpdate.timestamp);
      console.log('  Success:', lastUpdate.success);
      if (lastUpdate.dataPoints) {
        console.log('  Data points:', lastUpdate.dataPoints);
      }
      if (lastUpdate.error) {
        console.log('  Error:', lastUpdate.error);
      }
    } else {
      console.log('✗ No last update info in Redis');
    }

    await closeRedis();
    console.log('\n✓ Test complete');

  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    process.exit(1);
  }
}

test();
