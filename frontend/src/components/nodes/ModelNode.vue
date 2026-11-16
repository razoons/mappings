<template>
  <div class="node node-data model-node" :class="{ selected, collapsed: data.collapsed }">
    <div class="node-header" :style="{ background: HEADER_COLORS.model }">
      <CollapseButton :node-id="id" :collapsed="data.collapsed" />
      <span class="node-kind">{{ t('Modèle', 'Model') }}</span>
      <input class="node-title nodrag" :value="data.label" :title="t('Nom du modèle', 'Model name')" @input="updateNodeData(id, { label: $event.target.value })" />
      <span v-if="sampleError" class="warn" :title="`${t('Exemple JSON invalide', 'Invalid JSON example')} : ${sampleError}`">⚠</span>
      <button class="icon-btn nodrag" :title="t('Modèle de données en YAML (type, obligatoire, format et exemple de chaque champ)', 'Data model as YAML (type, required, format and example of each field)')" @click="editing = true">{ }</button>
    </div>
    <div v-if="!data.collapsed" class="node-body">
      <FieldTree :node-id="id" :data="data" side="source" :values="{}" :sockets="false" />
    </div>

    <TextDialog
      v-model="editing"
      :title="`${t('Modèle de données', 'Data model')} — ${data.label}`"
      :description="
        t(
          'Pour chaque champ : son type, s’il est obligatoire (required), son format et un exemple. Les champs retrouvés par leur nom gardent leurs liens dans les mappings. Pour partir d’un document réel, collez-le en JSON puis « Importer un exemple JSON ». Rien n’est enregistré dans la bibliothèque avant « Enregistrer le modèle ».',
          'For each field: its type, whether it is required, its format and an example. Fields found by name keep their links in the mappings. To start from a real document, paste it as JSON then “Import a JSON example”. Nothing is saved to the library before “Save the model”.',
        )
      "
      :initial="model.initial()"
      :actions="model.actions"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useVueFlow } from '@vue-flow/core';
import TextDialog from '../TextDialog.vue';
import CollapseButton from './CollapseButton.vue';
import FieldTree from './FieldTree.vue';
import { t } from '../../lib/i18n';
import { HEADER_COLORS } from '../../lib/types';
import { useFieldEditor, useModelEditor } from './shared';

/**
 * Modèle de la bibliothèque, dans l'éditeur de modèles : le même arbre de champs qu'une source ou une cible,
 * sans sockets (un modèle n'est relié à rien) ; les exemples y sont modifiables comme ceux d'une source.
 */
defineOptions({ inheritAttrs: false });

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: Boolean,
});

const { updateNodeData } = useVueFlow();
const ops = useFieldEditor(props.id, () => props.data);
const editing = ref(false);
const model = useModelEditor(() => props.data, ops, { source: true });
watch(editing, (open) => open && model.reset());

const sampleError = computed(() => {
  try {
    JSON.parse(props.data.sample || '{}');
    return null;
  } catch (e) {
    return e.message;
  }
});
</script>
