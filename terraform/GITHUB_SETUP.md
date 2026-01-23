# Configuration GitHub Actions pour Terraform

## 1. Créer un utilisateur IAM AWS pour GitHub Actions

### Via AWS Console:

1. Aller sur **IAM** > **Users** > **Create user**
2. Nom: `github-actions-terraform`
3. Ne pas cocher "Provide user access to AWS Management Console"
4. **Attach policies directly**:
   - `AmazonEC2FullAccess`
   - `AmazonRDSFullAccess`
   - `AmazonS3FullAccess`
   - `AmazonVPCFullAccess`
   - `CloudWatchLogsFullAccess`
   - `IAMReadOnlyAccess`
5. Créer l'utilisateur
6. Aller dans l'utilisateur > **Security credentials** > **Create access key**
7. Sélectionner "Third-party service" ou "CLI"
8. **Copier Access Key ID et Secret Access Key** (vous ne pourrez plus les voir après!)

### Via AWS CLI (optionnel):

```bash
# Créer l'utilisateur
aws iam create-user --user-name github-actions-terraform

# Attacher les policies
aws iam attach-user-policy --user-name github-actions-terraform --policy-arn arn:aws:iam::aws:policy/AmazonEC2FullAccess
aws iam attach-user-policy --user-name github-actions-terraform --policy-arn arn:aws:iam::aws:policy/AmazonRDSFullAccess
aws iam attach-user-policy --user-name github-actions-terraform --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam attach-user-policy --user-name github-actions-terraform --policy-arn arn:aws:iam::aws:policy/AmazonVPCFullAccess
aws iam attach-user-policy --user-name github-actions-terraform --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess
aws iam attach-user-policy --user-name github-actions-terraform --policy-arn arn:aws:iam::aws:policy/IAMReadOnlyAccess

# Créer les access keys
aws iam create-access-key --user-name github-actions-terraform
```

## 2. Configurer les Secrets GitHub

Aller sur votre repo GitHub:
**Settings** > **Secrets and variables** > **Actions**

### Repository Secrets (sensibles):

Cliquez sur **New repository secret** pour chacun:

| Nom | Valeur |
|-----|--------|
| `AWS_ACCESS_KEY_ID` | Votre AWS Access Key ID |
| `AWS_SECRET_ACCESS_KEY` | Votre AWS Secret Access Key |
| `TF_VAR_weatherapi_key` | `VOTRE_CLE_WEATHERAPI` |
| `TF_VAR_anthropic_api_key` | `VOTRE_CLE_ANTHROPIC` |
| `TF_VAR_db_password` | `VOTRE_MOT_DE_PASSE_DB` |

### Repository Variables (non-sensibles):

Cliquez sur l'onglet **Variables** puis **New repository variable** pour chacun:

| Nom | Valeur |
|-----|--------|
| `TF_VAR_aws_region` | `eu-west-3` |
| `TF_VAR_environment` | `prod` |
| `TF_VAR_project_name` | `weather-app` |
| `TF_VAR_ec2_instance_type` | `t3.micro` |
| `TF_VAR_ec2_key_name` | `tf-weather-app-key` |
| `TF_VAR_rds_instance_type` | `db.t4g.micro` |
| `TF_VAR_db_name` | `weatherapp` |
| `TF_VAR_db_username` | `weatherapp_user` |
| `TF_VAR_domain_name` | `matambouille.quest` |

## 3. Configurer le Backend Terraform (S3 - Optionnel mais recommandé)

Pour stocker l'état Terraform dans S3 au lieu de le commit:

### Créer le bucket S3:

```bash
aws s3 mb s3://weather-app-terraform-state --region eu-west-3
aws s3api put-bucket-versioning --bucket weather-app-terraform-state --versioning-configuration Status=Enabled
```

### Créer la table DynamoDB pour le lock:

```bash
aws dynamodb create-table \
  --table-name weather-app-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-3
```

### Modifier `terraform/backend.tf`:

Créer le fichier `terraform/backend.tf`:

```hcl
terraform {
  backend "s3" {
    bucket         = "weather-app-terraform-state"
    key            = "terraform.tfstate"
    region         = "eu-west-3"
    encrypt        = true
    dynamodb_table = "weather-app-terraform-locks"
  }
}
```

Puis migrer l'état:

```bash
cd terraform
terraform init -migrate-state
```

## 4. Tester le Workflow

### Sur Pull Request:
1. Créer une branche: `git checkout -b test-terraform`
2. Modifier un fichier Terraform
3. Commit et push: `git push origin test-terraform`
4. Créer une Pull Request sur GitHub
5. Le workflow va commenter la PR avec le plan Terraform

### Sur Push vers main:
1. Merger la PR ou push directement sur `main`
2. Le workflow va exécuter `terraform apply`
3. Les outputs seront affichés dans le summary de l'action

## 5. Déclencher manuellement

Aller sur **Actions** > **Terraform Deploy to AWS** > **Run workflow** > **Run workflow**

## 6. Sécurité

⚠️ **Important:**

- Ne jamais commit les credentials AWS
- Ne jamais commit le fichier `terraform.tfstate`
- Restreindre les IPs SSH en production (modifier `ssh_allowed_ips`)
- Utiliser des mots de passe forts pour la base de données
- Activer MFA sur le compte AWS
- Revoir régulièrement les permissions IAM

## Troubleshooting

### "Error: No valid credential sources found"
- Vérifier que `AWS_ACCESS_KEY_ID` et `AWS_SECRET_ACCESS_KEY` sont bien configurés dans les secrets

### "Error: Insufficient IAM permissions"
- Vérifier que l'utilisateur IAM a toutes les policies nécessaires

### "Error: Backend initialization required"
- Si vous utilisez S3 backend, vérifier que le bucket et la table DynamoDB existent

### "Error: state lock"
- Quelqu'un d'autre est en train d'exécuter Terraform
- Ou un job précédent a crashé: `terraform force-unlock <LOCK_ID>`

## Commandes utiles

```bash
# Voir les logs détaillés
terraform plan -detailed-exitcode

# Voir l'état actuel
terraform show

# Lister les ressources
terraform state list

# Importer une ressource existante
terraform import aws_instance.app i-1234567890abcdef0

# Détruire tout (DANGER!)
terraform destroy
```
