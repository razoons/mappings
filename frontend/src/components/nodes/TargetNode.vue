<template>
  <div class="node node-data" :class="{ selected, collapsed: data.collapsed, locked: readOnly }">
    <div class="node-header" :style="{ background: HEADER_COLORS.target }">
      <CollapseButton :node-id="id" :collapsed="data.collapsed" />
      <span class="node-kind">Cible</span>
      <input class="node-title nodrag" :disabled="readOnly" :value="data.label" @input="updateNodeData(id, { label: $event.target.value })" />
      <span v-if="counts.errors || counts.warnings" class="issue-count" :class="{ error: counts.errors }" :title="countLabel">
        {{ counts.errors ? '⛔' : '⚠' }} {{ counts.errors + counts.warnings }}
      </span>
      <button class="icon-btn nodrag result-btn" title="Voir le résultat (JSON produit et sa conformité au modèle)" @click="showResult = true">Résultat</button>
      <button class="icon-btn nodrag" title="Modèle de données (YAML : type, obligatoire, format de chaque champ)" @click="editing = true">{ }</button>
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

    <ResultDialog
      v-model="showResult"
      :label="data.label"
      :fields="data.fields"
      :value="resultOf(id)"
      :sources="loadedFiles"
    />

    <TextDialog
      v-model="editing"
      :title="`Modèle de données — ${data.label}`"
      description="Modèle de données de la cible : pour chaque champ, son type, s’il est obligatoire (required) et son format. Les champs retrouvés par leur nom gardent leurs liens. Pour partir du format attendu, collez-le en JSON puis « Importer un exemple JSON »."
      :initial="model.initial()"
      :actions="model.actions"
      :read-only="readOnly"
    />
  </div>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue';
import { Handle, Position, useVueFlow } from '@vue-flow/core';
import TextDialog from '../TextDialog.vue';
import ResultDialog from '../ResultDialog.vue';
import CollapseButton from './CollapseButton.vue';
import LockButton from './LockButton.vue';
import FieldTree from './FieldTree.vue';
import { allFields } from '../../lib/fields';
import { countIssues } from '../../lib/rules';
import { HEADER_COLORS } from '../../lib/types';
import { DATA_FILES_KEY, useFieldEditor, useModelEditor, useReadOnly, useResults } from './shared';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: Boolean,
});

const { updateNodeData, edges, nodes } = useVueFlow();
const { previewOf, issuesOf, resultOf } = useResults();
const files = inject(DATA_FILES_KEY);
const showResult = ref(false);
/** Fichiers de données chargés sur les sources (« Boutique : commandes.json »). */
const loadedFiles = computed(() =>
  nodes.value.filter((n) => n.type === 'source' && files.get(n.id)?.doc).map((n) => `${n.data.label} : ${files.get(n.id).name}`),
);
const ops = useFieldEditor(props.id, () => props.data);
const editing = ref(false);
const model = useModelEditor(() => props.data, ops);
watch(editing, (open) => open && model.reset());
const readOnly = useReadOnly(() => props.data.locked);

const issues = computed(() => issuesOf(props.id));
const counts = computed(() => countIssues(issues.value));
const countLabel = computed(
  () => `${counts.value.errors} erreur(s), ${counts.value.warnings} avertissement(s) — détail dans le panneau Contrôles`,
);

const connected = computed(() => new Set(edges.value.filter((e) => e.target === props.id).map((e) => e.targetHandle)));
</script>
