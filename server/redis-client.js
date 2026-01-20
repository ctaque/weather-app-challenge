const { createClient, commandOptions } = require('redis');

// Redis client configuration
// Support both REDIS_URL and UPSTASH_REDIS_URL (Heroku addon)
const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || 'redis://localhost:6379';
const REDIS_TTL = 60 * 60; // 1 hour in seconds

let client = null;
let isConnected = false;

/**
 * Initialize Redis client
 */
async function initRedis() {
  if (client) {
    return client;
  }

  try {
    client = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis: Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          const delay = Math.min(retries * 100, 3000);
          console.log(`Redis: Reconnecting in ${delay}ms...`);
          return delay;
        }
      }
    });

    client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      isConnected = false;
    });

    client.on('connect', () => {
      console.log('Redis: Connecting...');
    });

    client.on('ready', () => {
      console.log('Redis: Connected and ready');
      isConnected = true;
    });

    client.on('reconnecting', () => {
      console.log('Redis: Reconnecting...');
      isConnected = false;
    });

    client.on('end', () => {
      console.log('Redis: Connection closed');
      isConnected = false;
    });

    await client.connect();
    return client;
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
    throw error;
  }
}

/**
 * Get Redis client (ensures initialized)
 */
async function getClient() {
  if (!client || !isConnected) {
    await initRedis();
  }
  return client;
}

/**
 * Store wind data in Redis (with automatic chunking for large datasets)
 * @param {Object|Array} data - Wind data to store
 * @param {string} key - Redis key (default: 'wind:data')
 */
async function setWindData(data, key = 'wind:data') {
  try {
    const redis = await getClient();
    const dataString = JSON.stringify(data);
    const dataSize = Buffer.byteLength(dataString, 'utf8');

    // Upstash Redis free tier limit: 10 MB per request
    const MAX_SIZE = 8 * 1024 * 1024; // 8 MB to be safe

    if (dataSize > MAX_SIZE) {
      // Check if data is an array or object with large array property
      if (Array.isArray(data)) {
        // Split large array into chunks
        console.log(`Redis: Array too large (${dataSize} bytes), splitting into chunks...`);

        const chunkSize = Math.ceil(data.length / Math.ceil(dataSize / MAX_SIZE));
        const chunks = [];

        for (let i = 0; i < data.length; i += chunkSize) {
          chunks.push(data.slice(i, i + chunkSize));
        }

        // Store chunk count
        await redis.setEx(`${key}:chunks`, REDIS_TTL, chunks.length.toString());

        // Store each chunk
        for (let i = 0; i < chunks.length; i++) {
          await redis.setEx(`${key}:chunk:${i}`, REDIS_TTL, JSON.stringify(chunks[i]));
        }

        console.log(`Redis: Stored ${data.length} items in ${chunks.length} chunks at key '${key}' with TTL ${REDIS_TTL}s`);
      } else if (typeof data === 'object' && data !== null && data.points && Array.isArray(data.points)) {
        // Object with large 'points' array - split points into chunks
        console.log(`Redis: Object with large points array (${dataSize} bytes), splitting points into chunks...`);

        const points = data.points;
        const otherData = { ...data };
        delete otherData.points;

        const chunkSize = Math.ceil(points.length / Math.ceil(dataSize / MAX_SIZE));
        const chunks = [];

        for (let i = 0; i < points.length; i += chunkSize) {
          chunks.push(points.slice(i, i + chunkSize));
        }

        // Store metadata (without points)
        await redis.setEx(`${key}:meta`, REDIS_TTL, JSON.stringify(otherData));

        // Store chunk count
        await redis.setEx(`${key}:chunks`, REDIS_TTL, chunks.length.toString());

        // Store each chunk
        for (let i = 0; i < chunks.length; i++) {
          await redis.setEx(`${key}:chunk:${i}`, REDIS_TTL, JSON.stringify(chunks[i]));
        }

        console.log(`Redis: Stored ${points.length} points in ${chunks.length} chunks at key '${key}' with TTL ${REDIS_TTL}s`);
      } else {
        throw new Error(`Data too large (${dataSize} bytes) and cannot be chunked automatically`);
      }
    } else {
      // Store normally if small enough
      await redis.setEx(key, REDIS_TTL, dataString);
      console.log(`Redis: Stored wind data at key '${key}' with TTL ${REDIS_TTL}s`);
    }
  } catch (error) {
    console.error('Redis: Error storing wind data:', error);
    throw error;
  }
}

/**
 * Get wind data from Redis (with automatic chunk reassembly)
 * @param {string} key - Redis key (default: 'wind:data')
 * @returns {Object|Array|null} - Parsed wind data or null if not found
 */
async function getWindData(key = 'wind:data') {
  try {
    const redis = await getClient();

    // Check if data is chunked
    const chunkCount = await redis.get(`${key}:chunks`);

    if (chunkCount) {
      // Check if there's metadata (for objects with chunked points array)
      const metaData = await redis.get(`${key}:meta`);

      // Retrieve all chunks
      const numChunks = parseInt(chunkCount, 10);
      console.log(`Redis: Retrieving ${numChunks} chunks from key '${key}'...`);

      const chunks = [];
      for (let i = 0; i < numChunks; i++) {
        const chunkData = await redis.get(`${key}:chunk:${i}`);
        if (chunkData) {
          chunks.push(JSON.parse(chunkData));
        }
      }

      // Merge chunks
      const points = chunks.flat();

      if (metaData) {
        // Reconstruct object with points
        const metadata = JSON.parse(metaData);
        metadata.points = points;
        console.log(`Redis: Retrieved and merged ${numChunks} chunks (${points.length} points) from key '${key}'`);
        return metadata;
      } else {
        // Return merged array
        console.log(`Redis: Retrieved and merged ${numChunks} chunks (${points.length} items) from key '${key}'`);
        return points;
      }
    } else {
      // Retrieve normal (non-chunked) data
      const data = await redis.get(key);
      if (!data) {
        console.log(`Redis: No data found at key '${key}'`);
        return null;
      }
      console.log(`Redis: Retrieved wind data from key '${key}'`);
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Redis: Error retrieving wind data:', error);
    throw error;
  }
}

/**
 * Store binary data (PNG image) in Redis
 * @param {Buffer} buffer - Binary data
 * @param {string} key - Redis key
 */
async function setBinaryData(buffer, key) {
  try {
    const redis = await getClient();
    // Store as base64 to avoid encoding issues
    const base64Data = buffer.toString('base64');
    await redis.setEx(key, REDIS_TTL, base64Data);
    console.log(`Redis: Stored binary data at key '${key}' (${buffer.length} bytes) with TTL ${REDIS_TTL}s`);
  } catch (error) {
    console.error('Redis: Error storing binary data:', error);
    throw error;
  }
}

/**
 * Get binary data from Redis
 * @param {string} key - Redis key
 * @returns {Buffer|null} - Buffer or null if not found
 */
async function getBinaryData(key) {
  try {
    const redis = await getClient();

    // Get base64 encoded data
    const base64Data = await redis.get(key);

    if (!base64Data) {
      console.log(`Redis: No binary data found at key '${key}'`);
      return null;
    }

    // Decode from base64 to Buffer
    const buffer = Buffer.from(base64Data, 'base64');
    console.log(`Redis: Retrieved binary data from key '${key}' (${buffer.length} bytes)`);
    return buffer;
  } catch (error) {
    console.error('Redis: Error retrieving binary data:', error);
    throw error;
  }
}

/**
 * Check if Redis is connected
 */
function isRedisConnected() {
  return isConnected;
}

/**
 * Close Redis connection
 */
async function closeRedis() {
  if (client) {
    await client.quit();
    client = null;
    isConnected = false;
    console.log('Redis: Connection closed gracefully');
  }
}

module.exports = {
  initRedis,
  getClient,
  setWindData,
  getWindData,
  setBinaryData,
  getBinaryData,
  isRedisConnected,
  closeRedis
};
