import React from 'react'
import { format, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'

type CityForecast = {
  location: { name: string; region?: string; country?: string; lat: number; lon: number }
  current: {
    temp_c: number
    temp_f: number
    condition_text: string
    humidity: number
    wind_kph: number
    emoji: string
    pressure_mb: number
  }
  forecast: {
    forecastday: Array<{
      date: string
      day: {
        maxtemp_c: number
        mintemp_c: number
        condition: { text: string; emoji: string }
        daily_chance_of_rain: number
        pressure_mb: number
      }
    }>
  }
}

function formatDate(dateStr: string) {
  try {
    const formatted = format(new Date(dateStr), 'EEEE d MMMM', { locale: fr })
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  } catch {
    return dateStr
  }
}

function makeForecastForCity(cityIndex: number, cityName: string, lat: number, lon: number): CityForecast {
  const today = new Date()
  const basePressure = 1010 + cityIndex * 2

  const forecastday = Array.from({ length: 10 }).map((_, i) => {
    const base = 10 + cityIndex * 2
    const maxtemp_c = Math.round(base + 8 + (i % 5))
    const mintemp_c = Math.round(base - 2 + ((i + cityIndex) % 3))
    const chance = (i * 7 + cityIndex * 3) % 100
    const cond = [
      ['Ensoleillé', '☀️'],
      ['Partiellement nuageux', '⛅'],
      ['Pluvieux', '🌧️']
    ][i % 3]
    const date = addDays(today, i)
    const dateStr = date.toISOString().slice(0, 10)

    const pressure_mb = basePressure + (i % 5) - Math.floor(cityIndex / 2)

    return {
      date: dateStr,
      day: {
        maxtemp_c,
        mintemp_c,
        condition: { text: cond[0], emoji: cond[1] },
        daily_chance_of_rain: chance,
        pressure_mb
      }
    }
  })

  const currentPressure = basePressure + 1
  const current = {
    temp_c: forecastday[0].day.maxtemp_c - 2,
    temp_f: Math.round((forecastday[0].day.maxtemp_c - 2) * 9 / 5 + 32),
    condition_text: forecastday[0].day.condition.text,
    humidity: 60,
    wind_kph: 15 + cityIndex * 3,
    emoji: forecastday[0].day.condition.emoji,
    pressure_mb: currentPressure
  }

  return {
    location: { name: cityName, region: '', country: 'France', lat, lon },
    current,
    forecast: { forecastday }
  }
}

// Coordonnées approximatives (Loire-Atlantique / Bretagne)
const CITY_INFO: Array<{ name: string; lat: number; lon: number }> = [
  { name: 'Nantes', lat: 47.218371, lon: -1.553621 },
  { name: 'Mesquer', lat: 47.3333, lon: -2.4167 },
  { name: 'Savenay', lat: 47.3386, lon: -1.7474 },
  { name: 'Ancenis', lat: 47.3658, lon: -1.1616 },
  { name: 'Rennes', lat: 48.1173, lon: -1.6778 }
]

// Simple icône de repère (pin) utilisé à côté du nom
function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className={className} aria-hidden>
      <path fill="currentColor" d="M12 2a6 6 0 00-6 6c0 4.5 6 12 6 12s6-7.5 6-12a6 6 0 00-6-6zm0 8.5A2.5 2.5 0 1112 5a2.5 2.5 0 010 5.5z"/>
    </svg>
  )
}

export default function WeatherGrid() {
  const dataList: CityForecast[] = CITY_INFO.map((c, idx) => makeForecastForCity(idx, c.name, c.lat, c.lon))

  return (
    <section>
      <h2>Prévisions (données en dur)</h2>
      <div className="multi-grid-vertical">
        {dataList.map((data) => (
          <article className="multi-item-vertical" key={data.location.name}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <PinIcon />
                  </span>
                  <span>{data.location.name}{data.location.region ? `, ${data.location.region}` : ''} — {data.location.country}</span>
                </h3>
                <div style={{ color: 'var(--muted)', fontSize: 14 }}>
                  Situation actuelle: {data.current.condition_text}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                  Pression actuelle: {data.current.pressure_mb} mb
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 36 }}>{data.current.emoji}</div>
                <div className="temp">{data.current.temp_c}°C</div>
              </div>
            </header>

            <div className="city-row">
              <div className="forecast" style={{ flex: 1 }}>
                <h4 style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>10 jours</h4>
                <div className="forecast-list-horizontal">
                  {data.forecast.forecastday.map((day) => (
                    <div className="forecast-item-horizontal" key={day.date}>
                      <div className="date">{formatDate(day.date)}</div>
                      <div style={{ fontSize: 20 }}>{day.day.condition.emoji}</div>
                      <div style={{ fontWeight: 600 }}>{day.day.condition.text}</div>
                      <div>Max: {day.day.maxtemp_c}°C</div>
                      <div>Min: {day.day.mintemp_c}°C</div>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>Pluie: {day.day.daily_chance_of_rain}%</div>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>Pression: {day.day.pressure_mb} mb</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="map-column" aria-hidden={false}>
                {/* Google Maps embed via maps.google.com query (pas de clé requise pour cet embed simple) */}
                <iframe
                  title={`Carte ${data.location.name}`}
                  className="map-embed"
                  src={`https://maps.google.com/maps?q=${data.location.lat},${data.location.lon}&z=12&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}