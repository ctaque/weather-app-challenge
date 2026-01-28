import { useState, useRef, useEffect } from "react";
import { Plus, Sun } from "lucide-react";
import { CityForecast } from "../core/WeatherGrid";

export default function WeatherLocatinDropDown({
  setLocation,
  cities,
}: {
  setLocation: (idx: number) => void;
  cities: CityForecast[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
    <div
      ref={ref}
      style={{
        position: "relative",
        display: "inline-block",
        height: "100%",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="theme-toggle"
        style={{ flex: 1, width: "100%" }}
      >
        <div style={innerButtonStyle}>
          <Plus style={{ height: "30px" }} /> ...
        </div>
      </button>

      <div
        className={`dropdown left ${open ? "open" : ""}`}
        style={{ zIndex: 50, width: "13rem" }}
      >
        {(cities || []).map((city: CityForecast, i: number) => {
          if (i > 3) {
            return (
              <button
                onClick={() => {
                  setOpen(false);
                  setLocation(i);
                }}
                style={{ ...innerButtonStyle, padding: ".75rem" }}
                title="Save edits"
                aria-label="Save edits"
              >
                <span className="theme-icon" aria-hidden>
                  <Sun />
                </span>
                <span className="theme-label">{city?.location.name}</span>
              </button>
            );
          } else {
            return null;
          }
        })}
      </div>
    </div>
  );
}
