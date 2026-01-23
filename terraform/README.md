# Déploiement AWS avec Terraform

Infrastructure optimisée pour minimiser les coûts (~12-18€/mois).

## Architecture

- **EC2 t3.micro**: Node.js + Redis (Free Tier eligible)
- **RDS PostgreSQL db.t4g.micro**: Base de données avec sauvegardes
- **S3**: Stockage assets statiques
- **Elastic IP**: IP publique fixe
- **CloudWatch**: Logs et monitoring

## Coûts Estimés (eu-west-3 Paris)

| Service | Type | Coût/mois |
|---------|------|-----------|
| EC2 t3.micro | On-Demand | 0€ (750h Free Tier) ou 8€ |
| RDS db.t4g.micro | PostgreSQL | 0€ (750h Free Tier) ou 13€ |
| EBS gp3 20GB | Stockage EC2 | 2€ |
| RDS Storage 20GB | Stockage DB | 2€ |
| Elastic IP | IP fixe | 0€ (attachée) |
| S3 | Assets | <1€ |
| **Total** | | **4-25€/mois** |

> Free Tier AWS: 12 mois gratuits pour EC2 t3.micro et RDS db.t4g.micro

## Prérequis

### 1. Installer Terraform

```bash
# macOS
brew install terraform

# Linux
wget https://releases.hashicorp.com/terraform/1.7.0/terraform_1.7.0_linux_amd64.zip
unzip terraform_1.7.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

### 2. Configurer AWS CLI

```bash
# Installer AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configurer les credentials
aws configure
```

Vous aurez besoin de:
- AWS Access Key ID
- AWS Secret Access Key
- Region: `eu-west-3`

### 3. Créer une clé SSH

Dans la console AWS EC2 > Key Pairs:
1. Créer une nouvelle paire de clés
2. Télécharger le fichier `.pem`
3. `chmod 400 ~/.ssh/your-key.pem`

## Installation

### 1. Configuration

```bash
cd terraform/

# Copier le fichier d'exemple
cp terraform.tfvars.example terraform.tfvars

# Éditer avec vos valeurs
nano terraform.tfvars
```

**Important**: Modifier ces valeurs dans `terraform.tfvars`:
- `ec2_key_name`: Nom de votre clé SSH AWS
- `db_password`: Mot de passe PostgreSQL fort
- `weatherapi_key`: Votre clé WeatherAPI
- `anthropic_api_key`: Votre clé Anthropic
- `ssh_allowed_ips`: Votre IP publique (sécurité)

### 2. Initialiser Terraform

```bash
terraform init
```

### 3. Vérifier le plan

```bash
terraform plan
```

Vérifiez les ressources qui seront créées.

### 4. Déployer l'infrastructure

```bash
terraform apply
```

Tapez `yes` pour confirmer.

⏱️ Durée: ~10-15 minutes

### 5. Récupérer les informations

```bash
# IP publique de l'EC2
terraform output ec2_public_ip

# Endpoint PostgreSQL
terraform output rds_endpoint

# Bucket S3
terraform output s3_bucket_name

# Commande SSH
terraform output ssh_command
```

## Déploiement de l'Application

### 1. Se connecter à l'EC2

```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_PUBLIC_IP>
```

### 2. Uploader le code

**Option A: Git (recommandé)**

```bash
# Sur l'EC2
sudo su - weatherapp
cd ~/app
git clone https://github.com/votre-username/weather-app.git .
```

**Option B: SCP (depuis votre machine)**

```bash
# Créer une archive
tar -czf app.tar.gz --exclude=node_modules --exclude=dist --exclude=.git .

# Uploader
scp -i ~/.ssh/your-key.pem app.tar.gz ec2-user@<EC2_IP>:/tmp/

# Sur l'EC2
sudo su - weatherapp
cd ~/app
tar -xzf /tmp/app.tar.gz
```

### 3. Installer et démarrer

```bash
# En tant qu'utilisateur weatherapp
cd ~/app

# Installer les dépendances
pnpm install

# Build le frontend
pnpm run build

# Démarrer avec PM2
pm2 start ecosystem.config.js
pm2 save
```

### 4. Vérifier

```bash
# Status PM2
pm2 status

# Logs
pm2 logs

# Nginx status
sudo systemctl status nginx

# Redis status
sudo systemctl status redis6
```

### 5. Accéder à l'application

Ouvrez dans votre navigateur:
```
http://<EC2_PUBLIC_IP>
```

## Sauvegardes PostgreSQL

### Automatiques (RDS)

- **Quotidiennes**: Activées par défaut
- **Rétention**: 7 jours
- **Fenêtre**: 03:00-04:00 UTC
- **Point-in-Time Recovery**: Jusqu'à 5 minutes

### Manuelles

```bash
# Créer un snapshot
aws rds create-db-snapshot \
  --db-instance-identifier weather-app-db \
  --db-snapshot-identifier weather-app-manual-$(date +%Y%m%d)

# Lister les snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier weather-app-db
```

### Restauration

```bash
# Restaurer depuis un snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier weather-app-db-restored \
  --db-snapshot-identifier weather-app-manual-20260123
```

## Monitoring

### CloudWatch Logs

```bash
# Voir les logs
aws logs tail /aws/ec2/weather-app --follow
```

### Métriques RDS

- CPU, Mémoire, Connexions
- Performance Insights (gratuit)
- Alertes CloudWatch

### PM2 Monitoring

```bash
# Sur l'EC2
pm2 monit
```

## Mise à jour de l'application

```bash
# SSH vers EC2
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_IP>

# Exécuter le script de déploiement
sudo su - weatherapp
./deploy.sh
```

Ou manuellement:
```bash
cd ~/app
git pull
pnpm install
pnpm run build
pm2 restart all
```

## Optimisations de Coûts

### 1. Arrêter les instances hors production

```bash
# Arrêter EC2 (économise ~8€/mois)
aws ec2 stop-instances --instance-ids <INSTANCE_ID>

# Arrêter RDS (économise ~13€/mois)
aws rds stop-db-instance --db-instance-identifier weather-app-db
```

> RDS redémarre automatiquement après 7 jours.

### 2. Reserved Instances (engagement 1-3 ans)

- **EC2**: -40% de réduction
- **RDS**: -35% de réduction

### 3. Spot Instances (pour dev/staging uniquement)

- **EC2**: -70% de réduction
- Risque d'interruption

### 4. Supprimer les snapshots anciens

```bash
# Lister les snapshots
aws rds describe-db-snapshots --db-instance-identifier weather-app-db

# Supprimer un snapshot
aws rds delete-db-snapshot --db-snapshot-identifier <SNAPSHOT_ID>
```

## Domaine Personnalisé (Optionnel)

### Avec Route 53

```bash
# Créer une zone hébergée
aws route53 create-hosted-zone --name votre-domaine.com --caller-reference $(date +%s)

# Créer un record A vers l'IP EC2
# (via console AWS Route 53)
```

### Avec SSL/TLS (Let's Encrypt)

```bash
# Sur l'EC2
sudo dnf install -y certbot python3-certbot-nginx

# Obtenir un certificat
sudo certbot --nginx -d votre-domaine.com

# Renouvellement automatique
sudo systemctl enable certbot-renew.timer
```

## Destruction de l'infrastructure

⚠️ **ATTENTION**: Cela supprimera tout!

```bash
# Désactiver la protection de suppression RDS d'abord
aws rds modify-db-instance \
  --db-instance-identifier weather-app-db \
  --no-deletion-protection

# Détruire
terraform destroy
```

## Dépannage

### EC2 ne répond pas

```bash
# Vérifier les logs user-data
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_IP>
sudo cat /var/log/user-data.log

# Redémarrer Nginx
sudo systemctl restart nginx

# Vérifier PM2
sudo su - weatherapp
pm2 status
pm2 logs
```

### RDS inaccessible

```bash
# Vérifier le security group
aws ec2 describe-security-groups --group-ids <RDS_SG_ID>

# Tester la connexion depuis EC2
sudo dnf install -y postgresql15
psql -h <RDS_ENDPOINT> -U weatherapp_user -d weatherapp
```

### Redis ne démarre pas

```bash
# Vérifier le service
sudo systemctl status redis6

# Logs
sudo journalctl -u redis6 -f

# Redémarrer
sudo systemctl restart redis6
```

## Support

Pour toute question:
1. Vérifier les logs CloudWatch
2. Consulter la documentation AWS
3. Ouvrir une issue sur GitHub

## Licence

Voir LICENSE
