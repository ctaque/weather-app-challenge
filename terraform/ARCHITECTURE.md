# Architecture AWS - Weather App

## Diagramme d'Infrastructure

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS Region: eu-west-3 (Paris)           │
└─────────────────────────────────────────────────────────────────┘

                              Internet
                                 │
                                 │ HTTPS/HTTP
                                 ▼
                    ┌────────────────────────┐
                    │   Elastic IP (Fixed)   │
                    │    35.180.xxx.xxx      │
                    └────────────┬───────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────┐
│  VPC: 10.0.0.0/16             │                                 │
│                                │                                 │
│  ┌─────────────────────────────▼─────────────────────────────┐  │
│  │          Public Subnet (10.0.0.0/24)                      │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────┐     │  │
│  │  │  EC2 t3.micro (Amazon Linux 2023)               │     │  │
│  │  │  ┌────────────────────────────────────────────┐  │     │  │
│  │  │  │                                            │  │     │  │
│  │  │  │  ┌─────────────┐    ┌──────────────┐     │  │     │  │
│  │  │  │  │   Nginx     │    │   Node.js    │     │  │     │  │
│  │  │  │  │   (Proxy)   │◄───┤   Express    │     │  │     │  │
│  │  │  │  │   Port 80   │    │   Port 3000  │     │  │     │  │
│  │  │  │  └─────────────┘    └──────┬───────┘     │  │     │  │
│  │  │  │                             │             │  │     │  │
│  │  │  │  ┌─────────────┐           │             │  │     │  │
│  │  │  │  │   Redis     │◄──────────┘             │  │     │  │
│  │  │  │  │   (Local)   │                         │  │     │  │
│  │  │  │  │  Port 6379  │  Wind Data Cache        │  │     │  │
│  │  │  │  └─────────────┘  (1h TTL)               │  │     │  │
│  │  │  │                                            │  │     │  │
│  │  │  │  ┌─────────────┐                          │  │     │  │
│  │  │  │  │     PM2     │  Process Manager         │  │     │  │
│  │  │  │  │  (Cluster)  │  Auto-restart            │  │     │  │
│  │  │  │  └─────────────┘                          │  │     │  │
│  │  │  └────────────────────────────────────────────┘  │     │  │
│  │  │                       │                          │     │  │
│  │  │                       │ Logs                     │     │  │
│  │  │                       ▼                          │     │  │
│  │  │           ┌──────────────────────┐               │     │  │
│  │  │           │  CloudWatch Logs     │               │     │  │
│  │  │           │  (7 days retention)  │               │     │  │
│  │  │           └──────────────────────┘               │     │  │
│  │  └──────────────────────────────────────────────────┘     │  │
│  └────────────────────────────┬────────────────────────────────┘  │
│                                │                                 │
│                                │ TCP 5432                        │
│                                ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │          Private Subnet (10.0.10.0/24)                      │  │
│  │                                                              │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │  RDS PostgreSQL 16                                   │   │  │
│  │  │  Instance: db.t4g.micro (ARM Graviton)              │   │  │
│  │  │                                                       │   │  │
│  │  │  ┌────────────────────────────────────────────────┐  │   │  │
│  │  │  │  Database: weatherapp                          │  │   │  │
│  │  │  │  Storage: 20GB (gp3, encrypted)                │  │   │  │
│  │  │  │  Backups: Automated (7 days)                   │  │   │  │
│  │  │  │  Backup Window: 03:00-04:00 UTC                │  │   │  │
│  │  │  └────────────────────────────────────────────────┘  │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

                                 │
                                 │ Static Assets
                                 ▼
                    ┌────────────────────────┐
                    │  S3 Bucket (Public)    │
                    │  weather-app-assets-*  │
                    │  • Frontend build      │
                    │  • Static files        │
                    └────────────────────────┘

                                 │
                                 │ External APIs
                                 ▼
                    ┌────────────────────────┐
                    │   External Services    │
                    │  • WeatherAPI.com      │
                    │  • Anthropic API       │
                    │  • NOAA GFS (OpenDAP)  │
                    └────────────────────────┘
```

## Flux de Données

### 1. Requête Utilisateur

```
User Browser → Nginx (EC2:80)
              → Node.js (EC2:3000)
              → PostgreSQL (RDS:5432)
              ← JSON Response
              ← HTML/JS/CSS
```

### 2. Données de Vent (Scheduler)

```
NOAA GFS OpenDAP
    ↓ (Toutes les heures, cron: 5 * * * *)
server/opendap-downloader.js
    ↓ Parse ASCII data
Redis (EC2:6379)
    ├─ wind:points (JSON, 713 points)
    ├─ wind:png (RGBA image 31×23)
    └─ wind:metadata (min/max values)
    ↓ TTL: 1h
/api/windgl/wind.png
    ↓
Frontend (windgl layer)
    ↓
Animated particles on map
```

### 3. Sauvegardes PostgreSQL

```
RDS Automated Backups
    ↓ Daily at 03:00 UTC
Snapshot Storage
    ↓ Retention: 7 days
Point-in-Time Recovery
    ↓ Up to 5 minutes precision
Manual Snapshots (optional)
    ↓ Indefinite retention
```

## Composants Détaillés

### EC2 Instance

**Type**: t3.micro (2 vCPU, 1GB RAM)
**OS**: Amazon Linux 2023
**Storage**: 20GB gp3 EBS

**Services installés**:
- Node.js 20.x
- pnpm (package manager)
- PM2 (process manager)
- Nginx (reverse proxy)
- Redis 6.x (cache)
- CloudWatch agent (logs)

**User Data Script**:
- Configure Nginx reverse proxy
- Install and configure Redis
- Create `.env` file
- Setup PM2 ecosystem
- Configure auto-start services

### RDS PostgreSQL

**Engine**: PostgreSQL 16.3
**Instance**: db.t4g.micro (ARM Graviton)
**Storage**:
- Type: gp3 (General Purpose SSD)
- Size: 20GB initial
- Max: 100GB (auto-scaling enabled)
- Encryption: AES-256

**Sauvegardes**:
- Automatiques: 7 jours
- Fenêtre: 03:00-04:00 UTC
- Maintenance: Lundi 04:00-05:00 UTC
- Point-in-Time Recovery: Oui

**Monitoring**:
- Performance Insights: Activé
- CloudWatch Logs: postgresql, upgrade
- Métriques: CPU, RAM, Connections, IOPS

### Redis Cache

**Version**: Redis 6.x
**Déploiement**: Local sur EC2
**Configuration**:
- Max Memory: 256MB
- Eviction Policy: allkeys-lru
- Persistence: RDB snapshots
- AOF: Désactivé (cache volatile)

**Données stockées**:
- `wind:points`: Données de vent JSON (713 points)
- `wind:png`: Image PNG encodée base64
- `wind:metadata`: Métadonnées windgl
- TTL: 1 heure

**Alternative** (plus coûteux):
- ElastiCache Redis t4g.micro: +13€/mois
- Avantages: Haute disponibilité, snapshots automatiques
- Inconvénient: Coût supplémentaire

### S3 Bucket

**Configuration**:
- Public read access
- Website hosting enabled
- Versioning: Désactivé (économie)
- Lifecycle: 90 jours → Glacier (optionnel)

**Contenu**:
- Frontend build (index.html, JS, CSS)
- Assets statiques (images, fonts)
- Cache-Control: 1 an pour assets, no-cache pour HTML

### Networking

**VPC**: 10.0.0.0/16

**Subnets**:
- Public (EC2): 10.0.0.0/24, 10.0.1.0/24
- Private (RDS): 10.0.10.0/24, 10.0.11.0/24

**Security Groups**:

1. **EC2 SG**:
   - Inbound: 22 (SSH), 80 (HTTP), 443 (HTTPS), 3000 (Node.js debug)
   - Outbound: All

2. **RDS SG**:
   - Inbound: 5432 (PostgreSQL) from EC2 SG only
   - Outbound: None

**Internet Gateway**: Pour accès public EC2

**Route Tables**:
- Public: 0.0.0.0/0 → Internet Gateway
- Private: Pas de route internet (sécurité)

### Monitoring & Logging

**CloudWatch**:
- Log Group: `/aws/ec2/weather-app`
- Retention: 7 jours
- Logs: Application, Nginx, Redis

**Métriques EC2**:
- CPU Utilization
- Network In/Out
- Disk Read/Write
- Status Checks

**Métriques RDS**:
- Database Connections
- CPU Utilization
- Free Storage Space
- Read/Write Latency

**Alertes** (optionnel):
- CPU > 80%
- Disk > 90%
- RDS Connections > 80
- Budget > 30€/mois

## Sécurité

### Network Security

- **VPC Isolation**: Base de données dans subnet privé
- **Security Groups**: Règles strictes par service
- **SSH Access**: Limité aux IP autorisées seulement
- **No Public RDS**: PostgreSQL non accessible depuis Internet

### Data Security

- **RDS Encryption**: AES-256 at rest
- **SSL/TLS**: Optionnel pour PostgreSQL connections
- **Secrets Management**: Variables d'environnement (améliorer avec AWS Secrets Manager)
- **IAM Roles**: Pas encore implémenté (amélioration future)

### Application Security

- **Environment Variables**: Stockées dans `.env` (chmod 600)
- **API Keys**: Jamais commitées dans Git
- **Rate Limiting**: Implémenté dans Express
- **CORS**: Configuré correctement
- **Input Validation**: À vérifier/améliorer

### Améliorations Recommandées

1. **AWS Secrets Manager**: Pour stocker DB password, API keys
2. **IAM Roles**: Pour EC2 → RDS auth sans password
3. **WAF**: Web Application Firewall (si forte charge)
4. **Certificate Manager**: SSL/TLS gratuit pour domaine
5. **VPN/Bastion**: Pour accès SSH plus sécurisé

## Haute Disponibilité (Optionnel)

### Multi-AZ (Non implémenté, +100% coût)

```
┌────────────────────────────────────────┐
│  Availability Zone A                   │
│  ┌──────────┐     ┌──────────┐        │
│  │  EC2 #1  │     │ RDS Main │        │
│  └────┬─────┘     └────┬─────┘        │
└───────┼────────────────┼───────────────┘
        │                │
        │                │ Replication
        ▼                ▼
┌────────────────────────────────────────┐
│  Availability Zone B                   │
│  ┌──────────┐     ┌──────────┐        │
│  │  EC2 #2  │     │RDS Standby│       │
│  └──────────┘     └──────────┘        │
└────────────────────────────────────────┘
        ▲
        │
  Application Load Balancer
```

**Coût supplémentaire**: ~30€/mois
**Avantages**: 99.95% SLA, failover automatique

### Auto Scaling (Non implémenté)

Pour gérer la charge variable:
- Auto Scaling Group (2-10 instances)
- Application Load Balancer
- CloudWatch alarms

**Coût**: Minimum +16€/mois

### Configuration Actuelle

**Disponibilité**: ~99.5%
- Single EC2 instance
- Single AZ RDS (automated backups)
- Manual recovery en cas de panne

**RTO** (Recovery Time Objective): ~15-30 minutes
**RPO** (Recovery Point Objective): ~5 minutes (RDS PITR)

## Disaster Recovery

### Stratégies

1. **RDS Snapshots**: Quotidiens, 7 jours
2. **Manual Snapshots**: Avant changements majeurs
3. **Cross-Region**: Non implémenté (économie)
4. **Infrastructure as Code**: Terraform (redéploiement rapide)

### Plan de Recovery

**Scénario 1: EC2 Failure**
1. Terraform apply (nouvelle instance)
2. Redéployer application (git clone)
3. Pointer Elastic IP
4. Durée: ~15 minutes

**Scénario 2: RDS Failure**
1. Restore from snapshot
2. Update connection string
3. Restart application
4. Durée: ~20-30 minutes

**Scénario 3: Region Failure**
- Pas de recovery automatique (économie)
- Redéployer dans autre région (terraform)
- Durée: ~1-2 heures

### Backup Testing

```bash
# Test backup mensuel recommandé
cd terraform/
./backup-db.sh

# Vérifier snapshot
aws rds describe-db-snapshots --db-instance-identifier weather-app-db

# Test restore (environnement de test)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier weather-app-test \
  --db-snapshot-identifier weather-app-manual-YYYYMMDD
```

## Performance

### Optimisations Actuelles

- **Redis Cache**: Données de vent (1h TTL)
- **Nginx Gzip**: Compression réponses
- **PM2 Cluster**: Utilisation multi-core
- **RDS gp3**: IOPS améliorées
- **S3 Static Assets**: CDN-ready

### Benchmarks Attendus

**EC2 t3.micro**:
- Requêtes/sec: ~100-200
- Latence moyenne: <100ms
- Utilisateurs concurrents: ~50-100

**RDS db.t4g.micro**:
- Connections max: ~80
- Queries/sec: ~1000
- Storage IOPS: 3000

### Améliorations Futures

1. **CloudFront CDN**: -50% latence, cache global
2. **ElastiCache Redis**: +30% performance cache
3. **RDS Read Replica**: Séparer lectures/écritures
4. **Instance Type Upgrade**: t3.small ou t3.medium

## Coûts Détaillés

### Calcul Mensuel (hors Free Tier)

| Ressource | Spécifications | Prix/h | Heures/mois | Total/mois |
|-----------|----------------|---------|-------------|------------|
| EC2 t3.micro | 2 vCPU, 1GB | 0,0116€ | 730 | 8,47€ |
| RDS db.t4g.micro | 2 vCPU ARM, 1GB | 0,018€ | 730 | 13,14€ |
| EBS gp3 (EC2) | 20GB | - | - | 2,00€ |
| RDS Storage | 20GB gp3 | - | - | 2,30€ |
| RDS Backups | 20GB snapshots | - | - | 1,90€ |
| Data Transfer | 10GB sortant | - | - | 0,90€ |
| Elastic IP | Attachée | 0€ | - | 0€ |
| S3 | 5GB, 10k req | - | - | 0,12€ |
| CloudWatch | Logs 1GB | - | - | 0,50€ |
| **TOTAL** | | | | **29,33€** |

### Free Tier (12 mois)

- EC2 t3.micro: 750h gratuits = -8,47€
- RDS db.t4g.micro: 750h gratuits = -13,14€
- RDS Storage: 20GB gratuits = -2,30€
- S3: 5GB gratuits = -0,12€

**Total avec Free Tier**: ~5€/mois

### Optimisations

Voir `cost-optimization.md` pour détails complets.

## Maintenance

### Tâches Hebdomadaires

- [ ] Vérifier monitoring (`./monitoring.sh`)
- [ ] Vérifier logs PM2 (`pm2 logs`)
- [ ] Vérifier espace disque

### Tâches Mensuelles

- [ ] Créer backup manuel (`./backup-db.sh`)
- [ ] Vérifier coûts AWS Cost Explorer
- [ ] Supprimer vieux snapshots (>30j)
- [ ] Mettre à jour dépendances Node.js

### Tâches Trimestrielles

- [ ] Test de restore depuis backup
- [ ] Review Security Groups
- [ ] Update système (dnf update)
- [ ] Évaluer instance sizing

## Ressources

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS EC2 Pricing](https://aws.amazon.com/ec2/pricing/)
- [AWS RDS Pricing](https://aws.amazon.com/rds/postgresql/pricing/)
- [AWS Free Tier](https://aws.amazon.com/free/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

---

*Architecture v1.0 - Janvier 2026*
