<template>
  <div v-if="data.modelId" class="model-link nodrag" :class="{ diverged, missing: !model }">
    <template v-if="model">
      <v-icon icon="mdi-database-outline" size="14" />
      <span class="model-name" :title="t('Modèle de la bibliothèque', 'Library model')">{{ model.name }}</span>
      <span v-if="diverged" class="model-state">{{ t('modifié ici', 'changed here') }}</span>
      <span v-else-if="others" class="model-state muted">{{ t(`+ ${others} autre${others > 1 ? 's' : ''} flux`, `+ ${others} other flow${others > 1 ? 's' : ''}`) }}</span>
      <span class="spacer" />
      <template v-if="diverged && !readOnly">
        <button class="link-btn" :title="saveTitle" @click="link.save(nodeId)">{{ t('Enregistrer dans le modèle', 'Save to the model') }}</button>
        <button class="link-btn" :title="t('Créer un nouveau modèle avec ces champs, relié à ce nœud ; le modèle d’origine ne change pas', 'Create a new model with these fields, linked to this node; the original model does not change')" @click="link.saveAs(nodeId)">{{ t('Nouveau modèle…', 'New model…') }}</button>
        <button class="link-btn" :title="t('Revenir aux champs du modèle', 'Back to the model fields')" @click="link.revert(nodeId)">↺</button>
      </template>
      <button v-if="!readOnly" class="link-btn" :title="t('Délier du modèle (les champs restent, propres à ce flux)', 'Unlink from the model (the fields stay, specific to this flow)')" @click="link.unlink(nodeId)">✕</button>
    </template>
    <template v-else>
      <v-icon icon="mdi-database-off-outline" size="14" />
      <span class="model-name">{{ t('Modèle supprimé de la bibliothèque', 'Model deleted from the library') }}</span>
      <span class="spacer" />
      <button v-if="!readOnly" class="link-btn" @click="link.unlink(nodeId)">{{ t('Délier', 'Unlink') }}</button>
    </template>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue';
import { t } from '../../lib/i18n';
import { modelOf, sameFields } from '../../services/models';
import { MODEL_LINK_KEY } from './shared';

/** Bandeau d'un nœud source ou cible relié à un modèle de la bibliothèque. */
const props = defineProps({
  nodeId: { type: String, required: true },
  data: { type: Object, required: true },
  readOnly: Boolean,
});

const link = inject(MODEL_LINK_KEY);
const model = computed(() => modelOf(props.data));
const diverged = computed(() => !!model.value && !sameFields(props.data.fields, model.value.fields));
/** Autres flux qui utilisent ce modèle. */
const others = computed(() => (model.value ? link.otherFlows(model.value.id) : 0));
const saveTitle = computed(() =>
  others.value
    ? t(`Le modèle est aussi utilisé par ${others.value} autre(s) flux : la liste des impacts s’affiche avant d’enregistrer`, `The model is also used by ${others.value} other flow(s): the impacts are listed before saving`)
    : t('Enregistrer ces champs dans le modèle de la bibliothèque', 'Save these fields to the library model'),
);
</script>
