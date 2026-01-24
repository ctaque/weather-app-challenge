import React, { useContext, useState } from "react";
import { ThemeContext } from "../App";

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

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  startPoint: Location | null;
  endPoint: Location | null;
  waypoints: Waypoint[];
  onSetStartPoint: (location: Location) => void;
  onSetEndPoint: (location: Location) => void;
  onReorderWaypoints: (waypoints: Waypoint[]) => void;
  onRemoveWaypoint: (waypointId: string) => void;
  onReverseRoute: () => void;
  onClearRoute: () => void;
  routeInfo: { distance: number; duration: number } | null;
  waypointCount: number;
  isCalculating: boolean;
  isPlacingWaypoint: boolean;
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
  waypointCount,
  isCalculating,
  isPlacingWaypoint,
}: SidePanelProps) {
  const theme = useContext(ThemeContext);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"start" | "end">("start");
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [draggedWaypointIndex, setDraggedWaypointIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before');

  const searchAddress = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=5`
      );
      const data = await response.json();
      setSearchResults(
        data.map((item: any) => ({
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          display_name: item.display_name,
        }))
      );
    } catch (error) {
      console.error("Erreur de recherche:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const selectLocation = (location: Location) => {
    if (searchType === "start") {
      onSetStartPoint(location);
    } else {
      onSetEndPoint(location);
    }
    setSearchResults([]);
    setSearchQuery("");
  };

  const handleWaypointDragStart = (index: number) => {
    setDraggedWaypointIndex(index);
  };

  const handleWaypointDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();

    // Calculer si le curseur est dans la moitié supérieure ou inférieure
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    const position = y < height / 2 ? 'before' : 'after';

    setDragOverIndex(index);
    setDropPosition(position);
  };

  const handleWaypointDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleWaypointDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedWaypointIndex === null) return;

    const newWaypoints = [...waypoints];
    const draggedWaypoint = newWaypoints[draggedWaypointIndex];

    // Retirer l'élément déplacé
    newWaypoints.splice(draggedWaypointIndex, 1);

    // Calculer la nouvelle position en tenant compte de la suppression
    let insertIndex = targetIndex;
    if (draggedWaypointIndex < targetIndex) {
      insertIndex = targetIndex - 1;
    }

    // Ajuster selon si on veut placer avant ou après
    if (dropPosition === 'after') {
      insertIndex += 1;
    }

    newWaypoints.splice(insertIndex, 0, draggedWaypoint);

    onReorderWaypoints(newWaypoints);
    setDraggedWaypointIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedWaypointIndex(null);
    setDragOverIndex(null);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px",
    borderRadius: "6px",
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
      {/* Side Panel */}
      <div
        style={{
          position: "fixed",
          top: "4rem",
          left: isOpen ? 0 : "-380px",
          bottom: "1rem",
          width: "320px",
          backgroundColor: "var(--brand)",
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
            }}
          >
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
        <div style={{ marginBottom: "20px" }}>
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
          {startPoint ? (
            <div
              style={{
                padding: "10px",
                borderRadius: "6px",
                backgroundColor: theme === "dark" ? "#2a2a2a" : "#f3f4f6",
                color: theme === "dark" ? "#fff" : "#333",
                fontSize: "13px",
                marginBottom: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ flex: 1, marginRight: "8px" }}>
                {startPoint.display_name.split(",").slice(0, 2).join(",")}
              </span>
              <button
                onClick={() => onSetStartPoint(null as any)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: "18px",
                  padding: "0",
                }}
              >
                ×
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                <input
                  type="text"
                  placeholder="Rechercher une adresse..."
                  value={searchType === "start" ? searchQuery : ""}
                  onChange={(e) => {
                    setSearchType("start");
                    setSearchQuery(e.target.value);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && searchAddress()}
                  style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                />
                <button
                  onClick={searchAddress}
                  disabled={isSearching}
                  style={{
                    ...buttonStyle,
                    width: "auto",
                    padding: "10px 15px",
                  }}
                >
                  🔍
                </button>
              </div>
            </>
          )}
        </div>

        {/* Point d'arrivée */}
        <div style={{ marginBottom: "20px" }}>
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
          {endPoint ? (
            <div
              style={{
                padding: "10px",
                borderRadius: "6px",
                backgroundColor: theme === "dark" ? "#2a2a2a" : "#f3f4f6",
                color: theme === "dark" ? "#fff" : "#333",
                fontSize: "13px",
                marginBottom: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ flex: 1, marginRight: "8px" }}>
                {endPoint.display_name.split(",").slice(0, 2).join(",")}
              </span>
              <button
                onClick={() => onSetEndPoint(null as any)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: "18px",
                  padding: "0",
                }}
              >
                ×
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                <input
                  type="text"
                  placeholder="Rechercher une adresse..."
                  value={searchType === "end" ? searchQuery : ""}
                  onChange={(e) => {
                    setSearchType("end");
                    setSearchQuery(e.target.value);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && searchAddress()}
                  style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                />
                <button
                  onClick={searchAddress}
                  disabled={isSearching}
                  style={{
                    ...buttonStyle,
                    width: "auto",
                    padding: "10px 15px",
                  }}
                >
                  🔍
                </button>
              </div>
            </>
          )}
        </div>

        {/* Résultats de recherche */}
        {searchResults.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <p
              style={{
                margin: "0 0 10px 0",
                color: theme === "dark" ? "#aaa" : "#666",
                fontSize: "13px",
              }}
            >
              Résultats :
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
          </div>
        )}

        {/* Liste des points de passage */}
        {startPoint && endPoint && (
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
              <button
                onClick={onReverseRoute}
                style={{
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: theme === "dark" ? "#2a2a2a" : "#f3f4f6",
                  color: theme === "dark" ? "#fff" : "#333",
                  cursor: "pointer",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                title="Inverser l'itinéraire"
              >
                🔄 Inverser
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Point de départ */}
              <div
                style={{
                  padding: "10px",
                  borderRadius: "6px",
                  backgroundColor: theme === "dark" ? "#2a2a2a" : "#f3f4f6",
                  border: `2px solid ${theme === "dark" ? "#10b981" : "#10b981"}`,
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
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
              </div>

              {/* Waypoints draggables */}
              {waypoints.map((waypoint, index) => (
                <React.Fragment key={waypoint.id}>
                  {/* Indicateur de drop AVANT */}
                  {dragOverIndex === index &&
                   dropPosition === 'before' &&
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
                    draggable
                    onDragStart={() => handleWaypointDragStart(index)}
                    onDragOver={(e) => handleWaypointDragOver(e, index)}
                    onDragLeave={handleWaypointDragLeave}
                    onDrop={(e) => handleWaypointDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    style={{
                      padding: "10px",
                      borderRadius: "6px",
                      backgroundColor: theme === "dark" ? "#2a2a2a" : "#f3f4f6",
                      border: `2px solid ${
                        dragOverIndex === index && draggedWaypointIndex !== null && draggedWaypointIndex !== index
                          ? "#f59e0b"
                          : theme === "dark" ? "#f59e0b" : "#f59e0b"
                      }`,
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      cursor: "move",
                      opacity: draggedWaypointIndex === index ? 0.3 : 1,
                      transform: draggedWaypointIndex === index ? "scale(0.95)" : "scale(1)",
                      transition: "transform 0.2s ease, opacity 0.2s ease",
                      boxShadow: dragOverIndex === index && draggedWaypointIndex !== null && draggedWaypointIndex !== index
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
                  </div>
                  {/* Indicateur de drop APRES */}
                  {dragOverIndex === index &&
                   dropPosition === 'after' &&
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

              {/* Point d'arrivée */}
              <div
                style={{
                  padding: "10px",
                  borderRadius: "6px",
                  backgroundColor: theme === "dark" ? "#2a2a2a" : "#f3f4f6",
                  border: `2px solid ${theme === "dark" ? "#ef4444" : "#ef4444"}`,
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
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
              </div>
            </div>
          </div>
        )}

        {/* Indicateur de placement de waypoint */}
        {isPlacingWaypoint && (
          <div
            style={{
              marginTop: "20px",
              padding: "15px",
              borderRadius: "6px",
              backgroundColor: "#f59e0b",
              color: "#fff",
              textAlign: "center",
              animation: "pulse 2s ease-in-out infinite",
            }}
          >
            <div style={{ marginBottom: "8px", fontSize: "24px" }}>📍</div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "500" }}>
              L'itinéraire se met à jour en temps réel
            </p>
            <p style={{ margin: "5px 0 0 0", fontSize: "12px", opacity: 0.9 }}>
              Relâchez pour valider • Échap pour annuler
            </p>
          </div>
        )}

        {/* Indicateur de calcul */}
        {isCalculating && startPoint && endPoint && !isPlacingWaypoint && (
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
        {routeInfo && !isCalculating && (
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
                <strong>Distance :</strong> {(routeInfo.distance / 1000).toFixed(2)} km
              </p>
              <p style={{ margin: "5px 0", fontSize: "14px" }}>
                <strong>Durée :</strong> {Math.round(routeInfo.duration / 60)} min
              </p>
              {waypointCount > 0 && (
                <p style={{ margin: "5px 0", fontSize: "14px" }}>
                  <strong>Points intermédiaires :</strong> {waypointCount}
                </p>
              )}
            </div>
            <button
              onClick={onClearRoute}
              style={{
                ...buttonStyle,
                marginTop: "10px",
                backgroundColor: theme === "dark" ? "#2a2a2a" : "#f3f4f6",
                color: theme === "dark" ? "#fff" : "#333",
                border: `1px solid ${theme === "dark" ? "#444" : "#ddd"}`,
              }}
            >
              Réinitialiser l'itinéraire
            </button>
          </>
        )}

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
          <br />
          • Cliquez sur un point intermédiaire pour plus d'options
        </div>
      </div>
    </>
  );
}
