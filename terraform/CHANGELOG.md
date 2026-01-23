# Changelog - Infrastructure AWS

## [1.0.0] - 2026-01-23

### Ajouté
- Infrastructure Terraform complète pour déploiement AWS
- EC2 t3.micro avec Node.js, Nginx, Redis
- RDS PostgreSQL db.t4g.micro avec sauvegardes automatiques
- S3 bucket pour assets statiques
- VPC avec subnets publics et privés
- Security Groups pour EC2 et RDS
- Script user_data.sh pour provisioning automatique EC2
- CloudWatch Logs avec rétention 7 jours
- Elastic IP pour IP publique fixe
- Script monitoring.sh pour health checks
- Script backup-db.sh pour sauvegardes manuelles
- Documentation complète (README, ARCHITECTURE, cost-optimization)
- Fichier QUICK_START_AWS.md pour démarrage rapide

### Configuration
- Region: eu-west-3 (Paris)
- Coût estimé: 4€/mois (Free Tier) puis 26€/mois
- Sauvegardes RDS: 7 jours de rétention
- Storage RDS: Auto-scaling 20GB → 100GB

### Sécurité
- RDS dans subnet privé
- Security Groups restrictifs
- SSH limité aux IP autorisées
- Encryption RDS activée

### Scripts
- `deploy-to-s3.sh`: Déploiement frontend vers S3
- `monitoring.sh`: Vérification santé infrastructure
- `backup-db.sh`: Backup manuel PostgreSQL

## [Roadmap]

### v1.1.0 (Futur)
- [ ] AWS Secrets Manager pour API keys
- [ ] IAM Roles pour EC2/RDS auth
- [ ] Certificate Manager pour SSL/TLS
- [ ] CloudFront CDN (si trafic élevé)
- [ ] Budget alerts automatiques
- [ ] Lambda pour arrêt/démarrage automatique (économie)

### v1.2.0 (Futur)
- [ ] Multi-AZ pour haute disponibilité
- [ ] Auto Scaling Group
- [ ] Application Load Balancer
- [ ] ElastiCache Redis (au lieu de local)
- [ ] RDS Read Replica

### v2.0.0 (Futur)
- [ ] Multi-region deployment
- [ ] Disaster recovery automatique
- [ ] CI/CD avec GitHub Actions
- [ ] Monitoring avancé (Prometheus/Grafana)
