#!/usr/bin/env node
// setup.js — Initialise un nouveau projet GCP/Firebase à partir du template
// Usage : node scripts/setup.js

const readline = require('readline');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── Couleurs ─────────────────────────────────────────────────────────────────
const c = {
  info:    (s) => console.log(`\x1b[36m[INFO]\x1b[0m  ${s}`),
  ok:      (s) => console.log(`\x1b[32m[OK]\x1b[0m    ${s}`),
  warn:    (s) => console.log(`\x1b[33m[WARN]\x1b[0m  ${s}`),
  error:   (s) => { console.error(`\x1b[31m[ERR]\x1b[0m   ${s}`); process.exit(1); },
  title:   (s) => console.log(`\n\x1b[36m=== ${s} ===\x1b[0m`),
  success: (s) => console.log(`\n\x1b[32m=== ${s} ===\x1b[0m`),
};

// ── Utilitaires ───────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

function run(cmd, opts = {}) {
  c.info(`$ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', ...opts });
  } catch (e) {
    if (opts.ignoreError) { c.warn(`Erreur ignorée : ${cmd}`); return; }
    c.error(`Commande échouée : ${cmd}`);
  }
}

function replaceInFile(file, replacements) {
  if (!fs.existsSync(file)) { c.warn(`Fichier introuvable (ignoré) : ${file}`); return; }
  let content = fs.readFileSync(file, 'utf8');
  for (const [from, to] of replacements) {
    content = content.split(from).join(to);
  }
  fs.writeFileSync(file, content, 'utf8');
  c.ok(`Mis à jour : ${path.relative(ROOT, file)}`);
}

function getProjectNumber(projectId) {
  return execSync(`gcloud projects describe ${projectId} --format=value(projectNumber)`)
    .toString().trim();
}

// ── Setup d'un projet GCP ─────────────────────────────────────────────────────
function setupGcpProject(projectId, serviceName, region, label) {
  c.title(`Configuration GCP — ${label} (${projectId})`);

  run(`gcloud config set project ${projectId}`);

  c.info('Activation des APIs...');
  run(
    `gcloud services enable run.googleapis.com cloudbuild.googleapis.com ` +
    `artifactregistry.googleapis.com secretmanager.googleapis.com ` +
    `firestore.googleapis.com --project ${projectId}`
  );

  c.info('Création du repository Artifact Registry...');
  run(
    `gcloud artifacts repositories create ${serviceName} ` +
    `--repository-format=docker --location=${region} --project ${projectId}`,
    { ignoreError: true }
  );

  c.info('Création de la base Firestore...');
  run(
    `gcloud firestore databases create --location=${region} --project ${projectId}`,
    { ignoreError: true }
  );

  c.info('Configuration IAM Cloud Build...');
  const projectNumber = getProjectNumber(projectId);
  const cbSa = `${projectNumber}@cloudbuild.gserviceaccount.com`;
  run(`gcloud projects add-iam-policy-binding ${projectId} --member=serviceAccount:${cbSa} --role=roles/run.admin`);
  run(`gcloud projects add-iam-policy-binding ${projectId} --member=serviceAccount:${cbSa} --role=roles/iam.serviceAccountUser`);

  c.info('Accès Secret Manager pour Cloud Run...');
  const computeSa = `${projectNumber}-compute@developer.gserviceaccount.com`;
  run(`gcloud projects add-iam-policy-binding ${projectId} --member=serviceAccount:${computeSa} --role=roles/secretmanager.secretAccessor`);

  c.info('Premier déploiement backend...');
  run(
    `gcloud run deploy ${serviceName} --source ${path.join(ROOT, 'backend')} ` +
    `--region ${region} --project ${projectId} --allow-unauthenticated`
  );
  c.ok(`Backend déployé : ${serviceName} (${label})`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  c.title('Setup du projet');

  const appName = await ask('Nom de l\'application (ex: MonApp)         : ');
  const regionInput = await ask('Région               [europe-west1]        : ');
  const region = regionInput.trim() || 'europe-west1';

  console.log('\nProjets GCP :');
  console.log('  1) Un seul projet pour dev et prod');
  console.log('  2) Un projet dev + un projet prod séparés');
  const envMode = await ask('Choix [1/2] : ');

  let projectDev, projectProd;
  if (envMode.trim() === '2') {
    projectDev  = (await ask('GCP Project ID DEV  (ex: mon-projet-dev)  : ')).trim();
    projectProd = (await ask('GCP Project ID PROD (ex: mon-projet-prod) : ')).trim();
  } else {
    projectDev = projectProd = (await ask('GCP Project ID      (ex: mon-projet)      : ')).trim();
  }

  const serviceDev  = `api-${projectDev}`;
  const serviceProd = `api-${projectProd}`;
  const dualEnv = envMode.trim() === '2';

  // Récapitulatif
  console.log('');
  c.info(`APP_NAME    = ${appName}`);
  c.info(`REGION      = ${region}`);
  if (dualEnv) {
    c.info(`PROJECT DEV = ${projectDev}  (service: ${serviceDev})`);
    c.info(`PROJECT PROD= ${projectProd}  (service: ${serviceProd})`);
  } else {
    c.info(`PROJECT     = ${projectDev}  (service: ${serviceDev})`);
  }
  console.log('');
  const confirm = await ask('Confirmer ? [y/N] : ');
  rl.close();
  if (!/^[yY]$/.test(confirm.trim())) { c.warn('Annulé.'); process.exit(0); }

  // ── Remplacement des placeholders ──────────────────────────────────────────
  c.title('Mise à jour des fichiers de configuration');

  replaceInFile(path.join(ROOT, 'package.json'), [
    ['projectDevId', projectDev], ['projectProdId', projectProd],
    ['serviceDevName', serviceDev], ['serviceProdName', serviceProd],
    ['regionId', region],
  ]);

  replaceInFile(path.join(ROOT, 'cloud-run.dev.yaml'), [
    ['serviceName', serviceDev], ['projectId', projectDev], ['appName', appName], ['regionId', region],
  ]);
  replaceInFile(path.join(ROOT, 'cloud-run.prod.yaml'), [
    ['serviceName', serviceProd], ['projectId', projectProd], ['appName', appName], ['regionId', region],
  ]);
  replaceInFile(path.join(ROOT, 'firebase.json'), [
    ['serviceName', serviceDev], ['regionId', region],
  ]);
  replaceInFile(path.join(ROOT, '.firebaserc'), [
    ['projectId', projectDev],
  ]);

  // backend/.env
  const envFile = path.join(ROOT, 'backend', '.env');
  if (fs.existsSync(envFile)) {
    c.warn('backend/.env existe déjà — non écrasé.');
  } else {
    let env = fs.readFileSync(path.join(ROOT, 'backend', '.env.example'), 'utf8');
    env = env.split('appName').join(appName).split('projectId').join(projectDev);
    fs.writeFileSync(envFile, env, 'utf8');
    c.ok('Créé : backend/.env');
  }

  // ── Authentification GCP ────────────────────────────────────────────────────
  c.title('Authentification GCP');
  run('gcloud auth login');
  run('gcloud auth application-default login');

  // ── Setup projets ───────────────────────────────────────────────────────────
  setupGcpProject(projectDev, serviceDev, region, 'DEV');
  if (dualEnv) setupGcpProject(projectProd, serviceProd, region, 'PROD');

  // ── Firebase ────────────────────────────────────────────────────────────────
  c.title('Configuration Firebase');
  run('firebase login');

  c.info('Ajout de Firebase au projet GCP DEV...');
  run(`firebase projects:addfirebase ${projectDev}`, { ignoreError: true });
  run(`firebase hosting:sites:create ${projectDev} --project ${projectDev}`, { ignoreError: true });

  if (dualEnv) {
    c.info('Ajout de Firebase au projet GCP PROD...');
    run(`firebase projects:addfirebase ${projectProd}`, { ignoreError: true });
    run(`firebase hosting:sites:create ${projectProd} --project ${projectProd}`, { ignoreError: true });
  }

  // ── Résumé ──────────────────────────────────────────────────────────────────
  c.success('Setup terminé');
  console.log('\n  Prochaines étapes :');
  console.log('  1. Créer le secret API_SECRET_KEY dans Secret Manager (console GCP)');
  console.log('  2. npm install && npm run dev     — lancer localement');
  console.log('  3. npm run deploy:dev             — déployer en dev');
  if (dualEnv) console.log('  4. npm run deploy:prod            — déployer en prod');
  console.log('');
})();
