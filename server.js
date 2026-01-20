const express = require("express");
const axios = require("axios");
const path = require("path");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const Anthropic = require("@anthropic-ai/sdk").default;
const {
  initRedis,
  getWindData: getWindDataFromRedis,
  getBinaryData,
  closeRedis,
} = require("./server/redis-client");
const {
  startScheduler,
  getSchedulerStatus,
  triggerManualFetch,
  REDIS_KEYS,
} = require("./server/wind-data-scheduler");

const app = express();
const PORT = process.env.PORT || 3000;
const WEATHER_KEY = process.env.WEATHERAPI_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const isDevelopment = process.env.NODE_ENV !== "production";

if (!WEATHER_KEY) {
  console.warn(
    "WARNING: WEATHERAPI_KEY not set. /api/weather will fail without a key.",
  );
}

if (!ANTHROPIC_API_KEY) {
  console.warn(
    "WARNING: ANTHROPIC_API_KEY not set. /api/weather-summary will fail without a key.",
  );
}

const anthropic = ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null;

app.use(cors());
app.use(express.json());

// Rate limiter for AI summary endpoint (production only)
const aiSummaryLimiter = isDevelopment
  ? (req, res, next) => next() // No limit in development
  : rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
      error:
        "Trop de requêtes depuis cette adresse IP, veuillez réessayer dans 5 minutes.",
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });

// Proxy endpoint — keeps the API key secret
app.get("/api/weather", async (req, res) => {
  const q = req.query.q;
  const days = req.query.days || "1";
  const lang = req.query.lang || "en";

  if (!q) {
    return res
      .status(400)
      .send('Missing required "q" query parameter (city or "lat,lon")');
  }

  if (!WEATHER_KEY) {
    return res
      .status(500)
      .send("Server missing WEATHERAPI_KEY environment variable");
  }

  try {
    const url = `http://api.weatherapi.com/v1/forecast.json`;
    const r = await axios.get(url, {
      params: {
        key: WEATHER_KEY,
        q,
        days,
        lang,
      },
      timeout: 10000,
    });
    res.json(r.data);
  } catch (err) {
    if (err.response) {
      // forward WeatherAPI error
      res.status(err.response.status).send(err.response.data);
    } else {
      res.status(500).send(err.message || "Unknown error");
    }
  }
});

// Global wind data endpoint - fetches real GRIB data from NOAA GFS (stored in Redis)
app.get("/api/wind-global", async (req, res) => {
  try {
    // Get wind data from Redis
    const windData = await getWindDataFromRedis(REDIS_KEYS.WIND_POINTS);

    if (!windData) {
      return res.status(503).json({
        error:
          "Wind data not yet available. Please wait for the next scheduled fetch.",
        schedulerStatus: getSchedulerStatus(),
      });
    }

    res.json(windData);
  } catch (err) {
    console.error("Error fetching wind data from Redis:", err);
    res.status(500).json({
      error: err.message || "Failed to fetch wind data",
    });
  }
});

// Windgl metadata endpoint
app.get("/api/windgl/metadata.json", async (req, res) => {
  try {
    const metadata = await getWindDataFromRedis(REDIS_KEYS.WIND_METADATA);

    if (!metadata) {
      return res.status(404).json({
        error: "No wind data available. Please wait for data to load.",
        schedulerStatus: getSchedulerStatus(),
      });
    }

    // Add tiles URL to metadata - use relative URL for Vite proxy compatibility
    const tileUrl = "/api/windgl/wind.png";
    const response = {
      ...metadata,
      tiles: [tileUrl],
    };

    res.json(response);
  } catch (err) {
    console.error("Error fetching windgl metadata:", err);
    res.status(500).json({ error: err.message });
  }
});

// Windgl PNG tile endpoint
app.get("/api/windgl/wind.png", async (req, res) => {
  try {
    const pngBuffer = await getBinaryData(REDIS_KEYS.WIND_PNG);

    if (!pngBuffer) {
      return res.status(404).send("No wind data available.");
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(pngBuffer);
  } catch (err) {
    console.error("Error fetching windgl PNG:", err);
    res.status(500).send("Error fetching wind data");
  }
});

// Weather summary endpoint using Claude API
app.post("/api/weather-summary", aiSummaryLimiter, async (req, res) => {
  if (!ANTHROPIC_API_KEY || !anthropic) {
    return res.status(500).json({
      error: "Server missing ANTHROPIC_API_KEY environment variable",
    });
  }

  const { weatherData, lang } = req.body;

  if (!weatherData) {
    return res.status(400).json({
      error: 'Missing required "weatherData" in request body',
    });
  }

  try {
    const language = lang === "fr" ? "français" : "anglais";

    // Prepare weather data for Claude
    const weatherInfo = {
      location: weatherData.location,
      date: weatherData.date,
      day: {
        maxtemp: weatherData.day.maxtemp_c,
        mintemp: weatherData.day.mintemp_c,
        condition: weatherData.day.condition.text,
        rain_chance: weatherData.day.daily_chance_of_rain,
        pressure: weatherData.day.pressure_mb,
      },
      hourly: weatherData.hour.map((h) => ({
        time: h.time.slice(11, 16),
        temp: h.temp_c,
        condition: h.condition.text,
        rain: h.chance_of_rain,
        wind_kph: h.wind_kph,
        wind_dir: h.wind_dir,
      })),
    };

    const prompt = `Tu es un météorologue expert. Voici les prévisions météo pour ${weatherInfo.location} le ${weatherInfo.date}.

Données du jour:
- Température: min ${weatherInfo.day.mintemp}°C, max ${weatherInfo.day.maxtemp}°C
- Conditions: ${weatherInfo.day.condition}
- Risque de pluie: ${weatherInfo.day.rain_chance}%
- Pression: ${weatherInfo.day.pressure} mb

Données horaires (quelques échantillons):
${weatherInfo.hourly
        .slice(0, 8)
        .map(
          (h) =>
            `- ${h.time}: ${h.temp}°C, ${h.condition}, vent ${h.wind_kph} km/h ${h.wind_dir}`,
        )
        .join("\n")}

Génère un résumé météo concis et informatif en ${language} (2-3 phrases maximum) qui donne une vue d'ensemble de la journée et des conseils pratiques pour les activités. Sois naturel et engageant.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const summary = message.content[0].text;

    res.json({ summary });
  } catch (err) {
    console.error("Error calling Claude API:", err);
    res.status(500).json({
      error: err.message || "Failed to generate weather summary",
    });
  }
});

// Scheduler status endpoint
app.get("/api/wind-status", (req, res) => {
  res.json(getSchedulerStatus());
});

// Manual trigger endpoint (for debugging)
app.post("/api/wind-refresh", async (req, res) => {
  try {
    const success = await triggerManualFetch();
    res.json({
      success,
      status: getSchedulerStatus(),
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      status: getSchedulerStatus(),
    });
  }
});

// Serve static built site in production
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Initialize Redis and start scheduler
async function initializeServer() {
  try {
    console.log("Initializing Redis...");
    await initRedis();
    console.log("Redis initialized successfully");

    console.log("Starting wind data scheduler...");
    startScheduler();

    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to initialize server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  await closeRedis();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down gracefully...");
  await closeRedis();
  process.exit(0);
});

// Start the server
initializeServer();
