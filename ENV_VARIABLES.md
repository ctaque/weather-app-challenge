# Variables d'Environnement - Weather App

Liste complète des variables d'environnement utilisées par l'application.

## Variables Requises

### Application (Node.js)

| Variable | Description | Exemple | Source |
|----------|-------------|---------|--------|
| `NODE_ENV` | Environnement d'exécution | `production` | cloud-init.yml |
| `PORT` | Port du serveur Node.js | `3000` | cloud-init.yml |
| `WEATHERAPI_KEY` | Clé API WeatherAPI.com | `df75ec...` | terraform vars |
| `ANTHROPIC_API_KEY` | Clé API Anthropic Claude | `sk-ant-...` | terraform vars |

### Base de Données (PostgreSQL)

| Variable | Description | Exemple | Source |
|----------|-------------|---------|--------|
| `DATABASE_URL` | URL de connexion complète | `postgresql://user:pass@localhost:5432/weatherapp` | cloud-init.yml |
| `DB_HOST` | Hôte PostgreSQL | `localhost` | cloud-init.yml |
| `DB_PORT` | Port PostgreSQL | `5432` | cloud-init.yml |
| `DB_NAME` | Nom de la base | `weatherapp` | terraform vars |
| `DB_USER` | Utilisateur PostgreSQL | `weatherapp_user` | terraform vars |
| `DB_PASSWORD` | Mot de passe PostgreSQL | `WeatherApp2026...` | terraform vars |

### Cache (Redis)

| Variable | Description | Exemple | Source |
|----------|-------------|---------|--------|
| `REDIS_URL` | URL de connexion Redis | `redis://localhost:6379` | cloud-init.yml |

### Frontend

| Variable | Description | Exemple | Source |
|----------|-------------|---------|--------|
| `BACKEND_URL` | URL du backend (pour le frontend) | `http://IP_DROPLET` ou `http://domain.com` | terraform vars (optionnel) |

## Fichier .env Généré

Le fichier `/home/weatherapp/app/.env` est automatiquement créé par cloud-init avec ce contenu:

```bash
NODE_ENV=production
PORT=3000

# API Keys
WEATHERAPI_KEY=${weatherapi_key}
ANTHROPIC_API_KEY=${anthropic_api_key}

# Database (PostgreSQL local)
DATABASE_URL=postgresql://${db_username}:${db_password}@localhost:5432/${db_name}
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${db_name}
DB_USER=${db_username}
DB_PASSWORD=${db_password}

# Redis (local)
REDIS_URL=redis://localhost:6379

# Backend URL
BACKEND_URL=${domain_name != "" ? "http://${domain_name}" : ""}
```

## Configuration Terraform

Ces variables sont définies dans `terraform.tfvars`:

```hcl
# API Keys (REQUIS)
weatherapi_key    = "your_weatherapi_key_here"
anthropic_api_key = "your_anthropic_api_key_here"

# Database (REQUIS)
db_name     = "weatherapp"
db_username = "weatherapp_user"
db_password = "WeatherApp2026SecurePassword!"  # Changez-le!

# Domain (OPTIONNEL)
domain_name = ""  # Laissez vide pour utiliser l'IP du droplet
```

## Variables par Fichier Source

### server.js

```javascript
const PORT = process.env.PORT || 3000;
const WEATHER_KEY = process.env.WEATHERAPI_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const isDevelopment = process.env.NODE_ENV !== "production";
```

**Variables utilisées:**
- ✅ `PORT` - Port du serveur (défaut: 3000)
- ✅ `WEATHERAPI_KEY` - Clé API météo (REQUIS)
- ✅ `ANTHROPIC_API_KEY` - Clé API Claude (REQUIS)
- ✅ `NODE_ENV` - Mode production/dev

### server/redis-client.js

```javascript
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
```

**Variables utilisées:**
- ✅ `REDIS_URL` - Connexion Redis (défaut: localhost)

### Frontend (vite.config.ts / src)

Le frontend peut utiliser `BACKEND_URL` pour les appels API, mais avec le proxy Vite en dev, il n'est pas toujours nécessaire.

## Vérification

### Sur le droplet

Vérifier que toutes les variables sont définies:

```bash
# SSH vers le droplet
ssh root@$(terraform output -raw droplet_ip)

# Voir le fichier .env
sudo cat /home/weatherapp/app/.env

# Vérifier les variables chargées par PM2
sudo -u weatherapp pm2 env 0
```

### Variables manquantes

Si une variable est manquante, l'application peut:
- Ne pas démarrer (WEATHERAPI_KEY, ANTHROPIC_API_KEY)
- Utiliser une valeur par défaut (PORT=3000, REDIS_URL=localhost)
- Planter au runtime (DATABASE_URL manquant)

## Sécurité

### ⚠️ Variables Sensibles

Ces variables contiennent des secrets et **NE DOIVENT PAS** être commitées dans Git:

- ❌ `ANTHROPIC_API_KEY`
- ❌ `WEATHERAPI_KEY`
- ❌ `DB_PASSWORD`
- ❌ `DATABASE_URL` (contient le mot de passe)

### ✅ Protection

1. **terraform.tfvars** est dans `.gitignore`
2. Le fichier `.env` sur le droplet a les permissions `0600` (lecture/écriture owner uniquement)
3. Les outputs Terraform marquent les secrets comme `sensitive = true`

### 🔐 Bonnes Pratiques

```bash
# Générer un mot de passe fort pour PostgreSQL
openssl rand -base64 32

# Vérifier les permissions du .env
ssh root@DROPLET_IP 'ls -la /home/weatherapp/app/.env'
# Devrait afficher: -rw------- (600)

# Rotation des secrets
# 1. Changer dans terraform.tfvars
# 2. terraform apply
# 3. Redémarrer l'app: pm2 restart all
```

## GitHub Actions Secrets

Pour le déploiement automatique, ces secrets doivent être configurés dans GitHub:

**Settings → Secrets and variables → Actions**

| Secret GitHub | Correspondance Variable | Description |
|---------------|------------------------|-------------|
| `DROPLET_IP` | N/A | IP publique du droplet |
| `DO_SSH_PRIVATE_KEY` | N/A | Clé SSH privée pour déploiement |
| `WEATHERAPI_KEY` | `WEATHERAPI_KEY` | Clé API météo |
| `ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` | Clé API Claude |

Note: Les variables de base de données ne sont pas dans GitHub Actions car elles sont déjà configurées sur le droplet via Terraform.

## Debugging

### L'application ne démarre pas

```bash
# Voir les logs PM2
ssh root@DROPLET_IP 'sudo -u weatherapp pm2 logs'

# Vérifier que toutes les variables sont chargées
ssh root@DROPLET_IP 'sudo -u weatherapp bash -c "cd /home/weatherapp/app && cat .env"'

# Tester manuellement
ssh root@DROPLET_IP
sudo -u weatherapp bash
cd /home/weatherapp/app
source .env
node server.js
```

### Variables non chargées

PM2 charge automatiquement le fichier `.env` depuis le dossier de l'app. Si les variables ne sont pas chargées:

1. Vérifier que `.env` existe: `ls -la /home/weatherapp/app/.env`
2. Vérifier le contenu: `cat /home/weatherapp/app/.env`
3. Redémarrer PM2: `pm2 restart all --update-env`

## Ajout de Nouvelles Variables

Si vous ajoutez une nouvelle variable d'environnement:

### 1. Ajouter dans variables.tf (si paramétrable)

```hcl
variable "ma_nouvelle_var" {
  description = "Description"
  type        = string
  default     = "valeur_par_defaut"
}
```

### 2. Ajouter dans cloud-init.yml

```yaml
write_files:
  - path: /home/weatherapp/app/.env
    content: |
      # ... autres variables ...
      MA_NOUVELLE_VAR=${ma_nouvelle_var}
```

### 3. Passer dans templatefile (main.tf)

```hcl
user_data = templatefile("${path.module}/cloud-init.yml", {
  # ... autres variables ...
  ma_nouvelle_var = var.ma_nouvelle_var
})
```

### 4. Redéployer

```bash
terraform apply
# Ou redémarrer l'app si changement mineur
ssh root@DROPLET_IP 'sudo -u weatherapp pm2 restart all --update-env'
```

## Résumé

**Total variables:** 11
- **Requises:** 3 (WEATHERAPI_KEY, ANTHROPIC_API_KEY, DB_PASSWORD)
- **Générées auto:** 7 (NODE_ENV, PORT, DB_HOST, DB_PORT, DB_NAME, DB_USER, REDIS_URL)
- **Optionnelles:** 1 (BACKEND_URL)

Toutes sont configurées automatiquement par Terraform + cloud-init lors du déploiement.
