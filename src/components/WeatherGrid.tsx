import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { format, addDays } from "date-fns";
import { fr as frLocale, enUS as enLocale } from "date-fns/locale";
import TemperatureChart from "./TemperatureChart";
import PressureChart from "./PressureChart";
import RainChanceChart from "./RainChanceChart";
import { ThemeContext, LanguageContext } from "../App";

type Condition = { text: string; emoji?: string; icon?: string };

type HourEntry = {
  time: string; // "YYYY-MM-DD HH:MM"
  temp_c: number; // integer (rounded)
  condition: Condition;
  chance_of_rain?: number;
  pressure_mb?: number;
};

type ForecastDay = {
  date: string; // "YYYY-MM-DD"
  day: {
    maxtemp_c: number;
    mintemp_c: number;
    condition: Condition;
    daily_chance_of_rain: number;
    pressure_mb: number;
    // keep raw api values if provided (optional)
    api_maxtemp_c?: number;
    api_mintemp_c?: number;
  };
  hour: HourEntry[];
};

type CityForecast = {
  location: {
    name: string;
    region?: string;
    country?: string;
    lat: number;
    lon: number;
  };
  current: {
    temp_c: number;
    temp_f: number;
    condition_text: string;
    humidity: number;
    wind_kph: number;
    emoji: string;
    pressure_mb: number;
    condition_icon?: string;
  };
  forecast: {
    forecastday: ForecastDay[];
  };
};

function formatDate(dateStr: string, locale: typeof frLocale | typeof enLocale) {
  try {
    const formatted = format(new Date(dateStr), "EEEE d MMMM", { locale });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return dateStr;
  }
}

function computeDayMinMaxFromHours(hour: HourEntry[]) {
  const temps = hour.map((h) => Number(h.temp_c));
  const maxtemp_c = Math.max(...temps);
  const mintemp_c = Math.min(...temps);
  return { maxtemp_c, mintemp_c };
}

/* ---------- Synthetic generator (fallback) ---------- */
function generateHoursForDay(
  cityIndex: number,
  i: number,
  dateStr: string,
): HourEntry[] {
  const base = 10 + cityIndex * 2;
  const chance = (i * 7 + cityIndex * 3) % 100;
  return Array.from({ length: 24 }).map((__, h) => {
    const dailyMean = base + (i % 5) + 6;
    const amplitude = 4 + (cityIndex % 3);
    const phase = Math.sin(((h - 14) / 24) * Math.PI * 2);
    const hourTemp = Math.round(
      dailyMean + phase * amplitude + ((i + cityIndex) % 2),
    );
    const time = `${dateStr} ${String(h).padStart(2, "0")}:00`;
    const condIdx = (h + i + cityIndex) % 3;
    const condForHour = [
      { text: "Ensoleillé", emoji: "☀️" },
      { text: "Nuageux", emoji: "⛅" },
      { text: "Pluie légère", emoji: "🌧️" },
    ][condIdx];
    const basePressure = 1010 + cityIndex * 2;
    const pressureVariation = Math.sin(((h - 12) / 24) * Math.PI * 2) * 3;
    const pressure_mb = Math.round(basePressure + pressureVariation + (i % 3));
    return {
      time,
      temp_c: Math.round(hourTemp),
      condition: { text: condForHour.text, emoji: condForHour.emoji },
      chance_of_rain: Math.max(0, (chance + (h % 5) * 4) % 100),
      pressure_mb,
    };
  });
}

/* ---------- Fetch & normalize /api/weather (WeatherAPI backend) ---------- */
async function fetchWeatherApiFromServer(q: string, days = 10, lang = 'en') {
  const params = new URLSearchParams({
    q,
    days: String(days),
    lang,
  });
  const url = `/api/weather?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Server /api/weather failed (${res.status}): ${text || res.statusText}`,
    );
  }
  const json = await res.json();

  const normalized: {
    current?: any;
    forecastday?: any[];
  } = {};

  if (json.current) normalized.current = json.current;
  if (json.forecast && Array.isArray(json.forecast.forecastday))
    normalized.forecastday = json.forecast.forecastday;
  else if (Array.isArray(json.forecastday))
    normalized.forecastday = json.forecastday;
  else normalized.forecastday = [];

  return normalized;
}

/* ---------- Helper for icon URLs ---------- */
function resolveIconUrl(icon?: string | null) {
  if (!icon) return null;
  if (typeof icon !== "string") return null;
  if (icon.startsWith("//")) return "https:" + icon;
  if (icon.startsWith("http://") || icon.startsWith("https://")) return icon;
  return icon;
}

/* ---------- makeForecastForCity (initial synthetic generator) ---------- */
function makeForecastForCity(
  cityIndex: number,
  cityName: string,
  lat: number,
  lon: number,
): CityForecast {
  const today = new Date();
  const basePressure = 1010 + cityIndex * 2;

  const forecastday: ForecastDay[] = Array.from({ length: 10 }).map((_, i) => {
    const date = addDays(today, i);
    const dateStr = date.toISOString().slice(0, 10);
    const hour = generateHoursForDay(cityIndex, i, dateStr);
    const { maxtemp_c, mintemp_c } = computeDayMinMaxFromHours(hour);
    const cond = [
      ["Ensoleillé", "☀️"],
      ["Partiellement nuageux", "⛅"],
      ["Pluvieux", "🌧️"],
    ][i % 3];
    const chance = (i * 7 + cityIndex * 3) % 100;
    const pressure_mb = basePressure + (i % 5) - Math.floor(cityIndex / 2);

    return {
      date: dateStr,
      day: {
        maxtemp_c,
        mintemp_c,
        condition: { text: cond[0], emoji: cond[1] },
        daily_chance_of_rain: chance,
        pressure_mb,
      },
      hour,
    };
  });

  const todayForecast = forecastday[0];
  const nowHour = new Date().getHours();
  const nowHourStr = String(nowHour).padStart(2, "0");
  const nowEntry = todayForecast.hour.find(
    (h) => h.time.slice(11, 13) === nowHourStr,
  );
  const currentTemp = nowEntry
    ? Math.round(nowEntry.temp_c)
    : Math.round(
        (todayForecast.day.maxtemp_c + todayForecast.day.mintemp_c) / 2,
      );
  const currentCondition = nowEntry
    ? nowEntry.condition.text
    : todayForecast.day.condition.text;
  const currentEmoji = nowEntry
    ? (nowEntry.condition.emoji ?? todayForecast.day.condition.emoji)
    : todayForecast.day.condition.emoji;

  const currentPressure = basePressure + 1;
  const current = {
    temp_c: Math.round(currentTemp),
    temp_f: Math.round((currentTemp * 9) / 5 + 32),
    condition_text: currentCondition,
    humidity: 60,
    wind_kph: 15 + cityIndex * 3,
    emoji: currentEmoji,
    pressure_mb: currentPressure,
    condition_icon: undefined,
  };

  return {
    location: { name: cityName, region: "", country: "France", lat, lon },
    current,
    forecast: { forecastday },
  };
}

/* ---------- Cities ---------- */
const CITY_INFO: Array<{ name: string; lat: number; lon: number }> = [
  { name: "Nantes", lat: 47.218371, lon: -1.553621 },
  { name: "Mesquer", lat: 47.3333, lon: -2.4167 },
  { name: "Savenay", lat: 47.3386, lon: -1.7474 },
  { name: "Ancenis", lat: 47.3658, lon: -1.1616 },
  { name: "Rennes", lat: 48.1173, lon: -1.6778 },
];

function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      className={className}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M12 2a6 6 0 00-6 6c0 4.5 6 12 6 12s6-7.5 6-12a6 6 0 00-6-6zm0 8.5A2.5 2.5 0 1112 5a2.5 2.5 0 010 5.5z"
      />
    </svg>
  );
}

function LoaderIcon() {
  return (
    <svg
      width="1rem"
      height="1rem"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        animation: "spin 1s linear infinite",
      }}
    >
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

/* ---------- Main component ---------- */
export default function WeatherGrid() {
  const { lang, t } = useContext(LanguageContext);
  const locale = lang === 'fr' ? frLocale : enLocale;

  // initial synthetic data
  const initial = useMemo(
    () =>
      CITY_INFO.map((c, idx) => makeForecastForCity(idx, c.name, c.lat, c.lon)),
    [],
  );
  const [dataList, setDataList] = useState<CityForecast[]>(initial);
  const [selectedCityIndex, setSelectedCityIndex] = useState<number>(0);
  const [loadingCityIndex, setLoadingCityIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cityCardRef = useRef<{ goToNow: () => void }>(null);

  // When selected city changes, fetch weather from /api/weather?q=lat,lon&days=10 and merge
  useEffect(() => {
    let canceled = false;

    async function fetchAndMergeForCity(idx: number) {
      setError(null);
      setLoadingCityIndex(idx);
      try {
        const city = CITY_INFO[idx];
        const q = `${city.lat},${city.lon}`;
        const days = 10;

        const normalized = await fetchWeatherApiFromServer(q, days, lang);
        if (canceled) return;

        setDataList((prev) => {
          const copy = prev.slice();
          const curr = copy[idx];
          if (!curr) return prev;

          const apiFds = normalized.forecastday ?? [];
          const mergedForecastDays: ForecastDay[] = apiFds.map(
            (ad: any, i: number) => {
              const dateStr =
                ad.date ?? addDays(new Date(), i).toISOString().slice(0, 10);

              let hourEntries: HourEntry[] = [];
              if (Array.isArray(ad.hour) && ad.hour.length > 0) {
                hourEntries = ad.hour.map((h: any) => {
                  const time =
                    h.time ??
                    (h.time_epoch
                      ? new Date(h.time_epoch * 1000)
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 16)
                      : `${dateStr} ${String(h.hour ?? "00").padStart(2, "0")}:00`);
                  const temp_c =
                    typeof h.temp_c !== "undefined"
                      ? Math.round(Number(h.temp_c))
                      : typeof h.temp !== "undefined"
                        ? Math.round(Number(h.temp))
                        : 0;
                  const condText = h.condition?.text ?? h.condition ?? "";
                  const condIcon =
                    h.condition?.icon ?? h.condition?.img ?? undefined;
                  const chance_of_rain =
                    typeof h.chance_of_rain !== "undefined"
                      ? Math.round(Number(h.chance_of_rain))
                      : typeof h.pop !== "undefined"
                        ? Math.round(Number(h.pop))
                        : undefined;
                  const pressure_mb =
                    typeof h.pressure_mb !== "undefined"
                      ? Math.round(Number(h.pressure_mb))
                      : undefined;
                  return {
                    time,
                    temp_c,
                    condition: { text: condText, icon: condIcon },
                    chance_of_rain,
                    pressure_mb,
                  } as HourEntry;
                });
              } else {
                hourEntries = generateHoursForDay(idx, i, dateStr);
              }

              // compute min/max from hours (used as fallback)
              const computed = computeDayMinMaxFromHours(hourEntries);

              // Prefer API day values if provided (WeatherAPI uses maxtemp_c / mintemp_c)
              const api_maxtemp_c =
                typeof ad.day?.maxtemp_c !== "undefined"
                  ? Math.round(Number(ad.day.maxtemp_c))
                  : typeof ad.day?.max_temp_c !== "undefined"
                    ? Math.round(Number(ad.day.max_temp_c))
                    : undefined;
              const api_mintemp_c =
                typeof ad.day?.mintemp_c !== "undefined"
                  ? Math.round(Number(ad.day.mintemp_c))
                  : typeof ad.day?.min_temp_c !== "undefined"
                    ? Math.round(Number(ad.day.min_temp_c))
                    : undefined;

              const maxtemp_c =
                typeof api_maxtemp_c !== "undefined"
                  ? api_maxtemp_c
                  : computed.maxtemp_c;
              const mintemp_c =
                typeof api_mintemp_c !== "undefined"
                  ? api_mintemp_c
                  : computed.mintemp_c;

              const dayObj = {
                maxtemp_c,
                mintemp_c,
                condition: {
                  text:
                    ad.day?.condition?.text ??
                    ad.day?.condition ??
                    hourEntries[Math.floor(hourEntries.length / 2)]?.condition
                      ?.text ??
                    "",
                  icon:
                    ad.day?.condition?.icon ??
                    ad.day?.condition?.img ??
                    undefined,
                  emoji: undefined,
                },
                daily_chance_of_rain:
                  ad.day?.daily_chance_of_rain ?? ad.day?.chance_of_rain ?? 0,
                pressure_mb:
                  typeof ad.day?.pressure_mb !== "undefined"
                    ? ad.day?.pressure_mb
                    : curr.current.pressure_mb,
                api_maxtemp_c: api_maxtemp_c,
                api_mintemp_c: api_mintemp_c,
              };

              return {
                date: dateStr,
                day: dayObj,
                hour: hourEntries,
              } as ForecastDay;
            },
          );

          const finalForecastDays = mergedForecastDays.length
            ? mergedForecastDays
            : curr.forecast.forecastday;

          copy[idx] = {
            ...curr,
            forecast: { forecastday: finalForecastDays },
          };

          if (normalized.current) {
            const apiCur = normalized.current;
            const apiTemp =
              apiCur.temp_c ?? apiCur.temp ?? copy[idx].current.temp_c;
            const roundedApiTemp = Math.round(Number(apiTemp));
            copy[idx].current = {
              ...copy[idx].current,
              temp_c: roundedApiTemp,
              temp_f: Math.round((Number(roundedApiTemp) * 9) / 5 + 32),
              condition_text:
                apiCur.condition?.text ??
                apiCur.condition ??
                copy[idx].current.condition_text,
              humidity: apiCur.humidity ?? copy[idx].current.humidity,
              wind_kph:
                apiCur.wind_kph ??
                apiCur.wind_kph ??
                copy[idx].current.wind_kph,
              condition_icon:
                apiCur.condition?.icon ??
                apiCur.condition?.img ??
                copy[idx].current.condition_icon,
              emoji: apiCur.condition?.text ?? copy[idx].current.emoji,
              pressure_mb: apiCur.pressure_mb ?? copy[idx].current.pressure_mb,
            };
          } else {
            const todayForecast = copy[idx].forecast.forecastday[0];
            const nowHour = new Date().getHours();
            const nowHourStr = String(nowHour).padStart(2, "0");
            const nowEntry = todayForecast.hour.find(
              (h) => h.time.slice(11, 13) === nowHourStr,
            );
            const currentTemp = nowEntry
              ? Math.round(nowEntry.temp_c)
              : Math.round(
                  (todayForecast.day.maxtemp_c + todayForecast.day.mintemp_c) /
                    2,
                );
            copy[idx].current = {
              ...copy[idx].current,
              temp_c: currentTemp,
              temp_f: Math.round((currentTemp * 9) / 5 + 32),
              condition_text: nowEntry
                ? nowEntry.condition.text
                : todayForecast.day.condition.text,
              emoji: nowEntry
                ? (nowEntry.condition.emoji ??
                  nowEntry.condition.icon ??
                  todayForecast.day.condition.icon ??
                  todayForecast.day.condition.emoji)
                : todayForecast.day.condition.emoji,
              condition_icon: nowEntry
                ? (nowEntry.condition.icon ?? undefined)
                : (todayForecast.day.condition.icon ?? undefined),
            };
          }

          return copy;
        });
      } catch (err: any) {
        console.warn("Failed to fetch /api/weather", err);
        if (!canceled)
          setError(
            `Impossible de récupérer les données météo : ${err?.message ?? err}`,
          );
      } finally {
        if (!canceled) setLoadingCityIndex(null);
      }
    }

    fetchAndMergeForCity(selectedCityIndex);

    return () => {
      canceled = true;
    };
  }, [selectedCityIndex, setDataList, lang]);

  function onKeySelect(e: React.KeyboardEvent, idx: number) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelectedCityIndex(idx);
    }
  }

  return (
    <section>
      <h2>{t.forecastByCity}</h2>

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
        <div
          className="location-list"
          role="tablist"
          aria-label={t.chooseLocation}
          style={{ flex: 1 }}
        >
          {dataList.map((d, idx) => (
            <button
              key={d.location.name}
              role="tab"
              aria-selected={idx === selectedCityIndex}
              tabIndex={0}
              className={`location-button ${idx === selectedCityIndex ? "active" : ""}`}
              onClick={() => setSelectedCityIndex(idx)}
              onKeyDown={(e) => onKeySelect(e, idx)}
              title={`${t.showForecast} ${d.location.name}`}
            >
              <span className="loc-name">{d.location.name}</span>
              <span className="loc-country muted small">
                {d.location.country}
              </span>
            </button>
          ))}
          {loadingCityIndex !== null && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.25rem",
              }}
              aria-live="polite"
              aria-label={t.loadingInProgress}
            >
              <LoaderIcon />
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <button
            className="location-button"
            onClick={() => cityCardRef.current?.goToNow()}
            title={t.goToNow}
            style={{ padding: "0.75rem 1.5rem", whiteSpace: "nowrap" }}
          >
            {t.now}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <CityCard ref={cityCardRef} data={dataList[selectedCityIndex]} locale={locale} />
        {error && (
          <div className="error" role="alert" style={{ marginTop: 8 }}>
            {error}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- City card (display logic) ---------- */
const CityCard = React.forwardRef<
  { goToNow: () => void },
  { data: CityForecast; locale: typeof frLocale | typeof enLocale }
>(({ data, locale }, ref) => {
  const theme = useContext(ThemeContext);
  const { t } = useContext(LanguageContext);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [highlightCurrentHour, setHighlightCurrentHour] =
    useState<boolean>(false);
  const forecastDays = data.forecast.forecastday;
  const selectedDay = forecastDays[selectedDayIndex];
  const hourListRef = useRef<HTMLDivElement>(null);

  React.useImperativeHandle(ref, () => ({
    goToNow: () => {
      // Select today (index 0)
      setSelectedDayIndex(0);
      setHighlightCurrentHour(true);

      // After a short delay to allow the day selection to render, scroll to current hour
      setTimeout(() => {
        const now = new Date();
        const currentHour = String(now.getHours()).padStart(2, "0");
        const hourElement = hourListRef.current?.querySelector(
          `[data-hour="${currentHour}:00"]`,
        );
        if (hourElement) {
          hourElement.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center",
          });
        }
      }, 100);
    },
  }));

  function onKeySelect(e: React.KeyboardEvent, idx: number) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelectedDayIndex(idx);
      setHighlightCurrentHour(false); // Reset highlight when manually selecting a day
    }
  }

  const computedDayMinMax = selectedDay
    ? computeDayMinMaxFromHours(selectedDay.hour)
    : null;

  // Prefer to display min/max values coming from API if present (api_mintemp_c / api_maxtemp_c),
  // otherwise fall back to day.maxtemp_c/day.mintemp_c (which were computed or set).
  const displayedMax =
    selectedDay?.day?.api_maxtemp_c ?? selectedDay?.day?.maxtemp_c;
  const displayedMin =
    selectedDay?.day?.api_mintemp_c ?? selectedDay?.day?.mintemp_c;

  const possibleCurrentIcon =
    data.current.condition_icon ??
    data.forecast.forecastday?.[0]?.hour?.[
      Math.floor((data.forecast.forecastday?.[0]?.hour?.length ?? 24) / 2)
    ]?.condition?.icon ??
    undefined;
  const currentIconUrl = resolveIconUrl(possibleCurrentIcon);

  return (
    <article className="multi-item-vertical">
      <header className="city-header">
        <div className="city-header-left">
          <h3 className="city-title">
            <span className="pin-wrap">
              <PinIcon />
            </span>
            <span>
              {data.location.name}
              {data.location.region ? `, ${data.location.region}` : ""} —{" "}
              {data.location.country}
            </span>
          </h3>
          <div className="muted">
            {t.currentSituation}: {data.current.condition_text}
          </div>
          <div className="muted">
            {t.currentPressure}: {data.current.pressure_mb} mb
          </div>
        </div>

        <div className="city-header-right">
          <div className="trend-block">
            {currentIconUrl ? (
              <img
                src={currentIconUrl}
                alt={data.current.condition_text}
                width={36}
                height={36}
                style={{ display: "block" }}
              />
            ) : (
              <div className="trend-emoji" aria-hidden>
                {data.current.emoji}
              </div>
            )}
            <div className="temp">{Math.round(data.current.temp_c)}°C</div>
          </div>
        </div>
      </header>

      <div className="forecast" style={{ marginTop: "0.75rem" }}>
        <h4 style={{ marginTop: "0.75rem", marginBottom: "0.5rem" }}>
          {t.tenDays}
        </h4>
        <div
          className="forecast-list-horizontal"
          role="list"
          aria-label={`${t.tenDays} ${data.location.name}`}
        >
          {forecastDays.map((day, idx) => {
            const dayIconUrl = resolveIconUrl(day.day.condition.icon);
            // For day summary display prefer API values if present (api_maxtemp_c/api_mintemp_c) else day.maxtemp_c/day.mintemp_c
            const dayDisplayedMax = day.day.api_maxtemp_c ?? day.day.maxtemp_c;
            const dayDisplayedMin = day.day.api_mintemp_c ?? day.day.mintemp_c;

            return (
              <div
                key={day.date}
                role="button"
                tabIndex={0}
                aria-pressed={idx === selectedDayIndex}
                onClick={() => setSelectedDayIndex(idx)}
                onKeyDown={(e) => onKeySelect(e, idx)}
                className={`forecast-item-horizontal ${idx === selectedDayIndex ? "active" : ""}`}
                style={{ cursor: "pointer", userSelect: "none" }}
              >
                <div className="date">{formatDate(day.date, locale)}</div>

                {dayIconUrl ? (
                  <img
                    src={dayIconUrl}
                    alt={day.day.condition.text}
                    width={48}
                    height={48}
                  />
                ) : (
                  <div style={{ fontSize: 20 }}>
                    {day.day.condition.emoji ?? day.day.condition.text?.[0]}
                  </div>
                )}

                <div style={{ fontWeight: 600 }}>{day.day.condition.text}</div>

                <div>{t.maxTemp}: {Math.round(dayDisplayedMax ?? 0)}°C</div>
                <div>{t.minTemp}: {Math.round(dayDisplayedMin ?? 0)}°C</div>

                <div className="muted small">
                  {t.rain}: {day.day.daily_chance_of_rain}%
                </div>
                <div className="muted small">
                  {t.pressure}: {day.day.pressure_mb} mb
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay && selectedDay.hour && (
        <div style={{ marginTop: 12 }}>
          <h4 style={{ marginTop: 8 }}>
            {t.hourlyForecastFor} {formatDate(selectedDay.date, locale)}
          </h4>
          <div
            ref={hourListRef}
            className="hour-list-horizontal"
            role="list"
            aria-label={`${t.hoursFor} ${data.location.name} ${selectedDay.date}`}
          >
            {selectedDay.hour.map((h) => {
              const iconUrl = resolveIconUrl(h.condition.icon);
              const hourTime = h.time.slice(11, 16); // Extract HH:MM

              // Check if this is the current hour and we should highlight it
              const now = new Date();
              const currentHour = `${String(now.getHours()).padStart(2, "0")}:00`;
              const isCurrentHour =
                highlightCurrentHour &&
                selectedDayIndex === 0 &&
                hourTime === currentHour;

              return (
                <div
                  className="hour-item"
                  key={h.time}
                  role="listitem"
                  tabIndex={0}
                  data-hour={hourTime}
                  style={
                    isCurrentHour
                      ? {
                          backgroundColor: "var(--accent)",
                          color: "#ffffff",
                          border: "2px solid var(--selection-border)",
                        }
                      : undefined
                  }
                >
                  <div
                    className="hour-time"
                    style={isCurrentHour ? { color: "#ffffff" } : undefined}
                  >
                    {hourTime}
                  </div>
                  {iconUrl ? (
                    <img
                      src={iconUrl}
                      alt={h.condition.text}
                      width={40}
                      height={40}
                    />
                  ) : (
                    <div style={{ fontSize: 18 }}>
                      {h.condition.emoji ?? h.condition.text?.[0]}
                    </div>
                  )}
                  <div
                    style={{
                      fontWeight: 700,
                      ...(isCurrentHour && { color: "#ffffff" }),
                    }}
                  >
                    {Math.round(h.temp_c)}°C
                  </div>
                  <div
                    className="muted small"
                    style={isCurrentHour ? { color: "#ffffff" } : undefined}
                  >
                    {h.condition.text}
                  </div>
                  <div
                    className="muted small"
                    style={isCurrentHour ? { color: "#ffffff" } : undefined}
                  >
                    {t.rain}: {h.chance_of_rain ?? "-"}%
                  </div>
                </div>
              );
            })}
          </div>

          {computedDayMinMax && (
            <div className="small muted" style={{ marginTop: 8 }}>
              {t.computedFromHours}{" "}
              {Math.round(computedDayMinMax.mintemp_c)}°C — {t.maxTemp}{" "}
              {Math.round(computedDayMinMax.maxtemp_c)}°C
            </div>
          )}

          {selectedDay?.day?.api_mintemp_c !== undefined ||
          selectedDay?.day?.api_maxtemp_c !== undefined ? (
            <div className="small muted" style={{ marginTop: 6 }}>
              {t.apiValues} {selectedDay.day.api_mintemp_c ?? "—"}°C — {t.maxTemp}{" "}
              {selectedDay.day.api_maxtemp_c ?? "—"}°C
            </div>
          ) : null}

          <TemperatureChart
            hourlyData={selectedDay.hour}
            date={selectedDay.date}
          />
          <RainChanceChart
            hourlyData={selectedDay.hour}
            date={selectedDay.date}
          />
          <PressureChart
            hourlyData={selectedDay.hour}
            date={selectedDay.date}
            dayPressure={selectedDay.day.pressure_mb}
          />

          <div
            style={{ marginTop: "1.5rem", width: "100%", aspectRatio: "3 / 1" }}
          >
            <iframe
              title={`${t.map} ${data.location.name}`}
              src={`https://maps.google.com/maps?q=${data.location.lat},${data.location.lon}&z=12&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              style={{
                width: "100%",
                height: "100%",
                border: "0",
                borderRadius: "8px",
                filter:
                  theme === "dark"
                    ? "invert(90%) hue-rotate(180deg) saturate(0) brightness(0.7) contrast(0.9)"
                    : "saturate(0) brightness(1.1)",
              }}
            />
          </div>
        </div>
      )}
    </article>
  );
});

CityCard.displayName = "CityCard";
