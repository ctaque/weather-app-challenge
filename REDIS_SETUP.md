# Redis GRIB Data Caching System

## Overview

This weather app now uses Redis to cache GRIB forecast data from **NOAA GFS (Global Forecast System)**. The system automatically fetches wind data every hour and stores it in Redis for efficient delivery to the frontend.

## Data Source

**NOAA GFS (Global Forecast System)** via NOMADS
- Source: https://nomads.ncep.noaa.gov
- Data type: GRIB2 format
- Resolution: 0.5° (~50km grid)
- Update frequency: Every 6 hours (00, 06, 12, 18 UTC)
- Variables fetched: U and V wind components at 10m above ground
- Region: France (lat: 41-52°N, lon: -5-10°E)

## Architecture

### Components

1. **Redis Client** (`server/redis-client.js`)
   - Manages Redis connection
   - Provides functions to store/retrieve JSON and binary data
   - Handles reconnection and error recovery
   - TTL: 1 hour (auto-expiration)

2. **GRIB Downloader** (`server/grib-downloader.js`)
   - Downloads GRIB2 files from NOAA NOMADS
   - Decodes wind data using `grib2-simple`
   - Converts to PNG format for windgl visualization
   - Extracts wind points for JSON API

3. **Scheduler** (`server/wind-data-scheduler.js`)
   - Runs on startup (immediate fetch)
   - Scheduled fetch: Every hour at minute 5 (e.g., 00:05, 01:05, etc.)
   - Stores data in Redis with these keys:
     - `wind:points` - JSON array of wind data points
     - `wind:png` - Binary PNG image for windgl
     - `wind:metadata` - Metadata (bounds, resolution, source)
     - `wind:last_update` - Last fetch status and timestamp

4. **Server** (`server.js`)
   - Initializes Redis on startup
   - Starts the scheduler
   - Serves wind data from Redis via API endpoints

## Setup Instructions

### 1. Install Redis

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 redis:latest
```

### 2. Configure Environment

Copy `.env.example` to `.env` and set the Redis URL:

```bash
REDIS_URL=redis://localhost:6379
```

For production with authentication:
```bash
REDIS_URL=redis://username:password@host:port
```

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Run the Server

```bash
npm run dev          # Development mode
npm start            # Production mode
```

## API Endpoints

### Wind Data Endpoints

1. **GET /api/wind-global**
   - Returns wind data points from Redis
   - Response: JSON with wind data for France region
   - Status 503 if data not yet available

2. **GET /api/windgl/metadata.json**
   - Returns windgl metadata with PNG tile URL
   - Used by windgl visualization library

3. **GET /api/windgl/wind.png**
   - Returns PNG image with encoded wind data
   - R channel: U component (eastward)
   - G channel: V component (northward)

### Status & Debugging Endpoints

4. **GET /api/wind-status**
   - Returns scheduler status and last fetch info
   - Shows success/failure, timestamp, error messages

5. **POST /api/wind-refresh**
   - Manually trigger a GRIB data fetch
   - Useful for testing and debugging

## Data Flow

```
NOAA GFS NOMADS Server
        ↓
    (HTTP Download)
        ↓
GRIB Downloader (server/grib-downloader.js)
        ↓
   [Decode GRIB2]
        ↓
  ┌─────────┴─────────┐
  ↓                   ↓
Wind Points      PNG Image
  (JSON)          (Binary)
  ↓                   ↓
Redis Cache (TTL: 1 hour)
  ↓                   ↓
API Endpoints
  ↓                   ↓
Frontend (React)
```

## Scheduler Details

### Schedule
- **Initial run**: Immediately on server startup
- **Recurring**: Every hour at minute 5 (cron: `5 * * * *`)

### Why minute 5?
GFS data becomes available ~3.5 hours after the forecast run time. Running at minute 5 ensures we don't fetch too early.

### Error Handling
- If fetch fails, error is logged and stored in Redis
- Next scheduled fetch will retry
- Frontend receives 503 status if no data is available

## Redis Keys

| Key | Type | Description | TTL |
|-----|------|-------------|-----|
| `wind:points` | JSON | Array of wind data points with lat/lon/u/v/speed/direction | 1 hour |
| `wind:png` | Binary | PNG image with encoded wind data for windgl | 1 hour |
| `wind:metadata` | JSON | Metadata (source, date, bounds, min/max values) | 1 hour |
| `wind:last_update` | JSON | Last fetch status and timestamp | 1 hour |

## Monitoring

### Check Scheduler Status
```bash
curl http://localhost:3000/api/wind-status
```

### Check Redis Keys
```bash
redis-cli
> KEYS wind:*
> GET wind:last_update
> TTL wind:points
```

### Manually Trigger Fetch
```bash
curl -X POST http://localhost:3000/api/wind-refresh
```

## Production Deployment

### Redis Hosting Options

1. **Self-hosted**: Install Redis on your server
2. **Redis Cloud**: https://redis.com/cloud/
3. **AWS ElastiCache**: https://aws.amazon.com/elasticache/
4. **Heroku Redis**: https://elements.heroku.com/addons/heroku-redis
5. **DigitalOcean Managed Redis**: https://www.digitalocean.com/products/managed-databases-redis

### Environment Variables

Set `REDIS_URL` in your production environment:
```bash
heroku config:set REDIS_URL=redis://...
```

## Troubleshooting

### Redis Connection Failed
- Check if Redis is running: `redis-cli ping`
- Verify REDIS_URL is correct
- Check firewall/network settings

### No Wind Data Available
- Check scheduler status: `GET /api/wind-status`
- View server logs for fetch errors
- Manually trigger fetch: `POST /api/wind-refresh`

### GRIB Download Fails
- NOAA NOMADS may be temporarily unavailable
- Check your internet connection
- Verify the forecast run time is valid
- Check NOMADS server status: https://nomads.ncep.noaa.gov

## Performance

- **Data size**: ~5,000 wind points for France region
- **PNG size**: ~50-100 KB
- **Fetch time**: 5-15 seconds (download + decode)
- **Redis memory**: ~1-2 MB per cache entry
- **Cache duration**: 1 hour (auto-expiration)

## Dependencies

- `redis` (v5.10.0) - Redis client for Node.js
- `node-cron` (v4.2.1) - Cron scheduler
- `grib2-simple` (v1.1.1) - GRIB2 decoder
- `canvas` (v3.2.1) - PNG generation
- `node-fetch` (v2.7.0) - HTTP client

## License

This implementation uses publicly available NOAA GFS data, which is in the public domain.
