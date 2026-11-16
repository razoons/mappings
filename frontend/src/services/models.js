import { allFields, findChain, pathLabel, reshapeSample, typeKey, TYPE_OPTIONS } from '../lib/fields';
import { t } from '../lib/i18n';
import { isPlainObject } from '../lib/lists';
import { uid } from '../lib/types';
import { addToLibrary, allMappings, find, locate, remove, workspace } from './collections';

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
function canonical(value) {
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

/** Nombre de flux qui utilisent chaque modèle. */
export function usageCounts() {
  const counts = new Map();
  for (const { mapping } of allMappings()) {
    for (const id of new Set(mapping.graph.nodes.map((n) => n.data?.modelId).filter(Boolean))) counts.set(id, (counts.get(id) ?? 0) + 1);
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

/** Aligne un nœud d'un flux enregistré sur les champs `fields` ; les liens des champs disparus sont retirés. */
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
  const kept = new Set(allFields(next).map((f) => f.id));
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

/** Supprime un dossier de la bibliothèque et tous ses modèles (déliés des flux comme ci-dessus). */
export function deleteLibraryFolder(folderId) {
  hooks.flush();
  const folder = find(folderId);
  const ids = new Set();
  const walk = (items) => items.forEach((i) => (i.type === 'model' ? ids.add(i.id) : i.items && walk(i.items)));
  walk(folder?.items ?? []);
  for (const id of ids) for (const { nodes } of usageOf(id)) for (const node of nodes) delete node.data.modelId;
  remove(folderId);
  hooks.reload();
}

/** Document d'exemple d'un modèle, pour une nouvelle source (celui du modèle, sinon des valeurs types). */
export const sampleForSource = (model) => model.sample ?? JSON.stringify(reshapeSample([], {}, model.fields), null, 2);

export { workspace };
