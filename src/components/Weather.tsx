import React, { useState } from 'react'
import { format, parseISO } from 'date-fns'
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

function formatHour(timeStr: string) {
  try {
    // timeStr can be "2026-01-19 14:00" or ISO — try parseISO fallback
    const d = timeStr.includes(' ') ? parseISO(timeStr.replace(' ', 'T')) : parseISO(timeStr)
    return format(d, 'HH:mm')
  } catch {
    return timeStr.slice(-5)
  }
}

export default function WeatherDisplay({ data }: Props) {
  if (!data) return null

  const location = data.location
  const current = data.current
  const forecast = data.forecast

  // selected day index (0 = today). Allow user to switch days if forecast provided.
  const [dayIndex, setDayIndex] = useState<number>(0)

  const forecastDays = forecast?.forecastday ?? []

  const selectedDay = forecastDays[dayIndex]

  return (
    <div className="weather-card">
      <h2>
        {location.name}{location.region ? `, ${location.region}` : ''} — {location.country}
      </h2>

      <div className="current" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {current?.condition?.icon ? <img src={current.condition.icon} alt={current.condition.text} /> : null}
          <div>
            <div className="temp">{current.temp_c}°C / {current.temp_f}°F</div>
            <div>{current.condition.text}</div>
            <div>Humidité: {current.humidity}%</div>
            <div>Vent: {current.wind_kph} kph</div>
            {typeof current.pressure_mb !== 'undefined' ? (
              <div>Pression: {current.pressure_mb} mb</div>
            ) : null}
          </div>
        </div>
      </div>

      {forecastDays.length > 0 && (
        <div className="forecast" style={{ marginTop: '0.75rem' }}>
          <h3 style={{ marginTop: 0 }}>Prévision</h3>

          {/* Day selector (small) */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {forecastDays.map((d: any, idx: number) => (
              <button
                key={d.date}
                onClick={() => setDayIndex(idx)}
                className={`day-select ${idx === dayIndex ? 'active' : ''}`}
                aria-pressed={idx === dayIndex}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.06)',
                  background: idx === dayIndex ? 'var(--accent)' : 'var(--card)',
                  color: idx === dayIndex ? 'white' : 'var(--text)',
                  cursor: 'pointer'
                }}
              >
                {formatDate(d.date)}
              </button>
            ))}
          </div>

          {/* Days horizontal list (keeps previous UI) */}
          <div className="forecast-list-horizontal" role="list" aria-label="Prévision journalière">
            {forecastDays.map((day: any) => (
              <div className="forecast-item-horizontal" key={day.date} role="listitem">
                <div className="date">{formatDate(day.date)}</div>
                <div style={{ fontSize: 20 }}>{day.day.condition.emoji ?? day.day.condition.text?.[0]}</div>
                <div style={{ fontWeight: 600 }}>{day.day.condition.text}</div>
                <div>Max: {day.day.maxtemp_c}°C</div>
                <div>Min: {day.day.mintemp_c}°C</div>
                <div className="muted small">Pluie: {day.day.daily_chance_of_rain}%</div>
                <div className="muted small">Pression: {day.day.pressure_mb} mb</div>
              </div>
            ))}
          </div>

          {/* Hourly strip for the selected day */}
          {selectedDay && selectedDay.hour && (
            <div style={{ marginTop: 12 }}>
              <h4 style={{ marginBottom: 8 }}>Prévisions horaires — {formatDate(selectedDay.date)}</h4>
              <div className="hour-list-horizontal" role="list" aria-label="Prévisions horaires">
                {selectedDay.hour.map((h: any) => (
                  <div className="hour-item" key={h.time || h.time_epoch} role="listitem" aria-label={`Heure ${formatHour(h.time)}`}>
                    <div className="hour-time">{formatHour(h.time)}</div>
                    {h.condition?.icon ? (
                      <img src={h.condition.icon} alt={h.condition.text} width={40} height={40} />
                    ) : (
                      <div style={{ fontSize: 18 }}>{h.condition?.text?.[0] ?? '—'}</div>
                    )}
                    <div style={{ fontWeight: 700 }}>{Math.round(h.temp_c)}°</div>
                    <div className="muted small">{h.condition?.text}</div>
                    <div className="muted small">Pluie: {h.chance_of_rain ?? h.daily_chance_of_rain ?? '-' }%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}