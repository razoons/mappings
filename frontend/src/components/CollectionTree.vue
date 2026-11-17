<template>
  <template v-for="item in items" :key="item.id">
    <div
      v-if="tree.shown(item)"
      class="tree-row"
      :class="{
        active: tree.isActive(item),
        'drop-inside': tree.drop.id === item.id && tree.drop.where === 'inside',
        'drop-before': tree.drop.id === item.id && tree.drop.where === 'before',
      }"
      :style="{ paddingLeft: `${6 + depth * 14}px` }"
      :draggable="tree.renaming !== item.id"
      :title="item.name"
      @click="tree.activate(item)"
      @dblclick.stop="tree.startRename(item.id)"
      @contextmenu.prevent="menuOf = item.id"
      @dragstart="tree.dragStart($event, item)"
      @dragover="tree.dragOver($event, item)"
      @dragleave="tree.dragLeave(item)"
      @drop.prevent="tree.dropOn(item)"
      @dragend="tree.dragEnd()"
    >
      <v-icon
        v-if="isContainer(item)"
        class="chevron"
        size="18"
        :icon="tree.isOpen(item) ? 'mdi-chevron-down' : 'mdi-chevron-right'"
        @click.stop="item.open = !item.open"
      />
      <span v-else class="chevron" />
      <v-icon size="16" class="kind" :icon="item.composite ? 'mdi-database-cog-outline' : ICONS[item.type]" />
      <input
        v-if="tree.renaming === item.id"
        v-focus
        class="rename"
        :value="item.name"
        @click.stop
        @keydown.enter.prevent="tree.commitRename(item.id, $event.target.value)"
        @keydown.escape.prevent="tree.cancelRename()"
        @blur="tree.commitRename(item.id, $event.target.value)"
      />
      <span v-else class="name">{{ item.name }}</span>
      <span v-if="tree.countOf(item)" class="count" :title="tree.countOf(item).title">{{ tree.countOf(item).value }}</span>
      <v-menu :model-value="menuOf === item.id" location="end" @update:model-value="menuOf = $event ? item.id : null">
        <template #activator="{ props: menu }">
          <v-btn v-bind="menu" class="more" icon="mdi-dots-horizontal" size="x-small" variant="text" :title="t('Actions', 'Actions')" @click.stop />
        </template>
        <v-list density="compact" min-width="230">
          <v-list-item
            v-for="action in tree.actions(item)"
            :key="action.label"
            :prepend-icon="action.icon"
            :title="action.label"
            :base-color="action.danger ? 'error' : undefined"
            @click="action.run()"
          />
        </v-list>
      </v-menu>
    </div>
    <CollectionTree v-if="isContainer(item) && tree.isOpen(item)" :items="item.items" :depth="depth + 1" />
  </template>
</template>

<script setup>
import { inject, ref } from 'vue';
import { t } from '../lib/i18n';
import { isContainer, workspace } from '../services/collections';

defineProps({ items: { type: Array, required: true }, depth: { type: Number, default: 0 } });

const ICONS = { collection: 'mdi-folder-multiple-outline', folder: 'mdi-folder-outline', mapping: 'mdi-vector-polyline', model: 'mdi-database-outline', valuelist: 'mdi-format-list-bulleted' };

/** Comportement partagé par tout l'arbre (fourni par CollectionsPanel). */
const tree = inject('collection-tree');
/** Élément dont le menu d'actions est ouvert. */
const menuOf = ref(null);

const vFocus = {
  mounted: (el) => {
    el.focus();
    el.select();
  },
};
</script>
