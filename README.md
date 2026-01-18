# Weather App (React + Vite) — WeatherAPI.com + Heroku

Overview
- React + Vite (TypeScript) front-end
- Express server used as a backend proxy to keep your WeatherAPI key secret
- Deployable to Heroku

Prerequisites
- Node.js (18+ recommended)
- npm
- WeatherAPI account + API key (https://www.weatherapi.com/)

Local development
1. Clone the repo (or create the project folder from the provided files).
2. Create a local environment file with your API key:
   - Create a file named `.env.local` (not committed) with:
     WEATHERAPI_KEY=your_weatherapi_key_here
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
2. Set your WeatherAPI key on Heroku:
   heroku config:set WEATHERAPI_KEY=your_weatherapi_key_here --app your-app-name
3. Push to Heroku (assuming `main` branch):
   git push heroku main
Heroku will run the `heroku-postbuild` script to build the Vite app and then start `node server.js`.

Server endpoints
- GET /api/weather?q={cityOrLatLon}&days={1|3} — returns WeatherAPI forecast.json result (proxied)

Notes
- The API key is never exposed to the browser; the server uses the environment variable.
- For dev, Vite proxies `/api` to the server so the same code works locally and in production.
