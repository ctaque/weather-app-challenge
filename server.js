const express = require("express");
const axios = require("axios");
const path = require("path");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const Anthropic = require("@anthropic-ai/sdk").default;

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

// Global wind data endpoint - generates realistic wind patterns based on GRIB data patterns
// In production, this would fetch real GRIB files from NOAA GFS
// https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl
app.get("/api/wind-global", async (req, res) => {
  try {
    const windDataPoints = [];
    const resolution = 3; // degrees - balance between detail and performance

    // Generate realistic wind data based on meteorological patterns
    // This simulates what you would get from GRIB files
    for (let lat = -90; lat <= 90; lat += resolution) {
      for (let lon = -180; lon < 180; lon += resolution) {
        // Generate realistic wind patterns:
        // - Trade winds at tropics (easterlies)
        // - Westerlies at mid-latitudes
        // - Polar easterlies at poles
        // - Jet streams at ~30-60 degrees

        let baseSpeed = 0;
        let direction = 0;

        // Latitude-based wind patterns
        const absLat = Math.abs(lat);

        if (absLat < 30) {
          // Trade winds (easterlies) in tropics
          baseSpeed = 10 + Math.random() * 15;
          direction = lat > 0 ? 90 : 270; // NE in NH, SE in SH
        } else if (absLat >= 30 && absLat < 60) {
          // Prevailing westerlies in mid-latitudes
          baseSpeed = 15 + Math.random() * 25;
          direction = lat > 0 ? 270 : 90; // SW in NH, NW in SH

          // Add jet stream around 40 degrees
          if (absLat >= 35 && absLat <= 45) {
            baseSpeed += 30 + Math.random() * 50;
          }
        } else {
          // Polar easterlies
          baseSpeed = 8 + Math.random() * 12;
          direction = lat > 0 ? 90 : 270;
        }

        // Add some variation based on longitude (simulate weather systems)
        const weatherSystemVariation = Math.sin(lon * Math.PI / 180) * 10;
        baseSpeed += Math.abs(weatherSystemVariation);
        direction += Math.sin((lon + lat) * Math.PI / 90) * 30;

        // Add random variation
        direction += (Math.random() - 0.5) * 20;
        direction = (direction + 360) % 360;

        // Calculate gusts (typically 1.3-1.5x base speed)
        const gusts = baseSpeed * (1.3 + Math.random() * 0.2);

        windDataPoints.push({
          lat: parseFloat(lat.toFixed(2)),
          lon: parseFloat(lon.toFixed(2)),
          speed: parseFloat(baseSpeed.toFixed(1)),
          direction: parseFloat(direction.toFixed(0)),
          gusts: parseFloat(gusts.toFixed(1)),
        });
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      source: 'Simulated NOAA GFS data (GRIB-based patterns)',
      resolution: resolution,
      points: windDataPoints,
      note: 'Production version would fetch real GRIB files from NOAA NOMADS',
    });
  } catch (err) {
    console.error('Error generating wind data:', err);
    res.status(500).json({
      error: err.message || 'Failed to generate wind data',
    });
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

// Serve static built site in production
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
