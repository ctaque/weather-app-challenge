# Weather App (React + Vite) — WeatherAPI.com + Heroku

Overview
- React + Vite (TypeScript) front-end
- Express server used as a backend proxy to keep your WeatherAPI key secret
- Deployable to Heroku

Prerequisites
- Node.js (18+ recommended)
- npm
- WeatherAPI account + API key (https://www.weatherapi.com/)
- Anthropic API key (https://console.anthropic.com/) - for AI-generated weather summaries

Local development
1. Clone the repo (or create the project folder from the provided files).
2. Create a local environment file with your API keys:
   - Create a file named `.env.local` (not committed) or use `.envrc` (for direnv) with:
     WEATHERAPI_KEY=your_weatherapi_key_here
     ANTHROPIC_API_KEY=your_anthropic_api_key_here
   - See `.env.example` for reference
3. Install and run:
   npm install
   npm run dev
4. Open http://localhost:5173 — the Vite dev server proxies `/api` to the local Express server.

Build for production locally
- npm run build
- npm run start (serves built files on port 3000 by default)

Heroku deployment
1. Login and create an app:
   heroku login
   heroku create your-app-name
2. Set your API keys on Heroku:
   heroku config:set WEATHERAPI_KEY=your_weatherapi_key_here --app your-app-name
   heroku config:set ANTHROPIC_API_KEY=your_anthropic_api_key_here --app your-app-name
3. Push to Heroku (assuming `main` branch):
   git push heroku main
Heroku will run the `heroku-postbuild` script to build the Vite app and then start `node server.js`.

Server endpoints
- GET /api/weather?q={cityOrLatLon}&days={1|3}&lang={en|fr} — returns WeatherAPI forecast.json result (proxied)
- POST /api/weather-summary — generates AI-powered weather summary using Claude API
  Body: { weatherData: { location, date, day, hour }, lang: "fr" | "en" }
  Returns: { summary: "..." }

Features
- 🌤️ Weather forecasts for any city or coordinates
- 📊 Interactive charts: temperature, precipitation, pressure, wind speed & direction
- 🤖 AI-powered weather summaries using Claude (Anthropic API)
- 🌍 Multi-language support (French/English)
- 📐 Multiple unit systems (Knots/°C or Mph/°F)
- 🎨 Dark/Light theme toggle
- 🗺️ Interactive map integration

Notes
- API keys are never exposed to the browser; the server uses environment variables.
- For dev, Vite proxies `/api` to the server so the same code works locally and in production.
- The AI summary feature requires a valid Anthropic API key.
