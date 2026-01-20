# GRIB Wind Data Downloader

Ce module télécharge et décode les données de vent GRIB2 depuis NOAA GFS (Global Forecast System).

## Source des données

- **Source**: NOAA NOMADS (National Operational Model Archive and Distribution System)
- **Modèle**: GFS (Global Forecast System) à 0.5° de résolution
- **URL**: `https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p50.pl`

## Inspiration

Ce module s'inspire du projet [rewind](https://github.com/etaque/rewind) qui utilise également des données GRIB pour visualiser les vents.

## Fonctionnalités

### 1. Téléchargement automatique
- Détecte automatiquement le dernier cycle de prévision disponible (00, 06, 12, 18 UTC)
- Télécharge uniquement les données nécessaires pour la France (-5°W à 10°E, 41°N à 52°N)
- Extrait les composantes U et V du vent à 10m au-dessus du sol

### 2. Décodage GRIB2
- Utilise `grib2-simple` pour décoder les fichiers GRIB2
- Extrait les paramètres météorologiques:
  - UGRD (U-component): Vent est-ouest
  - VGRD (V-component): Vent nord-sud
- Niveau: 10m au-dessus du sol

### 3. Conversion pour windgl
- Génère une image PNG avec les composantes U/V encodées dans les canaux R et G
- Normalisation: -30 m/s à +30 m/s → 0-255
- Format compatible avec la librairie `@astrosat/windgl`

## Format des données

### Métadonnées
```json
{
  "source": "NOAA GFS 0.5° via NOMADS",
  "date": "2026-01-20T12:00:00.000Z",
  "width": 31,
  "height": 23,
  "uMin": -15.2,
  "uMax": 18.7,
  "vMin": -12.3,
  "vMax": 14.5
}
```

### Points de vent (JSON)
```json
{
  "lat": 46.5,
  "lon": 2.5,
  "u": 5.2,
  "v": -3.1,
  "speed": 6.0,
  "direction": 150,
  "gusts": 0
}
```

### Image PNG
- Canal R: Composante U (est-ouest)
- Canal G: Composante V (nord-sud)
- Canal B: Non utilisé (0)
- Canal A: Opaque (255)

## Cache

Les données sont mises en cache pendant 1 heure pour éviter de surcharger les serveurs NOAA.

Cache directory: `.cache/grib/`

## Cycles de prévision GFS

- **00Z**: Disponible vers 03:30 UTC
- **06Z**: Disponible vers 09:30 UTC
- **12Z**: Disponible vers 15:30 UTC
- **18Z**: Disponible vers 21:30 UTC

Le module attend automatiquement 3.5 heures après l'heure du cycle avant de considérer les données comme disponibles.

## Références

- [NOAA NOMADS](https://nomads.ncep.noaa.gov/)
- [GFS Documentation](https://www.nco.ncep.noaa.gov/pmb/products/gfs/)
- [GRIB2 Format](https://en.wikipedia.org/wiki/GRIB)
- [Projet Rewind](https://github.com/etaque/rewind)
