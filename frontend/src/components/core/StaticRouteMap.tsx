import { useRef, useContext, useMemo } from "react";
import { Map, Source, Layer } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RouteType } from "../../types";
import { ThemeContext } from "../../App";

interface StaticRouteMapProps {
  route: RouteType;
  width?: number;
  height?: number;
}

// Fonction pour calculer le niveau de zoom optimal basé sur le bbox
function calculateZoom(bbox: number[], width: number, height: number): number {
  if (!bbox || bbox.length < 4) {
    console.log("Invalid bbox");
    return 12;
  }

  // bbox peut être [minLon, minLat, maxLon, maxLat] (4 éléments)
  // ou [minLon, minLat, minAlt, maxLon, maxLat, maxAlt] (6 éléments avec altitude)
  const minLon = bbox[0];
  const minLat = bbox[1];
  const maxLon = bbox.length === 6 ? bbox[3] : bbox[2];
  const maxLat = bbox.length === 6 ? bbox[4] : bbox[3];

  const lngDiff = Math.abs(maxLon - minLon);
  const latDiff = Math.abs(maxLat - minLat);

  console.log("Bbox parsed:", { minLon, minLat, maxLon, maxLat });
  console.log("lngDiff:", lngDiff, "latDiff:", latDiff);

  if (lngDiff === 0 || latDiff === 0) {
    console.log("Zero difference in bbox");
    return 14;
  }

  // Calcul simple du zoom basé sur les degrés de différence
  const maxDiff = Math.max(lngDiff, latDiff);

  let zoom;
  if (maxDiff > 10) zoom = 5;
  else if (maxDiff > 5) zoom = 6;
  else if (maxDiff > 2) zoom = 7;
  else if (maxDiff > 1) zoom = 8;
  else if (maxDiff > 0.5) zoom = 9;
  else if (maxDiff > 0.25) zoom = 10;
  else if (maxDiff > 0.1) zoom = 11;
  else if (maxDiff > 0.05) zoom = 12;
  else if (maxDiff > 0.025) zoom = 13;
  else if (maxDiff > 0.01) zoom = 14;
  else zoom = 15;

  console.log("Calculated zoom from maxDiff:", maxDiff, "=>", zoom);
  return zoom;
}

export default function StaticRouteMap({
  route,
  width = 300,
  height = 200,
}: StaticRouteMapProps) {
  const mapRef = useRef<MapRef>(null);
  const { theme } = useContext(ThemeContext);

  const mapStyle = useMemo(
    () =>
      theme === "dark"
        ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    [theme],
  );

  // Vérification des données
  if (!route || !route.features || route.features.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-muted)",
          color: "var(--color-muted-foreground)",
        }}
      >
        Carte non disponible
      </div>
    );
  }

  // Prepare GeoJSON data for the route
  const routeGeoJSON = {
    type: "FeatureCollection" as const,
    features: route.features.map((feature) => ({
      type: "Feature" as const,
      geometry: feature.geometry,
      properties: feature.properties,
    })),
  };

  console.log(routeGeoJSON);

  // Gérer bbox avec ou sans altitude (4 ou 6 éléments)
  const minLon = route.bbox ? route.bbox[0] : 0;
  const minLat = route.bbox ? route.bbox[1] : 0;
  const maxLon = route.bbox ? (route.bbox.length === 6 ? route.bbox[3] : route.bbox[2]) : 0;
  const maxLat = route.bbox ? (route.bbox.length === 6 ? route.bbox[4] : route.bbox[3]) : 0;

  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;
  const calculatedZoom = route.bbox
    ? calculateZoom(route.bbox, width, height)
    : 10;

  console.log("Route bbox:", route.bbox);
  console.log("Center:", { centerLon, centerLat });
  console.log("Calculated zoom:", calculatedZoom);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: centerLon,
          latitude: centerLat,
          zoom: calculatedZoom,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        interactive={false}
        attributionControl={false}
      >
        {/* Route line layer */}
        <Source id="route" type="geojson" data={routeGeoJSON}>
          <Layer
            id="route-line"
            type="line"
            paint={{
              "line-color": "#2563eb",
              "line-width": 4,
              "line-opacity": 0.8,
            }}
          />
        </Source>

        {/* Start marker */}
        {route.features[0]?.geometry?.coordinates &&
          route.features[0].geometry.coordinates.length > 0 && (
            <Source
              id="start-point"
              type="geojson"
              data={{
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: route.features[0].geometry.coordinates[0],
                },
                properties: {},
              }}
            >
              <Layer
                id="start-marker"
                type="circle"
                paint={{
                  "circle-radius": 6,
                  "circle-color": "#22c55e",
                  "circle-stroke-width": 2,
                  "circle-stroke-color": "#ffffff",
                }}
              />
            </Source>
          )}

        {/* End marker */}
        {route.features[0]?.geometry?.coordinates &&
          route.features[0].geometry.coordinates.length > 1 && (
            <Source
              id="end-point"
              type="geojson"
              data={{
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates:
                    route.features[0].geometry.coordinates[
                      route.features[0].geometry.coordinates.length - 1
                    ],
                },
                properties: {},
              }}
            >
              <Layer
                id="end-marker"
                type="circle"
                paint={{
                  "circle-radius": 6,
                  "circle-color": "#ef4444",
                  "circle-stroke-width": 2,
                  "circle-stroke-color": "#ffffff",
                }}
              />
            </Source>
          )}
      </Map>
    </div>
  );
}
