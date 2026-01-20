import React, { useEffect, useRef, useState, useContext } from "react";
import Map, { NavigationControl } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { ThemeContext } from "../App";
import type { WindDataPoint } from "../utils/windParticlesCanvas";
import { WindParticlesCanvas } from "../utils/windParticlesCanvas";
import { WindHeatmapCanvas as WindHeatmap } from "../utils/windHeatmapCanvas";

interface WindData {
  timestamp: string;
  source: string;
  resolution: number;
  points: WindDataPoint[];
  note?: string;
}

interface Location {
  name?: string;
  lat: number;
  lon: number;
}

interface WindHeatmapCanvasProps {
  location?: Location;
}

export default function WindHeatmapCanvas({ location }: WindHeatmapCanvasProps) {
  const [windData, setWindData] = useState<WindData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showParticles, setShowParticles] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);

  const mapRef = useRef<MapRef>(null);
  const heatmapCanvasRef = useRef<HTMLCanvasElement>(null);
  const particlesCanvasRef = useRef<HTMLCanvasElement>(null);
  const heatmapSystemRef = useRef<WindHeatmap | null>(null);
  const particleSystemRef = useRef<WindParticlesCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const theme = useContext(ThemeContext);

  // Load wind data
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

  // Initialize heatmap and particle systems when wind data loads
  useEffect(() => {
    if (!windData || !heatmapCanvasRef.current || !particlesCanvasRef.current || !mapRef.current) return;

    const map = mapRef.current.getMap();
    const heatmapCanvas = heatmapCanvasRef.current;
    const particlesCanvas = particlesCanvasRef.current;

    // Set canvas sizes to match map
    const updateCanvasSize = () => {
      const container = map.getContainer();
      const { width, height } = container.getBoundingClientRect();

      heatmapCanvas.width = width;
      heatmapCanvas.height = height;
      heatmapCanvas.style.width = `${width}px`;
      heatmapCanvas.style.height = `${height}px`;

      particlesCanvas.width = width;
      particlesCanvas.height = height;
      particlesCanvas.style.width = `${width}px`;
      particlesCanvas.style.height = `${height}px`;
    };

    updateCanvasSize();

    // Create bounds - Global coverage
    const bounds = {
      minLat: -90,
      maxLat: 90,
      minLon: -180,
      maxLon: 180
    };

    // Create heatmap system
    heatmapSystemRef.current = new WindHeatmap(
      heatmapCanvas,
      windData.points,
      bounds,
      0.5 // opacity
    );

    // Create particle system
    particleSystemRef.current = new WindParticlesCanvas(
      particlesCanvas,
      windData.points,
      bounds
    );

    // Create projection helper
    const getProjection = () => ({
      project: (lngLat: [number, number]) => {
        const point = map.project(lngLat);
        return [point.x, point.y];
      },
      unproject: (xy: [number, number]) => {
        const lngLat = map.unproject(xy);
        return [lngLat.lng, lngLat.lat];
      }
    });

    // Set initial projection
    const projection = getProjection();
    heatmapSystemRef.current.setProjection(projection);
    particleSystemRef.current.setProjection(projection);

    // Draw heatmap if enabled
    if (showHeatmap) {
      heatmapSystemRef.current.draw();
    }

    // Start particles if enabled
    if (showParticles) {
      particleSystemRef.current.start();
    }

    // Update on map move/zoom
    const handleMove = () => {
      const proj = getProjection();

      if (heatmapSystemRef.current) {
        heatmapSystemRef.current.setProjection(proj);
        if (showHeatmap) {
          heatmapSystemRef.current.redraw();
        }
      }

      if (particleSystemRef.current) {
        particleSystemRef.current.updateProjection(proj);
      }
    };

    const handleResize = () => {
      updateCanvasSize();

      if (heatmapSystemRef.current) {
        heatmapSystemRef.current.resize(heatmapCanvas.width, heatmapCanvas.height);
        if (showHeatmap) {
          heatmapSystemRef.current.redraw();
        }
      }

      if (particleSystemRef.current) {
        particleSystemRef.current.resize(particlesCanvas.width, particlesCanvas.height);
      }
    };

    map.on('move', handleMove);
    map.on('zoom', handleMove);
    map.on('resize', handleResize);

    return () => {
      map.off('move', handleMove);
      map.off('zoom', handleMove);
      map.off('resize', handleResize);

      if (particleSystemRef.current) {
        particleSystemRef.current.stop();
      }
    };
  }, [windData, showParticles, showHeatmap]);

  // Toggle heatmap visibility
  useEffect(() => {
    if (!heatmapSystemRef.current) return;

    if (showHeatmap) {
      heatmapSystemRef.current.draw();
    } else {
      heatmapSystemRef.current.clear();
    }
  }, [showHeatmap]);

  // Center map on location
  useEffect(() => {
    if (location && mapRef.current) {
      mapRef.current.flyTo({
        center: [location.lon, location.lat],
        zoom: 8,
        duration: 2000,
      });
    }
  }, [location]);

  const mapStyle =
    theme === "dark"
      ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

  return (
    <div className="wind-heatmap-container">
      <div className="wind-heatmap-header">
        <h2>Global Wind Map</h2>
        <div className="wind-heatmap-controls">
          <button onClick={loadWindData} disabled={loading}>
            {loading ? "Loading..." : "Refresh Data"}
          </button>
          <button onClick={() => setShowHeatmap(!showHeatmap)}>
            {showHeatmap ? "Hide Heatmap" : "Show Heatmap"}
          </button>
          <button onClick={() => setShowParticles(!showParticles)}>
            {showParticles ? "Hide Particles" : "Show Particles"}
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
            {new Date(windData.timestamp).toLocaleString()} | Points: {windData.points.length}
          </p>
          {showHeatmap && (
            <div className="wind-legend">
              <span className="legend-title">Wind Speed (m/s):</span>
              <div className="legend-item"><span className="legend-color" style={{background: 'rgb(50, 136, 189)'}}></span> 0-2 (Calme)</div>
              <div className="legend-item"><span className="legend-color" style={{background: 'rgb(102, 194, 165)'}}></span> 2-5 (Léger)</div>
              <div className="legend-item"><span className="legend-color" style={{background: 'rgb(171, 221, 164)'}}></span> 5-8 (Modéré)</div>
              <div className="legend-item"><span className="legend-color" style={{background: 'rgb(254, 224, 139)'}}></span> 8-14 (Fort)</div>
              <div className="legend-item"><span className="legend-color" style={{background: 'rgb(244, 109, 67)'}}></span> 14-20 (Très fort)</div>
              <div className="legend-item"><span className="legend-color" style={{background: 'rgb(215, 48, 39)'}}></span> 20+ (Violent)</div>
            </div>
          )}
        </div>
      )}

      <div className="wind-map-wrapper" ref={containerRef}>
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: location?.lon ?? 0,
            latitude: location?.lat ?? 20,
            zoom: location ? 8 : 1.5,
          }}
          style={{ width: "100%", height: "600px" }}
          mapStyle={mapStyle}
        >
          <NavigationControl position="top-right" />
        </Map>

        {/* Canvas overlay for heatmap (bottom layer) */}
        <canvas
          ref={heatmapCanvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            zIndex: 1
          }}
        />

        {/* Canvas overlay for particles (top layer) */}
        <canvas
          ref={particlesCanvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            zIndex: 2
          }}
        />
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

        .wind-heatmap-controls button {
          display: inline-flex;
          flex-direction: column;
          gap: 2px;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.06);
          background: var(--card);
          color: var(--text);
          font-family: inherit;
          cursor: pointer;
          box-shadow: 0 2px 6px var(--card-shadow);
          transition: transform 120ms ease, box-shadow 120ms ease, background 160ms ease;
          font-size: 0.9em;
        }

        .wind-heatmap-controls button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px var(--card-shadow);
          background: var(--card-hover);
        }

        .wind-heatmap-controls button:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 4px var(--card-shadow);
        }

        .wind-heatmap-controls button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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

        .wind-legend {
          display: flex;
          gap: 1rem;
          margin-top: 0.5rem;
          flex-wrap: wrap;
          align-items: center;
        }

        .legend-title {
          font-weight: 600;
          margin-right: 0.5rem;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.85em;
        }

        .legend-color {
          display: inline-block;
          width: 20px;
          height: 12px;
          border-radius: 2px;
          border: 1px solid rgba(0, 0, 0, 0.2);
        }

        .wind-map-wrapper {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
}
