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
import { LanguageContext, ThemeContext } from "../../App";
import { useParams, useSearchParams } from "react-router-dom";
import SidePanel from "./SidePanel";
import ElevationProfile from "./ElevationProfile";
import arrowIconBlack from "../../assets/arrow-icon.png";
import arrowIconWhite from "../../assets/arrow-icon-white.png";
import { TransportMode } from "./SidePanel";

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

export default function MapView({
  readOnly,
  onReadOnlyChange,
}: {
  readOnly: boolean;
  onReadOnlyChange?: (value: boolean) => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams();
  const [originalRouteData, setOriginalRouteData] = useState<{
    startPoint: Location | null;
    endPoint: Location | null;
    waypoints: Waypoint[];
    transportMode: TransportMode;
  } | null>(null);

  const initialViewState = {
    longitude: 2.3522,
    latitude: 48.8566,
    zoom: 6,
    bearing: 0,
    pitch: 0,
  };

  const [viewState, setViewState] = useState(initialViewState);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

  // Ouvrir le SidePanel si le paramètre "create=true" est présent dans l'URL
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setSidePanelOpen(true);
      // Retirer le paramètre de l'URL pour éviter de rouvrir à chaque rechargement
      searchParams.delete("create");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
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
  const [elevationCursorPosition, setElevationCursorPosition] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [restrictedSegments, setRestrictedSegments] = useState<{
    geometry: any;
    segments: Array<{
      name: string;
      distance: number;
      reason: string;
    }>;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    lat: number;
    lon: number;
  } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isHoveringRoute, setIsHoveringRoute] = useState(false);
  const [routeHoverPosition, setRouteHoverPosition] = useState<{
    lat: number;
    lon: number;
    distance: number;
  } | null>(null);
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
  const [transportMode, setTransportMode] =
    useState<TransportMode>("driving-car");
  const mapRef = useRef<MapRef>(null);
  const lastRouteCalculationRef = useRef<number>(0);
  const routeCalculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationProgressRef = useRef<number>(0);
  const prevReadOnlyRef = useRef<boolean>(readOnly);
  const theme = React.useContext(ThemeContext);

  const { t } = useContext(LanguageContext);

  const mapStyle = useMemo(
    () =>
      theme === "dark"
        ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    [theme],
  );

  // Charger l'itinéraire depuis l'API si un UUID est présent dans l'URL
  useEffect(() => {
    const loadRouteFromApi = async () => {
      if (params.uuid) {
        try {
          console.log("Chargement de l'itinéraire depuis l'API:", params.uuid);
          const response = await fetch(`/api/route/${params.uuid}`, {
            credentials: "include",
          });

          if (!response.ok) {
            throw new Error("Échec du chargement de l'itinéraire");
          }

          const savedRoute = await response.json();
          console.log("Itinéraire chargé depuis l'API:", savedRoute);

          // Stocker le nom et l'UUID pour les mises à jour futures
          if (savedRoute.name) {
            localStorage.setItem("saved-route-name", savedRoute.name);
          }

          // Charger les données de l'itinéraire
          if (savedRoute.route) {
            const routeData = savedRoute.route;
            if (routeData.startPoint) setStartPoint(routeData.startPoint);
            if (routeData.endPoint) setEndPoint(routeData.endPoint);
            if (routeData.waypoints && Array.isArray(routeData.waypoints)) {
              setWaypoints(routeData.waypoints);
            }
            if (routeData.transportMode) {
              setTransportMode(routeData.transportMode);
            }

            // Sauvegarder l'état original pour pouvoir l'annuler plus tard
            setOriginalRouteData({
              startPoint: routeData.startPoint || null,
              endPoint: routeData.endPoint || null,
              waypoints: routeData.waypoints || [],
              transportMode: routeData.transportMode || "driving-car",
            });

            // Sauvegarder aussi dans localStorage (avec apiResponse si disponible)
            const dataToSave = {
              ...routeData,
              // Conserver apiResponse s'il existe déjà dans le routeData
              ...(routeData.apiResponse && {
                apiResponse: routeData.apiResponse,
              }),
            };
            localStorage.setItem("saved-route", JSON.stringify(dataToSave));
          }
        } catch (error) {
          console.error("Erreur lors du chargement de l'itinéraire:", error);
        }
      }
    };

    loadRouteFromApi();
  }, [params.uuid]);

  // Restaurer l'itinéraire original quand on annule les modifications (passage en mode lecture seule)
  useEffect(() => {
    const wasEditing = prevReadOnlyRef.current === false;
    const isNowReadOnly = readOnly === true;

    if (wasEditing && isNowReadOnly && originalRouteData && params.uuid) {
      console.log("Annulation des modifications, restauration de l'itinéraire original");
      setStartPoint(originalRouteData.startPoint);
      setEndPoint(originalRouteData.endPoint);
      setWaypoints(originalRouteData.waypoints);
      setTransportMode(originalRouteData.transportMode);

      // Restaurer aussi dans localStorage
      const existingRoute = localStorage.getItem("saved-route");
      if (existingRoute) {
        const parsed = JSON.parse(existingRoute);
        const restoredData = {
          ...parsed,
          startPoint: originalRouteData.startPoint,
          endPoint: originalRouteData.endPoint,
          waypoints: originalRouteData.waypoints,
          transportMode: originalRouteData.transportMode,
        };
        localStorage.setItem("saved-route", JSON.stringify(restoredData));
      }
    }

    // Mettre à jour la référence pour le prochain render
    prevReadOnlyRef.current = readOnly;
  }, [readOnly, originalRouteData, params.uuid]);

  // Charger l'itinéraire sauvegardé au démarrage depuis localStorage (uniquement si pas d'UUID dans l'URL)
  useEffect(() => {
    if (!params.uuid) {
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
    }
  }, [params.uuid]);

  // Sauvegarder l'itinéraire à chaque modification
  useEffect(() => {
    // Si au moins un point existe, sauvegarder
    if (startPoint || endPoint || waypoints.length > 0) {
      try {
        // Récupérer l'apiResponse existante si elle existe
        const existingRoute = localStorage.getItem("saved-route");
        const existingApiResponse = existingRoute
          ? JSON.parse(existingRoute).apiResponse
          : undefined;

        const routeData = {
          startPoint,
          endPoint,
          waypoints,
          transportMode,
          timestamp: new Date().toISOString(),
          // Conserver apiResponse si elle existe
          ...(existingApiResponse && { apiResponse: existingApiResponse }),
        };
        localStorage.setItem("saved-route", JSON.stringify(routeData));
        console.log("Itinéraire sauvegardé:", {
          hasStart: !!startPoint,
          hasEnd: !!endPoint,
          waypointsCount: waypoints.length,
          hasApiResponse: !!existingApiResponse,
        });
      } catch (error) {
        console.error("Erreur lors de la sauvegarde de l'itinéraire:", error);
      }
    } else {
      // Si tous les points sont supprimés, nettoyer le localStorage
      localStorage.removeItem("saved-route");
      localStorage.removeItem("saved-route-uuid");
      localStorage.removeItem("saved-route-name");
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
        } catch (error) {
          console.error("Erreur chargement des flèches:", error);
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

  // Fonction pour calculer la position sur l'itinéraire à une distance donnée
  const getPositionAtDistance = useCallback(
    (targetDistance: number) => {
      if (!routeGeometry || !routeGeometry.coordinates) return null;

      const coords = routeGeometry.coordinates;
      let cumulativeDistance = 0;

      for (let i = 1; i < coords.length; i++) {
        const prevCoord = coords[i - 1];
        const currCoord = coords[i];

        // Calculer la distance de ce segment (Haversine)
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

        if (cumulativeDistance + segmentDistance >= targetDistance) {
          // La distance cible est dans ce segment
          const remainingDistance = targetDistance - cumulativeDistance;
          const ratio = remainingDistance / segmentDistance;

          // Interpoler entre les deux points
          const lon = prevCoord[0] + (currCoord[0] - prevCoord[0]) * ratio;
          const lat = prevCoord[1] + (currCoord[1] - prevCoord[1]) * ratio;

          return { lat, lon };
        }

        cumulativeDistance += segmentDistance;
      }

      // Si on arrive ici, retourner le dernier point
      const lastCoord = coords[coords.length - 1];
      return { lat: lastCoord[1], lon: lastCoord[0] };
    },
    [routeGeometry],
  );

  const calculateRoute = async (shouldZoom: boolean = true) => {
    if (!startPoint || !endPoint) return;

    setIsCalculating(true);
    try {
      // Mapper les modes de transport vers les profils OpenRou395880teService
      const getORSProfile = () => {
        switch (transportMode) {
          case "driving-car":
            return "driving-car";
          case "cycling-regular":
            return "cycling-regular";
          case "cycling-electric":
            return "cycling-electric";
          case "cycling-road":
            return "cycling-electric";
          case "cycling-mountain":
            return "cycling-mountain";
          case "wheelchair":
            return "wheelchair";
          case "foot-walking":
            return "foot-walking";
          case "foot-hiking":
            return "foot-hiking";
          default:
            return "driving-car";
        }
      };

      const profile = getORSProfile();

      // Construire les coordonnées pour OpenRouteService [lon, lat]
      const coordinates = [
        [startPoint.lon, startPoint.lat],
        ...waypoints.map((wp) => [wp.lon, wp.lat]),
        [endPoint.lon, endPoint.lat],
      ];

      console.log("🔄 Calcul d'itinéraire avec OpenRouteService...");
      console.log("Profile:", profile);
      console.log("Coordonnées:", coordinates);

      // Appel à l'API OpenRouteService via le proxy backend
      const response = await fetch("/api/routing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordinates: coordinates,
          profile: profile,
          extra_info: ["surface", "waytype", "steepness"],
          instructions: true,
          elevation: true,
          language: "fr",
          format: "geojson",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Erreur OpenRouteService:", errorData);
        alert(
          `Erreur lors du calcul de l'itinéraire: ${errorData.error || "Erreur inconnue"}`,
        );
        setIsCalculating(false);
        return;
      }

      const data = await response.json();
      // Sauvegarder la réponse complète de l'API pour l'export GPX
      try {
        const existingRoute = localStorage.getItem("saved-route");
        const parsedRoute = existingRoute ? JSON.parse(existingRoute) : {};
        const updatedRoute = {
          ...parsedRoute,
          apiResponse: data, // Sauvegarder toute la réponse de l'API
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem("saved-route", JSON.stringify(updatedRoute));
        console.log("✅ Réponse API sauvegardée dans localStorage");
      } catch (error) {
        console.error(
          "❌ Erreur lors de la sauvegarde de la réponse API:",
          error,
        );
      }

      console.log(
        "🔍 Réponse complète OpenRouteService:",
        JSON.stringify(data, null, 2),
      );
      console.log("🔍 Type de data:", typeof data);
      console.log("🔍 Clés de data:", Object.keys(data));
      console.log("🔍 data.routes existe?", !!data.routes);
      console.log("🔍 data.features existe?", !!data.features);
      console.log("🔍 data.type:", data.type);

      // Vérifier différentes structures possibles
      let route;
      if (data.routes && data.routes.length > 0) {
        console.log("✅ Utilisation de data.routes[0]");
        route = data.routes[0];
      } else if (data.features && data.features.length > 0) {
        console.log("✅ Utilisation de data.features[0] (GeoJSON)");
        // Format GeoJSON Feature Collection
        route = data.features[0];
      } else {
        console.error("❌ Format de réponse inattendu:", data);
        console.error("❌ Structure data:", {
          hasRoutes: !!data.routes,
          hasFeatures: !!data.features,
          keys: Object.keys(data),
        });
        setIsCalculating(false);
        return;
      }

      console.log("🔍 Route extraite:", route);
      console.log("🔍 Clés de route:", Object.keys(route));
      console.log("🔍 route.geometry existe?", !!route.geometry);

      // Extraire la géométrie selon le format
      let geometry;
      let summary;

      if (route.geometry) {
        // Format GeoJSON Feature (quand format: "geojson")
        geometry = route.geometry;
        console.log("✅ Géométrie trouvée dans route.geometry");
        // Le summary peut être dans properties pour GeoJSON ou à la racine pour routes
        summary = route.properties?.summary || route.summary;
      } else {
        console.error("❌ Pas de géométrie dans la route:", route);
        console.error("❌ Clés disponibles:", Object.keys(route));
        setIsCalculating(false);
        return;
      }

      console.log("🔍 Géométrie extraite:", geometry);
      console.log("🔍 Type de géométrie:", geometry?.type);
      console.log("🔍 Géométrie a des coordonnées?", !!geometry?.coordinates);
      console.log("🔍 Nombre de coordonnées:", geometry?.coordinates?.length);
      console.log("🔍 Summary:", summary);
      console.log("🔍 Route properties:", route.properties);

      if (!geometry || !geometry.coordinates) {
        console.error("❌ Géométrie invalide ou pas de coordonnées");
        console.error("❌ geometry:", geometry);
        console.error("❌ geometry?.coordinates:", geometry?.coordinates);
        setIsCalculating(false);
        return;
      }

      console.log(
        "✅ Géométrie valide avec",
        geometry.coordinates.length,
        "points",
      );

      // Calculer le dénivelé positif et négatif et préparer les données pour le graphique
      let elevationGain = 0;
      let elevationLoss = 0;
      const coords = geometry.coordinates;
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
        distance: summary?.distance || 0,
        duration: summary?.duration || 0, // ORS retourne déjà en secondes
        elevationGain: Math.round(elevationGain),
        elevationLoss: Math.round(elevationLoss),
      });
      setElevationData(elevationPoints);

      // Extraire les informations sur les segments avec OpenRouteService
      const segments: Array<{
        type: string;
        distance: number;
        name: string;
      }> = [];

      // Segments interdits aux vélos pour la mise en évidence sur la carte
      const bikeRestrictedSegments: Array<{
        name: string;
        distance: number;
        reason: string;
      }> = [];
      const restrictedCoordinates: number[][] = [];

      // Les segments peuvent être dans properties pour GeoJSON
      const routeSegments = route.segments || route.properties?.segments || [];
      console.log("Segments trouvés:", routeSegments);

      // Compteur cumulatif de distance pour suivre la position dans les coordonnées
      let cumulativeStepDistance = 0;
      let coordIndex = 0;

      routeSegments.forEach((segment: any) => {
        segment.steps?.forEach((step: any) => {
          if (step.distance > 0) {
            // Déterminer le type de surface/terrain
            let surfaceType = "paved"; // Par défaut : route goudronnée
            const name = step.name || "";
            let isBikeRestricted = false;
            let restrictionReason = "";

            // Détecter les interdictions pour vélos
            if (name.match(/autoroute|A\d+|motorway/i)) {
              isBikeRestricted = true;
              restrictionReason = "Autoroute interdite aux vélos";
              surfaceType = "autoroute";
            } else if (name.match(/voie rapide|expressway|trunk/i)) {
              isBikeRestricted = true;
              restrictionReason = "Voie rapide interdite aux vélos";
              surfaceType = "autoroute";
            }

            // Analyse du nom pour déterminer le type
            if (!isBikeRestricted) {
              if (name.match(/chemin|sentier|path|track|footway/i)) {
                surfaceType = "chemin";
              } else if (name.match(/piste cyclable|cycleway|bike|vélo/i)) {
                surfaceType = "cyclable";
              } else if (name.match(/gravel|gravelle|terre|dirt|unpaved/i)) {
                surfaceType = "gravel";
              } else if (name.match(/nationale|N\d+|primary/i)) {
                surfaceType = "nationale";
              } else if (
                name.match(/départementale|D\d+|secondary|tertiary/i)
              ) {
                surfaceType = "departementale";
              } else if (
                name.match(/rue|avenue|boulevard|residential|living_street/i)
              ) {
                surfaceType = "urbain";
              } else if (name.match(/service|parking|driveway/i)) {
                surfaceType = "service";
              }
            }

            segments.push({
              type: surfaceType,
              distance: step.distance,
              name: name || "Sans nom",
            });

            // Si le segment est interdit aux vélos, stocker ses informations et coordonnées
            if (
              [
                "cycling-regular",
                "cycling-electric",
                "cycling-road",
                "cycling-mountain",
              ].includes(transportMode) &&
              isBikeRestricted
            ) {
              bikeRestrictedSegments.push({
                name: name || "Sans nom",
                distance: step.distance,
                reason: restrictionReason,
              });

              // Extraire les coordonnées correspondant à ce step
              // On utilise way_points qui donne les indices de début et fin dans les coordonnées
              const stepStartIdx = step.way_points?.[0] || coordIndex;
              const stepEndIdx = step.way_points?.[1] || coordIndex + 1;

              for (
                let i = stepStartIdx;
                i <= stepEndIdx && i < coords.length;
                i++
              ) {
                restrictedCoordinates.push(coords[i]);
              }
            }

            cumulativeStepDistance += step.distance;
            coordIndex++;
          }
        });
      });

      setRouteSegments(segments);
      console.log("Segments de route avec surfaces:", segments);

      // Mettre à jour les segments interdits
      if (
        bikeRestrictedSegments.length > 0 &&
        [
          "cycling-regular",
          "cycling-electric",
          "cycling-road",
          "cycling-mountain",
        ].includes(transportMode)
      ) {
        setRestrictedSegments({
          geometry: {
            type: "LineString",
            coordinates: restrictedCoordinates,
          },
          segments: bikeRestrictedSegments,
        });
        console.log("⚠️ Segments interdits aux vélos:", bikeRestrictedSegments);
      } else {
        setRestrictedSegments(null);
      }

      // Zoom sur l'itinéraire seulement si demandé
      if (shouldZoom && mapRef.current) {
        const coords = geometry.coordinates;
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

  // Fonction pour trouver le point le plus proche sur l'itinéraire avec sa distance depuis le début
  const findClosestPointOnRoute = useCallback(
    (mousePos: { x: number; y: number }) => {
      if (!mapRef.current || !routeGeometry) return null;

      const map = mapRef.current.getMap();
      const coords = routeGeometry.coordinates;

      let closestPoint = null;
      let closestIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];
        const point = map.project([coord[0], coord[1]]);
        const dx = point.x - mousePos.x;
        const dy = point.y - mousePos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = { lat: coord[1], lon: coord[0] };
          closestIndex = i;
        }
      }

      // Calculer la distance cumulée jusqu'à ce point
      let cumulativeDistance = 0;
      for (let i = 1; i <= closestIndex; i++) {
        const prevCoord = coords[i - 1];
        const currCoord = coords[i];

        // Formule de Haversine
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
      }

      return { ...closestPoint, distance: cumulativeDistance };
    },
    [routeGeometry],
  );

  // Attacher les événements au layer de la route
  useEffect(() => {
    if (!mapRef.current || !routeGeometry || readOnly) return;

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

    const handleRouteMouseMove = (e: any) => {
      const closestPoint = findClosestPointOnRoute(e.point);
      if (closestPoint) {
        setRouteHoverPosition(closestPoint);
      }
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
      setIsHoveringRoute(true);
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
      setIsHoveringRoute(false);
      setRouteHoverPosition(null);
    };

    // Attendre que le layer soit chargé
    const waitForLayer = () => {
      if (map.getLayer("route-layer-clickable")) {
        map.on("mousedown", "route-layer-clickable", handleRouteMouseDown);
        map.on("mousemove", "route-layer-clickable", handleRouteMouseMove);
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
        map.off("mousemove", "route-layer-clickable", handleRouteMouseMove);
        map.off("mouseenter", "route-layer-clickable", handleMouseEnter);
        map.off("mouseleave", "route-layer-clickable", handleMouseLeave);
      }
    };
  }, [routeGeometry, findClosestPointOnRoute, readOnly]);

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
    localStorage.removeItem("saved-route-uuid");
    localStorage.removeItem("saved-route-name");
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
        restrictedSegments={restrictedSegments}
        readOnly={readOnly}
      />

      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onContextMenu={readOnly ? undefined : handleMapContextMenu}
        dragPan={
          readOnly
            ? true
            : !isHoveringRoute && !isDraggingNewWaypoint && !isDraggingMarker
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

        {/* Segments interdits aux vélos en rouge */}
        {restrictedSegments &&
          restrictedSegments.geometry.coordinates.length > 0 && (
            <Source
              id="restricted-route"
              type="geojson"
              data={{
                type: "Feature",
                properties: {},
                geometry: restrictedSegments.geometry,
              }}
            >
              <Layer
                id="restricted-route-layer"
                type="line"
                paint={{
                  "line-color": "#ef4444",
                  "line-width": 6,
                  "line-opacity": 0.8,
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
            draggable={!readOnly}
            onDragStart={handleStartPointDragStart}
            onDragEnd={(event) => handleStartPointDragEnd(event.lngLat)}
          >
            <div
              onMouseEnter={() => setHoveredMarker("start")}
              onMouseLeave={() => setHoveredMarker(null)}
              style={{
                width: "18px",
                height: "18px",
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
            draggable={!readOnly}
            onDragStart={handleEndPointDragStart}
            onDragEnd={(event) => handleEndPointDragEnd(event.lngLat)}
          >
            <div
              onMouseEnter={() => setHoveredMarker("end")}
              onMouseLeave={() => setHoveredMarker(null)}
              style={{
                width: "18px",
                height: "18px",
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
            draggable={!readOnly}
            onDragStart={handleWaypointDragStart}
            onDragEnd={(event) =>
              handleWaypointDragEnd(waypoint.id, event.lngLat)
            }
          >
            <div
              style={{
                position: "relative",
                width: "18px",
                height: "18px",
              }}
              onMouseEnter={() => setHoveredMarker(waypoint.id)}
              onMouseLeave={() => setHoveredMarker(null)}
              onClick={(e) => {
                if (readOnly) return;
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
                  width: "18px",
                  height: "18px",
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

        {/* Curseur d'élévation au survol du graphique */}
        {elevationCursorPosition && (
          <Marker
            longitude={elevationCursorPosition.lon}
            latitude={elevationCursorPosition.lat}
          >
            <div
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                backgroundColor: "var(--brand)",
                border: "3px solid white",
                boxShadow: "0 0 10px rgba(0,0,0,0.5)",
                opacity: 0.9,
              }}
            />
          </Marker>
        )}

        {/* Curseur au survol de l'itinéraire */}
        {routeHoverPosition && (
          <Marker
            longitude={routeHoverPosition.lon}
            latitude={routeHoverPosition.lat}
          >
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: theme === "dark" ? "#3b82f6" : "#555555",
                border: "2px solid white",
                boxShadow: "0 0 8px rgba(0,0,0,0.4)",
                pointerEvents: "none",
              }}
            />
          </Marker>
        )}
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
          backgroundColor: "#89a480",
          color: "#fff",
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

      <button
        onClick={() => onReadOnlyChange?.(!readOnly)}
        style={{
          ...controlButtonStyle,
          top: "102px",
          backgroundColor: readOnly
            ? theme === "dark"
              ? "#1a1a1a"
              : "#ffffff"
            : "#89a480",
          color: readOnly ? (theme === "dark" ? "#fff" : "#333") : "#fff",
        }}
        title={readOnly ? "Activer l'édition" : "Mode lecture seule"}
        aria-label={readOnly ? "Activer l'édition" : "Mode lecture seule"}
      >
        {readOnly ? (
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
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
        ) : (
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
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>

      {/* Context Menu */}
      {contextMenu && !readOnly && (
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
      {selectedWaypoint && !readOnly && (
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
          onHoverDistance={(distance) => {
            const position = getPositionAtDistance(distance);
            setElevationCursorPosition(position);
          }}
          onLeave={() => setElevationCursorPosition(null)}
          externalHoverDistance={routeHoverPosition?.distance}
        />
      )}
    </div>
  );
}
