<template>
  <div class="editor model-editor">
    <VueFlow
      :id="FLOW_ID"
      :node-types="nodeTypes"
      :nodes-connectable="false"
      :delete-key-code="null"
      :min-zoom="0.2"
      :max-zoom="2"
    >
      <Background variant="lines" :gap="24" color="var(--grid)" />
      <Controls :show-interactive="false" />
      <Panel position="top-center" class="model-bar">
        <!-- Seulement enregistrer, annuler, fermer (le reste dans les infobulles), comme pour un modèle composite. -->
        <v-btn
          size="small"
          color="primary"
          variant="flat"
          prepend-icon="mdi-content-save-outline"
          :disabled="!dirty"
          :title="`${isList ? t('Enregistrer la liste (Ctrl S)', 'Save the list (Ctrl S)') : t('Enregistrer le modèle (Ctrl S)', 'Save the model (Ctrl S)')} — ${usageText}`"
          @click="save"
        >
          {{ t('Enregistrer', 'Save') }}
        </v-btn>
        <v-btn size="small" variant="text" prepend-icon="mdi-undo" :disabled="!dirty" :title="t('Annuler les modifications : revenir à la version enregistrée', 'Discard the changes: back to the saved version')" @click="reload">
          {{ t('Annuler', 'Discard') }}
        </v-btn>
        <v-btn size="small" variant="text" icon="mdi-close" :title="t('Fermer et revenir au mapping', 'Close and go back to the mapping')" @click="$emit('close')" />
      </Panel>
    </VueFlow>
  </div>
</template>

<script setup>
import { computed, markRaw, nextTick, provide, ref, watch } from 'vue';
import { Panel, VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import ModelNode from './nodes/ModelNode.vue';
import LibraryNode from './nodes/LibraryNode.vue';
import { LIBRARIES_KEY, SCHEMA_LOCK_KEY } from './nodes/shared';
import { t } from '../lib/i18n';
import { librariesOf } from '../lib/libraries';
import { find, workspace } from '../services/collections';
import { sameFields, sampleForSource, stripFields, usageCounts } from '../services/models';
import { listContent, sameList } from '../services/valueLists';

/**
 * Éditeur graphique d'un élément de la bibliothèque : un modèle (le même arbre de champs que dans un flux) ou une
 * liste de valeurs (le même nœud que dans un flux), sur son propre canevas, sans liens ni ajout de nœuds. Les
 * modifications restent un brouillon jusqu'à l'enregistrement (`save` : `{ name, fields, sample }` pour un modèle,
 * `{ name, list }` pour une liste), qui avertit des flux touchés.
 */
const props = defineProps({ itemId: { type: String, required: true } });
const emit = defineEmits(['save', 'close']);

const FLOW_ID = 'model-editor';
const nodeTypes = { model: markRaw(ModelNode), valuelist: markRaw(LibraryNode) };
const { nodes, setNodes, fitView, onNodesInitialized } = useVueFlow(FLOW_ID);

// Ici, rien n'est verrouillé ; les champs d'un modèle peuvent se référer aux listes de valeurs de la bibliothèque.
provide(SCHEMA_LOCK_KEY, ref(false));
const libraryLists = computed(() => {
  const lists = [];
  const walk = (items) => items.forEach((i) => (i.items ? walk(i.items) : i.type === 'valuelist' && lists.push(i)));
  walk(workspace.library.items);
  return librariesOf(lists.map((l) => ({ id: l.id, type: 'library', data: { label: l.name, ...listContent(l) } })));
});
provide(LIBRARIES_KEY, libraryLists);

const item = computed(() => find(props.itemId));
const isList = computed(() => item.value?.type === 'valuelist');
const draft = computed(() => nodes.value[0]?.data);
/** Exemple de départ du brouillon d'un modèle (le sien, ou des valeurs types s'il n'en a pas). */
let initialSample = '';

const normalized = (text) => {
  try {
    return JSON.stringify(JSON.parse(text || '{}'));
  } catch {
    return text;
  }
};

const dirty = computed(() => {
  const d = draft.value;
  const it = item.value;
  if (!d || !it) return false;
  if (d.label.trim() !== it.name) return true;
  if (isList.value) return !sameList(d, it);
  return !sameFields(d.fields, it.fields) || normalized(d.sample) !== normalized(initialSample);
});

const usage = computed(() => usageCounts().get(props.itemId) ?? 0);
const usageText = computed(() => {
  if (!usage.value) return t(`utilisé${isList.value ? 'e' : ''} par aucun mapping`, 'used by no mapping');
  return t(`utilisé${isList.value ? 'e' : ''} par ${usage.value} mapping`, `used by ${usage.value} mapping${usage.value > 1 ? 's' : ''}`);
});

/** Brouillon repris de la version enregistrée. */
function reload() {
  const it = item.value;
  if (!it) return;
  if (it.type === 'valuelist') {
    setNodes([{ id: 'item', type: 'valuelist', position: { x: 0, y: 0 }, data: { label: it.name, ...listContent(it) } }]);
    return;
  }
  initialSample = sampleForSource(it);
  setNodes([{ id: 'item', type: 'model', position: { x: 0, y: 0 }, data: { label: it.name, fields: JSON.parse(JSON.stringify(it.fields)), sample: initialSample } }]);
}

let fitPending = false;
onNodesInitialized(() => {
  if (!fitPending) return;
  fitPending = false;
  fitView({ padding: 0.2, maxZoom: 1.1 });
});

watch(
  () => props.itemId,
  () => {
    reload();
    fitPending = true;
    nextTick(() => fitView({ padding: 0.2, maxZoom: 1.1 }));
  },
  { immediate: true },
);

// Renommé ailleurs (panneau de la bibliothèque) : le titre du nœud suit, sauf s'il a été changé ici entre-temps.
watch(
  () => item.value?.name,
  (name, old) => {
    const d = draft.value;
    if (d && name && d.label.trim() === old) d.label = name;
  },
);

function save() {
  if (!dirty.value) return;
  const name = draft.value.label.trim() || item.value.name;
  if (isList.value) emit('save', { name, list: listContent(draft.value) });
  else emit('save', { name, fields: stripFields(draft.value.fields), sample: draft.value.sample });
}

defineExpose({ dirty, save, reload });
</script>

<style>
.model-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border-radius: 10px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  font-size: 0.875rem;
}
.model-node {
  min-width: 520px;
}
</style>
