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
  getWindDataByIndex,
  getBinaryDataByIndex,
  getAvailableIndices,
  getLatestIndex,
  closeRedis,
} = require("./server/redis-client");
const {
  startScheduler,
  getSchedulerStatus,
  triggerManualFetch,
  triggerLatestFetch,
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

// Global precipitation data endpoint - fetches real data from NOAA GFS (stored in Redis)
app.get("/api/precipitation-global", async (req, res) => {
  try {
    // Get precipitation data from Redis
    const precipData = await getWindDataFromRedis(REDIS_KEYS.PRECIPITATION_POINTS);

    if (!precipData) {
      return res.status(503).json({
        error:
          "Precipitation data not yet available. Please wait for the next scheduled fetch.",
        schedulerStatus: getSchedulerStatus(),
      });
    }

    res.json(precipData);
  } catch (err) {
    console.error("Error fetching precipitation data from Redis:", err);
    res.status(500).json({
      error: err.message || "Failed to fetch precipitation data",
    });
  }
});

// Get list of available precipitation data indices (last 8 only for 24h coverage)
app.get("/api/precipitation-indices", async (req, res) => {
  try {
    const allIndices = await getAvailableIndices(REDIS_KEYS.PRECIPITATION_POINTS);

    // Return only the last 8 indices (24h of data at 3h intervals)
    const last8Indices = allIndices.slice(-8);

    res.json({
      count: last8Indices.length,
      indices: last8Indices
    });
  } catch (err) {
    console.error("Error fetching precipitation indices:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get precipitation data by index
app.get("/api/precipitation-global/:index", async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);

    if (isNaN(index)) {
      return res.status(400).json({ error: "Invalid index parameter" });
    }

    const precipData = await getWindDataByIndex(REDIS_KEYS.PRECIPITATION_POINTS, index);

    if (!precipData) {
      return res.status(404).json({
        error: `No precipitation data available at index ${index}`
      });
    }

    res.json(precipData);
  } catch (err) {
    console.error(`Error fetching precipitation data at index ${req.params.index}:`, err);
    res.status(500).json({ error: err.message });
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

// Get list of available wind data indices (last 8 only for 24h coverage)
app.get("/api/wind-indices", async (req, res) => {
  try {
    console.log("Fetching wind indices with key:", REDIS_KEYS.WIND_POINTS);
    const allIndices = await getAvailableIndices(REDIS_KEYS.WIND_POINTS);
    console.log("All indices found:", allIndices.length);

    // Return only the last 8 indices (24h of data at 3h intervals)
    const last8Indices = allIndices.slice(-8);

    res.json({
      count: last8Indices.length,
      indices: last8Indices
    });
  } catch (err) {
    console.error("Error fetching wind indices:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get wind data by index
app.get("/api/wind-global/:index", async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);

    if (isNaN(index)) {
      return res.status(400).json({ error: "Invalid index parameter" });
    }

    const windData = await getWindDataByIndex(REDIS_KEYS.WIND_POINTS, index);

    if (!windData) {
      return res.status(404).json({
        error: `No wind data available at index ${index}`
      });
    }

    res.json(windData);
  } catch (err) {
    console.error(`Error fetching wind data at index ${req.params.index}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Get windgl metadata by index
app.get("/api/windgl/metadata.json/:index", async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);

    if (isNaN(index)) {
      return res.status(400).json({ error: "Invalid index parameter" });
    }

    const metadata = await getWindDataByIndex(REDIS_KEYS.WIND_METADATA, index);

    if (!metadata) {
      return res.status(404).json({
        error: `No wind metadata available at index ${index}`
      });
    }

    // Add tiles URL to metadata - use indexed URL
    const tileUrl = `/api/windgl/wind.png/${index}`;
    const response = {
      ...metadata,
      tiles: [tileUrl],
      index: index
    };

    res.json(response);
  } catch (err) {
    console.error(`Error fetching windgl metadata at index ${req.params.index}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Get windgl PNG tile by index
app.get("/api/windgl/wind.png/:index", async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);

    if (isNaN(index)) {
      return res.status(400).send("Invalid index parameter");
    }

    const pngBuffer = await getBinaryDataByIndex(REDIS_KEYS.WIND_PNG, index);

    if (!pngBuffer) {
      return res.status(404).send(`No wind data available at index ${index}`);
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(pngBuffer);
  } catch (err) {
    console.error(`Error fetching windgl PNG at index ${req.params.index}:`, err);
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

// Chart analysis endpoint using Claude API
app.post("/api/chart-analysis", aiSummaryLimiter, async (req, res) => {
  if (!ANTHROPIC_API_KEY || !anthropic) {
    return res.status(500).json({
      error: "Server missing ANTHROPIC_API_KEY environment variable",
    });
  }

  const { weatherData, lang, chartType } = req.body;

  if (!weatherData) {
    return res.status(400).json({
      error: 'Missing required "weatherData" in request body',
    });
  }

  if (!chartType) {
    return res.status(400).json({
      error: 'Missing required "chartType" in request body',
    });
  }

  try {
    const language = lang === "fr" ? "français" : "anglais";

    // Prepare detailed weather data for chart analysis
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
        pressure: h.pressure_mb,
        wind_kph: h.wind_kph,
        wind_dir: h.wind_dir,
        wind_degree: h.wind_degree,
        uv: h.uv,
        is_day: h.is_day,
      })),
      astro: weatherData.astro,
    };

    let prompt = "";

    // Generate specific prompt based on chart type
    switch (chartType) {
      case "temperature":
        prompt = `Tu es un météorologue expert. Analyse le graphique de température pour ${weatherInfo.location} le ${weatherInfo.date}.

Données du jour: min ${weatherInfo.day.mintemp}°C, max ${weatherInfo.day.maxtemp}°C

Données horaires:
${weatherInfo.hourly.map((h) => `${h.time}: ${h.temp}°C`).join("\n")}

Analyse en ${language} l'évolution de la température sur la journée:
- Identifie les tendances (réchauffement/refroidissement)
- Signale les pics et creux de température
- Donne les moments optimaux pour différentes activités
- Fournis des conseils pratiques sur l'habillement

Sois concis (4-5 phrases max) et pratique.`;
        break;

      case "rain":
        prompt = `Tu es un météorologue expert. Analyse le graphique des risques de pluie pour ${weatherInfo.location} le ${weatherInfo.date}.

Données horaires:
${weatherInfo.hourly.map((h) => `${h.time}: ${h.rain}% de pluie`).join("\n")}

Analyse en ${language} les risques de précipitations:
- Identifie les périodes à risque et les fenêtres sèches
- Évalue l'intensité probable des précipitations
- Recommande les meilleurs créneaux pour les activités extérieures
- Donne des conseils sur les équipements nécessaires

Sois concis (4-5 phrases max) et pratique.`;
        break;

      case "pressure":
        prompt = `Tu es un météorologue expert. Analyse le graphique de pression atmosphérique pour ${weatherInfo.location} le ${weatherInfo.date}.

Pression moyenne: ${weatherInfo.day.pressure} mb

Données horaires:
${weatherInfo.hourly.map((h) => `${h.time}: ${h.pressure} mb`).join("\n")}

Analyse en ${language} les variations de pression:
- Identifie les tendances (hausse/baisse)
- Explique ce que ces variations signifient météorologiquement
- Relie les variations de pression aux changements de temps attendus
- Donne des insights sur la stabilité atmosphérique

Sois concis (4-5 phrases max) et pratique.`;
        break;

      case "wind":
        prompt = `Tu es un météorologue expert. Analyse le graphique de vent pour ${weatherInfo.location} le ${weatherInfo.date}.

Données horaires (vitesse et direction):
${weatherInfo.hourly.map((h) => `${h.time}: ${h.wind_kph} km/h ${h.wind_dir} (${h.wind_degree}°)`).join("\n")}

Analyse en ${language} les conditions de vent:
- Identifie les périodes de vent fort et les accalmies
- Analyse les changements de direction du vent
- Explique l'impact sur les activités extérieures (voile, kitesurf, randonnée, etc.)
- Donne des recommandations de sécurité si nécessaire

Sois concis (4-5 phrases max) et pratique.`;
        break;

      case "sunshine":
        const sunriseTime = weatherInfo.astro?.sunrise || "Non disponible";
        const sunsetTime = weatherInfo.astro?.sunset || "Non disponible";

        prompt = `Tu es un météorologue expert. Analyse la trajectoire du soleil et l'ensoleillement pour ${weatherInfo.location} le ${weatherInfo.date}.

Données astronomiques:
- Lever du soleil: ${sunriseTime}
- Coucher du soleil: ${sunsetTime}

Données horaires (indice UV et jour/nuit):
${weatherInfo.hourly.map((h) => `${h.time}: UV ${h.uv || 0}, ${h.is_day === 1 ? 'jour' : 'nuit'}`).join("\n")}

Analyse en ${language} l'ensoleillement de la journée:
- Identifie la durée du jour et les heures d'ensoleillement maximal
- Analyse l'évolution de l'indice UV au cours de la journée
- Recommande les périodes optimales pour les activités extérieures (en fonction de l'ensoleillement)
- Donne des conseils de protection solaire pour les heures d'UV élevé

Sois concis (4-5 phrases max) et pratique.`;
        break;

      default:
        return res.status(400).json({
          error: `Unknown chart type: ${chartType}`,
        });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const analysis = message.content[0].text;

    res.json({ analysis });
  } catch (err) {
    console.error("Error calling Claude API:", err);
    res.status(500).json({
      error: err.message || "Failed to generate chart analysis",
    });
  }
});

// Scheduler status endpoint
app.get("/api/wind-status", (req, res) => {
  res.json(getSchedulerStatus());
});

// Manual trigger endpoint for 24h historical fetch (for debugging)
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

// Manual trigger endpoint for latest forecast (for debugging)
app.post("/api/wind-refresh-latest", async (req, res) => {
  try {
    const success = await triggerLatestFetch();
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
