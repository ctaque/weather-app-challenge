import { MyEventContext, useAuth } from "@/App";
import { useState, useRef, useEffect, useContext } from "react";
import { Save, Download, Plus, ShieldUser, Edit, Trash } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";

export default function ExportMenu({
  saveEdits,
  cancelEdits,
  readOnly,
  toggleEdit,
}: {
  saveEdits: () => void;
  cancelEdits: () => void;
  readOnly: boolean;
  toggleEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { declencherEvenement } = useContext(MyEventContext);
  const location = useLocation();
  const navigate = useNavigate();
  // Fermer au clic extérieur
  const [me, loading] = useAuth();
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

  const handleCreateNewRoute = () => {
    // Nettoyer le localStorage
    localStorage.removeItem("saved-route");
    localStorage.removeItem("saved-route-uuid");
    localStorage.removeItem("saved-route-name");

    // Fermer le menu
    setOpen(false);

    // Naviguer vers /plan pour créer un nouveau parcours
    navigate("/plan");

    // Recharger la page pour réinitialiser complètement le composant MapView
    window.location.href = "/plan";
  };

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        display: "inline-block",
        flex: 1,
        width: "100%",
        height: "100%",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="theme-toggle"
        style={{ flex: 1, width: "100%" }}
      >
        <div style={innerButtonStyle}>
          <Plus style={{ height: "30px" }} /> Actions
        </div>
      </button>

      <div
        className={`dropdown ${open ? "open" : ""}`}
        style={{ zIndex: 50, width: "13rem" }}
      >
        {!loading && me && !readOnly && (
          <button
            onClick={() => {
              setOpen(false);
              saveEdits();
            }}
            style={{ ...innerButtonStyle, padding: ".75rem" }}
            title="Save edits"
            aria-label="Save edits"
          >
            <span className="theme-icon" aria-hidden>
              <Save />
            </span>
            <span className="theme-label">Sauvegarder</span>
          </button>
        )}
        {location.pathname.match(
          new RegExp(
            /\/plan\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/edit/gm,
          ),
        ) ? (
          <button
            onClick={() => {
              setOpen(false);
              cancelEdits();
            }}
            style={{ ...innerButtonStyle, padding: ".75rem" }}
            title="Cancel edit intinerary"
            aria-label="Cancel edit itinerary"
          >
            <span className="theme-icon" aria-hidden>
              <Trash />
            </span>
            <span className="theme-label">Annuler l'édition</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setOpen(false);
              toggleEdit();
            }}
            title="Edit intinerary"
            style={{ ...innerButtonStyle, padding: ".75rem" }}
            aria-label="Edit itinerary"
          >
            <span className="theme-icon" aria-hidden>
              <Edit />
            </span>
            <span className="theme-label">Modifier le parcours</span>
          </button>
        )}
        {location.pathname.match(
          new RegExp(
            /\/plan\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gm,
          ),
        ) && (
          <button
            onClick={handleCreateNewRoute}
            style={{ ...innerButtonStyle, padding: ".75rem" }}
            title="Create new route"
            aria-label="Create new route"
          >
            <span className="theme-icon" aria-hidden>
              <Plus />
            </span>
            <span className="theme-label">Créer un itinéraire</span>
          </button>
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
        {me && !loading && (
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
        )}
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
      </div>
    </div>
  );
}
