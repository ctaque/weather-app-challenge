# Production Readiness Checklist

Liste de vérification avant mise en production.

## 🔒 Sécurité

### Infrastructure
- [ ] SSH limité à IP autorisées uniquement (`ssh_allowed_ips`)
- [ ] Security Groups vérifiés (pas de ports inutiles ouverts)
- [ ] RDS dans subnet privé (pas d'accès Internet direct)
- [ ] Encryption RDS activée
- [ ] Elastic IP attachée (évite changement IP)

### Secrets
- [ ] Mots de passe forts (min 16 caractères)
- [ ] API keys stockées dans `.env` (jamais committées)
- [ ] `terraform.tfvars` dans `.gitignore`
- [ ] Fichiers `.pem` SSH dans `.gitignore`
- [ ] Envisager AWS Secrets Manager pour production

### Application
- [ ] Rate limiting activé dans Express
- [ ] CORS configuré correctement
- [ ] Input validation sur tous les endpoints
- [ ] Pas de données sensibles dans les logs
- [ ] HTTPS activé (Let's Encrypt)

## 🏗️ Infrastructure

### EC2
- [ ] Instance type approprié (t3.micro pour début)
- [ ] User data script testé
- [ ] PM2 configuré pour auto-restart
- [ ] Nginx configuré comme reverse proxy
- [ ] Redis fonctionne et persiste
- [ ] CloudWatch agent installé

### RDS
- [ ] Automated backups activés (7 jours minimum)
- [ ] Backup window défini (heures creuses)
- [ ] Performance Insights activé
- [ ] Storage auto-scaling configuré (20GB → 100GB)
- [ ] Connection string testée depuis EC2
- [ ] Multi-AZ évalué (si budget le permet)

### Réseau
- [ ] VPC correctement configuré
- [ ] Subnets publics/privés séparés
- [ ] Route tables vérifiées
- [ ] Internet Gateway attaché
- [ ] DNS résolution activée

### Stockage
- [ ] S3 bucket créé pour assets
- [ ] S3 public access configuré
- [ ] Lifecycle policies définies (optionnel)
- [ ] EBS volumes dimensionnés correctement

## 📊 Monitoring

### Logs
- [ ] CloudWatch Logs configuré
- [ ] Rétention définie (7 jours minimum)
- [ ] Logs Nginx accessibles
- [ ] Logs application centralisés
- [ ] PM2 logs visibles

### Métriques
- [ ] CloudWatch metrics activées
- [ ] CPU monitoring
- [ ] Disk usage monitoring
- [ ] Network monitoring
- [ ] RDS connections monitoring

### Alertes
- [ ] Budget alert configuré (30€/mois)
- [ ] Alerte CPU > 80%
- [ ] Alerte Disk > 90%
- [ ] Alerte RDS connections > 80
- [ ] Status check alerts (EC2)

### Santé
- [ ] Health check endpoint créé (`/health`)
- [ ] Script monitoring.sh testé
- [ ] Alertes fonctionnelles testées

## 🔄 Backups & Recovery

### Backups
- [ ] RDS automated backups activés
- [ ] Backup retention 7+ jours
- [ ] Manual snapshots testés (`./backup-db.sh`)
- [ ] Snapshots anciens supprimés régulièrement
- [ ] Backup window en heures creuses

### Disaster Recovery
- [ ] Plan de recovery documenté
- [ ] Restore from snapshot testé
- [ ] RTO/RPO définis
- [ ] Procédure de failover documentée
- [ ] Contact support AWS configuré

### High Availability (Optionnel)
- [ ] Multi-AZ évalué
- [ ] Auto Scaling évalué
- [ ] Load Balancer évalué
- [ ] Read Replicas évaluées

## 🚀 Déploiement

### Application
- [ ] Code buildé et testé localement
- [ ] Dependencies installées
- [ ] Frontend build réussi
- [ ] PM2 ecosystem.config.js configuré
- [ ] Variables d'environnement définies
- [ ] Database migrations exécutées (si applicable)

### Tests
- [ ] Application accessible via HTTP
- [ ] API endpoints répondent
- [ ] Carte des vents fonctionne
- [ ] Redis cache fonctionne
- [ ] PostgreSQL accessible
- [ ] Logs sans erreurs

### CI/CD (Optionnel)
- [ ] GitHub Actions configuré
- [ ] Secrets GitHub définis
- [ ] Workflow testé
- [ ] Rollback procédure définie

## 💰 Coûts

### Optimisation
- [ ] Free Tier utilisé (si éligible)
- [ ] Instance types optimisés
- [ ] Storage dimensionné correctement
- [ ] Snapshots anciens supprimés
- [ ] Ressources inutilisées supprimées

### Monitoring
- [ ] AWS Cost Explorer activé
- [ ] Budget défini (30€/mois)
- [ ] Alertes coûts configurées
- [ ] Coûts mensuels vérifiés
- [ ] Reserved Instances évalués (après 12 mois)

### Documentation
- [ ] Coûts estimés documentés
- [ ] Optimisations possibles listées
- [ ] Plan d'optimisation défini

## 📝 Documentation

### Infrastructure
- [ ] README.md à jour
- [ ] ARCHITECTURE.md complété
- [ ] Variables Terraform documentées
- [ ] Outputs Terraform documentés

### Procédures
- [ ] Procédure de déploiement documentée
- [ ] Procédure de rollback documentée
- [ ] Procédure de backup documentée
- [ ] Procédure de restore documentée
- [ ] Procédure de mise à jour documentée

### Contact
- [ ] Liste des contacts définie
- [ ] Escalation path définie
- [ ] Support AWS contact
- [ ] Runbook créé

## 🧪 Tests

### Fonctionnels
- [ ] Page d'accueil charge
- [ ] API répond correctement
- [ ] Carte des vents affiche données
- [ ] WeatherAPI fonctionne
- [ ] Anthropic API fonctionne

### Performance
- [ ] Latence < 200ms
- [ ] Temps de chargement < 3s
- [ ] API response time < 500ms
- [ ] Cache Redis fonctionne

### Sécurité
- [ ] Scan de vulnérabilités effectué
- [ ] Ports non autorisés fermés
- [ ] HTTPS obligatoire (si SSL configuré)
- [ ] Headers de sécurité configurés

### Charge (Optionnel)
- [ ] Load testing effectué
- [ ] Limites identifiées
- [ ] Auto-scaling testé (si configuré)

## 🌐 Domaine & SSL (Optionnel)

### Domaine
- [ ] Domaine acheté
- [ ] DNS configuré (A record)
- [ ] Propagation DNS vérifiée
- [ ] Domain name dans terraform.tfvars

### SSL/TLS
- [ ] Certificat Let's Encrypt installé
- [ ] HTTPS fonctionne
- [ ] Auto-renewal configuré
- [ ] Redirect HTTP → HTTPS

### CDN (Optionnel)
- [ ] CloudFront configuré
- [ ] Cache TTL défini
- [ ] Invalidation testée

## 📋 Compliance & Legal

### GDPR (si applicable)
- [ ] Données personnelles identifiées
- [ ] Privacy policy créée
- [ ] Cookie consent configuré
- [ ] Droit à l'oubli implémenté

### Logs
- [ ] Logs anonymisés
- [ ] Rétention conforme
- [ ] Accès aux logs restreint

## ✅ Go/No-Go Decision

### Critères Bloquants
- [ ] Sécurité: Tous les points critiques validés
- [ ] Backups: Automatiques et testés
- [ ] Monitoring: Logs et alertes fonctionnels
- [ ] Tests: Application fonctionne correctement

### Critères Non-Bloquants (Nice to have)
- [ ] SSL/TLS configuré
- [ ] CDN activé
- [ ] Multi-AZ configuré
- [ ] CI/CD configuré

## 🎯 Post-Déploiement

### J+1
- [ ] Vérifier logs (erreurs?)
- [ ] Vérifier métriques (CPU, RAM)
- [ ] Vérifier coûts
- [ ] Tester application

### Semaine 1
- [ ] Monitoring quotidien
- [ ] Vérifier backups quotidiens
- [ ] Ajuster alertes si nécessaire
- [ ] Optimiser si nécessaire

### Mois 1
- [ ] Review coûts mensuel
- [ ] Analyser métriques
- [ ] Planifier optimisations
- [ ] Tester disaster recovery

## 📞 Contacts Utiles

- **AWS Support**: https://console.aws.amazon.com/support/
- **Terraform Registry**: https://registry.terraform.io/
- **Documentation**: Voir terraform/README.md

---

**Signature**: ___________________
**Date**: ___________________
**Environnement**: Production / Staging / Dev
