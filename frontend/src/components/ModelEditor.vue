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
        <v-icon icon="mdi-database-outline" size="18" />
        <span class="model-bar-title">{{ t('Modèle de la bibliothèque', 'Library model') }}</span>
        <span class="model-bar-usage">{{ usage ? t(`utilisé par ${usage} flux`, `used by ${usage} flow${usage > 1 ? 's' : ''}`) : t('utilisé par aucun flux', 'used by no flow') }}</span>
        <span v-if="dirty" class="model-bar-dirty">{{ t('modifications non enregistrées', 'unsaved changes') }}</span>
        <v-btn size="small" color="primary" variant="flat" :disabled="!dirty" @click="save">{{ t('Enregistrer le modèle', 'Save the model') }}</v-btn>
        <v-btn size="small" variant="text" :disabled="!dirty" :title="t('Revenir à la version enregistrée', 'Back to the saved version')" @click="reload">{{ t('Annuler les modifications', 'Discard the changes') }}</v-btn>
        <v-btn size="small" variant="text" icon="mdi-close" :title="t('Fermer et revenir au flux', 'Close and go back to the flow')" @click="$emit('close')" />
      </Panel>
    </VueFlow>
  </div>
</template>

<script setup>
import { computed, markRaw, nextTick, watch } from 'vue';
import { Panel, VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import ModelNode from './nodes/ModelNode.vue';
import { t } from '../lib/i18n';
import { find } from '../services/collections';
import { sameFields, sampleForSource, stripFields, usageCounts } from '../services/models';

/**
 * Éditeur graphique d'un modèle de la bibliothèque : le même arbre de champs que dans un flux, sur son propre
 * canevas, sans liens ni ajout de nœuds. Les modifications restent un brouillon jusqu'à « Enregistrer le modèle »
 * (`save` : `{ name, fields, sample }`), qui avertit des flux touchés.
 */
const props = defineProps({ modelId: { type: String, required: true } });
const emit = defineEmits(['save', 'close']);

const FLOW_ID = 'model-editor';
const nodeTypes = { model: markRaw(ModelNode) };
const { nodes, setNodes, fitView, onNodesInitialized } = useVueFlow(FLOW_ID);

const model = computed(() => find(props.modelId));
const draft = computed(() => nodes.value[0]?.data);
/** Exemple de départ du brouillon (celui du modèle, ou des valeurs types s'il n'en a pas). */
let initialSample = '';

const normalized = (text) => {
  try {
    return JSON.stringify(JSON.parse(text || '{}'));
  } catch {
    return text;
  }
};

const dirty = computed(
  () =>
    !!draft.value &&
    !!model.value &&
    (draft.value.label.trim() !== model.value.name || !sameFields(draft.value.fields, model.value.fields) || normalized(draft.value.sample) !== normalized(initialSample)),
);

const usage = computed(() => usageCounts().get(props.modelId) ?? 0);

/** Brouillon repris de la version enregistrée du modèle. */
function reload() {
  const m = model.value;
  if (!m) return;
  initialSample = sampleForSource(m);
  setNodes([
    {
      id: 'model',
      type: 'model',
      position: { x: 0, y: 0 },
      data: { label: m.name, fields: JSON.parse(JSON.stringify(m.fields)), sample: initialSample },
    },
  ]);
}

let fitPending = false;
onNodesInitialized(() => {
  if (!fitPending) return;
  fitPending = false;
  fitView({ padding: 0.2, maxZoom: 1.1 });
});

watch(
  () => props.modelId,
  () => {
    reload();
    fitPending = true;
    nextTick(() => fitView({ padding: 0.2, maxZoom: 1.1 }));
  },
  { immediate: true },
);

function save() {
  if (!dirty.value) return;
  emit('save', { name: draft.value.label.trim() || model.value.name, fields: stripFields(draft.value.fields), sample: draft.value.sample });
}

defineExpose({ dirty, save, reload });
</script>

<style>
.model-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px 6px 14px;
  border-radius: 10px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  font-size: 0.875rem;
}
.model-bar-title {
  font-weight: 600;
}
.model-bar-usage {
  opacity: 0.7;
}
.model-bar-dirty {
  color: rgb(var(--v-theme-warning));
}
.model-node {
  min-width: 520px;
}
</style>
