import { reactive, watch } from 'vue';
import { workspace } from './collections';

/**
 * Fichier de travail : celui qu'on a ouvert ou sauvegardé (sauvegarde complète, voir `workspaceFile`). On retient
 * son nom (affiché en haut), son accès en écriture (`handle`, Chrome / Edge : « Sauvegarder » le réécrit sans rien
 * demander) et l'empreinte de son contenu, pour savoir si le travail a changé depuis (`modified`).
 *
 * Le nom et l'empreinte restent dans le navigateur (localStorage), l'accès au fichier aussi (IndexedDB) : après
 * un rechargement, « Sauvegarder » réécrit le même fichier (le navigateur peut redemander l'autorisation).
 */
const KEY = 'schemap-document';
const DB = 'schemap';
const STORE = 'handles';

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return { name: saved?.name ?? null, savedHash: saved?.savedHash ?? null };
  } catch {
    return { name: null, savedHash: null };
  }
}

export const doc = reactive({ ...load(), handle: null, hash: null, modified: false });

/** Empreinte du travail (collections et bibliothèque ; le mapping ouvert n'en fait pas partie). */
export function contentHash() {
  // Déplier ou replier un dossier du panneau (`open`) ne modifie pas le travail.
  const text = JSON.stringify({ c: workspace.collections, l: workspace.library }, (k, v) => (k === 'open' ? undefined : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return `${text.length}-${(h >>> 0).toString(16)}`;
}

function refresh() {
  doc.hash = contentHash();
  doc.modified = doc.savedHash !== doc.hash;
}

let timer;
watch(
  () => [workspace.collections, workspace.library],
  () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 400);
  },
  { deep: true },
);
refresh();

// ── Accès au fichier (IndexedDB) ─────────────────────────────
function idb(run) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction(STORE, 'readwrite');
      const r = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(r?.result);
      tx.onerror = () => reject(tx.error);
    };
  });
}
const storeHandle = (handle) => idb((s) => (handle ? s.put(handle, 'document') : s.delete('document'))).catch(() => {});
idb((s) => s.get('document'))
  .then((h) => {
    if (h && !doc.handle && h.name === doc.name) doc.handle = h;
  })
  .catch(() => {});

/** Le travail vient d'être ouvert depuis le fichier `name`, ou sauvegardé dedans : il n'est plus « modifié ». */
export function markSaved(name, handle) {
  clearTimeout(timer);
  Object.assign(doc, { name, handle: handle ?? null });
  doc.savedHash = contentHash();
  refresh();
  try {
    localStorage.setItem(KEY, JSON.stringify({ name: doc.name, savedHash: doc.savedHash }));
  } catch {
    /* espace plein : le nom sera oublié au rechargement */
  }
  storeHandle(doc.handle);
}

/** Change le nom du fichier (celui du prochain téléchargement), sans toucher à l'état « modifié ». */
export function renameDocument(name) {
  doc.name = name;
  try {
    localStorage.setItem(KEY, JSON.stringify({ name: doc.name, savedHash: doc.savedHash }));
  } catch {
    /* espace plein : le nom sera oublié au rechargement */
  }
}
