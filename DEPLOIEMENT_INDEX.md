# 📑 Index - Documentation Déploiement AWS

Guide de navigation dans toute la documentation de déploiement.

## 🎯 Par où commencer ?

### Vous êtes débutant avec AWS ?
👉 Commencez par **[QUICK_START_AWS.md](QUICK_START_AWS.md)** (30 min)

### Vous connaissez AWS et Terraform ?
👉 Lisez **[README_DEPLOYMENT.md](README_DEPLOYMENT.md)** puis **[terraform/README.md](terraform/README.md)**

### Vous voulez comprendre l'architecture ?
👉 Consultez **[terraform/ARCHITECTURE.md](terraform/ARCHITECTURE.md)**

### Vous cherchez à réduire les coûts ?
👉 Voir **[terraform/cost-optimization.md](terraform/cost-optimization.md)**

---

## 📚 Documentation Complète

### Guides de Démarrage

| Fichier | Description | Niveau | Durée |
|---------|-------------|--------|-------|
| **[QUICK_START_AWS.md](QUICK_START_AWS.md)** | Guide pas-à-pas complet | Débutant | 30 min |
| **[README_DEPLOYMENT.md](README_DEPLOYMENT.md)** | Vue d'ensemble déploiement | Intermédiaire | 10 min |
| **[terraform/README.md](terraform/README.md)** | Documentation Terraform détaillée | Intermédiaire | 20 min |

### Documentation Technique

| Fichier | Description | Contenu |
|---------|-------------|---------|
| **[terraform/ARCHITECTURE.md](terraform/ARCHITECTURE.md)** | Diagramme d'architecture | Schéma infrastructure, flux de données, composants |
| **[terraform/main.tf](terraform/main.tf)** | Infrastructure Terraform | VPC, EC2, RDS, S3, Security Groups |
| **[terraform/variables.tf](terraform/variables.tf)** | Variables configurables | Tous les paramètres modifiables |
| **[terraform/outputs.tf](terraform/outputs.tf)** | Outputs Terraform | IP publique, endpoints, connection strings |

### Configuration

| Fichier | Description | Usage |
|---------|-------------|-------|
| **[terraform/terraform.tfvars.example](terraform/terraform.tfvars.example)** | Configuration exemple | Copier et modifier avec vos valeurs |
| **[.env.production.example](.env.production.example)** | Variables environnement | Pour l'application sur EC2 |
| **[terraform/user_data.sh](terraform/user_data.sh)** | Script provisioning EC2 | Automatique au déploiement |

### Optimisation & Production

| Fichier | Description | Utilité |
|---------|-------------|---------|
| **[terraform/cost-optimization.md](terraform/cost-optimization.md)** | Guide optimisation coûts | Réduire de 26€ à 15€/mois |
| **[terraform/PRODUCTION_CHECKLIST.md](terraform/PRODUCTION_CHECKLIST.md)** | Checklist mise en prod | Validation avant go-live |
| **[terraform/CHANGELOG.md](terraform/CHANGELOG.md)** | Historique et roadmap | Versions et évolutions futures |

---

## 🛠️ Scripts Utiles

### Scripts de Gestion

| Script | Description | Commande |
|--------|-------------|----------|
| **[terraform/monitoring.sh](terraform/monitoring.sh)** | Monitoring santé infra | `cd terraform && ./monitoring.sh` |
| **[terraform/backup-db.sh](terraform/backup-db.sh)** | Backup PostgreSQL | `cd terraform && ./backup-db.sh` |
| **[deploy-to-s3.sh](deploy-to-s3.sh)** | Déploiement frontend S3 | `./deploy-to-s3.sh` |

### Automation (CI/CD)

| Fichier | Description | Usage |
|---------|-------------|-------|
| **[.github/workflows/deploy-aws.yml.example](.github/workflows/deploy-aws.yml.example)** | GitHub Actions workflow | Renommer en `.yml` pour activer |

---

## 🗺️ Flux de Travail Recommandé

### 1️⃣ Préparation (10 min)

```bash
# Lire la documentation
cat QUICK_START_AWS.md

# Installer les outils
brew install terraform awscli  # macOS

# Configurer AWS
aws configure
```

📖 **Doc**: [QUICK_START_AWS.md](QUICK_START_AWS.md) - Section "Prérequis"

---

### 2️⃣ Configuration (10 min)

```bash
# Créer clé SSH
aws ec2 create-key-pair --key-name weather-app-key ...

# Configurer Terraform
cd terraform/
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # Modifier vos valeurs
```

📖 **Doc**: [terraform/README.md](terraform/README.md) - Section "Configuration"

---

### 3️⃣ Déploiement Infrastructure (15 min)

```bash
# Initialiser et déployer
terraform init
terraform plan
terraform apply

# Récupérer l'IP
terraform output ec2_public_ip
```

📖 **Doc**: [QUICK_START_AWS.md](QUICK_START_AWS.md) - Section "Étape 4"

---

### 4️⃣ Déploiement Application (10 min)

```bash
# Se connecter à l'EC2
ssh -i ~/.ssh/weather-app-key.pem ec2-user@<IP>

# Déployer l'app
sudo su - weatherapp
cd ~/app
# Upload code + install + build
```

📖 **Doc**: [QUICK_START_AWS.md](QUICK_START_AWS.md) - Section "Étape 5"

---

### 5️⃣ Vérification (5 min)

```bash
# Monitoring
cd terraform/
./monitoring.sh

# Tests
curl http://<IP>
```

📖 **Doc**: [terraform/README.md](terraform/README.md) - Section "Vérifier"

---

### 6️⃣ Production (optionnel)

```bash
# Checklist
cat terraform/PRODUCTION_CHECKLIST.md

# Optimisations
cat terraform/cost-optimization.md
```

📖 **Doc**: [terraform/PRODUCTION_CHECKLIST.md](terraform/PRODUCTION_CHECKLIST.md)

---

## 🔍 Recherche par Sujet

### Sécurité

- **SSH restreint**: [terraform/README.md](terraform/README.md) - Section "Configuration"
- **Security Groups**: [terraform/ARCHITECTURE.md](terraform/ARCHITECTURE.md) - Section "Networking"
- **Secrets Management**: [terraform/PRODUCTION_CHECKLIST.md](terraform/PRODUCTION_CHECKLIST.md) - Section "Sécurité"
- **HTTPS/SSL**: [QUICK_START_AWS.md](QUICK_START_AWS.md) - Section "Domaine Personnalisé"

### Coûts

- **Estimation**: [README_DEPLOYMENT.md](README_DEPLOYMENT.md) - Section "Coûts Mensuels"
- **Optimisation**: [terraform/cost-optimization.md](terraform/cost-optimization.md)
- **Free Tier**: [terraform/cost-optimization.md](terraform/cost-optimization.md) - Section "Scénario 1"
- **Reserved Instances**: [terraform/cost-optimization.md](terraform/cost-optimization.md) - Section "Optimisations"

### Monitoring

- **Script monitoring**: [terraform/monitoring.sh](terraform/monitoring.sh)
- **CloudWatch**: [terraform/ARCHITECTURE.md](terraform/ARCHITECTURE.md) - Section "Monitoring"
- **Alertes**: [terraform/PRODUCTION_CHECKLIST.md](terraform/PRODUCTION_CHECKLIST.md) - Section "Monitoring"
- **Health checks**: [README_DEPLOYMENT.md](README_DEPLOYMENT.md) - Section "Dépannage"

### Backups

- **Automatiques RDS**: [terraform/ARCHITECTURE.md](terraform/ARCHITECTURE.md) - Section "RDS PostgreSQL"
- **Manuels**: [terraform/backup-db.sh](terraform/backup-db.sh)
- **Restauration**: [terraform/README.md](terraform/README.md) - Section "Sauvegardes PostgreSQL"
- **Disaster Recovery**: [terraform/ARCHITECTURE.md](terraform/ARCHITECTURE.md) - Section "Disaster Recovery"

### Scaling

- **Instance Upgrade**: [terraform/cost-optimization.md](terraform/cost-optimization.md) - Section "Passer à ARM"
- **Multi-AZ**: [terraform/ARCHITECTURE.md](terraform/ARCHITECTURE.md) - Section "Haute Disponibilité"
- **Auto Scaling**: [terraform/CHANGELOG.md](terraform/CHANGELOG.md) - Section "Roadmap v1.2.0"
- **CloudFront CDN**: [terraform/cost-optimization.md](terraform/cost-optimization.md) - Section "CloudFront"

### Dépannage

- **Application ne répond pas**: [README_DEPLOYMENT.md](README_DEPLOYMENT.md) - Section "Dépannage"
- **Logs**: [terraform/README.md](terraform/README.md) - Section "Dépannage"
- **RDS inaccessible**: [QUICK_START_AWS.md](QUICK_START_AWS.md) - Section "Dépannage"
- **Terraform errors**: [README_DEPLOYMENT.md](README_DEPLOYMENT.md) - Section "Dépannage"

---

## 📊 Comparaison des Fichiers

### README_DEPLOYMENT.md vs QUICK_START_AWS.md

| Caractéristique | README_DEPLOYMENT | QUICK_START_AWS |
|----------------|-------------------|-----------------|
| **Public** | Vue d'ensemble | Tutoriel détaillé |
| **Niveau** | Intermédiaire | Débutant |
| **Longueur** | Court (résumé) | Long (pas-à-pas) |
| **Format** | Bullet points | Instructions étape par étape |
| **Usage** | Référence rapide | Premier déploiement |

**Conseil**: Lire les deux, commencer par QUICK_START_AWS.md

---

### terraform/README.md vs terraform/ARCHITECTURE.md

| Caractéristique | README | ARCHITECTURE |
|----------------|--------|--------------|
| **Contenu** | Guide utilisateur | Documentation technique |
| **Focus** | Comment déployer | Comment ça marche |
| **Niveau** | Pratique | Théorique |
| **Diagrammes** | Non | Oui (détaillés) |
| **Usage** | Déploiement | Compréhension |

**Conseil**: README pour déployer, ARCHITECTURE pour comprendre

---

## 🎯 Cas d'Usage

### "Je veux déployer le plus vite possible"

1. [QUICK_START_AWS.md](QUICK_START_AWS.md) - Sections 1-7
2. [terraform/monitoring.sh](terraform/monitoring.sh) - Vérifier

**Durée**: 30 min

---

### "Je veux optimiser les coûts"

1. [terraform/cost-optimization.md](terraform/cost-optimization.md) - Tout lire
2. [terraform/terraform.tfvars.example](terraform/terraform.tfvars.example) - Modifier instance types
3. `terraform apply` - Redéployer

**Économie**: Jusqu'à 8€/mois

---

### "Je veux passer en production"

1. [terraform/PRODUCTION_CHECKLIST.md](terraform/PRODUCTION_CHECKLIST.md) - Cocher toutes les cases
2. [QUICK_START_AWS.md](QUICK_START_AWS.md) - Section "Domaine Personnalisé"
3. [terraform/monitoring.sh](terraform/monitoring.sh) - Vérifier régulièrement

**Durée**: 2-3 heures

---

### "Je veux comprendre l'architecture"

1. [terraform/ARCHITECTURE.md](terraform/ARCHITECTURE.md) - Tout lire
2. [terraform/main.tf](terraform/main.tf) - Parcourir le code
3. [terraform/cost-optimization.md](terraform/cost-optimization.md) - Section "Architecture Alternative"

**Durée**: 1 heure

---

### "Je veux automatiser le déploiement"

1. [.github/workflows/deploy-aws.yml.example](.github/workflows/deploy-aws.yml.example) - Configurer
2. GitHub Settings > Secrets - Ajouter credentials
3. Renommer `.yml.example` → `.yml`
4. Push vers `main` - Déploiement automatique

**Durée**: 30 min

---

## 📞 Support

### Documentation

- **Guide rapide**: [QUICK_START_AWS.md](QUICK_START_AWS.md)
- **Documentation complète**: [terraform/README.md](terraform/README.md)
- **Architecture**: [terraform/ARCHITECTURE.md](terraform/ARCHITECTURE.md)

### Scripts de Diagnostic

```bash
# Monitoring complet
cd terraform/
./monitoring.sh

# Vérifier logs
ssh -i ~/.ssh/weather-app-key.pem ec2-user@<IP>
pm2 logs

# Tester endpoints
curl http://<IP>/api/wind-status
```

### Ressources Externes

- [AWS Documentation](https://docs.aws.amazon.com/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Free Tier](https://aws.amazon.com/free/)
- [AWS Pricing Calculator](https://calculator.aws/)

---

## 🗂️ Structure Complète

```
weather-app/
├── 📑 DEPLOIEMENT_INDEX.md          ← Vous êtes ici
├── 🚀 QUICK_START_AWS.md            ← Démarrage rapide (30 min)
├── 📖 README_DEPLOYMENT.md          ← Vue d'ensemble
├── 🔐 .env.production.example       ← Variables environnement
├── 📤 deploy-to-s3.sh               ← Déploiement S3
│
├── .github/workflows/
│   └── 🔄 deploy-aws.yml.example    ← CI/CD GitHub Actions
│
└── terraform/
    ├── 📋 main.tf                   ← Infrastructure principale
    ├── ⚙️  variables.tf             ← Variables
    ├── 📊 outputs.tf                ← Outputs
    ├── 🔧 user_data.sh              ← Provisioning EC2
    ├── 📝 terraform.tfvars.example  ← Configuration
    ├── 🚫 .gitignore                ← Protection secrets
    │
    ├── 📖 README.md                 ← Doc Terraform complète
    ├── 🏗️  ARCHITECTURE.md          ← Diagramme architecture
    ├── 💰 cost-optimization.md      ← Optimisation coûts
    ├── ✅ PRODUCTION_CHECKLIST.md   ← Checklist production
    ├── 📜 CHANGELOG.md              ← Versions & roadmap
    │
    ├── 💾 backup-db.sh              ← Backup PostgreSQL
    └── 🔍 monitoring.sh             ← Monitoring santé
```

---

## 🎉 Prêt à Déployer ?

### Checklist Rapide

- [ ] J'ai lu [QUICK_START_AWS.md](QUICK_START_AWS.md)
- [ ] J'ai installé Terraform et AWS CLI
- [ ] J'ai configuré `aws configure`
- [ ] J'ai créé mon `terraform.tfvars`
- [ ] Je suis prêt à lancer `terraform apply`

**👉 Commencez maintenant**: [QUICK_START_AWS.md](QUICK_START_AWS.md)

---

*Index créé le 2026-01-23*
*Infrastructure version 1.0.0*
