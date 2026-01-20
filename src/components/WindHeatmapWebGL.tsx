import React, { useEffect, useRef, useState, useContext } from "react";
import Map, { NavigationControl, useControl } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { ThemeContext } from "../App";
import { TripsLayer } from "@deck.gl/geo-layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { MapboxOverlayProps } from "@deck.gl/mapbox";
import type { WindDataPoint } from "../utils/windParticles";

// Wrapper component for DeckGL overlay
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
  lat: number;
  lon: number;
}

interface WindHeatmapProps {
  location?: Location;
}

export default function WindHeatmapWebGL({ location }: WindHeatmapProps) {
  const [windData, setWindData] = useState<WindData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showParticles, setShowParticles] = useState(true);
  const [layers, setLayers] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const mapRef = useRef<MapRef>(null);
  const particlesRef = useRef<any[]>([]);
  const animationRef = useRef<number>();
  const theme = useContext(ThemeContext);

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

      // Initialize particle trails
      if (data.points && data.points.length > 0) {
        initializeParticles(data.points);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load wind data");
    } finally {
      setLoading(false);
    }
  }

  function initializeParticles(windPoints: WindDataPoint[]) {
    const bounds = {
      minLat: 41,
      maxLat: 52,
      minLon: -5,
      maxLon: 10
    };

    const particleCount = 8000;
    const trailLength = 1500;
    const particles: any[] = [];

    // Create particles with pre-computed trails
    for (let i = 0; i < particleCount; i++) {
      const startX = bounds.minLon + Math.random() * (bounds.maxLon - bounds.minLon);
      const startY = bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat);

      // Simulate trail path based on wind field
      const path: [number, number, number][] = [[startX, startY, 0]];
      let x = startX;
      let y = startY;

      for (let t = 1; t < trailLength; t++) {
        // Find closest wind point
        const wind = interpolateWind(x, y, windPoints, bounds);

        if (!wind) break;

        // Move particle
        const speedMultiplier = 0.001;
        const turbulence = Math.sin(t * 0.05 + i) * 0.00005;

        x += (wind.u * speedMultiplier + turbulence);
        y += (wind.v * speedMultiplier - turbulence * 0.5);

        // Check bounds
        if (x < bounds.minLon || x > bounds.maxLon || y < bounds.minLat || y > bounds.maxLat) {
          break;
        }

        path.push([x, y, t]); // t is the timestamp
      }

      // Assign color based on average speed
      const avgSpeed = wind?.speed || 5;
      let color: [number, number, number];
      if (avgSpeed < 5) color = [50, 136, 189];
      else if (avgSpeed < 10) color = [102, 194, 165];
      else if (avgSpeed < 15) color = [254, 224, 139];
      else if (avgSpeed < 20) color = [244, 109, 67];
      else color = [213, 62, 79];

      particles.push({
        path,
        timestamps: path.map(p => p[2]),
        color,
        speed: avgSpeed
      });
    }

    particlesRef.current = particles;
    startAnimation();
  }

  function interpolateWind(lon: number, lat: number, windData: WindDataPoint[], bounds: any) {
    let closestPoint: WindDataPoint | null = null;
    let minDistance = Infinity;

    for (const point of windData) {
      const distance = Math.sqrt(
        Math.pow(point.lat - lat, 2) + Math.pow(point.lon - lon, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    }

    if (!closestPoint || minDistance > 1.0) {
      return null;
    }

    return closestPoint;
  }

  function startAnimation() {
    let time = 0;
    const loopLength = 1500; // Match trail length
    const animationSpeed = 2; // Frames per update

    const animate = () => {
      if (!showParticles) {
        setLayers([]);
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      time = (time + animationSpeed) % loopLength;
      setCurrentTime(time);

      // Create TripsLayer with current time
      const tripsLayer = new TripsLayer({
        id: 'wind-trips',
        data: particlesRef.current,
        getPath: (d: any) => d.path,
        getTimestamps: (d: any) => d.timestamps,
        getColor: (d: any) => [...d.color, 200],
        opacity: 0.8,
        widthMinPixels: 2,
        rounded: true,
        trailLength: 800, // How much of trail to show
        currentTime: time,
        shadowEnabled: false
      });

      setLayers([tripsLayer]);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  }

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const mapStyle =
    theme === "dark"
      ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

  return (
    <div className="wind-heatmap-container">
      <div className="wind-heatmap-header">
        <h2>France Wind Map (WebGL Optimized)</h2>
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
            {new Date(windData.timestamp).toLocaleString()} | Points: {windData.points.length}
          </p>
        </div>
      )}

      <div className="wind-map-wrapper">
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: location?.lon ?? 2.5,
            latitude: location?.lat ?? 46.5,
            zoom: location ? 8 : 5.5,
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

        .wind-map-wrapper {
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
}
