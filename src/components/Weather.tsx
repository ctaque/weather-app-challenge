import React from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

type Props = {
  data: any
}

function formatDate(dateStr: string) {
  try {
    const formatted = format(new Date(dateStr), 'EEEE d MMMM', { locale: fr })
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  } catch {
    return dateStr
  }
}

export default function WeatherDisplay({ data }: Props) {
  if (!data) return null

  const location = data.location
  const current = data.current
  const forecast = data.forecast

  return (
    <div className="weather-card">
      <h2>
        {location.name}, {location.region ? location.region + ', ' : ''}{location.country}
      </h2>

      <div className="current" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <img src={current.condition.icon} alt={current.condition.text} />
          <div>
            <div className="temp">{current.temp_c}°C / {current.temp_f}°F</div>
            <div>{current.condition.text}</div>
            <div>Humidité: {current.humidity}%</div>
            <div>Vent: {current.wind_kph} kph</div>
            {typeof current.pressure_mb !== 'undefined' ? (
              <div>Pression: {current.pressure_mb} mb ({current.pressure_in} in)</div>
            ) : null}
          </div>
        </div>
      </div>

      {forecast && forecast.forecastday && (
        <div className="forecast" style={{ marginTop: '0.75rem' }}>
          <h3 style={{ marginTop: 0 }}>Prévision</h3>

          {/* Liste horizontale scrollable : utilise les mêmes classes que WeatherGrid */}
          <div className="forecast-list-horizontal" role="list">
            {forecast.forecastday.map((day: any) => (
              <div className="forecast-item-horizontal" key={day.date} role="listitem" aria-label={`Prévision ${day.date}`}>
                <div className="date">{formatDate(day.date)}</div>
                {/* WeatherAPI fournit généralement day.condition.icon — si absent on garde emoji/text */}
                {day.day && day.day.condition && day.day.condition.icon ? (
                  <img src={day.day.condition.icon} alt={day.day.condition.text} style={{ width: 48, height: 48 }} />
                ) : (
                  <div style={{ fontSize: 22 }}>{day.day.condition && day.day.condition.text ? day.day.condition.text[0] : '—'}</div>
                )}
                <div style={{ fontWeight: 600 }}>{day.day.condition.text}</div>
                <div>Max: {day.day.maxtemp_c}°C</div>
                <div>Min: {day.day.mintemp_c}°C</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Pluie: {day.day.daily_chance_of_rain}%</div>
                {day.day && typeof day.day.pressure_mb !== 'undefined' ? (
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>Pression: {day.day.pressure_mb} mb</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}