# Configuration CloudWatch pour Weather App

## Vue d'ensemble

Cette configuration permet de collecter et visualiser les logs de l'instance EC2 dans CloudWatch, ainsi que les métriques système.

## Logs Collectés

Les logs suivants sont automatiquement envoyés à CloudWatch:

### Log Group: `/aws/ec2/weather-app`

**Log Streams:**

1. **application** - Logs de l'application Node.js (stdout)
   - Fichier: `/home/weatherapp/logs/out.log`
   - Contenu: Logs applicatifs PM2

2. **application-errors** - Erreurs de l'application (stderr)
   - Fichier: `/home/weatherapp/logs/err.log`
   - Contenu: Erreurs et stack traces

3. **nginx-access** - Logs d'accès Nginx
   - Fichier: `/var/log/nginx/access.log`
   - Contenu: Requêtes HTTP reçues

4. **nginx-error** - Erreurs Nginx
   - Fichier: `/var/log/nginx/error.log`
   - Contenu: Erreurs du serveur web

5. **redis** - Logs Redis
   - Fichier: `/var/log/redis6/redis6.log`
   - Contenu: Activité Redis et erreurs

6. **system** - Logs système
   - Fichier: `/var/log/messages`
   - Contenu: Messages système Linux

7. **user-data** - Logs d'initialisation EC2
   - Fichier: `/var/log/user-data.log`
   - Contenu: Sortie du script user-data

## Métriques Collectées

Namespace: `WeatherApp`

- **CPU_IDLE** - Pourcentage CPU inutilisé
- **cpu_usage_iowait** - Temps CPU en attente I/O
- **DISK_USED** - Pourcentage disque utilisé
- **io_time** - Temps d'I/O disque
- **MEM_USED** - Pourcentage mémoire utilisée

## Alarmes

### high-error-rate
- **Condition:** Plus de 100 événements de log en 5 minutes
- **Évaluations:** 2 périodes consécutives
- **Action:** Alarme déclenchée (peut être liée à SNS pour notifications)

## Dashboard CloudWatch

Un dashboard est automatiquement créé avec:
- Logs récents de l'application (100 dernières entrées)
- Graphique d'utilisation CPU de l'instance EC2

**Accès:** AWS Console > CloudWatch > Dashboards > `weather-app-dashboard`

## Visualiser les Logs

### Via AWS Console

1. Aller dans **AWS Console > CloudWatch > Log groups**
2. Sélectionner `/aws/ec2/weather-app`
3. Choisir un log stream (application, nginx-access, etc.)
4. Voir les logs en temps réel

### Via AWS CLI

```bash
# Voir les logs en temps réel
aws logs tail /aws/ec2/weather-app --follow

# Voir un stream spécifique
aws logs tail /aws/ec2/weather-app --follow --log-stream-names application

# Filtrer les erreurs
aws logs filter-log-events \
  --log-group-name /aws/ec2/weather-app \
  --filter-pattern "ERROR"

# Voir les 100 derniers logs
aws logs tail /aws/ec2/weather-app --since 10m
```

### Via CloudWatch Insights

Requêtes utiles dans CloudWatch Insights:

```sql
# Compter les erreurs par heure
fields @timestamp, @message
| filter @message like /ERROR/
| stats count() by bin(1h)

# Top 10 des URLs les plus visitées (nginx)
fields @timestamp, @message
| parse @message /(?<method>\w+) (?<url>\S+) HTTP/
| stats count() by url
| sort count desc
| limit 10

# Temps de réponse moyen (nginx)
fields @timestamp, @message
| parse @message /request_time=(?<response_time>\d+\.\d+)/
| stats avg(response_time) by bin(5m)
```

## Configuration IAM

L'instance EC2 possède un rôle IAM avec les permissions suivantes:

```json
{
  "Effect": "Allow",
  "Action": [
    "logs:CreateLogGroup",
    "logs:CreateLogStream",
    "logs:PutLogEvents",
    "logs:DescribeLogStreams",
    "cloudwatch:PutMetricData"
  ],
  "Resource": "arn:aws:logs:*:*:log-group:/aws/ec2/weather-app*"
}
```

## Rétention des Logs

- **Production:** 30 jours
- **Dev:** 7 jours

Modifiable dans `cloudwatch.tf`:
```hcl
retention_in_days = var.environment == "prod" ? 30 : 7
```

## Coûts

### Logs
- **Ingestion:** $0.50 / GB
- **Stockage:** $0.03 / GB/mois
- **Insights queries:** $0.005 / GB scanné

### Métriques personnalisées
- **Custom metrics:** $0.30 / métrique / mois
- **API requests:** $0.01 / 1000 requêtes

**Estimation mensuelle:**
- ~10 GB logs/mois: ~$5.30
- 5 métriques custom: ~$1.50
- **Total: ~$7/mois**

## Troubleshooting

### Les logs n'apparaissent pas

1. **Vérifier que CloudWatch Agent est actif:**
   ```bash
   ssh ec2-user@<EC2_IP>
   sudo systemctl status amazon-cloudwatch-agent
   ```

2. **Vérifier les logs de l'agent:**
   ```bash
   sudo tail -f /opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log
   ```

3. **Redémarrer l'agent:**
   ```bash
   sudo systemctl restart amazon-cloudwatch-agent
   ```

4. **Vérifier les permissions IAM:**
   - L'instance doit avoir le role `weather-app-ec2-cloudwatch-role`
   - Vérifier dans EC2 Console > Instance > Security > IAM Role

### Les métriques ne sont pas collectées

1. **Vérifier la configuration:**
   ```bash
   sudo cat /opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-config.json
   ```

2. **Tester la configuration:**
   ```bash
   sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
     -a fetch-config \
     -m ec2 \
     -s \
     -c file:/opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-config.json
   ```

### Logs en retard

CloudWatch agent collecte les logs toutes les 60 secondes. Un délai de 1-2 minutes est normal.

## Intégration avec Terraform

### Déployer la configuration

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

### Détruire les ressources CloudWatch

```bash
# Attention: supprime tous les logs!
terraform destroy -target=aws_cloudwatch_log_group.ec2_main
```

## Notifications (Optionnel)

Pour recevoir des notifications par email lors d'une alarme:

1. **Créer un SNS Topic:**
   ```hcl
   resource "aws_sns_topic" "alerts" {
     name = "weather-app-alerts"
   }

   resource "aws_sns_topic_subscription" "email" {
     topic_arn = aws_sns_topic.alerts.arn
     protocol  = "email"
     endpoint  = "votre-email@example.com"
   }
   ```

2. **Lier l'alarme au topic:**
   ```hcl
   resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
     # ...
     alarm_actions = [aws_sns_topic.alerts.arn]
   }
   ```

## Ressources

- [AWS CloudWatch Documentation](https://docs.aws.amazon.com/cloudwatch/)
- [CloudWatch Agent Configuration](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Agent-Configuration-File-Details.html)
- [CloudWatch Logs Insights Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
