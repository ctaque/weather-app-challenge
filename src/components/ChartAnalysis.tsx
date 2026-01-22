import React, { useContext, useState } from "react";
import ReactMarkdown from "react-markdown";
import Modal from "react-modal";
import { LanguageContext } from "../App";
import claudeLogo from "../img/Claude-ai-logo.png";

// Set app element for accessibility
if (typeof document !== "undefined") {
  Modal.setAppElement("#root");
}

type HourEntry = {
  time: string;
  temp_c: number;
  condition: {
    text: string;
    icon?: string;
  };
  chance_of_rain?: number;
  pressure_mb?: number;
  wind_kph?: number;
  wind_dir?: string;
  wind_degree?: number;
  uv?: number;
  is_day?: number;
};

type DayData = {
  maxtemp_c: number;
  mintemp_c: number;
  condition: {
    text: string;
  };
  daily_chance_of_rain: number;
  pressure_mb: number;
};

type ChartType = "temperature" | "rain" | "pressure" | "wind" | "sunshine";

type Astro = {
  sunrise?: string;
  sunset?: string;
  moonrise?: string;
  moonset?: string;
};

type ChartAnalysisProps = {
  location: string;
  date: string;
  day: DayData;
  hour: HourEntry[];
  chartType: ChartType;
  chartTitle?: string;
  astro?: Astro;
};

export default function ChartAnalysis({
  location,
  date,
  day,
  hour,
  chartType,
  chartTitle,
  astro,
}: ChartAnalysisProps) {
  const { lang, t } = useContext(LanguageContext);
  const [analysis, setAnalysis] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  async function generateAnalysis() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chart-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          weatherData: {
            location,
            date,
            day,
            hour,
            astro,
          },
          lang,
          chartType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate analysis");
      }

      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (err: any) {
      console.error("Error generating chart analysis:", err);
      setError(err.message || "Failed to generate analysis");
    } finally {
      setLoading(false);
    }
  }

  const handleButtonClick = () => {
    setIsModalOpen(true);
    if (!analysis && !loading) {
      generateAnalysis();
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const getIcon = () => {
    switch (chartType) {
      case "temperature":
        return "🌡️";
      case "rain":
        return "🌧️";
      case "pressure":
        return "📊";
      case "wind":
        return "💨";
      case "sunshine":
        return "☀️";
      default:
        return "📊";
    }
  };

  const customModalStyles = {
    overlay: {
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      position: "relative" as const,
      top: "auto",
      left: "auto",
      right: "auto",
      bottom: "auto",
      maxWidth: "600px",
      width: "90%",
      maxHeight: "80vh",
      padding: "0",
      border: "none",
      borderRadius: "12px",
      backgroundColor: "var(--surface-2)",
      boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
      overflow: "hidden",
    },
  };

  return (
    <>
      <button
        onClick={handleButtonClick}
        className="location-button"
        style={{
          padding: "0.5rem 1rem",
          fontSize: "0.875rem",
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          marginRight: "1.5rem",
        }}
        title={
          lang === "fr"
            ? `Analyser ${chartTitle || "ce graphique"} avec l'IA`
            : `Analyze ${chartTitle || "this chart"} with AI`
        }
      >
        <div style={{ display: "flex" }}>
          <span
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: ".5rem",
            }}
          >
            <img src={claudeLogo} style={{ width: "1rem", height: "1rem" }} />
            {lang === "fr" ? "Analyse IA" : "AI Analysis"}
            <span style={{ fontSize: "1rem" }}>{getIcon()}</span>
          </span>
        </div>
      </button>

      <Modal
        isOpen={isModalOpen}
        onRequestClose={handleCloseModal}
        style={customModalStyles}
        contentLabel={
          chartTitle ||
          (lang === "fr" ? "Analyse du graphique" : "Chart Analysis")
        }
      >
        <div
          style={{
            padding: "1.5rem",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--surface-2)",
          }}
        >
          <h3
            style={{
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "var(--text-color)",
            }}
          >
            <span>{getIcon()}</span>
            {chartTitle ||
              (lang === "fr" ? "Analyse du graphique" : "Chart Analysis")}
          </h3>
          <button
            onClick={handleCloseModal}
            style={{
              background: "none",
              border: "none",
              fontSize: "2rem",
              cursor: "pointer",
              padding: "0",
              lineHeight: 1,
              color: "var(--text-color)",
              opacity: 0.6,
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
            title={lang === "fr" ? "Fermer" : "Close"}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: "1.5rem",
            maxHeight: "calc(80vh - 100px)",
            overflowY: "auto",
          }}
        >
          {loading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
                padding: "2rem",
              }}
            >
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  border: "3px solid var(--accent)",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              <span style={{ color: "var(--text-color)", fontSize: "1rem" }}>
                {lang === "fr" ? "Analyse en cours..." : "Analyzing..."}
              </span>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "1rem",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "8px",
                color: "#dc2626",
              }}
            >
              <strong>
                {lang === "fr"
                  ? "Erreur lors de l'analyse"
                  : "Error during analysis"}
              </strong>
              <p style={{ margin: "0.5rem 0 0 0" }}>{error}</p>
            </div>
          )}

          {!loading && !error && analysis && (
            <div
              style={{
                lineHeight: "1.7",
                color: "var(--text-color)",
                fontSize: "0.95rem",
              }}
            >
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
          )}

          {!loading && !error && !analysis && (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <p style={{ color: "var(--muted)" }}>
                {lang === "fr"
                  ? "Aucune analyse disponible"
                  : "No analysis available"}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
