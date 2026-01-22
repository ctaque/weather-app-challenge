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
import { LanguageContext } from "../App";
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

type PressureChartProps = {
  hourlyData: HourEntry[];
  date: string;
  dayPressure?: number;
  location: string;
  day: DayData;
};

export default function PressureChart({
  hourlyData,
  date,
  dayPressure,
  location,
  day,
}: PressureChartProps) {
  const { t } = useContext(LanguageContext);

  // Get current date and time
  const now = new Date();
  const todayDateStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:00`;

  // Check if we're viewing today's forecast
  const isToday = date === todayDateStr;

  // Transform the data for Recharts
  const chartData = hourlyData.map((entry) => ({
    hour: entry.time.slice(11, 16),
    pressure: entry.pressure_mb ?? dayPressure ?? 1013,
  }));

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
          <p style={{ margin: "0 0 4px 0", fontWeight: 600 }}>
            {data.hour}
          </p>
          <p style={{ margin: "2px 0", color: "#10b981" }}>
            {t.pressure}: {data.pressure} mb
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h4 style={{ margin: 0 }}>
          {t.pressure}
        </h4>
        <ChartAnalysis
          location={location}
          date={date}
          day={day}
          hour={hourlyData}
          chartType="pressure"
          chartTitle={t.pressure}
        />
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
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
              value: `${t.pressure} (mb)`,
              angle: -90,
              position: "insideLeft",
            }}
            tick={{ fontSize: 12 }}
            stroke="#666"
            domain={["dataMin - 5", "dataMax + 5"]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {isToday && (
            <ReferenceLine
              x={currentTime}
              stroke="var(--accent)"
              strokeWidth={4}
              strokeDasharray="3 3"
              label={{ value: t.now, position: "top", fill: "var(--accent)", fontSize: 12 }}
              isFront={true}
            />
          )}
          <Line
            type="monotone"
            dataKey="pressure"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: "#10b981", r: 4 }}
            activeDot={{ r: 6 }}
            name={`${t.pressure} (mb)`}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
