# Terraform Backend Configuration
#
# Par défaut, Terraform utilise un backend local (terraform.tfstate dans ce dossier)
#
# Pour utiliser un backend distant avec DigitalOcean Spaces (compatible S3):
# 1. Créez un Space dans DigitalOcean (Storage → Spaces)
# 2. Créez des clés API Spaces (Account → API → Spaces access keys)
# 3. Décommentez et configurez le bloc ci-dessous
# 4. Exécutez: terraform init -migrate-state

# terraform {
#   backend "s3" {
#     # DigitalOcean Spaces configuration (compatible S3)
#     bucket   = "your-space-name"
#     key      = "terraform.tfstate"
#     region   = "fra1"  # Même région que votre Space
#     endpoint = "https://fra1.digitaloceanspaces.com"
#
#     # Désactiver ces options AWS qui ne sont pas supportées par Spaces
#     skip_credentials_validation = true
#     skip_metadata_api_check     = true
#     skip_region_validation      = true
#   }
# }

# Pour Terraform Cloud (gratuit pour petites équipes):
# terraform {
#   cloud {
#     organization = "your-org-name"
#     workspaces {
#       name = "weather-app"
#     }
#   }
# }

# Variables d'environnement requises pour Spaces backend:
# export AWS_ACCESS_KEY_ID="your_spaces_access_key"
# export AWS_SECRET_ACCESS_KEY="your_spaces_secret_key"
