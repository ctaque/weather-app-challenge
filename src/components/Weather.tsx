import React from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

type Props = {
  data: any
}

function formatDate(dateStr: string) {
  try {
    // dateStr comes from WeatherAPI as "YYYY-MM-DD"
    const formatted = format(new Date(dateStr), 'EEEE d MMMM', { locale: fr })
    // Capitalize first letter to match "Dimanche 18 janvier"
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  } catch {
    return dateStr
  }
}

export default function WeatherDisplay({ data }: Props) {
  const location = data.location
  const current = data.current
  const forecast = data.forecast

  return (
    <div className="weather-card">
      <h2>
        {location.name}, {location.region ? location.region + ', ' : ''}{location.country}
      </h2>

      <div className="current">
        <img src={current.condition.icon} alt={current.condition.text} />
        <div>
          <div className="temp">{current.temp_c}°C / {current.temp_f}°F</div>
          <div>{current.condition.text}</div>
          <div>Humidity: {current.humidity}%</div>
          <div>Wind: {current.wind_kph} kph</div>
        </div>
      </div>

      {forecast && forecast.forecastday && (
        <div className="forecast">
          <h3>Forecast</h3>
          <div className="forecast-list">
            {forecast.forecastday.map((day: any) => (
              <div className="forecast-item" key={day.date}>
                <div className="date">{formatDate(day.date)}</div>
                <img src={day.day.condition.icon} alt={day.day.condition.text} />
                <div>{day.day.condition.text}</div>
                <div>Max: {day.day.maxtemp_c}°C Min: {day.day.mintemp_c}°C</div>
                <div>Chance of rain: {day.day.daily_chance_of_rain}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}