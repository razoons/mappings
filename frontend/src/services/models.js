import { allFields, findChain, pathLabel, reshapeSample, typeKey, TYPE_OPTIONS } from '../lib/fields';
import { evaluateGraph } from '../lib/graph';
import { t } from '../lib/i18n';
import { isPlainObject } from '../lib/lists';
import { SOURCE_DOC, syncMirrors, unmirror, withMirror } from '../lib/structure';
import { uid } from '../lib/types';
import { addToLibrary, allMappings, ensureActive, find, isComposite, locate, remove, rename, workspace } from './collections';

/**
 * Modèles de données partagés : un nœud source ou cible relié à un modèle de la bibliothèque porte `data.modelId`
 * et garde une copie de ses champs (`data.fields`, avec ses propres états replié / déplié). Les liens d'un flux
 * visent les ids des champs, communs au modèle et à toutes ses copies : un champ modifié dans le modèle garde
 * ses liens partout ; un champ supprimé les perd.
 *
 * Un nœud dont les champs diffèrent de son modèle (modification faite dans le flux) est « modifié » : ses
 * changements restent locaux tant qu'ils ne sont pas enregistrés dans le modèle ou sous un nouveau modèle. Les
 * exemples (`data.sample` d'une source) restent propres à chaque flux : seule la structure et les règles sont
 * partagées.
 */

/** Type des données d'un glisser-déposer de modèle (du panneau vers le schéma) : l'id du modèle. */
export const MODEL_DRAG_TYPE = 'application/x-schemap-model';

/** Branchements fournis par l'éditeur : ranger le flux affiché dans la collection, puis le recharger. */
export const hooks = { flush: () => {}, reload: () => {} };

/** Champs sans les états d'affichage (replié / déplié), propres à chaque nœud. */
export const stripFields = (fields) =>
  fields.map(({ collapsed: _, children, ...f }) => (children ? { ...f, children: stripFields(children) } : f));

/** Texte canonique (clés triées) : deux structures identiques donnent le même texte, quel que soit l'ordre des clés. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isPlainObject(value)) return `{${Object.keys(value).filter((k) => value[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

export const sameFields = (a, b) => canonical(stripFields(a ?? [])) === canonical(stripFields(b ?? []));

export const makeModel = (name, fields, sample) => ({
  id: uid('mdl'),
  type: 'model',
  name,
  fields: stripFields(JSON.parse(JSON.stringify(fields))),
  ...(sample !== undefined && { sample }),
});

// ── Modèles composites ─────────────────────────────────────
// Un modèle composite a son propre schéma (`graph`), qui s'ouvre comme un flux : des sources (souvent des modèles
// de la bibliothèque), des transformations (ex. « Rechercher par clé » pour une jointure) et une cible, sa sortie.
// Ses champs sont ceux de cette cible, et son exemple le document qu'elle produit avec les exemples des sources :
// ajouté à un flux comme source, il donne directement les données jointes.

/** Cible d'un schéma qui fait la sortie du modèle composite : la première. */
export const compositeOutput = (graph) => graph?.nodes.find((n) => n.type === 'target') ?? null;

/** Crée un modèle composite (schéma `graph`, sinon une cible vide à son nom) dans la bibliothèque, et calcule ses champs. */
export function createComposite(name, graph = null, folderId = null) {
  const start = graph ?? { nodes: [{ id: uid('target'), type: 'target', position: { x: 700, y: 120 }, data: { label: name, fields: [] } }], edges: [] };
  const item = { ...makeModel(name, []), composite: true, graph: JSON.parse(JSON.stringify(start)) };
  for (const n of item.graph.nodes) n.selected = undefined;
  computeComposite(item);
  return addToLibrary(item, folderId);
}

/** Champs et exemple que donne le schéma `graph` d'un modèle composite : `{ fields, sample }`. */
export function compositeContent(graph) {
  const nodes = withMirrors(graph);
  const out = compositeOutput({ nodes });
  const value = out ? (evaluateGraph(nodes, graph.edges).targets.get(out.id)?.value ?? {}) : {};
  return { fields: unmirror(stripFields(out?.data.fields ?? [])), sample: JSON.stringify(value, null, 2) };
}

/** Nœuds du schéma, les champs cibles reliés à un objet entier alignés sur sa structure (voir lib/structure.js). */
function withMirrors(graph) {
  const changes = syncMirrors(graph.nodes, graph.edges);
  return graph.nodes.map((n) => (changes.has(n.id) ? { ...n, data: withMirror(n.data, changes.get(n.id)) } : n));
}

/** Champs et exemple d'un modèle composite, d'après son schéma (aligné au passage sur les objets entiers qu'il reprend). */
function computeComposite(item) {
  item.graph.nodes = withMirrors(item.graph);
  const kept = new Set(item.graph.nodes.flatMap((n) => (n.type === 'target' ? allFields(n.data.fields).map((f) => `${n.id}:${f.id}`) : [])));
  const targets = new Set(item.graph.nodes.filter((n) => n.type === 'target').map((n) => n.id));
  item.graph.edges = item.graph.edges.filter((e) => !targets.has(e.target) || e.targetHandle === SOURCE_DOC || kept.has(`${e.target}:${e.targetHandle}`));
  Object.assign(item, compositeContent(item.graph));
}

const sameJson = (a, b) => {
  try {
    return canonical(JSON.parse(a || '{}')) === canonical(JSON.parse(b || '{}'));
  } catch {
    return a === b;
  }
};

/**
 * Recalcule un modèle composite après une modification de son schéma, et l'applique aux flux qui l'utilisent :
 * leurs nœuds non modifiés localement suivent ses champs, et une source dont l'exemple n'a pas été changé
 * reçoit le nouveau document. Les modèles composites qui l'utilisent sont recalculés à leur tour.
 */
export function refreshComposite(item, seen = new Set()) {
  if (!isComposite(item) || seen.has(item.id)) return;
  seen.add(item.id);
  const before = { fields: item.fields, sample: item.sample };
  computeComposite(item);
  if (sameFields(before.fields, item.fields) && sameJson(before.sample, item.sample)) return;
  for (const { mapping, nodes } of usageOf(item.id)) {
    for (const node of nodes) {
      const untouched = node.type === 'source' && (node.data.sample === undefined || sameJson(node.data.sample, before.sample));
      if (sameFields(node.data.fields, before.fields)) syncNode(mapping.graph, node, item.fields);
      if (untouched) node.data.sample = item.sample;
    }
    if (isComposite(mapping)) refreshComposite(mapping, seen);
  }
}

/** Le modèle `id` est le composite `compositeId`, ou un modèle composite dont le schéma l'utilise (même indirectement). */
export function usesComposite(id, compositeId, seen = new Set()) {
  if (id === compositeId) return true;
  const item = find(id);
  if (!isComposite(item) || seen.has(id)) return false;
  seen.add(id);
  return item.graph.nodes.some((n) => n.data?.modelId && usesComposite(n.data.modelId, compositeId, seen));
}

/** Modèle de la bibliothèque relié à un nœud (`null` s'il n'en a pas ou si le modèle a été supprimé). */
export const modelOf = (data) => {
  const m = data?.modelId ? find(data.modelId) : null;
  return m?.type === 'model' ? m : null;
};

/** Flux qui utilisent le modèle : `[{ mapping, path, nodes }]` (`nodes` : ses nœuds reliés au modèle). */
export function usageOf(modelId) {
  const list = [];
  for (const { mapping, path } of allMappings()) {
    const nodes = mapping.graph.nodes.filter((n) => n.data?.modelId === modelId);
    if (nodes.length) list.push({ mapping, path, nodes });
  }
  return list;
}

/** Nombre de flux qui utilisent chaque modèle et chaque liste de valeurs de la bibliothèque. */
export function usageCounts() {
  const counts = new Map();
  for (const { mapping } of allMappings()) {
    const ids = mapping.graph.nodes.flatMap((n) => [n.data?.modelId, n.data?.listId]).filter(Boolean);
    for (const id of new Set(ids)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

const typeLabel = (f) => TYPE_OPTIONS.find(([k]) => k === typeKey(f))?.[1] ?? typeKey(f);

/**
 * Champs supprimés ou modifiés entre deux versions d'un modèle : Map id → `{ path, kind, details }`
 * (`kind` : `removed` ou `modified` ; `details` : ce qui a changé, en clair).
 */
export function fieldChanges(before, after) {
  const changes = new Map();
  for (const old of allFields(before)) {
    const oldPath = pathLabel(findChain(before, old.id));
    const chain = findChain(after, old.id);
    if (!chain) {
      changes.set(old.id, { path: oldPath, kind: 'removed', details: [t('supprimé', 'deleted')] });
      continue;
    }
    const now = chain.at(-1);
    const details = [];
    const newPath = pathLabel(chain);
    if (old.name !== now.name) details.push(t(`renommé en « ${now.name} »`, `renamed to “${now.name}”`));
    else if (oldPath !== newPath) details.push(t(`déplacé vers « ${newPath} »`, `moved to “${newPath}”`));
    if (typeKey(old) !== typeKey(now)) details.push(t(`type ${typeLabel(old)} → ${typeLabel(now)}`, `type ${typeLabel(old)} → ${typeLabel(now)}`));
    if (!!old.required !== !!now.required) details.push(now.required ? t('devenu obligatoire', 'now required') : t('devenu facultatif', 'now optional'));
    if (!!old.generated !== !!now.generated) details.push(now.generated ? t('devenu auto-généré', 'now self-generated') : t('n’est plus auto-généré', 'no longer self-generated'));
    if (canonical(old.format ?? null) !== canonical(now.format ?? null)) details.push(t('format modifié', 'format changed'));
    if (details.length) changes.set(old.id, { path: oldPath, kind: 'modified', details });
  }
  return changes;
}

/**
 * Conséquences d'une nouvelle version des champs d'un modèle sur les flux qui l'utilisent, sauf le nœud `except`
 * (`{ mappingId, nodeId }`, celui d'où vient la modification) :
 * `{ changes, flows: [{ mappingId, flow, node, fields: [{ path, kind, details }], diverged }] }`, où `fields` liste
 * les champs supprimés ou modifiés que ce flux utilise (reliés par un lien), et `diverged` signale un nœud déjà
 * modifié localement (il ne sera pas mis à jour).
 */
export function impactOf(modelId, nextFields, except = null) {
  hooks.flush();
  const model = find(modelId);
  const changes = fieldChanges(model.fields, nextFields);
  const flows = [];
  for (const { mapping, path, nodes } of usageOf(modelId)) {
    for (const node of nodes) {
      if (except && mapping.id === except.mappingId && node.id === except.nodeId) continue;
      const used = new Set(
        mapping.graph.edges.flatMap((e) => [e.source === node.id && e.sourceHandle, e.target === node.id && e.targetHandle]).filter(Boolean),
      );
      flows.push({
        mappingId: mapping.id,
        flow: [...path, mapping.name].join(' › '),
        node: node.data.label,
        fields: [...changes].filter(([id]) => used.has(id)).map(([, c]) => c),
        diverged: !sameFields(node.data.fields, model.fields),
      });
    }
  }
  return { changes, flows };
}

/** Copie des champs du modèle pour un nœud : les états replié / déplié du nœud sont gardés. */
function fieldsForNode(modelFields, nodeFields) {
  const collapsed = new Map(allFields(nodeFields ?? []).map((f) => [f.id, f.collapsed]));
  const apply = (fields) =>
    fields.map((f) => {
      const copy = { ...f, ...(collapsed.get(f.id) && { collapsed: true }) };
      if (f.children) copy.children = apply(f.children);
      return copy;
    });
  return apply(JSON.parse(JSON.stringify(modelFields)));
}

/** Aligne un nœud d'un flux enregistré sur les champs `fields` ; les liens des champs disparus sont retirés (pas ceux du document entier). */
function syncNode(graph, node, fields) {
  const next = fieldsForNode(fields, node.data.fields);
  if (node.type === 'source' && node.data.sample !== undefined) {
    let doc = {};
    try {
      doc = JSON.parse(node.data.sample || '{}');
    } catch {
      /* exemple illisible : repart des valeurs types */
    }
    node.data.sample = JSON.stringify(reshapeSample(node.data.fields, isPlainObject(doc) ? doc : {}, next), null, 2);
  }
  // Le socket « toute la source / toute la cible » n'est pas un champ : ses liens restent.
  const kept = new Set([SOURCE_DOC, ...allFields(next).map((f) => f.id)]);
  graph.edges = graph.edges.filter((e) => !((e.source === node.id && !kept.has(e.sourceHandle)) || (e.target === node.id && !kept.has(e.targetHandle))));
  node.data.fields = next;
}

/**
 * Enregistre une nouvelle version des champs du modèle et l'applique à tous les flux qui l'utilisent, sauf aux
 * nœuds déjà modifiés localement (ils gardent leurs changements, toujours signalés). Le nœud `from`
 * (`{ mappingId, nodeId }`), d'où vient la modification, reste relié.
 */
export function applyModel(modelId, fields, { sample, from } = {}) {
  hooks.flush();
  const model = find(modelId);
  const before = model.fields;
  model.fields = stripFields(JSON.parse(JSON.stringify(fields)));
  if (sample !== undefined) model.sample = sample;
  for (const { mapping, nodes } of usageOf(modelId)) {
    for (const node of nodes) {
      const origin = from && mapping.id === from.mappingId && node.id === from.nodeId;
      if (origin || sameFields(node.data.fields, before)) syncNode(mapping.graph, node, model.fields);
    }
    if (isComposite(mapping)) refreshComposite(mapping);
  }
  hooks.reload();
}

/** Remet un nœud aux champs de son modèle (abandon des modifications locales). */
export function revertNode(mappingId, nodeId) {
  hooks.flush();
  const mapping = find(mappingId);
  const node = mapping?.graph.nodes.find((n) => n.id === nodeId);
  const model = modelOf(node?.data);
  if (!model) return;
  syncNode(mapping.graph, node, model.fields);
  if (isComposite(mapping)) refreshComposite(mapping);
  hooks.reload();
}

/** Relie (ou délie, `modelId` nul) un nœud d'un flux à un modèle, sans toucher à ses champs. */
export function linkNode(mappingId, nodeId, modelId) {
  hooks.flush();
  const node = find(mappingId)?.graph.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  if (modelId) node.data.modelId = modelId;
  else delete node.data.modelId;
  hooks.reload();
}

/** Crée un modèle dans la bibliothèque (dans le dossier `folderId`, à la racine sinon). */
export function createModel(name, fields, sample, folderId = null) {
  return addToLibrary(makeModel(name, fields, sample), folderId);
}

/** Dossier de la bibliothèque qui contient le modèle (pour y ranger une variante). */
export const folderOf = (modelId) => locate(modelId)?.parent?.id ?? null;

/** Supprime un modèle : les nœuds qui l'utilisaient gardent leurs champs, mais n'y sont plus reliés. */
export function deleteModel(modelId) {
  hooks.flush();
  for (const { nodes } of usageOf(modelId)) for (const node of nodes) delete node.data.modelId;
  remove(modelId);
  hooks.reload();
}

/** Supprime un dossier de la bibliothèque et tout son contenu (modèles et listes déliés des flux, qui gardent leurs copies). */
export function deleteLibraryFolder(folderId) {
  hooks.flush();
  const folder = find(folderId);
  const ids = new Set();
  const walk = (items) => items.forEach((i) => (i.items ? walk(i.items) : ids.add(i.id)));
  walk(folder?.items ?? []);
  for (const { mapping } of allMappings()) {
    for (const node of mapping.graph.nodes) {
      if (ids.has(node.data?.modelId)) delete node.data.modelId;
      if (ids.has(node.data?.listId)) delete node.data.listId;
    }
  }
  remove(folderId);
  hooks.reload();
}

/**
 * Vide la bibliothèque (modèles, modèles composites, listes de valeurs, dossiers) : les nœuds des flux qui y
 * étaient reliés gardent leurs copies. Un modèle composite ouvert est quitté pour un mapping.
 */
export function clearLibrary() {
  hooks.flush();
  for (const { mapping } of allMappings()) {
    for (const node of mapping.graph.nodes) {
      delete node.data?.modelId;
      delete node.data?.listId;
    }
  }
  workspace.library.items.splice(0);
  if (!find(workspace.activeId)) ensureActive();
  hooks.reload();
}

/** Document d'exemple d'un modèle, pour une nouvelle source (celui du modèle, sinon des valeurs types). */
export const sampleForSource = (model) => model.sample ?? JSON.stringify(reshapeSample([], {}, model.fields), null, 2);

export { workspace };

/**
 * Renomme un élément. Pour un modèle ou une liste de valeurs de la bibliothèque, les nœuds qui y sont reliés,
 * dans tous les flux, prennent le nouveau nom comme titre.
 */
export function renameItem(id, name) {
  const item = find(id);
  const next = name.trim();
  if (!item || !next) return;
  if (item.type !== 'model' && item.type !== 'valuelist') return rename(id, next);
  hooks.flush();
  rename(id, next);
  const key = item.type === 'model' ? 'modelId' : 'listId';
  for (const { mapping } of allMappings()) for (const node of mapping.graph.nodes) if (node.data?.[key] === id) node.data.label = next;
  hooks.reload();
}
