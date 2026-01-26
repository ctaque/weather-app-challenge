/**
 * Utilitaire pour exporter les données de routage en format GPX
 */

import type { RouteType } from "../types";

/**
 * Échappe les caractères spéciaux XML
 */
function escapeXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Génère un fichier GPX à partir des données de routage GeoJSON
 */
export function generateGPXFromGeoJSON(
  routeData: RouteType,
  routeName?: string,
): string {
  const name = escapeXml(routeName || "Mon itinéraire");
  const timestamp = new Date().toISOString();

  // Extraire les coordonnées du tracé
  const features = routeData.features || [];
  if (features.length === 0) {
    throw new Error("Aucune donnée de tracé trouvée");
  }

  const feature = features[0];
  const coordinates = feature.geometry?.coordinates || [];

  if (coordinates.length === 0) {
    throw new Error("Aucune coordonnée trouvée dans le tracé");
  }

  // Calculer les limites (bounds)
  const lats = coordinates.map((coord) => coord[1]);
  const lons = coordinates.map((coord) => coord[0]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  // Distance et durée totales
  const summary = feature.properties?.summary;
  const totalDistance = summary?.distance
    ? (summary.distance / 1000).toFixed(2)
    : "N/A";
  const totalDuration = summary?.duration
    ? formatDuration(summary.duration)
    : "N/A";

  // Construire le GPX
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="PlanMyTrip - OpenRouteService"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${name}</name>
    <desc>Itinéraire généré avec PlanMyTrip - Distance: ${totalDistance} km, Durée: ${totalDuration}</desc>
    <time>${timestamp}</time>
    <bounds minlat="${minLat}" minlon="${minLon}" maxlat="${maxLat}" maxlon="${maxLon}"/>
  </metadata>
  <trk>
    <name>${name}</name>
    <type>driving</type>
    <trkseg>`;

  // Ajouter tous les points du tracé
  coordinates.forEach((coord) => {
    const lon = coord[0];
    const lat = coord[1];
    const ele = coord[2] !== undefined ? coord[2] : null;

    gpx += `
      <trkpt lat="${lat}" lon="${lon}">`;

    if (ele !== null) {
      gpx += `
        <ele>${ele}</ele>`;
    }

    gpx += `
      </trkpt>`;
  });

  gpx += `
    </trkseg>
  </trk>
</gpx>`;

  return gpx;
}

/**
 * Formate une durée en secondes en format lisible
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min`;
}

/**
 * Télécharge le fichier GPX
 */
export function downloadGPX(gpxContent: string, filename: string): void {
  const blob = new Blob([gpxContent], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".gpx") ? filename : `${filename}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
