# Démarrage Rapide - Déploiement AWS

Guide en 5 étapes pour déployer votre application weather-app sur AWS.

⏱️ **Temps total**: ~30 minutes
💰 **Coût**: 4€/mois (Free Tier) puis ~26€/mois

## Prérequis

- [ ] Compte AWS (Free Tier disponible)
- [ ] Carte bancaire (pour validation AWS)
- [ ] Terminal Linux/macOS (ou WSL sur Windows)
- [ ] Git installé

## Étape 1: Installer les Outils (5 min)

```bash
# 1. Installer Terraform
# macOS
brew install terraform

# Linux
wget https://releases.hashicorp.com/terraform/1.7.0/terraform_1.7.0_linux_amd64.zip
unzip terraform_1.7.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# 2. Installer AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# 3. Vérifier les installations
terraform --version
aws --version
```

## Étape 2: Configurer AWS (5 min)

### 2.1 Créer un utilisateur IAM

1. Aller sur [Console IAM AWS](https://console.aws.amazon.com/iam/)
2. **Users** → **Add users**
3. Nom: `terraform-user`
4. Cocher **Access key - Programmatic access**
5. Permissions: **AdministratorAccess** (pour simplifier)
6. **Télécharger les credentials CSV** ⚠️ Sauvegarder précieusement

### 2.2 Configurer AWS CLI

```bash
aws configure
```

Entrer:
- **Access Key ID**: (depuis le CSV)
- **Secret Access Key**: (depuis le CSV)
- **Region**: `eu-west-3` (Paris)
- **Output format**: `json`

### 2.3 Créer une clé SSH

```bash
# Dans la console AWS EC2 > Key Pairs
# https://eu-west-3.console.aws.amazon.com/ec2/home?region=eu-west-3#KeyPairs:

# Ou via CLI:
aws ec2 create-key-pair \
  --key-name weather-app-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/weather-app-key.pem

chmod 400 ~/.ssh/weather-app-key.pem
```

## Étape 3: Configurer Terraform (5 min)

```bash
cd terraform/

# Copier le fichier exemple
cp terraform.tfvars.example terraform.tfvars

# Éditer avec vos valeurs
nano terraform.tfvars
```

**Modifier ces lignes dans `terraform.tfvars`:**

```hcl
# AWS Configuration
aws_region  = "eu-west-3"
environment = "prod"

# EC2
ec2_instance_type = "t3.micro"
ec2_key_name      = "weather-app-key"  # ← Nom de votre clé SSH
ssh_allowed_ips   = ["1.2.3.4/32"]     # ← VOTRE IP PUBLIQUE!

# RDS
db_password = "VotreMotDePasseSecure123!"  # ← Mot de passe FORT

# API Keys
weatherapi_key    = "votre_cle_weatherapi"
anthropic_api_key = "sk-ant-api03-..."

# Domain (optionnel)
domain_name = ""  # Laisser vide pour l'instant
```

**Trouver votre IP publique:**
```bash
curl ifconfig.me
```

## Étape 4: Déployer l'Infrastructure (10 min)

```bash
# Initialiser Terraform
terraform init

# Voir ce qui va être créé
terraform plan

# Déployer (taper "yes" quand demandé)
terraform apply
```

⏳ **Patience**: 10-15 minutes

**À la fin, notez:**
```bash
# IP publique de votre serveur
terraform output ec2_public_ip

# Exemple: 35.180.123.45
```

## Étape 5: Déployer l'Application (10 min)

### 5.1 Se connecter à l'EC2

```bash
# Récupérer l'IP
EC2_IP=$(cd terraform && terraform output -raw ec2_public_ip)

# Se connecter
ssh -i ~/.ssh/weather-app-key.pem ec2-user@$EC2_IP
```

### 5.2 Uploader le code

**Option A: Via Git (recommandé)**

```bash
# Sur votre machine locale - Push vers GitHub
git add .
git commit -m "Ready for deployment"
git push origin main

# Sur l'EC2
sudo su - weatherapp
cd ~/app
git clone https://github.com/VOTRE_USERNAME/weather-app.git .
```

**Option B: Via SCP**

```bash
# Sur votre machine locale
cd /home/cyprien/projets/weather-app
tar -czf app.tar.gz \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=.git \
  --exclude=terraform \
  .

scp -i ~/.ssh/weather-app-key.pem app.tar.gz ec2-user@$EC2_IP:/tmp/

# Sur l'EC2
sudo su - weatherapp
cd ~/app
tar -xzf /tmp/app.tar.gz
```

### 5.3 Installer et démarrer

```bash
# Sur l'EC2, en tant que weatherapp
cd ~/app

# Installer les dépendances
pnpm install

# Build le frontend
pnpm run build

# Démarrer avec PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Suivre les instructions
```

### 5.4 Vérifier que ça fonctionne

```bash
# Status
pm2 status

# Logs
pm2 logs

# Vérifier Nginx
sudo systemctl status nginx

# Vérifier Redis
sudo systemctl status redis6
```

## Étape 6: Accéder à l'Application

Ouvrez votre navigateur:

```
http://<EC2_PUBLIC_IP>
```

Par exemple: `http://35.180.123.45`

🎉 **C'est en ligne!**

## Commandes Utiles

### Se reconnecter à l'EC2

```bash
ssh -i ~/.ssh/weather-app-key.pem ec2-user@$(cd terraform && terraform output -raw ec2_public_ip)
```

### Mettre à jour l'application

```bash
# SSH vers l'EC2
ssh -i ~/.ssh/weather-app-key.pem ec2-user@<EC2_IP>

# Devenir weatherapp
sudo su - weatherapp

# Mise à jour
cd ~/app
git pull
pnpm install
pnpm run build
pm2 restart all
```

### Voir les logs

```bash
# Logs Node.js
pm2 logs

# Logs Nginx
sudo tail -f /var/log/nginx/error.log

# Logs Redis
sudo tail -f /var/log/redis6/redis6.log

# Logs système
sudo tail -f /var/log/user-data.log
```

### Sauvegarder la base de données

```bash
# Sur votre machine locale
cd terraform/
./backup-db.sh
```

### Arrêter/Démarrer les services

```bash
# Arrêter EC2 (économiser $$)
aws ec2 stop-instances --instance-ids $(terraform output -raw ec2_instance_id)

# Démarrer EC2
aws ec2 start-instances --instance-ids $(terraform output -raw ec2_instance_id)

# Arrêter RDS (économiser $$$)
aws rds stop-db-instance --db-instance-identifier weather-app-db

# Démarrer RDS
aws rds start-db-instance --db-instance-identifier weather-app-db
```

## Ajouter un Domaine Personnalisé (Optionnel)

### Avec un domaine existant

1. **Pointer votre domaine vers l'IP EC2:**

   ```
   Type: A
   Name: @
   Value: <EC2_PUBLIC_IP>
   TTL: 300
   ```

2. **Installer SSL/TLS:**

   ```bash
   # Sur l'EC2
   sudo dnf install -y certbot python3-certbot-nginx

   sudo certbot --nginx -d votre-domaine.com

   # Renouvellement automatique
   sudo systemctl enable certbot-renew.timer
   ```

3. **Mettre à jour Terraform:**

   ```hcl
   # Dans terraform.tfvars
   domain_name = "votre-domaine.com"
   ```

### Avec Route 53 (DNS AWS)

```bash
# Créer une zone hébergée
aws route53 create-hosted-zone \
  --name votre-domaine.com \
  --caller-reference $(date +%s)

# Puis configurer via la console AWS
```

## Coûts Mensuels

| Service | Free Tier (12 mois) | Après |
|---------|---------------------|-------|
| EC2 t3.micro | 0€ | 8,35€ |
| RDS db.t4g.micro | 0€ | 13,14€ |
| Storage (40GB) | 4€ | 4€ |
| S3 + Data Transfer | 0€ | 1€ |
| **TOTAL** | **~4€/mois** | **~26€/mois** |

**Optimisations possibles**: Voir `terraform/cost-optimization.md`

## Dépannage

### L'application ne répond pas

```bash
# Vérifier les processus
pm2 status

# Redémarrer
pm2 restart all

# Vérifier Nginx
sudo systemctl status nginx
sudo systemctl restart nginx
```

### Cannot connect to EC2 via SSH

```bash
# Vérifier le security group
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=weather-app-ec2-sg"

# Vérifier que votre IP est autorisée
# Modifier terraform.tfvars et refaire apply
```

### Base de données inaccessible

```bash
# Tester depuis l'EC2
psql -h $(terraform output -raw rds_address) \
     -U weatherapp_user \
     -d weatherapp
```

### Redis ne fonctionne pas

```bash
# Redémarrer Redis
sudo systemctl restart redis6

# Logs
sudo journalctl -u redis6 -f
```

## Nettoyage (Supprimer Tout)

⚠️ **ATTENTION**: Cela supprimera TOUT (serveur, base de données, sauvegardes)

```bash
cd terraform/

# Désactiver la protection de suppression
aws rds modify-db-instance \
  --db-instance-identifier weather-app-db \
  --no-deletion-protection

# Détruire l'infrastructure
terraform destroy
```

Taper `yes` pour confirmer.

## Prochaines Étapes

- [ ] Configurer les sauvegardes automatiques S3
- [ ] Ajouter un domaine personnalisé
- [ ] Configurer CloudFront pour CDN
- [ ] Mettre en place monitoring avec CloudWatch
- [ ] Optimiser les coûts (Reserved Instances)

## Support

En cas de problème:

1. Vérifier les logs (PM2, Nginx, CloudWatch)
2. Consulter `terraform/README.md` pour documentation détaillée
3. Ouvrir une issue sur GitHub

---

**Félicitations!** 🎉 Votre application est maintenant en production sur AWS!
