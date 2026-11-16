<template>
  <!-- Jamais en surimpression (pas de voile sur le schéma) : un modèle doit pouvoir être glissé jusqu'au schéma. -->
  <v-navigation-drawer :model-value="modelValue" width="300" :mobile="false" @update:model-value="$emit('update:modelValue', $event)">
    <div class="collections">
      <div class="d-flex align-center pl-1 pr-1 pt-1">
        <v-tabs v-model="tab" density="compact" class="flex-grow-1">
          <v-tab value="flows" class="text-none">{{ t('Flux', 'Flows') }}</v-tab>
          <v-tab value="models" class="text-none">{{ t('Modèles', 'Models') }}</v-tab>
        </v-tabs>
        <v-btn icon="mdi-chevron-double-left" size="small" variant="text" :title="t('Masquer le panneau', 'Hide the panel')" @click="$emit('update:modelValue', false)" />
      </div>
      <div class="d-flex align-center px-2 pt-2">
        <v-text-field
          v-model="filter"
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-magnify"
          :placeholder="t('Filtrer', 'Filter')"
          clearable
          hide-details
        />
        <template v-if="tab === 'flows'">
          <v-btn icon="mdi-plus" size="small" variant="text" :title="t('Nouvelle collection', 'New collection')" @click="newCollection" />
        </template>
        <template v-else>
          <v-btn icon="mdi-database-plus-outline" size="small" variant="text" :title="t('Nouveau modèle', 'New model')" @click="newModel(null)" />
          <v-btn icon="mdi-folder-plus-outline" size="small" variant="text" :title="t('Nouveau dossier', 'New folder')" @click="startRename(addFolder(LIBRARY_ID).id)" />
        </template>
        <v-btn icon="mdi-import" size="small" variant="text" :title="t('Importer un fichier .json : flux, collection ou modèles', 'Import a .json file: flow, collection or models')" @click="$emit('import')" />
      </div>
      <v-alert v-if="storage.error" type="warning" density="compact" variant="tonal" class="mx-3 mt-2 text-caption">
        {{ t('Les données ne peuvent plus être enregistrées dans le navigateur (espace plein ?). Exportez-les pour ne rien perdre.', 'Data can no longer be saved in the browser (storage full?). Export it so nothing is lost.') }}
      </v-alert>
      <div class="tree mt-2" @dragover.prevent @drop="dropOnRoot">
        <CollectionTree :items="roots" />
        <div v-if="!roots.length" class="text-caption text-medium-emphasis px-4 py-2">
          {{
            tab === 'models'
              ? t('Aucun modèle. Créez-en un ici, ou depuis une source ou une cible d’un flux (bouton de la bibliothèque dans son en-tête).', 'No model yet. Create one here, or from a source or target of a flow (library button in its header).')
              : t('Aucune collection.', 'No collection.')
          }}
        </div>
        <div v-else-if="filter && !roots.some(shown)" class="text-caption text-medium-emphasis px-4 py-2">
          {{ t('Aucun élément ne correspond.', 'No matching item.') }}
        </div>
      </div>
    </div>
  </v-navigation-drawer>
</template>

<script setup>
import { computed, nextTick, provide, reactive, ref } from 'vue';
import CollectionTree from './CollectionTree.vue';
import { count, t } from '../lib/i18n';
import { newField } from '../lib/fields';
import {
  addCollection,
  addFolder,
  duplicate,
  insertMapping,
  isContainer,
  leafCount,
  LIBRARY_ID,
  makeMapping,
  move,
  remove,
  rename,
  storage,
  workspace,
} from '../services/collections';
import { createModel, deleteLibraryFolder, deleteModel, MODEL_DRAG_TYPE, usageCounts, usageOf } from '../services/models';

const props = defineProps({
  modelValue: Boolean,
  /** Modèle ouvert dans l'éditeur de modèles (`null` : un flux est affiché). */
  editingModelId: { type: String, default: null },
});
/**
 * `export` / `image` / `share` : exporter l'élément `id` en fichier, en image, en lien ; `import` : importer un
 * fichier ; `edit-model` : modifier le modèle `id` ; `use-model` : `(id, 'source' | 'target')` l'ajouter au flux ouvert.
 */
const emit = defineEmits(['update:modelValue', 'export', 'image', 'share', 'import', 'edit-model', 'use-model', 'open-flow']);

const tab = ref('flows');
const roots = computed(() => (tab.value === 'models' ? workspace.library.items : workspace.collections));
/** Nombre de flux qui utilisent chaque modèle. */
const usage = computed(() => usageCounts());

const filter = ref('');
const renaming = ref(null);
/** Glisser-déposer en cours : élément saisi et emplacement visé. */
const drag = { item: null };
const drop = reactive({ id: null, where: null });

const matches = (item) => item.name.toLowerCase().includes(filter.value.trim().toLowerCase());
/** Visible quand le filtre est vide, ou que l'élément (ou l'un de ses descendants) correspond au filtre. */
const shown = (item) => !filter.value?.trim() || matches(item) || (isContainer(item) && item.items.some(shown));

function startRename(id) {
  renaming.value = null;
  nextTick(() => (renaming.value = id));
}
function commitRename(id, name) {
  if (renaming.value !== id) return;
  rename(id, name);
  renaming.value = null;
}

function newCollection() {
  startRename(addCollection().id);
}

function newModel(folderId) {
  startRename(createModel(t('Nouveau modèle', 'New model'), [newField([], 'id')], undefined, folderId).id);
}

const flowList = (uses) => uses.map((u) => `• ${[...u.path, u.mapping.name].join(' › ')}`).join('\n');

function confirmRemove(item) {
  if (item.type === 'model') {
    const uses = usageOf(item.id);
    const question = uses.length
      ? t(
          `Le modèle « ${item.name} » est utilisé par ${count(uses.length, 'flux', 'flow', 'flux', 'flows')} :\n${flowList(uses)}\n\nLe supprimer quand même ? Ses sources et cibles gardent leurs champs, mais ne sont plus reliées au modèle.`,
          `The model « ${item.name} » is used by ${count(uses.length, 'flow', 'flow')}:\n${flowList(uses)}\n\nDelete it anyway? Its sources and targets keep their fields, but are no longer linked to the model.`,
        )
      : t(`Supprimer le modèle « ${item.name} » ?`, `Delete the model « ${item.name} »?`);
    if (confirm(question)) deleteModel(item.id);
    return;
  }
  const n = isContainer(item) ? leafCount(item) : 0;
  const inLibrary = tab.value === 'models';
  const what = inLibrary ? count(n, 'modèle', 'model') : count(n, 'flux', 'flow', 'flux', 'flows');
  const question =
    item.type === 'mapping'
      ? t(`Supprimer le flux « ${item.name} » ?`, `Delete the flow « ${item.name} »?`)
      : t(
          `Supprimer « ${item.name} » et ${n ? `ses ${what}` : 'son contenu'} ? Exportez-le d’abord pour le garder.`,
          `Delete « ${item.name} » and ${n ? `its ${what}` : 'its content'}? Export it first to keep it.`,
        );
  if (!confirm(question)) return;
  if (inLibrary) deleteLibraryFolder(item.id);
  else remove(item.id);
}

function modelActions(item) {
  if (item.type === 'model') {
    return [
      { icon: 'mdi-arrow-right-bold-box-outline', label: t('Ajouter au flux ouvert comme source', 'Add to the open flow as a source'), run: () => emit('use-model', item.id, 'source') },
      { icon: 'mdi-arrow-left-bold-box-outline', label: t('Ajouter au flux ouvert comme cible', 'Add to the open flow as a target'), run: () => emit('use-model', item.id, 'target') },
      { icon: 'mdi-code-braces', label: t('Modifier le modèle', 'Edit the model'), run: () => emit('edit-model', item.id) },
      { icon: 'mdi-pencil-outline', label: t('Renommer', 'Rename'), run: () => startRename(item.id) },
      { icon: 'mdi-content-copy', label: t('Dupliquer', 'Duplicate'), run: () => duplicate(item.id) },
      { icon: 'mdi-export', label: t('Exporter le modèle (.json)', 'Export the model (.json)'), run: () => emit('export', item.id) },
      { icon: 'mdi-delete-outline', label: t('Supprimer', 'Delete'), danger: true, run: () => confirmRemove(item) },
    ];
  }
  return [
    { icon: 'mdi-database-plus-outline', label: t('Nouveau modèle', 'New model'), run: () => newModel(item.id) },
    { icon: 'mdi-folder-plus-outline', label: t('Nouveau dossier', 'New folder'), run: () => startRename(addFolder(item.id).id) },
    { icon: 'mdi-pencil-outline', label: t('Renommer', 'Rename'), run: () => startRename(item.id) },
    { icon: 'mdi-export', label: t('Exporter les modèles du dossier (.json)', 'Export the folder models (.json)'), run: () => emit('export', item.id) },
    { icon: 'mdi-delete-outline', label: t('Supprimer', 'Delete'), danger: true, run: () => confirmRemove(item) },
  ];
}

function flowActions(item) {
  const list = [];
  if (isContainer(item)) {
    list.push(
      { icon: 'mdi-vector-polyline-plus', label: t('Nouveau flux', 'New flow'), run: () => insertMapping(makeMapping(), item.id) },
      { icon: 'mdi-folder-plus-outline', label: t('Nouveau dossier', 'New folder'), run: () => startRename(addFolder(item.id).id) },
    );
  }
  list.push(
    { icon: 'mdi-pencil-outline', label: t('Renommer', 'Rename'), run: () => startRename(item.id) },
    { icon: 'mdi-content-copy', label: t('Dupliquer', 'Duplicate'), run: () => duplicate(item.id) },
    {
      icon: 'mdi-export',
      label: {
        mapping: t('Exporter le flux (.json)', 'Export the flow (.json)'),
        folder: t('Exporter le dossier en collection', 'Export the folder as a collection'),
        collection: t('Exporter la collection (.json)', 'Export the collection (.json)'),
      }[item.type],
      run: () => emit('export', item.id),
    },
    ...(item.type === 'mapping'
      ? [{ icon: 'mdi-image-outline', label: t('Exporter en image (.png)', 'Export as an image (.png)'), run: () => emit('image', item.id) }]
      : []),
    {
      icon: 'mdi-link-variant',
      label: item.type === 'mapping' ? t('Copier le lien de partage', 'Copy the share link') : t('Copier le lien de partage (tous ses flux)', 'Copy the share link (all its flows)'),
      run: () => emit('share', item.id),
    },
    { icon: 'mdi-delete-outline', label: t('Supprimer', 'Delete'), danger: true, run: () => confirmRemove(item) },
  );
  return list;
}

/** Dans l'onglet Modèles, un élément lâché sur le fond va à la racine de la bibliothèque. */
function dropOnRoot() {
  if (tab.value === 'models' && drag.item && !drop.id) move(drag.item.id, LIBRARY_ID, 'inside');
  dragEnd();
}

provide('collection-tree', {
  get renaming() {
    return renaming.value;
  },
  drop,
  shown,
  isOpen: (item) => !!filter.value?.trim() || item.open,
  /** Nombre affiché à droite : flux d'un conteneur, modèles d'un dossier de la bibliothèque, flux qui utilisent un modèle. */
  countOf(item) {
    if (item.type === 'model') {
      const n = usage.value.get(item.id) ?? 0;
      return n ? { value: n, title: t(`Utilisé par ${count(n, 'flux', 'flow', 'flux', 'flows')}`, `Used by ${count(n, 'flow', 'flow')}`) } : null;
    }
    if (isContainer(item)) return { value: leafCount(item), title: '' };
    return null;
  },
  activate(item) {
    if (isContainer(item)) item.open = !item.open;
    else if (item.type === 'model') emit('edit-model', item.id);
    else emit('open-flow', item.id);
  },
  /** Élément en surbrillance : le flux affiché, ou le modèle ouvert dans l'éditeur de modèles. */
  isActive: (item) => (props.editingModelId ? item.id === props.editingModelId : item.id === workspace.activeId),
  startRename,
  commitRename,
  cancelRename: () => (renaming.value = null),
  actions: (item) => (tab.value === 'models' ? modelActions(item) : flowActions(item)),
  dragStart(e, item) {
    drag.item = item;
    if (item.type === 'model') {
      // Un modèle se range dans la bibliothèque, ou se lâche sur le schéma pour l'ajouter au flux ouvert.
      e.dataTransfer.setData(MODEL_DRAG_TYPE, item.id);
      e.dataTransfer.effectAllowed = 'copyMove';
    } else {
      e.dataTransfer.effectAllowed = 'move';
    }
  },
  dragOver(e, item) {
    if (!drag.item || drag.item === item) return;
    // Une collection ne se range qu'entre collections.
    if (drag.item.type === 'collection' && item.type !== 'collection') return;
    e.preventDefault();
    e.stopPropagation();
    Object.assign(drop, { id: item.id, where: isContainer(item) && drag.item.type !== 'collection' ? 'inside' : 'before' });
  },
  dragLeave(item) {
    if (drop.id === item.id) Object.assign(drop, { id: null, where: null });
  },
  dropOn(item) {
    if (drag.item && drop.id === item.id) move(drag.item.id, item.id, drop.where);
    dragEnd();
  },
  dragEnd,
});

function dragEnd() {
  drag.item = null;
  Object.assign(drop, { id: null, where: null });
}
</script>

<style>
.collections {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.collections .tree {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 12px;
}
.tree-row {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding-right: 4px;
  cursor: pointer;
  user-select: none;
  font-size: 0.875rem;
  border-top: 2px solid transparent;
}
.tree-row:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.tree-row.active {
  background: rgba(var(--v-theme-primary), 0.16);
  font-weight: 600;
}
.tree-row.drop-inside {
  outline: 2px dashed rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
.tree-row.drop-before {
  border-top-color: rgb(var(--v-theme-primary));
}
.tree-row .chevron {
  width: 18px;
  flex: none;
  opacity: 0.7;
}
.tree-row .kind {
  flex: none;
  opacity: 0.8;
}
.tree-row .name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tree-row .rename {
  flex: 1;
  min-width: 0;
  font: inherit;
  color: inherit;
  padding: 1px 4px;
  border: 1px solid rgb(var(--v-theme-primary));
  border-radius: 4px;
  outline: none;
  background: rgb(var(--v-theme-surface));
}
.tree-row .count {
  font-size: 0.75rem;
  opacity: 0.6;
}
.tree-row .more {
  opacity: 0;
}
.tree-row:hover .more,
.tree-row.active .more {
  opacity: 1;
}
</style>
