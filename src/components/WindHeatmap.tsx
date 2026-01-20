import React, { useEffect, useRef, useState, useContext, useMemo } from "react";
import Map, { NavigationControl, useControl } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { ThemeContext } from "../App";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { MapboxOverlayProps } from "@deck.gl/mapbox";
import { WindParticleSystem, type WindDataPoint } from "../utils/windParticles";

// Wrapper component for DeckGL overlay that works with react-map-gl
function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

interface WindData {
  timestamp: string;
  source: string;
  resolution: number;
  points: WindDataPoint[];
  note?: string;
}

interface Location {
  name?: string;
  region?: string;
  country?: string;
  lat: number;
  lon: number;
  tz_id?: string;
  localtime_epoch?: number;
  localtime?: string;
}

interface WindHeatmapProps {
  location?: Location;
}

export default function WindHeatmap({ location }: WindHeatmapProps) {
  const [windData, setWindData] = useState<WindData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showParticles, setShowParticles] = useState(true);
  const [layers, setLayers] = useState<any[]>([]);
  const mapRef = useRef<MapRef>(null);
  const particleSystemRef = useRef<WindParticleSystem | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const theme = useContext(ThemeContext);

  // Center map on location when it changes
  useEffect(() => {
    if (location && mapRef.current) {
      mapRef.current.flyTo({
        center: [location.lon, location.lat],
        zoom: 8,
        duration: 2000,
      });
    }
  }, [location]);

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

      // Initialize particle system - TOUTE L'EUROPE
      if (data.points && data.points.length > 0) {
        particleSystemRef.current = new WindParticleSystem(data.points, 3000, {
          minLat: 35, // Sud de l'Espagne/Grèce
          maxLat: 71, // Nord de la Scandinavie
          minLon: -10, // Ouest du Portugal/Irlande
          maxLon: 45, // Est de la Russie européenne
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to load wind data");
    } finally {
      setLoading(false);
    }
  }

  // WebGL-optimized animation loop
  useEffect(() => {
    if (!windData || !particleSystemRef.current) return;

    let frameCount = 0;
    let lastUpdateTime = performance.now();

    // GPU-optimized animation loop
    const animate = (currentTime: number) => {
      if (!particleSystemRef.current || !showParticles) {
        setLayers([]);
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Calculate delta time for smooth animation
      const deltaTime = (currentTime - lastUpdateTime) / 1000;
      lastUpdateTime = currentTime;

      // Update particle physics
      particleSystemRef.current.update(deltaTime);
      frameCount++;

      // Get trail, head, and arrow data (pre-computed in GPU-friendly format)
      const trails = particleSystemRef.current.getTrails();
      const heads = particleSystemRef.current.getHeads();
      const arrows = particleSystemRef.current.getArrows();

      // Pre-calculate pulse for all heads (once per frame)
      const pulse = Math.sin(frameCount * 0.05) * 0.2 + 0.8;

      // WebGL optimization: only update every N frames for better performance
      const dataVersion = Math.floor(frameCount / 2); // Update every 2 frames

      // WebGL Layer 1: Halo with GPU-computed fade and desynchronized rendering
      const haloLayer = new PathLayer({
        id: "wind-halo",
        data: trails,
        dataComparator: (newData, oldData) => newData === oldData,
        _pathType: 'open',

        getPath: (d: any) => d.path, // Simplified - no oscillation for performance
        getColor: (d: any) => {
          const [r, g, b] = d.baseColor;
          // Pulsing opacity based on segment phase
          const avgPhase = d.pathPhases?.reduce((a: number, b: number) => a + b, 0) / (d.pathPhases?.length || 1);
          const pulseFactor = 0.7 + Math.sin(frameCount * 0.05 + avgPhase) * 0.3;
          const fadeAlpha = Math.pow(d.segmentPosition, 2) * 40 * pulseFactor;
          return [r, g, b, fadeAlpha];
        },
        getWidth: (d: any) => {
          // Varying width based on phase - 4× PLUS LARGE
          const avgPhase = d.pathPhases?.reduce((a: number, b: number) => a + b, 0) / (d.pathPhases?.length || 1);
          const widthVar = 1 + Math.sin(frameCount * 0.08 + avgPhase) * 0.2;
          return (20 + d.segmentPosition * 30) * widthVar * 4;
        },

        widthMinPixels: 60,
        widthMaxPixels: 200,
        widthScale: 1,
        opacity: 0.4,
        capRounded: true,
        jointRounded: true,
        billboard: false,

        // WebGL optimizations
        fp64: false, // Use 32-bit for performance
        autoHighlight: false,
        highlightColor: [0, 0, 0, 0],

        updateTriggers: {
          getPath: dataVersion,
          getColor: dataVersion,
          getWidth: dataVersion
        }
      });

      // WebGL Layer 2: Medium glow with independent oscillation
      const glowLayer = new PathLayer({
        id: "wind-glow",
        data: trails,
        dataComparator: (newData, oldData) => newData === oldData,
        _pathType: 'open',

        getPath: (d: any) => d.path,
        getColor: (d: any) => {
          const [r, g, b] = d.baseColor;
          const avgPhase = d.pathPhases?.reduce((a: number, b: number) => a + b, 0) / (d.pathPhases?.length || 1);
          const pulseFactor = 0.8 + Math.sin(frameCount * 0.07 + avgPhase) * 0.2;
          const fadeAlpha = Math.pow(d.segmentPosition, 1.5) * 100 * pulseFactor;
          return [r, g, b, fadeAlpha];
        },
        getWidth: (d: any) => {
          const avgPhase = d.pathPhases?.reduce((a: number, b: number) => a + b, 0) / (d.pathPhases?.length || 1);
          const widthVar = 1 + Math.sin(frameCount * 0.09 + avgPhase) * 0.15;
          return (3 + d.segmentPosition * 9) * widthVar * 4;
        },

        widthMinPixels: 12,
        widthMaxPixels: 60,
        opacity: 0.6,
        capRounded: true,
        jointRounded: true,
        billboard: false,
        fp64: false,
        autoHighlight: false,

        updateTriggers: {
          getPath: dataVersion,
          getColor: dataVersion,
          getWidth: dataVersion
        }
      });

      // WebGL Layer 3: Main trails with independent wave motion
      const trailLayer = new PathLayer({
        id: "wind-trails",
        data: trails,
        dataComparator: (newData, oldData) => newData === oldData,
        _pathType: 'open',

        getPath: (d: any) => d.path,
        getColor: (d: any) => {
          const fadeCurve = Math.pow(d.segmentPosition, 1.2);
          const avgPhase = d.pathPhases?.reduce((a: number, b: number) => a + b, 0) / (d.pathPhases?.length || 1);
          const pulseFactor = 0.85 + Math.sin(frameCount * 0.06 + avgPhase) * 0.15;
          const opacity = Math.floor(fadeCurve * 240 * pulseFactor + 15);
          const [r, g, b] = d.baseColor;
          return [r, g, b, opacity];
        },
        getWidth: (d: any) => {
          const speedFactor = Math.min(d.speed / 20, 1);
          const baseTaper = 1.5 + d.segmentPosition * 4;
          const avgPhase = d.pathPhases?.reduce((a: number, b: number) => a + b, 0) / (d.pathPhases?.length || 1);
          const widthVar = 1 + Math.sin(frameCount * 0.1 + avgPhase) * 0.1;
          return (baseTaper + speedFactor * 3) * widthVar * 4;
        },

        widthMinPixels: 8,
        widthMaxPixels: 48,
        opacity: 0.95,
        capRounded: true,
        jointRounded: true,
        billboard: false,
        fp64: false,
        autoHighlight: false,

        updateTriggers: {
          getPath: dataVersion,
          getColor: dataVersion,
          getWidth: dataVersion
        }
      });

      // WebGL Layer 4: Bright core with micro-oscillations
      const coreLayer = new PathLayer({
        id: "wind-core",
        data: trails,
        dataComparator: (newData, oldData) => newData === oldData,
        _pathType: 'open',

        getPath: (d: any) => d.path,
        getColor: (d: any) => {
          const fadeCurve = Math.pow(d.segmentPosition, 0.8);
          const avgPhase = d.pathPhases?.reduce((a: number, b: number) => a + b, 0) / (d.pathPhases?.length || 1);
          const shimmer = 1 + Math.sin(frameCount * 0.12 + avgPhase) * 0.1;
          const opacity = Math.floor(fadeCurve * 255 * shimmer);
          const [r, g, b] = d.baseColor;
          const brighten = (1.3 + d.segmentPosition * 0.3) * shimmer;
          return [
            Math.min(255, r * brighten),
            Math.min(255, g * brighten),
            Math.min(255, b * brighten),
            opacity,
          ];
        },
        getWidth: (d: any) => {
          const speedFactor = Math.min(d.speed / 20, 1);
          const taper = 0.5 + d.segmentPosition * 2;
          const avgPhase = d.pathPhases?.reduce((a: number, b: number) => a + b, 0) / (d.pathPhases?.length || 1);
          const widthVar = 1 + Math.sin(frameCount * 0.13 + avgPhase) * 0.08;
          return (taper + speedFactor * 1.5) * widthVar * 4;
        },

        widthMinPixels: 2,
        widthMaxPixels: 20,
        opacity: 1,
        capRounded: true,
        jointRounded: true,
        billboard: false,
        fp64: false,
        autoHighlight: false,

        updateTriggers: {
          getPath: dataVersion,
          getColor: dataVersion,
          getWidth: dataVersion
        }
      });

      // WebGL Layer 5: Particle heads with GPU-accelerated pulsing
      const headLayer = new ScatterplotLayer({
        id: "wind-heads",
        data: heads,
        dataComparator: (newData, oldData) => newData === oldData,

        getPosition: (d: any) => d.position,
        getFillColor: (d: any) => {
          const [r, g, b, a] = d.color;
          return [
            Math.min(255, r * 1.3 * pulse),
            Math.min(255, g * 1.3 * pulse),
            Math.min(255, b * 1.3 * pulse),
            a,
          ];
        },
        getRadius: (d: any) => 2 + (d.speed / 20) * 2,

        radiusMinPixels: 2,
        radiusMaxPixels: 8,
        opacity: 1,
        stroked: true,
        filled: true,
        getLineColor: [255, 255, 255, 200],
        lineWidthMinPixels: 1,

        // WebGL optimizations
        fp64: false,
        autoHighlight: false,
        highlightColor: [0, 0, 0, 0],

        updateTriggers: {
          getPosition: dataVersion,
          getFillColor: dataVersion,
          getRadius: dataVersion
        }
      });

      // WebGL Layer 6: Wind direction arrows
      const arrowLayer = new ScatterplotLayer({
        id: "wind-arrows",
        data: arrows,
        dataComparator: (newData, oldData) => newData === oldData,

        getPosition: (d: any) => d.position,
        getFillColor: (d: any) => {
          const [r, g, b] = d.color;
          return [r, g, b, 220]; // Semi-transparent
        },
        getLineColor: [255, 255, 255, 255],

        // Arrow shape using custom size
        radiusMinPixels: 6,
        radiusMaxPixels: 12,
        getRadius: (d: any) => {
          // Size based on speed
          return 4 + Math.min(d.speed / 20, 1) * 4;
        },

        stroked: true,
        filled: true,
        lineWidthMinPixels: 2,
        opacity: 0.9,

        // WebGL optimizations
        fp64: false,
        autoHighlight: false,

        updateTriggers: {
          getPosition: dataVersion,
          getFillColor: dataVersion,
          getRadius: dataVersion
        }
      });

      // Simple triangle arrows using PathLayer
      const arrowShapes = arrows.map((d: any) => {
        const [x, y] = d.position;
        const angle = d.angle;
        const speed = d.speed;

        // Arrow size based on speed
        const size = 0.05 + (Math.min(speed / 20, 1) * 0.1);

        // Create arrow triangle pointing in wind direction
        const angleRad = angle * Math.PI / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        // Arrow points (triangle)
        const tip: [number, number] = [x + cos * size, y + sin * size];
        const left: [number, number] = [x - cos * size * 0.3 - sin * size * 0.4, y - sin * size * 0.3 + cos * size * 0.4];
        const right: [number, number] = [x - cos * size * 0.3 + sin * size * 0.4, y - sin * size * 0.3 - cos * size * 0.4];

        return {
          path: [tip, left, right, tip], // Close the triangle
          color: d.color,
          speed: d.speed
        };
      });

      const arrowPathLayer = new PathLayer({
        id: "wind-arrow-shapes",
        data: arrowShapes,
        dataComparator: (newData, oldData) => newData === oldData,

        getPath: (d: any) => d.path,
        getColor: (d: any) => {
          const [r, g, b] = d.color;
          return [r, g, b, 230];
        },

        widthMinPixels: 3,
        widthMaxPixels: 5,
        filled: true,
        opacity: 0.95,

        fp64: false,
        autoHighlight: false,

        updateTriggers: {
          getPath: dataVersion,
          getColor: dataVersion
        }
      });

      // Update layers (render order: halo -> glow -> trails -> core -> arrows -> heads)
      setLayers([haloLayer, glowLayer, trailLayer, coreLayer, arrowPathLayer, headLayer]);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [windData, showParticles]);

  // Use free MapLibre styles (no token required)
  const mapStyle =
    theme === "dark"
      ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

  return (
    <div className="wind-heatmap-container">
      <div className="wind-heatmap-header">
        <h2>France Wind Heatmap</h2>
        <div className="wind-heatmap-controls">
          <button onClick={loadWindData} disabled={loading}>
            {loading ? "Loading..." : "Refresh Data"}
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
            {new Date(windData.timestamp).toLocaleString()} | Resolution:{" "}
            {windData.resolution}° | Points: {windData.points.length}
          </p>
          {windData.note && (
            <p style={{ fontSize: "0.9em", opacity: 0.8 }}>{windData.note}</p>
          )}
        </div>
      )}

      <div className="wind-heatmap-legend">
        <div className="legend-title">Wind Speed (m/s)</div>
        <div className="legend-gradient">
          <div className="legend-labels">
            <span>0</span>
            <span>5</span>
            <span>10</span>
            <span>15</span>
            <span>20+</span>
          </div>
        </div>
      </div>

      <div className="wind-map-wrapper">
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: location?.lon ?? 15, // Centre de l'Europe
            latitude: location?.lat ?? 50, // Centre de l'Europe
            zoom: location ? 8 : 3.5, // Zoom out pour voir toute l'Europe
          }}
          style={{ width: "100%", height: "600px" }}
          mapStyle={mapStyle}
        >
          <DeckGLOverlay layers={layers} />
          <NavigationControl position="top-right" />
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
            rgb(50, 136, 189),
            rgb(102, 194, 165),
            rgb(254, 224, 139),
            rgb(244, 109, 67),
            rgb(213, 62, 79)
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
