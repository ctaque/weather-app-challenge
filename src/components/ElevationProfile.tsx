import React, { useContext, useState, useEffect } from "react";
import { ThemeContext } from "../App";

interface ElevationPoint {
  distance: number; // en mètres
  elevation: number; // en mètres
}

interface ElevationProfileProps {
  elevationData: ElevationPoint[];
  totalDistance: number;
  sidePanelOpen: boolean;
}

export default function ElevationProfile({
  elevationData,
  totalDistance,
  sidePanelOpen,
}: ElevationProfileProps) {
  const theme = useContext(ThemeContext);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Écouter les changements de taille de fenêtre
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Recalculer la largeur quand le SidePanel s'ouvre/ferme
  useEffect(() => {
    setWindowWidth(window.innerWidth);
  }, [sidePanelOpen]);

  if (!elevationData || elevationData.length === 0) {
    return null;
  }

  // Largeur du SidePanel: 320px de width + 1rem (16px) de left = 336px
  // Position left du graphique: 336px + 24px d'espacement = 360px
  // Largeur disponible: window.innerWidth - position left - marge droite
  const leftPosition = sidePanelOpen ? 400 : 16; // 1rem = 16px
  const rightMargin = 16; // 1rem de marge droite
  const containerPadding = 16; // 0.5rem de padding interne du conteneur
  const width = windowWidth - leftPosition - rightMargin - containerPadding * 2;
  const height = 150;
  const padding = { top: 10, right: 20, bottom: 30, left: 30 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Trouver les valeurs min et max d'élévation
  const elevations = elevationData.map((p) => p.elevation);
  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);
  const elevationRange = maxElevation - minElevation;

  // Créer les points pour le path SVG
  const points = elevationData.map((point, index) => {
    const x = (point.distance / totalDistance) * graphWidth;
    const y =
      graphHeight -
      ((point.elevation - minElevation) / elevationRange) * graphHeight;
    return { x, y, elevation: point.elevation };
  });

  // Créer le path string
  const pathData = points
    .map((point, index) => {
      if (index === 0) {
        return `M ${point.x},${point.y}`;
      }
      return `L ${point.x},${point.y}`;
    })
    .join(" ");

  // Créer le path pour le remplissage sous la courbe
  const fillPathData =
    pathData + ` L ${graphWidth},${graphHeight} L 0,${graphHeight} Z`;

  // Calculer les marques sur l'axe Y (élévation)
  const yAxisMarks = 4;
  const yAxisStep = elevationRange / yAxisMarks;

  // Calculer les marques sur l'axe X (distance)
  const xAxisMarks = 4;
  const xAxisStep = totalDistance / xAxisMarks;

  return (
    <div
      style={{
        borderRadius: "6px",
        backgroundColor: theme === "dark" ? "#111111" : "#f3f4f6",
        color: theme === "dark" ? "#fff" : "#222",
        position: "fixed",
        bottom: "1rem",
        left: `${leftPosition}px`,
        width: `${width}px`,
        padding: `${containerPadding}px`,
        transition: "left 0.3s ease-in-out, width 0.3s ease-in-out",
        boxSizing: "border-box",
      }}
    >
      <svg
        width={width}
        height={height}
        style={{ display: "block", margin: "0 auto" }}
      >
        {/* Grille horizontale */}
        {Array.from({ length: yAxisMarks + 1 }).map((_, i) => {
          const y = (i / yAxisMarks) * graphHeight;
          const elevation = Math.round(
            maxElevation - (i / yAxisMarks) * elevationRange,
          );

          return (
            <g key={`y-${i}`}>
              <line
                x1={padding.left}
                y1={padding.top + y}
                x2={padding.left + graphWidth}
                y2={padding.top + y}
                stroke={theme === "dark" ? "#444" : "#ddd"}
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              <text
                x={padding.left - 5}
                y={padding.top + y + 4}
                textAnchor="end"
                fontSize="10"
                fill={theme === "dark" ? "#aaa" : "#666"}
              >
                {elevation}m
              </text>
            </g>
          );
        })}

        {/* Axe X (distance) */}
        {Array.from({ length: xAxisMarks + 1 }).map((_, i) => {
          const x = (i / xAxisMarks) * graphWidth;
          const distance = (i / xAxisMarks) * totalDistance;

          return (
            <g key={`x-${i}`}>
              <line
                x1={padding.left + x}
                y1={padding.top}
                x2={padding.left + x}
                y2={padding.top + graphHeight}
                stroke={theme === "dark" ? "#444" : "#ddd"}
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              <text
                x={padding.left + x}
                y={padding.top + graphHeight + 15}
                textAnchor="middle"
                fontSize="10"
                fill={theme === "dark" ? "#aaa" : "#666"}
              >
                {(distance / 1000).toFixed(1)}km
              </text>
            </g>
          );
        })}

        {/* Groupe pour le graphique */}
        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {/* Remplissage sous la courbe */}
          <path
            d={fillPathData}
            fill={"var(--brand)"}
            fillOpacity=".5"
            stroke="none"
          />

          {/* Ligne de la courbe */}
          <path
            d={pathData}
            fill="none"
            stroke={"var(--brand)"}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>
      </svg>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          marginTop: "10px",
          gap: "1rem",
          fontSize: "12px",
          color: theme === "dark" ? "#aaa" : "#666",
        }}
      >
        <span>Min: {Math.round(minElevation)}m</span>
        <span>Max: {Math.round(maxElevation)}m</span>
      </div>
    </div>
  );
}
