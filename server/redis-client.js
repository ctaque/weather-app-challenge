const { createClient, commandOptions } = require('redis');

// Redis client configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
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
 * Store wind data in Redis
 * @param {Object} data - Wind data to store
 * @param {string} key - Redis key (default: 'wind:data')
 */
async function setWindData(data, key = 'wind:data') {
  try {
    const redis = await getClient();
    await redis.setEx(key, REDIS_TTL, JSON.stringify(data));
    console.log(`Redis: Stored wind data at key '${key}' with TTL ${REDIS_TTL}s`);
  } catch (error) {
    console.error('Redis: Error storing wind data:', error);
    throw error;
  }
}

/**
 * Get wind data from Redis
 * @param {string} key - Redis key (default: 'wind:data')
 * @returns {Object|null} - Parsed wind data or null if not found
 */
async function getWindData(key = 'wind:data') {
  try {
    const redis = await getClient();
    const data = await redis.get(key);
    if (!data) {
      console.log(`Redis: No data found at key '${key}'`);
      return null;
    }
    console.log(`Redis: Retrieved wind data from key '${key}'`);
    return JSON.parse(data);
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
