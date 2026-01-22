import React, { useContext } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { LanguageContext, UnitContext } from "../App";

type HourEntry = {
  time: string;
  wind_kph?: number;
  wind_degree?: number;
  wind_dir?: string;
};

type WindDirectionChartProps = {
  hourlyData: HourEntry[];
  date: string;
  hoveredHourData?: HourEntry | null;
};

export default function WindDirectionChart({
  hourlyData,
  date,
  hoveredHourData,
}: WindDirectionChartProps) {
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

  // Convert wind direction degrees to compass directions (16 directions)
  const degreesToDirection = (degrees: number): string => {
    if (degrees === undefined || degrees === null) return "N";

    const directions = [
      "N",
      "NNE",
      "NE",
      "ENE",
      "E",
      "ESE",
      "SE",
      "SSE",
      "S",
      "SSW",
      "SW",
      "WSW",
      "W",
      "WNW",
      "NW",
      "NNW",
    ];
    const index = Math.round((degrees % 360) / 22.5) % 16;
    return directions[index];
  };

  const allDirections = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];

  // If a specific hour is hovered, show only that hour's wind direction
  let chartData;
  let chartTitle = t.windDirectionPolar;
  let chartDescription = t.windDirectionDescription;

  if (hoveredHourData) {
    // Show only the hovered hour's wind direction
    const hoveredDirection =
      hoveredHourData.wind_dir ||
      degreesToDirection(hoveredHourData.wind_degree || 0);
    const hoveredSpeed = convertWindSpeed(hoveredHourData.wind_kph || 0);
    const hoveredTime = hoveredHourData.time.slice(11, 16);

    chartData = allDirections.map((dir) => ({
      direction: dir,
      speed: dir === hoveredDirection ? hoveredSpeed : 0,
      fullName: getDirectionFullName(dir, t),
    }));

    chartTitle = `${t.windDirectionPolar} - ${hoveredTime}`;
    chartDescription = `${t.windDirection}: ${getDirectionFullName(hoveredDirection, t)} (${hoveredDirection}) - ${hoveredSpeed} ${windUnit}`;
  } else {
    // Group data by direction and calculate average wind speed
    const directionData: { [key: string]: { total: number; count: number } } =
      {};

    hourlyData.forEach((entry) => {
      const direction =
        entry.wind_dir || degreesToDirection(entry.wind_degree || 0);
      const speed = entry.wind_kph || 0;

      if (!directionData[direction]) {
        directionData[direction] = { total: 0, count: 0 };
      }
      directionData[direction].total += speed;
      directionData[direction].count += 1;
    });

    // Create chart data with all 16 directions
    chartData = allDirections.map((dir) => {
      const data = directionData[dir];
      const avgSpeedKph = data ? data.total / data.count : 0;
      const avgSpeed = convertWindSpeed(avgSpeedKph);
      return {
        direction: dir,
        speed: avgSpeed,
        fullName: getDirectionFullName(dir, t),
      };
    });
  }

  function getDirectionFullName(dir: string, t: any): string {
    const names: { [key: string]: string } = {
      N: t.north || "Nord",
      NNE: t.northNortheast || "Nord-Nord-Est",
      NE: t.northeast || "Nord-Est",
      ENE: t.eastNortheast || "Est-Nord-Est",
      E: t.east || "Est",
      ESE: t.eastSoutheast || "Est-Sud-Est",
      SE: t.southeast || "Sud-Est",
      SSE: t.southSoutheast || "Sud-Sud-Est",
      S: t.south || "Sud",
      SSW: t.southSouthwest || "Sud-Sud-Ouest",
      SW: t.southwest || "Sud-Ouest",
      WSW: t.westSouthwest || "Ouest-Sud-Ouest",
      W: t.west || "Ouest",
      WNW: t.westNorthwest || "Ouest-Nord-Ouest",
      NW: t.northwest || "Nord-Ouest",
      NNW: t.northNorthwest || "Nord-Nord-Ouest",
    };
    return names[dir] || dir;
  }

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
            {data.fullName} ({data.direction})
          </p>
          <p style={{ margin: "2px 0", color: "#8b5cf6" }}>
            {t.windSpeed}: {data.speed} {windUnit}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ flex: "33%", gap: "1rem" }}>
      <h4 style={{ marginBottom: "1rem" }}>{chartTitle}</h4>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={chartData}>
          <PolarGrid stroke="#e0e0e0" />
          <PolarAngleAxis
            dataKey="direction"
            tick={{ fontSize: 11, fontWeight: 600 }}
            stroke="#666"
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, "auto"]}
            tick={{ fontSize: 11 }}
            stroke="#666"
          />
          <Radar
            name={`${t.windSpeed} (${windUnit})`}
            dataKey="speed"
            stroke={hoveredHourData ? "#f59e0b" : "#8b5cf6"}
            fill={hoveredHourData ? "#f59e0b" : "#8b5cf6"}
            fillOpacity={0.5}
            strokeWidth={4}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
      <div
        style={{
          textAlign: "center",
          marginTop: "0.5rem",
          fontSize: "0.875rem",
          color: "var(--muted)",
        }}
      >
        {chartDescription}
      </div>
    </div>
  );
}
