import React, { useContext, useMemo, useState } from "react";
import { Map } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { LanguageContext, ThemeContext } from "../App";

export default function MapView() {
  const initialViewState = {
    longitude: 2.3522,
    latitude: 48.8566,
    zoom: 6,
    bearing: 0,
    pitch: 0,
  };

  const [viewState, setViewState] = useState(initialViewState);

  const theme = useContext(ThemeContext);
  const { t } = useContext(LanguageContext);

  const mapStyle = useMemo(
    () =>
      theme === "dark"
        ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    [theme],
  );

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
        }
      );
    } else {
      // Si la géolocalisation n'est pas disponible, revenir à la position par défaut
      setViewState(initialViewState);
    }
  };

  const resetNorth = () => {
    setViewState((prev) => ({ ...prev, bearing: 0, pitch: 0 }));
  };

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
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 85px)" }}>
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        style={{ width: "100%", height: "100%", display: "block" }}
        mapStyle={mapStyle}
      />

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
    </div>
  );
}
