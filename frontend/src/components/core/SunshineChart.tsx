import React, { useContext } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import { LanguageContext } from "../../App";
import ChartAnalysis from "./ChartAnalysis";

type HourEntry = {
  time: string;
  temp_c: number;
  condition: {
    text: string;
    emoji?: string;
    icon?: string;
  };
  chance_of_rain?: number;
  pressure_mb?: number;
  wind_kph?: number;
  wind_dir?: string;
  wind_degree?: number;
  uv?: number;
  is_day?: number;
};

type Astro = {
  sunrise?: string;
  sunset?: string;
  moonrise?: string;
  moonset?: string;
};

type DayData = {
  maxtemp_c: number;
  mintemp_c: number;
  condition: {
    text: string;
  };
  daily_chance_of_rain: number;
  pressure_mb: number;
  uv?: number;
};

type SunshineChartProps = {
  hourlyData: HourEntry[];
  date: string;
  location: string;
  day: DayData;
  astro?: Astro;
  latitude?: number;
};

// Calculate sun elevation angle for a given hour
function calculateSunElevation(
  hour: number,
  sunriseHour: number,
  sunsetHour: number,
  latitude: number,
): number {
  // If before sunrise or after sunset, sun is below horizon
  if (hour < sunriseHour || hour > sunsetHour) {
    return 0;
  }

  // Calculate solar noon (midpoint between sunrise and sunset)
  const solarNoon = (sunriseHour + sunsetHour) / 2;

  // Calculate day length
  const dayLength = sunsetHour - sunriseHour;

  // Maximum elevation depends on latitude and season
  // Simplified: at equator, max ~90°, at poles varies with season
  // For mid-latitudes, typical max is 50-70°
  const maxElevation = 90 - Math.abs(latitude);

  // Calculate elevation as a sinusoidal curve
  // Peak at solar noon, 0 at sunrise and sunset
  const hourFromNoon = hour - solarNoon;
  const normalizedTime = (Math.PI * hourFromNoon) / (dayLength / 2);
  const elevation = maxElevation * Math.cos(normalizedTime);

  return Math.max(0, elevation);
}

// Parse time string "HH:MM AM/PM" to decimal hour
function parseTimeToHour(timeStr: string): number {
  if (!timeStr) return 0;

  // Handle "HH:MM AM/PM" format
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 0;

  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3];

  if (period) {
    if (period.toUpperCase() === "PM" && hours !== 12) {
      hours += 12;
    } else if (period.toUpperCase() === "AM" && hours === 12) {
      hours = 0;
    }
  }

  return hours + minutes / 60;
}

export default function SunshineChart({
  hourlyData,
  date,
  location,
  day,
  astro,
  latitude = 47, // Default latitude (approximate France)
}: SunshineChartProps) {
  const { t } = useContext(LanguageContext);

  // Get current date and time
  const now = new Date();
  const todayDateStr = now.toISOString().slice(0, 10);
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:00`;

  // Check if we're viewing today's forecast
  const isToday = date === todayDateStr;

  // Parse sunrise and sunset times
  const sunriseHour = astro?.sunrise ? parseTimeToHour(astro.sunrise) : 7;
  const sunsetHour = astro?.sunset ? parseTimeToHour(astro.sunset) : 19;

  // Transform the data for Recharts
  const chartData = hourlyData.map((entry) => {
    const hour = parseInt(entry.time.slice(11, 13));
    const elevation = calculateSunElevation(
      hour,
      sunriseHour,
      sunsetHour,
      latitude,
    );

    return {
      hour: entry.time.slice(11, 16),
      elevation: Math.round(elevation * 10) / 10,
      isDay:
        entry.is_day ?? (hour >= sunriseHour && hour <= sunsetHour ? 1 : 0),
      hourDecimal: hour,
    };
  });

  // Find sunrise and sunset hours in the data
  const sunriseData = chartData.find(
    (d) => d.hourDecimal === Math.floor(sunriseHour),
  );
  const sunsetData = chartData.find(
    (d) => d.hourDecimal === Math.floor(sunsetHour),
  );

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      return (
        <div
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            flex: 1,
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontWeight: 600 }}>{data.hour}</p>
          <p style={{ margin: "2px 0", color: "#f59e0b", fontWeight: 600 }}>
            {t.sunElevation || "Élévation"}: {data.elevation}°
          </p>
          {data.isDay === 0 && (
            <p style={{ margin: "2px 0", fontSize: "11px", color: "#666" }}>
              🌙 {t.nightTime || "Nuit"}
            </p>
          )}
          {data.elevation === 0 && data.isDay === 1 && (
            <p style={{ margin: "2px 0", fontSize: "11px", color: "#666" }}>
              🌅 {t.horizon || "Horizon"}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ marginTop: "1.5rem", flex: 1 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h4 style={{ margin: 0 }}>
          ☀️ {t.sunTrajectory || "Trajectoire du soleil"}
        </h4>
        <ChartAnalysis
          location={location}
          date={date}
          day={day}
          hour={hourlyData}
          chartType="sunshine"
          chartTitle={t.sunTrajectory || "Trajectoire du soleil"}
          astro={astro}
        />
      </div>
      <div
        style={{
          marginBottom: "0.5rem",
          fontSize: "13px",
          color: "var(--muted)",
        }}
      >
        {t.sunTrajectoryDescription ||
          "La courbe représente l'élévation du soleil dans le ciel au cours de la journée"}
        {astro?.sunrise && astro?.sunset && (
          <span style={{ marginLeft: "0.5rem" }}>
            🌅 {astro.sunrise} • 🌇 {astro.sunset}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <defs>
            <linearGradient id="sunGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.9} />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#fb923c" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 12 }}
            interval={2}
            stroke="#666"
          />
          <YAxis
            label={{
              value: t.elevation || "Élévation (°)",
              angle: -90,
              position: "insideLeft",
            }}
            tick={{ fontSize: 12 }}
            stroke="#666"
            domain={[0, 90]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {isToday && (
            <ReferenceLine
              x={currentTime}
              stroke="var(--accent)"
              strokeWidth={4}
              strokeDasharray="3 3"
              label={{
                value: t.now,
                position: "top",
                fill: "var(--accent)",
                fontSize: 12,
              }}
              isFront={true}
            />
          )}
          {/* Horizon line */}
          <ReferenceLine
            y={0}
            stroke="#94a3b8"
            strokeWidth={2}
            label={{
              value: t.horizon || "Horizon",
              position: "right",
              fill: "#94a3b8",
              fontSize: 11,
            }}
          />
          {/* Sunrise marker */}
          {sunriseData && (
            <ReferenceLine
              x={sunriseData.hour}
              stroke="#fb923c"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
              label={{ value: "🌅", position: "top", fontSize: 16 }}
            />
          )}
          {/* Sunset marker */}
          {sunsetData && (
            <ReferenceLine
              x={sunsetData.hour}
              stroke="#f97316"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
              label={{ value: "🌇", position: "top", fontSize: 16 }}
            />
          )}
          <Area
            type="monotone"
            dataKey="elevation"
            stroke="#f59e0b"
            strokeWidth={3}
            fill="url(#sunGradient)"
            name={t.sunElevation || "Élévation du soleil (°)"}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div
        style={{
          marginTop: "0.75rem",
          fontSize: "12px",
          color: "var(--muted)",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "center",
        }}
      >
        <span>
          🌅 {t.sunrise || "Lever"}: {astro?.sunrise || "—"}
        </span>
        <span>
          🌇 {t.sunset || "Coucher"}: {astro?.sunset || "—"}
        </span>
        <span>
          ☀️ {t.dayLength || "Durée du jour"}:{" "}
          {astro?.sunrise && astro?.sunset
            ? `${Math.round((sunsetHour - sunriseHour) * 10) / 10}h`
            : "—"}
        </span>
      </div>
    </div>
  );
}
