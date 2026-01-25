import React, { useContext, useState, useEffect } from "react";
import { ThemeContext } from "../../App";

interface ElevationPoint {
  distance: number; // en mètres
  elevation: number; // en mètres
}

interface ElevationProfileProps {
  elevationData: ElevationPoint[];
  totalDistance: number;
  sidePanelOpen: boolean;
  onHoverDistance?: (distance: number) => void;
  onLeave?: () => void;
  externalHoverDistance?: number;
}

export default function ElevationProfile({
  elevationData,
  totalDistance,
  sidePanelOpen,
  onHoverDistance,
  onLeave,
  externalHoverDistance,
}: ElevationProfileProps) {
  const theme = useContext(ThemeContext);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [hoverPosition, setHoverPosition] = useState<{
    x: number;
    distance: number;
  } | null>(null);

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
  const padding = { top: 10, right: 20, bottom: 15, left: 30 };
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

  // Gestionnaires d'événements pour le survol
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left - padding.left;

    if (x >= 0 && x <= graphWidth) {
      const distance = (x / graphWidth) * totalDistance;
      setHoverPosition({ x, distance });
      if (onHoverDistance) {
        onHoverDistance(distance);
      }
    }
  };

  const handleMouseLeave = () => {
    setHoverPosition(null);
    if (onLeave) {
      onLeave();
    }
  };

  // Utiliser soit le hover interne (depuis le graphique) soit le hover externe (depuis la carte)
  // Le hover interne a la priorité
  const displayHoverDistance = hoverPosition?.distance ?? externalHoverDistance;
  const displayHoverX =
    hoverPosition?.x ??
    (externalHoverDistance !== undefined
      ? (externalHoverDistance / totalDistance) * graphWidth
      : null);

  return (
    <div
      style={{
        borderRadius: "6px",
        backgroundColor: theme === "dark" ? "#89a380" : "#f3f4f6",
        color: "#222",
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
        style={{ display: "block", margin: "0 auto", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
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
                fill={theme === "dark" ? "#222" : "#666"}
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
                stroke={theme === "dark" ? "#222" : "#ddd"}
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              <text
                x={padding.left + x}
                y={padding.top + graphHeight + 15}
                textAnchor="middle"
                fontSize="10"
                fill={theme === "dark" ? "#222" : "#666"}
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
            stroke={"#89a380"}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Ligne verticale et point au survol */}
          {displayHoverX !== null && displayHoverDistance !== undefined && (
            <>
              {/* Ligne verticale */}
              <line
                x1={displayHoverX}
                y1={0}
                x2={displayHoverX}
                y2={graphHeight}
                stroke={"var(--brand)"}
                strokeWidth="1"
                strokeDasharray="4,2"
                opacity="0.7"
              />
              {/* Point sur la courbe */}
              {(() => {
                // Trouver le point le plus proche sur la courbe
                const targetDistance = displayHoverDistance;
                const closestPointIndex = elevationData.reduce(
                  (closestIdx, point, idx) => {
                    const distDiff = Math.abs(point.distance - targetDistance);
                    const closestDiff = Math.abs(
                      elevationData[closestIdx].distance - targetDistance,
                    );
                    return distDiff < closestDiff ? idx : closestIdx;
                  },
                  0,
                );

                const closestPoint = elevationData[closestPointIndex];

                // Calculer la pente en utilisant les points voisins
                let slope = 0;
                if (
                  closestPointIndex > 0 &&
                  closestPointIndex < elevationData.length - 1
                ) {
                  const prevPoint = elevationData[closestPointIndex - 1];
                  const nextPoint = elevationData[closestPointIndex + 1];

                  const elevationDiff =
                    nextPoint.elevation - prevPoint.elevation;
                  const distanceDiff = nextPoint.distance - prevPoint.distance;

                  if (distanceDiff > 0) {
                    slope = (elevationDiff / distanceDiff) * 100;
                  }
                } else if (
                  closestPointIndex === 0 &&
                  elevationData.length > 1
                ) {
                  // Premier point, utiliser le suivant
                  const nextPoint = elevationData[1];
                  const elevationDiff =
                    nextPoint.elevation - closestPoint.elevation;
                  const distanceDiff =
                    nextPoint.distance - closestPoint.distance;

                  if (distanceDiff > 0) {
                    slope = (elevationDiff / distanceDiff) * 100;
                  }
                } else if (
                  closestPointIndex === elevationData.length - 1 &&
                  elevationData.length > 1
                ) {
                  // Dernier point, utiliser le précédent
                  const prevPoint = elevationData[closestPointIndex - 1];
                  const elevationDiff =
                    closestPoint.elevation - prevPoint.elevation;
                  const distanceDiff =
                    closestPoint.distance - prevPoint.distance;

                  if (distanceDiff > 0) {
                    slope = (elevationDiff / distanceDiff) * 100;
                  }
                }

                const x = (closestPoint.distance / totalDistance) * graphWidth;
                const y =
                  graphHeight -
                  ((closestPoint.elevation - minElevation) / elevationRange) *
                  graphHeight;

                return (
                  <>
                    <circle
                      cx={x}
                      cy={y}
                      r="4"
                      fill={"var(--brand)"}
                      stroke="white"
                      strokeWidth="2"
                    />
                    {/* Info bulle */}
                    <g>
                      <rect
                        x={x - 45}
                        y={y - 50}
                        width="90"
                        height="44"
                        rx="3"
                        fill={theme === "dark" ? "#1a1a1a" : "white"}
                        stroke={"var(--brand)"}
                        strokeWidth="1"
                        opacity="0.95"
                      />
                      {/* Distance */}
                      <text
                        x={x}
                        y={y - 36}
                        textAnchor="middle"
                        fontSize="9"
                        fill={theme == "dark" ? "#aaa" : "#666"}
                        fontWeight="500"
                      >
                        {(closestPoint.distance / 1000).toFixed(2)} km
                      </text>
                      {/* Altitude */}
                      <text
                        x={x}
                        y={y - 24}
                        textAnchor="middle"
                        fontSize="10"
                        fill={theme == "dark" ? "#fff" : "#000"}
                        fontWeight="600"
                      >
                        {Math.round(closestPoint.elevation)}m
                      </text>
                      {/* Pente */}
                      <text
                        x={x}
                        y={y - 12}
                        textAnchor="middle"
                        fontSize="9"
                        fill={
                          slope > 0 ? "#ef4444" : slope < 0 ? "#10b981" : "#aaa"
                        }
                        fontWeight="600"
                      >
                        {slope > 0 ? "▲" : slope < 0 ? "▼" : "―"}{" "}
                        {Math.abs(slope).toFixed(1)}%
                      </text>
                    </g>
                  </>
                );
              })()}
            </>
          )}
        </g>
      </svg>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          marginTop: "10px",
          gap: "1rem",
          fontSize: "12px",
          color: theme === "dark" ? "#222" : "#666",
        }}
      >
        <span>Min: {Math.round(minElevation)}m</span>
        <span>Max: {Math.round(maxElevation)}m</span>
      </div>
    </div>
  );
}
