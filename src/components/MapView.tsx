import React, {
  useContext,
  useMemo,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { Map, Marker, Source, Layer } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { LanguageContext, ThemeContext } from "../App";
import SidePanel from "./SidePanel";
import ElevationProfile from "./ElevationProfile";
import arrowIconBlack from "../assets/arrow-icon.png";
import arrowIconWhite from "../assets/arrow-icon-white.png";

interface Location {
  lat: number;
  lon: number;
  display_name: string;
}

interface Waypoint {
  id: string;
  lat: number;
  lon: number;
}

export default function MapView() {
  const initialViewState = {
    longitude: 2.3522,
    latitude: 48.8566,
    zoom: 6,
    bearing: 0,
    pitch: 0,
  };

  const [viewState, setViewState] = useState(initialViewState);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [startPoint, setStartPoint] = useState<Location | null>(null);
  const [endPoint, setEndPoint] = useState<Location | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [routeGeometry, setRouteGeometry] = useState<any>(null);
  const [routeInfo, setRouteInfo] = useState<{
    distance: number;
    duration: number;
    elevationGain?: number;
    elevationLoss?: number;
  } | null>(null);
  const [routeSegments, setRouteSegments] = useState<Array<{
    type: string;
    distance: number;
    name: string;
  }> | null>(null);
  const [elevationData, setElevationData] = useState<Array<{
    distance: number;
    elevation: number;
  }> | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    lat: number;
    lon: number;
  } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isHoveringRoute, setIsHoveringRoute] = useState(false);
  const [isDraggingNewWaypoint, setIsDraggingNewWaypoint] = useState<
    string | null
  >(null);
  const [selectedWaypoint, setSelectedWaypoint] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);
  const [isDraggingMarker, setIsDraggingMarker] = useState(false);
  const [arrowPoints, setArrowPoints] = useState<any>(null);
  const [transportMode, setTransportMode] = useState<"car" | "bike" | "foot">(
    "car",
  );
  const mapRef = useRef<MapRef>(null);
  const lastRouteCalculationRef = useRef<number>(0);
  const routeCalculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationProgressRef = useRef<number>(0);
  const theme = React.useContext(ThemeContext);

  const { t } = useContext(LanguageContext);

  const mapStyle = useMemo(
    () =>
      theme === "dark"
        ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    [theme],
  );

  // Charger l'itinéraire sauvegardé au démarrage
  useEffect(() => {
    try {
      const savedRoute = localStorage.getItem("saved-route");
      if (savedRoute) {
        const parsed = JSON.parse(savedRoute);
        // Charger tous les points en même temps
        if (parsed.startPoint) setStartPoint(parsed.startPoint);
        if (parsed.endPoint) setEndPoint(parsed.endPoint);
        if (parsed.waypoints && Array.isArray(parsed.waypoints)) {
          setWaypoints(parsed.waypoints);
        }
        if (parsed.transportMode) {
          setTransportMode(parsed.transportMode);
        }
        console.log("Itinéraire chargé depuis localStorage:", {
          startPoint: parsed.startPoint,
          endPoint: parsed.endPoint,
          waypointsCount: parsed.waypoints?.length || 0,
        });
      }
    } catch (error) {
      console.error("Erreur lors du chargement de l'itinéraire:", error);
    }
  }, []);

  // Sauvegarder l'itinéraire à chaque modification
  useEffect(() => {
    // Si au moins un point existe, sauvegarder
    if (startPoint || endPoint || waypoints.length > 0) {
      try {
        const routeData = {
          startPoint,
          endPoint,
          waypoints,
          transportMode,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem("saved-route", JSON.stringify(routeData));
        console.log("Itinéraire sauvegardé:", {
          hasStart: !!startPoint,
          hasEnd: !!endPoint,
          waypointsCount: waypoints.length,
        });
      } catch (error) {
        console.error("Erreur lors de la sauvegarde de l'itinéraire:", error);
      }
    } else {
      // Si tous les points sont supprimés, nettoyer le localStorage
      localStorage.removeItem("saved-route");
      console.log("Itinéraire supprimé du localStorage");
    }
  }, [startPoint, endPoint, waypoints, transportMode]);

  // Centrer la carte sur la position actuelle au chargement
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setViewState({
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
            zoom: 12,
            bearing: 0,
            pitch: 0,
          });
        },
        (error) => {
          console.log(
            "Géolocalisation non disponible, utilisation de la position par défaut",
          );
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 60000,
        },
      );
    }
  }, []);

  // Charger l'icône de flèche SVG dans la map
  useEffect(() => {
    (async () => {
      if (!mapRef.current) return;
      const map = mapRef.current.getMap();

      const loadImages = async () => {
        try {
          const imageBlack = await map.loadImage(arrowIconBlack);
          const imageLight = await map.loadImage(arrowIconWhite);

          if (map.hasImage("arrow-icon")) {
            map.removeImage("arrow-icon");
          }
          if (map.hasImage("arrow-icon-white")) {
            map.removeImage("arrow-icon-white");
          }

          map.addImage("arrow-icon", imageBlack.data);
          map.addImage("arrow-icon-white", imageLight.data);

          console.log("Images de flèches chargées");
          setIsArrowIconLoaded(true);
        } catch (error) {
          console.error("Erreur chargement des flèches:", error);
          setIsArrowIconLoaded(false);
        }
      };

      if (map.loaded()) {
        await loadImages();
      } else {
        map.once("load", loadImages);
      }
    })();
  }, [theme]);

  const recenterMap = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setViewState({
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
            zoom: 12,
            bearing: 0,
            pitch: 0,
          });
        },
        (error) => {
          console.error("Erreur de géolocalisation:", error);
          // En cas d'erreur ou de refus, revenir à la position par défaut
          setViewState(initialViewState);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        },
      );
    } else {
      // Si la géolocalisation n'est pas disponible, revenir à la position par défaut
      setViewState(initialViewState);
    }
  };

  const resetNorth = () => {
    setViewState((prev) => ({ ...prev, bearing: 0, pitch: 0 }));
  };

  const handleMapContextMenu = useCallback((event: any) => {
    event.preventDefault();
    const { lngLat } = event;
    setContextMenu({
      x: event.point.x,
      y: event.point.y,
      lat: lngLat.lat,
      lon: lngLat.lng,
    });
  }, []);

  const setPointFromMap = async (
    lat: number,
    lon: number,
    type: "start" | "end",
  ) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      );
      const data = await response.json();
      const location: Location = {
        lat,
        lon,
        display_name:
          data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      };

      if (type === "start") {
        setStartPoint(location);
      } else {
        setEndPoint(location);
      }
    } catch (error) {
      console.error("Erreur de géocodage inverse:", error);
      const location: Location = {
        lat,
        lon,
        display_name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      };
      if (type === "start") {
        setStartPoint(location);
      } else {
        setEndPoint(location);
      }
    }
    setContextMenu(null);
  };

  const calculateRoute = async (shouldZoom: boolean = true) => {
    if (!startPoint || !endPoint) return;

    setIsCalculating(true);
    try {
      // Le mode de transport correspond déjà aux profils GraphHopper
      const profile = transportMode;

      // Construire les points pour GraphHopper
      const points = [
        [startPoint.lat, startPoint.lon],
        ...waypoints.map((wp) => [wp.lat, wp.lon]),
        [endPoint.lat, endPoint.lon],
      ];

      // Construire l'URL GraphHopper
      const pointsParams = points.map((p) => `point=${p[0]},${p[1]}`).join("&");
      const apiKey = import.meta.env.VITE_GRAPHHOPPER_TOKEN || "";
      const keyParam = apiKey ? `&key=${apiKey}` : "";
      const url = `https://graphhopper.com/api/1/route?${pointsParams}&profile=${profile}&locale=fr&points_encoded=false&instructions=true&details=road_class&elevation=true${keyParam}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.paths && data.paths.length > 0) {
        const path = data.paths[0];

        // Convertir le format GraphHopper en GeoJSON
        const geometry = {
          type: "LineString",
          coordinates: path.points.coordinates, // GraphHopper retourne [lon, lat]
        };

        // Calculer le dénivelé positif et négatif et préparer les données pour le graphique
        let elevationGain = 0;
        let elevationLoss = 0;
        const coords = path.points.coordinates;
        const elevationPoints: Array<{ distance: number; elevation: number }> =
          [];
        let cumulativeDistance = 0;

        for (let i = 0; i < coords.length; i++) {
          const elevation = coords[i][2] || 0;

          // Calculer la distance cumulée
          if (i > 0) {
            const prevCoord = coords[i - 1];
            const currCoord = coords[i];

            // Formule de Haversine pour calculer la distance entre deux points
            const R = 6371000; // Rayon de la Terre en mètres
            const lat1 = (prevCoord[1] * Math.PI) / 180;
            const lat2 = (currCoord[1] * Math.PI) / 180;
            const deltaLat = ((currCoord[1] - prevCoord[1]) * Math.PI) / 180;
            const deltaLon = ((currCoord[0] - prevCoord[0]) * Math.PI) / 180;

            const a =
              Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) *
              Math.cos(lat2) *
              Math.sin(deltaLon / 2) *
              Math.sin(deltaLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const segmentDistance = R * c;

            cumulativeDistance += segmentDistance;

            // Calculer le dénivelé
            const prevElevation = coords[i - 1][2] || 0;
            const currElevation = elevation;
            const diff = currElevation - prevElevation;

            if (diff > 0) {
              elevationGain += diff;
            } else {
              elevationLoss += Math.abs(diff);
            }
          }

          elevationPoints.push({
            distance: cumulativeDistance,
            elevation: elevation,
          });
        }

        setRouteGeometry(geometry);
        setRouteInfo({
          distance: path.distance,
          duration: path.time / 1000, // GraphHopper retourne en millisecondes
          elevationGain: Math.round(elevationGain),
          elevationLoss: Math.round(elevationLoss),
        });
        setElevationData(elevationPoints);

        // Extraire les informations sur les segments avec les instructions GraphHopper
        const segments: Array<{
          type: string;
          distance: number;
          name: string;
        }> = [];

        path.instructions?.forEach((instruction: any) => {
          if (instruction.distance > 0) {
            // Déterminer le type de surface/terrain
            let surfaceType = "paved"; // Par défaut : route goudronnée
            const name = instruction.street_name || instruction.text || "";

            // GraphHopper fournit des détails de road_class
            const roadClass = instruction.road_class || "";

            // Analyse basée sur road_class de GraphHopper
            if (roadClass === "motorway") {
              surfaceType = "autoroute";
            } else if (roadClass === "trunk" || roadClass === "primary") {
              surfaceType = "nationale";
            } else if (roadClass === "secondary" || roadClass === "tertiary") {
              surfaceType = "departementale";
            } else if (
              roadClass === "residential" ||
              roadClass === "living_street"
            ) {
              surfaceType = "urbain";
            } else if (roadClass === "service") {
              surfaceType = "service";
            } else if (roadClass === "track") {
              surfaceType = "chemin";
            } else if (roadClass === "path" || roadClass === "footway") {
              surfaceType = "chemin";
            } else if (roadClass === "cycleway") {
              surfaceType = "cyclable";
            }

            // Analyse du nom pour affiner
            if (name.match(/chemin|sentier|path|track|footway/i)) {
              surfaceType = "chemin";
            } else if (name.match(/piste cyclable|cycleway|bike|vélo/i)) {
              surfaceType = "cyclable";
            } else if (name.match(/gravel|gravelle|terre|dirt|unpaved/i)) {
              surfaceType = "gravel";
            } else if (name.match(/autoroute|A\d+|highway|motorway/i)) {
              surfaceType = "autoroute";
            } else if (name.match(/nationale|N\d+|primary/i)) {
              surfaceType = "nationale";
            } else if (name.match(/départementale|D\d+|secondary|tertiary/i)) {
              surfaceType = "departementale";
            } else if (
              name.match(/rue|avenue|boulevard|residential|living_street/i)
            ) {
              surfaceType = "urbain";
            } else if (name.match(/service|parking|driveway/i)) {
              surfaceType = "service";
            }

            segments.push({
              type: surfaceType,
              distance: instruction.distance,
              name: name || "Sans nom",
            });
          }
        });

        setRouteSegments(segments);
        console.log("Segments de route avec surfaces:", segments);

        // Zoom sur l'itinéraire seulement si demandé
        if (shouldZoom && mapRef.current) {
          const coords = path.points.coordinates;
          const bounds = coords.reduce(
            (bounds: any, coord: number[]) => {
              return [
                [
                  Math.min(bounds[0][0], coord[0]),
                  Math.min(bounds[0][1], coord[1]),
                ],
                [
                  Math.max(bounds[1][0], coord[0]),
                  Math.max(bounds[1][1], coord[1]),
                ],
              ];
            },
            [
              [coords[0][0], coords[0][1]],
              [coords[0][0], coords[0][1]],
            ],
          );

          mapRef.current.fitBounds(bounds as any, {
            padding: 50,
            duration: 1000,
          });
        }
      }
    } catch (error) {
      console.error("Erreur de calcul d'itinéraire:", error);
    } finally {
      setIsCalculating(false);
    }
  };

  // Fonction de calcul avec throttling pour le drag en temps réel
  const calculateRouteThrottled = useCallback(() => {
    const now = Date.now();
    const timeSinceLastCalculation = now - lastRouteCalculationRef.current;

    // Annuler le timeout précédent s'il existe
    if (routeCalculationTimeoutRef.current) {
      clearTimeout(routeCalculationTimeoutRef.current);
    }

    // Si plus de 250ms depuis le dernier calcul, calculer immédiatement
    if (timeSinceLastCalculation >= 250) {
      lastRouteCalculationRef.current = now;
      calculateRoute(false);
    } else {
      // Sinon, programmer un calcul après le délai restant
      const remainingTime = 250 - timeSinceLastCalculation;
      routeCalculationTimeoutRef.current = setTimeout(() => {
        lastRouteCalculationRef.current = Date.now();
        calculateRoute(false);
      }, remainingTime);
    }
  }, [startPoint, endPoint, waypoints]);

  // Calculer des points le long de la ligne pour les flèches animées
  const calculateArrowPoints = useCallback(
    (geometry: any, numArrows: number, offset: number) => {
      if (!geometry || !geometry.coordinates) return null;

      const coords = geometry.coordinates;
      if (coords.length < 2) return null;

      // Calculer la longueur totale de la ligne
      let totalLength = 0;
      const segments: { start: number[]; end: number[]; length: number }[] = [];

      for (let i = 0; i < coords.length - 1; i++) {
        const [x1, y1] = coords[i];
        const [x2, y2] = coords[i + 1];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        segments.push({ start: [x1, y1], end: [x2, y2], length });
        totalLength += length;
      }

      // Créer des points à intervalles réguliers
      const points: any[] = [];
      const spacing = totalLength / numArrows;

      for (let i = 0; i < numArrows; i++) {
        const targetDistance = (i * spacing + offset) % totalLength;
        let currentDistance = 0;

        for (const segment of segments) {
          if (currentDistance + segment.length >= targetDistance) {
            const segmentProgress =
              (targetDistance - currentDistance) / segment.length;
            const [x1, y1] = segment.start;
            const [x2, y2] = segment.end;
            const x = x1 + (x2 - x1) * segmentProgress;
            const y = y1 + (y2 - y1) * segmentProgress;

            // Calculer l'angle de rotation (MapLibre utilise 0° = Nord)
            // On inverse x et y et on ajuste pour que 0° = Nord
            const angle =
              (Math.atan2(x2 - x1, y2 - y1) * (180 / Math.PI)) % 360;

            points.push({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [x, y],
              },
              properties: {
                rotation: angle,
              },
            });
            break;
          }
          currentDistance += segment.length;
        }
      }

      return {
        type: "FeatureCollection",
        features: points,
      };
    },
    [],
  );

  // Animation des flèches le long de l'itinéraire
  useEffect(() => {
    if (!routeGeometry) {
      console.log("Pas de routeGeometry, pas de flèches");
      setArrowPoints(null);
      return;
    }

    console.log("Animation des flèches démarrée");
    const numArrows = 15; // Nombre de flèches sur l'itinéraire

    const animate = () => {
      animationProgressRef.current += 0.00002; // Vitesse d'animation ralentie
      const points = calculateArrowPoints(
        routeGeometry,
        numArrows,
        animationProgressRef.current,
      );
      setArrowPoints(points);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      console.log("Animation des flèches arrêtée");
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [routeGeometry, calculateArrowPoints]);

  // Attacher les événements au layer de la route
  useEffect(() => {
    if (!mapRef.current || !routeGeometry) return;

    const map = mapRef.current.getMap();

    const handleRouteMouseDown = (e: any) => {
      // Ne pas créer de waypoint si on est en train de déplacer un marqueur
      if (isDraggingMarker) return;

      e.preventDefault();
      const { lngLat } = e;
      const newWaypoint: Waypoint = {
        id: `waypoint-${Date.now()}`,
        lat: lngLat.lat,
        lon: lngLat.lng,
      };
      setWaypoints((prev) => [...prev, newWaypoint]);
      setIsDraggingNewWaypoint(newWaypoint.id);
      map.getCanvas().style.cursor = "crosshair";
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
      setIsHoveringRoute(true);
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
      setIsHoveringRoute(false);
    };

    // Attendre que le layer soit chargé
    const waitForLayer = () => {
      if (map.getLayer("route-layer-clickable")) {
        map.on("mousedown", "route-layer-clickable", handleRouteMouseDown);
        map.on("mouseenter", "route-layer-clickable", handleMouseEnter);
        map.on("mouseleave", "route-layer-clickable", handleMouseLeave);
      } else {
        setTimeout(waitForLayer, 100);
      }
    };

    waitForLayer();

    return () => {
      if (map.getLayer("route-layer-clickable")) {
        map.off("mousedown", "route-layer-clickable", handleRouteMouseDown);
        map.off("mouseenter", "route-layer-clickable", handleMouseEnter);
        map.off("mouseleave", "route-layer-clickable", handleMouseLeave);
      }
    };
  }, [routeGeometry]);

  // Gérer le drag du waypoint nouvellement créé
  useEffect(() => {
    if (!mapRef.current || !isDraggingNewWaypoint) return;

    const map = mapRef.current.getMap();

    const handleMouseMove = (e: any) => {
      const { lngLat } = e;
      setWaypoints((prev) =>
        prev.map((wp) =>
          wp.id === isDraggingNewWaypoint
            ? { ...wp, lat: lngLat.lat, lon: lngLat.lng }
            : wp,
        ),
      );

      // Recalculer l'itinéraire en temps réel avec throttling
      calculateRouteThrottled();
    };

    const handleMouseUp = () => {
      setIsDraggingNewWaypoint(null);
      map.getCanvas().style.cursor = "";
      // Calcul final pour s'assurer d'avoir la position exacte
      if (routeCalculationTimeoutRef.current) {
        clearTimeout(routeCalculationTimeoutRef.current);
      }
      calculateRoute(false);
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Supprimer le waypoint si Echap est pressé
        setWaypoints((prev) =>
          prev.filter((wp) => wp.id !== isDraggingNewWaypoint),
        );
        setIsDraggingNewWaypoint(null);
        map.getCanvas().style.cursor = "";
        // Recalculer sans le waypoint supprimé
        setTimeout(() => calculateRoute(false), 50);
      }
    };

    map.on("mousemove", handleMouseMove);
    map.on("mouseup", handleMouseUp);
    window.addEventListener("keydown", handleEscape);

    return () => {
      map.off("mousemove", handleMouseMove);
      map.off("mouseup", handleMouseUp);
      window.removeEventListener("keydown", handleEscape);
      if (routeCalculationTimeoutRef.current) {
        clearTimeout(routeCalculationTimeoutRef.current);
      }
    };
  }, [isDraggingNewWaypoint, calculateRouteThrottled]);

  const handleWaypointDragStart = useCallback(() => {
    setIsDraggingMarker(true);
  }, []);

  const handleWaypointDragEnd = useCallback(
    (waypointId: string, lngLat: { lng: number; lat: number }) => {
      setIsDraggingMarker(false);
      setWaypoints((prev) =>
        prev.map((wp) =>
          wp.id === waypointId
            ? { ...wp, lat: lngLat.lat, lon: lngLat.lng }
            : wp,
        ),
      );
    },
    [],
  );

  const handleStartPointDragStart = useCallback(() => {
    setIsDraggingMarker(true);
  }, []);

  const handleStartPointDragEnd = useCallback(
    async (lngLat: { lng: number; lat: number }) => {
      setIsDraggingMarker(false);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lngLat.lat}&lon=${lngLat.lng}`,
        );
        const data = await response.json();
        setStartPoint({
          lat: lngLat.lat,
          lon: lngLat.lng,
          display_name:
            data.display_name ||
            `${lngLat.lat.toFixed(4)}, ${lngLat.lng.toFixed(4)}`,
        });
      } catch (error) {
        setStartPoint({
          lat: lngLat.lat,
          lon: lngLat.lng,
          display_name: `${lngLat.lat.toFixed(4)}, ${lngLat.lng.toFixed(4)}`,
        });
      }
    },
    [],
  );

  const handleEndPointDragStart = useCallback(() => {
    setIsDraggingMarker(true);
  }, []);

  const handleEndPointDragEnd = useCallback(
    async (lngLat: { lng: number; lat: number }) => {
      setIsDraggingMarker(false);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lngLat.lat}&lon=${lngLat.lng}`,
        );
        const data = await response.json();
        setEndPoint({
          lat: lngLat.lat,
          lon: lngLat.lng,
          display_name:
            data.display_name ||
            `${lngLat.lat.toFixed(4)}, ${lngLat.lng.toFixed(4)}`,
        });
      } catch (error) {
        setEndPoint({
          lat: lngLat.lat,
          lon: lngLat.lng,
          display_name: `${lngLat.lat.toFixed(4)}, ${lngLat.lng.toFixed(4)}`,
        });
      }
    },
    [],
  );

  const removeWaypoint = useCallback((waypointId: string) => {
    setWaypoints((prev) => prev.filter((wp) => wp.id !== waypointId));
    setSelectedWaypoint(null);
  }, []);

  const moveStartToWaypoint = useCallback(
    (waypointId: string) => {
      const waypoint = waypoints.find((wp) => wp.id === waypointId);
      if (waypoint && startPoint) {
        // Déplacer le point de départ au waypoint
        setStartPoint({
          lat: waypoint.lat,
          lon: waypoint.lon,
          display_name: `${waypoint.lat.toFixed(4)}, ${waypoint.lon.toFixed(4)}`,
        });
        // Supprimer le waypoint
        setWaypoints((prev) => prev.filter((wp) => wp.id !== waypointId));
        setSelectedWaypoint(null);
      }
    },
    [waypoints, startPoint],
  );

  const clearRoute = useCallback(() => {
    setStartPoint(null);
    setEndPoint(null);
    setWaypoints([]);
    setRouteGeometry(null);
    setRouteInfo(null);
    setRouteSegments(null);
    setElevationData(null);
    // Nettoyer aussi le localStorage
    localStorage.removeItem("saved-route");
  }, []);

  const handleReorderWaypoints = useCallback((newWaypoints: Waypoint[]) => {
    setWaypoints(newWaypoints);
  }, []);

  const handleReverseRoute = useCallback(() => {
    // Inverser les points de départ et d'arrivée
    const temp = startPoint;
    setStartPoint(endPoint);
    setEndPoint(temp);
    // Inverser l'ordre des waypoints
    setWaypoints((prev) => [...prev].reverse());
  }, [startPoint, endPoint]);

  // Calculer automatiquement l'itinéraire quand les deux points sont définis
  useEffect(() => {
    if (startPoint && endPoint) {
      calculateRoute(true); // Avec zoom lors de la création initiale
    } else {
      // Si l'un des deux points manque, effacer l'itinéraire
      setRouteGeometry(null);
      setRouteInfo(null);
      setRouteSegments(null);
      setElevationData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startPoint, endPoint]);

  // Recalculer l'itinéraire quand les waypoints ou le mode de transport changent
  // mais pas pendant le drag d'un nouveau waypoint (géré en temps réel dans le drag handler)
  useEffect(() => {
    if (startPoint && endPoint && !isDraggingNewWaypoint) {
      calculateRoute(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints, isDraggingNewWaypoint, transportMode]);

  const controlButtonStyle: React.CSSProperties = {
    position: "absolute",
    right: "10px",
    backgroundColor: theme === "dark" ? "#1a1a1a" : "#ffffff",
    border: `1px solid ${theme === "dark" ? "#444" : "#ddd"}`,
    borderRadius: "4px",
    padding: "8px",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
    width: "36px",
    height: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme === "dark" ? "#fff" : "#333",
    zIndex: 1,
  };
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "calc(100vh - 85px)",
      }}
      onClick={() => {
        setContextMenu(null);
        setSelectedWaypoint(null);
      }}
    >
      <SidePanel
        isOpen={sidePanelOpen}
        onClose={() => setSidePanelOpen(false)}
        startPoint={startPoint}
        endPoint={endPoint}
        waypoints={waypoints}
        onSetStartPoint={setStartPoint}
        onSetEndPoint={setEndPoint}
        onReorderWaypoints={handleReorderWaypoints}
        onRemoveWaypoint={removeWaypoint}
        onReverseRoute={handleReverseRoute}
        onClearRoute={clearRoute}
        routeInfo={routeInfo}
        routeSegments={routeSegments}
        elevationData={elevationData}
        waypointCount={waypoints.length}
        isCalculating={isCalculating}
        isPlacingWaypoint={!!isDraggingNewWaypoint}
        transportMode={transportMode}
        onTransportModeChange={setTransportMode}
      />

      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onContextMenu={handleMapContextMenu}
        dragPan={
          !isHoveringRoute && !isDraggingNewWaypoint && !isDraggingMarker
        }
        style={{
          position: "fixed",
          width: "100%",
          height: "100%",
          display: "block",
          bottom: 0,
          top: "3rem",
        }}
        mapStyle={mapStyle}
      >
        {/* Route Line - Clickable */}
        {routeGeometry && (
          <Source
            id="route"
            type="geojson"
            data={{
              type: "Feature",
              properties: {},
              geometry: routeGeometry,
            }}
          >
            {/* Ligne invisible plus large pour faciliter le clic */}
            <Layer
              id="route-layer-clickable"
              type="line"
              paint={{
                "line-color": "transparent",
                "line-width": 25,
              }}
            />
            {/* Ligne visible */}
            <Layer
              id="route-layer"
              type="line"
              paint={{
                "line-color":
                  theme === "dark"
                    ? isHoveringRoute
                      ? "#60a5fa"
                      : "#3b82f6"
                    : isHoveringRoute
                      ? "#888888"
                      : "#555555",
                "line-width": isHoveringRoute ? 6 : 4,
                "line-opacity": isHoveringRoute ? 1 : 0.9,
              }}
            />
          </Source>
        )}

        {/* Flèches animées le long de l'itinéraire */}
        {arrowPoints && theme === "dark" ? (
          <Source id="arrow-points" type="geojson" data={arrowPoints}>
            <Layer
              id="route-arrows"
              type="symbol"
              layout={{
                "icon-image": "arrow-icon-white",
                "icon-size": isHoveringRoute ? 0.6 : 0.5,
                "icon-rotate": ["get", "rotation"],
                "icon-rotation-alignment": "map",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              }}
              paint={{
                "icon-opacity": isHoveringRoute ? 1 : 0.85,
              }}
            />
          </Source>
        ) : (
          <></>
        )}
        {arrowPoints && theme === "light" && (
          <Source id="arrow-points" type="geojson" data={arrowPoints}>
            <Layer
              id="route-arrows"
              type="symbol"
              layout={{
                "icon-image": "arrow-icon",
                "icon-size": isHoveringRoute ? 0.6 : 0.5,
                "icon-rotate": ["get", "rotation"],
                "icon-rotation-alignment": "map",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              }}
              paint={{
                "icon-opacity": isHoveringRoute ? 1 : 0.85,
              }}
            />
          </Source>
        )}

        {/* Start Point Marker */}
        {startPoint && (
          <Marker
            longitude={startPoint.lon}
            latitude={startPoint.lat}
            draggable
            onDragStart={handleStartPointDragStart}
            onDragEnd={(event) => handleStartPointDragEnd(event.lngLat)}
          >
            <div
              onMouseEnter={() => setHoveredMarker("start")}
              onMouseLeave={() => setHoveredMarker(null)}
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "var(--brand)",
                border: "3px solid white",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "bold",
                fontSize: "10px",
                cursor: "move",
                transform:
                  hoveredMarker === "start" ? "scale(1.2)" : "scale(1)",
                transition: "transform 0.2s ease-in-out",
              }}
            >
              A
            </div>
          </Marker>
        )}

        {/* End Point Marker */}
        {endPoint && (
          <Marker
            longitude={endPoint.lon}
            latitude={endPoint.lat}
            draggable
            onDragStart={handleEndPointDragStart}
            onDragEnd={(event) => handleEndPointDragEnd(event.lngLat)}
          >
            <div
              onMouseEnter={() => setHoveredMarker("end")}
              onMouseLeave={() => setHoveredMarker(null)}
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "var(--brand)",
                border: "3px solid white",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "bold",
                fontSize: "10px",
                cursor: "move",
                transform: hoveredMarker === "end" ? "scale(1.2)" : "scale(1)",
                transition: "transform 0.2s ease-in-out",
              }}
            >
              B
            </div>
          </Marker>
        )}

        {/* Waypoint Markers - Draggable */}
        {waypoints.map((waypoint, index) => (
          <Marker
            key={waypoint.id}
            longitude={waypoint.lon}
            latitude={waypoint.lat}
            draggable
            onDragStart={handleWaypointDragStart}
            onDragEnd={(event) =>
              handleWaypointDragEnd(waypoint.id, event.lngLat)
            }
          >
            <div
              style={{
                position: "relative",
                width: "10px",
                height: "10px",
              }}
              onMouseEnter={() => setHoveredMarker(waypoint.id)}
              onMouseLeave={() => setHoveredMarker(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (mapRef.current) {
                  const map = mapRef.current.getMap();
                  const point = map.project([waypoint.lon, waypoint.lat]);
                  setSelectedWaypoint({
                    id: waypoint.id,
                    x: point.x,
                    y: point.y,
                  });
                }
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: "#f59e0b",
                  border: "3px solid white",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "10px",
                  cursor: "pointer",
                  transform:
                    hoveredMarker === waypoint.id ? "scale(1.2)" : "scale(1)",
                  transition: "transform 0.2s ease-in-out",
                }}
              >
                {index + 1}
              </div>
            </div>
          </Marker>
        ))}
      </Map>

      {/* Menu button - top left */}
      <button
        onClick={() => setSidePanelOpen(true)}
        style={{
          ...controlButtonStyle,
          left: "1rem",
          top: "1rem",
          right: "auto",
          fontSize: "24px",
          fontWeight: "300",
        }}
        title="Menu"
        aria-label="Ouvrir le menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1024 1024"
          version="1.1"
          p-id="4796"
          width="20"
          height="25"
          fill="currentColor"
        >
          <path
            d="M896 307.2h-768a25.6 25.6 0 0 1 0-51.2h768a25.6 25.6 0 0 1 0 51.2zM896 563.2h-768a25.6 25.6 0 0 1 0-51.2h768a25.6 25.6 0 0 1 0 51.2zM896 819.2h-768a25.6 25.6 0 0 1 0-51.2h768a25.6 25.6 0 0 1 0 51.2z"
            p-id="4797"
          />
        </svg>
      </button>

      <button
        onClick={recenterMap}
        style={{ ...controlButtonStyle, top: "10px" }}
        title="Me localiser"
        aria-label="Me localiser"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" />
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22" />
          <line x1="4" y1="12" x2="2" y2="12" />
          <line x1="22" y1="12" x2="20" y2="12" />
        </svg>
      </button>

      <button
        onClick={resetNorth}
        style={{ ...controlButtonStyle, top: "56px" }}
        title="Orienter vers le nord"
        aria-label="Orienter vers le nord"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 19 21 12 17 5 21 12 2" />
        </svg>
      </button>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: "absolute",
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            backgroundColor: theme === "dark" ? "#1a1a1a" : "#ffffff",
            border: `1px solid ${theme === "dark" ? "#444" : "#ddd"}`,
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            zIndex: 1001,
            minWidth: "200px",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() =>
              setPointFromMap(contextMenu.lat, contextMenu.lon, "start")
            }
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "none",
              backgroundColor: "transparent",
              color: theme === "dark" ? "#fff" : "#333",
              textAlign: "left",
              cursor: "pointer",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme === "dark" ? "#2a2a2a" : "#f3f4f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span style={{ color: "#10b981", fontSize: "18px" }}>●</span>
            Choisir comme point de départ
          </button>
          <button
            onClick={() =>
              setPointFromMap(contextMenu.lat, contextMenu.lon, "end")
            }
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "none",
              backgroundColor: "transparent",
              color: theme === "dark" ? "#fff" : "#333",
              textAlign: "left",
              cursor: "pointer",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme === "dark" ? "#2a2a2a" : "#f3f4f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span style={{ color: "#ef4444", fontSize: "18px" }}>●</span>
            Choisir comme point d'arrivée
          </button>
        </div>
      )}

      {/* Waypoint Popup */}
      {selectedWaypoint && (
        <div
          style={{
            position: "absolute",
            left: `${selectedWaypoint.x + 20}px`,
            top: `${selectedWaypoint.y - 20}px`,
            backgroundColor: theme === "dark" ? "#1a1a1a" : "#ffffff",
            border: `1px solid ${theme === "dark" ? "#444" : "#ddd"}`,
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            zIndex: 1001,
            minWidth: "200px",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => moveStartToWaypoint(selectedWaypoint.id)}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "none",
              backgroundColor: "transparent",
              color: theme === "dark" ? "#fff" : "#333",
              textAlign: "left",
              cursor: "pointer",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme === "dark" ? "#2a2a2a" : "#f3f4f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span style={{ color: "#10b981", fontSize: "18px" }}>📍</span>
            Déplacer le départ ici
          </button>
          <button
            onClick={() => removeWaypoint(selectedWaypoint.id)}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "none",
              backgroundColor: "transparent",
              color: theme === "dark" ? "#fff" : "#333",
              textAlign: "left",
              cursor: "pointer",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme === "dark" ? "#2a2a2a" : "#f3f4f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span style={{ color: "#ef4444", fontSize: "18px" }}>🗑️</span>
            Supprimer ce point
          </button>
        </div>
      )}

      {/* Profil d'élévation */}
      {elevationData && elevationData.length > 0 && routeInfo && (
        <ElevationProfile
          elevationData={elevationData}
          totalDistance={routeInfo.distance}
          sidePanelOpen={sidePanelOpen}
        />
      )}
    </div>
  );
}
