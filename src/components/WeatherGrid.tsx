import React, { useEffect, useMemo, useState } from 'react'
import { format, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'

type Condition = { text: string; emoji?: string; icon?: string }

type HourEntry = {
  time: string // "YYYY-MM-DD HH:MM"
  temp_c: number
  condition: Condition
  chance_of_rain?: number
}

type ForecastDay = {
  date: string // "YYYY-MM-DD"
  day: {
    maxtemp_c: number
    mintemp_c: number
    condition: Condition
    daily_chance_of_rain: number
    pressure_mb: number
  }
  hour: HourEntry[]
}

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
    // optional location for icon coming from API normalization
    condition_icon?: string
  }
  forecast: {
    forecastday: ForecastDay[]
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

function computeDayMinMaxFromHours(hour: HourEntry[]) {
  const temps = hour.map(h => Number(h.temp_c))
  const maxtemp_c = Math.max(...temps)
  const mintemp_c = Math.min(...temps)
  return { maxtemp_c, mintemp_c }
}

/* ---------- Synthetic generator (fallback) ---------- */
function generateHoursForDay(cityIndex: number, i: number, dateStr: string): HourEntry[] {
  const base = 10 + cityIndex * 2
  const chance = (i * 7 + cityIndex * 3) % 100
  return Array.from({ length: 24 }).map((__, h) => {
    const dailyMean = base + (i % 5) + 6
    const amplitude = 4 + (cityIndex % 3)
    const phase = Math.sin(((h - 14) / 24) * Math.PI * 2)
    const hourTemp = Math.round(dailyMean + phase * amplitude + ((i + cityIndex) % 2))
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
}

/* ---------- Fetch & normalize /api/weather (WeatherAPI backend) ---------- */
/**
 * Calls server endpoint /api/weather?q=<lat,lon>&days=<n>
 * and returns a normalized object { current?, forecastday[] } compatible with our types.
 * If the request fails, throws.
 */
async function fetchWeatherApiFromServer(q: string, days = 10) {
  const params = new URLSearchParams({
    q,
    days: String(days)
  })
  const url = `/api/weather?${params.toString()}`

  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Server /api/weather failed (${res.status}): ${text || res.statusText}`)
  }
  const json = await res.json()

  // Normalize: WeatherAPI returns .current and .forecast.forecastday[].hour
  const normalized: {
    current?: any
    forecastday?: any[]
  } = {}

  if (json.current) normalized.current = json.current
  if (json.forecast && Array.isArray(json.forecast.forecastday)) normalized.forecastday = json.forecast.forecastday
  else if (Array.isArray(json.forecastday)) normalized.forecastday = json.forecastday
  else normalized.forecastday = []

  return normalized
}

/* ---------- Helper for icon URLs ---------- */
/**
 * WeatherAPI returns protocol-relative URLs like "//cdn.weatherapi.com/..."
 * This helper returns a usable absolute URL or null if no icon provided.
 */
function resolveIconUrl(icon?: string | null) {
  if (!icon) return null
  if (typeof icon !== 'string') return null
  if (icon.startsWith('//')) return 'https:' + icon
  if (icon.startsWith('http://') || icon.startsWith('https://')) return icon
  return icon // fallback
}

/* ---------- makeForecastForCity (initial synthetic generator) ---------- */
function makeForecastForCity(cityIndex: number, cityName: string, lat: number, lon: number): CityForecast {
  const today = new Date()
  const basePressure = 1010 + cityIndex * 2

  // Initially generate synthetic forecast
  const forecastday: ForecastDay[] = Array.from({ length: 10 }).map((_, i) => {
    const date = addDays(today, i)
    const dateStr = date.toISOString().slice(0, 10)
    const hour = generateHoursForDay(cityIndex, i, dateStr)
    const { maxtemp_c, mintemp_c } = computeDayMinMaxFromHours(hour)
    const cond = [
      ['Ensoleillé', '☀️'],
      ['Partiellement nuageux', '⛅'],
      ['Pluvieux', '🌧️']
    ][i % 3]
    const chance = (i * 7 + cityIndex * 3) % 100
    const pressure_mb = basePressure + (i % 5) - Math.floor(cityIndex / 2)

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

  // Current aligned to now-hour from generated data
  const todayForecast = forecastday[0]
  const nowHour = new Date().getHours()
  const nowHourStr = String(nowHour).padStart(2, '0')
  const nowEntry = todayForecast.hour.find(h => h.time.slice(11, 13) === nowHourStr)
  const currentTemp = nowEntry ? nowEntry.temp_c : Math.round((todayForecast.day.maxtemp_c + todayForecast.day.mintemp_c) / 2)
  const currentCondition = nowEntry ? nowEntry.condition.text : todayForecast.day.condition.text
  const currentEmoji = nowEntry ? nowEntry.condition.emoji ?? todayForecast.day.condition.emoji : todayForecast.day.condition.emoji

  const currentPressure = basePressure + 1
  const current = {
    temp_c: currentTemp,
    temp_f: Math.round(currentTemp * 9 / 5 + 32),
    condition_text: currentCondition,
    humidity: 60,
    wind_kph: 15 + cityIndex * 3,
    emoji: currentEmoji,
    pressure_mb: currentPressure,
    condition_icon: undefined
  }

  return {
    location: { name: cityName, region: '', country: 'France', lat, lon },
    current,
    forecast: { forecastday }
  }
}

/* ---------- Cities ---------- */
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
      <path fill="currentColor" d="M12 2a6 6 0 00-6 6c0 4.5 6 12 6 12s6-7.5 6-12a6 6 0 00-6-6zm0 8.5A2.5 2.5 0 1112 5a2.5 2.5 0 010 5.5z" />
    </svg>
  )
}

/* ---------- Main component ---------- */
export default function WeatherGrid() {
  // initial synthetic data
  const initial = useMemo(() => CITY_INFO.map((c, idx) => makeForecastForCity(idx, c.name, c.lat, c.lon)), [])
  const [dataList, setDataList] = useState<CityForecast[]>(initial)
  const [selectedCityIndex, setSelectedCityIndex] = useState<number>(0)
  const [loadingCityIndex, setLoadingCityIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // When selected city changes, fetch weather from /api/weather?q=lat,lon&days=10 and merge
  useEffect(() => {
    let canceled = false

    async function fetchAndMergeForCity(idx: number) {
      setError(null)
      setLoadingCityIndex(idx)
      try {
        const city = CITY_INFO[idx]
        const q = `${city.lat},${city.lon}`
        const days = 10

        const normalized = await fetchWeatherApiFromServer(q, days)
        if (canceled) return

        setDataList(prev => {
          const copy = prev.slice()
          const curr = copy[idx]
          if (!curr) return prev

          // Build normalized ForecastDay[] from API forecastday if available
          const apiFds = normalized.forecastday ?? []
          const mergedForecastDays: ForecastDay[] = apiFds.map((ad: any, i: number) => {
            const dateStr = ad.date ?? addDays(new Date(), i).toISOString().slice(0, 10)

            // Use API hours if present, otherwise fall back to generated hours
            let hourEntries: HourEntry[] = []
            if (Array.isArray(ad.hour) && ad.hour.length > 0) {
              hourEntries = ad.hour.map((h: any) => {
                const time =
                  h.time ??
                  (h.time_epoch ? new Date(h.time_epoch * 1000).toISOString().replace('T', ' ').slice(0, 16) : `${dateStr} ${String(h.hour ?? '00').padStart(2, '0')}:00`)
                const temp_c = typeof h.temp_c !== 'undefined' ? Number(h.temp_c) : (typeof h.temp !== 'undefined' ? Number(h.temp) : 0)
                const condText = h.condition?.text ?? h.condition ?? ''
                const condIcon = h.condition?.icon ?? h.condition?.img ?? undefined
                const chance_of_rain = typeof h.chance_of_rain !== 'undefined' ? Number(h.chance_of_rain) : (typeof h.pop !== 'undefined' ? Number(h.pop) : undefined)
                return {
                  time,
                  temp_c,
                  condition: { text: condText, icon: condIcon },
                  chance_of_rain
                } as HourEntry
              })
            } else {
              // fallback
              hourEntries = generateHoursForDay(idx, i, dateStr)
            }

            // compute min/max from hours
            const { maxtemp_c, mintemp_c } = computeDayMinMaxFromHours(hourEntries)

            const dayObj = {
              maxtemp_c,
              mintemp_c,
              condition: {
                text: ad.day?.condition?.text ?? ad.day?.condition ?? hourEntries[Math.floor(hourEntries.length / 2)]?.condition?.text ?? '',
                // prefer day.condition.icon if present (WeatherAPI uses .day.condition.icon)
                icon: ad.day?.condition?.icon ?? ad.day?.condition?.img ?? undefined,
                emoji: undefined
              },
              daily_chance_of_rain: ad.day?.daily_chance_of_rain ?? ad.day?.chance_of_rain ?? 0,
              pressure_mb: typeof ad.day?.pressure_mb !== 'undefined' ? ad.day?.pressure_mb : curr.current.pressure_mb
            }

            return {
              date: dateStr,
              day: dayObj,
              hour: hourEntries
            } as ForecastDay
          })

          // If API returned fewer days than we expect, keep generated remaining days or trim to API length.
          const finalForecastDays = mergedForecastDays.length ? mergedForecastDays : curr.forecast.forecastday

          copy[idx] = {
            ...curr,
            forecast: { forecastday: finalForecastDays }
          }

          // Align current using API current if present
          if (normalized.current) {
            const apiCur = normalized.current
            const apiTemp = apiCur.temp_c ?? apiCur.temp ?? copy[idx].current.temp_c
            copy[idx].current = {
              ...copy[idx].current,
              temp_c: Number(apiTemp),
              temp_f: Math.round(Number(apiTemp) * 9 / 5 + 32),
              condition_text: apiCur.condition?.text ?? apiCur.condition ?? copy[idx].current.condition_text,
              humidity: apiCur.humidity ?? copy[idx].current.humidity,
              wind_kph: apiCur.wind_kph ?? apiCur.wind_kph ?? copy[idx].current.wind_kph,
              // store raw icon string (protocol-relative) in condition_icon so we can resolve later
              condition_icon: apiCur.condition?.icon ?? apiCur.condition?.img ?? copy[idx].current.condition_icon,
              emoji: apiCur.condition?.text ?? copy[idx].current.emoji,
              pressure_mb: apiCur.pressure_mb ?? copy[idx].current.pressure_mb
            }
          } else {
            // no API current — align current to merged hours for today
            const todayForecast = copy[idx].forecast.forecastday[0]
            const nowHour = new Date().getHours()
            const nowHourStr = String(nowHour).padStart(2, '0')
            const nowEntry = todayForecast.hour.find(h => h.time.slice(11, 13) === nowHourStr)
            const currentTemp = nowEntry ? nowEntry.temp_c : Math.round((todayForecast.day.maxtemp_c + todayForecast.day.mintemp_c) / 2)
            copy[idx].current = {
              ...copy[idx].current,
              temp_c: currentTemp,
              temp_f: Math.round(currentTemp * 9 / 5 + 32),
              condition_text: nowEntry ? nowEntry.condition.text : todayForecast.day.condition.text,
              emoji: nowEntry ? nowEntry.condition.emoji ?? nowEntry.condition.icon ?? todayForecast.day.condition.icon ?? todayForecast.day.condition.emoji : todayForecast.day.condition.emoji,
              condition_icon: nowEntry ? (nowEntry.condition.icon ?? undefined) : (todayForecast.day.condition.icon ?? undefined)
            }
          }

          return copy
        })
      } catch (err: any) {
        console.warn('Failed to fetch /api/weather', err)
        if (!canceled) setError(`Impossible de récupérer les données météo : ${err?.message ?? err}`)
      } finally {
        if (!canceled) setLoadingCityIndex(null)
      }
    }

    fetchAndMergeForCity(selectedCityIndex)

    return () => {
      canceled = true
    }
  }, [selectedCityIndex, setDataList])

  function onKeySelect(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSelectedCityIndex(idx)
    }
  }

  return (
    <section>
      <h2>Prévisions (données en dur + /api/weather quand disponible)</h2>

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
            {loadingCityIndex === idx && <span className="small muted" style={{ marginTop: 4 }}>Chargement…</span>}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <CityCard data={dataList[selectedCityIndex]} />
        {error && <div className="error" role="alert" style={{ marginTop: 8 }}>{error}</div>}
      </div>
    </section>
  )
}

/* ---------- City card (display logic) ---------- */
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

  // Affiche les min/max dérivées des heures (double sécurité)
  const computedDayMinMax = selectedDay ? computeDayMinMaxFromHours(selectedDay.hour) : null

  // resolve current icon (try explicit condition_icon, then fallback candidates)
  const possibleCurrentIcon =
    data.current.condition_icon ??
    // try to find today's middle hour icon if stored
    (data.forecast.forecastday?.[0]?.hour?.[Math.floor((data.forecast.forecastday?.[0]?.hour?.length ?? 24) / 2)]?.condition?.icon) ??
    undefined
  const currentIconUrl = resolveIconUrl(possibleCurrentIcon)

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
            {/* Use resolved icon URL when available, otherwise fallback to emoji/text */}
            {currentIconUrl ? (
              <img src={currentIconUrl} alt={data.current.condition_text} width={36} height={36} style={{ display: 'block' }} />
            ) : (
              <div className="trend-emoji" aria-hidden>{data.current.emoji}</div>
            )}
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

      <div className="forecast" style={{ marginTop: '0.75rem' }}>
        <h4 style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>10 jours (cliquez pour sélectionner)</h4>
        <div className="forecast-list-horizontal" role="list" aria-label={`Prévisions 10 jours ${data.location.name}`}>
          {forecastDays.map((day, idx) => {
            const dayIconUrl = resolveIconUrl(day.day.condition.icon)
            return (
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

                {dayIconUrl ? (
                  <img src={dayIconUrl} alt={day.day.condition.text} width={48} height={48} />
                ) : (
                  <div style={{ fontSize: 20 }}>{day.day.condition.emoji ?? day.day.condition.text?.[0]}</div>
                )}

                <div style={{ fontWeight: 600 }}>{day.day.condition.text}</div>

                {/* On affiche les min/max dérivés des heures pour garantir la cohérence */}
                <div>Max: {computeDayMinMaxFromHours(day.hour).maxtemp_c}°C</div>
                <div>Min: {computeDayMinMaxFromHours(day.hour).mintemp_c}°C</div>

                <div className="muted small">Pluie: {day.day.daily_chance_of_rain}%</div>
                <div className="muted small">Pression: {day.day.pressure_mb} mb</div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedDay && selectedDay.hour && (
        <div style={{ marginTop: 12 }}>
          <h4 style={{ marginTop: 8 }}>Prévisions horaires — {formatDate(selectedDay.date)}</h4>
          <div className="hour-list-horizontal" role="list" aria-label={`Heures ${data.location.name} ${selectedDay.date}`}>
            {selectedDay.hour.map((h) => {
              const iconUrl = resolveIconUrl(h.condition.icon)
              return (
                <div className="hour-item" key={h.time} role="listitem" tabIndex={0}>
                  <div className="hour-time">{h.time.slice(11)}</div>
                  {iconUrl ? (
                    <img src={iconUrl} alt={h.condition.text} width={40} height={40} />
                  ) : (
                    <div style={{ fontSize: 18 }}>{h.condition.emoji ?? h.condition.text?.[0]}</div>
                  )}
                  <div style={{ fontWeight: 700 }}>{h.temp_c}°C</div>
                  <div className="muted small">{h.condition.text}</div>
                  <div className="muted small">Pluie: {h.chance_of_rain ?? '-'}%</div>
                </div>
              )
            })}
          </div>

          {/* Affichage de vérification : min/max calculés à partir des heures */}
          {computedDayMinMax && (
            <div className="small muted" style={{ marginTop: 8 }}>
              Températures issues des heures : min {computedDayMinMax.mintemp_c}°C — max {computedDayMinMax.maxtemp_c}°C
            </div>
          )}
        </div>
      )}
    </article>
  )
}