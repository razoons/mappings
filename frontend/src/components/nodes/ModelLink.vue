<template>
  <div v-if="link.linkedId(data)" class="model-link nodrag" :class="{ diverged, missing: !item }">
    <template v-if="item">
      <v-icon :icon="ICONS[kind]" size="14" />
      <span class="model-name" :title="`${texts.title} : ${fullName}`"
        ><span v-for="(folder, i) in folders" :key="i" class="model-folder">{{ folder }} › </span>{{ item.name }}</span
      >
      <span v-if="diverged" class="model-state">{{ texts.changed }}</span>
      <span v-else-if="others" class="model-state muted">{{ t(`+ ${others} autre${others > 1 ? 's' : ''} mapping${others > 1 ? 's' : ''}`, `+ ${others} other mapping${others > 1 ? 's' : ''}`) }}</span>
      <span class="spacer" />
      <template v-if="diverged && !readOnly">
        <button v-if="link.canSave?.(item) ?? true" class="link-btn" :title="saveTitle" @click="link.save(nodeId)">{{ texts.save }}</button>
        <button class="link-btn" :title="texts.saveAsTitle" @click="link.saveAs(nodeId)">{{ texts.saveAs }}</button>
        <button class="link-btn" :title="texts.revert" @click="link.revert(nodeId)">↺</button>
      </template>
      <button v-if="!readOnly" class="link-btn" :title="texts.unlink" @click="link.unlink(nodeId)">✕</button>
    </template>
    <template v-else>
      <v-icon icon="mdi-database-off-outline" size="14" />
      <span class="model-name">{{ texts.missing }}</span>
      <span class="spacer" />
      <button v-if="!readOnly" class="link-btn" @click="link.unlink(nodeId)">{{ t('Délier', 'Unlink') }}</button>
    </template>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue';
import { t } from '../../lib/i18n';
import { LIBRARY_ID, locate } from '../../services/collections';
import { LIST_LINK_KEY, MODEL_LINK_KEY } from './shared';

/**
 * Bandeau d'un nœud relié à un élément de la bibliothèque : une source ou une cible reliée à un modèle
 * (`kind` = `model`), ou un nœud Liste de valeurs relié à une liste partagée (`kind` = `list`).
 */
const props = defineProps({
  nodeId: { type: String, required: true },
  data: { type: Object, required: true },
  kind: { type: String, default: 'model' },
  readOnly: Boolean,
});

const ICONS = { model: 'mdi-database-outline', list: 'mdi-format-list-bulleted' };
const link = inject(props.kind === 'list' ? LIST_LINK_KEY : MODEL_LINK_KEY);
const item = computed(() => link.itemOf(props.data));
const diverged = computed(() => !!item.value && link.diverged(props.data));
/** Dossiers de la bibliothèque qui contiennent l'élément (« MDM › Site client »), sans la racine. */
const folders = computed(() => {
  if (!item.value) return [];
  const path = locate(item.value.id)?.path ?? [];
  return path.filter((p) => p.id !== LIBRARY_ID).map((p) => p.name);
});
const fullName = computed(() => [...folders.value, item.value?.name].join(' › '));
/** Autres flux qui utilisent cet élément. */
const others = computed(() => (item.value ? link.otherFlows(item.value.id) : 0));

const texts = computed(() =>
  props.kind === 'list'
    ? {
        title: t('Liste de valeurs de la bibliothèque', 'Library value list'),
        changed: t('modifiée ici', 'changed here'),
        save: t('Enregistrer dans la liste', 'Save to the list'),
        saveAs: t('Nouvelle liste…', 'New list…'),
        saveAsTitle: t('Créer une nouvelle liste avec ces valeurs, reliée à ce nœud ; la liste d’origine ne change pas', 'Create a new list with these values, linked to this node; the original list does not change'),
        revert: t('Revenir aux valeurs de la liste', 'Back to the list values'),
        unlink: t('Délier de la liste (les valeurs restent, propres à ce mapping)', 'Unlink from the list (the values stay, specific to this mapping)'),
        missing: t('Liste supprimée de la bibliothèque', 'List deleted from the library'),
        target: t('la liste', 'the list'),
      }
    : {
        title: t('Modèle de la bibliothèque', 'Library model'),
        changed: t('modifié ici', 'changed here'),
        save: t('Enregistrer dans le modèle', 'Save to the model'),
        saveAs: t('Nouveau modèle…', 'New model…'),
        saveAsTitle: t('Créer un nouveau modèle avec ces champs, relié à ce nœud ; le modèle d’origine ne change pas', 'Create a new model with these fields, linked to this node; the original model does not change'),
        revert: t('Revenir aux champs du modèle', 'Back to the model fields'),
        unlink: t('Délier du modèle (les champs restent, propres à ce mapping)', 'Unlink from the model (the fields stay, specific to this mapping)'),
        missing: t('Modèle supprimé de la bibliothèque', 'Model deleted from the library'),
        target: t('le modèle', 'the model'),
      },
);

const saveTitle = computed(() =>
  others.value
    ? t(`Aussi utilisé par ${others.value} autre(s) mapping(s) : la liste des impacts s’affiche avant d’enregistrer`, `Also used by ${others.value} other mapping(s): the impacts are listed before saving`)
    : t(`Enregistrer dans ${texts.value.target} de la bibliothèque`, `Save to ${texts.value.target} of the library`),
);
</script>
