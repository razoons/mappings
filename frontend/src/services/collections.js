import { reactive, watch } from 'vue';
import { t } from '../lib/i18n';
import { migrateGraphs } from '../lib/transforms';
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
 * Un modèle composite porte en plus son schéma (`composite: true`, `graph`), qui s'ouvre comme un flux : ses champs
 * sont ceux de la cible de ce schéma.
 */

const KEY = 'mapping-collections';
/** Ancien brouillon unique (avant les collections) : repris comme premier flux. */
const LEGACY_KEY = 'mapping-current';
/** Valeur de `format` d'un fichier de collection exporté. */
export const COLLECTION_FORMAT = 'schemap-collection';
/** Valeur de `format` d'un fichier de modèles exporté. */
export const MODELS_FORMAT = 'schemap-models';
/** Valeur de `format` d'une sauvegarde complète (toutes les collections et toute la bibliothèque). */
export const WORKSPACE_FORMAT = 'schemap-workspace';
export const LIBRARY_ID = 'library';

const untitled = () => t('Sans titre', 'Untitled');
const emptyGraph = () => ({ nodes: [], edges: [] });

export const makeMapping = (name = untitled(), graph = emptyGraph()) => ({ id: uid('map'), type: 'mapping', name, graph });
export const makeFolder = (name = t('Nouveau dossier', 'New folder'), items = []) => ({ id: uid('dir'), type: 'folder', name, items, open: true });
export const makeCollection = (name = t('Nouvelle collection', 'New collection'), items = []) => ({ id: uid('col'), type: 'collection', name, items, open: true });
const makeLibrary = (items = []) => ({ id: LIBRARY_ID, type: 'library', name: t('Modèles', 'Models'), items, open: true });

/** Élément qui en contient d'autres (collection, dossier, bibliothèque). */
export const isContainer = (item) => Array.isArray(item.items);

function initial() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved?.collections)) {
      migrateGraphs(saved);
      return { library: makeLibrary(), ...saved };
    }
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
  return { collections: [makeCollection(t('Mes mappings', 'My mappings'), [first])], library: makeLibrary(), activeId: first.id };
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

export function* leavesIn(list, type) {
  for (const item of list) {
    if (item.type === type) yield item;
    else if (isContainer(item)) yield* leavesIn(item.items, type);
  }
}
export const firstMapping = (list = workspace.collections) => leavesIn(list, 'mapping').next().value ?? null;
/** Nombre de flux (ou de modèles, dans la bibliothèque) d'un conteneur. */
export const leafCount = (item) => ['mapping', 'model', 'valuelist'].reduce((n, type) => n + [...leavesIn(item.items, type)].length, 0);

/** Flux de `list` : `{ mapping, path }` (`path` : noms de la collection et des dossiers). */
function* mappingsIn(list, path = []) {
  for (const item of list) {
    if (item.type === 'mapping') yield { mapping: item, path };
    else if (isContainer(item)) yield* mappingsIn(item.items, [...path, item.name]);
  }
}

/** Le modèle est composite : il a son propre schéma (voir services/models.js). */
export const isComposite = (item) => item?.type === 'model' && !!item.composite;

/**
 * Tous les schémas : les flux des collections, puis ceux des modèles composites de la bibliothèque (`path` : la
 * bibliothèque et ses dossiers). Ils utilisent les modèles et les listes de la même façon.
 */
export function* allMappings() {
  yield* mappingsIn(workspace.collections);
  function* composites(list, path) {
    for (const item of list) {
      if (isComposite(item)) yield { mapping: item, path };
      else if (isContainer(item)) yield* composites(item.items, [...path, item.name]);
    }
  }
  yield* composites(workspace.library.items, [workspace.library.name]);
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
  const root = loc?.path[0];
  return root && root !== workspace.library ? root : activeContainer();
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

const sameName = (a, b) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** Collection existante qui porte ce nom (sans tenir compte de la casse ni des espaces autour), ou `null`. */
export const collectionNamed = (name) => workspace.collections.find((c) => sameName(c.name, name)) ?? null;

/**
 * Remplace la collection `oldId` par `collection`, à la même place. Si le mapping ouvert en faisait partie, le
 * premier mapping de la nouvelle est ouvert (ou un nouveau mapping s'il n'y en a aucun).
 */
export function replaceCollection(oldId, collection) {
  const index = workspace.collections.findIndex((c) => c.id === oldId);
  if (index < 0) return addCollection(collection);
  workspace.collections.splice(index, 1, collection);
  if (!find(workspace.activeId)) ensureActive();
  return collection;
}

export function rename(id, name) {
  const item = find(id);
  if (item && name.trim()) item.name = name.trim();
}

/**
 * Supprime toutes les collections (mappings et dossiers) ; la bibliothèque reste. Un nouveau mapping vide est ouvert,
 * sauf si c'est un modèle composite qui est affiché.
 */
export function clearCollections() {
  workspace.collections.splice(0);
  if (!find(workspace.activeId)) ensureActive();
}

/** Garantit un flux ouvert : le premier qui reste, ou un nouveau. */
export function ensureActive() {
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

const PREFIXES = { mapping: 'map', model: 'mdl', valuelist: 'lst', folder: 'dir', collection: 'col' };

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

/** Élément de la bibliothèque, tel qu'exporté : modèle `{ id, name, fields, sample? }` ou liste de valeurs. */
const exportedLibraryItem = (m) =>
  m.type === 'valuelist'
    ? { type: 'valuelist', id: m.id, name: m.name, item: m.item, values: m.values, mapped: !!m.mapped, outItem: m.outItem, targets: m.targets }
    : {
        type: 'model',
        id: m.id,
        name: m.name,
        fields: m.fields,
        ...(m.sample !== undefined && { sample: m.sample }),
        ...(m.composite && { composite: true, graph: m.graph }),
      };

/**
 * Éléments de la bibliothèque utilisés par les flux de `items` (pour les joindre à un export) : modèles reliés aux
 * sources et cibles, listes de valeurs reliées aux nœuds Liste de valeurs ou désignées par un champ d'un modèle.
 */
function libraryItemsUsedBy(items) {
  const ids = new Set();
  const walkFields = (fields) => fields.forEach((f) => (f.format?.library && ids.add(f.format.library), walkFields(f.children ?? [])));
  for (const m of leavesIn(items, 'mapping')) {
    for (const n of m.graph.nodes) {
      if (n.data?.modelId) ids.add(n.data.modelId);
      if (n.data?.listId) ids.add(n.data.listId);
      walkFields(n.data?.fields ?? []); // listes désignées par un champ, même sans nœud dans le flux
    }
  }
  // Un modèle composite emporte aussi les éléments qu'utilise son schéma (et ainsi de suite).
  const pending = [...ids];
  while (pending.length) {
    const model = find(pending.pop());
    if (model?.type !== 'model') continue;
    walkFields(model.fields);
    for (const n of model.graph?.nodes ?? []) {
      for (const id of [n.data?.modelId, n.data?.listId]) if (id && !ids.has(id)) (ids.add(id), pending.push(id));
      walkFields(n.data?.fields ?? []);
    }
  }
  return [...ids].map(find).filter((m) => m?.type === 'model' || m?.type === 'valuelist').map(exportedLibraryItem);
}

const exported = (item) => {
  if (item.type === 'mapping') return { type: 'mapping', name: item.name, nodes: item.graph.nodes, edges: item.graph.edges };
  if (item.type === 'model' || item.type === 'valuelist') return exportedLibraryItem(item);
  return { type: 'folder', name: item.name, items: item.items.map(exported) };
};

/**
 * Fichier JSON d'un conteneur : une collection (un dossier de flux s'exporte comme une collection), avec les
 * éléments de la bibliothèque qu'utilisent ses flux (`models`) ; ou, dans la bibliothèque, un dossier.
 */
export function collectionFile(id) {
  const loc = locate(id);
  const item = loc.item;
  if (inLibrary(loc)) return JSON.stringify({ format: MODELS_FORMAT, version: 1, name: item.name, items: item.items.map(exported) }, null, 2);
  const models = libraryItemsUsedBy(item.items);
  return JSON.stringify({ format: COLLECTION_FORMAT, version: 1, name: item.name, items: item.items.map(exported), ...(models.length && { models }) }, null, 2);
}

/** Fichier JSON d'un seul flux (format historique), avec les éléments de la bibliothèque qu'il utilise ; ou d'un seul modèle ou d'une seule liste. */
export function mappingFile(id) {
  const item = find(id);
  if (item.type === 'model' || item.type === 'valuelist') return JSON.stringify({ format: MODELS_FORMAT, version: 1, name: item.name, items: [exported(item)] }, null, 2);
  const models = libraryItemsUsedBy([item]);
  return JSON.stringify({ version: 1, name: item.name, ...item.graph, ...(models.length && { models }) }, null, 2);
}

/** Sauvegarde complète : toutes les collections, toute la bibliothèque et le mapping ouvert. */
export function workspaceFile() {
  const { collections, library, activeId } = JSON.parse(JSON.stringify(workspace));
  return JSON.stringify({ format: WORKSPACE_FORMAT, version: 1, savedAt: new Date().toISOString(), collections, library, activeId }, null, 2);
}

/**
 * Restaure une sauvegarde complète (`readFile` → `{ workspace }`). `replace` : tout ce qui est dans le navigateur
 * est remplacé ; sinon ses collections s'ajoutent à la liste et sa bibliothèque dans un dossier `folderName`
 * (sans les éléments déjà présents, même id). Renvoie `{ collections, library }` : le nombre de collections et
 * d'éléments de la bibliothèque ajoutés.
 */
export function restoreWorkspace(saved, { replace = false, folderName = '' } = {}) {
  if (replace) {
    workspace.collections.splice(0, workspace.collections.length, ...saved.collections);
    workspace.library = { ...makeLibrary(), ...saved.library, id: LIBRARY_ID, type: 'library' };
    const active = find(saved.activeId);
    workspace.activeId = active?.type === 'mapping' || isComposite(active) ? saved.activeId : null;
    if (!workspace.activeId) ensureActive();
    return { collections: saved.collections.length, library: [...leavesIn(workspace.library.items, 'model')].length + [...leavesIn(workspace.library.items, 'valuelist')].length };
  }
  // Ajout : de nouveaux ids pour les collections, dossiers et mappings (les éléments de la bibliothèque gardent
  // les leurs, auxquels se réfèrent les nœuds).
  const fresh = (item) =>
    item.type === 'mapping' ? { ...item, id: uid('map') } : isContainer(item) ? { ...item, id: uid(item.type === 'collection' ? 'col' : 'dir'), items: item.items.map(fresh) } : item;
  for (const c of saved.collections) workspace.collections.push(fresh(c));
  const library = !saved.library.items.length ? 0 : addImportedLibrary(makeFolder(folderName, saved.library.items.map((i) => (isContainer(i) ? { ...i, id: uid('dir') } : i))), { inFolder: true });
  return { collections: saved.collections.length, library };
}

const isGraph = (g) => Array.isArray(g?.nodes) && Array.isArray(g?.edges);
const isLibraryItem = (m) => typeof m?.id === 'string' && (Array.isArray(m?.fields) || (m?.type === 'valuelist' && Array.isArray(m?.values)));

function readLibraryItem(raw) {
  if (raw.type === 'valuelist') {
    return {
      id: raw.id,
      type: 'valuelist',
      name: raw.name || untitled(),
      item: raw.item ?? 'string',
      values: raw.values,
      mapped: !!raw.mapped,
      outItem: raw.outItem ?? 'string',
      targets: Array.isArray(raw.targets) ? raw.targets : [],
    };
  }
  return {
    id: raw.id,
    type: 'model',
    name: raw.name || untitled(),
    fields: raw.fields,
    ...(typeof raw.sample === 'string' && { sample: raw.sample }),
    ...(raw.composite && isGraph(raw.graph) && { composite: true, graph: { nodes: raw.graph.nodes, edges: raw.graph.edges } }),
  };
}

function readItem(raw) {
  if (isGraph(raw)) return makeMapping(raw.name || untitled(), { nodes: raw.nodes, edges: raw.edges });
  if ((raw?.type === 'model' || raw?.type === 'valuelist') && isLibraryItem(raw)) return readLibraryItem(raw);
  if (Array.isArray(raw?.items)) return { ...makeFolder(raw.name || t('Dossier', 'Folder'), raw.items.map(readItem).filter(Boolean)), open: false };
  return null; // élément inconnu : ignoré
}

/**
 * Lit un fichier importé : `{ collection }`, `{ mapping }` ou `{ library }` (dossier de la bibliothèque), et
 * `models` : les éléments de la bibliothèque joints, à y ajouter s'ils n'y sont pas déjà (même id).
 */
export function readFile(text, fileName = '') {
  const data = JSON.parse(text);
  migrateGraphs(data);
  const base = fileName.replace(/\.json$/i, '');
  if (data?.format === WORKSPACE_FORMAT) {
    if (!Array.isArray(data.collections) || !Array.isArray(data.library?.items)) throw new Error(t('sauvegarde incomplète', 'incomplete backup'));
    return { workspace: { collections: data.collections, library: data.library, activeId: data.activeId ?? null, savedAt: data.savedAt ?? null } };
  }
  const models = (Array.isArray(data?.models) ? data.models : []).filter(isLibraryItem).map(readLibraryItem);
  if (isGraph(data)) return { mapping: makeMapping(data.name || base || untitled(), { nodes: data.nodes, edges: data.edges }), models };
  if (data?.format === MODELS_FORMAT) return { library: makeFolder(data.name || base || t('Bibliothèque importée', 'Imported library'), (data.items ?? []).map(readItem).filter(Boolean)), models: [] };
  if (data?.format === COLLECTION_FORMAT || Array.isArray(data?.items)) {
    return { collection: makeCollection(data.name || base || t('Collection importée', 'Imported collection'), (data.items ?? []).map(readItem).filter(Boolean)), models };
  }
  throw new Error(t('ce fichier n’est ni un mapping, ni une collection, ni un export de la bibliothèque', 'this file is neither a mapping, nor a collection, nor a library export'));
}

/**
 * Range les éléments importés absents de la bibliothèque (par leur id) à sa racine ; ceux déjà présents sont
 * gardés tels quels. Renvoie le nombre d'éléments ajoutés.
 */
export function addImportedModels(models) {
  const fresh = models.filter((m) => !find(m.id));
  fresh.forEach((m) => addToLibrary(m));
  return fresh.length;
}

/**
 * Ajoute les éléments d'un export de la bibliothèque à sa racine (ses propres dossiers sont gardés) ; avec
 * `inFolder`, dans le dossier `folder` lui-même. Les éléments déjà présents (même id) sont écartés. Renvoie le
 * nombre ajouté.
 */
export function addImportedLibrary(folder, { inFolder = false } = {}) {
  const keep = (items) =>
    items.filter((i) => isContainer(i) || !find(i.id)).map((i) => (isContainer(i) ? { ...i, items: keep(i.items) } : i));
  const cleaned = { ...folder, items: keep(folder.items) };
  if (inFolder) addToLibrary(cleaned);
  else cleaned.items.forEach((i) => addToLibrary(i));
  return [...leavesIn(cleaned.items, 'model')].length + [...leavesIn(cleaned.items, 'valuelist')].length;
}
