# Weather App - Infrastructure Terraform (DigitalOcean)

Infrastructure as Code pour déployer Weather App sur DigitalOcean.

## Architecture

L'infrastructure déploie:

- **Droplet** (VM Ubuntu 22.04) avec:
  - Node.js 20
  - pnpm + PM2
  - PostgreSQL 16 (installé localement)
  - Redis (installé localement)
  - nginx (reverse proxy)

- **Firewall** configuré pour HTTP, HTTPS, SSH

**Note:** PostgreSQL et Redis sont installés directement sur le droplet pour réduire les coûts.

## Prérequis

### 1. Compte DigitalOcean

Créez un compte sur [DigitalOcean](https://www.digitalocean.com/)

### 2. Token API DigitalOcean

1. Connectez-vous à DigitalOcean
2. Allez dans **API** → **Tokens/Keys**
3. Cliquez sur **Generate New Token**
4. Nommez-le "terraform-weather-app"
5. Sélectionnez **Read** et **Write**
6. Copiez le token (il ne sera affiché qu'une fois!)

### 3. Clé SSH sur DigitalOcean

Vous devez avoir une clé SSH dans votre compte DigitalOcean.

**Option 1: Upload automatique (recommandé)**

```bash
# Définir votre token DO
export DO_TOKEN="dop_v1_xxxxxxxxxxxxx"

# Utiliser le script d'upload
cd terraform/scripts
./setup-ssh-key.sh
```

**Option 2: Upload manuel**

1. Allez sur: https://cloud.digitalocean.com/account/security
2. Cliquez sur **Add SSH Key**
3. Collez votre clé publique:
   ```bash
   cat ~/.ssh/id_ed25519.pub  # ou ~/.ssh/id_rsa.pub
   ```
4. Nommez-la: `weather-app-key`

**Si vous n'avez pas de clé SSH:**

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
# Appuyez sur Entrée pour accepter les valeurs par défaut
```

### 4. Terraform installé

```bash
# macOS
brew install terraform

# Linux
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# Vérifier
terraform version
```

## Installation

### 1. Cloner le projet

```bash
git clone https://github.com/ctaque/weather-app-challenge.git
cd weather-app-challenge/terraform
```

### 2. Configurer les variables

```bash
# Copier le fichier d'exemple
cp terraform.tfvars.example terraform.tfvars

# Éditer avec vos valeurs
nano terraform.tfvars
```

**Variables requises dans `terraform.tfvars`:**

```hcl
# Token API DigitalOcean
do_token = "dop_v1_xxxxxxxxxxxxx"

# Clés API
weatherapi_key    = "your_weatherapi_key"
anthropic_api_key = "sk-ant-xxxxx"

# SSH Key - Nom de la clé dans votre compte DigitalOcean
ssh_key_name = "weather-app-key"  # Doit exister sur DO

# Région (optionnel - par défaut fra1)
do_region = "fra1"

# Domain (optionnel)
domain_name = ""  # Laissez vide pour utiliser l'IP
```

### 3. Initialiser Terraform

```bash
terraform init
```

### 4. Vérifier le plan

```bash
terraform plan
```

Terraform affichera toutes les ressources qui seront créées.

### 5. Déployer l'infrastructure

```bash
terraform apply
```

Tapez `yes` pour confirmer.

**Durée:** ~5-10 minutes (la base de données prend du temps à provisionner)

### 6. Récupérer les informations

```bash
# IP du droplet
terraform output droplet_ip

# Toutes les informations
terraform output

# Commande SSH
terraform output ssh_command
```

## Utilisation

### Se connecter au droplet

```bash
# Via Terraform output
$(terraform output -raw ssh_command)

# Ou directement
ssh root@<DROPLET_IP>
```

### Vérifier l'application

```bash
# Se connecter en tant que weatherapp user
ssh root@<DROPLET_IP> -t 'sudo -u weatherapp bash'

# Voir le statut PM2
pm2 status

# Voir les logs
pm2 logs

# Ou depuis votre machine
terraform output -json useful_commands | jq -r '.pm2_status'
```

### Déployer une nouvelle version

Utilisez le script de déploiement:

```bash
ssh root@<DROPLET_IP> 'sudo -u weatherapp /home/weatherapp/deploy.sh'

# Ou via Terraform output
$(terraform output -raw deployment_script)
```

### Accéder à l'application

```bash
# Récupérer l'URL
terraform output app_url

# Ouvrir dans le navigateur
open $(terraform output -raw app_url)
```

## GitHub Actions

Le déploiement automatique est configuré dans `.github/workflows/deploy-digitalocean.yml`

### Configuration requise

Ajoutez ces secrets dans GitHub:

**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

1. **DROPLET_IP**: L'IP publique du droplet (récupérée avec `terraform output droplet_ip`)
2. **DO_SSH_PRIVATE_KEY**: Votre clé SSH privée complète

```bash
# Récupérer votre clé privée
cat ~/.ssh/id_rsa
# Copiez TOUT le contenu (de -----BEGIN à -----END-----)
```

3. **WEATHERAPI_KEY**: Votre clé WeatherAPI
4. **ANTHROPIC_API_KEY**: Votre clé Anthropic

### Déclenchement

Le déploiement se lance automatiquement à chaque push sur `main`:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Le workflow va:
1. ✅ Build l'application
2. 📦 Créer une archive
3. 📤 Uploader sur le droplet
4. 🚀 Déployer avec PM2
5. 🏥 Health check

## Gestion

### Mettre à jour l'infrastructure

```bash
# Modifier variables.tf ou main.tf
nano variables.tf

# Appliquer les changements
terraform plan
terraform apply
```

### Redimensionner le droplet

```bash
# Éditer terraform.tfvars
droplet_size = "s-2vcpu-4gb"  # 4GB RAM au lieu de 2GB

# Appliquer (nécessite redémarrage du droplet!)
terraform apply
```

### Redimensionner la base de données

```bash
# Éditer terraform.tfvars
db_cluster_size = "db-s-2vcpu-4gb"

# Appliquer (peut prendre plusieurs minutes)
terraform apply
```

### Sauvegarder la base de données

```bash
# Utiliser le script de backup automatique (s'exécute tous les jours à 2h)
ssh root@<DROPLET_IP> 'sudo -u weatherapp /home/weatherapp/backup-db.sh'

# Ou manuellement
ssh root@<DROPLET_IP>
sudo -u postgres pg_dump weatherapp > /home/weatherapp/backups/manual-backup.sql

# Télécharger le backup localement
scp root@<DROPLET_IP>:/home/weatherapp/backups/db-backup-*.sql ./
```

### Restaurer une sauvegarde

```bash
# Depuis le droplet
ssh root@<DROPLET_IP>
sudo -u postgres psql weatherapp < /path/to/backup.sql

# Depuis votre machine
cat backup.sql | ssh root@<DROPLET_IP> 'sudo -u postgres psql weatherapp'
```

## Monitoring

### Logs de l'application

```bash
# Via SSH
ssh root@<DROPLET_IP> 'tail -f /home/weatherapp/logs/*.log'

# PM2 logs
ssh root@<DROPLET_IP> 'sudo -u weatherapp pm2 logs'
```

### Métriques du droplet

Disponibles dans le **DigitalOcean Dashboard**:
- Droplets → Votre droplet → Graphs

Affiche:
- CPU usage
- Memory usage
- Disk I/O
- Network traffic

### Monitoring de PostgreSQL

```bash
# Statut du service
ssh root@<DROPLET_IP> 'systemctl status postgresql'

# Se connecter à PostgreSQL
ssh root@<DROPLET_IP> 'sudo -u postgres psql weatherapp'

# Voir les bases de données
ssh root@<DROPLET_IP> 'sudo -u postgres psql -l'

# Voir les connexions actives
ssh root@<DROPLET_IP> "sudo -u postgres psql -c 'SELECT * FROM pg_stat_activity;'"
```

## Coûts

### Infrastructure mensuelle

| Ressource | Taille | Prix/mois |
|-----------|--------|-----------|
| Droplet | 2GB RAM, 1 vCPU | $12 |
| PostgreSQL | Installé sur droplet | $0 |
| Redis | Installé sur droplet | $0 |
| Bandwidth | 2TB inclus | $0 |
| **Total** | | **$12/mois** |

### Optimisation des coûts

Pour réduire encore les coûts en dev:

```hcl
# Dans terraform.tfvars
environment = "dev"
droplet_size = "s-1vcpu-1gb"      # $6/mois au lieu de $12
```

**Dev:** $6/mois
**Production:** $12/mois (configuration actuelle)

## Détruire l'infrastructure

⚠️ **ATTENTION**: Ceci supprime TOUT de manière irréversible!

```bash
# Sauvegarder d'abord la base de données!
./backup-db.sh

# Détruire
terraform destroy

# Confirmer en tapant: yes
```

## Dépannage

### Le droplet ne répond pas

```bash
# Vérifier le statut via DigitalOcean Dashboard
# Droplets → Votre droplet → Status

# Redémarrer via console DigitalOcean
# Dashboard → Droplets → Power → Reboot
```

### L'application ne démarre pas

```bash
# Se connecter et vérifier les logs
ssh root@<DROPLET_IP>
sudo -u weatherapp pm2 logs

# Vérifier nginx
systemctl status nginx

# Vérifier Redis
systemctl status redis-server

# Vérifier cloud-init (première installation)
tail -f /var/log/cloud-init-output.log
```

### Erreur de connexion à la base de données

```bash
# Vérifier le firewall de la base
# Dashboard → Databases → Votre cluster → Settings → Trusted Sources
# Le droplet doit être listé

# Tester la connexion
ssh root@<DROPLET_IP>
psql $(cat /home/weatherapp/app/.env | grep DATABASE_URL | cut -d= -f2)
```

### Terraform state corrompu

```bash
# Sauvegarder le state actuel
cp terraform.tfstate terraform.tfstate.backup

# Rafraîchir le state
terraform refresh

# En dernier recours, réimporter
terraform import digitalocean_droplet.app <DROPLET_ID>
```

## Ressources

- [Terraform DigitalOcean Provider](https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs)
- [DigitalOcean Documentation](https://docs.digitalocean.com/)
- [cloud-init Documentation](https://cloudinit.readthedocs.io/)

## Support

Pour des questions ou problèmes:
1. Vérifier les logs sur le droplet
2. Consulter le DigitalOcean Dashboard
3. Ouvrir une issue GitHub

---

**Créé avec ❤️ et Terraform**
