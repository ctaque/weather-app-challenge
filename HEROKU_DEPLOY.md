# Déploiement sur Heroku

## Configuration Redis

L'application utilise Redis pour stocker les données de vent en cache (TTL: 1 heure).

### Redis sur Heroku

L'addon **Upstash Redis** (tier gratuit) est déjà provisionné sur l'application :

```bash
heroku addons --app ancient-shore-88597
```

**Variables d'environnement automatiquement configurées :**
- `UPSTASH_REDIS_URL` : URL de connexion Redis (utilisée par défaut)
- `UPSTASH_REDIS_REST_URL` : URL REST API
- `UPSTASH_REDIS_REST_TOKEN` : Token d'authentification REST

Le code utilise automatiquement `UPSTASH_REDIS_URL` si `REDIS_URL` n'est pas définie.

### Caractéristiques du plan gratuit

- **Stockage** : 256 MB
- **Bande passante** : 1 GB/mois
- **Connexions** : 100 max
- **TLS** : Supporté (rediss://)
- **Persistance** : Oui

Largement suffisant pour le cache de données météo !

## Déploiement

### 1. Vérifier l'application

```bash
heroku apps:info --app ancient-shore-88597
```

### 2. Déployer le code

```bash
git push heroku main
```

### 3. Vérifier les logs

```bash
heroku logs --tail --app ancient-shore-88597
```

### 4. Tester l'application

L'application est accessible sur :
https://ancient-shore-88597-0abf18f860e8.herokuapp.com/

**Endpoints API :**
- `/api/wind-global` : Données de vent JSON
- `/api/windgl/metadata.json` : Métadonnées windgl
- `/api/windgl/wind.png` : Image PNG des vents
- `/api/wind-status` : Statut du scheduler
- `/api/wind-refresh` : Force un refresh manuel (POST)

### 5. Tester Redis

```bash
# Tester la connexion Redis
heroku run node -e "
const { initRedis, isRedisConnected, closeRedis } = require('./server/redis-client.js');
(async () => {
  await initRedis();
  console.log('Connected:', isRedisConnected());
  await closeRedis();
})();
" --app ancient-shore-88597
```

## Configuration des variables d'environnement

```bash
# Voir toutes les variables
heroku config --app ancient-shore-88597

# Ajouter une variable (exemple)
heroku config:set WEATHERAPI_KEY=votre_clé --app ancient-shore-88597
```

**Variables requises :**
- `WEATHERAPI_KEY` : Clé API WeatherAPI (pour les prévisions par ville)
- `UPSTASH_REDIS_URL` : Automatiquement configurée par l'addon

**Variables optionnelles :**
- `ANTHROPIC_API_KEY` : Si vous utilisez l'API Claude
- `NODE_ENV` : production (automatique sur Heroku)

## Scheduler de données de vent

Le scheduler télécharge automatiquement les données GFS toutes les heures via cron :

```javascript
// Exécution : toutes les heures à la 5ème minute
schedule.scheduleJob('5 * * * *', async () => {
  // Télécharge données NOAA GFS via OpenDAP
});
```

**Logs du scheduler :**
```bash
heroku logs --tail --app ancient-shore-88597 | grep "Wind data scheduler"
```

## Surveillance

### Logs en temps réel
```bash
heroku logs --tail --app ancient-shore-88597
```

### Métriques Redis
```bash
heroku addons:open upstash-redis --app ancient-shore-88597
```

### Dashboard Heroku
```bash
heroku open --app ancient-shore-88597
```

## Mise à l'échelle (si nécessaire)

```bash
# Voir les dynos actuels
heroku ps --app ancient-shore-88597

# Mettre à l'échelle (payant)
heroku ps:scale web=2 --app ancient-shore-88597
```

## Redémarrage

```bash
# Redémarrer l'application
heroku restart --app ancient-shore-88597

# Redémarrer uniquement les web dynos
heroku restart web --app ancient-shore-88597
```

## Dépannage

### Redis ne se connecte pas

```bash
# Vérifier les variables Redis
heroku config:get UPSTASH_REDIS_URL --app ancient-shore-88597

# Tester manuellement
heroku run bash --app ancient-shore-88597
> node
> const redis = require('redis');
> const client = redis.createClient({ url: process.env.UPSTASH_REDIS_URL });
> await client.connect();
```

### Données de vent non disponibles

```bash
# Forcer un refresh manuel
curl -X POST https://ancient-shore-88597-0abf18f860e8.herokuapp.com/api/wind-refresh

# Vérifier le statut
curl https://ancient-shore-88597-0abf18f860e8.herokuapp.com/api/wind-status
```

### Erreurs de build

```bash
# Voir les logs de build
heroku logs --tail --app ancient-shore-88597 | grep "build"

# Nettoyer le cache
heroku repo:purge_cache --app ancient-shore-88597
git commit --allow-empty -m "Rebuild"
git push heroku main
```

## Coûts

**Plan actuel : Gratuit**
- Dyno web gratuit (550 heures/mois)
- Upstash Redis gratuit (256 MB)

**Total : 0 €/mois**

L'application peut tourner 24/7 sans frais sur le plan gratuit Heroku tant que le dyno ne dépasse pas 550 heures/mois.

## URLs utiles

- **Application** : https://ancient-shore-88597-0abf18f860e8.herokuapp.com/
- **Dashboard Heroku** : https://dashboard.heroku.com/apps/ancient-shore-88597
- **Redis Dashboard** : Via `heroku addons:open upstash-redis`
- **Logs** : https://dashboard.heroku.com/apps/ancient-shore-88597/logs

---

*Documentation générée le 2026-01-20*
