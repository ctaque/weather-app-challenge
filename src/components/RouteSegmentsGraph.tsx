import React, { useContext } from "react";
import { ThemeContext } from "../App";

interface RouteSegment {
  type: string;
  distance: number;
  name: string;
}

interface RouteSegmentsGraphProps {
  segments: RouteSegment[];
  totalDistance: number;
}

// Couleurs et labels pour chaque type de surface/terrain
const SURFACE_TYPES: Record<string, { color: string; label: string }> = {
  autoroute: { color: "#ef4444", label: "Autoroute" },
  nationale: { color: "#f59e0b", label: "Route nationale" },
  departementale: { color: "#eab308", label: "Départementale" },
  urbain: { color: "#3b82f6", label: "Route urbaine" },
  paved: { color: "#6b7280", label: "Route goudronnée" },
  cyclable: { color: "#10b981", label: "Piste cyclable" },
  gravel: { color: "#92400e", label: "Gravier/Terre" },
  chemin: { color: "#78716c", label: "Chemin/Sentier" },
  service: { color: "#a3a3a3", label: "Voie de service" },
  ferry: { color: "#06b6d4", label: "Ferry" },
  autre: { color: "#9ca3af", label: "Autre" },
};

export default function RouteSegmentsGraph({
  segments,
  totalDistance,
}: RouteSegmentsGraphProps) {
  const theme = useContext(ThemeContext);

  // Regrouper les segments par type et calculer les totaux
  const typeStats = segments.reduce((acc, segment) => {
    if (!acc[segment.type]) {
      acc[segment.type] = 0;
    }
    acc[segment.type] += segment.distance;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div
      style={{
        marginTop: "15px",
        padding: "15px",
        borderRadius: "6px",
        backgroundColor: theme === "dark" ? "#2a2a2a" : "#f3f4f6",
        color: theme === "dark" ? "#fff" : "#333",
      }}
    >
      <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "600" }}>
        Types de terrain
      </h3>

      {/* Barre graphique */}
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "24px",
          borderRadius: "4px",
          overflow: "hidden",
          marginBottom: "10px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        {segments.map((segment, index) => {
          const widthPercent = (segment.distance / totalDistance) * 100;
          const surfaceConfig = SURFACE_TYPES[segment.type] || SURFACE_TYPES.autre;

          return (
            <div
              key={index}
              style={{
                width: `${widthPercent}%`,
                backgroundColor: surfaceConfig.color,
                transition: "opacity 0.2s",
              }}
              title={`${surfaceConfig.label}: ${segment.name} (${(segment.distance / 1000).toFixed(2)} km)`}
            />
          );
        })}
      </div>

      {/* Légende */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {Object.entries(typeStats)
          .sort((a, b) => b[1] - a[1])
          .map(([type, distance]) => {
            const surfaceConfig = SURFACE_TYPES[type] || SURFACE_TYPES.autre;
            const percent = ((distance / totalDistance) * 100).toFixed(1);

            return (
              <div
                key={type}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "2px",
                      backgroundColor: surfaceConfig.color,
                      flexShrink: 0,
                    }}
                  />
                  <span>{surfaceConfig.label}</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ color: theme === "dark" ? "#aaa" : "#666" }}>
                    {(distance / 1000).toFixed(1)} km
                  </span>
                  <span
                    style={{
                      color: theme === "dark" ? "#888" : "#999",
                      fontSize: "11px",
                    }}
                  >
                    ({percent}%)
                  </span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
