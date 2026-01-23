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

### 3. Clé SSH

```bash
# Générer (si vous n'en avez pas)
ssh-keygen -t rsa -b 4096
# Appuyez sur Entrée 3x pour accepter les valeurs par défaut
```

## Déploiement (5 min)

### 1. Cloner le projet

```bash
git clone https://github.com/ctaque/weather-app-challenge.git
cd weather-app-challenge/terraform
```

### 2. Configurer

```bash
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # ou vim/code
```

**Remplissez ces 3 valeurs OBLIGATOIRES:**

```hcl
do_token = "dop_v1_xxxxx"              # Token de l'étape 2
weatherapi_key = "your_key_here"        # De weatherapi.com
anthropic_api_key = "sk-ant-xxxxx"     # De console.anthropic.com
```

Le reste est optionnel (bonnes valeurs par défaut).

### 3. Déployer

```bash
# Installer Terraform (si pas encore fait)
# macOS: brew install terraform
# Linux: voir README.md

# Déployer
terraform init
terraform apply
```

Tapez `yes` quand demandé.

**Durée:** 5-10 minutes

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

- **Droplet 2GB:** $12/mois
- **PostgreSQL 1GB:** $15/mois
- **Total:** $27/mois

Pas de frais cachés, pas de surprises!

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
