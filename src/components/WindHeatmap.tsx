import React, { useEffect, useRef, useState, useContext } from "react";
import Map, { Source, Layer, NavigationControl } from "react-map-gl";
import type { MapRef } from "react-map-gl";
import type { HeatmapLayer, SymbolLayer } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { ThemeContext } from "../App";

interface WindDataPoint {
  lat: number;
  lon: number;
  speed: number;
  direction: number;
  gusts: number;
}

interface WindData {
  timestamp: string;
  source: string;
  resolution: number;
  points: WindDataPoint[];
  note?: string;
}

// Get Mapbox token from environment variable or use empty string
// To get a free token: https://account.mapbox.com/auth/signup/
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

export default function WindHeatmap() {
  const [windData, setWindData] = useState<WindData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArrows, setShowArrows] = useState(true);
  const mapRef = useRef<MapRef>(null);
  const theme = useContext(ThemeContext);

  useEffect(() => {
    loadWindData();
  }, []);

  async function loadWindData() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/wind-global");
      if (!response.ok) throw new Error("Failed to fetch wind data");
      const data: WindData = await response.json();
      setWindData(data);
    } catch (err: any) {
      setError(err.message || "Failed to load wind data");
    } finally {
      setLoading(false);
    }
  }

  // Convert wind data to GeoJSON for heatmap
  const windHeatmapGeoJSON = windData
    ? {
      type: "FeatureCollection" as const,
      features: windData.points.map((point) => ({
        type: "Feature" as const,
        properties: {
          speed: point.speed,
          direction: point.direction,
          gusts: point.gusts,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [point.lon, point.lat],
        },
      })),
    }
    : null;

  // Convert wind data to GeoJSON for arrows (sample subset for performance)
  const windArrowsGeoJSON = windData
    ? {
      type: "FeatureCollection" as const,
      features: windData.points
        .filter((_, index) => index % 3 === 0) // Sample every 3rd point
        .map((point) => ({
          type: "Feature" as const,
          properties: {
            speed: point.speed,
            direction: point.direction,
            rotation: point.direction, // Direction the arrow should point
          },
          geometry: {
            type: "Point" as const,
            coordinates: [point.lon, point.lat],
          },
        })),
    }
    : null;

  // Heatmap layer configuration
  const heatmapLayer: HeatmapLayer = {
    id: "wind-heatmap",
    type: "heatmap",
    paint: {
      // Increase weight as wind speed increases
      "heatmap-weight": [
        "interpolate",
        ["linear"],
        ["get", "speed"],
        0,
        0,
        100,
        1,
      ],
      // Increase intensity as zoom level increases
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 9, 3],
      // Color ramp from blue (calm) to red (strong winds)
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(33, 102, 172, 0)",
        0.2,
        "rgb(103, 169, 207)",
        0.4,
        "rgb(209, 229, 240)",
        0.6,
        "rgb(253, 219, 199)",
        0.8,
        "rgb(239, 138, 98)",
        1,
        "rgb(178, 24, 43)",
      ],
      // Adjust radius based on zoom
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 9, 20],
      // Transition from heatmap to circle layer at higher zoom
      "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 1, 9, 0.5],
    },
  };

  // Arrow symbols layer
  const arrowsLayer: SymbolLayer = {
    id: "wind-arrows",
    type: "symbol",
    layout: {
      "icon-image": "arrow",
      "icon-size": [
        "interpolate",
        ["linear"],
        ["get", "speed"],
        0,
        0.3,
        50,
        0.8,
        100,
        1.2,
      ],
      "icon-rotate": ["get", "rotation"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: {
      "icon-opacity": 0.7,
    },
  };

  // Create arrow icon when map loads
  const onMapLoad = () => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Create a canvas arrow icon
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      // Draw arrow pointing up (will be rotated based on wind direction)
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.moveTo(size / 2, size * 0.2);
      ctx.lineTo(size * 0.7, size * 0.5);
      ctx.lineTo(size * 0.6, size * 0.5);
      ctx.lineTo(size * 0.6, size * 0.8);
      ctx.lineTo(size * 0.4, size * 0.8);
      ctx.lineTo(size * 0.4, size * 0.5);
      ctx.lineTo(size * 0.3, size * 0.5);
      ctx.closePath();
      ctx.fill();

      map.addImage("arrow", {
        width: size,
        height: size,
        data: ctx.getImageData(0, 0, size, size).data as
          | Uint8Array
          | Uint8ClampedArray,
      });
    }
  };

  const mapStyle =
    theme === "dark"
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/light-v11";

  if (!MAPBOX_TOKEN) {
    return (
      <div className="wind-heatmap-container">
        <div className="wind-heatmap-header">
          <h2>Global Wind Heatmap</h2>
        </div>
        <div className="error" style={{ margin: "1rem 0" }}>
          <strong>Mapbox token required:</strong> Please set VITE_MAPBOX_TOKEN
          in your .env file.
          <br />
          Get a free token at:{" "}
          <a
            href="https://account.mapbox.com/auth/signup/"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://account.mapbox.com/auth/signup/
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="wind-heatmap-container">
      <div className="wind-heatmap-header">
        <h2>Global Wind Heatmap</h2>
        <div className="wind-heatmap-controls">
          <button onClick={loadWindData} disabled={loading}>
            {loading ? "Loading..." : "Refresh Data"}
          </button>
          <button onClick={() => setShowArrows(!showArrows)}>
            {showArrows ? "Hide Arrows" : "Show Arrows"}
          </button>
        </div>
      </div>

      {error && (
        <div className="error" style={{ margin: "1rem 0" }}>
          Error: {error}
        </div>
      )}

      {windData && (
        <div className="wind-heatmap-info">
          <p>
            Source: {windData.source} | Updated:{" "}
            {new Date(windData.timestamp).toLocaleString()} | Resolution:{" "}
            {windData.resolution}° | Points: {windData.points.length}
          </p>
          {windData.note && (
            <p style={{ fontSize: "0.9em", opacity: 0.8 }}>{windData.note}</p>
          )}
        </div>
      )}

      <div className="wind-heatmap-legend">
        <div className="legend-title">Wind Speed (knots)</div>
        <div className="legend-gradient">
          <div className="legend-labels">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100+</span>
          </div>
        </div>
      </div>

      <div className="wind-map-wrapper">
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={{
            longitude: 0,
            latitude: 20,
            zoom: 2,
          }}
          style={{ width: "100%", height: "600px" }}
          mapStyle={mapStyle}
          onLoad={onMapLoad}
        >
          <NavigationControl position="top-right" />

          {windHeatmapGeoJSON && (
            <Source
              id="wind-heatmap-source"
              type="geojson"
              data={windHeatmapGeoJSON}
            >
              <Layer {...heatmapLayer} />
            </Source>
          )}

          {showArrows && windArrowsGeoJSON && (
            <Source
              id="wind-arrows-source"
              type="geojson"
              data={windArrowsGeoJSON}
            >
              <Layer {...arrowsLayer} />
            </Source>
          )}
        </Map>
      </div>

      <style>{`
        .wind-heatmap-container {
          margin: 2rem 0;
        }

        .wind-heatmap-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .wind-heatmap-header h2 {
          margin: 0;
        }

        .wind-heatmap-controls {
          display: flex;
          gap: 0.5rem;
        }

        .wind-heatmap-info {
          background: var(--card-bg);
          padding: 0.75rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          font-size: 0.9em;
        }

        .wind-heatmap-info p {
          margin: 0.25rem 0;
        }

        .wind-heatmap-legend {
          margin-bottom: 1rem;
        }

        .legend-title {
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .legend-gradient {
          height: 30px;
          background: linear-gradient(
            to right,
            rgb(33, 102, 172),
            rgb(103, 169, 207),
            rgb(209, 229, 240),
            rgb(253, 219, 199),
            rgb(239, 138, 98),
            rgb(178, 24, 43)
          );
          border-radius: 4px;
          position: relative;
        }

        .legend-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 0.25rem;
          font-size: 0.85em;
        }

        .wind-map-wrapper {
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
}
