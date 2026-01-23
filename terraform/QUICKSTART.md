# Démarrage Rapide - DigitalOcean

Guide ultra-rapide pour déployer Weather App sur DigitalOcean en 10 minutes.

## Prérequis (5 min)

### 1. Compte DigitalOcean

Créez un compte: [digitalocean.com](https://www.digitalocean.com/)

### 2. Token API

1. Dashboard → **API** → **Generate New Token**
2. Nom: `terraform-weather-app`
3. Permissions: **Read + Write**
4. Copiez le token `dop_v1_xxxxx`

### 3. Clé SSH sur DigitalOcean

**Méthode rapide:**
```bash
export DO_TOKEN="dop_v1_xxxxx"  # Votre token de l'étape 2
cd terraform/scripts
./setup-ssh-key.sh
```

**Ou manuellement:**
1. Allez sur: https://cloud.digitalocean.com/account/security
2. Cliquez sur **Add SSH Key**
3. Collez votre clé: `cat ~/.ssh/id_ed25519.pub`
4. Nommez-la: `weather-app-key`

## Déploiement (5 min)

### 1. Cloner le projet

```bash
git clone https://github.com/ctaque/weather-app-challenge.git
cd weather-app-challenge/terraform
```

### 2. Configurer

**Méthode recommandée: Variables d'environnement**

```bash
cd terraform
cp .env.example .env
nano .env  # ou vim/code
```

**Remplissez ces 3 valeurs OBLIGATOIRES:**

```bash
export TF_VAR_do_token="dop_v1_xxxxx"              # Token de l'étape 2
export TF_VAR_weatherapi_key="your_key_here"        # De weatherapi.com
export TF_VAR_anthropic_api_key="sk-ant-xxxxx"     # De console.anthropic.com
```

**Chargez les variables:**

```bash
source scripts/load-env.sh
```

Le script vérifie automatiquement que toutes les variables requises sont définies.

**Alternative: terraform.tfvars** (méthode classique)

```bash
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars
```

### 3. Déployer

```bash
# Installer Terraform (si pas encore fait)
# macOS: brew install terraform
# Linux: voir README.md

# Charger les variables (si méthode .env)
source scripts/load-env.sh

# Déployer
terraform init
terraform apply
```

Tapez `yes` quand demandé.

**Durée:** 5-10 minutes

**Note:** Si vous utilisez terraform.tfvars, pas besoin de `source scripts/load-env.sh`.

### 4. Accéder à l'app

```bash
# Récupérer l'URL
terraform output app_url

# Ouvrir dans le navigateur
open $(terraform output -raw app_url)  # macOS
xdg-open $(terraform output -raw app_url)  # Linux
```

## Configurer GitHub Actions (optionnel)

Pour déployer automatiquement à chaque push:

### Ajouter les secrets GitHub

**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

1. **DROPLET_IP**
   ```bash
   terraform output -raw droplet_ip
   ```

2. **DO_SSH_PRIVATE_KEY**
   ```bash
   cat ~/.ssh/id_rsa
   # Copier TOUT le contenu
   ```

3. **WEATHERAPI_KEY** - Votre clé WeatherAPI
4. **ANTHROPIC_API_KEY** - Votre clé Anthropic

### Tester

```bash
git add .
git commit -m "Test deployment"
git push origin main
```

Le déploiement se lance automatiquement!

## Commandes Utiles

```bash
# SSH vers le droplet
ssh root@$(terraform output -raw droplet_ip)

# Voir les logs
ssh root@$(terraform output -raw droplet_ip) 'sudo -u weatherapp pm2 logs'

# Redéployer
ssh root@$(terraform output -raw droplet_ip) 'sudo -u weatherapp /home/weatherapp/deploy.sh'

# Redémarrer l'app
ssh root@$(terraform output -raw droplet_ip) 'sudo -u weatherapp pm2 restart all'

# Toutes les commandes
terraform output useful_commands
```

## Coûts

- **Droplet 2GB:** $12/mois (inclut PostgreSQL + Redis)
- **Total:** $12/mois

PostgreSQL et Redis sont installés directement sur le droplet.
Pas de base de données managée = pas de frais supplémentaires!

## Problèmes?

### L'application ne démarre pas

```bash
# Voir les logs d'initialisation
ssh root@$(terraform output -raw droplet_ip) 'tail -f /var/log/cloud-init-output.log'

# Vérifier PM2
ssh root@$(terraform output -raw droplet_ip) 'sudo -u weatherapp pm2 status'
```

### Erreur Terraform

```bash
# Réinitialiser
rm -rf .terraform .terraform.lock.hcl
terraform init
terraform apply
```

### Besoin d'aide?

- Lisez le [README complet](README.md)
- Consultez le [guide de migration](MIGRATION_AWS_TO_DO.md)
- Ouvrez une issue GitHub

## Détruire l'Infrastructure

⚠️ **ATTENTION:** Supprime TOUT de manière irréversible!

```bash
# Sauvegarder d'abord la DB (optionnel)
pg_dump $(terraform output -raw db_connection_uri) > backup.sql

# Détruire
terraform destroy
# Tapez: yes
```

---

**C'est tout! Votre app tourne sur DigitalOcean. 🚀**

Pour aller plus loin:
- [README complet](README.md) - Documentation détaillée
- [Guide de migration AWS](MIGRATION_AWS_TO_DO.md) - Si vous migrez depuis AWS
