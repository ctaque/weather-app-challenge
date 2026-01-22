import React, {
  useEffect,
  useRef,
  useState,
  useContext,
  useMemo,
  useCallback,
} from "react";
import { Map as MapGL, NavigationControl } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { ThemeContext, LanguageContext } from "../App";
import type { WindDataPoint } from "../utils/windParticlesCanvas";
import { WindParticlesCanvas } from "../utils/windParticlesCanvas";
import { WindHeatmapCanvas as WindHeatmapRenderer } from "../utils/windHeatmapCanvas";
import type { PrecipitationDataPoint } from "../utils/precipitationHeatmapCanvas";
import { PrecipitationHeatmapCanvas } from "../utils/precipitationHeatmapCanvas";

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

type DisplayMode = "wind" | "precipitation";

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

interface WindIndex {
  index: number;
  timestamp: string;
  dataPoints: number;
  dataTime?: string;
  hoursBack?: number;
  forecastOffset?: number;
  runAge?: number;
}

interface WindHeatmapProps {
  location?: Location;
}

/**
 * Round time up to the next full hour
 * Example: 9h38 -> 10h00, 9h25 -> 10h00
 */
function roundToNextHour(date: Date): Date {
  const rounded = new Date(date);
  // If there are any minutes or seconds, round up to next hour
  if (
    rounded.getMinutes() > 0 ||
    rounded.getSeconds() > 0 ||
    rounded.getMilliseconds() > 0
  ) {
    rounded.setHours(rounded.getHours() + 1);
  }
  rounded.setMinutes(0, 0, 0);
  return rounded;
}

export default function WindHeatmap({ location }: WindHeatmapProps) {
  const [windData, setWindData] = useState<WindData | null>(null);
  const [precipData, setPrecipData] = useState<PrecipitationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("wind");
  const [showParticles, setShowParticles] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [availableIndices, setAvailableIndices] = useState<WindIndex[]>([]);
  const [availablePrecipIndices, setAvailablePrecipIndices] = useState<
    WindIndex[]
  >([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedPrecipIndex, setSelectedPrecipIndex] = useState<number | null>(
    null,
  );
  const [isPlaying, setIsPlaying] = useState(true);
  const [cacheSize, setCacheSize] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const hasPreloadedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef>(null);
  const heatmapCanvasRef = useRef<HTMLCanvasElement>(null);
  const particlesCanvasRef = useRef<HTMLCanvasElement>(null);
  const precipitationCanvasRef = useRef<HTMLCanvasElement>(null);
  const heatmapSystemRef = useRef<WindHeatmapRenderer | null>(null);
  const particleSystemRef = useRef<WindParticlesCanvas | null>(null);
  const precipitationSystemRef = useRef<PrecipitationHeatmapCanvas | null>(
    null,
  );
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dataCache = useRef<Map<number, WindData>>(new Map());
  const precipCache = useRef<Map<number, PrecipitationData>>(new Map());
  const theme = useContext(ThemeContext);
  const { t } = useContext(LanguageContext);

  // Load available wind indices on mount
  const loadAvailableIndices = useCallback(async () => {
    try {
      const response = await fetch("/api/wind-indices");
      if (!response.ok) throw new Error("Failed to fetch wind indices");
      const data = await response.json();

      const reversedIndices = [...data.indices].reverse();
      setAvailableIndices(reversedIndices);

      // Select the latest index by default (now first in reversed array)
      if (reversedIndices.length > 0) {
        const latestIndex = reversedIndices[0].index;
        setSelectedIndex(latestIndex);
      }
    } catch (err: any) {
      console.error("Failed to load wind indices:", err);
      setError(err.message || "Failed to load wind indices");
    }
  }, []);

  // Load available precipitation indices
  const loadAvailablePrecipIndices = useCallback(async () => {
    try {
      const response = await fetch("/api/precipitation-indices");
      if (!response.ok)
        throw new Error("Failed to fetch precipitation indices");
      const data = await response.json();

      const reversedIndices = [...data.indices].reverse();
      setAvailablePrecipIndices(reversedIndices);

      // Select the latest index by default (now first in reversed array)
      if (reversedIndices.length > 0) {
        const latestIndex = reversedIndices[0].index;
        setSelectedPrecipIndex(latestIndex);
      }
    } catch (err: any) {
      console.error("Failed to load precipitation indices:", err);
      setError(err.message || "Failed to load precipitation indices");
    }
  }, []);

  const loadWindData = useCallback(async (index?: number) => {
    // Check cache first if we have an index
    if (index !== undefined && dataCache.current.has(index)) {
      const cachedData = dataCache.current.get(index)!;
      setWindData(cachedData);
      console.log(`✨ Using cached data for index ${index}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url =
        index !== undefined ? `/api/wind-global/${index}` : "/api/wind-global";

      console.log(`📡 Fetching data from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch wind data");
      const data: WindData = await response.json();

      // Store in cache if we have an index
      if (index !== undefined) {
        dataCache.current.set(index, data);

        // Limit cache size to prevent memory issues (keep last 10 entries)
        if (dataCache.current.size > 10) {
          const firstKey = dataCache.current.keys().next().value;
          dataCache.current.delete(firstKey);
          console.log(`🗑️ Removed oldest cache entry (index ${firstKey})`);
        }

        setCacheSize(dataCache.current.size);
        console.log(
          `💾 Cached data for index ${index} (cache size: ${dataCache.current.size})`,
        );
      }

      setWindData(data);

      // Particle system will be initialized automatically by useEffect when windData changes
    } catch (err: any) {
      console.error("Failed to load wind data:", err);
      setError(err.message || "Failed to load wind data");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPrecipData = useCallback(async (index?: number) => {
    // Check cache first if we have an index
    if (index !== undefined && precipCache.current.has(index)) {
      const cachedData = precipCache.current.get(index)!;
      setPrecipData(cachedData);
      console.log(`✨ Using cached precipitation data for index ${index}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url =
        index !== undefined
          ? `/api/precipitation-global/${index}`
          : "/api/precipitation-global";

      console.log(`📡 Fetching precipitation data from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch precipitation data");
      const data: PrecipitationData = await response.json();

      // Store in cache if we have an index
      if (index !== undefined) {
        precipCache.current.set(index, data);

        // Limit cache size to prevent memory issues (keep last 10 entries)
        if (precipCache.current.size > 10) {
          const firstKey = precipCache.current.keys().next().value;
          precipCache.current.delete(firstKey);
          console.log(
            `🗑️ Removed oldest precipitation cache entry (index ${firstKey})`,
          );
        }

        setCacheSize(precipCache.current.size);
        console.log(
          `💾 Cached precipitation data for index ${index} (cache size: ${precipCache.current.size})`,
        );
      }

      setPrecipData(data);
    } catch (err: any) {
      console.error("Failed to load precipitation data:", err);
      setError(err.message || "Failed to load precipitation data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Memoize slider change handler
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setIsPlaying(false); // Pause when user manually changes slider
      const position = parseInt(e.target.value, 10);
      console.log(availableIndices[position]);

      if (displayMode === "wind") {
        const newIndex = availableIndices[position]?.index;
        if (newIndex !== undefined) {
          setSelectedIndex(newIndex);
        }
      } else {
        const newIndex = availablePrecipIndices[position]?.index;
        if (newIndex !== undefined) {
          setSelectedPrecipIndex(newIndex);
        }
      }
    },
    [availableIndices, availablePrecipIndices, displayMode],
  );

  // Memoize play/pause toggle
  const togglePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Error toggling fullscreen:", err);
    }
  }, []);

  // Refresh all indices
  const refreshAllIndices = useCallback(async () => {
    // Reset preload flag
    hasPreloadedRef.current = false;

    await loadAvailableIndices();
    await loadAvailablePrecipIndices();

    // Trigger preload will happen automatically via useEffect
  }, [loadAvailableIndices, loadAvailablePrecipIndices]);

  // Preload last 24h of data (8 occurrences every 3h) for both wind and precipitation
  const preloadLast24h = useCallback(async (windIndices: WindIndex[], precipIndices: WindIndex[]) => {
    if (windIndices.length === 0 || precipIndices.length === 0) {
      return;
    }

    console.log("🔄 Starting 24h data preload...");

    // Backend already returns only the last 8 indices
    const windIndicesToPreload = windIndices;
    const precipIndicesToPreload = precipIndices;

    const totalToPreload = windIndicesToPreload.length + precipIndicesToPreload.length;
    let loadedCount = 0;

    setPreloadProgress({ current: 0, total: totalToPreload });

    // Preload wind data
    for (const indexInfo of windIndicesToPreload) {
      if (!dataCache.current.has(indexInfo.index)) {
        try {
          const response = await fetch(`/api/wind-global/${indexInfo.index}`);
          if (response.ok) {
            const data: WindData = await response.json();
            dataCache.current.set(indexInfo.index, data);
            console.log(`✅ Preloaded wind data for index ${indexInfo.index} (${indexInfo.hoursBack}h ago)`);
          }
        } catch (err) {
          console.warn(`❌ Failed to preload wind index ${indexInfo.index}:`, err);
        }
      }
      loadedCount++;
      setPreloadProgress({ current: loadedCount, total: totalToPreload });
    }

    // Preload precipitation data
    for (const indexInfo of precipIndicesToPreload) {
      if (!precipCache.current.has(indexInfo.index)) {
        try {
          const response = await fetch(`/api/precipitation-global/${indexInfo.index}`);
          if (response.ok) {
            const data: PrecipitationData = await response.json();
            precipCache.current.set(indexInfo.index, data);
            console.log(`✅ Preloaded precipitation data for index ${indexInfo.index} (${indexInfo.hoursBack}h ago)`);
          }
        } catch (err) {
          console.warn(`❌ Failed to preload precipitation index ${indexInfo.index}:`, err);
        }
      }
      loadedCount++;
      setPreloadProgress({ current: loadedCount, total: totalToPreload });
    }

    setCacheSize(Math.max(dataCache.current.size, precipCache.current.size));
    setPreloadProgress(null);

    console.log(`✨ Preload complete! Wind cache: ${dataCache.current.size}, Precip cache: ${precipCache.current.size}`);
  }, []);

  // Preload adjacent data for smoother navigation
  const preloadAdjacentData = useCallback(
    async (currentIndex: number) => {
      const currentPos = availableIndices.findIndex(
        (item) => item.index === currentIndex,
      );
      if (currentPos === -1) return;

      // Preload next index
      if (currentPos < availableIndices.length - 1) {
        const nextIndex = availableIndices[currentPos + 1].index;
        if (!dataCache.current.has(nextIndex)) {
          try {
            const response = await fetch(`/api/wind-global/${nextIndex}`);
            if (response.ok) {
              const data: WindData = await response.json();
              dataCache.current.set(nextIndex, data);
              setCacheSize(dataCache.current.size);
              console.log(`🔮 Preloaded data for index ${nextIndex}`);
            }
          } catch (err) {
            console.warn(`Failed to preload index ${nextIndex}:`, err);
          }
        }
      }

      // Preload previous index
      if (currentPos > 0) {
        const prevIndex = availableIndices[currentPos - 1].index;
        if (!dataCache.current.has(prevIndex)) {
          try {
            const response = await fetch(`/api/wind-global/${prevIndex}`);
            if (response.ok) {
              const data: WindData = await response.json();
              dataCache.current.set(prevIndex, data);
              setCacheSize(dataCache.current.size);
              console.log(`🔮 Preloaded data for index ${prevIndex}`);
            }
          } catch (err) {
            console.warn(`Failed to preload index ${prevIndex}:`, err);
          }
        }
      }
    },
    [availableIndices],
  );

  // Computed values based on display mode
  const showParticlesLayer = displayMode === "wind" && showParticles;
  const showHeatmapLayer = displayMode === "wind" && showHeatmap;
  const showPrecipitation = displayMode === "precipitation";

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

  // Load available indices on mount
  useEffect(() => {
    loadAvailableIndices();
    loadAvailablePrecipIndices();
  }, [loadAvailableIndices, loadAvailablePrecipIndices]);

  // Preload last 24h of data when indices are available (only once)
  useEffect(() => {
    if (
      availableIndices.length > 0 &&
      availablePrecipIndices.length > 0 &&
      !hasPreloadedRef.current
    ) {
      hasPreloadedRef.current = true;
      // Small delay to let the UI render first
      const timer = setTimeout(() => {
        preloadLast24h(availableIndices, availablePrecipIndices);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [availableIndices, availablePrecipIndices, preloadLast24h]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Load initial precipitation data when precipitation index is available (to enable the button)
  useEffect(() => {
    if (selectedPrecipIndex !== null && !precipData) {
      loadPrecipData(selectedPrecipIndex);
    }
  }, [selectedPrecipIndex, precipData, loadPrecipData]);

  // Load wind data when selectedIndex changes
  useEffect(() => {
    if (selectedIndex !== null && displayMode === "wind") {
      loadWindData(selectedIndex);
      // Preload adjacent data in the background
      preloadAdjacentData(selectedIndex);
    }
  }, [selectedIndex, displayMode, loadWindData, preloadAdjacentData]);

  // Load precipitation data when selectedPrecipIndex changes and in precipitation mode
  useEffect(() => {
    if (selectedPrecipIndex !== null && displayMode === "precipitation") {
      loadPrecipData(selectedPrecipIndex);
    }
  }, [selectedPrecipIndex, displayMode, loadPrecipData]);

  // Auto-play animation
  useEffect(() => {
    const indices =
      displayMode === "wind" ? availableIndices : availablePrecipIndices;

    if (!isPlaying || indices.length === 0) {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      return;
    }

    // Advance to next index every 2 seconds
    playIntervalRef.current = setInterval(() => {
      if (displayMode === "wind") {
        setSelectedIndex((prevIndex) => {
          if (prevIndex === null) return indices[0]?.index ?? null;

          const currentIndexPosition = indices.findIndex(
            (item) => item.index === prevIndex,
          );

          // Loop back to start when reaching the end
          if (currentIndexPosition >= indices.length - 1) {
            return indices[0].index;
          }

          return indices[currentIndexPosition + 1].index;
        });
      } else {
        setSelectedPrecipIndex((prevIndex) => {
          if (prevIndex === null) return indices[0]?.index ?? null;

          const currentIndexPosition = indices.findIndex(
            (item) => item.index === prevIndex,
          );

          // Loop back to start when reaching the end
          if (currentIndexPosition >= indices.length - 1) {
            return indices[0].index;
          }

          return indices[currentIndexPosition + 1].index;
        });
      }
    }, 2000);

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    };
  }, [isPlaying, availableIndices, availablePrecipIndices, displayMode]);

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
    heatmapSystemRef.current = new WindHeatmapRenderer(
      heatmapCanvas,
      windData.points,
      initialBounds,
      0.5, // opacity
    );

    // Create particle system with global bounds
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

    // Set initial projection and bounds
    const projection = getProjection();
    heatmapSystemRef.current.setProjection(projection);
    particleSystemRef.current.setProjection(projection);

    // Set initial visible bounds for particle density calculation
    particleSystemRef.current.updateVisibleBounds(initialBounds);

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
        particleSystemRef.current.updateProjection(proj, visibleBounds);
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

  // Initialize precipitation system when precipitation data loads
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

    // Draw precipitation
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

  // Toggle heatmap visibility
  useEffect(() => {
    if (!heatmapSystemRef.current) return;

    if (showHeatmap) {
      heatmapSystemRef.current.draw();
    } else {
      heatmapSystemRef.current.clear();
    }
  }, [showHeatmap]);

  // Control particle and wind systems based on display mode
  useEffect(() => {
    if (displayMode === "wind") {
      // Start wind systems if they exist and should be shown
      if (particleSystemRef.current && showParticles) {
        particleSystemRef.current.start();
      }
      if (heatmapSystemRef.current && showHeatmap) {
        heatmapSystemRef.current.draw();
      }
    } else {
      // Stop wind systems when in precipitation mode
      if (particleSystemRef.current) {
        particleSystemRef.current.stop();
      }
      if (heatmapSystemRef.current) {
        heatmapSystemRef.current.clear();
      }
    }
  }, [displayMode, showParticles, showHeatmap]);

  // Control precipitation system visibility based on display mode
  useEffect(() => {
    if (!precipitationSystemRef.current) return;

    if (displayMode === "precipitation" && showPrecipitation) {
      precipitationSystemRef.current.draw();
    } else {
      precipitationSystemRef.current.clear();
    }
  }, [displayMode, showPrecipitation]);

  // Get current index info for display (memoized)
  const currentIndexInfo = useMemo(() => {
    if (displayMode === "wind") {
      return availableIndices.find((item) => item.index === selectedIndex);
    } else {
      return availablePrecipIndices.find(
        (item) => item.index === selectedPrecipIndex,
      );
    }
  }, [
    availableIndices,
    availablePrecipIndices,
    selectedIndex,
    selectedPrecipIndex,
    displayMode,
  ]);

  // Calculate hours back from now for the currently selected index
  const hoursBackFromNow = useMemo(() => {
    if (!currentIndexInfo || !currentIndexInfo?.dataTime) return 0;

    const dataTime = new Date(currentIndexInfo.dataTime).getTime();
    const now = Date.now();
    const hoursBack = Math.round((now - dataTime) / (1000 * 60 * 60));

    console.log(hoursBack);
    return hoursBack;
  }, [currentIndexInfo]);

  // Memoize map style to avoid unnecessary re-renders
  const mapStyle = useMemo(
    () =>
      theme === "dark"
        ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    [theme],
  );

  // Memoize slider value calculation
  const sliderValue = useMemo(() => {
    if (displayMode === "wind") {
      return availableIndices.findIndex((item) => item.index === selectedIndex);
    } else {
      return availablePrecipIndices.findIndex(
        (item) => item.index === selectedPrecipIndex,
      );
    }
  }, [
    availableIndices,
    availablePrecipIndices,
    selectedIndex,
    selectedPrecipIndex,
    displayMode,
  ]);

  // Get current indices list based on display mode
  const currentIndices = useMemo(() => {
    return displayMode === "wind" ? availableIndices : availablePrecipIndices;
  }, [displayMode, availableIndices, availablePrecipIndices]);

  // Calculate negative offset in hours based on dataTime field
  const sliderValues = useMemo(() => {
    if (currentIndices.length === 0) return [];

    // The last index (most recent) is the reference point (0 hours back)
    const latestIndex = currentIndices[currentIndices.length - 1];
    const latestTime = new Date(
      latestIndex.dataTime || latestIndex.timestamp,
    ).getTime();

    // Calculate hours back for each index
    return currentIndices.map((item) => {
      const itemTime = new Date(item.dataTime || item.timestamp).getTime();
      const hoursBack = Math.round((latestTime - itemTime) / (1000 * 60 * 60));
      return hoursBack;
    });
  }, [currentIndices]);

  return (
    <div className="wind-heatmap-container" ref={containerRef}>
      <div className="wind-heatmap-header">
        <h2>
          {displayMode === "wind" ? t.globalWindMap : t.globalPrecipitationMap}
        </h2>
        <div className="wind-heatmap-controls">
          <button onClick={refreshAllIndices} disabled={loading}>
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

          {displayMode === "wind" && (
            <>
              <button onClick={() => setShowParticles(!showParticles)}>
                {showParticles ? "Hide Particles" : "Show Particles"}
              </button>
              <button onClick={() => setShowHeatmap(!showHeatmap)}>
                {showHeatmap ? "Hide Heatmap" : "Show Heatmap"}
              </button>
            </>
          )}

          <button onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
            {isFullscreen ? "⮌" : "⛶"}
          </button>
        </div>
      </div>

      {error && (
        <div className="error" style={{ margin: "1rem 0" }}>
          Error: {error}
        </div>
      )}

      {preloadProgress && (
        <div className="preload-progress" style={{ margin: "1rem 0" }}>
          <div className="preload-progress-bar">
            <div
              className="preload-progress-fill"
              style={{
                width: `${(preloadProgress.current / preloadProgress.total) * 100}%`,
              }}
            />
          </div>
          <p style={{ fontSize: "0.9em", textAlign: "center", marginTop: "0.5rem" }}>
            {t.loading || "Chargement"} des données 24h... {preloadProgress.current}/{preloadProgress.total}
          </p>
        </div>
      )}

      {(windData || precipData) && (
        <div className="wind-heatmap-info">
          {displayMode === "wind" && windData && (
            <>
              <p>
                Source: {windData.source} | Updated:{" "}
                {new Date(windData.timestamp).toLocaleString()} | Resolution:{" "}
                {windData.resolution}° | Points: {windData.points.length}
              </p>
              {windData.note && (
                <p style={{ fontSize: "0.9em", opacity: 0.8 }}>
                  {windData.note}
                </p>
              )}
            </>
          )}
          {displayMode === "precipitation" && precipData && (
            <p>
              Source: {precipData.source} | Updated:{" "}
              {new Date(precipData.timestamp).toLocaleString()} | Resolution:{" "}
              {precipData.resolution}° | Points: {precipData.points.length} |
              Unit: {precipData.unit}
            </p>
          )}
        </div>
      )}

      <div className="wind-map-wrapper">
        <MapGL
          ref={mapRef}
          initialViewState={{
            longitude: location?.lon ?? 15, // Centre de l'Europe
            latitude: location?.lat ?? 50, // Centre de l'Europe
            zoom: location ? 8 : 3.5, // Zoom out pour voir toute l'Europe
          }}
          style={{ width: "100%", height: "600px" }}
          mapStyle={mapStyle}
        >
          <NavigationControl position="top-right" />
        </MapGL>

        {/* Canvas overlay for wind heatmap (bottom layer) */}
        <canvas
          ref={heatmapCanvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            zIndex: 1,
            display: displayMode === "wind" ? "block" : "none",
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
            zIndex: 2,
            display: displayMode === "wind" ? "block" : "none",
          }}
        />

        {/* Canvas overlay for precipitation */}
        <canvas
          ref={precipitationCanvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            zIndex: 3,
            display: displayMode === "precipitation" ? "block" : "none",
          }}
        />
      </div>

      <div className="wind-heatmap-legend">
        <div className="legend-title">
          {displayMode === "wind" ? "Wind Speed (m/s)" : "Precipitation (mm/h)"}
        </div>
        <div
          className="legend-gradient"
          style={{
            background:
              displayMode === "wind"
                ? "linear-gradient(to right, rgb(50, 136, 189), rgb(102, 194, 165), rgb(254, 224, 139), rgb(244, 109, 67), rgb(213, 62, 79))"
                : "linear-gradient(to right, rgb(240, 249, 255), rgb(186, 225, 255), rgb(97, 174, 238), rgb(33, 102, 172), rgb(0, 60, 130))",
          }}
        >
          <div className="legend-labels">
            {displayMode === "wind" ? (
              <>
                <span>0</span>
                <span>5</span>
                <span>10</span>
                <span>15</span>
                <span>20+</span>
              </>
            ) : (
              <>
                <span>0</span>
                <span>2.5</span>
                <span>5</span>
                <span>10</span>
                <span>20+</span>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Timeline slider - Below the map */}
      {currentIndices.length > 0 && (
        <div className="wind-timeline-container">
          <div className="timeline-main-row">
            <button
              className="timeline-button"
              onClick={togglePlayPause}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>

            <div className="timeline-slider-wrapper">
              <div className="timeline-info">
                {currentIndexInfo && (
                  <>
                    <span className="timeline-timestamp">
                      {hoursBackFromNow === 0
                        ? "Maintenant"
                        : `-${hoursBackFromNow}h`}
                    </span>
                    <span className="timeline-date">
                      {new Date(
                        currentIndexInfo.dataTime || currentIndexInfo.timestamp,
                      ).toLocaleDateString()}
                    </span>
                  </>
                )}
              </div>

              <div className="timeline-slider-container">
                <input
                  type="range"
                  min="0"
                  max={currentIndices.length - 1}
                  value={sliderValue}
                  onChange={handleSliderChange}
                  className="timeline-slider"
                />
                <div className="timeline-ticks">
                  {currentIndices.map((item) => (
                    <div key={item.index} className="timeline-tick" />
                  ))}
                </div>
              </div>

              <div className="timeline-labels">
                <span>&nbsp;</span>
                <span>{t["timeline"]["now"]}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .wind-heatmap-container {
          margin: .2rem 0;
        }

        .preload-progress {
          background: var(--card-bg);
          padding: 1rem;
          border-radius: 8px;
        }

        .preload-progress-bar {
          width: 100%;
          height: 8px;
          background: rgba(128, 128, 128, 0.2);
          border-radius: 4px;
          overflow: hidden;
        }

        .preload-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent), var(--accent-600));
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .wind-heatmap-container:fullscreen {
          background: var(--background);
          padding: 1rem;
          overflow-y: auto;
        }

        .wind-heatmap-container:fullscreen .wind-map-wrapper {
          height: calc(100vh - 300px) !important;
        }

        .wind-heatmap-container:fullscreen .maplibregl-map {
          height: 100% !important;
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
          align-items: center;
        }

        .wind-heatmap-controls > button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.06);
          background: var(--card);
          color: var(--text);
          font-family: inherit;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 2px 6px var(--card-shadow);
          transition:
            transform 120ms ease,
            box-shadow 120ms ease,
            background 160ms ease;
        }

        .wind-heatmap-controls > button:hover:not(:disabled) {
          background: var(--card-hover);
          transform: translateY(-1px);
          box-shadow: 0 4px 8px var(--card-shadow);
        }

        .wind-heatmap-controls > button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .button-group {
          display: inline-flex;
          gap: 0.5rem;
        }

        .button-group button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.06);
          background: var(--card);
          color: var(--text);
          font-family: inherit;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 2px 6px var(--card-shadow);
          transition:
            transform 120ms ease,
            box-shadow 120ms ease,
            background 160ms ease;
        }

        .button-group button.active {
          background: linear-gradient(180deg, var(--accent), var(--accent-600));
          color: #fff;
          transform: translateY(-3px);
          border: 2px solid var(--selection-border);
        }

        .button-group button:not(.active):hover:not(:disabled) {
          background: var(--card-hover);
          transform: translateY(-1px);
          box-shadow: 0 4px 8px var(--card-shadow);
        }

        .button-group button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
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

        /* Timeline controls */
        .wind-timeline-container {
          background: var(--card-bg);
          padding: 1rem;
          border-radius: 8px;
          margin-top: 1rem;
        }

        .timeline-main-row {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .timeline-button {
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 2px solid var(--primary-color);
          background: var(--primary-color);
          color: white;
          font-size: 1.3rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          padding: 0;
        }

        .timeline-button:hover {
          transform: scale(1.1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .timeline-button:active {
          transform: scale(0.95);
        }

        .timeline-slider-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .timeline-info {
          display: flex;
          align-items: baseline;
          gap: 0.75rem;
        }

        .timeline-timestamp {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--primary-color);
        }

        .timeline-date {
          font-size: 0.85rem;
          opacity: 0.7;
        }

        .timeline-slider-container {
          position: relative;
          padding: 0.5rem 0;
        }

        .timeline-slider {
          width: 100%;
          height: 8px;
          border-radius: 4px;
          outline: none;
          -webkit-appearance: none;
          background: linear-gradient(
            to right,
            var(--primary-color) 0%,
            var(--primary-color) var(--value, 0%),
            rgba(128, 128, 128, 0.3) var(--value, 0%),
            rgba(128, 128, 128, 0.3) 100%
          );
          cursor: pointer;
        }

        .timeline-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--primary-color);
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: transform 0.2s;
        }

        .timeline-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        .timeline-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--primary-color);
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: transform 0.2s;
        }

        .timeline-slider::-moz-range-thumb:hover {
          transform: scale(1.2);
        }

        .timeline-ticks {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          transform: translateY(-50%);
          display: flex;
          justify-content: space-between;
          pointer-events: none;
          padding: 0 10px;
        }

        .timeline-tick {
          width: 2px;
          height: 12px;
          background: rgba(128, 128, 128, 0.4);
          border-radius: 1px;
        }

        .timeline-cursor-value {
          position: absolute;
          bottom: -28px;
          transform: translateX(-50%);
          background: var(--accent);
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          white-space: nowrap;
          pointer-events: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          z-index: 10;
        }

        .timeline-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 0.5rem;
          font-size: 0.85rem;
          opacity: 0.7;
        }

        .timeline-current-value {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-top: 1rem;
          padding: 0.5rem;
          background: var(--card);
          border-radius: 8px;
          border: 2px solid var(--accent);
          box-shadow: 0 2px 6px var(--card-shadow);
        }

        .timeline-current-time {
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--accent);
          margin-bottom: 0.25rem;
        }

        .timeline-current-date {
          font-size: 0.85rem;
          opacity: 0.7;
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
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
}
