import { MyEventContext } from "@/App";
import { useState, useRef, useEffect, useContext } from "react";

export default function ExportMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { declencherEvenement } = useContext(MyEventContext);

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

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen((v) => !v)} className="theme-toggle">
        Actions
      </button>

      <div className={`dropdown ${open ? "open" : ""}`} style={{ zIndex: 50 }}>
        <button
          onClick={() => {
            declencherEvenement({ type: "save_route", value: null });
            setOpen(false);
          }}
        >
          Enregistrer
        </button>
        <button
          onClick={() => {
            declencherEvenement({ type: "export_gpx", value: null });
            setOpen(false);
          }}
        >
          Exporter .gpx
        </button>
      </div>
    </div>
  );
}
