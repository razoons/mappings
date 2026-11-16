import { allFields, pathLabel, findChain } from '../lib/fields';
import { t } from '../lib/i18n';
import { LIBRARY_TABLE, tableKey } from '../lib/libraries';
import { uid } from '../lib/types';
import { addToLibrary, allMappings, find, remove } from './collections';
import { canonical, hooks } from './models';

/**
 * Listes de valeurs partagées (énumérations, éventuellement avec correspondances pour le transcodage) : un nœud
 * Liste de valeurs relié à une liste de la bibliothèque porte `data.listId` et garde une copie de son contenu.
 * Comme pour les modèles, une modification faite dans un flux reste locale (« modifiée ici ») tant qu'elle n'est
 * pas enregistrée dans la liste ou sous une nouvelle liste. Un champ d'un modèle peut désigner une liste partagée
 * par son id (`format.library`) : il est contrôlé dans tout flux qui contient un nœud relié à cette liste.
 *
 * Liste : `{ id, type: 'valuelist', name, item, values, mapped, outItem, targets }` (voir lib/libraries.js).
 */

/** Contenu partagé d'une liste (ou des données d'un nœud Liste de valeurs). */
export const listContent = (d) => ({
  item: d.item ?? 'string',
  values: [...(d.values ?? [])],
  mapped: !!d.mapped,
  outItem: d.outItem ?? 'string',
  targets: [...(d.targets ?? [])],
});

/** Même contenu ; sans table de correspondance, les correspondances (gardées mais inutilisées) ne comptent pas. */
export function sameList(a, b) {
  const ca = listContent(a);
  const cb = listContent(b);
  if (!ca.mapped) ca.targets = [];
  if (!cb.mapped) cb.targets = [];
  if (!ca.mapped && !cb.mapped) ca.outItem = cb.outItem = 'string';
  return canonical(ca) === canonical(cb);
}

export const makeList = (name, data) => ({ id: uid('lst'), type: 'valuelist', name, ...listContent(data) });

/** Liste de la bibliothèque reliée à un nœud (`null` s'il n'en a pas ou si elle a été supprimée). */
export const listOf = (data) => {
  const l = data?.listId ? find(data.listId) : null;
  return l?.type === 'valuelist' ? l : null;
};

/** Flux qui utilisent la liste : `[{ mapping, path, nodes }]` (`nodes` : ses nœuds reliés à la liste). */
export function listUsage(listId) {
  const out = [];
  for (const { mapping, path } of allMappings()) {
    const nodes = mapping.graph.nodes.filter((n) => n.type === 'library' && n.data?.listId === listId);
    if (nodes.length) out.push({ mapping, path, nodes });
  }
  return out;
}

const typeName = (k) => ({ string: t('Texte', 'Text'), integer: t('Entier', 'Integer'), number: t('Nombre', 'Number'), date: t('Date', 'Date') })[k] ?? k;

/** Changements entre deux versions d'une liste : Map clé → `{ path, kind, details }` (même forme que pour les modèles). */
export function listChanges(before, after) {
  const a = listContent(before);
  const b = listContent(after);
  const changes = new Map();
  if (a.item !== b.item) changes.set('type', { path: t('type des valeurs', 'value type'), kind: 'modified', details: [`${typeName(a.item)} → ${typeName(b.item)}`] });
  const keys = new Set(b.values.map(tableKey));
  for (const v of a.values) {
    if (!keys.has(tableKey(v))) changes.set(`v:${tableKey(v)}`, { path: t(`valeur « ${v} »`, `value “${v}”`), kind: 'removed', details: [t('retirée', 'removed')] });
  }
  if (a.mapped && !b.mapped) changes.set('table', { path: t('table de correspondance', 'mapping table'), kind: 'removed', details: [t('retirée (ses liens seront retirés)', 'removed (its links will be removed)')] });
  else if (a.mapped && b.mapped) {
    const before = new Map(a.values.map((v, i) => [tableKey(v), a.targets[i] ?? null]));
    for (const [i, v] of b.values.entries()) {
      const key = tableKey(v);
      if (before.has(key) && String(before.get(key) ?? '') !== String(b.targets[i] ?? '')) {
        changes.set(`c:${key}`, { path: t(`correspondance de « ${v} »`, `mapping of “${v}”`), kind: 'modified', details: [`${before.get(key) ?? '∅'} → ${b.targets[i] ?? '∅'}`] });
      }
    }
  }
  return changes;
}

/** Champs des sources et cibles d'un flux qui se réfèrent à un nœud Liste de valeurs (par son id ou celui de sa liste). */
function referringFields(graph, node) {
  const refs = new Set([node.id, node.data.listId].filter(Boolean));
  const out = [];
  for (const n of graph.nodes) {
    if (n.type !== 'source' && n.type !== 'target') continue;
    for (const f of allFields(n.data.fields ?? [])) if (refs.has(f.format?.library)) out.push(`${n.data.label}.${pathLabel(findChain(n.data.fields, f.id))}`);
  }
  return out;
}

/**
 * Conséquences d'une nouvelle version d'une liste sur les flux qui l'utilisent (sauf le nœud `except`) :
 * `{ changes, flows: [{ flow, node, fields, diverged }] }`, où `fields` liste ce qui, dans ce flux, dépend de la
 * liste : champs qui s'y réfèrent et liens de sa table de correspondance.
 */
export function listImpactOf(listId, next, except = null) {
  hooks.flush();
  const list = find(listId);
  const changes = listChanges(list, next);
  const strict = [...changes.keys()].some((k) => k === 'type' || k.startsWith('v:'));
  const tableTouched = [...changes.keys()].some((k) => k === 'table' || k.startsWith('c:'));
  const flows = [];
  for (const { mapping, path, nodes } of listUsage(listId)) {
    for (const node of nodes) {
      if (except && mapping.id === except.mappingId && node.id === except.nodeId) continue;
      const fields = [];
      if (strict) {
        for (const label of referringFields(mapping.graph, node)) fields.push({ path: label, kind: 'modified', details: [t('contrôlé par cette liste', 'checked against this list')] });
      }
      if (tableTouched && mapping.graph.edges.some((e) => e.source === node.id && e.sourceHandle === LIBRARY_TABLE)) {
        fields.push({ path: t('Table → Transcoder', 'Table → Transcode'), kind: changes.has('table') ? 'removed' : 'modified', details: [t('transcodage modifié', 'transcoding changed')] });
      }
      flows.push({ mappingId: mapping.id, flow: [...path, mapping.name].join(' › '), node: node.data.label, fields, diverged: !sameList(node.data, list) });
    }
  }
  return { changes, flows };
}

/** Aligne un nœud d'un flux enregistré sur le contenu de la liste ; sans table, les liens de sa sortie Table sont retirés. */
function syncListNode(graph, node, list) {
  Object.assign(node.data, listContent(list));
  if (!list.mapped) graph.edges = graph.edges.filter((e) => !(e.source === node.id && e.sourceHandle === LIBRARY_TABLE));
}

/** Enregistre une nouvelle version de la liste et l'applique aux flux qui l'utilisent (sauf aux nœuds modifiés localement). */
export function applyList(listId, next, { from } = {}) {
  hooks.flush();
  const list = find(listId);
  const before = listContent(list);
  Object.assign(list, listContent(next));
  for (const { mapping, nodes } of listUsage(listId)) {
    for (const node of nodes) {
      const origin = from && mapping.id === from.mappingId && node.id === from.nodeId;
      if (origin || sameList(node.data, before)) syncListNode(mapping.graph, node, list);
    }
  }
  hooks.reload();
}

/** Remet un nœud au contenu de sa liste (abandon des modifications locales). */
export function revertListNode(mappingId, nodeId) {
  hooks.flush();
  const mapping = find(mappingId);
  const node = mapping?.graph.nodes.find((n) => n.id === nodeId);
  const list = listOf(node?.data);
  if (!list) return;
  syncListNode(mapping.graph, node, list);
  hooks.reload();
}

/** Crée une liste dans la bibliothèque (dans le dossier `folderId`, à la racine sinon). */
export const createList = (name, data, folderId = null) => addToLibrary(makeList(name, data), folderId);

/** Supprime une liste : les nœuds qui l'utilisaient gardent leurs valeurs, mais n'y sont plus reliés. */
export function deleteList(listId) {
  hooks.flush();
  for (const { nodes } of listUsage(listId)) for (const node of nodes) delete node.data.listId;
  remove(listId);
  hooks.reload();
}
