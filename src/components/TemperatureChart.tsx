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

type HourEntry = {
  time: string; // "YYYY-MM-DD HH:MM"
  temp_c: number;
  condition: {
    text: string;
    emoji?: string;
    icon?: string;
  };
  chance_of_rain?: number;
};

type TemperatureChartProps = {
  hourlyData: HourEntry[];
  date: string;
};

export default function TemperatureChart({
  hourlyData,
  date,
}: TemperatureChartProps) {
  const { t } = useContext(LanguageContext);
  const { units } = useContext(UnitContext);

  // Convert Celsius to Fahrenheit if needed
  const convertTemperature = (celsius: number): number => {
    if (units === "mph-fahrenheit") {
      return Math.round((celsius * 9) / 5 + 32);
    }
    return Math.round(celsius);
  };

  const tempUnit = units === "knots-celsius" ? t.degrees : t.fahrenheit;

  // Get current date and time
  const now = new Date();
  const todayDateStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:00`;

  // Check if we're viewing today's forecast
  const isToday = date === todayDateStr;

  // Transform the data for Recharts
  const chartData = hourlyData.map((entry) => ({
    hour: entry.time.slice(11, 16), // Extract HH:MM from "YYYY-MM-DD HH:MM"
    temperature: convertTemperature(entry.temp_c),
    condition: entry.condition.text,
    rain: entry.chance_of_rain ?? 0,
  }));

  // Custom tooltip to show more information
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
            {t.temperature}: {data.temperature}{tempUnit}
          </p>
          <p style={{ margin: "2px 0", fontSize: "12px", color: "#666" }}>
            {data.condition}
          </p>
          <p style={{ margin: "2px 0", fontSize: "12px", color: "#10b981" }}>
            {t.rain}: {data.rain}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h4 style={{ marginBottom: "1rem" }}>
        {t.temperature}
      </h4>
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
            label={{ value: `${t.temperature} (${tempUnit})`, angle: -90, position: "insideLeft" }}
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
              label={{ value: t.now, position: "top", fill: "var(--accent)", fontSize: 12 }}
              isFront={true}
            />
          )}
          <Line
            type="monotone"
            dataKey="temperature"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: "#10b981", r: 4 }}
            activeDot={{ r: 6 }}
            name={`${t.temperature} (${tempUnit})`}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
