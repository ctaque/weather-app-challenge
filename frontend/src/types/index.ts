// Type pour la réponse de l'API de routage (OpenRouteService)
export interface RouteType {
  bbox: number[];
  features: Feature[];
  metadata: Metadata;
  type: string;
}

// Type pour les données sauvegardées localement
export interface SavedRouteData {
  startPoint?: {
    lat: number;
    lon: number;
    display_name: string;
  };
  endPoint?: {
    lat: number;
    lon: number;
    display_name: string;
  };
  waypoints?: Array<{
    id: string;
    lat: number;
    lon: number;
  }>;
  transportMode?: string;
  timestamp?: string;
  apiResponse?: RouteType; // La réponse complète de l'API de routage
}

export interface Feature {
  bbox: number[];
  geometry: Geometry;
  properties: Properties;
  type: string;
}

export interface Geometry {
  coordinates: number[][];
  type: string;
}

export interface Properties {
  ascent: number;
  descent: number;
  extras: Extras;
  segments: Segment[];
  summary: Summary5;
  warnings: Warning[];
  way_points: number[];
}

export interface Extras {
  roadaccessrestrictions: Roadaccessrestrictions;
  steepness: Steepness;
  surface: Surface;
  waytype: Waytype;
}

export interface Roadaccessrestrictions {
  summary: Summary[];
  values: number[][];
}

export interface Summary {
  amount: number;
  distance: number;
  value: number;
}

export interface Steepness {
  summary: Summary2[];
  values: number[][];
}

export interface Summary2 {
  amount: number;
  distance: number;
  value: number;
}

export interface Surface {
  summary: Summary3[];
  values: number[][];
}

export interface Summary3 {
  amount: number;
  distance: number;
  value: number;
}

export interface Waytype {
  summary: Summary4[];
  values: number[][];
}

export interface Summary4 {
  amount: number;
  distance: number;
  value: number;
}

export interface Segment {
  ascent: number;
  descent: number;
  distance: number;
  duration: number;
  steps: Step[];
}

export interface Step {
  distance: number;
  duration: number;
  instruction: string;
  name: string;
  type: number;
  way_points: number[];
  exit_number?: number;
}

export interface Summary5 {
  distance: number;
  duration: number;
}

export interface Warning {
  code: number;
  message: string;
}

export interface Metadata {
  attribution: string;
  engine: Engine;
  query: Query;
  service: string;
  timestamp: number;
}

export interface Engine {
  build_date: string;
  graph_date: string;
  osm_date: string;
  version: string;
}

export interface Query {
  coordinates: number[][];
  elevation: boolean;
  extra_info: string[];
  format: string;
  instructions: boolean;
  language: string;
  profile: string;
  profileName: string;
}
