import { MyEventContext } from "@/App";
import { useState, useRef, useEffect, useContext } from "react";
import { Save, Download, Plus, ShieldUser } from "lucide-react";
import { Link, useLocation } from "react-router";

export default function ExportMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { declencherEvenement } = useContext(MyEventContext);
  const location = useLocation();
  // Fermer au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const innerButtonStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "flex-start",
    alignContent: "center",
    gap: ".4rem",
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen((v) => !v)} className="theme-toggle">
        <div style={innerButtonStyle}>
          <Plus style={{ height: "30px" }} /> Actions
        </div>
      </button>

      <div
        className={`dropdown ${open ? "open" : ""}`}
        style={{ zIndex: 50, width: "13rem" }}
      >
        {location.pathname.startsWith("/plan") && (
          <>
            <button
              onClick={() => {
                declencherEvenement({ type: "save_route", value: null });
                setOpen(false);
              }}
            >
              <div style={innerButtonStyle}>
                <Save /> Enregistrer
              </div>
            </button>
            <button
              onClick={() => {
                declencherEvenement({ type: "export_gpx", value: null });
                setOpen(false);
              }}
            >
              <div style={innerButtonStyle}>
                <Download /> Exporter .gpx
              </div>
            </button>
          </>
        )}
        {!location.pathname.startsWith("/plan") && (
          <Link
            to="/plan"
            className="hover"
            style={{ ...innerButtonStyle, padding: ".75rem" }}
            onClick={() => {
              setOpen(false);
            }}
          >
            <div style={innerButtonStyle}>
              <Plus /> Planifier
            </div>
          </Link>
        )}
        <Link
          to="/profile"
          className="hover"
          style={{ ...innerButtonStyle, padding: ".75rem" }}
          onClick={() => {
            setOpen(false);
          }}
        >
          <div style={innerButtonStyle}>
            <ShieldUser /> Itinéraires enregistrés
          </div>
        </Link>
      </div>
    </div>
  );
}
