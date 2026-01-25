import React, { useEffect, useRef, useState, useContext } from "react";
import Map, { NavigationControl } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { ThemeContext, LanguageContext } from "../../App";
import type { WindDataPoint } from "../../utils/windParticlesCanvas";
import { WindParticlesCanvas } from "../../utils/windParticlesCanvas";
import { WindHeatmapCanvas as WindHeatmap } from "../../utils/windHeatmapCanvas";
import type { PrecipitationDataPoint } from "../../utils/precipitationHeatmapCanvas";
import { PrecipitationHeatmapCanvas } from "../../utils/precipitationHeatmapCanvas";

interface WindData {
  timestamp: string;
  source: string;
  resolution: number;
  points: WindDataPoint[];
  note?: string;
}

interface PrecipitationData {
  timestamp: string;
  source: string;
  resolution: number;
  points: PrecipitationDataPoint[];
  unit: string;
}

interface Location {
  name?: string;
  lat: number;
  lon: number;
}

interface WindHeatmapCanvasProps {
  location?: Location;
}

type DisplayMode = "wind" | "precipitation";

export default function WindHeatmapCanvas({
  location,
}: WindHeatmapCanvasProps) {
  const [windData, setWindData] = useState<WindData | null>(null);
  const [precipData, setPrecipData] = useState<PrecipitationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("wind");

  // Computed values based on display mode
  const showParticles = displayMode === "wind";
  const showHeatmap = displayMode === "wind";
  const showPrecipitation = displayMode === "precipitation";

  const mapRef = useRef<MapRef>(null);
  const heatmapCanvasRef = useRef<HTMLCanvasElement>(null);
  const particlesCanvasRef = useRef<HTMLCanvasElement>(null);
  const precipitationCanvasRef = useRef<HTMLCanvasElement>(null);
  const heatmapSystemRef = useRef<WindHeatmap | null>(null);
  const particleSystemRef = useRef<WindParticlesCanvas | null>(null);
  const precipitationSystemRef = useRef<PrecipitationHeatmapCanvas | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const theme = useContext(ThemeContext);
  const { t } = useContext(LanguageContext);

  // Load wind data
  useEffect(() => {
    loadWindData();
    loadPrecipitationData();
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

  async function loadPrecipitationData() {
    try {
      const response = await fetch("/api/precipitation-global");
      if (!response.ok) {
        console.warn("Precipitation data not available");
        return;
      }
      const data: PrecipitationData = await response.json();
      setPrecipData(data);
      console.log("Precipitation data loaded:", data.points.length, "points");
    } catch (err: any) {
      console.warn("Failed to load precipitation data:", err.message);
    }
  }

  // Initialize heatmap and particle systems when wind data loads
  useEffect(() => {
    if (
      !windData ||
      !heatmapCanvasRef.current ||
      !particlesCanvasRef.current ||
      !mapRef.current
    )
      return;

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

    // Helper to get current visible bounds
    const getVisibleBounds = () => {
      const mapBounds = map.getBounds();
      return {
        minLat: mapBounds.getSouth(),
        maxLat: mapBounds.getNorth(),
        minLon: mapBounds.getWest(),
        maxLon: mapBounds.getEast(),
      };
    };

    // Get initial visible bounds
    const initialBounds = getVisibleBounds();

    // Create heatmap system
    heatmapSystemRef.current = new WindHeatmap(
      heatmapCanvas,
      windData.points,
      initialBounds,
      0.5, // opacity
    );

    // Create particle system with global bounds (particles work globally)
    const globalBounds = {
      minLat: -90,
      maxLat: 90,
      minLon: -180,
      maxLon: 180,
    };
    particleSystemRef.current = new WindParticlesCanvas(
      particlesCanvas,
      windData.points,
      globalBounds,
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
      },
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

    // Throttle and debounce for performance
    let moveTimeout: NodeJS.Timeout | null = null;

    // Update on map move/zoom
    const handleMoveStart = () => {
      if (heatmapSystemRef.current) {
        heatmapSystemRef.current.setMoving(true);
      }
    };

    const handleMove = () => {
      const proj = getProjection();
      const visibleBounds = getVisibleBounds();

      if (heatmapSystemRef.current) {
        heatmapSystemRef.current.setProjection(proj);
        heatmapSystemRef.current.updateBounds(visibleBounds);
        if (showHeatmap) {
          heatmapSystemRef.current.redraw();
        }
      }

      if (particleSystemRef.current) {
        particleSystemRef.current.updateProjection(proj);
      }

      // Clear existing timeout
      if (moveTimeout) clearTimeout(moveTimeout);

      // Set moving to false after movement stops
      moveTimeout = setTimeout(() => {
        if (heatmapSystemRef.current) {
          heatmapSystemRef.current.setMoving(false);
          if (showHeatmap) {
            heatmapSystemRef.current.redraw(); // Final high-quality redraw
          }
        }
      }, 150);
    };

    const handleResize = () => {
      updateCanvasSize();

      if (heatmapSystemRef.current) {
        heatmapSystemRef.current.resize(
          heatmapCanvas.width,
          heatmapCanvas.height,
        );
        if (showHeatmap) {
          heatmapSystemRef.current.redraw();
        }
      }

      if (particleSystemRef.current) {
        particleSystemRef.current.resize(
          particlesCanvas.width,
          particlesCanvas.height,
        );
      }
    };

    map.on("movestart", handleMoveStart);
    map.on("move", handleMove);
    map.on("zoom", handleMove);
    map.on("resize", handleResize);

    return () => {
      if (moveTimeout) clearTimeout(moveTimeout);

      map.off("movestart", handleMoveStart);
      map.off("move", handleMove);
      map.off("zoom", handleMove);
      map.off("resize", handleResize);

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

  // Initialize precipitation system when data loads
  useEffect(() => {
    if (!precipData || !precipitationCanvasRef.current || !mapRef.current)
      return;

    const map = mapRef.current.getMap();
    const precipCanvas = precipitationCanvasRef.current;

    // Set canvas size to match map
    const updateCanvasSize = () => {
      const container = map.getContainer();
      const { width, height } = container.getBoundingClientRect();

      precipCanvas.width = width;
      precipCanvas.height = height;
      precipCanvas.style.width = `${width}px`;
      precipCanvas.style.height = `${height}px`;
    };

    updateCanvasSize();

    // Helper to get current visible bounds
    const getVisibleBounds = () => {
      const mapBounds = map.getBounds();
      return {
        minLat: mapBounds.getSouth(),
        maxLat: mapBounds.getNorth(),
        minLon: mapBounds.getWest(),
        maxLon: mapBounds.getEast(),
      };
    };

    // Get initial visible bounds
    const initialBounds = getVisibleBounds();

    // Create precipitation system
    precipitationSystemRef.current = new PrecipitationHeatmapCanvas(
      precipCanvas,
      precipData.points,
      initialBounds,
      0.7, // opacity
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
      },
    });

    // Set initial projection
    const projection = getProjection();
    precipitationSystemRef.current.setProjection(projection);

    // Draw precipitation if enabled
    if (showPrecipitation) {
      precipitationSystemRef.current.draw();
    }

    // Throttle and debounce for performance
    let moveTimeout: NodeJS.Timeout | null = null;

    // Update on map move/zoom
    const handleMoveStart = () => {
      if (precipitationSystemRef.current) {
        precipitationSystemRef.current.setMoving(true);
      }
    };

    const handleMove = () => {
      const proj = getProjection();
      const visibleBounds = getVisibleBounds();

      if (precipitationSystemRef.current) {
        precipitationSystemRef.current.setProjection(proj);
        precipitationSystemRef.current.updateBounds(visibleBounds);
        if (showPrecipitation) {
          precipitationSystemRef.current.redraw();
        }
      }

      // Clear existing timeout
      if (moveTimeout) clearTimeout(moveTimeout);

      // Set moving to false after movement stops
      moveTimeout = setTimeout(() => {
        if (precipitationSystemRef.current) {
          precipitationSystemRef.current.setMoving(false);
          if (showPrecipitation) {
            precipitationSystemRef.current.redraw(); // Final high-quality redraw
          }
        }
      }, 150);
    };

    const handleResize = () => {
      updateCanvasSize();

      if (precipitationSystemRef.current) {
        precipitationSystemRef.current.resize(
          precipCanvas.width,
          precipCanvas.height,
        );
        if (showPrecipitation) {
          precipitationSystemRef.current.redraw();
        }
      }
    };

    map.on("movestart", handleMoveStart);
    map.on("move", handleMove);
    map.on("zoom", handleMove);
    map.on("resize", handleResize);

    return () => {
      if (moveTimeout) clearTimeout(moveTimeout);

      map.off("movestart", handleMoveStart);
      map.off("move", handleMove);
      map.off("zoom", handleMove);
      map.off("resize", handleResize);
    };
  }, [precipData, showPrecipitation]);

  // Toggle precipitation visibility
  useEffect(() => {
    if (!precipitationSystemRef.current) return;

    if (showPrecipitation) {
      precipitationSystemRef.current.draw();
    } else {
      precipitationSystemRef.current.clear();
    }
  }, [showPrecipitation]);

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
    <div
      className="wind-heatmap-container  multi-item-vertical"
      style={{ paddingTop: "2rem" }}
    >
      <div className="wind-heatmap-header">
        <h2>
          {displayMode === "wind" ? t.globalWindMap : t.globalPrecipitationMap}
        </h2>
        <div className="wind-heatmap-controls">
          <button onClick={loadWindData} disabled={loading}>
            {loading ? t.loading : t.refreshData}
          </button>

          <div className="button-group">
            <button
              className={displayMode === "wind" ? "active" : ""}
              onClick={() => setDisplayMode("wind")}
            >
              {t.winds}
            </button>
            <button
              className={displayMode === "precipitation" ? "active" : ""}
              onClick={() => setDisplayMode("precipitation")}
              disabled={!precipData}
              title={!precipData ? t.precipitationDataNotAvailable : ""}
            >
              {t.precipitation}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error" style={{ margin: "1rem 0" }}>
          {t.error}: {error}
        </div>
      )}

      {displayMode === "wind" && windData && (
        <div className="wind-heatmap-info">
          <p>
            {t.source}: {windData.source} | {t.updated}:{" "}
            {new Date(windData.timestamp).toLocaleString()} | {t.points}:{" "}
            {windData.points.length}
          </p>
          <div className="wind-legend">
            <span className="legend-title">{t.windSpeedLabel}:</span>
            <div className="legend-item">
              <span
                className="legend-color"
                style={{ background: "rgb(50, 136, 189)" }}
              ></span>{" "}
              0-2 ({t.calm})
            </div>
            <div className="legend-item">
              <span
                className="legend-color"
                style={{ background: "rgb(102, 194, 165)" }}
              ></span>{" "}
              2-5 ({t.light})
            </div>
            <div className="legend-item">
              <span
                className="legend-color"
                style={{ background: "rgb(171, 221, 164)" }}
              ></span>{" "}
              5-8 ({t.moderate})
            </div>
            <div className="legend-item">
              <span
                className="legend-color"
                style={{ background: "rgb(254, 224, 139)" }}
              ></span>{" "}
              8-14 ({t.strong})
            </div>
            <div className="legend-item">
              <span
                className="legend-color"
                style={{ background: "rgb(244, 109, 67)" }}
              ></span>{" "}
              14-20 ({t.veryStrong})
            </div>
            <div className="legend-item">
              <span
                className="legend-color"
                style={{ background: "rgb(215, 48, 39)" }}
              ></span>{" "}
              20+ ({t.violent})
            </div>
          </div>
        </div>
      )}

      {displayMode === "precipitation" && precipData && (
        <div className="wind-heatmap-info">
          <p>
            {t.source}: {precipData.source} | {t.updated}:{" "}
            {new Date(precipData.timestamp).toLocaleString()} | {t.points}:{" "}
            {precipData.points.length}
          </p>
          <div className="precipitation-legend">
            <span className="legend-title">{t.precipitationLabel}:</span>
            <div className="legend-item">
              <span
                className="legend-color"
                style={{ background: "rgba(173, 216, 230, 0.5)" }}
              ></span>{" "}
              0.1-0.5 ({t.veryLight})
            </div>
            <div className="legend-item">
              <span
                className="legend-color"
                style={{ background: "rgba(135, 206, 250, 0.7)" }}
              ></span>{" "}
              0.5-1 ({t.light})
            </div>
            <div className="legend-item">
              <span
                className="legend-color"
                style={{ background: "rgba(70, 130, 180, 0.7)" }}
              ></span>{" "}
              1-2.5 ({t.moderate})
            </div>
            <div className="legend-item">
              <span
                className="legend-color"
                style={{ background: "rgba(30, 144, 255, 0.7)" }}
              ></span>{" "}
              2.5-5 ({t.moderateStrong})
            </div>
            <div className="legend-item">
              <span
                className="legend-color"
                style={{ background: "rgba(75, 0, 130, 0.8)" }}
              ></span>{" "}
              5-10 ({t.strong})
            </div>
            <div className="legend-item">
              <span
                className="legend-color"
                style={{ background: "rgba(138, 43, 226, 0.85)" }}
              ></span>{" "}
              10-20 ({t.veryStrong})
            </div>
            <div className="legend-item">
              <span
                className="legend-color"
                style={{ background: "rgba(199, 21, 133, 0.9)" }}
              ></span>{" "}
              20-40 ({t.intense})
            </div>
            <div className="legend-item">
              <span
                className="legend-color"
                style={{ background: "rgba(220, 20, 60, 0.95)" }}
              ></span>{" "}
              40+ ({t.extreme})
            </div>
          </div>
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

        {/* Canvas overlay for wind heatmap (bottom layer) */}
        <canvas
          ref={heatmapCanvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* Canvas overlay for precipitation (middle layer) */}
        <canvas
          ref={precipitationCanvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            zIndex: 2,
          }}
        />

        {/* Canvas overlay for wind particles (top layer) */}
        <canvas
          ref={particlesCanvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            zIndex: 3,
          }}
        />
      </div>

      <style>{`
        .wind-heatmap-container {
          margin: 1rem 0 0 0;
        }

        @media screen and (max-width: 460px) {
            .wind-heatmap-header{
                  flex-direction: column;
             }
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

        .button-group {
          display: inline-flex;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 6px var(--card-shadow);
        }

        .button-group button {
          border-radius: 0;
          border-right: none;
          box-shadow: none;
          margin: 0;
          min-width: 120px;
        }

        .button-group button:first-child {
          border-top-left-radius: 10px;
          border-bottom-left-radius: 10px;
        }

        .button-group button:last-child {
          border-top-right-radius: 10px;
          border-bottom-right-radius: 10px;
          border-right: 1px solid rgba(0, 0, 0, 0.06);
        }

        .button-group button.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-color: rgba(255, 255, 255, 0.2);
        }

        .button-group button.active:hover:not(:disabled) {
          background: linear-gradient(135deg, #5568d3 0%, #653a8e 100%);
          transform: none;
        }

        .button-group button:not(.active):hover:not(:disabled) {
          transform: none;
          box-shadow: none;
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

        .precipitation-legend {
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
