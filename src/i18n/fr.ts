export const fr = {
  // Header
  appTitle: "Weather App",
  themeDark: "Nuit",
  themeLight: "Jour",
  themeDarkAria: "Activer le thème clair",
  themeLightAria: "Activer le thème sombre",

  // Search form
  searchPlaceholder: "Nom de ville ou 'lat,lon' (ex: London ou 51.5,-0.12)",
  searchButton: "Rechercher",
  loading: "Chargement...",
  useLocation: "Utiliser ma position",
  errorPrefix: "Erreur: ",
  geolocationNotSupported: "Géolocalisation non supportée",

  // Days
  day: "jour",
  days: "jours",

  // Weather display
  humidity: "Humidité",
  wind: "Vent",
  pressure: "Pression",
  currentPressure: "Pression actuelle",
  forecast: "Prévision (cliquez sur un jour pour voir les heures)",
  hourlyForecast: "Prévisions horaires",
  rain: "Pluie",
  maxTemp: "Max",
  minTemp: "Min",
  currentSituation: "Situation actuelle",

  // WeatherGrid
  forecastByCity: "Prévisions par ville",
  chooseLocation: "Choisir une localisation",
  showForecast: "Afficher les prévisions pour",
  now: "Aujourd'hui",
  goToNow: "Aller à l'heure actuelle",
  dayPlus1: "J+1",
  goToDayPlus1: "Aller au jour suivant",
  dayPlus2: "J+2",
  goToDayPlus2: "Aller à J+2",
  loadingInProgress: "Chargement en cours",
  fetchError: "Impossible de récupérer les données météo",
  tenDays: "10 jours (cliquez pour sélectionner)",
  hourlyForecastFor: "Prévisions horaires —",
  hoursFor: "Heures",
  computedFromHours: "Températures issues des heures (recalculées) : min",
  apiValues: "Valeurs API : min",
  map: "Carte",

  // Days of week
  monday: "Lundi",
  tuesday: "Mardi",
  wednesday: "Mercredi",
  thursday: "Jeudi",
  friday: "Vendredi",
  saturday: "Samedi",
  sunday: "Dimanche",

  // Months
  january: "janvier",
  february: "février",
  march: "mars",
  april: "avril",
  may: "mai",
  june: "juin",
  july: "juillet",
  august: "août",
  september: "septembre",
  october: "octobre",
  november: "novembre",
  december: "décembre",

  // Charts
  temperature: "Température",
  rainChance: "Risque de pluie",
  hour: "Heure",
  degrees: "°C",
  percent: "%",
  windSpeed: "Vitesse du vent",
  windDirection: "Direction du vent",
  windDirectionPolar: "Direction du vent (polaire)",
  windDirectionDescription: "Vitesse moyenne du vent par direction pour la journée",
  north: "Nord",
  northNortheast: "Nord-Nord-Est",
  northeast: "Nord-Est",
  eastNortheast: "Est-Nord-Est",
  east: "Est",
  eastSoutheast: "Est-Sud-Est",
  southeast: "Sud-Est",
  southSoutheast: "Sud-Sud-Est",
  south: "Sud",
  southSouthwest: "Sud-Sud-Ouest",
  southwest: "Sud-Ouest",
  westSouthwest: "Ouest-Sud-Ouest",
  west: "Ouest",
  westNorthwest: "Ouest-Nord-Ouest",
  northwest: "Nord-Ouest",
  northNorthwest: "Nord-Nord-Ouest",

  // Language selector
  language: "Langue",
  languageAria: "Changer la langue",

  // Units selector
  unitsAria: "Changer les unités",
  unitsKnotsCelsius: "Nœuds/°C",
  unitsMphFahrenheit: "Mph/°F",
  knots: "nœuds",
  mph: "mph",
  fahrenheit: "°F",
};

export type Translations = typeof fr;
