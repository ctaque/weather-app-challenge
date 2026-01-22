import React, { useContext } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { LanguageContext, UnitContext } from "../App";
import ChartAnalysis from "./ChartAnalysis";

type HourEntry = {
  time: string;
  temp_c?: number;
  condition?: {
    text: string;
    icon?: string;
  };
  chance_of_rain?: number;
  pressure_mb?: number;
  wind_kph?: number;
  wind_mph?: number;
  wind_degree?: number;
  wind_dir?: string;
};

type DayData = {
  maxtemp_c: number;
  mintemp_c: number;
  condition: {
    text: string;
  };
  daily_chance_of_rain: number;
  pressure_mb: number;
};

type WindSpeedChartProps = {
  hourlyData: HourEntry[];
  date: string;
  onHoverHour?: (hourData: HourEntry | null) => void;
  location: string;
  day: DayData;
};

export default function WindSpeedChart({
  hourlyData,
  date,
  onHoverHour,
  location,
  day,
}: WindSpeedChartProps) {
  const { t } = useContext(LanguageContext);
  const { units } = useContext(UnitContext);

  // Convert km/h to knots or mph based on unit system
  const convertWindSpeed = (kph: number): number => {
    if (units === "knots-celsius") {
      return Math.round(kph / 1.852); // km/h to knots
    } else {
      return Math.round(kph / 1.60934); // km/h to mph
    }
  };

  const windUnit = units === "knots-celsius" ? t.knots : t.mph;

  // Get current date and time
  const now = new Date();
  const todayDateStr = now.toISOString().slice(0, 10);
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:00`;

  // Check if we're viewing today's forecast
  const isToday = date === todayDateStr;

  // Transform the data for Recharts
  const chartData = hourlyData.map((entry) => ({
    hour: entry.time.slice(11, 16),
    windSpeed: convertWindSpeed(entry.wind_kph ?? 0),
    windDir: entry.wind_dir ?? "",
  }));

  // Handle mouse move to update hovered hour
  const handleMouseMove = (state: any) => {
    if (state?.activeTooltipIndex !== undefined && onHoverHour) {
      const index = state.activeTooltipIndex;
      if (index >= 0 && index < hourlyData.length) {
        onHoverHour(hourlyData[index]);
      }
    }
  };

  // Handle mouse leave to reset hovered hour
  const handleMouseLeave = () => {
    if (onHoverHour) {
      onHoverHour(null);
    }
  };

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
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontWeight: 600 }}>{data.hour}</p>
          <p style={{ margin: "2px 0", color: "#10b981" }}>
            {t.windSpeed}: {data.windSpeed} {windUnit}
          </p>
          {data.windDir && (
            <p style={{ margin: "2px 0", fontSize: "12px", color: "#666" }}>
              {t.windDirection}: {data.windDir}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ marginTop: "1.5rem", flex: "66%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "top",
          marginBottom: "1rem",
        }}
      >
        <h4 style={{ margin: 0 }}>{t.windSpeed}</h4>
        <ChartAnalysis
          location={location}
          date={date}
          day={day}
          hour={hourlyData}
          chartType="wind"
          chartTitle={t.windSpeed}
        />
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 12 }}
            interval={2}
            stroke="#666"
          />
          <YAxis
            label={{
              value: `${t.windSpeed} (${windUnit})`,
              angle: -90,
              position: "insideLeft",
            }}
            tick={{ fontSize: 12 }}
            stroke="#666"
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
          <Line
            type="monotone"
            dataKey="windSpeed"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: "#10b981", r: 4 }}
            activeDot={{ r: 6 }}
            name={`${t.windSpeed} (${windUnit})`}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
