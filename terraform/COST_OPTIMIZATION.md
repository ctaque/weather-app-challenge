# Optimisation des Coûts - PostgreSQL Local

Ce document explique comment nous avons réduit les coûts de **55%** en installant PostgreSQL localement sur le droplet au lieu d'utiliser une base de données managée.

## Résumé des Économies

| Configuration | Avant | Après | Économie |
|--------------|-------|-------|----------|
| **Droplet** | $12/mois | $12/mois | - |
| **PostgreSQL** | $15/mois (managé) | $0 (local) | -$15 |
| **Redis** | $0 (local) | $0 (local) | - |
| **Total** | **$27/mois** | **$12/mois** | **-$15/mois (55%)** |

**Économie annuelle:** $180/an

## Changements Techniques

### Infrastructure Supprimée

❌ **DigitalOcean Managed PostgreSQL**
- Cluster 1GB RAM @ $15/mois
- Connexion réseau privé
- Backups automatiques managés
- Monitoring intégré

### Infrastructure Ajoutée

✅ **PostgreSQL 16 sur le droplet**
- Installé via `apt` (package Ubuntu)
- Connexion locale (localhost:5432)
- Backups via cron (quotidiens à 2h)
- Rétention: 7 jours
- Script: `/home/weatherapp/backup-db.sh`

## Avantages

### 💰 Économique
- **-55% de coûts** ($12/mois au lieu de $27/mois)
- Pas de frais cachés
- Prévisible

### 🎯 Simplicité
- Une seule ressource à gérer (droplet)
- Pas de configuration réseau privé
- Déploiement plus rapide (~3 min au lieu de 8 min)

### 🔧 Contrôle Total
- Configuration PostgreSQL personnalisable
- Accès direct au système de fichiers
- Logs locaux facilement accessibles
- Extensions PostgreSQL installables librement

## Inconvénients

### ⚠️ Considérations

1. **Pas de haute disponibilité**
   - Une seule instance (pas de réplication)
   - Si le droplet tombe, la DB aussi
   - **Solution:** Backups quotidiens + snapshots droplet

2. **Partage de ressources**
   - PostgreSQL partage CPU/RAM avec l'app
   - Pour apps gourmandes: augmenter taille droplet
   - **Configuration actuelle:** 2GB RAM suffit largement

3. **Backups manuels**
   - Pas de backups managés automatiques
   - Dépend du cron job
   - **Solution:** Script automatique + alertes

4. **Scaling limité**
   - Pas de scaling horizontal facile
   - Pour scaler: migrer vers DB managée
   - **Pour qui:** Apps < 10k utilisateurs actifs

## Quand Utiliser PostgreSQL Local?

### ✅ Recommandé pour:
- **MVPs et prototypes**
- **Sites vitrine avec formulaires**
- **Blogs et portfolios**
- **Apps avec < 10k utilisateurs**
- **Budgets serrés**
- **Environnements dev/staging**

### ❌ Non recommandé pour:
- **Apps critiques nécessitant 99.99% uptime**
- **Apps avec > 100k requêtes/jour**
- **Apps nécessitant réplication**
- **Multi-région / multi-datacenter**
- **Conformité stricte (HIPAA, PCI-DSS)**

## Configuration Actuelle

### Droplet
- **Taille:** 2GB RAM, 1 vCPU, 50GB SSD
- **OS:** Ubuntu 22.04 LTS
- **Région:** Frankfurt (fra1)

### Services Installés
- **Node.js 20** - Application web
- **PostgreSQL 16** - Base de données (max ~500MB)
- **Redis** - Cache (max 512MB)
- **nginx** - Reverse proxy
- **PM2** - Process manager

### Utilisation Ressources (typique)
- **CPU:** 10-20% en moyenne
- **RAM:** ~1.2GB utilisés
  - Node.js: ~400MB
  - PostgreSQL: ~300MB
  - Redis: ~100MB
  - Système: ~400MB
- **Disque:** ~8GB utilisés

**Marge:** Amplement suffisant pour croissance 5-10x

## Backups PostgreSQL

### Automatiques (Cron)
```bash
# Cron job (tous les jours à 2h AM)
0 2 * * * /home/weatherapp/backup-db.sh
```

**Politique de rétention:**
- Garde les 7 derniers backups
- Supprime automatiquement les anciens
- Stockage: `/home/weatherapp/backups/`

### Manuels
```bash
# Depuis votre machine
ssh root@DROPLET_IP 'sudo -u weatherapp /home/weatherapp/backup-db.sh'

# Télécharger le backup
scp root@DROPLET_IP:/home/weatherapp/backups/db-backup-*.sql ./

# Restaurer
cat backup.sql | ssh root@DROPLET_IP 'sudo -u postgres psql weatherapp'
```

### Snapshots Droplet (recommandé)
En complément des backups SQL, créez des snapshots du droplet complet:

```bash
# Via doctl (CLI DigitalOcean)
doctl compute droplet-action snapshot DROPLET_ID --snapshot-name "weather-app-$(date +%Y%m%d)"

# Ou via Dashboard
# Droplets → Votre droplet → Snapshots → Take Snapshot
```

**Coût snapshots:** $0.05/GB/mois (~$2.50/mois pour 50GB)

**Stratégie recommandée:**
- Backups SQL quotidiens (gratuit)
- Snapshots droplet hebdomadaires ($2.50/mois)
- **Total avec snapshots:** $14.50/mois (toujours 46% moins cher)

## Monitoring

### PostgreSQL
```bash
# Statut service
ssh root@DROPLET_IP 'systemctl status postgresql'

# Taille base de données
ssh root@DROPLET_IP "sudo -u postgres psql -c '\l+' weatherapp"

# Connexions actives
ssh root@DROPLET_IP "sudo -u postgres psql -c 'SELECT count(*) FROM pg_stat_activity;'"

# Queries lentes
ssh root@DROPLET_IP "sudo -u postgres psql -c 'SELECT query, calls, total_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;'"
```

### Espace Disque
```bash
# Vérifier l'espace
ssh root@DROPLET_IP 'df -h'

# Taille backups
ssh root@DROPLET_IP 'du -sh /home/weatherapp/backups/'
```

## Migration depuis DB Managée

Si vous migrez depuis une base managée:

### 1. Backup de la DB managée
```bash
# Via terraform output (avant modification)
terraform output -raw db_connection_uri
pg_dump "URI_FROM_OUTPUT" > managed-db-backup.sql
```

### 2. Appliquer nouvelle config
```bash
terraform apply
```

### 3. Restaurer dans la nouvelle DB locale
```bash
cat managed-db-backup.sql | ssh root@$(terraform output -raw droplet_ip) 'sudo -u postgres psql weatherapp'
```

### 4. Tester l'application
```bash
# Vérifier que l'app fonctionne
curl $(terraform output -raw app_url)
```

### 5. Détruire l'ancienne DB managée
```bash
# Seulement après avoir vérifié que tout fonctionne!
# (La DB managée n'existe plus dans la nouvelle config)
```

## Scaling Future

### Quand Migrer vers DB Managée?

Signes qu'il est temps de migrer:
- ❗ CPU constamment > 70%
- ❗ RAM constamment > 80%
- ❗ Queries lentes (> 500ms en moyenne)
- ❗ Plus de 100 connexions simultanées
- ❗ Base > 10GB
- ❗ Besoin de réplication
- ❗ Besoin de point-in-time recovery

### Options de Scaling

**Option 1: Augmenter le droplet**
```hcl
# terraform.tfvars
droplet_size = "s-2vcpu-4gb"  # $24/mois (double ressources)
```

**Option 2: Migrer vers DB managée**
```hcl
# Re-ajouter digitalocean_database_cluster
# Coût: +$15/mois minimum
```

**Option 3: Séparer sur 2 droplets**
- Droplet 1: App (s-1vcpu-2gb @ $12)
- Droplet 2: PostgreSQL (s-1vcpu-2gb @ $12)
- **Total:** $24/mois, plus de ressources

## Conclusion

Pour **Weather App** et la plupart des apps similaires:

✅ **PostgreSQL local = excellent choix**
- Coût réduit de 55%
- Performance identique pour usage normal
- Simplicité de gestion
- Backups automatiques en place

Le coût de **$12/mois** est **imbattable** pour une stack complète:
- Application Node.js
- Base de données PostgreSQL
- Cache Redis
- Reverse proxy nginx
- Backups automatiques

**ROI:** Économisez $180/an pour le même service!

---

**Besoin de plus de performance?**
Augmentez d'abord le droplet ($24/mois pour 4GB) avant de migrer vers DB managée ($27/mois minimum).
