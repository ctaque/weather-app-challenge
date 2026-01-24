import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { ThemeContext } from "../App";

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SidePanel({ isOpen, onClose }: SidePanelProps) {
  const theme = useContext(ThemeContext);

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
        ></div>
      </div>
    </>
  );
}
