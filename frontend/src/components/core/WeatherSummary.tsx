import React, { useContext, useState } from "react";
import ReactMarkdown from "react-markdown";
import { LanguageContext } from "../../App";
import Loader from "./Loader";

type HourEntry = {
  time: string;
  temp_c: number;
  condition: {
    text: string;
    icon?: string;
  };
  chance_of_rain?: number;
  wind_kph?: number;
  wind_dir?: string;
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

type WeatherSummaryProps = {
  location: string;
  date: string;
  day: DayData;
  hour: HourEntry[];
};

export default function WeatherSummary({
  location,
  date,
  day,
  hour,
}: WeatherSummaryProps) {
  const { lang, t } = useContext(LanguageContext);
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function generateSummary() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/weather-summary", {
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
          },
          lang,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate summary");
      }

      const data = await response.json();
      setSummary(data.summary);
    } catch (err: any) {
      console.error("Error generating weather summary:", err);
      setError(err.message || "Failed to generate summary");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        marginTop: "1.5rem",
        padding: "1rem",
        borderRadius: "8px",
        border: "1px solid var(--border-color)",
        flex: 1,
      }}
    >
      {error && (
        <div
          style={{
            padding: "0.75rem",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "4px",
            color: "#dc2626",
          }}
        >
          {t.errorGeneratingSummary || "Erreur lors de la génération"}: {error}
        </div>
      )}

      {!loading && !error && summary && (
        <div
          style={{
            lineHeight: "1.6",
            color: "var(--text-color)",
          }}
        >
          <ReactMarkdown>{summary}</ReactMarkdown>
        </div>
      )}

      {!error && !summary && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <h4
            style={{
              margin: 0,
              marginBottom: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>🤖</span>
            {t.aiSummary || "Résumé IA"}
          </h4>
          <button
            onClick={generateSummary}
            className="location-button"
            style={{
              padding: "0.75rem 1.5rem",
              whiteSpace: "nowrap",
              width: "fit-ccontent",
              display: "block",
              background: "transparent",
              border: "none",
              margin: "0 auto",
              boxShadow: "none",
            }}
          >
            <Loader width={150} text="IA" spin={loading} />
          </button>
          <p>
            {loading
              ? "Génération du résumé..."
              : "Cliquez pour générer le résumé IA des prévisons"}{" "}
          </p>
        </div>
      )}
    </div>
  );
}
