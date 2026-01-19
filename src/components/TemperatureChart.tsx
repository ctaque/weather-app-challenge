import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

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
  // Transform the data for Recharts
  const chartData = hourlyData.map((entry) => ({
    hour: entry.time.slice(11, 16), // Extract HH:MM from "YYYY-MM-DD HH:MM"
    temperature: Math.round(entry.temp_c),
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
          <p style={{ margin: "2px 0", color: "#2563eb" }}>
            Température: {data.temperature}°C
          </p>
          <p style={{ margin: "2px 0", fontSize: "12px", color: "#666" }}>
            {data.condition}
          </p>
          <p style={{ margin: "2px 0", fontSize: "12px", color: "#2563eb" }}>
            Pluie: {data.rain}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h4 style={{ marginBottom: "1rem" }}>
        Graphique des températures
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
            label={{ value: "Température (°C)", angle: -90, position: "insideLeft" }}
            tick={{ fontSize: 12 }}
            stroke="#666"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="temperature"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ fill: "#2563eb", r: 4 }}
            activeDot={{ r: 6 }}
            name="Température (°C)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
