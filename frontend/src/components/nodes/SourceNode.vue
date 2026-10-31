<template>
  <div class="node node-data" :class="{ selected, collapsed: data.collapsed, locked: readOnly }">
    <div class="node-header" :style="{ background: HEADER_COLORS.source }">
      <CollapseButton :node-id="id" :collapsed="data.collapsed" />
      <span class="node-kind">Source</span>
      <input class="node-title nodrag" :disabled="readOnly" :value="data.label" @input="updateNodeData(id, { label: $event.target.value })" />
      <span v-if="sampleError" class="warn" :title="`Exemple JSON invalide : ${sampleError}`">⚠</span>
      <button class="icon-btn nodrag" title="Données d’exemple (JSON)" @click="editing = true">{ }</button>
      <LockButton :node-id="id" :locked="data.locked" />
      <template v-if="data.collapsed">
        <Handle
          v-for="f in allFields(data.fields)"
          :id="f.id"
          :key="f.id"
          type="source"
          :position="Position.Right"
          :connectable="false"
          class="socket hidden-socket"
        />
      </template>
    </div>
    <div v-if="!data.collapsed" class="node-body">
      <FieldTree :node-id="id" :data="data" side="source" :locked="readOnly" :values="outputsOf(id)" />
    </div>

    <JsonDialog
      v-model="editing"
      :title="`Données d’exemple — ${data.label}`"
      description="Cet exemple sert à prévisualiser le mapping et reste synchronisé avec les champs : enregistrer met la structure à jour (les champs retrouvés par leur nom gardent leurs liens). Un tableau à la racine est rangé dans un champ « items »."
      :initial="data.sample"
      :actions="actions"
      :read-only="readOnly"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { Handle, Position, useVueFlow } from '@vue-flow/core';
import JsonDialog from '../JsonDialog.vue';
import CollapseButton from './CollapseButton.vue';
import LockButton from './LockButton.vue';
import FieldTree from './FieldTree.vue';
import { allFields, parseDocument, sampleFromFields, syncFields } from '../../lib/fields';
import { HEADER_COLORS } from '../../lib/types';
import { useFieldEditor, useReadOnly, useResults } from './shared';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: Boolean,
});

const { updateNodeData } = useVueFlow();
const { outputsOf } = useResults();
const ops = useFieldEditor(props.id, () => props.data);
const editing = ref(false);
const readOnly = useReadOnly(() => props.data.locked);

const sampleError = computed(() => {
  try {
    JSON.parse(props.data.sample || '{}');
    return null;
  } catch (e) {
    return e.message;
  }
});

const actions = [
  {
    label: 'Valeurs d’exemple',
    run: (_, setText) => {
      setText(JSON.stringify(sampleFromFields(props.data.fields), null, 2));
      return false;
    },
  },
  {
    label: 'Enregistrer',
    primary: true,
    run: (text) => {
      const doc = parseDocument(text);
      ops.sync(syncFields(props.data.fields, doc), { sample: JSON.stringify(doc, null, 2) });
      return true;
    },
  },
];
</script>
