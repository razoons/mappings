<template>
  <div
    class="node node-data"
    :class="{ selected, collapsed: data.collapsed, locked: readOnly, 'file-over': fileOver }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="node-header" :style="{ background: HEADER_COLORS.source }">
      <CollapseButton :node-id="id" :collapsed="data.collapsed" />
      <span class="node-kind">Source</span>
      <input class="node-title nodrag" :disabled="readOnly" :value="data.label" @input="updateNodeData(id, { label: $event.target.value })" />
      <span v-if="sampleError" class="warn" :title="`Modèle de données JSON invalide : ${sampleError}`">⚠</span>
      <button class="icon-btn nodrag" title="Charger un fichier de données (ou le déposer sur le nœud)" @click="pickFile">⤒</button>
      <button class="icon-btn nodrag" title="Modèle de données (YAML : type, obligatoire, format de chaque champ)" @click="editing = true">{ }</button>
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
    <div v-if="file" class="data-file" :class="fileStatus.level">
      <span class="data-file-icon">{{ fileStatus.icon }}</span>
      <span class="data-file-name" :title="file.name">{{ file.name }}</span>
      <span class="data-file-status" :title="fileStatus.detail">{{ fileStatus.label }}</span>
      <button class="icon-btn nodrag" title="Retirer le fichier (revenir aux valeurs du modèle de données)" @click="files.clear(id)">×</button>
    </div>
    <div v-if="fileOver" class="data-file-drop">Déposer pour utiliser ce fichier comme données</div>
    <div v-if="!data.collapsed" class="node-body">
      <FieldTree :node-id="id" :data="data" side="source" :locked="readOnly" :values="outputsOf(id)" :issues="issues" />
    </div>

    <TextDialog
      v-model="editing"
      :title="`Modèle de données — ${data.label}`"
      description="Modèle de données de la source : pour chaque champ, son type, s’il est obligatoire (required) et son format. Les champs retrouvés par leur nom gardent leurs liens. Pour partir d’un document réel, collez-le en JSON puis « Importer un exemple JSON »."
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
import CollapseButton from './CollapseButton.vue';
import LockButton from './LockButton.vue';
import FieldTree from './FieldTree.vue';
import { allFields } from '../../lib/fields';
import { HEADER_COLORS } from '../../lib/types';
import { openFile } from '../../services/files';
import { DATA_FILES_KEY, useFieldEditor, useModelEditor, useReadOnly, useResults } from './shared';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: Boolean,
});

const { updateNodeData } = useVueFlow();
const { outputsOf, issuesOf } = useResults();
const files = inject(DATA_FILES_KEY);
const ops = useFieldEditor(props.id, () => props.data);
const editing = ref(false);
const model = useModelEditor(() => props.data, ops, { source: true });
watch(editing, (open) => open && model.reset());
const readOnly = useReadOnly(() => props.data.locked);

// ── Fichier de données : remplace l'exemple pour le calcul, contrôlé contre le modèle (qui ne change pas).

const file = computed(() => files.get(props.id));
const issues = computed(() => issuesOf(props.id));
const fileOver = ref(false);

const fileStatus = computed(() => {
  const all = [...issues.value.values()].flat();
  const errors = all.filter((i) => i.level === 'error').length;
  const warnings = all.length - errors;
  const detail = all.map((i) => i.message).join('\n');
  if (errors) return { level: 'error', icon: '⛔', label: `${errors} erreur${errors > 1 ? 's' : ''}${warnings ? `, ${warnings} ⚠` : ''}`, detail };
  if (warnings) return { level: 'warning', icon: '⚠', label: `${warnings} avertissement${warnings > 1 ? 's' : ''}`, detail };
  return { level: 'ok', icon: '✔', label: 'conforme au modèle', detail: 'Le fichier respecte le modèle.' };
});

const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');

function onDragOver(e) {
  if (!hasFiles(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  fileOver.value = true;
}

function onDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) fileOver.value = false;
}

async function onDrop(e) {
  if (!hasFiles(e)) return;
  e.preventDefault();
  fileOver.value = false;
  const f = e.dataTransfer.files[0];
  if (f) files.load(props.id, { name: f.name, text: await f.text() });
}

async function pickFile() {
  const f = await openFile({ data: true });
  if (f) files.load(props.id, f);
}

const sampleError = computed(() => {
  try {
    JSON.parse(props.data.sample || '{}');
    return null;
  } catch (e) {
    return e.message;
  }
});
</script>
