import React, { useState } from 'react'
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
      hour: Array<{
        time: string
        temp_c: number
        condition: { text: string; emoji?: string }
        chance_of_rain?: number
      }>
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

    // hourly: 24 entries for the day
    const hour = Array.from({ length: 24 }).map((__, h) => {
      const hourTemp = Math.round(((maxtemp_c + mintemp_c) / 2) + Math.sin((h / 24) * Math.PI * 2) * 3 + (cityIndex % 3))
      const time = `${dateStr} ${String(h).padStart(2, '0')}:00`
      const condIdx = (h + i + cityIndex) % 3
      const condForHour = [
        { text: 'Ensoleillé', emoji: '☀️' },
        { text: 'Nuageux', emoji: '⛅' },
        { text: 'Pluie légère', emoji: '🌧️' }
      ][condIdx]
      return {
        time,
        temp_c: hourTemp,
        condition: { text: condForHour.text, emoji: condForHour.emoji },
        chance_of_rain: Math.max(0, (chance + (h % 5) * 4) % 100)
      }
    })

    return {
      date: dateStr,
      day: {
        maxtemp_c,
        mintemp_c,
        condition: { text: cond[0], emoji: cond[1] },
        daily_chance_of_rain: chance,
        pressure_mb
      },
      hour
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

// Coordonnées / villes (exemple)
const CITY_INFO: Array<{ name: string; lat: number; lon: number }> = [
  { name: 'Nantes', lat: 47.218371, lon: -1.553621 },
  { name: 'Mesquer', lat: 47.3333, lon: -2.4167 },
  { name: 'Savenay', lat: 47.3386, lon: -1.7474 },
  { name: 'Ancenis', lat: 47.3658, lon: -1.1616 },
  { name: 'Rennes', lat: 48.1173, lon: -1.6778 }
]

function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className={className} aria-hidden>
      <path fill="currentColor" d="M12 2a6 6 0 00-6 6c0 4.5 6 12 6 12s6-7.5 6-12a6 6 0 00-6-6zm0 8.5A2.5 2.5 0 1112 5a2.5 2.5 0 010 5.5z"/>
    </svg>
  )
}

/*
  New behavior:
  - show a horizontal list of location buttons at the top (.location-list)
  - selecting a location shows only that city's card (with day forecast + hourly strip)
*/

export default function WeatherGrid() {
  const dataList: CityForecast[] = CITY_INFO.map((c, idx) => makeForecastForCity(idx, c.name, c.lat, c.lon))
  const [selectedCityIndex, setSelectedCityIndex] = useState<number>(0)

  function onKeySelect(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSelectedCityIndex(idx)
    }
  }

  return (
    <section>
      <h2>Prévisions (données en dur)</h2>

      {/* Location buttons */}
      <div className="location-list" role="tablist" aria-label="Choisir une localisation">
        {dataList.map((d, idx) => (
          <button
            key={d.location.name}
            role="tab"
            aria-selected={idx === selectedCityIndex}
            tabIndex={0}
            className={`location-button ${idx === selectedCityIndex ? 'active' : ''}`}
            onClick={() => setSelectedCityIndex(idx)}
            onKeyDown={(e) => onKeySelect(e, idx)}
            title={`Afficher les prévisions pour ${d.location.name}`}
          >
            <span className="loc-name">{d.location.name}</span>
            <span className="loc-country muted small">{d.location.country}</span>
          </button>
        ))}
      </div>

      {/* Single selected city card */}
      <div style={{ marginTop: 12 }}>
        <CityCard data={dataList[selectedCityIndex]} />
      </div>
    </section>
  )
}

/* Sub-component for the chosen city (same behavior as before) */
function CityCard({ data }: { data: CityForecast }) {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0)
  const forecastDays = data.forecast.forecastday
  const selectedDay = forecastDays[selectedDayIndex]

  function onKeySelect(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSelectedDayIndex(idx)
    }
  }

  return (
    <article className="multi-item-vertical">
      <header className="city-header">
        <div className="city-header-left">
          <h3 className="city-title">
            <span className="pin-wrap"><PinIcon /></span>
            <span>{data.location.name}{data.location.region ? `, ${data.location.region}` : ''} — {data.location.country}</span>
          </h3>
          <div className="muted">Situation actuelle: {data.current.condition_text}</div>
          <div className="muted">Pression actuelle: {data.current.pressure_mb} mb</div>
        </div>

        <div className="city-header-right">
          <div className="trend-block">
            <div className="trend-emoji" aria-hidden>{data.current.emoji}</div>
            <div className="temp">{data.current.temp_c}°C</div>
          </div>

          <div className="header-map">
            <iframe
              title={`Carte ${data.location.name}`}
              className="map-embed-small"
              src={`https://maps.google.com/maps?q=${data.location.lat},${data.location.lon}&z=12&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </header>

      {/* 10-day forecast (horizontal) - clicking selects the day */}
      <div className="forecast" style={{ marginTop: '0.75rem' }}>
        <h4 style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>10 jours (cliquez pour sélectionner)</h4>
        <div className="forecast-list-horizontal" role="list" aria-label={`Prévisions 10 jours ${data.location.name}`}>
          {forecastDays.map((day, idx) => (
            <div
              key={day.date}
              role="button"
              tabIndex={0}
              aria-pressed={idx === selectedDayIndex}
              onClick={() => setSelectedDayIndex(idx)}
              onKeyDown={(e) => onKeySelect(e, idx)}
              className={`forecast-item-horizontal ${idx === selectedDayIndex ? 'active' : ''}`}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <div className="date">{formatDate(day.date)}</div>
              <div style={{ fontSize: 20 }}>{day.day.condition.emoji}</div>
              <div style={{ fontWeight: 600 }}>{day.day.condition.text}</div>
              <div>Max: {day.day.maxtemp_c}°C</div>
              <div>Min: {day.day.mintemp_c}°C</div>
              <div className="muted small">Pluie: {day.day.daily_chance_of_rain}%</div>
              <div className="muted small">Pression: {day.day.pressure_mb} mb</div>
            </div>
          ))}
        </div>
      </div>

      {/* Hourly strip for selected day */}
      {selectedDay && selectedDay.hour && (
        <div style={{ marginTop: 12 }}>
          <h4 style={{ marginTop: 8 }}>Prévisions horaires — {formatDate(selectedDay.date)}</h4>
          <div className="hour-list-horizontal" role="list" aria-label={`Heures ${data.location.name} ${selectedDay.date}`}>
            {selectedDay.hour.map((h) => (
              <div className="hour-item" key={h.time} role="listitem" tabIndex={0}>
                <div className="hour-time">{h.time.slice(11)}</div>
                <div style={{ fontSize: 18 }}>{h.condition.emoji ?? h.condition.text?.[0]}</div>
                <div style={{ fontWeight: 700 }}>{h.temp_c}°C</div>
                <div className="muted small">{h.condition.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}