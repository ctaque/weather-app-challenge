# Optimisation des Coûts AWS

Guide pour minimiser les coûts de l'infrastructure weather-app.

## Coûts Actuels (eu-west-3)

### Scénario 1: Free Tier (12 premiers mois)
| Service | Configuration | Coût/mois |
|---------|--------------|-----------|
| EC2 t3.micro | 750h/mois inclus | **0€** |
| RDS db.t4g.micro | 750h/mois inclus | **0€** |
| EBS gp3 (EC2) | 20GB | 2€ |
| RDS Storage | 20GB | 2€ |
| Data Transfer | ~10GB | 0€ (1GB gratuit) |
| Elastic IP | Attachée | 0€ |
| S3 | <5GB, <20k req | 0€ |
| **TOTAL** | | **~4€/mois** |

### Scénario 2: Après Free Tier
| Service | Configuration | Coût/mois |
|---------|--------------|-----------|
| EC2 t3.micro | On-Demand | 8,35€ |
| RDS db.t4g.micro | PostgreSQL | 13,14€ |
| EBS gp3 (EC2) | 20GB | 2€ |
| RDS Storage | 20GB | 2€ |
| Data Transfer | ~10GB | 1€ |
| S3 | <5GB | 0,12€ |
| **TOTAL** | | **~26,61€/mois** |

## Optimisations Immédiates

### 1. Passer à ARM (Graviton)

**EC2: t3.micro → t4g.micro**
- Économie: 20%
- Nouveau coût: 6,68€/mois
- Performance: +40%

**Modification Terraform:**
```hcl
variable "ec2_instance_type" {
  default = "t4g.micro" # Au lieu de t3.micro
}
```

**RDS: Déjà en t4g.micro** ✓

### 2. Réduire le stockage RDS

Si vous utilisez <10GB:

```hcl
resource "aws_db_instance" "postgres" {
  allocated_storage = 10  # Au lieu de 20
}
```

Économie: ~1€/mois

### 3. Spot Instances pour Dev/Staging

Pour environnement de développement:

```hcl
resource "aws_spot_instance_request" "app_dev" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "t3.micro"
  spot_price             = "0.005"  # ~70% moins cher
  wait_for_fulfillment   = true
  spot_type              = "persistent"
}
```

Économie: ~5,85€/mois (70%)

⚠️ **Risque**: Instance peut être interrompue

### 4. Reserved Instances (1-3 ans)

**Engagement 1 an, paiement total:**
- EC2 t3.micro: 4,87€/mois (au lieu de 8,35€) = **-42%**
- RDS db.t4g.micro: 8,76€/mois (au lieu de 13,14€) = **-33%**

**Économie totale: ~7,86€/mois**

**Comment acheter:**
```bash
aws ec2 purchase-reserved-instances-offering \
  --reserved-instances-offering-id <ID> \
  --instance-count 1
```

### 5. Savings Plans

Alternative aux Reserved Instances:
- Flexibilité entre types d'instances
- Économies: 40-60%
- Engagement: 1 ou 3 ans

## Optimisations Techniques

### 6. Compression des Assets S3

```bash
# Activer la compression Gzip
aws s3 cp dist/ s3://bucket/ \
  --recursive \
  --content-encoding gzip \
  --metadata-directive REPLACE
```

Économie bande passante: ~70%

### 7. CloudFront (si beaucoup de trafic)

**Ajouter à Terraform:**
```hcl
resource "aws_cloudfront_distribution" "main" {
  origin {
    domain_name = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.assets.id}"
  }

  enabled             = true
  price_class         = "PriceClass_100"  # USA + Europe seulement
  default_cache_behavior {
    compress = true
  }
}
```

**Coûts:**
- 50GB/mois: 4€
- 1TB/mois: 85€

**Économie Data Transfer:**
- Sans CloudFront: 0,09€/GB
- Avec CloudFront: 0,085€/GB + mise en cache

**ROI**: À partir de 100GB/mois de trafic

### 8. Redis sur EC2 au lieu d'ElastiCache

**Actuel**: Redis sur EC2 ✓

**Si ElastiCache Redis t4g.micro:**
- Coût supplémentaire: ~13€/mois
- Avantages: Haute disponibilité, snapshots

**Recommandation**: Garder Redis sur EC2 pour économiser

### 9. Arrêter RDS la nuit (dev uniquement)

**Script d'automatisation Lambda:**
```python
import boto3

def lambda_handler(event, context):
    rds = boto3.client('rds')
    # Arrêt à 20h
    if event['action'] == 'stop':
        rds.stop_db_instance(DBInstanceIdentifier='weather-app-db')
    # Démarrage à 8h
    elif event['action'] == 'start':
        rds.start_db_instance(DBInstanceIdentifier='weather-app-db')
```

**Économie**: ~50% (12h/jour) = ~6,57€/mois

⚠️ **RDS redémarre automatiquement après 7 jours**

### 10. Réduire la rétention des logs

```hcl
resource "aws_cloudwatch_log_group" "app" {
  retention_in_days = 3  # Au lieu de 7
}
```

Économie: ~0,50€/mois

### 11. Supprimer les snapshots RDS anciens

```bash
# Lister les snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier weather-app-db \
  --query 'DBSnapshots[?SnapshotCreateTime<=`2026-01-01`]'

# Supprimer les snapshots >30 jours
aws rds delete-db-snapshot --db-snapshot-identifier <OLD_SNAPSHOT>
```

**Coût snapshots**: 0,095€/GB/mois

Économie: ~1€/mois si 10GB de snapshots

## Monitoring des Coûts

### 1. AWS Cost Explorer

```bash
# Coûts du mois dernier
aws ce get-cost-and-usage \
  --time-period Start=2026-01-01,End=2026-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

### 2. Alertes de Budget

**Terraform:**
```hcl
resource "aws_budgets_budget" "monthly" {
  name              = "monthly-budget"
  budget_type       = "COST"
  limit_amount      = "30"
  limit_unit        = "USD"
  time_unit         = "MONTHLY"

  notification {
    comparison_operator = "GREATER_THAN"
    threshold           = 80
    threshold_type      = "PERCENTAGE"
    notification_type   = "FORECASTED"
    subscriber_email_addresses = ["votre-email@example.com"]
  }
}
```

### 3. Trusted Advisor

Gratuit avec AWS Business Support:
- Recommandations d'optimisation
- Instances sous-utilisées
- EBS volumes inutilisés

## Architecture Alternative: Tout sur une EC2

Pour réduire au maximum:

**Configuration:**
- EC2 t3.small (2GB RAM) au lieu de t3.micro
- PostgreSQL installé localement
- Redis installé localement
- Sauvegardes vers S3

**Coût:**
- EC2 t3.small: 16,70€/mois
- EBS 30GB: 3€/mois
- S3 sauvegardes: 0,50€/mois
- **TOTAL: ~20,20€/mois**

**Économie vs RDS**: ~6€/mois

**Inconvénients:**
- Pas de haute disponibilité
- Maintenance manuelle
- Sauvegardes manuelles

**Script de sauvegarde S3:**
```bash
#!/bin/bash
# Backup PostgreSQL vers S3

BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql.gz"

pg_dump weatherapp | gzip > /tmp/$BACKUP_FILE

aws s3 cp /tmp/$BACKUP_FILE s3://weather-app-backups/

# Garder seulement 7 derniers backups
aws s3 ls s3://weather-app-backups/ | \
  sort | head -n -7 | awk '{print $4}' | \
  xargs -I {} aws s3 rm s3://weather-app-backups/{}

rm /tmp/$BACKUP_FILE
```

## Comparaison des Scénarios

| Scénario | Coût/mois | Fiabilité | Maintenance |
|----------|-----------|-----------|-------------|
| **Actuel (Free Tier)** | 4€ | ★★★★☆ | ★★★☆☆ |
| **Actuel (hors FT)** | 26,61€ | ★★★★★ | ★★★★☆ |
| **Optimisé ARM** | 23,48€ | ★★★★★ | ★★★★☆ |
| **Reserved Instances** | 18,75€ | ★★★★★ | ★★★★☆ |
| **Tout sur EC2** | 20,20€ | ★★★☆☆ | ★★☆☆☆ |
| **EC2 Spot (dev)** | 8€ | ★★☆☆☆ | ★★★☆☆ |

## Plan d'Action Recommandé

### Phase 1: Immédiat (0 effort)
1. ✅ Utiliser Free Tier pendant 12 mois
2. Configurer alertes de budget (30€/mois)
3. Réduire rétention logs à 3 jours

**Économie**: Gratuit pendant 12 mois

### Phase 2: Court terme (1-2h)
1. Passer à ARM (t4g.micro pour EC2)
2. Configurer sauvegardes automatiques S3
3. Activer compression Gzip pour S3
4. Supprimer snapshots >30 jours

**Économie**: ~2€/mois

### Phase 3: Moyen terme (si >100 utilisateurs/jour)
1. Ajouter CloudFront
2. Optimiser taille images
3. Implémenter cache Redis agressif

**Économie**: ~5€/mois sur Data Transfer

### Phase 4: Long terme (après 12 mois)
1. Acheter Reserved Instances (1 an)
2. Évaluer Savings Plans

**Économie**: ~7,86€/mois

## Total Économies Possibles

| Action | Économie |
|--------|----------|
| Free Tier (12 mois) | 21,40€/mois |
| ARM (Graviton) | 1,67€/mois |
| Reserved Instances | 7,86€/mois |
| Optimisations logs/storage | 1,50€/mois |
| **TOTAL** | **32,43€/mois** |

**Coût final optimisé**: 0€ (12 mois) puis ~15€/mois

## Ressources

- [AWS Pricing Calculator](https://calculator.aws/)
- [AWS Cost Explorer](https://console.aws.amazon.com/cost-management/)
- [Graviton Performance](https://aws.amazon.com/ec2/graviton/)
- [Reserved Instances](https://aws.amazon.com/ec2/pricing/reserved-instances/)
