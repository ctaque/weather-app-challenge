# Scripts Terraform - DigitalOcean

## setup-ssh-key.sh

Script pour uploader votre clé SSH publique sur votre compte DigitalOcean.

### Pourquoi ce script?

Terraform utilise maintenant une **data source** pour récupérer une clé SSH existante sur DigitalOcean au lieu d'en créer une nouvelle. Cela permet de:

✅ Réutiliser une clé existante
✅ Éviter les doublons
✅ Gérer vos clés depuis le dashboard DigitalOcean
✅ Partager la même clé entre plusieurs projets

### Prérequis

1. **Token API DigitalOcean**

   Récupérez-le sur: https://cloud.digitalocean.com/account/api/tokens

2. **Clé SSH locale**

   Si vous n'en avez pas:
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

### Usage

```bash
# Définir votre token DigitalOcean
export DO_TOKEN="dop_v1_xxxxxxxxxxxxx"

# Lancer le script
cd terraform/scripts
./setup-ssh-key.sh
```

### Ce que fait le script

1. ✅ Détecte automatiquement votre clé SSH publique (`~/.ssh/id_ed25519.pub` ou `~/.ssh/id_rsa.pub`)
2. 📤 Upload la clé vers DigitalOcean via API
3. 📋 Affiche le nom de la clé à utiliser dans `terraform.tfvars`
4. ⚠️  Si la clé existe déjà, liste vos clés existantes

### Exemple de sortie

```
==================================================
  DigitalOcean SSH Key Setup
==================================================

✅ Clé SSH trouvée: /home/user/.ssh/id_ed25519.pub

Contenu de la clé:
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... user@host

Nom de la clé sur DigitalOcean (défaut: weather-app-key):

📤 Upload de la clé SSH vers DigitalOcean...

✅ Clé SSH uploadée avec succès!

ID: 12345678
Fingerprint: aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99
Nom: weather-app-key

📝 Configuration Terraform

Ajoutez cette ligne dans terraform.tfvars:
ssh_key_name = "weather-app-key"
```

### Configuration manuelle (alternative)

Si vous préférez uploader manuellement via le dashboard:

1. Allez sur: https://cloud.digitalocean.com/account/security
2. Cliquez sur **Add SSH Key**
3. Collez votre clé publique:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```
4. Nommez-la: `weather-app-key` (ou autre)
5. Ajoutez dans `terraform.tfvars`:
   ```hcl
   ssh_key_name = "weather-app-key"
   ```

### Utilisation avec doctl (CLI DigitalOcean)

Si vous avez `doctl` installé:

```bash
# Lister vos clés SSH
doctl compute ssh-key list

# Ajouter une nouvelle clé
doctl compute ssh-key create weather-app-key \
  --public-key "$(cat ~/.ssh/id_ed25519.pub)"

# Supprimer une clé
doctl compute ssh-key delete KEY_ID
```

### Dépannage

#### Erreur: "SSH Key is already in use"

Votre clé existe déjà sur DigitalOcean. Options:

1. **Réutiliser la clé existante:**
   ```bash
   # Lister vos clés
   doctl compute ssh-key list

   # Utiliser le nom dans terraform.tfvars
   ssh_key_name = "nom-de-la-cle-existante"
   ```

2. **Supprimer l'ancienne clé:**
   ```bash
   # Via dashboard: https://cloud.digitalocean.com/account/security
   # Ou via API/doctl
   ```

#### Erreur: "DO_TOKEN not defined"

```bash
# Définir la variable d'environnement
export DO_TOKEN="dop_v1_xxxxxxxxxxxxx"

# Ou ajouter dans ~/.bashrc ou ~/.zshrc
echo 'export DO_TOKEN="dop_v1_xxxxx"' >> ~/.bashrc
```

#### Erreur: "Aucune clé SSH publique trouvée"

Générez une nouvelle clé:

```bash
# Recommandé: ed25519 (plus sécurisé et compact)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Ou: RSA (plus compatible)
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

#### Terraform ne trouve pas la clé

Erreur lors de `terraform plan`:

```
Error: no SSH Key found with name weather-app-key
```

**Solutions:**

1. Vérifiez que la clé existe sur DigitalOcean:
   ```bash
   doctl compute ssh-key list
   ```

2. Vérifiez le nom dans `terraform.tfvars`:
   ```hcl
   ssh_key_name = "nom-exact-de-la-cle"
   ```

3. Uploadez la clé si elle n'existe pas:
   ```bash
   ./setup-ssh-key.sh
   ```

## Commandes Utiles

### Via API DigitalOcean

```bash
# Lister toutes vos clés SSH
curl -X GET \
  -H "Authorization: Bearer $DO_TOKEN" \
  "https://api.digitalocean.com/v2/account/keys" | jq

# Ajouter une clé
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DO_TOKEN" \
  -d '{"name":"weather-app-key","public_key":"ssh-ed25519 AAAA..."}' \
  "https://api.digitalocean.com/v2/account/keys"

# Supprimer une clé
curl -X DELETE \
  -H "Authorization: Bearer $DO_TOKEN" \
  "https://api.digitalocean.com/v2/account/keys/KEY_ID"
```

### Via Terraform

```bash
# Voir quelle clé sera utilisée
terraform plan

# Forcer le refresh de la data source
terraform apply -refresh-only
```

## Ressources

- [DigitalOcean SSH Keys Documentation](https://docs.digitalocean.com/products/droplets/how-to/add-ssh-keys/)
- [Terraform DigitalOcean SSH Key Data Source](https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs/data-sources/ssh_key)
- [DigitalOcean API SSH Keys](https://docs.digitalocean.com/reference/api/api-reference/#tag/SSH-Keys)

## Support

Pour des questions:
1. Vérifiez que votre clé existe sur DO: https://cloud.digitalocean.com/account/security
2. Vérifiez le nom dans `terraform.tfvars`
3. Consultez la documentation Terraform
4. Ouvrez une issue GitHub
