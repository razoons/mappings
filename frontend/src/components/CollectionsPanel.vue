<template>
  <!-- Jamais en surimpression (pas de voile sur le schéma) : un modèle doit pouvoir être glissé jusqu'au schéma. -->
  <v-navigation-drawer :model-value="modelValue" :width="width" :mobile="false" :class="{ resizing }" @update:model-value="$emit('update:modelValue', $event)">
    <div class="panel-resize" :title="t('Glisser pour ajuster la largeur du panneau ; double-clic : largeur par défaut', 'Drag to adjust the panel width; double-click: default width')" @pointerdown="startResize" @dblclick="setWidth(DEFAULT_WIDTH)" />
    <div class="collections">
      <div class="d-flex align-center pl-1 pr-1 pt-1">
        <v-tabs v-model="tab" density="compact" class="flex-grow-1">
          <v-tab value="flows" class="text-none">{{ t('Mappings', 'Mappings') }}</v-tab>
          <v-tab value="library" class="text-none">{{ t('Bibliothèque', 'Library') }}</v-tab>
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
          <v-btn icon="mdi-folder-plus-outline" size="small" variant="text" :title="t('Nouveau dossier', 'New folder')" @click="newCollection" />
          <v-btn icon="mdi-file-plus-outline" size="small" variant="text" :title="t('Nouveau mapping, ajouté à côté de celui qui est ouvert', 'New mapping, added next to the open one')" @click="$emit('new-mapping')" />
        </template>
        <template v-else>
          <v-btn icon="mdi-database-plus-outline" size="small" variant="text" :title="t('Nouveau modèle (structure d’une source ou d’une cible)', 'New model (structure of a source or target)')" @click="newModel(null)" />
          <v-btn icon="mdi-database-cog-outline" size="small" variant="text" :title="t('Nouveau modèle composite (des modèles joints dans un schéma)', 'New composite model (models joined in a schema)')" @click="$emit('new-composite', null)" />
          <v-btn icon="mdi-playlist-plus" size="small" variant="text" :title="t('Nouvelle liste de valeurs (énumération, transcodage)', 'New value list (enumeration, transcoding)')" @click="newList(null)" />
          <v-btn icon="mdi-folder-plus-outline" size="small" variant="text" :title="t('Nouveau dossier', 'New folder')" @click="startRename(addFolder(LIBRARY_ID).id)" />
        </template>
        <v-btn icon="mdi-import" size="small" variant="text" :title="t('Importer un fichier .json : mapping, collection, export de la bibliothèque ou sauvegarde complète', 'Import a .json file: mapping, collection, library export or full backup')" @click="$emit('import')" />
        <v-btn
          v-if="tab === 'flows'"
          icon="mdi-delete-sweep-outline"
          size="small"
          variant="text"
          :disabled="!workspace.collections.length"
          :title="t('Supprimer toutes les collections (la bibliothèque est gardée)', 'Delete all collections (the library is kept)')"
          @click="$emit('clear-collections')"
        />
        <v-btn
          v-else
          icon="mdi-delete-sweep-outline"
          size="small"
          variant="text"
          :disabled="!workspace.library.items.length"
          :title="t('Vider la bibliothèque : modèles, modèles composites et listes de valeurs (les mappings gardent leurs copies)', 'Empty the library: models, composite models and value lists (mappings keep their copies)')"
          @click="$emit('clear-library')"
        />
      </div>
      <v-alert v-if="storage.error" type="warning" density="compact" variant="tonal" class="mx-3 mt-2 text-caption">
        {{ t('Les données ne peuvent plus être enregistrées dans le navigateur (espace plein ?). Exportez-les pour ne rien perdre.', 'Data can no longer be saved in the browser (storage full?). Export it so nothing is lost.') }}
      </v-alert>
      <div class="tree mt-2" @dragover.prevent @drop="dropOnRoot">
        <CollectionTree :items="roots" />
        <div v-if="!roots.length" class="text-caption text-medium-emphasis px-4 py-2">
          {{
            tab === 'library'
              ? t('Bibliothèque vide. Créez ici un modèle ou une liste de valeurs, ou enregistrez-en un depuis un mapping (bouton « base de données + » de l’en-tête d’une source, d’une cible ou d’une liste).', 'Empty library. Create a model or a value list here, or save one from a mapping (“database +” button in the header of a source, target or list).')
              : t('Aucune collection.', 'No collection.')
          }}
        </div>
        <div v-else-if="filter && !roots.some(shown)" class="text-caption text-medium-emphasis px-4 py-2">
          {{ t('Aucun élément ne correspond.', 'No matching item.') }}
        </div>
      </div>
      <div class="panel-footer">
        <v-btn class="text-none" variant="text" size="small" prepend-icon="mdi-map-legend" :title="t('Légende : types, sockets, liens, couleurs', 'Legend: types, sockets, links, colors')" @click="$emit('legend')">
          {{ t('Légende', 'Legend') }}
        </v-btn>
        <v-btn class="text-none" variant="text" size="small" prepend-icon="mdi-keyboard-outline" :title="t('Raccourcis clavier et souris (?)', 'Keyboard and mouse shortcuts (?)')" @click="$emit('shortcuts')">
          {{ t('Raccourcis', 'Shortcuts') }}
        </v-btn>
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
  makeCollection,
  makeMapping,
  move,
  remove,
  storage,
  workspace,
} from '../services/collections';
import { createModel, deleteLibraryFolder, deleteModel, MODEL_DRAG_TYPE, renameItem, usageCounts, usageOf } from '../services/models';
import { createList, deleteList, listUsage } from '../services/valueLists';
import { askConfirm } from '../services/dialogs';

const props = defineProps({
  modelValue: Boolean,
  /** Modèle ouvert dans l'éditeur de modèles (`null` : un flux est affiché). */
  editingModelId: { type: String, default: null },
});
/**
 * `export` / `image` : exporter l'élément `id` en fichier, en image ; `import` : importer un
 * fichier ; `edit-model` : modifier le modèle ou la liste `id` (un modèle composite s'ouvre comme un flux) ;
 * `new-composite` : `(dossier, mapping)`, nouveau modèle composite, vide ou copié d'un mapping ; `new-mapping` : nouveau mapping, à côté de celui qui est ouvert ; `use-model` : `(id, 'source' | 'target' | 'library')`, l'ajouter au flux ouvert.
 */
const emit = defineEmits(['update:modelValue', 'export', 'image', 'import', 'edit-model', 'use-model', 'new-composite', 'new-mapping', 'open-flow', 'legend', 'shortcuts', 'clear-collections', 'clear-library']);

// ── Largeur du panneau (poignée du bord droit), gardée dans le navigateur ──
const WIDTH_KEY = 'schemap-panel-width';
const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 220;
const maxWidth = () => Math.max(MIN_WIDTH, Math.round(window.innerWidth * 0.6));
const clampWidth = (w) => Math.min(maxWidth(), Math.max(MIN_WIDTH, Math.round(w)));
const width = ref(clampWidth(Number(localStorage.getItem(WIDTH_KEY)) || DEFAULT_WIDTH));
/** Pendant le glisser : sans animation, le panneau suit la souris. */
const resizing = ref(false);

function setWidth(w) {
  width.value = clampWidth(w);
  try {
    localStorage.setItem(WIDTH_KEY, String(width.value));
  } catch {
    /* espace plein : la largeur sera oubliée au rechargement */
  }
}

function startResize(e) {
  if (e.button !== 0) return;
  e.preventDefault();
  const handle = e.currentTarget;
  const startX = e.clientX;
  const startWidth = width.value;
  resizing.value = true;
  handle.setPointerCapture(e.pointerId);
  const move = (ev) => (width.value = clampWidth(startWidth + ev.clientX - startX));
  const end = () => {
    resizing.value = false;
    setWidth(width.value);
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

const tab = ref('flows');
const roots = computed(() => (tab.value === 'library' ? workspace.library.items : workspace.collections));
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
  renameItem(id, name);
  renaming.value = null;
}

function newCollection() {
  // Bouton « Nouveau dossier » : une collection, nommée comme un dossier.
  startRename(addCollection(makeCollection(t('Nouveau dossier', 'New folder'))).id);
}

/** Nouveau mapping dans un conteneur : il s'ouvre, et son nom se saisit tout de suite. */
function newMappingIn(containerId) {
  const mapping = makeMapping();
  emit('open-flow', null); // ferme l'éditeur de la bibliothèque s'il est ouvert
  insertMapping(mapping, containerId);
  renameMapping(mapping.id);
}

/** Lance la saisie du nom d'un mapping, dans l'onglet Mappings. */
function renameMapping(id) {
  tab.value = 'flows';
  filter.value = '';
  startRename(id);
}

defineExpose({ renameMapping });

function newModel(folderId) {
  startRename(createModel(t('Nouveau modèle', 'New model'), [newField([], 'id')], undefined, folderId).id);
}

function newList(folderId) {
  startRename(createList(t('Nouvelle liste de valeurs', 'New value list'), { item: 'string', values: [] }, folderId).id);
}

const flowNames = (uses) => uses.map((u) => [...u.path, u.mapping.name].join(' › '));

async function confirmRemove(item) {
  if (item.type === 'model' || item.type === 'valuelist') {
    const isList = item.type === 'valuelist';
    const uses = isList ? listUsage(item.id) : usageOf(item.id);
    const ok = await askConfirm({
      title: isList ? t(`Supprimer la liste « ${item.name} » ?`, `Delete the list “${item.name}”?`) : t(`Supprimer le modèle « ${item.name} » ?`, `Delete the model “${item.name}”?`),
      text: uses.length
        ? isList
          ? t(`Elle est utilisée par ${count(uses.length, 'mapping', 'mapping')} : leurs nœuds gardent leurs valeurs, mais n’y sont plus reliés.`, `It is used by ${count(uses.length, 'mapping', 'mapping')}: their nodes keep their values, but are no longer linked to it.`)
          : t(`Il est utilisé par ${count(uses.length, 'mapping', 'mapping')} : leurs sources et cibles gardent leurs champs, mais n’y sont plus reliées.`, `It is used by ${count(uses.length, 'mapping', 'mapping')}: their sources and targets keep their fields, but are no longer linked to it.`)
        : '',
      lines: flowNames(uses),
      okLabel: t('Supprimer', 'Delete'),
      danger: true,
    });
    if (!ok) return;
    if (isList) deleteList(item.id);
    else deleteModel(item.id);
    return;
  }
  const n = isContainer(item) ? leafCount(item) : 0;
  const inLibrary = tab.value === 'library';
  const what = inLibrary ? count(n, 'élément', 'item') : count(n, 'mapping', 'mapping');
  const ok = await askConfirm({
    title: item.type === 'mapping' ? t(`Supprimer le mapping « ${item.name} » ?`, `Delete the mapping “${item.name}”?`) : t(`Supprimer « ${item.name} » ?`, `Delete “${item.name}”?`),
    text:
      item.type === 'mapping'
        ? ''
        : t(`Son contenu (${n ? what : 'vide'}) est supprimé aussi. Exportez-le d’abord pour le garder.`, `Its content (${n ? what : 'empty'}) is deleted too. Export it first to keep it.`),
    okLabel: t('Supprimer', 'Delete'),
    danger: true,
  });
  if (!ok) return;
  if (inLibrary) deleteLibraryFolder(item.id);
  else remove(item.id);
}

function libraryActions(item) {
  const common = [
    { icon: 'mdi-pencil-outline', label: t('Renommer', 'Rename'), run: () => startRename(item.id) },
    { icon: 'mdi-content-copy', label: t('Dupliquer', 'Duplicate'), run: () => duplicate(item.id) },
  ];
  const remove = { icon: 'mdi-delete-outline', label: t('Supprimer', 'Delete'), danger: true, run: () => confirmRemove(item) };
  if (item.type === 'model') {
    return [
      { icon: 'mdi-arrow-right-bold-box-outline', label: t('Ajouter au mapping ouvert comme source', 'Add to the open mapping as a source'), run: () => emit('use-model', item.id, 'source') },
      { icon: 'mdi-arrow-left-bold-box-outline', label: t('Ajouter au mapping ouvert comme cible', 'Add to the open mapping as a target'), run: () => emit('use-model', item.id, 'target') },
      item.composite
        ? { icon: 'mdi-database-cog-outline', label: t('Ouvrir le schéma du modèle composite', 'Open the composite model schema'), run: () => emit('edit-model', item.id) }
        : { icon: 'mdi-pencil-ruler', label: t('Modifier le modèle', 'Edit the model'), run: () => emit('edit-model', item.id) },
      ...common,
      { icon: 'mdi-export', label: t('Exporter le modèle (.json)', 'Export the model (.json)'), run: () => emit('export', item.id) },
      remove,
    ];
  }
  if (item.type === 'valuelist') {
    return [
      { icon: 'mdi-plus-box-outline', label: t('Ajouter au mapping ouvert', 'Add to the open mapping'), run: () => emit('use-model', item.id, 'library') },
      { icon: 'mdi-pencil-ruler', label: t('Modifier la liste', 'Edit the list'), run: () => emit('edit-model', item.id) },
      ...common,
      { icon: 'mdi-export', label: t('Exporter la liste (.json)', 'Export the list (.json)'), run: () => emit('export', item.id) },
      remove,
    ];
  }
  return [
    { icon: 'mdi-database-plus-outline', label: t('Nouveau modèle', 'New model'), run: () => newModel(item.id) },
    { icon: 'mdi-database-cog-outline', label: t('Nouveau modèle composite', 'New composite model'), run: () => emit('new-composite', item.id) },
    { icon: 'mdi-playlist-plus', label: t('Nouvelle liste de valeurs', 'New value list'), run: () => newList(item.id) },
    { icon: 'mdi-folder-plus-outline', label: t('Nouveau dossier', 'New folder'), run: () => startRename(addFolder(item.id).id) },
    { icon: 'mdi-pencil-outline', label: t('Renommer', 'Rename'), run: () => startRename(item.id) },
    { icon: 'mdi-export', label: t('Exporter le dossier (.json)', 'Export the folder (.json)'), run: () => emit('export', item.id) },
    remove,
  ];
}

function flowActions(item) {
  const list = [];
  if (isContainer(item)) {
    list.push(
      { icon: 'mdi-vector-polyline-plus', label: t('Nouveau mapping', 'New mapping'), run: () => newMappingIn(item.id) },
      { icon: 'mdi-folder-plus-outline', label: t('Nouveau dossier', 'New folder'), run: () => startRename(addFolder(item.id).id) },
    );
  }
  list.push(
    { icon: 'mdi-pencil-outline', label: t('Renommer', 'Rename'), run: () => startRename(item.id) },
    { icon: 'mdi-content-copy', label: t('Dupliquer', 'Duplicate'), run: () => duplicate(item.id) },
    {
      icon: 'mdi-export',
      label: {
        mapping: t('Exporter le mapping (.json)', 'Export the mapping (.json)'),
        folder: t('Exporter le dossier en collection', 'Export the folder as a collection'),
        collection: t('Exporter la collection (.json)', 'Export the collection (.json)'),
      }[item.type],
      run: () => emit('export', item.id),
    },
    ...(item.type === 'mapping'
      ? [
          { icon: 'mdi-image-outline', label: t('Exporter en image (.png)', 'Export as an image (.png)'), run: () => emit('image', item.id) },
          { icon: 'mdi-database-cog-outline', label: t('Copier en modèle composite', 'Copy as a composite model'), run: () => emit('new-composite', null, item.id) },
        ]
      : []),
    { icon: 'mdi-delete-outline', label: t('Supprimer', 'Delete'), danger: true, run: () => confirmRemove(item) },
  );
  return list;
}

/** Dans l'onglet Bibliothèque, un élément lâché sur le fond va à la racine de la bibliothèque. */
function dropOnRoot() {
  if (tab.value === 'library' && drag.item && !drop.id) move(drag.item.id, LIBRARY_ID, 'inside');
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
    if (item.type === 'model' || item.type === 'valuelist') {
      const n = usage.value.get(item.id) ?? 0;
      return n ? { value: n, title: t(`Utilisé par ${count(n, 'mapping', 'mapping')}`, `Used by ${count(n, 'mapping', 'mapping')}`) } : null;
    }
    if (isContainer(item)) return { value: leafCount(item), title: '' };
    return null;
  },
  activate(item) {
    if (isContainer(item)) item.open = !item.open;
    else if (item.type === 'model' || item.type === 'valuelist') emit('edit-model', item.id);
    else emit('open-flow', item.id);
  },
  /** Élément en surbrillance : le flux affiché, ou le modèle ouvert dans l'éditeur de modèles. */
  isActive: (item) => (props.editingModelId ? item.id === props.editingModelId : item.id === workspace.activeId),
  startRename,
  commitRename,
  cancelRename: () => (renaming.value = null),
  actions: (item) => (tab.value === 'library' ? libraryActions(item) : flowActions(item)),
  dragStart(e, item) {
    drag.item = item;
    if (item.type === 'model' || item.type === 'valuelist') {
      // Un modèle ou une liste se range dans la bibliothèque, ou se lâche sur le schéma pour l'ajouter au flux ouvert.
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
/* Poignée du bord droit du panneau : sa largeur. */
.panel-resize {
  position: absolute;
  top: 0;
  right: -3px;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  z-index: 10;
}
.panel-resize:hover,
.resizing .panel-resize {
  background: rgba(var(--v-theme-primary), 0.35);
}
/* Pendant le glisser, le panneau et le schéma suivent la souris sans animation. */
.v-navigation-drawer.resizing,
.v-navigation-drawer.resizing ~ .v-main,
body:has(.v-navigation-drawer.resizing) .v-main {
  transition: none !important;
}
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
.collections .panel-footer {
  display: flex;
  gap: 4px;
  padding: 6px 8px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
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
