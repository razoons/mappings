<template>
  <div class="node node-data" :class="{ selected, collapsed: data.collapsed, locked: readOnly }">
    <div class="node-header" :style="{ background: HEADER_COLORS.target }">
      <CollapseButton :node-id="id" :collapsed="data.collapsed" />
      <span class="node-kind">Cible</span>
      <input class="node-title nodrag" :disabled="readOnly" :value="data.label" @input="updateNodeData(id, { label: $event.target.value })" />
      <span v-if="counts.errors || counts.warnings" class="issue-count" :class="{ error: counts.errors }" :title="countLabel">
        {{ counts.errors ? '⛔' : '⚠' }} {{ counts.errors + counts.warnings }}
      </span>
      <button class="icon-btn nodrag" title="Structure en JSON" @click="editing = true">{ }</button>
      <LockButton :node-id="id" :locked="data.locked" />
      <template v-if="data.collapsed">
        <Handle
          v-for="f in allFields(data.fields)"
          :id="f.id"
          :key="f.id"
          type="target"
          :position="Position.Left"
          :connectable="false"
          class="socket hidden-socket"
        />
      </template>
    </div>
    <div v-if="!data.collapsed" class="node-body">
      <FieldTree :node-id="id" :data="data" side="target" :locked="readOnly" :values="previewOf(id)" :connected="connected" :issues="issues" />
    </div>

    <JsonDialog
      v-model="editing"
      :title="`Structure — ${data.label}`"
      description="La structure actuelle, sous forme d’exemple JSON. Modifiez-la (ou collez le format attendu) puis enregistrez : les champs retrouvés par leur nom gardent leurs liens."
      :initial="JSON.stringify(sampleFromFields(data.fields), null, 2)"
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
import { countIssues } from '../../lib/rules';
import { HEADER_COLORS } from '../../lib/types';
import { useFieldEditor, useReadOnly, useResults } from './shared';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: Boolean,
});

const { updateNodeData, edges } = useVueFlow();
const { previewOf, issuesOf } = useResults();
const ops = useFieldEditor(props.id, () => props.data);
const editing = ref(false);
const readOnly = useReadOnly(() => props.data.locked);

const issues = computed(() => issuesOf(props.id));
const counts = computed(() => countIssues(issues.value));
const countLabel = computed(
  () => `${counts.value.errors} erreur(s), ${counts.value.warnings} avertissement(s) — détail dans l’onglet Contrôles`,
);

const connected = computed(() => new Set(edges.value.filter((e) => e.target === props.id).map((e) => e.targetHandle)));

const actions = [
  {
    label: 'Enregistrer',
    primary: true,
    run: (text) => {
      ops.sync(syncFields(props.data.fields, parseDocument(text)));
      return true;
    },
  },
];
</script>
