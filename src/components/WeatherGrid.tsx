import React from 'react'
import { format, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'

type CityForecast = {
  location: { name: string; region?: string; country?: string }
  current: {
    temp_c: number
    temp_f: number
    condition_text: string
    humidity: number
    wind_kph: number
    emoji: string
  }
  forecast: {
    forecastday: Array<{
      date: string
      day: {
        maxtemp_c: number
        mintemp_c: number
        condition: { text: string; emoji: string }
        daily_chance_of_rain: number
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

// Génère des prévisions "en dur" (déterministes) pour 10 jours à partir d'aujourd'hui
function makeForecastForCity(cityIndex: number, cityName: string): CityForecast {
  const today = new Date()
  const forecastday = Array.from({ length: 10 }).map((_, i) => {
    // Valeurs déterministes (pas de random) basées sur index ville et jour
    const base = 10 + cityIndex * 2 // base de température selon la ville
    const maxtemp_c = Math.round(base + 8 + (i % 5))
    const mintemp_c = Math.round(base - 2 + ((i + cityIndex) % 3))
    const chance = (i * 7 + cityIndex * 3) % 100
    // Simple choix d'icone/texte suivant i % 3
    const cond = [ ['Ensoleillé', '☀️'], ['Partiellement nuageux', '⛅'], ['Pluvieux', '🌧️'] ][i % 3]
    const date = addDays(today, i)
    const dateStr = date.toISOString().slice(0, 10)
    return {
      date: dateStr,
      day: {
        maxtemp_c,
        mintemp_c,
        condition: { text: cond[0], emoji: cond[1] },
        daily_chance_of_rain: chance
      }
    }
  })

  const current = {
    temp_c: forecastday[0].day.maxtemp_c - 2,
    temp_f: Math.round((forecastday[0].day.maxtemp_c - 2) * 9 / 5 + 32),
    condition_text: forecastday[0].day.condition.text,
    humidity: 60,
    wind_kph: 15 + cityIndex * 3,
    emoji: forecastday[0].day.condition.emoji
  }

  return {
    location: { name: cityName, region: '', country: 'France' },
    current,
    forecast: { forecastday }
  }
}

const CITIES = ['Nantes', 'Mesquer', 'Savenay', 'Ancenis', 'Rennes']

export default function WeatherGrid() {
  const dataList: CityForecast[] = CITIES.map((c, idx) => makeForecastForCity(idx, c))

  return (
    <div>
      <h2>Prévisions (données en dur)</h2>
      <div className="multi-grid">
        {dataList.map((data) => (
          <div className="multi-item" key={data.location.name}>
            <h3>
              {data.location.name}
              {data.location.region ? `, ${data.location.region}` : ''} — {data.location.country}
            </h3>

            <div className="current">
              <div style={{ fontSize: 40 }}>{data.current.emoji}</div>
              <div>
                <div className="temp">{data.current.temp_c}°C / {data.current.temp_f}°F</div>
                <div>{data.current.condition_text}</div>
                <div>Humidité: {data.current.humidity}%</div>
                <div>Vent: {data.current.wind_kph} kph</div>
              </div>
            </div>

            <div className="forecast">
              <h4>10 jours</h4>
              <div className="forecast-list">
                {data.forecast.forecastday.map((day) => (
                  <div className="forecast-item" key={day.date}>
                    <div className="date">{formatDate(day.date)}</div>
                    <div style={{ fontSize: 22 }}>{day.day.condition.emoji}</div>
                    <div>{day.day.condition.text}</div>
                    <div>Max: {day.day.maxtemp_c}°C</div>
                    <div>Min: {day.day.mintemp_c}°C</div>
                    <div>Pluie: {day.day.daily_chance_of_rain}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}