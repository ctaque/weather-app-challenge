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
    const d = timeStr.includes(' ') ? parseISO(timeStr.replace(' ', 'T')) : parseISO(timeStr)
    return format(d, 'HH:mm')
  } catch {
    return timeStr.slice(-5)
  }
}

export default function Weather({ data }: Props) {
  if (!data) return null

  const location = data.location
  const current = data.current
  const forecast = data.forecast
  const days = forecast?.forecastday ?? []

  // selected day index (click on a day card to select)
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0)
  const selectedDay = days[selectedDayIndex]

  function onKeySelect(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSelectedDayIndex(idx)
    }
  }

  return (
    <div className="weather-card">
      <h2>
        {location.name}{location.region ? `, ${location.region}` : ''} — {location.country}
      </h2>

      <div className="current" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {current?.condition?.icon ? (
            <img src={current.condition.icon} alt={current.condition.text} />
          ) : null}
          <div>
            <div className="temp">{current.temp_c}°C / {current.temp_f}°F</div>
            <div>{current.condition.text}</div>
            <div>Humidité: {current.humidity}%</div>
            <div>Vent: {current.wind_kph} kph</div>
            {typeof current.pressure_mb !== 'undefined' ? (
              <div>Pression: {current.pressure_mb} mb ({current.pressure_in ?? ''} in)</div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Forecast days — each card is clickable and selects the day */}
      {days.length > 0 && (
        <div className="forecast" style={{ marginTop: '0.75rem' }}>
          <h3 style={{ marginTop: 0 }}>Prévision (cliquez sur un jour pour voir les heures)</h3>

          <div
            className="forecast-list-horizontal"
            role="list"
            aria-label={`Prévision journalière pour ${location.name}`}
          >
            {days.map((day: any, idx: number) => (
              <div
                key={day.date}
                role="button"
                tabIndex={0}
                aria-pressed={idx === selectedDayIndex}
                onClick={() => setSelectedDayIndex(idx)}
                onKeyDown={(e) => onKeySelect(e as React.KeyboardEvent, idx)}
                className={`forecast-item-horizontal ${idx === selectedDayIndex ? 'active' : ''}`}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <div className="date">{formatDate(day.date)}</div>
                {day.day?.condition?.icon ? (
                  <img src={day.day.condition.icon} alt={day.day.condition.text} style={{ width: 48, height: 48 }} />
                ) : (
                  <div style={{ fontSize: 22 }}>{day.day.condition?.text?.[0] ?? '—'}</div>
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

          {/* Hourly strip for the selected day */}
          {selectedDay && selectedDay.hour && (
            <div style={{ marginTop: 12 }}>
              <h4 style={{ marginBottom: 8 }}>Prévisions horaires — {formatDate(selectedDay.date)}</h4>
              <div className="hour-list-horizontal" role="list" aria-label={`Prévisions horaires ${selectedDay.date}`}>
                {selectedDay.hour.map((h: any) => (
                  <div className="hour-item" key={h.time || h.time_epoch} role="listitem" tabIndex={0} aria-label={`Heure ${formatHour(h.time)}`}>
                    <div className="hour-time">{formatHour(h.time)}</div>
                    {h.condition?.icon ? (
                      <img src={h.condition.icon} alt={h.condition.text} width={40} height={40} />
                    ) : (
                      <div style={{ fontSize: 18 }}>{h.condition?.text?.[0] ?? '—'}</div>
                    )}
                    <div style={{ fontWeight: 700 }}>{Math.round(h.temp_c)}°</div>
                    <div className="muted small">{h.condition?.text}</div>
                    <div className="muted small">Pluie: {h.chance_of_rain ?? h.daily_chance_of_rain ?? '-'}%</div>
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