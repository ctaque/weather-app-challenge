# Scripts Terraform - Weather App

## Scripts disponibles

### check-cloudwatch.sh

Vérifie la configuration CloudWatch et l'état de l'agent sur l'instance EC2.

**Usage:**
```bash
cd terraform/scripts
./check-cloudwatch.sh
```

**Ce qu'il fait:**
- Récupère l'IP de l'instance depuis Terraform outputs
- Vérifie le statut de CloudWatch Agent sur l'instance (via SSH)
- Liste les log streams disponibles
- Affiche les logs récents
- Fournit des liens rapides vers la console AWS
- Suggère des commandes utiles

**Prérequis:**
- Terraform appliqué avec succès
- AWS CLI configuré
- Clé SSH pour accéder à l'instance

### tail-logs.sh

Suit les logs CloudWatch en temps réel.

**Usage:**
```bash
cd terraform/scripts
./tail-logs.sh
```

**Ce qu'il fait:**
- Propose un menu de sélection des log streams
- Suit les logs en temps réel avec AWS CLI
- Supporte le filtrage par stream ou tous les streams

**Options de streams:**
1. **application** - Logs stdout de l'application Node.js
2. **application-errors** - Logs stderr (erreurs)
3. **nginx-access** - Requêtes HTTP
4. **nginx-error** - Erreurs du serveur web
5. **redis** - Logs Redis
6. **system** - Messages système Linux
7. **user-data** - Logs d'initialisation EC2
8. **tous** - Affiche tous les streams

**Prérequis:**
- Terraform appliqué avec succès
- AWS CLI configuré
- CloudWatch Agent actif sur l'instance

## Dépannage

### "Impossible de récupérer l'IP de l'instance"

Assurez-vous que Terraform a été appliqué:
```bash
cd terraform
terraform apply
```

### "Log group not found"

CloudWatch Agent peut prendre 2-3 minutes pour démarrer après le déploiement. Attendez et réessayez.

### "Permission denied"

Les scripts doivent être exécutables:
```bash
chmod +x *.sh
```

### AWS CLI non configuré

Configurez vos credentials AWS:
```bash
aws configure
```

## Exemples d'utilisation

### Vérifier que CloudWatch fonctionne après déploiement

```bash
# Attendre 5 minutes après terraform apply
sleep 300

# Vérifier la configuration
./check-cloudwatch.sh
```

### Suivre les erreurs de l'application

```bash
./tail-logs.sh
# Choisir option 2 (application-errors)
```

### Suivre les requêtes HTTP en temps réel

```bash
./tail-logs.sh
# Choisir option 3 (nginx-access)
```

### Voir tous les logs mélangés

```bash
./tail-logs.sh
# Choisir option 8 (tous)
```

## Commandes AWS CLI utiles

### Tail des logs (sans script)

```bash
# Tous les logs
aws logs tail /aws/ec2/weather-app --follow

# Logs de l'application uniquement
aws logs tail /aws/ec2/weather-app --follow --log-stream-names application

# Depuis les 10 dernières minutes
aws logs tail /aws/ec2/weather-app --since 10m

# Filtrer les erreurs
aws logs filter-log-events \
  --log-group-name /aws/ec2/weather-app \
  --filter-pattern "ERROR"
```

### CloudWatch Insights (requêtes avancées)

```bash
# Compter les erreurs
aws logs start-query \
  --log-group-name /aws/ec2/weather-app \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/ | stats count() by bin(5m)'

# Récupérer les résultats
aws logs get-query-results --query-id <QUERY_ID>
```

### Métriques personnalisées

```bash
# Lister les métriques custom
aws cloudwatch list-metrics --namespace WeatherApp

# Voir les valeurs CPU
aws cloudwatch get-metric-statistics \
  --namespace WeatherApp \
  --metric-name CPU_IDLE \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --period 300 \
  --statistics Average
```

## Ressources

- [AWS CLI CloudWatch Logs](https://docs.aws.amazon.com/cli/latest/reference/logs/)
- [CloudWatch Logs Insights Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
- [Documentation CloudWatch](../CLOUDWATCH.md)
