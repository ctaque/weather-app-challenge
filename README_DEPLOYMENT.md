# 🚀 Guide de Déploiement Weather App sur AWS

## 📋 Résumé

Vous disposez maintenant d'une infrastructure **Terraform complète** pour déployer votre application weather-app sur AWS avec un coût minimal.

## 💰 Coûts

| Période | Coût Mensuel |
|---------|--------------|
| **12 premiers mois (Free Tier)** | **~4€** |
| **Après Free Tier** | **~26€** |
| **Optimisé (Reserved Instances)** | **~18€** |

## 📦 Ce qui a été créé

### Structure Terraform

```
terraform/
├── main.tf                      # Infrastructure principale
├── variables.tf                 # Variables configurables
├── outputs.tf                   # Sorties (IP, endpoints)
├── user_data.sh                 # Script provisioning EC2
├── terraform.tfvars.example     # Exemple configuration
├── .gitignore                   # Fichiers à ignorer
│
├── README.md                    # Documentation complète
├── ARCHITECTURE.md              # Diagramme d'architecture
├── cost-optimization.md         # Guide optimisation coûts
├── CHANGELOG.md                 # Historique des versions
│
├── backup-db.sh                 # Script backup PostgreSQL
└── monitoring.sh                # Script monitoring santé

Racine du projet:
├── QUICK_START_AWS.md           # Guide rapide (30 min)
├── deploy-to-s3.sh              # Déploiement frontend S3
└── .env.production.example      # Variables d'env production
```

### Infrastructure AWS

```
✅ VPC (10.0.0.0/16)
   ├─ Subnets publics (EC2)
   └─ Subnets privés (RDS)

✅ EC2 t3.micro
   ├─ Node.js 20.x
   ├─ Nginx (reverse proxy)
   ├─ Redis 6.x (cache local)
   └─ PM2 (process manager)

✅ RDS PostgreSQL 16
   ├─ Instance: db.t4g.micro (ARM)
   ├─ Storage: 20GB (auto-scale → 100GB)
   └─ Backups: 7 jours automatiques

✅ S3 Bucket
   └─ Assets statiques frontend

✅ Elastic IP
   └─ IP publique fixe

✅ CloudWatch
   └─ Logs (rétention 7 jours)

✅ Security Groups
   ├─ EC2: SSH, HTTP, HTTPS
   └─ RDS: PostgreSQL (EC2 only)
```

## 🚀 Démarrage Rapide

### Option 1: Guide Complet (Débutants)

Suivez **`QUICK_START_AWS.md`** pour un tutoriel pas-à-pas (30 min).

### Option 2: Déploiement Rapide (Expérimentés)

```bash
# 1. Installer Terraform & AWS CLI
brew install terraform awscli  # macOS
# ou voir QUICK_START_AWS.md pour Linux

# 2. Configurer AWS
aws configure

# 3. Créer clé SSH EC2
aws ec2 create-key-pair \
  --key-name weather-app-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/weather-app-key.pem
chmod 400 ~/.ssh/weather-app-key.pem

# 4. Configurer Terraform
cd terraform/
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # Modifier vos valeurs

# 5. Déployer
terraform init
terraform plan
terraform apply  # Taper "yes"

# 6. Récupérer l'IP
terraform output ec2_public_ip

# 7. SSH et déployer l'app
ssh -i ~/.ssh/weather-app-key.pem ec2-user@<IP>
# Suivre les instructions dans QUICK_START_AWS.md
```

## 📚 Documentation

| Fichier | Description |
|---------|-------------|
| **QUICK_START_AWS.md** | ⭐ Démarrage en 30 min (recommandé) |
| **terraform/README.md** | Documentation complète Terraform |
| **terraform/ARCHITECTURE.md** | Diagramme et détails architecture |
| **terraform/cost-optimization.md** | Comment réduire les coûts |
| **terraform/CHANGELOG.md** | Historique et roadmap |

## 🛠️ Scripts Utiles

### Monitoring

```bash
cd terraform/
./monitoring.sh
```

Affiche:
- ✅ Status EC2, RDS, Application
- 📊 CPU, Connexions, Storage
- 💰 Coûts du mois en cours
- 🔄 Dernière sauvegarde

### Backup Manuel

```bash
cd terraform/
./backup-db.sh
```

Crée un snapshot RDS manuel.

### Déployer Frontend sur S3

```bash
./deploy-to-s3.sh
```

Build et upload le frontend sur S3.

### Mise à jour Application

```bash
# SSH vers EC2
ssh -i ~/.ssh/weather-app-key.pem ec2-user@<IP>

# En tant que weatherapp
sudo su - weatherapp
cd ~/app
git pull
pnpm install
pnpm run build
pm2 restart all
```

## 🔐 Sécurité

### Variables Sensibles

**⚠️ NE JAMAIS committer:**
- `terraform.tfvars` (contient mots de passe)
- `.env` (API keys)
- Fichiers `.pem` (clés SSH)

Ces fichiers sont dans `.gitignore`.

### Accès SSH

**Modifier dans `terraform.tfvars`:**

```hcl
ssh_allowed_ips = ["VOTRE_IP/32"]  # Au lieu de 0.0.0.0/0
```

Trouvez votre IP:
```bash
curl ifconfig.me
```

### Secrets Management (Futur)

Pour production sérieuse, utiliser AWS Secrets Manager:
- Stocker DB password
- Stocker API keys
- Rotation automatique

## 💡 Optimisations

### Passer à ARM (Graviton)

**Économie: 20%**

```hcl
# Dans terraform.tfvars
ec2_instance_type = "t4g.micro"  # Au lieu de t3.micro
```

### Reserved Instances (après 12 mois)

**Économie: 40%** avec engagement 1 an

```bash
aws ec2 purchase-reserved-instances-offering \
  --reserved-instances-offering-id <ID> \
  --instance-count 1
```

### Arrêter hors prod

**Économie: ~21€/mois**

```bash
# Arrêter EC2 + RDS le soir/weekend
aws ec2 stop-instances --instance-ids <ID>
aws rds stop-db-instance --db-instance-identifier weather-app-db
```

⚠️ RDS redémarre automatiquement après 7 jours.

Voir **`terraform/cost-optimization.md`** pour plus de détails.

## 🎯 Architecture

```
Internet
   │
   ▼
Elastic IP (35.180.xxx.xxx)
   │
   ▼
EC2 t3.micro (Paris)
   ├─ Nginx :80 ──► Node.js :3000
   │                  │
   │                  ├─► Redis (local)
   │                  └─► RDS PostgreSQL
   │
   └─ Static Assets ──► S3 Bucket
```

Voir le diagramme complet dans **`terraform/ARCHITECTURE.md`**.

## 📊 Monitoring & Maintenance

### Hebdomadaire

```bash
./monitoring.sh  # Vérifier santé
pm2 logs         # Vérifier logs app
df -h            # Vérifier espace disque
```

### Mensuel

```bash
./backup-db.sh                # Backup manuel
aws ce get-cost-and-usage ... # Vérifier coûts
```

### Trimestriel

```bash
# Test restore backup
# Update système
# Review sécurité
```

## 🚨 Dépannage

### Application ne répond pas

```bash
# SSH vers EC2
ssh -i ~/.ssh/weather-app-key.pem ec2-user@<IP>

# Vérifier services
pm2 status
sudo systemctl status nginx
sudo systemctl status redis6

# Logs
pm2 logs
sudo tail -f /var/log/nginx/error.log
```

### Base de données inaccessible

```bash
# Depuis EC2
psql -h <RDS_ENDPOINT> -U weatherapp_user -d weatherapp

# Vérifier security group
aws ec2 describe-security-groups --group-ids <SG_ID>
```

### Terraform errors

```bash
# Réinitialiser
rm -rf .terraform/
terraform init

# Voir l'état
terraform state list
terraform show
```

## 🗑️ Supprimer l'Infrastructure

⚠️ **ATTENTION**: Cela supprime TOUT!

```bash
cd terraform/

# 1. Désactiver protection suppression RDS
aws rds modify-db-instance \
  --db-instance-identifier weather-app-db \
  --no-deletion-protection

# 2. Détruire
terraform destroy  # Taper "yes"
```

Coût: 0€ après destruction.

## 🎓 Ressources d'Apprentissage

### AWS
- [AWS Free Tier](https://aws.amazon.com/free/)
- [AWS Pricing Calculator](https://calculator.aws/)
- [EC2 User Guide](https://docs.aws.amazon.com/ec2/)
- [RDS User Guide](https://docs.aws.amazon.com/rds/)

### Terraform
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)

### Sécurité
- [AWS Well-Architected](https://aws.amazon.com/architecture/well-architected/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## 📝 Checklist de Déploiement

### Avant le déploiement

- [ ] Compte AWS créé et vérifié
- [ ] AWS CLI configuré (`aws configure`)
- [ ] Terraform installé (`terraform --version`)
- [ ] Clé SSH EC2 créée
- [ ] `terraform.tfvars` configuré avec vos valeurs
- [ ] API keys WeatherAPI et Anthropic disponibles

### Après le déploiement

- [ ] EC2 accessible via SSH
- [ ] Application visible sur `http://<IP>`
- [ ] Données de vent s'affichent sur la carte
- [ ] PostgreSQL accessible depuis EC2
- [ ] Redis fonctionne (`redis-cli ping`)
- [ ] PM2 tourne (`pm2 status`)
- [ ] Sauvegardes RDS configurées
- [ ] Monitoring fonctionne (`./monitoring.sh`)
- [ ] Budget alert configuré (30€/mois)

### Production

- [ ] Domaine personnalisé configuré
- [ ] SSL/TLS installé (Let's Encrypt)
- [ ] SSH limité à votre IP uniquement
- [ ] Logs CloudWatch activés
- [ ] Sauvegardes manuelles testées
- [ ] Plan de disaster recovery documenté
- [ ] Coûts optimisés (Reserved Instances)

## 🎉 Prochaines Étapes

1. **Déployer l'infrastructure** (QUICK_START_AWS.md)
2. **Tester l'application** (http://<IP>)
3. **Configurer monitoring** (./monitoring.sh)
4. **Optimiser les coûts** (cost-optimization.md)
5. **Ajouter un domaine** (optionnel)
6. **Mettre en place CI/CD** (GitHub Actions, futur)

## 📞 Support

En cas de problème:

1. Vérifier les logs (`pm2 logs`, nginx logs, CloudWatch)
2. Consulter la documentation Terraform (README.md, ARCHITECTURE.md)
3. Utiliser `./monitoring.sh` pour diagnostiquer
4. Ouvrir une issue GitHub si bug dans les scripts

## 🏆 Avantages de cette Architecture

✅ **Coût minimal**: 4€/mois (Free Tier) puis 26€/mois
✅ **Scalable**: Peut passer à t3.medium, multi-AZ facilement
✅ **Sécurisé**: RDS privé, encryption, security groups
✅ **Fiable**: Sauvegardes automatiques, monitoring
✅ **Infrastructure as Code**: Redéploiement en 1 commande
✅ **Production-ready**: Nginx, PM2, Redis, PostgreSQL

## 📖 Versions

- **v1.0.0** (2026-01-23): Release initiale
- Region: eu-west-3 (Paris)
- Free Tier eligible
- Documentation complète

Voir `terraform/CHANGELOG.md` pour la roadmap.

---

**Bonne chance avec votre déploiement!** 🚀

Si vous avez des questions, consultez la documentation ou les logs. L'infrastructure est prête à l'emploi!
