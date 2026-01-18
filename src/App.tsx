import React, { useState } from 'react'
import WeatherDisplay from './components/Weather'

type WeatherData = any

export default function App() {
  const [query, setQuery] = useState('San Francisco')
  const [days, setDays] = useState(3)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<WeatherData | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function search(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch(`/api/weather?q=${encodeURIComponent(query)}&days=${days}`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>Weather App</h1>

      <form onSubmit={search} className="search-form">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="City name or 'lat,lon' (e.g. London or 51.5,-0.12)"
        />
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={1}>1 day</option>
          <option value={3}>3 days</option>
        </select>
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Search'}
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!navigator.geolocation) {
              setError('Geolocation not supported')
              return
            }
            setLoading(true)
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                setQuery(`${pos.coords.latitude},${pos.coords.longitude}`)
                setLoading(false)
                search()
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
    </div>
  )
}