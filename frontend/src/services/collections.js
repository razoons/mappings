import { reactive, watch } from 'vue';
import { t } from '../lib/i18n';
import { uid } from '../lib/types';

/**
 * Espace de travail, conservé dans le navigateur :
 * - les **collections** de flux (mappings), à la manière de Postman, rangés éventuellement dans des dossiers ;
 * - la **bibliothèque de modèles** de données, réutilisables comme source ou cible par plusieurs flux.
 *
 * Éléments : conteneurs `{ id, type: 'collection' | 'folder', name, items, open }`, flux
 * `{ id, type: 'mapping', name, graph }` (`graph` : `{ nodes, edges }`, même contenu qu'un fichier de mapping) et
 * modèles `{ id, type: 'model', name, fields, sample? }` (`sample` : document d'exemple JSON, en texte).
 * La bibliothèque est un conteneur `{ id: 'library', type: 'library', items }` qui n'est pas affiché.
 * Un nœud source ou cible relié à un modèle porte son id dans `data.modelId` (voir services/models.js).
 */

const KEY = 'mapping-collections';
/** Ancien brouillon unique (avant les collections) : repris comme premier flux. */
const LEGACY_KEY = 'mapping-current';
/** Valeur de `format` d'un fichier de collection exporté. */
export const COLLECTION_FORMAT = 'schemap-collection';
/** Valeur de `format` d'un fichier de modèles exporté. */
export const MODELS_FORMAT = 'schemap-models';
export const LIBRARY_ID = 'library';

const untitled = () => t('Sans titre', 'Untitled');
const emptyGraph = () => ({ nodes: [], edges: [] });

export const makeMapping = (name = untitled(), graph = emptyGraph()) => ({ id: uid('map'), type: 'mapping', name, graph });
export const makeFolder = (name = t('Nouveau dossier', 'New folder'), items = []) => ({ id: uid('dir'), type: 'folder', name, items, open: true });
export const makeCollection = (name = t('Nouvelle collection', 'New collection'), items = []) => ({ id: uid('col'), type: 'collection', name, items, open: true });
const makeLibrary = (items = []) => ({ id: LIBRARY_ID, type: 'library', name: t('Modèles', 'Models'), items, open: true });

/** Élément qui en contient d'autres (collection, dossier, bibliothèque). */
export const isContainer = (item) => Array.isArray(item.items);
const isLeaf = (item) => item.type === 'mapping' || item.type === 'model';

function initial() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved?.collections)) return { library: makeLibrary(), ...saved };
  } catch {
    /* sauvegarde illisible : on repart de l'ancien brouillon */
  }
  let first = null;
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
    if (legacy?.graph) first = makeMapping(legacy.name || untitled(), legacy.graph);
  } catch {
    /* pas d'ancien brouillon utilisable */
  }
  first ??= makeMapping();
  return { collections: [makeCollection(t('Mes flux', 'My flows'), [first])], library: makeLibrary(), activeId: first.id };
}

/** Collections, bibliothèque de modèles et flux ouvert dans l'éditeur (`activeId`). */
export const workspace = reactive(initial());
/** Dernière erreur d'enregistrement dans le navigateur (espace plein…), `null` sinon. */
export const storage = reactive({ error: null });

export function saveNow() {
  try {
    localStorage.setItem(KEY, JSON.stringify(workspace));
    storage.error = null;
  } catch (e) {
    storage.error = e.message;
  }
}
let saveTimer;
watch(
  workspace,
  () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 300);
  },
  { deep: true },
);

// ── Recherche ───────────────────────────────────────────────

const roots = () => [...workspace.collections, workspace.library];

/** `{ item, parent, path }` de l'élément `id` : `parent` est son conteneur (`null` pour une collection), `path` ses ancêtres. */
export function locate(id, list = roots(), parent = null, path = []) {
  for (const item of list) {
    if (item.id === id) return { item, parent, path };
    if (isContainer(item)) {
      const found = locate(id, item.items, item, [...path, item]);
      if (found) return found;
    }
  }
  return null;
}

export const find = (id) => locate(id)?.item ?? null;
export const activeMapping = () => find(workspace.activeId);

function* leavesIn(list, type) {
  for (const item of list) {
    if (item.type === type) yield item;
    else if (isContainer(item)) yield* leavesIn(item.items, type);
  }
}
export const firstMapping = (list = workspace.collections) => leavesIn(list, 'mapping').next().value ?? null;
/** Nombre de flux (ou de modèles, dans la bibliothèque) d'un conteneur. */
export const leafCount = (item) => [...leavesIn(item.items, 'mapping')].length + [...leavesIn(item.items, 'model')].length;

/** Tous les flux : `{ mapping, path }` (`path` : noms de la collection et des dossiers). */
export function* allMappings(list = workspace.collections, path = []) {
  for (const item of list) {
    if (item.type === 'mapping') yield { mapping: item, path };
    else if (isContainer(item)) yield* allMappings(item.items, [...path, item.name]);
  }
}

export const allModels = () => [...leavesIn(workspace.library.items, 'model')];

/** Conteneur (dossier ou collection) du flux ouvert : c'est là qu'arrivent les nouveaux flux. */
export function activeContainer() {
  const parent = locate(workspace.activeId)?.parent;
  if (parent && parent !== workspace.library) return parent;
  if (!workspace.collections.length) workspace.collections.push(makeCollection());
  return workspace.collections[0];
}

/** Collection du flux ouvert. */
export function activeCollection() {
  const loc = locate(workspace.activeId);
  return loc?.path[0] ?? activeContainer();
}

const inLibrary = (loc) => (loc.path[0] ?? loc.item) === workspace.library;

// ── Modifications ───────────────────────────────────────────

const siblings = (loc) => (loc.parent ? loc.parent.items : workspace.collections);

/** Ajoute `mapping` dans le conteneur `containerId` (par défaut celui du flux ouvert) et l'ouvre. */
export function insertMapping(mapping, containerId = null) {
  const container = (containerId && find(containerId)) || activeContainer();
  container.items.push(mapping);
  container.open = true;
  workspace.activeId = mapping.id;
  return mapping;
}

/** Range un élément (modèle, dossier) dans la bibliothèque, ou dans son dossier `folderId`. */
export function addToLibrary(item, folderId = null) {
  const folder = (folderId && find(folderId)) || workspace.library;
  folder.items.push(item);
  folder.open = true;
  return item;
}

export function addFolder(containerId) {
  const container = find(containerId);
  const folder = makeFolder();
  container.items.push(folder);
  container.open = true;
  return folder;
}

/** Ajoute une collection (nouvelle et vide par défaut). */
export function addCollection(collection = makeCollection()) {
  workspace.collections.push(collection);
  return collection;
}

export function rename(id, name) {
  const item = find(id);
  if (item && name.trim()) item.name = name.trim();
}

/** Garantit un flux ouvert : le premier qui reste, ou un nouveau. */
function ensureActive() {
  const first = firstMapping();
  if (first) workspace.activeId = first.id;
  else insertMapping(makeMapping());
}

export function remove(id) {
  const loc = locate(id);
  if (!loc) return;
  const list = siblings(loc);
  list.splice(list.indexOf(loc.item), 1);
  if (!find(workspace.activeId)) ensureActive();
}

const PREFIXES = { mapping: 'map', model: 'mdl', folder: 'dir', collection: 'col' };

/** Copie profonde avec de nouveaux identifiants. */
function withFreshIds(item) {
  const copy = JSON.parse(JSON.stringify(item));
  const renew = (i) => {
    i.id = uid(PREFIXES[i.type]);
    if (isContainer(i)) i.items.forEach(renew);
  };
  renew(copy);
  return copy;
}

/** Duplique un élément juste après lui ; un flux dupliqué est ouvert. */
export function duplicate(id) {
  const loc = locate(id);
  if (!loc) return;
  const copy = withFreshIds(loc.item);
  copy.name = `${loc.item.name} ${t('(copie)', '(copy)')}`;
  const list = siblings(loc);
  list.splice(list.indexOf(loc.item) + 1, 0, copy);
  if (copy.type === 'mapping') workspace.activeId = copy.id;
  return copy;
}

/**
 * Déplace `id` dans le conteneur `targetId` (`inside`) ou juste avant lui (`before`). Une collection ne se range
 * qu'entre collections ; un dossier ne va pas dans lui-même ni dans un de ses sous-dossiers ; flux et modèles
 * restent chacun dans leur arbre.
 */
export function move(id, targetId, where) {
  if (id === targetId) return;
  const loc = locate(id);
  const target = locate(targetId);
  if (!loc || !target || inLibrary(loc) !== inLibrary(target)) return;
  if (loc.item.type === 'collection') {
    if (target.item.type !== 'collection') return;
    where = 'before';
  } else if (target.item.type === 'collection') {
    where = 'inside';
  }
  if (isContainer(loc.item) && target.path.includes(loc.item)) return;
  if (where === 'inside' && !isContainer(target.item)) return;
  const from = siblings(loc);
  from.splice(from.indexOf(loc.item), 1);
  if (where === 'inside') {
    target.item.items.push(loc.item);
    target.item.open = true;
  } else {
    const to = siblings(target);
    to.splice(to.indexOf(target.item), 0, loc.item);
  }
}

// ── Export / import ─────────────────────────────────────────

const exportedModel = (m) => ({ id: m.id, name: m.name, fields: m.fields, ...(m.sample !== undefined && { sample: m.sample }) });

/** Modèles de la bibliothèque utilisés par les flux de `items` (pour les joindre à un export). */
function modelsUsedBy(items) {
  const ids = new Set();
  for (const m of leavesIn(items, 'mapping')) for (const n of m.graph.nodes) if (n.data?.modelId) ids.add(n.data.modelId);
  return [...ids].map(find).filter((m) => m?.type === 'model').map(exportedModel);
}

const exported = (item) => {
  if (item.type === 'mapping') return { type: 'mapping', name: item.name, nodes: item.graph.nodes, edges: item.graph.edges };
  if (item.type === 'model') return { type: 'model', ...exportedModel(item) };
  return { type: 'folder', name: item.name, items: item.items.map(exported) };
};

/**
 * Fichier JSON d'un conteneur : une collection (un dossier de flux s'exporte comme une collection), avec les
 * modèles qu'utilisent ses flux ; ou, dans la bibliothèque, un dossier de modèles.
 */
export function collectionFile(id) {
  const loc = locate(id);
  const item = loc.item;
  if (inLibrary(loc)) return JSON.stringify({ format: MODELS_FORMAT, version: 1, name: item.name, items: item.items.map(exported) }, null, 2);
  const models = modelsUsedBy(item.items);
  return JSON.stringify({ format: COLLECTION_FORMAT, version: 1, name: item.name, items: item.items.map(exported), ...(models.length && { models }) }, null, 2);
}

/** Fichier JSON d'un seul flux (format historique), avec les modèles qu'il utilise ; ou d'un seul modèle. */
export function mappingFile(id) {
  const item = find(id);
  if (item.type === 'model') return JSON.stringify({ format: MODELS_FORMAT, version: 1, name: item.name, items: [exported(item)] }, null, 2);
  const models = modelsUsedBy([item]);
  return JSON.stringify({ version: 1, name: item.name, ...item.graph, ...(models.length && { models }) }, null, 2);
}

const isGraph = (g) => Array.isArray(g?.nodes) && Array.isArray(g?.edges);
const isModel = (m) => typeof m?.id === 'string' && Array.isArray(m?.fields);
const readModel = (raw) => ({ id: raw.id, type: 'model', name: raw.name || untitled(), fields: raw.fields, ...(typeof raw.sample === 'string' && { sample: raw.sample }) });

function readItem(raw) {
  if (isGraph(raw)) return makeMapping(raw.name || untitled(), { nodes: raw.nodes, edges: raw.edges });
  if (raw?.type === 'model' && isModel(raw)) return readModel(raw);
  if (Array.isArray(raw?.items)) return { ...makeFolder(raw.name || t('Dossier', 'Folder'), raw.items.map(readItem).filter(Boolean)), open: false };
  return null; // élément inconnu : ignoré
}

/**
 * Lit un fichier importé : `{ collection }`, `{ mapping }` ou `{ library }` (dossier de modèles), et `models` : les
 * modèles joints, à ajouter à la bibliothèque s'ils n'y sont pas déjà (même id).
 */
export function readFile(text, fileName = '') {
  const data = JSON.parse(text);
  const base = fileName.replace(/\.json$/i, '');
  const models = (Array.isArray(data?.models) ? data.models : []).filter(isModel).map(readModel);
  if (isGraph(data)) return { mapping: makeMapping(data.name || base || untitled(), { nodes: data.nodes, edges: data.edges }), models };
  if (data?.format === MODELS_FORMAT) return { library: makeFolder(data.name || base || t('Modèles importés', 'Imported models'), (data.items ?? []).map(readItem).filter(Boolean)), models: [] };
  if (data?.format === COLLECTION_FORMAT || Array.isArray(data?.items)) {
    return { collection: makeCollection(data.name || base || t('Collection importée', 'Imported collection'), (data.items ?? []).map(readItem).filter(Boolean)), models };
  }
  throw new Error(t('ce fichier n’est ni un flux, ni une collection, ni des modèles', 'this file is neither a flow, nor a collection, nor models'));
}

/**
 * Range les modèles importés absents de la bibliothèque (par leur id) dans un dossier `folderName` ; ceux déjà
 * présents sont gardés tels quels. Renvoie le nombre de modèles ajoutés.
 */
export function addImportedModels(models, folderName) {
  const fresh = models.filter((m) => !find(m.id));
  if (fresh.length) addToLibrary({ ...makeFolder(folderName, fresh), open: false });
  return fresh.length;
}

/** Ajoute un dossier de modèles importé ; les modèles déjà présents (même id) en sont retirés. Renvoie le nombre ajouté. */
export function addImportedLibrary(folder) {
  const keep = (items) =>
    items.filter((i) => i.type !== 'model' || !find(i.id)).map((i) => (isContainer(i) ? { ...i, items: keep(i.items) } : i));
  const cleaned = { ...folder, items: keep(folder.items) };
  addToLibrary(cleaned);
  return [...leavesIn(cleaned.items, 'model')].length;
}
