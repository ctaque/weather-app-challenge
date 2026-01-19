const express = require('express')
const axios = require('axios')
const path = require('path')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 3000
const WEATHER_KEY = process.env.WEATHERAPI_KEY

if (!WEATHER_KEY) {
  console.warn('WARNING: WEATHERAPI_KEY not set. /api/weather will fail without a key.')
}

app.use(cors())
app.use(express.json())

// Proxy endpoint — keeps the API key secret
app.get('/api/weather', async (req, res) => {
  const q = req.query.q
  const days = req.query.days || '1'
  const lang = req.query.lang || 'en'

  if (!q) {
    return res.status(400).send('Missing required "q" query parameter (city or "lat,lon")')
  }

  if (!WEATHER_KEY) {
    return res.status(500).send('Server missing WEATHERAPI_KEY environment variable')
  }

  try {
    const url = `http://api.weatherapi.com/v1/forecast.json`
    const r = await axios.get(url, {
      params: {
        key: WEATHER_KEY,
        q,
        days,
        lang
      },
      timeout: 10000
    })
    res.json(r.data)
  } catch (err) {
    if (err.response) {
      // forward WeatherAPI error
      res.status(err.response.status).send(err.response.data)
    } else {
      res.status(500).send(err.message || 'Unknown error')
    }
  }
})

// Serve static built site in production
const distPath = path.join(__dirname, 'dist')
app.use(express.static(distPath))
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})