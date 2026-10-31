#!/usr/bin/env node
// setup.js — Configure Firebase Hosting pour ce projet (un projet, ou un projet dev + un projet prod)
// Usage : npm run setup — prérequis : Firebase CLI (`npm install -g firebase-tools`)

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
    execSync(cmd, { stdio: 'inherit' });
  } catch {
    if (opts.ignoreError) { c.warn(`Erreur ignorée : ${cmd}`); return; }
    c.error(`Commande échouée : ${cmd}`);
  }
}

function replaceInFile(file, replacements) {
  let content = fs.readFileSync(file, 'utf8');
  const before = content;
  for (const [from, to] of replacements) {
    content = content.split(from).join(to);
  }
  if (content === before) { c.warn(`Rien à remplacer (déjà configuré ?) : ${path.relative(ROOT, file)}`); return; }
  fs.writeFileSync(file, content, 'utf8');
  c.ok(`Mis à jour : ${path.relative(ROOT, file)}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  c.title('Setup Firebase Hosting');

  try {
    execSync('firebase --version', { stdio: 'ignore' });
  } catch {
    c.error('Firebase CLI introuvable : npm install -g firebase-tools');
  }

  console.log('Projets :');
  console.log('  1) Un seul projet pour dev et prod');
  console.log('  2) Un projet dev + un projet prod séparés');
  const dualEnv = (await ask('Choix [1/2] : ')).trim() === '2';

  let projectDev, projectProd;
  if (dualEnv) {
    projectDev  = (await ask('ID du projet DEV  (ex: mon-projet-dev)  : ')).trim();
    projectProd = (await ask('ID du projet PROD (ex: mon-projet-prod) : ')).trim();
  } else {
    projectDev = projectProd = (await ask('ID du projet      (ex: mon-projet)      : ')).trim();
  }
  if (!projectDev || !projectProd) c.error('ID de projet manquant.');

  console.log('');
  if (dualEnv) {
    c.info(`DEV  = ${projectDev}`);
    c.info(`PROD = ${projectProd}`);
  } else {
    c.info(`PROJET = ${projectDev}`);
  }
  const confirm = await ask('Confirmer ? [y/N] : ');
  rl.close();
  if (!/^[yY]$/.test(confirm.trim())) { c.warn('Annulé.'); process.exit(0); }

  // ── Remplacement des placeholders ──────────────────────────────────────────
  c.title('Mise à jour des fichiers de configuration');
  replaceInFile(path.join(ROOT, 'package.json'), [['projectDevId', projectDev], ['projectProdId', projectProd]]);
  replaceInFile(path.join(ROOT, '.firebaserc'), [['projectId', projectDev]]);

  // ── Firebase ────────────────────────────────────────────────────────────────
  c.title('Configuration Firebase');
  run('firebase login');
  for (const project of new Set([projectDev, projectProd])) {
    c.info(`Projet ${project} : ajout de Firebase et du site Hosting (ignoré s'ils existent déjà)...`);
    run(`firebase projects:addfirebase ${project}`, { ignoreError: true });
    run(`firebase hosting:sites:create ${project} --project ${project}`, { ignoreError: true });
  }

  // ── Résumé ──────────────────────────────────────────────────────────────────
  c.success('Setup terminé');
  console.log('\n  Prochaines étapes :');
  console.log('  1. npm run dev                    — lancer localement');
  console.log('  2. npm run deploy:dev             — déployer en dev');
  if (dualEnv) console.log('  3. npm run deploy:prod            — déployer en prod');
  console.log('');
})();
