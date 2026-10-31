import { computed, inject, nextTick } from 'vue';
import { useVueFlow } from '@vue-flow/core';
import { allFields, applyTypeKey, descendantIds, findChain, isContainer, mapField, moveField, newField, removeField, reshapeSample } from '../../lib/fields';
import { cleanFormat } from '../../lib/formats';
import { isPlainObject } from '../../lib/lists';
import { baseOf, isList, SOCKET_COLORS, socketTitle } from '../../lib/types';

/** Résultat de l'évaluation du graphe, fourni par l'éditeur. */
export const RESULTS_KEY = Symbol('results');

export function useResults() {
  const results = inject(RESULTS_KEY);
  return {
    outputsOf: (nodeId) => results.value.outputs.get(nodeId) ?? {},
    previewOf: (nodeId) => results.value.targets.get(nodeId)?.preview ?? {},
    /** Problèmes de validation d'une cible, par champ. */
    issuesOf: (nodeId) => results.value.issues.byNode.get(nodeId) ?? new Map(),
  };
}

/** Verrou de tout le schéma (ref booléenne), fourni par l'éditeur. */
export const SCHEMA_LOCK_KEY = Symbol('schemaLock');

/** Un nœud est en lecture seule s'il est verrouillé lui-même ou si tout le schéma l'est. */
export function useReadOnly(getLocked) {
  const schemaLocked = inject(SCHEMA_LOCK_KEY);
  return computed(() => schemaLocked.value || !!getLocked());
}

/** Attributs d'un socket : forme (rond, losange pour une liste, point pour une entrée par élément) et couleur du type. */
export const socketAttrs = (type, perItem = false) => ({
  class: ['socket', { list: isList(type), 'per-item': perItem }],
  style: { background: SOCKET_COLORS[baseOf(type)] },
  title: socketTitle(type) + (perItem ? ' — évalué pour chaque élément' : ''),
});

/** Replie / déplie un nœud ; Vue Flow doit ensuite re-mesurer ses handles. */
export function useCollapse(nodeId) {
  const { updateNodeData, updateNodeInternals } = useVueFlow();
  return (collapsed) => {
    updateNodeData(nodeId, { collapsed });
    nextTick(() => updateNodeInternals([nodeId]));
  };
}

/** Champ en cours de glisser-déposer (partagé entre nœuds : on ne dépose que dans le nœud d'origine). */
export const dragState = { current: null };

/**
 * Opérations sur l'arbre de champs d'un nœud source ou cible. Pour une source (`data.sample` défini),
 * chaque changement de structure réécrit aussi le JSON d'exemple (sauf s'il est invalide).
 * `getData` renvoie les données à jour du nœud (Vue Flow remplace l'objet à chaque modification).
 */
export function useFieldEditor(nodeId, getData) {
  const { updateNodeData, edges, removeEdges } = useVueFlow();

  const dropEdgesOf = (ids) => {
    const set = new Set(ids);
    const gone = edges.value.filter(
      (e) => (e.source === nodeId && set.has(e.sourceHandle)) || (e.target === nodeId && set.has(e.targetHandle)),
    );
    if (gone.length) removeEdges(gone);
  };

  const setFields = (next) => {
    const { fields, sample } = getData();
    if (sample === undefined) return updateNodeData(nodeId, { fields: next });
    let doc;
    try {
      doc = JSON.parse(sample || '{}');
    } catch {
      return updateNodeData(nodeId, { fields: next });
    }
    const reshaped = reshapeSample(fields, isPlainObject(doc) ? doc : {}, next);
    updateNodeData(nodeId, { fields: next, sample: JSON.stringify(reshaped, null, 2) });
  };
  const update = (id, fn) => setFields(mapField(getData().fields, id, fn));

  return {
    add: () => setFields([...getData().fields, newField(getData().fields)]),
    addChild: (parentId) =>
      update(parentId, (p) => ({ ...p, collapsed: false, children: [...(p.children ?? []), newField(p.children ?? [])] })),
    rename: (id, name) => update(id, (f) => ({ ...f, name })),
    // Simple affichage : le JSON n'est pas concerné.
    toggle: (id) => updateNodeData(nodeId, { fields: mapField(getData().fields, id, (f) => ({ ...f, collapsed: !f.collapsed })) }),
    setType: (id, key) => {
      const field = findChain(getData().fields, id)?.at(-1);
      if (!field) return;
      const next = applyTypeKey(field, key);
      if (!isContainer(next)) dropEdgesOf(descendantIds(field));
      update(id, () => next);
    },
    /** Règles du champ (`required`, `format`) : sans effet sur le JSON d'exemple. */
    setRules: (id, rules) =>
      updateNodeData(nodeId, { fields: mapField(getData().fields, id, (f) => {
        const next = { ...f, ...rules };
        if (!next.required) delete next.required;
        const format = cleanFormat(next);
        if (format) next.format = format;
        else delete next.format;
        return next;
      }) }),
    move: (dragId, targetId, pos) => setFields(moveField(getData().fields, dragId, targetId, pos)),
    remove: (id) => {
      const field = findChain(getData().fields, id)?.at(-1);
      if (field) dropEdgesOf([id, ...descendantIds(field)]);
      setFields(removeField(getData().fields, id));
    },
    /** Nouvelle structure venue du JSON : seuls les liens des champs disparus sont supprimés. */
    sync: (next, extra = {}) => {
      const kept = new Set(allFields(next).map((f) => f.id));
      dropEdgesOf(allFields(getData().fields).map((f) => f.id).filter((id) => !kept.has(id)));
      updateNodeData(nodeId, { ...extra, fields: next });
    },
  };
}
