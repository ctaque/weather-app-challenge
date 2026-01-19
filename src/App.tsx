import React, { useEffect, useState, createContext } from "react";
import WeatherDisplay from "./components/Weather";
import WeatherGrid from "./components/WeatherGrid";
import { getTranslations, type Language, type Translations } from "./i18n";

type WeatherData = any;

export type UnitSystem = "knots-celsius" | "mph-fahrenheit";

export const ThemeContext = createContext<"light" | "dark">("light");
export const LanguageContext = createContext<{
  lang: Language;
  t: Translations;
}>({
  lang: "fr",
  t: getTranslations("fr"),
});
export const UnitContext = createContext<{
  units: UnitSystem;
  setUnits: (units: UnitSystem) => void;
}>({
  units: "knots-celsius",
  setUnits: () => {},
});

function SunIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={props.className}
    >
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
  );
}

function MoonIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={props.className}
    >
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function LanguageIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={props.className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export default function App() {
  const [query, setQuery] = useState("Nantes");
  const [days, setDays] = useState(10);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Theme: 'light' | 'dark'
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Language: 'fr' | 'en'
  const [lang, setLang] = useState<Language>("fr");
  const t = getTranslations(lang);

  // Units: 'knots-celsius' | 'mph-fahrenheit'
  const [units, setUnits] = useState<UnitSystem>("knots-celsius");

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      const prefersDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial = prefersDark ? "dark" : "light";
      setTheme(initial);
      document.documentElement.setAttribute("data-theme", initial);
    }
  }, []);

  // Initialize language from localStorage or browser preference
  useEffect(() => {
    const saved = localStorage.getItem("language") as Language | null;
    if (saved === "fr" || saved === "en") {
      setLang(saved);
    } else {
      const browserLang = navigator.language.toLowerCase();
      const initial: Language = browserLang.startsWith("fr") ? "fr" : "en";
      setLang(initial);
    }
  }, []);

  // Keep document attribute and localStorage in sync when theme changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Keep localStorage in sync when language changes
  useEffect(() => {
    localStorage.setItem("language", lang);
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  // Initialize units from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("units") as UnitSystem | null;
    if (saved === "knots-celsius" || saved === "mph-fahrenheit") {
      setUnits(saved);
    }
  }, []);

  // Keep localStorage in sync when units change
  useEffect(() => {
    localStorage.setItem("units", units);
  }, [units]);

  function toggleTheme() {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }

  function toggleLanguage() {
    setLang((l) => (l === "fr" ? "en" : "fr"));
  }

  function toggleUnits() {
    setUnits((u) => (u === "knots-celsius" ? "mph-fahrenheit" : "knots-celsius"));
  }

  async function fetchWeather(qParam?: string, daysParam?: number) {
    const qToUse = qParam ?? query;
    const daysToUse = daysParam ?? days;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(
        `/api/weather?q=${encodeURIComponent(qToUse)}&days=${daysToUse}&lang=${lang}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }

  async function search(e?: React.FormEvent) {
    if (e) e.preventDefault();
    await fetchWeather();
  }

  return (
    <LanguageContext.Provider value={{ lang, t }}>
      <UnitContext.Provider value={{ units, setUnits }}>
        <ThemeContext.Provider value={theme}>
        <div className="welcome-wallpaper-background" data-theme={theme} />
        <div className="welcome-gradient-background" />
        <header className="app-header">
          <h1>{t.appTitle}</h1>
          <div>
            <button
              onClick={toggleLanguage}
              className="theme-toggle"
              title={t.languageAria}
              aria-label={t.languageAria}
            >
              <span className="theme-icon" aria-hidden>
                <LanguageIcon />
              </span>
              <span className="theme-label">{lang.toUpperCase()}</span>
            </button>
            <button
              aria-pressed={theme === "dark"}
              onClick={toggleTheme}
              className="theme-toggle"
              title={theme === "dark" ? t.themeDarkAria : t.themeLightAria}
              aria-label={theme === "dark" ? t.themeDarkAria : t.themeLightAria}
            >
              <span className="theme-icon" aria-hidden>
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              </span>
              <span className="theme-label">
                {theme === "dark" ? t.themeDark : t.themeLight}
              </span>
            </button>
            <button
              onClick={toggleUnits}
              className="theme-toggle"
              title={t.unitsAria}
              aria-label={t.unitsAria}
            >
              <span className="theme-label">
                {units === "knots-celsius" ? t.unitsKnotsCelsius : t.unitsMphFahrenheit}
              </span>
            </button>
          </div>
        </header>
        <div className="container">
          <h2 style={{ marginTop: 0 }}>{t.forecastByCity}</h2>
          <form onSubmit={search} className="search-form">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
            />
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={1}>1 {t.day}</option>
              <option value={3}>3 {t.days}</option>
              <option value={7}>7 {t.days}</option>
              <option value={10}>10 {t.days}</option>
            </select>
            <button type="submit" disabled={loading}>
              {loading ? t.loading : t.searchButton}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!navigator.geolocation) {
                  setError(t.geolocationNotSupported);
                  return;
                }
                setLoading(true);
                navigator.geolocation.getCurrentPosition(
                  async (pos) => {
                    const q = `${pos.coords.latitude},${pos.coords.longitude}`;
                    setQuery(q);
                    await fetchWeather(q);
                  },
                  (err) => {
                    setError(err.message);
                    setLoading(false);
                  },
                );
              }}
            >
              {t.useLocation}
            </button>
          </form>

          {error && (
            <div className="error">
              {t.errorPrefix}
              {error}
            </div>
          )}

          {data && <WeatherDisplay data={data} />}

          {/* Composant avec données en dur pour les 5 villes */}
          <WeatherGrid />
        </div>
      </ThemeContext.Provider>
      </UnitContext.Provider>
    </LanguageContext.Provider>
  );
}
