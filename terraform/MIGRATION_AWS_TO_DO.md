# Migration de AWS vers DigitalOcean

Ce guide explique la migration complète de l'infrastructure AWS vers DigitalOcean.

## Changements Majeurs

### Infrastructure

**Avant (AWS):**
- EC2 t3.micro (2GB RAM)
- RDS PostgreSQL db.t4g.micro
- S3 pour assets
- CloudWatch pour logs
- Elastic IP

**Après (DigitalOcean):**
- Droplet 2GB RAM (Ubuntu 22.04)
- PostgreSQL Managed Database 1GB
- Redis local sur le droplet
- Logs dans `/home/weatherapp/logs/`
- IP publique du droplet

### Coûts

| Service | AWS (avec Free Tier) | DigitalOcean |
|---------|---------------------|--------------|
| VM | $0-8/mois | $12/mois |
| Database | $0-13/mois | $15/mois |
| Storage | ~$2/mois | Inclus |
| CloudWatch | ~$7/mois | Gratuit (logs locaux) |
| **Total** | **$9-30/mois** | **$27/mois** |

**DigitalOcean** est plus prévisible et simple, sans surprises de facturation.

## Étapes de Migration

### 1. Sauvegarder les Données AWS

```bash
# Sauvegarder la base de données RDS
cd terraform
./backup-db.sh

# Ou manuellement:
pg_dump postgresql://username:password@rds-endpoint:5432/weatherapp > aws-backup.sql
```

### 2. Préparer DigitalOcean

#### a) Créer un compte DigitalOcean

1. Allez sur [digitalocean.com](https://www.digitalocean.com/)
2. Créez un compte
3. Ajoutez un moyen de paiement

#### b) Générer un Token API

1. Dashboard → **API** → **Tokens/Keys**
2. **Generate New Token**
3. Nom: `terraform-weather-app`
4. Permissions: **Read** et **Write**
5. Copiez le token (affiché qu'une seule fois!)

#### c) Préparer votre clé SSH

```bash
# Si vous n'en avez pas encore
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# Vérifier qu'elle existe
ls ~/.ssh/id_rsa.pub
```

### 3. Configurer Terraform pour DigitalOcean

```bash
cd terraform

# Copier le fichier d'exemple
cp terraform.tfvars.example terraform.tfvars

# Éditer avec vos valeurs
nano terraform.tfvars
```

**Fichier `terraform.tfvars`:**

```hcl
# Token DigitalOcean (REQUIS)
do_token = "dop_v1_xxxxxxxxxxxxx"

# Clés API (REQUIS)
weatherapi_key    = "your_weatherapi_key"
anthropic_api_key = "sk-ant-xxxxx"

# Configuration (optionnel)
do_region           = "fra1"  # Frankfurt
droplet_size        = "s-1vcpu-2gb"
db_cluster_size     = "db-s-1vcpu-1gb"
ssh_public_key_path = "~/.ssh/id_rsa.pub"
```

### 4. Initialiser Terraform

```bash
# Nettoyer l'ancien état AWS
rm -rf .terraform .terraform.lock.hcl
rm -f terraform.tfstate terraform.tfstate.backup

# Initialiser avec le provider DigitalOcean
terraform init
```

### 5. Déployer sur DigitalOcean

```bash
# Vérifier le plan
terraform plan

# Appliquer (durée: ~5-10 min)
terraform apply
```

Tapez `yes` pour confirmer.

### 6. Récupérer les Informations

```bash
# IP du droplet
terraform output droplet_ip

# Toutes les informations
terraform output

# Commande SSH
terraform output ssh_command
```

### 7. Restaurer la Base de Données

```bash
# Se connecter au droplet
ssh root@$(terraform output -raw droplet_ip)

# Installer psql (déjà installé normalement)
apt-get install -y postgresql-client

# Restaurer le backup AWS
exit  # Retour sur votre machine

# Copier le backup sur le droplet
scp aws-backup.sql root@$(terraform output -raw droplet_ip):/tmp/

# Restaurer
ssh root@$(terraform output -raw droplet_ip)
psql "$(cat /home/weatherapp/app/.env | grep DATABASE_URL | cut -d= -f2)" < /tmp/aws-backup.sql
```

### 8. Vérifier l'Application

```bash
# Ouvrir dans le navigateur
open $(terraform output -raw app_url)

# Ou tester avec curl
curl $(terraform output -raw app_url)
```

### 9. Configurer GitHub Actions

Ajoutez ces secrets dans GitHub:

**Settings** → **Secrets and variables** → **Actions**

1. **DROPLET_IP**
   ```bash
   terraform output -raw droplet_ip
   # Copiez la valeur
   ```

2. **DO_SSH_PRIVATE_KEY**
   ```bash
   cat ~/.ssh/id_rsa
   # Copiez TOUT (-----BEGIN à -----END-----)
   ```

3. **WEATHERAPI_KEY** - Votre clé WeatherAPI
4. **ANTHROPIC_API_KEY** - Votre clé Anthropic

### 10. Tester le Déploiement CI/CD

```bash
# Push vers main pour déclencher le déploiement
git add .
git commit -m "Test DigitalOcean deployment"
git push origin main
```

Le workflow GitHub Actions va:
1. ✅ Build
2. 📦 Créer archive
3. 📤 Upload sur droplet
4. 🚀 Déployer avec PM2
5. 🏥 Health check

### 11. Détruire l'Infrastructure AWS

⚠️ **ATTENTION:** Ne faites ceci qu'après avoir vérifié que DigitalOcean fonctionne parfaitement!

```bash
# Aller dans le dossier terraform AWS
cd terraform-aws  # Si vous avez gardé l'ancien dossier

# Sauvegarder une dernière fois
./backup-db.sh

# Détruire TOUT
terraform destroy

# Confirmer en tapant: yes
```

**Ressources à supprimer manuellement:**
- Clés SSH dans AWS EC2
- Buckets S3 (si non vides)
- Elastic IPs non attachées
- Snapshots RDS

## Différences Importantes

### Logs

**AWS:** CloudWatch Logs avec Insights, dashboard, alarmes
**DigitalOcean:** Logs locaux dans `/home/weatherapp/logs/`

Pour voir les logs:
```bash
# Via SSH
ssh root@DROPLET_IP 'tail -f /home/weatherapp/logs/*.log'

# PM2 logs
ssh root@DROPLET_IP 'sudo -u weatherapp pm2 logs'
```

### Monitoring

**AWS:** CloudWatch métriques, dashboards, alarmes
**DigitalOcean:** Dashboard DigitalOcean (CPU, RAM, Disk, Network)

Accès: Dashboard → Droplets → Votre droplet → Graphs

### Backups

**AWS:** Snapshots RDS automatiques (7 jours)
**DigitalOcean:** Managed PostgreSQL avec backups automatiques

Backups manuels:
```bash
pg_dump $(terraform output -raw db_connection_uri) > backup.sql
```

### Redis

**AWS:** Redis sur l'instance EC2
**DigitalOcean:** Redis sur le droplet (même chose)

### Nginx

**AWS:** Nginx comme reverse proxy
**DigitalOcean:** Nginx comme reverse proxy (même chose)

### Scaling

**AWS:** Changer le type d'instance EC2/RDS
**DigitalOcean:** Changer la taille du droplet/database

```bash
# Éditer terraform.tfvars
droplet_size = "s-2vcpu-4gb"
db_cluster_size = "db-s-2vcpu-4gb"

# Appliquer (nécessite reboot)
terraform apply
```

## Rollback (Retour sur AWS)

Si vous devez revenir sur AWS:

1. **Gardez vos backups AWS** pendant au moins 1 mois
2. **Gardez le code Terraform AWS** dans une branche séparée
3. **Testez DigitalOcean en staging** avant de migrer la production

Pour rollback:
```bash
# Restaurer le code AWS
git checkout aws-infrastructure

# Réinitialiser Terraform
terraform init

# Redéployer
terraform apply
```

## Troubleshooting

### Le droplet ne répond pas

```bash
# Vérifier dans le dashboard
# DigitalOcean → Droplets → Votre droplet

# Accéder à la console web
# Droplets → Votre droplet → Access → Launch Console
```

### L'application ne démarre pas

```bash
# Voir les logs cloud-init
ssh root@DROPLET_IP 'tail -f /var/log/cloud-init-output.log'

# Voir les logs PM2
ssh root@DROPLET_IP 'sudo -u weatherapp pm2 logs'

# Redémarrer l'app
ssh root@DROPLET_IP 'sudo -u weatherapp pm2 restart all'
```

### Erreur de connexion à la database

```bash
# Vérifier le firewall database
# Dashboard → Databases → Cluster → Settings → Trusted Sources
# Le droplet doit être listé

# Tester la connexion
ssh root@DROPLET_IP
psql "$(cat /home/weatherapp/app/.env | grep DATABASE_URL | cut -d= -f2)"
```

## Support

- **DigitalOcean Community:** [community.digitalocean.com](https://www.digitalocean.com/community)
- **Documentation:** [docs.digitalocean.com](https://docs.digitalocean.com/)
- **Support:** Tickets dans le dashboard (payant selon le plan)

## Questions Fréquentes

### Pourquoi migrer vers DigitalOcean?

- Prix fixe et prévisible ($27/mois vs $9-30/mois AWS)
- Interface plus simple
- Moins de services = moins de complexité
- Support communautaire excellent
- Bonne performance en Europe

### Puis-je utiliser un domaine personnalisé?

Oui! Configurez `domain_name` dans `terraform.tfvars`:

```hcl
domain_name = "weather.example.com"
```

Puis ajoutez un DNS A record pointant vers l'IP du droplet.

### Comment ajouter HTTPS?

Utilisez Let's Encrypt (gratuit):

```bash
ssh root@DROPLET_IP
snap install certbot --classic
certbot --nginx -d your-domain.com
```

Certbot configurera nginx automatiquement.

### Puis-je avoir plusieurs environnements (dev/staging/prod)?

Oui! Créez plusieurs workspaces Terraform:

```bash
terraform workspace new staging
terraform workspace new prod

# Changer d'environnement
terraform workspace select staging
terraform apply
```

Ou utilisez des dossiers séparés.

---

**Migration réussie? N'oubliez pas de détruire l'infrastructure AWS pour éviter les frais!**
