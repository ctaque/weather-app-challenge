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
  time: string;
  temp_c: number;
  condition: {
    text: string;
    emoji?: string;
    icon?: string;
  };
  chance_of_rain?: number;
  pressure_mb?: number;
};

type PressureChartProps = {
  hourlyData: HourEntry[];
  date: string;
  dayPressure?: number;
};

export default function PressureChart({
  hourlyData,
  date,
  dayPressure,
}: PressureChartProps) {
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
          <p style={{ margin: "2px 0", color: "#2563eb" }}>
            Pression: {data.pressure} mb
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h4 style={{ marginBottom: "1rem" }}>
        Graphique de la pression atmosphérique
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
            label={{
              value: "Pression (mb)",
              angle: -90,
              position: "insideLeft",
            }}
            tick={{ fontSize: 12 }}
            stroke="#666"
            domain={["dataMin - 5", "dataMax + 5"]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="pressure"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ fill: "#2563eb", r: 4 }}
            activeDot={{ r: 6 }}
            name="Pression (mb)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
