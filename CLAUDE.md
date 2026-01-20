# Documentation du Projet Weather App avec Visualisation des Vents

## Vue d'ensemble

Cette application météo affiche des prévisions pour différentes villes et une **carte interactive des vents en temps réel** pour la France, utilisant des données NOAA GFS 0.5° actualisées toutes les heures.

## Table des matières

1. [Architecture](#architecture)
2. [Problèmes Rencontrés et Solutions](#problèmes-rencontrés-et-solutions)
3. [Système de Données de Vent](#système-de-données-de-vent)
4. [Configuration](#configuration)
5. [Endpoints API](#endpoints-api)
6. [Composants Frontend](#composants-frontend)
7. [Déploiement](#déploiement)

---

## Architecture

### Stack Technique

**Backend:**
- Node.js + Express
- Redis (stockage des données de vent)
- node-cron (planification des téléchargements)
- OpenDAP (protocole d'accès aux données NOAA)

**Frontend:**
- React + TypeScript
- Vite (dev server et build)
- MapLibre GL (cartes interactives, gratuit)
- windgl (visualisation des particules de vent)

**Données:**
- Source: NOAA GFS 0.5° (Global Forecast System)
- Protocole: OpenDAP via HTTPS
- Résolution: 0.5° (environ 50km)
- Zone couverte: France (0-15°E, 41-52°N)
- Mise à jour: Toutes les heures

### Flux de Données

```
NOAA GFS (OpenDAP)
    ↓
server/opendap-downloader.js
    ↓ (parse ASCII)
Redis (cache 1h)
    ↓
/api/windgl/metadata.json + /api/windgl/wind.png
    ↓
windgl (MapLibre layer)
    ↓
Particules animées sur la carte
```

---

## Problèmes Rencontrés et Solutions

### 1. Parser GRIB2 Incompatible

**Problème:**
```
PRODUCT_DEFINITION_TEMPLATE_NOT_SUPPORTED: 7.13
```
La bibliothèque `grib2-simple` ne supporte pas le template GRIB2 7.13 utilisé par NOAA GFS.

**Solution:**
Migration vers **OpenDAP** (Data Access Protocol) qui fournit les données en format ASCII via HTTP, beaucoup plus simple à parser et plus fiable.

**Fichiers modifiés:**
- `server/opendap-downloader.js` - Nouveau downloader OpenDAP
- `server/wind-data-scheduler.js` - Utilise OpenDAP au lieu de GRIB

### 2. Wraparound des Longitudes

**Problème:**
La zone France (-5° à 10°E) croise le méridien de Greenwich, créant un wraparound dans les indices OpenDAP (710 à 20 au lieu de 710 à 720).

**Erreur OpenDAP:**
```
Bad Projection Request: stop >= size
```

**Solution:**
Ajustement de la zone à 0-15°E pour éviter le wraparound. Cette modification perd 5° à l'ouest mais couvre toujours 95% de la France.

```javascript
// Avant: -5° à 10°E → indices 710 à 20 (wraparound!)
// Après: 0° à 15°E → indices 0 à 30 (continu)
const needsWrap = lonMin < 0 && lonMax > 0;
if (needsWrap) {
  const adjustedLonMin = 0;
  const adjustedLonMax = 15;
}
```

### 3. Stockage Binaire dans Redis

**Problème:**
```
TypeError: redis.getBuffer is not a function
```
Le client Redis v5 ne supporte pas `getBuffer()` de manière simple.

**Solution:**
Encodage en **Base64** avant stockage, décodage lors de la récupération.

```javascript
// Stockage
async function setBinaryData(buffer, key) {
  const base64Data = buffer.toString('base64');
  await redis.setEx(key, REDIS_TTL, base64Data);
}

// Récupération
async function getBinaryData(key) {
  const base64Data = await redis.get(key);
  return Buffer.from(base64Data, 'base64');
}
```

### 4. Parser OpenDAP ASCII

**Problème:**
OpenDAP renvoie plusieurs fois lat/lon dans la réponse, causant des doublons.

**Format OpenDAP:**
```
ugrd10m, [1][23][31]
[0][0], 17.16, 17.22, ...
lat, [23]
-52.0, -51.5, -51.0, ...
lat, [23]  ← Répété!
-52.0, -51.5, -51.0, ...
```

**Solution:**
Utilisation d'un flag `parsedVars` pour ne parser chaque variable qu'une seule fois.

```javascript
let parsedVars = { lat: false, lon: false, ugrd: false, vgrd: false };

if (trimmed.startsWith('lat,')) {
  if (!parsedVars.lat) {
    currentVariable = 'lat';
    parsedVars.lat = true;
  }
}
```

### 5. CORS et Proxy Vite

**Problème:**
L'URL des tuiles pointait vers `http://localhost:3000` (backend), mais le navigateur sur le port 5173 (Vite) ne pouvait pas y accéder à cause de CORS.

**Solution:**
Utilisation d'une **URL relative** `/api/windgl/wind.png` qui passe par le proxy Vite en développement.

```javascript
// Avant
tiles: [`http://localhost:${PORT}/api/windgl/wind.png`]

// Après
const backendUrl = process.env.BACKEND_URL || '';
const tileUrl = backendUrl ? `${backendUrl}/api/windgl/wind.png` : '/api/windgl/wind.png';
tiles: [tileUrl]
```

### 6. Import MapLibre dans Vite

**Problème:**
```
Could not load react-map-gl/dist/esm/index.js/maplibre
```
Conflit entre l'alias Vite et l'import `/maplibre`.

**Solution:**
Import de `maplibregl` séparément et utilisation de la prop `mapLib`.

```tsx
// Avant
import Map from "react-map-gl/maplibre";

// Après
import Map from "react-map-gl";
import maplibregl from "maplibre-gl";

<Map mapLib={maplibregl} ... />
```

---

## Système de Données de Vent

### Structure des Données

**Point de vent individuel:**
```typescript
{
  lat: number,      // Latitude (-52 à -41)
  lon: number,      // Longitude (0 à 15)
  u: number,        // Composante U (Est-Ouest) en m/s
  v: number,        // Composante V (Nord-Sud) en m/s
  speed: number,    // Vitesse = sqrt(u² + v²)
  direction: number,// Direction en degrés
  gusts: number     // Rafales (non disponible, = 0)
}
```

**Données complètes dans Redis:**
```javascript
// Clé: wind:points
{
  timestamp: "2026-01-20T14:00:00.000Z",
  source: "NOAA GFS 0.5° via OpenDAP",
  resolution: 0.5,
  points: [...], // 713 points (23 lat × 31 lon)
  region: "France",
  bounds: {
    lat: [41, 52],
    lon: [-5, 10]
  }
}

// Clé: wind:png
// PNG 31×23 pixels RGBA encodé en base64
// Canaux: R=U, G=V, B=0, A=255

// Clé: wind:metadata
{
  source: "NOAA GFS 0.5° via OpenDAP",
  date: "2026-01-20T14:00:00.000Z",
  width: 31,
  height: 23,
  uMin: 3.48,
  uMax: 18.25,
  vMin: -5.73,
  vMax: 8.18
}
```

### Scheduler

**Fréquence:** Toutes les heures à la 5ème minute (5 * * * *)

**Logique:**
1. Détermine le run GFS le plus récent (00Z, 06Z, 12Z, 18Z)
2. Attend 3.5h après le run pour que les données soient disponibles
3. Télécharge U/V à 10m pour forecast offset +3h
4. Parse et convertit en PNG
5. Stocke dans Redis avec TTL 1h

**Fichier:** `server/wind-data-scheduler.js`

---

## Configuration

### Variables d'environnement (.env)

```bash
# API Keys
WEATHERAPI_KEY=your_weatherapi_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Backend URL (optionnel, défaut: URL relative)
# En production, définir l'URL complète du backend
# BACKEND_URL=https://your-backend.com

# Redis
REDIS_URL=redis://localhost:6379
```

### Configuration Vite (vite.config.ts)

```typescript
server: {
  proxy: {
    "/api": {
      target: "http://localhost:3000",
      changeOrigin: true,
      secure: false,
    },
  },
}
```

### Nodemon (package.json)

```json
"dev:server": "nodemon --max-old-space-size=16000 server.js --watch server.js --watch server/"
```

**Important:** Surveille maintenant le dossier `server/` pour redémarrer automatiquement.

---

## Endpoints API

### GET /api/wind-global

Retourne toutes les données de vent en JSON.

**Réponse:**
```json
{
  "timestamp": "2026-01-20T14:00:00.000Z",
  "source": "NOAA GFS 0.5° via OpenDAP",
  "resolution": 0.5,
  "points": [...],
  "region": "France",
  "bounds": { "lat": [41, 52], "lon": [-5, 10] }
}
```

### GET /api/windgl/metadata.json

Métadonnées pour windgl.

**Réponse:**
```json
{
  "source": "NOAA GFS 0.5° via OpenDAP",
  "date": "2026-01-20T14:00:00.000Z",
  "width": 31,
  "height": 23,
  "uMin": 3.48,
  "uMax": 18.25,
  "vMin": -5.73,
  "vMax": 8.18,
  "tiles": ["/api/windgl/wind.png"]
}
```

### GET /api/windgl/wind.png

Image PNG 31×23 pixels RGBA des composantes de vent.

**Format:** Canal R = U, Canal G = V (normalisés 0-255)

### GET /api/wind-status

Statut du scheduler.

**Réponse:**
```json
{
  "running": true,
  "lastFetch": {
    "success": true,
    "timestamp": "2026-01-20T14:00:00.000Z",
    "dataPoints": 713
  }
}
```

### POST /api/wind-refresh

Force un rafraîchissement manuel des données.

**Réponse:**
```json
{
  "success": true,
  "status": { ... }
}
```

---

## Composants Frontend

### WindHeatmap.tsx

Composant principal de visualisation des vents.

**Props:**
```typescript
interface WindHeatmapProps {
  location?: {
    lat: number;
    lon: number;
    name?: string;
  };
}
```

**État:**
- `showParticles` - Particules animées (défaut: true)
- `showHeatmap` - Carte de chaleur
- `showArrows` - Flèches de direction

**Layers windgl:**
1. **Particles** - 3000 particules animées, colorées par vitesse
2. **Heatmap** - Remplissage coloré par vitesse
3. **Arrows** - Flèches blanches indiquant la direction

**Gradient de couleurs:**
- 0 m/s: Bleu (#3288bd)
- 10 m/s: Turquoise (#66c2a5)
- 20 m/s: Jaune (#fee08b)
- 30 m/s: Orange (#f46d43)
- 40+ m/s: Rouge (#d53e4f)

---

## Déploiement

### Développement

```bash
# Installer les dépendances
npm install

# Démarrer Redis
redis-server

# Lancer l'application
npm run dev
```

**Ports:**
- Frontend (Vite): http://localhost:5173
- Backend (Express): http://localhost:3000
- Redis: localhost:6379

### Production

```bash
# Build frontend
npm run build

# Démarrer serveur
npm start
```

**Configuration production:**

1. **Variable BACKEND_URL**: Définir l'URL complète du backend
   ```bash
   BACKEND_URL=https://api.votredomaine.com
   ```

2. **Redis**: Utiliser Redis Cloud ou service géré
   ```bash
   REDIS_URL=redis://username:password@host:port
   ```

3. **Serveur statique**: Express sert automatiquement `dist/`

### Heroku

Le projet est configuré pour Heroku:

```json
"heroku-postbuild": "npm run build",
"start": "node --max-old-space-size=16000 server.js"
```

**Buildpacks requis:**
- Node.js
- Redis (addon)

---

## Tests

### Test des données Redis

```bash
node test-redis-data.js
```

**Sortie attendue:**
```
✓ Wind points found: 713 points
✓ PNG data found: 1406 bytes
✓ Metadata found
✓ Last update: success
```

### Test OpenDAP

```bash
node test-opendap-downloader.js
```

### Test des endpoints

```bash
# Métadonnées
curl -s http://localhost:3000/api/windgl/metadata.json | jq .

# PNG
curl -s http://localhost:3000/api/windgl/wind.png | file -

# Données JSON
curl -s http://localhost:3000/api/wind-global | jq '.points | length'
```

---

## Fichiers Clés

### Backend
- `server.js` - Serveur Express principal
- `server/opendap-downloader.js` - Téléchargement et parsing OpenDAP
- `server/wind-data-scheduler.js` - Planification des mises à jour
- `server/redis-client.js` - Client Redis avec stockage base64

### Frontend
- `src/components/WindHeatmap.tsx` - Composant de carte
- `src/App.tsx` - Application principale
- `vite.config.ts` - Configuration Vite avec proxy

### Configuration
- `package.json` - Scripts et dépendances
- `.env.example` - Variables d'environnement
- `claude.md` - Cette documentation

---

## Dépannage

### Les particules ne s'affichent pas

1. **Vérifier les données:**
   ```bash
   curl http://localhost:3000/api/windgl/metadata.json
   ```

2. **Vérifier la console navigateur** (F12)
   - Erreurs de chargement?
   - Erreurs windgl?

3. **Forcer le rafraîchissement:**
   ```bash
   curl -X POST http://localhost:3000/api/wind-refresh
   ```

4. **Vider le cache navigateur** (Ctrl+Shift+R)

### Redis vide

```bash
# Lancer Redis
redis-server

# Tester la connexion
redis-cli ping

# Forcer le téléchargement
curl -X POST http://localhost:3000/api/wind-refresh
```

### Nodemon ne redémarre pas

```bash
# Dans le terminal nodemon
rs [Entrée]

# Ou modifier package.json pour surveiller server/
"--watch server.js --watch server/"
```

### Erreur CORS

Vérifier que le proxy Vite est configuré dans `vite.config.ts` et que l'URL des tuiles est **relative** (`/api/windgl/wind.png`) et non absolue.

---

## Améliorations Futures

### Fonctionnalités
- [ ] Support de zones géographiques multiples
- [ ] Prévisions sur plusieurs horizons temporels (+6h, +12h, etc.)
- [ ] Données de rafales (nécessite autre source)
- [ ] Export des données en GeoJSON
- [ ] Animations de l'évolution temporelle

### Technique
- [ ] Compression des données PNG (WebP?)
- [ ] Cache navigateur intelligent
- [ ] Préchargement des prochaines prévisions
- [ ] WebSocket pour mises à jour temps réel
- [ ] Support multi-résolution (0.25°, 1°)

### UX
- [ ] Sélecteur de région
- [ ] Timeline interactive
- [ ] Légende dynamique
- [ ] Tooltips sur survol
- [ ] Mode plein écran

---

## Crédits

**Données:** NOAA GFS (National Oceanic and Atmospheric Administration)
**Visualisation:** windgl by Astrosat
**Cartes:** MapLibre GL + Carto basemaps
**Backend:** Express + Redis
**Frontend:** React + Vite

**Licence:** Voir LICENSE file

---

*Documentation générée le 2026-01-20*
