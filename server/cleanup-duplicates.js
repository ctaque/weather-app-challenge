/**
 * Script to cleanup duplicate entries in Redis
 * Removes entries that have the same dataTime (within 2h tolerance)
 */

const { initRedis, getClient } = require("./redis-client");

const REDIS_KEYS = {
  WIND_POINTS: "wind:points",
  PRECIPITATION_POINTS: "precipitation:points",
};

async function cleanupDuplicates(baseKey) {
  try {
    const redis = await getClient();

    // Get existing indices
    const indicesStr = await redis.get(`${baseKey}:indices`);
    if (!indicesStr) {
      console.log(`No indices found for ${baseKey}`);
      return;
    }

    const indices = JSON.parse(indicesStr);
    console.log(`\nFound ${indices.length} entries for ${baseKey}`);

    // Group by dataTime (within 2h tolerance)
    const tolerance = 2 * 60 * 60 * 1000; // 2 hours
    const uniqueEntries = [];
    const duplicatesToDelete = [];

    for (const entry of indices) {
      if (!entry.dataTime) {
        uniqueEntries.push(entry);
        continue;
      }

      const dataTimeMs = new Date(entry.dataTime).getTime();

      // Check if we already have an entry for this time period
      const existingIndex = uniqueEntries.findIndex((unique) => {
        if (!unique.dataTime) return false;
        const existingDataTimeMs = new Date(unique.dataTime).getTime();
        const timeDiff = Math.abs(dataTimeMs - existingDataTimeMs);
        return timeDiff < tolerance;
      });

      if (existingIndex !== -1) {
        // This is a duplicate - keep the newer one
        const existing = uniqueEntries[existingIndex];
        const existingTimestamp = new Date(existing.timestamp).getTime();
        const currentTimestamp = new Date(entry.timestamp).getTime();

        if (currentTimestamp > existingTimestamp) {
          // Current entry is newer, replace the old one
          duplicatesToDelete.push(existing);
          uniqueEntries[existingIndex] = entry;
          console.log(
            `  Replacing ${existing.dataTime} (index ${existing.index}) with newer entry (index ${entry.index})`,
          );
        } else {
          // Existing entry is newer, delete current
          duplicatesToDelete.push(entry);
          console.log(
            `  Removing duplicate ${entry.dataTime} (index ${entry.index})`,
          );
        }
      } else {
        uniqueEntries.push(entry);
      }
    }

    console.log(
      `\nFound ${duplicatesToDelete.length} duplicates to remove`,
    );

    // Delete duplicate data
    for (const dup of duplicatesToDelete) {
      const key = `${baseKey}:${dup.index}`;

      // Delete chunked data if exists
      const chunkCount = await redis.get(`${key}:chunks`);
      if (chunkCount) {
        const numChunks = parseInt(chunkCount, 10);
        for (let i = 0; i < numChunks; i++) {
          await redis.del(`${key}:chunk:${i}`);
        }
        await redis.del(`${key}:chunks`);
        await redis.del(`${key}:meta`);
      } else {
        await redis.del(key);
      }

      console.log(`  Deleted data at index ${dup.index}`);
    }

    // Store cleaned indices list
    await redis.setEx(`${baseKey}:indices`, 3600, JSON.stringify(uniqueEntries));

    console.log(`✅ Cleanup complete for ${baseKey}`);
    console.log(`   Before: ${indices.length} entries`);
    console.log(`   After: ${uniqueEntries.length} entries`);
    console.log(`   Removed: ${duplicatesToDelete.length} duplicates\n`);
  } catch (error) {
    console.error(`Error cleaning up ${baseKey}:`, error);
  }
}

async function main() {
  console.log("=== Starting duplicate cleanup ===\n");

  try {
    await initRedis();

    await cleanupDuplicates(REDIS_KEYS.WIND_POINTS);
    await cleanupDuplicates(REDIS_KEYS.PRECIPITATION_POINTS);

    console.log("=== Cleanup complete ===");
    process.exit(0);
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
