import React, { useState } from "react";
import { useContext } from "react";
import { ThemeContext } from "../../App";

interface LayerToggleMenuProps {
  onToggleTerrain: (enabled: boolean) => void;
  onToggleContours: (enabled: boolean) => void;
  onToggleCycleways: (enabled: boolean) => void;
  onToggleSatellite: (enabled: boolean) => void;
  layersState: {
    terrain: boolean;
    contours: boolean;
    thunderforestCycle: boolean;
    satellite: boolean;
  };
}

export default function LayerToggleMenu({
  onToggleTerrain,
  onToggleContours,
  onToggleCycleways,
  onToggleSatellite,
  layersState,
}: LayerToggleMenuProps) {
  const theme = useContext(ThemeContext);
  const [isOpen, setIsOpen] = useState(false);

  const toggleLayer = (
    layerName: "terrain" | "contours" | "thunderforestCycle" | "satellite",
  ) => {
    const newState = !layersState[layerName];
    console.log(`Toggle ${layerName}:`, newState);

    switch (layerName) {
      case "terrain":
        onToggleTerrain(newState);
        break;
      case "contours":
        onToggleContours(newState);
        break;
      case "thunderforestCycle":
        onToggleCycleways(newState);
        break;
      case "satellite":
        onToggleSatellite(newState);
        break;
    }
  };

  const menuStyle: React.CSSProperties = {
    position: "absolute",
    right: "10px",
    top: "148px",
    backgroundColor: theme === "dark" ? "#1a1a1a" : "#ffffff",
    border: `1px solid ${theme === "dark" ? "#444" : "#ddd"}`,
    borderRadius: "4px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
    zIndex: 1,
    overflow: "hidden",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "8px",
    cursor: "pointer",
    width: "36px",
    height: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme === "dark" ? "#fff" : "#333",
    backgroundColor: "transparent",
    border: "none",
  };

  const menuItemStyle = (): React.CSSProperties => ({
    padding: "10px 16px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: theme === "dark" ? "#fff" : "#333",
    backgroundColor: "transparent",
    border: "none",
    width: "100%",
    textAlign: "left",
    fontSize: "14px",
    borderBottom: `1px solid ${theme === "dark" ? "#333" : "#eee"}`,
  });

  const checkboxStyle = (enabled: boolean): React.CSSProperties => ({
    width: "18px",
    height: "18px",
    borderRadius: "3px",
    border: `2px solid ${theme === "dark" ? "#555" : "#ccc"}`,
    backgroundColor: enabled
      ? "#89a480"
      : theme === "dark"
        ? "#2a2a2a"
        : "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  });

  return (
    <div style={menuStyle}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={buttonStyle}
        title="Couches de la carte"
        aria-label="Couches de la carte"
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
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            minWidth: "220px",
            borderTop: `1px solid ${theme === "dark" ? "#333" : "#eee"}`,
          }}
        >
          <button
            onClick={() => toggleLayer("satellite")}
            style={menuItemStyle()}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme === "dark" ? "#2a2a2a" : "#f3f4f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <div style={checkboxStyle(layersState.satellite)}>
              {layersState.satellite && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span>Vue satellite</span>
          </button>

          <button
            onClick={() => toggleLayer("terrain")}
            style={menuItemStyle()}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme === "dark" ? "#2a2a2a" : "#f3f4f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <div style={checkboxStyle(layersState.terrain)}>
              {layersState.terrain && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span>Relief 3D</span>
          </button>

          <button
            onClick={() => toggleLayer("contours")}
            style={menuItemStyle()}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme === "dark" ? "#2a2a2a" : "#f3f4f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <div style={checkboxStyle(layersState.contours)}>
              {layersState.contours && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span>Courbes de niveau</span>
          </button>

          <button
            onClick={() => toggleLayer("thunderforestCycle")}
            style={menuItemStyle()}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme === "dark" ? "#2a2a2a" : "#f3f4f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <div style={checkboxStyle(layersState.thunderforestCycle)}>
              {layersState.thunderforestCycle && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span>Pistes cyclables</span>
          </button>
        </div>
      )}
    </div>
  );
}
