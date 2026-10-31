# 0-Virgin Template

Application web full-stack déployée sur **Google Cloud Run** (backend) et **Firebase Hosting** (frontend).

- **Backend** : Node.js + Express 5
- **Frontend** : Vue 3 + Vite + Vuetify
- **Base de données** : Firestore

---

## Architecture

```
Utilisateur
    │
    ▼
Firebase Hosting (frontend Vue.js)
    │  /api/** → réécriture Firebase
    ▼
Cloud Run (backend Express)
    │
    ▼
Firestore (base de données)
```

En développement, le proxy Vite redirige `/api/*` vers `localhost:8080`.

---

## Initialisation d'un nouveau projet

Le script de setup configure automatiquement les fichiers, crée les ressources GCP et effectue le premier déploiement.

```bash
npm run setup
```

Il demande interactivement :
- Le nom de l'application
- La région GCP (défaut : `europe-west1`)
- Un projet GCP unique ou deux projets séparés dev / prod

Ce que le script fait :
- Remplace les placeholders dans `package.json`, `cloud-run.dev.yaml`, `cloud-run.prod.yaml`, `firebase.json`, `.firebaserc`, `backend/.env`
- Active les APIs GCP nécessaires
- Crée le repository Artifact Registry, la base Firestore, configure les IAM Cloud Build
- Effectue le premier déploiement backend sur Cloud Run
- Configure Firebase Hosting

> **Prérequis** : `gcloud` et `firebase` CLI installés et dans le PATH.

---

## Démarrage local

```bash
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

npm run dev   # backend :8080 + frontend :5173
```

---

## Variables d'environnement

| Fichier | Rôle | Commité ? |
|---|---|---|
| `backend/.env.example` | Modèle documentant toutes les variables | ✅ oui |
| `backend/.env` | Valeurs locales de développement | ❌ non (gitignored) |

| Variable | Type | Description |
|---|---|---|
| `APP_NAME` | normale | Nom affiché dans les logs et les réponses API |
| `PORT` | normale | Port d'écoute du serveur (défaut : `8080`) |
| `ALLOWED_ORIGIN` | normale | Origine CORS autorisée |
| `GOOGLE_CLOUD_PROJECT` | normale | ID du projet GCP |
| `API_SECRET_KEY` | **secret** | Clé secrète pour les endpoints sensibles |

Les variables normales sont déclarées dans `cloud-run.dev.yaml` / `cloud-run.prod.yaml` et injectées automatiquement au déploiement.

> **Note CORS** : en développement, le proxy Vite évite les requêtes cross-origin. La configuration CORS est active uniquement en production.

---

## Secrets via Google Secret Manager

Les secrets ne doivent **jamais** apparaître dans le code ou les variables d'env en clair. Cloud Run les injecte depuis Secret Manager.

### Créer un secret

```bash
echo -n "ma-valeur-secrete" | gcloud secrets create api-secret-key \
  --data-file=- \
  --replication-policy=automatic \
  --project <PROJECT_ID>
```

### Autoriser Cloud Run à lire le secret

```bash
PROJECT_NUMBER=$(gcloud projects describe <PROJECT_ID> --format='value(projectNumber)')

gcloud secrets add-iam-policy-binding api-secret-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project <PROJECT_ID>
```

### Mettre à jour un secret

```bash
echo -n "nouvelle-valeur" | gcloud secrets versions add api-secret-key \
  --data-file=- \
  --project <PROJECT_ID>
# Cloud Run (configuré avec :latest) utilisera la nouvelle version au prochain démarrage.
```

### Lire les secrets configurés sur le service

```bash
gcloud run services describe <SERVICE_NAME> \
  --region <REGION> \
  --format='yaml(spec.template.spec.containers[0].env)' \
  --project <PROJECT_ID>
```

---

## Déploiement

| Commande | Description |
|---|---|
| `npm run deploy:dev` | Déploie backend + frontend en dev |
| `npm run deploy:prod` | Déploie backend + frontend en prod |
| `npm run deploy:backend:dev` | Backend seul (dev) |
| `npm run deploy:frontend:dev` | Frontend seul (dev) |
