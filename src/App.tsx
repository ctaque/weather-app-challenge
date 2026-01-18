import React, { useEffect, useState } from 'react'
import WeatherDisplay from './components/Weather'
import WeatherGrid from './components/WeatherGrid'

type WeatherData = any

function SunIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={props.className}>
      <circle cx="12" cy="12" r="4" />
      <g>
        <line x1="12" y1="2" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22" />
        <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
        <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
        <line x1="2" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="22" y2="12" />
        <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
        <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
      </g>
    </svg>
  )
}

function MoonIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={props.className}>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

export default function App() {
  const [query, setQuery] = useState('Nantes')
  const [days, setDays] = useState(10)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<WeatherData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Theme: 'light' | 'dark'
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved)
      document.documentElement.setAttribute('data-theme', saved)
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      const initial = prefersDark ? 'dark' : 'light'
      setTheme(initial)
      document.documentElement.setAttribute('data-theme', initial)
    }
  }, [])

  // Keep document attribute and localStorage in sync when theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }

  async function fetchWeather(qParam?: string, daysParam?: number) {
    const qToUse = qParam ?? query
    const daysToUse = daysParam ?? days

    setLoading(true)
    setError(null)
    setData(null)

    try {
      const res = await fetch(`/api/weather?q=${encodeURIComponent(qToUse)}&days=${daysToUse}`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }

  async function search(e?: React.FormEvent) {
    if (e) e.preventDefault()
    await fetchWeather()
  }

  return (
    <div className="container">
      <header className="app-header">
        <h1>Weather App</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            aria-pressed={theme === 'dark'}
            onClick={toggleTheme}
            className="theme-toggle"
            title={theme === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre'}
            aria-label={theme === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre'}
          >
            <span className="theme-icon" aria-hidden>
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </span>
            <span className="theme-label">{theme === 'dark' ? 'Jour' : 'Nuit'}</span>
          </button>
        </div>
      </header>

      <form onSubmit={search} className="search-form">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="City name or 'lat,lon' (e.g. London or 51.5,-0.12)"
        />
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={1}>1 day</option>
          <option value={3}>3 days</option>
          <option value={7}>7 days</option>
          <option value={10}>10 days</option>
        </select>
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Search'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!navigator.geolocation) {
              setError('Geolocation not supported')
              return
            }
            setLoading(true)
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                const q = `${pos.coords.latitude},${pos.coords.longitude}`
                setQuery(q)
                await fetchWeather(q)
              },
              (err) => {
                setError(err.message)
                setLoading(false)
              }
            )
          }}
        >
          Use my location
        </button>
      </form>

      {error && <div className="error">Error: {error}</div>}

      {data && <WeatherDisplay data={data} />}

      {/* Composant avec données en dur pour les 5 villes */}
      <WeatherGrid />
    </div>
  )
}