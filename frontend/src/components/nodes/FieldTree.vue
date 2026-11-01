<template>
  <div class="col-labels tree-cols">
    <span>Champ</span>
    <span>Type</span>
    <span>Valeur</span>
  </div>

  <div
    v-for="{ field: f, depth, chain, hidden } in rows"
    :key="f.id"
    class="row field-row tree-cols"
    :class="[{ dragging: draggedId === f.id }, dropClass(f.id), levelOf(f) && `issue-${levelOf(f)}`]"
    @dragover="overTarget($event, f.id, dropPosition($event, f))"
    @dragleave="leave($event, f.id)"
    @drop="dropOn"
  >
    <div class="field-main" :style="{ paddingLeft: `${depth * 14}px` }">
      <span v-if="locked" class="grip-space" />
      <span
        v-else
        class="grip nodrag"
        draggable="true"
        title="Glisser pour déplacer le champ"
        @dragstart="startDrag($event, f)"
        @dragend="endDrag"
      >⋮⋮</span>
      <button
        v-if="isContainer(f)"
        class="toggle nodrag"
        :title="f.collapsed ? 'Déplier' : 'Replier'"
        @click="ops.toggle(f.id)"
      >{{ f.collapsed ? '▸' : '▾' }}</button>
      <span v-else class="toggle" />
      <input class="nodrag" :disabled="locked" :value="f.name" @input="ops.rename(f.id, $event.target.value)" />
      <button
        class="required-btn nodrag"
        :class="{ on: f.required }"
        :disabled="locked"
        :title="f.required ? 'Obligatoire (cliquer pour le rendre optionnel)' : 'Optionnel (cliquer pour le rendre obligatoire)'"
        @click="ops.setRules(f.id, { required: !f.required })"
      >*</button>
      <FieldRules :field="f" :locked="locked" @update="ops.setRules(f.id, $event)" />
    </div>

    <select class="type-select nodrag" :disabled="locked" :value="typeKey(f)" @change="ops.setType(f.id, $event.target.value)">
      <option v-for="[k, label] in TYPE_OPTIONS" :key="k" :value="k">{{ label }}</option>
    </select>

    <span v-if="exampleEditable(f, chain)" class="field-value editable">
      <input
        v-if="f.type === 'boolean'"
        type="checkbox"
        class="nodrag"
        :checked="exampleOf(chain) === true"
        title="Exemple (données du calcul tant qu’aucun fichier n’est chargé)"
        @change="setExample(chain, $event.target.checked)"
      />
      <input
        v-else
        class="value-input nodrag"
        :class="{ invalid: exampleProblem(f, chain) }"
        :value="exampleText(chain)"
        :placeholder="f.type === 'date' ? 'AAAA-MM-JJ' : '—'"
        :inputmode="f.type === 'number' || f.type === 'integer' ? 'decimal' : undefined"
        :title="exampleProblem(f, chain) || 'Exemple (données du calcul tant qu’aucun fichier n’est chargé) — Entrée pour valider'"
        @change="setExample(chain, parseExample(f, $event.target.value))"
        @keydown.enter="$event.target.blur()"
      />
    </span>
    <span v-else class="field-value" :class="{ empty: isUnmapped(f) }" :title="issueText(f) || formatValue(values[f.id])">
      <span v-if="levelOf(f)" class="issue-mark" :class="levelOf(f)">{{ levelOf(f) === 'error' ? '⛔' : '⚠' }}</span>
      {{ isUnmapped(f) ? 'non mappé' : values[f.id] === undefined ? '—' : formatValue(values[f.id]) }}
    </span>

    <span v-if="!locked" class="row-actions">
      <button v-if="isContainer(f)" class="icon-btn nodrag" title="Ajouter un sous-champ" @click="ops.addChild(f.id)">+</button>
      <button class="icon-btn danger nodrag" title="Supprimer" @click="ops.remove(f.id)">×</button>
    </span>

    <Handle :id="f.id" :type="side" :position="position" v-bind="socketAttrs(socketType(chain))" />
    <!-- Sockets des descendants repliés : invisibles, leurs liens convergent sur cette ligne. -->
    <Handle
      v-for="h in hidden"
      :id="h.id"
      :key="h.id"
      :type="side"
      :position="position"
      :connectable="false"
      class="socket hidden-socket"
    />
  </div>

  <button
    v-if="!locked"
    class="add-field nodrag"
    :class="dropClass(null)"
    @click="ops.add"
    @dragover="overTarget($event, null, 'inside-end')"
    @dragleave="drop?.id === null && (drop = null)"
    @drop="dropOn"
  >
    {{ draggedId ? 'Déposer ici pour placer à la racine' : '+ Ajouter un champ' }}
  </button>
</template>

<script setup>
import { computed, inject, nextTick, ref, watch } from 'vue';
import { Handle, Position, useVueFlow } from '@vue-flow/core';
import { checkDocument, describeProblem } from '../../lib/conformity';
import { descendantIds, flattenRows, isContainer, sourceSocketType, targetSocketType, TYPE_OPTIONS, typeKey } from '../../lib/fields';
import { isPlainObject } from '../../lib/lists';
import { formatValue } from '../../lib/types';
import FieldRules from './FieldRules.vue';
import { DATA_FILES_KEY, dragState, socketAttrs, useFieldEditor } from './shared';

const props = defineProps({
  nodeId: { type: String, required: true },
  /** Données du nœud (`fields`, et `sample` pour une source). */
  data: { type: Object, required: true },
  side: { type: String, required: true },
  /** Valeur affichée par champ. */
  values: { type: Object, required: true },
  /** Côté cible : ids des champs reliés. */
  connected: { type: Set, default: null },
  /** Côté cible : problèmes de validation par champ. */
  issues: { type: Map, default: null },
  locked: Boolean,
});

// Les données d'exemple d'une source suivent la structure ; celles d'une cible (exemples donnés) restent telles quelles.
const ops = useFieldEditor(props.nodeId, () => props.data, { reshape: props.side === 'source' });
const { updateNodeData, updateNodeInternals } = useVueFlow();
const files = inject(DATA_FILES_KEY, null);
const rows = computed(() => flattenRows(props.data.fields));
const position = computed(() => (props.side === 'source' ? Position.Right : Position.Left));
const draggedId = ref(null);
const drop = ref(null);

const socketType = (chain) => (props.side === 'source' ? sourceSocketType(chain) : targetSocketType(chain.at(-1)));

const isMapped = (f) => props.connected.has(f.id) || (f.children ?? []).some(isMapped);
const isUnmapped = (f) => props.connected !== null && !isMapped(f);

const issuesOf = (f) => props.issues?.get(f.id) ?? [];
const levelOf = (f) => {
  const list = issuesOf(f);
  return list.some((i) => i.level === 'error') ? 'error' : list.length ? 'warning' : null;
};
const issueText = (f) => issuesOf(f).map((i) => i.message).join('\n');

// ── Exemple d'une source, modifiable dans la colonne Valeur ─────────────
// Pour un champ simple hors liste, sans fichier de données chargé (sinon la valeur vient du fichier).

/** Données d'exemple de la source (`null` si elles sont illisibles). */
const sampleDoc = computed(() => {
  if (props.side !== 'source') return null;
  try {
    const doc = JSON.parse(props.data.sample || '{}');
    return isPlainObject(doc) ? doc : {};
  } catch {
    return null;
  }
});

const exampleEditable = (f, chain) =>
  !!sampleDoc.value &&
  !props.locked &&
  !files?.get(props.nodeId) &&
  !isContainer(f) &&
  f.type !== 'array' &&
  chain.slice(0, -1).every((c) => c.type !== 'array');

const exampleOf = (chain) => chain.reduce((v, c) => (isPlainObject(v) ? v[c.name] : undefined), sampleDoc.value);
const exampleText = (chain) => {
  const v = exampleOf(chain);
  return v === undefined || v === null ? '' : String(v);
};

/** Valeur saisie convertie selon le type du champ (un nombre illisible reste un texte : le contrôle le signale). */
function parseExample(f, text) {
  if (text === '') return null;
  if (f.type === 'number' || f.type === 'integer') {
    const n = Number(text.trim().replace(',', '.'));
    return Number.isNaN(n) ? text : n;
  }
  return text;
}

/** Problème de l'exemple au regard du type et du format du champ (message, ou `null`). */
function exampleProblem(f, chain) {
  const v = exampleOf(chain);
  if (v === undefined || v === null) return f.required ? 'Obligatoire : donnez un exemple' : null;
  const p = checkDocument([f], { [f.name]: v }).find((x) => x.level === 'error');
  return p ? describeProblem(p) : null;
}

function setExample(chain, value) {
  const doc = structuredClone(sampleDoc.value);
  let node = doc;
  for (const c of chain.slice(0, -1)) {
    if (!isPlainObject(node[c.name])) node[c.name] = {};
    node = node[c.name];
  }
  if (value === null) delete node[chain.at(-1).name];
  else node[chain.at(-1).name] = value;
  updateNodeData(props.nodeId, { sample: JSON.stringify(doc, null, 2) });
}

// Les handles visibles changent avec l'arbre : Vue Flow doit les re-mesurer.
watch(
  () => rows.value.map((r) => `${r.field.id}:${r.depth}`).join('|'),
  () => nextTick(() => updateNodeInternals([props.nodeId])),
);

/** Position de dépôt selon la hauteur du curseur dans la ligne survolée. */
function dropPosition(e, f) {
  const rect = e.currentTarget.getBoundingClientRect();
  const y = (e.clientY - rect.top) / rect.height;
  if (!isContainer(f)) return y < 0.5 ? 'before' : 'after';
  if (y < 0.3) return 'before';
  if (f.collapsed) return y > 0.7 ? 'after' : 'inside-end';
  return 'inside-start'; // déplié : ses enfants suivent directement la ligne
}

const canDropOn = (targetId) => {
  const d = dragState.current;
  return d?.nodeId === props.nodeId && targetId !== d.fieldId && !d.forbidden.has(targetId ?? '');
};

function startDrag(e, f) {
  dragState.current = { nodeId: props.nodeId, fieldId: f.id, forbidden: new Set(descendantIds(f)) };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', f.name);
  const row = e.currentTarget.closest('.field-row');
  if (row) e.dataTransfer.setDragImage(row, 12, 12);
  draggedId.value = f.id;
}

function endDrag() {
  dragState.current = null;
  draggedId.value = null;
  drop.value = null;
}

function overTarget(e, targetId, pos) {
  if (!canDropOn(targetId)) return;
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
  if (drop.value?.id !== targetId || drop.value?.pos !== pos) drop.value = { id: targetId, pos };
}

function leave(e, id) {
  if (!e.currentTarget.contains(e.relatedTarget) && drop.value?.id === id) drop.value = null;
}

function dropOn(e) {
  e.preventDefault();
  if (dragState.current && drop.value) ops.move(dragState.current.fieldId, drop.value.id, drop.value.pos);
  endDrag();
}

const dropClass = (id) => (drop.value && drop.value.id === id ? `drop-${drop.value.pos}` : '');
</script>
