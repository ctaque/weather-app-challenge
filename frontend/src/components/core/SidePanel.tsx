import React, { useContext, useState, useEffect } from "react";
import { ThemeContext } from "../../App";
import RouteSegmentsGraph from "./RouteSegmentsGraph";
import { TransportModeDropdown } from "../ui/TransportModeDropdown";
import { LoaderCircle, LocateIcon, Save } from "lucide-react";
import { AppLocation } from "./MapView";
import { ToastContainer, toast } from "react-toastify";

interface NewLocation {
  address_text?: string;
  lat?: string;
  lng?: string;
  name: string;
  created_at: string;
}

interface Waypoint {
  id: string;
  lat: number;
  lon: number;
}

export type TransportMode =
  | "driving-car"
  | "cycling-regular"
  | "cycling-road"
  | "cycling-mountain"
  | "cycling-electric"
  | "foot-walking"
  | "foot-hiking"
  | "wheelchair";

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  startPoint: AppLocation | null;
  endPoint: AppLocation | null;
  waypoints: Waypoint[];
  onSetStartPoint: (location: AppLocation) => void;
  onSetEndPoint: (location: AppLocation) => void;
  onReorderWaypoints: (waypoints: Waypoint[]) => void;
  onRemoveWaypoint: (waypointId: string) => void;
  onReverseRoute: () => void;
  onClearRoute: () => void;
  routeInfo: {
    distance: number;
    duration: number;
    elevationGain?: number;
    elevationLoss?: number;
  } | null;
  routeSegments: Array<{ type: string; distance: number; name: string }> | null;
  elevationData: Array<{ distance: number; elevation: number }> | null;
  waypointCount: number;
  isCalculating: boolean;
  isPlacingWaypoint: boolean;
  transportMode: TransportMode;
  onTransportModeChange: (mode: TransportMode) => void;
  restrictedSegments: {
    geometry: any;
    segments: Array<{
      name: string;
      distance: number;
      reason: string;
    }>;
  } | null;
  readOnly: boolean;
}

interface Address {
  id: number;
  name: string;
  lat: string;
  lng: string;
  address_text: string;
}

export default function SidePanel({
  isOpen,
  onClose,
  startPoint,
  endPoint,
  waypoints,
  onSetStartPoint,
  onSetEndPoint,
  onReorderWaypoints,
  onRemoveWaypoint,
  onReverseRoute,
  onClearRoute,
  routeInfo,
  routeSegments,
  elevationData,
  waypointCount,
  isCalculating,
  isPlacingWaypoint,
  transportMode,
  onTransportModeChange,
  restrictedSegments,
  readOnly,
}: SidePanelProps) {
  const theme = useContext(ThemeContext);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"start" | "end" | null>(null);
  const [searchResults, setSearchResults] = useState<AppLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [preferedAddreses, setAddreses] = useState<Address[]>([]);
  const [draggedWaypointIndex, setDraggedWaypointIndex] = useState<
    number | null
  >(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after">(
    "before",
  );
  const [draggedPointType, setDraggedPointType] = useState<
    "start" | "end" | "waypoint" | null
  >(null);
  const [isGeolocating, setIsGeolocating] = useState<"start" | "end" | null>(
    null,
  );

  const handleGeolocation = async (type: "start" | "end") => {
    setIsGeolocating(type);

    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur");
      setIsGeolocating(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          // Recherche inversée pour obtenir l'adresse
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
          );
          const data = await response.json();
          const displayName =
            data.display_name ||
            `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

          const location: AppLocation = {
            lat: latitude,
            lon: longitude,
            display_name: displayName,
            address_text: data.display_name || displayName,
            name: extractShortName(displayName),
            is_saved: isAddressAlreadySaved(latitude, longitude),
          };

          if (type === "start") {
            onSetStartPoint(location);
          } else {
            onSetEndPoint(location);
          }

          setSearchType(null);
          setSearchQuery("");
          setSearchResults([]);
        } catch (error) {
          console.error("Erreur de géocodage inversé:", error);
          // Utiliser les coordonnées directement en cas d'erreur
          const displayName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          const location: AppLocation = {
            lat: latitude,
            lon: longitude,
            display_name: displayName,
            address_text: displayName,
            name: displayName,
            is_saved: isAddressAlreadySaved(latitude, longitude),
          };

          if (type === "start") {
            onSetStartPoint(location);
          } else {
            onSetEndPoint(location);
          }

          setSearchType(null);
          setSearchQuery("");
          setSearchResults([]);
        } finally {
          setIsGeolocating(false);
        }
      },
      (error) => {
        console.error("Erreur de géolocalisation:", error);
        alert("Impossible d'obtenir votre position");
        setIsGeolocating(false);
      },
    );
  };

  // Fonction pour extraire un nom court depuis display_name
  const extractShortName = (displayName: string): string => {
    const parts = displayName.split(",");
    return parts[0].trim();
  };

  // Fonction pour vérifier si une adresse est déjà enregistrée (avec tolérance de 0.0001° ~10m)
  const isAddressAlreadySaved = (lat: number, lon: number): boolean => {
    const tolerance = 0.0001;
    return preferedAddreses.some(
      (addr) =>
        Math.abs(parseFloat(addr.lat) - lat) < tolerance &&
        Math.abs(parseFloat(addr.lng) - lon) < tolerance,
    );
  };

  // Recherche automatique avec debounce
  useEffect(() => {
    if (!searchType || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            searchQuery,
          )}&limit=5`,
        );
        const data = await response.json();
        setSearchResults(
          data.map((item: any) => {
            const displayName = item.display_name;
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            return {
              lat,
              lon,
              display_name: displayName,
              name: extractShortName(displayName),
              address_text: displayName,
              is_saved: isAddressAlreadySaved(lat, lon),
            };
          }),
        );
      } catch (error) {
        console.error("Erreur de recherche:", error);
      } finally {
        setIsSearching(false);
      }
    }, 500); // Debounce de 500ms

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchType, preferedAddreses]);

  const selectLocation = (location: AppLocation) => {
    if (searchType === "start") {
      onSetStartPoint(location);
    } else if (searchType === "end") {
      onSetEndPoint(location);
    }
    setSearchResults([]);
    setSearchType(null);
    setSearchQuery("");
  };

  // Fonctions unifiées de drag and drop pour tous les points
  const handlePointDragStart = (
    type: "start" | "end" | "waypoint",
    index?: number,
  ) => {
    setDraggedPointType(type);
    if (type === "waypoint" && index !== undefined) {
      setDraggedWaypointIndex(index);
    }
  };

  const handlePointDragOver = (
    e: React.DragEvent,
    type: "start" | "end" | "waypoint",
    index?: number,
  ) => {
    e.preventDefault();

    // Calculer si le curseur est dans la moitié supérieure ou inférieure
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    const position = y < height / 2 ? "before" : "after";

    if (type === "waypoint" && index !== undefined) {
      setDragOverIndex(index);
    } else if (type === "start") {
      setDragOverIndex(-1); // Index spécial pour le départ
    } else if (type === "end") {
      setDragOverIndex(waypoints.length); // Index spécial pour l'arrivée
    }
    setDropPosition(position);
  };

  const handlePointDragLeave = () => {
    setDragOverIndex(null);
  };

  const handlePointDrop = (
    e: React.DragEvent,
    targetType: "start" | "end" | "waypoint",
    targetIndex?: number,
  ) => {
    e.preventDefault();
    if (!draggedPointType) return;

    // Construction d'une liste ordonnée de tous les points
    const allPoints: Array<{
      type: "start" | "end" | "waypoint";
      data: AppLocation | Waypoint;
      waypointIndex?: number;
    }> = [];

    if (startPoint) allPoints.push({ type: "start", data: startPoint });
    waypoints.forEach((wp, idx) =>
      allPoints.push({ type: "waypoint", data: wp, waypointIndex: idx }),
    );
    if (endPoint) allPoints.push({ type: "end", data: endPoint });

    // Trouver l'index de l'élément déplacé
    let draggedIndex = -1;
    if (draggedPointType === "start") {
      draggedIndex = 0;
    } else if (draggedPointType === "end") {
      draggedIndex = allPoints.length - 1;
    } else if (
      draggedPointType === "waypoint" &&
      draggedWaypointIndex !== null
    ) {
      draggedIndex = allPoints.findIndex(
        (p) =>
          p.type === "waypoint" && p.waypointIndex === draggedWaypointIndex,
      );
    }

    // Trouver l'index cible
    let targetIdx = -1;
    if (targetType === "start") {
      targetIdx = 0;
    } else if (targetType === "end") {
      targetIdx = allPoints.length - 1;
    } else if (targetType === "waypoint" && targetIndex !== undefined) {
      targetIdx = allPoints.findIndex(
        (p) => p.type === "waypoint" && p.waypointIndex === targetIndex,
      );
    }

    if (draggedIndex === -1 || targetIdx === -1) return;

    // Retirer l'élément déplacé
    const draggedPoint = allPoints[draggedIndex];
    allPoints.splice(draggedIndex, 1);

    // Recalculer l'index cible après suppression
    if (draggedIndex < targetIdx) {
      targetIdx -= 1;
    }

    // Ajuster selon la position (avant/après)
    if (dropPosition === "after") {
      targetIdx += 1;
    }

    // Insérer l'élément à la nouvelle position
    allPoints.splice(targetIdx, 0, draggedPoint);

    // Reconstituer les états
    let newStart: AppLocation | null = null;
    let newEnd: AppLocation | null = null;
    const newWaypoints: Waypoint[] = [];

    if (allPoints.length > 0) {
      // Le premier point devient le départ
      const firstPoint = allPoints[0];
      if (firstPoint.type === "start") {
        newStart = firstPoint.data as AppLocation;
      } else if (firstPoint.type === "waypoint") {
        const wp = firstPoint.data as Waypoint;
        const displayName = `${wp.lat.toFixed(4)}, ${wp.lon.toFixed(4)}`;
        newStart = {
          lat: wp.lat,
          lon: wp.lon,
          display_name: displayName,
          address_text: displayName,
          name: displayName,
          is_saved: false,
        };
      } else if (firstPoint.type === "end") {
        newStart = firstPoint.data as AppLocation;
      }

      // Le dernier point devient l'arrivée
      const lastPoint = allPoints[allPoints.length - 1];
      if (lastPoint.type === "end") {
        newEnd = lastPoint.data as AppLocation;
      } else if (lastPoint.type === "waypoint") {
        const wp = lastPoint.data as Waypoint;
        const displayName = `${wp.lat.toFixed(4)}, ${wp.lon.toFixed(4)}`;
        newEnd = {
          lat: wp.lat,
          lon: wp.lon,
          display_name: displayName,
          address_text: displayName,
          name: displayName,
          is_saved: false,
        };
      } else if (lastPoint.type === "start") {
        newEnd = lastPoint.data as AppLocation;
      }

      // Les points du milieu deviennent des waypoints
      for (let i = 1; i < allPoints.length - 1; i++) {
        const point = allPoints[i];
        if (point.type === "waypoint") {
          newWaypoints.push(point.data as Waypoint);
        } else if (point.type === "start" || point.type === "end") {
          const loc = point.data as AppLocation;
          newWaypoints.push({
            id: `waypoint-${Date.now()}-${i}`,
            lat: loc.lat,
            lon: loc.lon,
          });
        }
      }
    }

    // Mettre à jour les états
    onSetStartPoint(newStart as AppLocation);
    onSetEndPoint(newEnd as AppLocation);
    onReorderWaypoints(newWaypoints);

    // Nettoyer
    setDraggedPointType(null);
    setDraggedWaypointIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedPointType(null);
    setDraggedWaypointIndex(null);
    setDragOverIndex(null);
  };

  const doFetchAddresses = () => {
    setAddresesLoading(true);
    fetch("/api/prefered_addresses", { credentials: "include" })
      .then((resp: Response) => {
        return resp.json();
      })
      .then((json: any) => {
        setAddreses(json);
        setAddresesLoading(false);
      })
      .catch(() => {
        setAddresesLoading(false);
      });
  };

  useEffect(() => {
    doFetchAddresses();
  }, []);

  const [addressesLoading, setAddresesLoading] = useState(false);

  const saveAddress = (address: NewLocation) => {
    setAddresesLoading(true);
    fetch("/api/prefered_addresses", {
      credentials: "include",
      method: "POST",
      body: JSON.stringify(address),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((json) => json.json())
      .then(() => {
        doFetchAddresses();
        toast.success("Adresse enregistrée avec succès", {
          theme: theme === "dark" ? "dark" : "light",
        });
      });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px",
    borderRadius: "3rem",
    border: `1px solid ${theme === "dark" ? "#444" : "#ddd"}`,
    backgroundColor: theme === "dark" ? "#2a2a2a" : "#fff",
    color: theme === "dark" ? "#fff" : "#333",
    fontSize: "14px",
    marginBottom: "10px",
  };

  const buttonStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px",
    borderRadius: "6px",
    border: "none",
    backgroundColor: theme === "dark" ? "#4a5568" : "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
  };

  return (
    <>
      <ToastContainer />
      {/* Side Panel */}
      <div
        style={{
          position: "fixed",
          top: "4rem",
          left: isOpen ? "1rem" : "-380px",
          bottom: "1rem",
          width: "320px",
          backgroundColor: "#89a380",
          boxShadow: "2px 0 10px rgba(0, 0, 0, 0.3)",
          zIndex: 1000,
          transition: "left 0.3s ease-in-out",
          padding: "20px",
          overflowY: "auto",
          borderRadius: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: theme === "dark" ? "#fff" : "#333",
              fontSize: "20px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            {searchType && (
              <button
                onClick={() => {
                  setSearchType(null);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                style={{
                  borderRadius: "30rem",
                  cursor: "pointer",
                  fontSize: "20px",
                  border: "none",
                  fontWeight: "500",
                  alignItems: "center",
                  height: "2rem",
                  width: "2rem",
                }}
              >
                ←
              </button>
            )}
            Planifier un itinéraire
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "28px",
              cursor: "pointer",
              color: theme === "dark" ? "#fff" : "#333",
              lineHeight: "1",
              padding: "0",
              transform: "rotate(45deg)",
            }}
            aria-label="Fermer le menu"
          >
            +
          </button>
        </div>

        {/* Point de départ */}
        {searchType !== "end" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              {/* Sélecteur de mode de transport */}
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: theme === "dark" ? "#fff" : "#333",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Point de départ
              </label>
              {!searchType && (
                <div>
                  <TransportModeDropdown
                    value={transportMode}
                    style={{
                      border: "none",
                      padding: ".2rem .5rem",
                      display: "block",
                      minWidth: "7rem",
                      cursor: readOnly ? "not-allowed" : "pointer",
                      opacity: readOnly ? 0.6 : 1,
                    }}
                    onChange={(value) => {
                      if (readOnly) return;
                      onTransportModeChange(value);
                    }}
                  />
                </div>
              )}
            </div>
            {
              <>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginBottom: "10px",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: "10px",
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        backgroundColor: "#10b981",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: "bold",
                        zIndex: 1,
                      }}
                    >
                      A
                    </div>
                    <input
                      type="text"
                      placeholder="Rechercher une adresse..."
                      value={
                        searchType === "start"
                          ? searchQuery
                          : startPoint?.display_name || ""
                      }
                      onFocus={() => {
                        if (readOnly) return;
                        setSearchType("start");
                        if (startPoint) {
                          setSearchQuery(startPoint.display_name);
                        } else {
                          setSearchQuery("");
                        }
                        setSearchResults([]);
                      }}
                      onChange={(e) => {
                        if (readOnly) return;
                        setSearchQuery(e.target.value);
                      }}
                      disabled={readOnly}
                      style={{
                        ...inputStyle,
                        marginBottom: 0,
                        paddingLeft: "42px",
                        paddingRight: !startPoint?.is_saved ? "42px" : "0px",
                        width: "100%",
                        cursor: readOnly ? "not-allowed" : "text",
                        opacity: readOnly ? 0.6 : 1,
                      }}
                    />
                    {startPoint && !startPoint.is_saved && !readOnly && (
                      <button
                        disabled={addressesLoading}
                        onClick={() => {
                          saveAddress({
                            lat: `${startPoint.lat}`,
                            lng: `${startPoint.lon}`,
                            created_at: new Date().toISOString(),
                            name: startPoint.name || startPoint.display_name,
                            address_text:
                              startPoint.address_text ||
                              startPoint.display_name,
                          });
                        }}
                        style={{
                          position: "absolute",
                          right: "10px",
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "12px",
                          fontWeight: "bold",
                          zIndex: 1,
                        }}
                      >
                        <Save />
                      </button>
                    )}
                  </div>
                  {/* Bouton Me localiser */}
                  {!readOnly && searchType && (
                    <button
                      onClick={() => handleGeolocation("start")}
                      disabled={isGeolocating !== null}
                      style={{
                        border: `1px solid ${theme === "dark" ? "#444" : "#ddd"}`,
                        backgroundColor: theme === "dark" ? "#2a2a2a" : "#fff",
                        width: "2rem",
                        height: "2rem",
                        borderRadius: "3rem",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {isGeolocating === "start" ? (
                        <LoaderCircle />
                      ) : (
                        <LocateIcon />
                      )}
                    </button>
                  )}
                </div>
              </>
            }
          </div>
        )}

        {/* Point d'arrivée */}
        {searchType !== "start" && (
          <div style={{ marginBottom: "20px" }}>
            {
              <>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    color: theme === "dark" ? "#fff" : "#333",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  Point d'arrivée
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginBottom: "10px",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: "10px",
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        backgroundColor: "#ef4444",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: "bold",
                        zIndex: 1,
                      }}
                    >
                      B
                    </div>
                    <input
                      type="text"
                      placeholder="Rechercher une adresse..."
                      value={
                        searchType === "end"
                          ? searchQuery
                          : endPoint?.display_name || ""
                      }
                      onFocus={() => {
                        if (readOnly) return;
                        setSearchType("end");
                        if (endPoint) {
                          setSearchQuery(endPoint.display_name);
                        } else {
                          setSearchQuery("");
                        }
                        setSearchResults([]);
                      }}
                      onChange={(e) => {
                        if (readOnly) return;
                        setSearchQuery(e.target.value);
                      }}
                      disabled={readOnly}
                      style={{
                        ...inputStyle,
                        marginBottom: 0,
                        paddingLeft: "42px",
                        paddingRight: endPoint?.is_saved ? 0 : "42px",
                        width: "100%",
                        cursor: readOnly ? "not-allowed" : "text",
                        opacity: readOnly ? 0.6 : 1,
                      }}
                    />
                    {endPoint && !endPoint.is_saved && !readOnly && (
                      <button
                        disabled={addressesLoading}
                        onClick={() => {
                          saveAddress({
                            lat: `${endPoint.lat}`,
                            lng: `${endPoint.lon}`,
                            created_at: new Date().toISOString(),
                            name: endPoint.name || endPoint.display_name,
                            address_text:
                              endPoint.address_text || endPoint.display_name,
                          });
                        }}
                        style={{
                          position: "absolute",
                          right: "10px",
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "12px",
                          fontWeight: "bold",
                          zIndex: 1,
                        }}
                      >
                        <Save />
                      </button>
                    )}
                  </div>
                  {/* Bouton Me localiser */}
                  {!readOnly && searchType && (
                    <button
                      onClick={() => handleGeolocation("end")}
                      disabled={isGeolocating !== null}
                      style={{
                        border: `1px solid ${theme === "dark" ? "#444" : "#ddd"}`,
                        backgroundColor: theme === "dark" ? "#2a2a2a" : "#fff",
                        width: "2rem",
                        height: "2rem",
                        borderRadius: "3rem",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {isGeolocating === "end" ? (
                        <LoaderCircle />
                      ) : (
                        <LocateIcon />
                      )}
                    </button>
                  )}
                </div>
              </>
            }
          </div>
        )}

        {/* Résultats de recherche */}
        {searchType && (
          <div style={{ marginBottom: "20px" }}>
            {/* Bouton retour */}

            {isSearching && (
              <p
                style={{
                  margin: "10px 0",
                  color: theme === "dark" ? "#333" : "#666",
                  fontSize: "13px",
                  textAlign: "center",
                }}
              >
                Recherche en cours...
              </p>
            )}

            {!isSearching && searchResults.length > 0 && (
              <>
                <p
                  style={{
                    margin: "0 0 10px 0",
                    color: theme === "dark" ? "#333" : "#666",
                    fontSize: "13px",
                  }}
                >
                  Adresses :
                </p>
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => selectLocation(result)}
                    style={{
                      width: "100%",
                      padding: "10px",
                      marginBottom: "8px",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: theme === "dark" ? "#2a2a2a" : "#f3f4f6",
                      color: theme === "dark" ? "#fff" : "#333",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                  >
                    {result.display_name}
                  </button>
                ))}
              </>
            )}

            {searchQuery && !isSearching && searchResults.length === 0 && (
              <p
                style={{
                  margin: "10px 0",
                  color: theme === "dark" ? "#333" : "#666",
                  fontSize: "13px",
                  textAlign: "center",
                }}
              >
                Aucun résultat trouvé
              </p>
            )}
            <div
              style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}
            >
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: theme === "dark" ? "#fff" : "#333",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Adreses enregistrées
              </label>
              {preferedAddreses.map((addr: Address) => {
                return (
                  <button
                    style={{
                      borderRadius: "5px",
                      padding: ".5rem 1rem",
                      backgroundColor: theme === "dark" ? "#2a2a2a" : "#f3f4f6",
                      color: theme === "dark" ? "#fff" : "#333",
                      border:
                        theme === "dark" ? "1px solid rgb(68, 68, 68)" : "#ccc",
                    }}
                    key={addr.id}
                    onClick={() => {
                      selectLocation({
                        display_name: addr.name,
                        lat: +addr.lat,
                        lon: +addr.lng,
                        address_text: addr.address_text,
                        name: addr.name,
                        is_saved: true,
                      });
                    }}
                  >
                    <div style={{ display: "flex", gap: "1rem" }}>
                      <div style={{ minWidth: "1rem" }}>
                        <LocateIcon />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          overflow: "hidden",
                        }}
                      >
                        <span>{addr.name}</span>
                        <small
                          style={{
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {addr.address_text.slice(0, 30) +
                            (addr.address_text.length > 30 ? "..." : "")}
                        </small>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Liste des points de passage */}
        {!searchType && startPoint && endPoint && (
          <div style={{ marginTop: "20px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: "600",
                  color: theme === "dark" ? "#fff" : "#333",
                }}
              >
                Points de passage
              </h3>
              {!readOnly && (
                <button
                  onClick={onReverseRoute}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "4px",
                    border: "none",
                    backgroundColor: "transparent",
                    color: theme === "dark" ? "#fff" : "#333",
                    cursor: "pointer",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  title="Inverser l'itinéraire"
                >
                  Inverser
                </button>
              )}
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {/* Indicateur de drop AVANT le départ */}
              {dragOverIndex === -1 &&
                dropPosition === "before" &&
                draggedPointType !== null &&
                draggedPointType !== "start" && (
                  <div
                    style={{
                      height: "4px",
                      backgroundColor: "#f59e0b",
                      borderRadius: "2px",
                      margin: "4px 0",
                      boxShadow: "0 0 8px rgba(245, 158, 11, 0.5)",
                      animation: "pulse 1s ease-in-out infinite",
                    }}
                  />
                )}
              {/* Point de départ */}
              <div
                draggable={!readOnly}
                onDragStart={
                  readOnly ? undefined : () => handlePointDragStart("start")
                }
                onDragOver={
                  readOnly ? undefined : (e) => handlePointDragOver(e, "start")
                }
                onDragLeave={readOnly ? undefined : handlePointDragLeave}
                onDrop={
                  readOnly ? undefined : (e) => handlePointDrop(e, "start")
                }
                onDragEnd={readOnly ? undefined : handleDragEnd}
                style={{
                  padding: "10px",
                  borderRadius: "6px",
                  backgroundColor: theme === "dark" ? "#2a2a2a" : "#f3f4f6",
                  border: `2px solid ${dragOverIndex === -1 &&
                      draggedPointType !== null &&
                      draggedPointType !== "start"
                      ? "#f59e0b"
                      : "#10b981"
                    }`,
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: readOnly ? "default" : "move",
                  opacity: draggedPointType === "start" ? 0.3 : 1,
                  transform:
                    draggedPointType === "start" ? "scale(0.95)" : "scale(1)",
                  transition: "transform 0.2s ease, opacity 0.2s ease",
                  boxShadow:
                    dragOverIndex === -1 &&
                      draggedPointType !== null &&
                      draggedPointType !== "start"
                      ? "0 0 12px rgba(245, 158, 11, 0.4)"
                      : "none",
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    backgroundColor: "var(--brand)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: "bold",
                    flexShrink: 0,
                  }}
                >
                  A
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color: theme === "dark" ? "#aaa" : "#666",
                    }}
                  >
                    Départ
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: theme === "dark" ? "#fff" : "#333",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {startPoint.display_name.split(",").slice(0, 2).join(",")}
                  </p>
                </div>
                {!readOnly && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    style={{ flexShrink: 0, cursor: "move" }}
                  >
                    <rect
                      x="2"
                      y="5"
                      width="12"
                      height="2"
                      rx="1"
                      fill={theme === "dark" ? "#aaa" : "#999"}
                    />
                    <rect
                      x="2"
                      y="9"
                      width="12"
                      height="2"
                      rx="1"
                      fill={theme === "dark" ? "#aaa" : "#999"}
                    />
                  </svg>
                )}
              </div>
              {/* Indicateur de drop APRES le départ */}
              {dragOverIndex === -1 &&
                dropPosition === "after" &&
                draggedPointType !== null &&
                draggedPointType !== "start" && (
                  <div
                    style={{
                      height: "4px",
                      backgroundColor: "#f59e0b",
                      borderRadius: "2px",
                      margin: "4px 0",
                      boxShadow: "0 0 8px rgba(245, 158, 11, 0.5)",
                      animation: "pulse 1s ease-in-out infinite",
                    }}
                  />
                )}

              {/* Waypoints draggables */}
              {waypoints.map((waypoint, index) => (
                <React.Fragment key={waypoint.id}>
                  {/* Indicateur de drop AVANT */}
                  {dragOverIndex === index &&
                    dropPosition === "before" &&
                    draggedWaypointIndex !== null &&
                    draggedWaypointIndex !== index && (
                      <div
                        style={{
                          height: "4px",
                          backgroundColor: "#f59e0b",
                          borderRadius: "2px",
                          margin: "4px 0",
                          boxShadow: "0 0 8px rgba(245, 158, 11, 0.5)",
                          animation: "pulse 1s ease-in-out infinite",
                        }}
                      />
                    )}
                  <div
                    draggable={!readOnly}
                    onDragStart={
                      readOnly
                        ? undefined
                        : () => handlePointDragStart("waypoint", index)
                    }
                    onDragOver={
                      readOnly
                        ? undefined
                        : (e) => handlePointDragOver(e, "waypoint", index)
                    }
                    onDragLeave={readOnly ? undefined : handlePointDragLeave}
                    onDrop={
                      readOnly
                        ? undefined
                        : (e) => handlePointDrop(e, "waypoint", index)
                    }
                    onDragEnd={readOnly ? undefined : handleDragEnd}
                    style={{
                      padding: "10px",
                      borderRadius: "6px",
                      backgroundColor: theme === "dark" ? "#2a2a2a" : "#f3f4f6",
                      border: `2px solid ${dragOverIndex === index &&
                          draggedWaypointIndex !== null &&
                          draggedWaypointIndex !== index
                          ? "#f59e0b"
                          : theme === "dark"
                            ? "#f59e0b"
                            : "#f59e0b"
                        }`,
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      cursor: readOnly ? "default" : "move",
                      opacity: draggedWaypointIndex === index ? 0.3 : 1,
                      transform:
                        draggedWaypointIndex === index
                          ? "scale(0.95)"
                          : "scale(1)",
                      transition: "transform 0.2s ease, opacity 0.2s ease",
                      boxShadow:
                        dragOverIndex === index &&
                          draggedWaypointIndex !== null &&
                          draggedWaypointIndex !== index
                          ? "0 0 12px rgba(245, 158, 11, 0.4)"
                          : "none",
                    }}
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        backgroundColor: "#f59e0b",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: "bold",
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "12px",
                          color: theme === "dark" ? "#aaa" : "#666",
                        }}
                      >
                        Point intermédiaire
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          color: theme === "dark" ? "#fff" : "#333",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {waypoint.lat.toFixed(4)}, {waypoint.lon.toFixed(4)}
                      </p>
                    </div>
                    {!readOnly && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveWaypoint(waypoint.id);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          fontSize: "18px",
                          padding: "0",
                          flexShrink: 0,
                        }}
                        title="Supprimer ce point"
                      >
                        ×
                      </button>
                    )}
                    {!readOnly && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        style={{ flexShrink: 0, cursor: "move" }}
                      >
                        <rect
                          x="2"
                          y="5"
                          width="12"
                          height="2"
                          rx="1"
                          fill={theme === "dark" ? "#aaa" : "#999"}
                        />
                        <rect
                          x="2"
                          y="9"
                          width="12"
                          height="2"
                          rx="1"
                          fill={theme === "dark" ? "#aaa" : "#999"}
                        />
                      </svg>
                    )}
                  </div>
                  {/* Indicateur de drop APRES */}
                  {dragOverIndex === index &&
                    dropPosition === "after" &&
                    draggedWaypointIndex !== null &&
                    draggedWaypointIndex !== index && (
                      <div
                        style={{
                          height: "4px",
                          backgroundColor: "#f59e0b",
                          borderRadius: "2px",
                          margin: "4px 0",
                          boxShadow: "0 0 8px rgba(245, 158, 11, 0.5)",
                          animation: "pulse 1s ease-in-out infinite",
                        }}
                      />
                    )}
                </React.Fragment>
              ))}

              {/* Indicateur de drop AVANT l'arrivée */}
              {dragOverIndex === waypoints.length &&
                dropPosition === "before" &&
                draggedPointType !== null &&
                draggedPointType !== "end" && (
                  <div
                    style={{
                      height: "4px",
                      backgroundColor: "#f59e0b",
                      borderRadius: "2px",
                      margin: "4px 0",
                      boxShadow: "0 0 8px rgba(245, 158, 11, 0.5)",
                      animation: "pulse 1s ease-in-out infinite",
                    }}
                  />
                )}
              {/* Point d'arrivée */}
              <div
                draggable={!readOnly}
                onDragStart={
                  readOnly ? undefined : () => handlePointDragStart("end")
                }
                onDragOver={
                  readOnly ? undefined : (e) => handlePointDragOver(e, "end")
                }
                onDragLeave={readOnly ? undefined : handlePointDragLeave}
                onDrop={readOnly ? undefined : (e) => handlePointDrop(e, "end")}
                onDragEnd={readOnly ? undefined : handleDragEnd}
                style={{
                  padding: "10px",
                  borderRadius: "6px",
                  backgroundColor: theme === "dark" ? "#2a2a2a" : "#f3f4f6",
                  border: `2px solid ${dragOverIndex === waypoints.length &&
                      draggedPointType !== null &&
                      draggedPointType !== "end"
                      ? "#f59e0b"
                      : "#ef4444"
                    }`,
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: readOnly ? "default" : "move",
                  opacity: draggedPointType === "end" ? 0.3 : 1,
                  transform:
                    draggedPointType === "end" ? "scale(0.95)" : "scale(1)",
                  transition: "transform 0.2s ease, opacity 0.2s ease",
                  boxShadow:
                    dragOverIndex === waypoints.length &&
                      draggedPointType !== null &&
                      draggedPointType !== "end"
                      ? "0 0 12px rgba(245, 158, 11, 0.4)"
                      : "none",
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    backgroundColor: "var(--brand)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: "bold",
                    flexShrink: 0,
                  }}
                >
                  B
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color: theme === "dark" ? "#aaa" : "#666",
                    }}
                  >
                    Arrivée
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: theme === "dark" ? "#fff" : "#333",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {endPoint.display_name.split(",").slice(0, 2).join(",")}
                  </p>
                </div>
                {!readOnly && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    style={{ flexShrink: 0, cursor: "move" }}
                  >
                    <rect
                      x="2"
                      y="5"
                      width="12"
                      height="2"
                      rx="1"
                      fill={theme === "dark" ? "#aaa" : "#999"}
                    />
                    <rect
                      x="2"
                      y="9"
                      width="12"
                      height="2"
                      rx="1"
                      fill={theme === "dark" ? "#aaa" : "#999"}
                    />
                  </svg>
                )}
              </div>
              {/* Indicateur de drop APRES l'arrivée */}
              {dragOverIndex === waypoints.length &&
                dropPosition === "after" &&
                draggedPointType !== null &&
                draggedPointType !== "end" && (
                  <div
                    style={{
                      height: "4px",
                      backgroundColor: "#f59e0b",
                      borderRadius: "2px",
                      margin: "4px 0",
                      boxShadow: "0 0 8px rgba(245, 158, 11, 0.5)",
                      animation: "pulse 1s ease-in-out infinite",
                    }}
                  />
                )}
            </div>
          </div>
        )}
        {/* Indicateur de calcul */}
        {!searchType &&
          isCalculating &&
          startPoint &&
          endPoint &&
          !isPlacingWaypoint && (
            <div
              style={{
                marginTop: "20px",
                padding: "15px",
                borderRadius: "6px",
                backgroundColor: theme === "dark" ? "#2a2a2a" : "#f3f4f6",
                color: theme === "dark" ? "#fff" : "#333",
                textAlign: "center",
              }}
            >
              <div style={{ marginBottom: "8px" }}>⏳</div>
              <p style={{ margin: 0, fontSize: "14px" }}>
                Calcul de l'itinéraire en cours...
              </p>
            </div>
          )}

        {/* Informations sur l'itinéraire */}
        {!searchType && routeInfo && !isCalculating && (
          <>
            <div
              style={{
                marginTop: "20px",
                padding: "15px",
                borderRadius: "6px",
                backgroundColor: theme === "dark" ? "#2a2a2a" : "#f3f4f6",
                color: theme === "dark" ? "#fff" : "#333",
              }}
            >
              <h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>
                Informations
              </h3>
              <p style={{ margin: "5px 0", fontSize: "14px" }}>
                <strong>Distance :</strong>{" "}
                {(routeInfo.distance / 1000).toFixed(2)} km
              </p>
              <p style={{ margin: "5px 0", fontSize: "14px" }}>
                <strong>Durée :</strong> {Math.round(routeInfo.duration / 60)}{" "}
                min
              </p>
              {routeInfo.elevationGain !== undefined &&
                routeInfo.elevationLoss !== undefined && (
                  <>
                    <p style={{ margin: "5px 0", fontSize: "14px" }}>
                      <strong>Dénivelé positif :</strong> ⬆️{" "}
                      {routeInfo.elevationGain} m
                    </p>
                    <p style={{ margin: "5px 0", fontSize: "14px" }}>
                      <strong>Dénivelé négatif :</strong> ⬇️{" "}
                      {routeInfo.elevationLoss} m
                    </p>
                  </>
                )}
              {waypointCount > 0 && (
                <p style={{ margin: "5px 0", fontSize: "14px" }}>
                  <strong>Points intermédiaires :</strong> {waypointCount}
                </p>
              )}
            </div>

            {/* Graphique des segments de route */}
            {routeSegments && routeSegments.length > 0 && (
              <RouteSegmentsGraph
                segments={routeSegments}
                totalDistance={routeInfo.distance}
              />
            )}

            {/* Interdictions de passage à vélo */}
            {restrictedSegments &&
              restrictedSegments.segments.length > 0 &&
              ["cycling-mountain", "cycling-electric"].includes(
                transportMode,
              ) && (
                <div
                  style={{
                    marginTop: "20px",
                    padding: "15px",
                    borderRadius: "6px",
                    backgroundColor: "#fef2f2",
                    border: "2px solid #ef4444",
                    color: "#991b1b",
                  }}
                >
                  <h3
                    style={{
                      margin: "0 0 10px 0",
                      fontSize: "16px",
                      color: "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    ⚠️ Interdictions de passage à vélo
                  </h3>
                  <p
                    style={{
                      margin: "0 0 12px 0",
                      fontSize: "13px",
                      color: "#7f1d1d",
                    }}
                  >
                    Cet itinéraire contient {restrictedSegments.segments.length}{" "}
                    segment{restrictedSegments.segments.length > 1 ? "s" : ""}{" "}
                    interdit{restrictedSegments.segments.length > 1 ? "s" : ""}{" "}
                    aux vélos (mis en évidence en rouge sur la carte).
                  </p>
                  <div style={{ marginTop: "10px" }}>
                    {restrictedSegments.segments.map((seg, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "8px",
                          marginBottom: "8px",
                          borderRadius: "4px",
                          backgroundColor: "#fee2e2",
                          fontSize: "12px",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: "600",
                            color: "#991b1b",
                            marginBottom: "4px",
                          }}
                        >
                          {seg.name}
                        </div>
                        <div style={{ color: "#7f1d1d", fontSize: "11px" }}>
                          {seg.reason} • {(seg.distance / 1000).toFixed(2)} km
                        </div>
                      </div>
                    ))}
                  </div>
                  <p
                    style={{
                      margin: "12px 0 0 0",
                      fontSize: "12px",
                      color: "#7f1d1d",
                      fontStyle: "italic",
                    }}
                  >
                    💡 Conseil : Modifiez votre itinéraire pour éviter ces
                    sections interdites.
                  </p>
                </div>
              )}
          </>
        )}
        {!searchType && (
          <div
            style={{
              marginTop: "20px",
              padding: "12px",
              borderRadius: "6px",
              backgroundColor: theme === "dark" ? "#2a2a2a" : "#f3f4f6",
              color: theme === "dark" ? "#aaa" : "#666",
              fontSize: "12px",
            }}
          >
            💡 Astuces :
            <br />
            • Clic droit sur la carte pour choisir un point
            <br />
            • Cliquez sur l'itinéraire sans relâcher, déplacez et relâchez
            <br />
            • Tous les points (A, B et intermédiaires) sont déplaçables
            <br />• Cliquez sur un point intermédiaire pour plus d'options
          </div>
        )}
      </div>
    </>
  );
}
