const { getWindData } = require('./server/opendap-downloader');

async function test() {
  try {
    console.log('Testing OpenDAP downloader...\n');

    const { windPoints, pngBuffer, metadata } = await getWindData();

    console.log('\nResults:');
    console.log('- Wind points:', windPoints.length);
    console.log('- PNG size:', pngBuffer.length, 'bytes');
    console.log('- Metadata:', metadata);
    console.log('\nFirst 5 wind points:');
    windPoints.slice(0, 5).forEach(p => {
      console.log(`  (${p.lat}, ${p.lon}): U=${p.u} V=${p.v} speed=${p.speed}m/s`);
    });

    console.log('\nSuccess!');

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

test();
