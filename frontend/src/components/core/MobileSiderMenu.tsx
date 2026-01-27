import { useContext } from "react";
import { LanguageContext, ThemeContext, UnitSystem } from "../../App";
import { Language, Translations } from "@/i18n";
import { LanguagesIcon, MoonIcon, SunIcon } from "lucide-react";
import ExportMenu from "../ui/MenuSave";

interface SidePanelProps {
  isOpen: boolean;
  toggleTheme: () => void;
  toggleLanguage: () => void;
  toggleUnits: () => void;
  lang: Language;
  t: Translations;
  units: UnitSystem;
  setMobileMenuOpen: () => void;
}

export default function MobileSiderPanel({
  isOpen,
  toggleUnits,
  toggleTheme,
  toggleLanguage,
  units,
}: SidePanelProps) {
  const theme = useContext(ThemeContext);
  const { t, lang } = useContext(LanguageContext);
  return (
    <div
      style={{
        position: "fixed",
        top: "4rem",
        right: isOpen ? "1rem" : "-380px",
        bottom: "1rem",
        width: "320px",
        backgroundColor: "#89a380",
        boxShadow: "2px 0 10px rgba(0, 0, 0, 0.3)",
        zIndex: 1000,
        transition: "right 0.3s ease-in-out",
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
          flexDirection: "column",
          gap: "1rem",
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
          }}
        >
          Menu
        </h2>
        <ExportMenu />
        <button
          onClick={toggleLanguage}
          className="theme-toggle mobile"
          title={t.languageAria}
          aria-label={t.languageAria}
        >
          <span className="theme-icon" aria-hidden>
            <LanguagesIcon />
          </span>
          <span className="theme-label">{lang.toUpperCase()}</span>
        </button>
        <button
          aria-pressed={theme === "dark"}
          onClick={toggleTheme}
          className="theme-toggle mobile"
          title={theme === "dark" ? t.themeDarkAria : t.themeLightAria}
          aria-label={theme === "dark" ? t.themeDarkAria : t.themeLightAria}
        >
          <span className="theme-icon" aria-hidden>
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </span>
          <span className="theme-label">
            {theme === "dark" ? t.themeDark : t.themeLight}
          </span>
        </button>
        <button
          onClick={toggleUnits}
          className="theme-toggle mobile"
          title={t.unitsAria}
          aria-label={t.unitsAria}
        >
          <span className="theme-label">
            {units === "knots-celsius"
              ? t.unitsKnotsCelsius
              : t.unitsMphFahrenheit}
          </span>
        </button>
      </div>
    </div>
  );
}
