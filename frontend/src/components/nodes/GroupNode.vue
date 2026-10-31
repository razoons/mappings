<template>
  <div class="group-node" :class="{ selected, collapsed: data.collapsed, colored: !!data.color }" :style="data.color && { '--group-color': data.color }">
    <div class="group-header">
      <CollapseButton :node-id="id" :collapsed="data.collapsed" />
      <input class="node-title nodrag" :disabled="readOnly" :value="data.label" @input="updateNodeData(id, { label: $event.target.value })" />
      <v-menu location="bottom" :disabled="readOnly">
        <template #activator="{ props: menu }">
          <button v-bind="menu" class="color-swatch nodrag" :disabled="readOnly" title="Couleur du groupe" />
        </template>
        <v-card class="pa-2" width="196">
          <div class="color-palette">
            <button
              v-for="c in GROUP_COLORS"
              :key="c.value"
              class="color-choice"
              :class="{ on: (data.color ?? null) === c.value }"
              :style="{ background: c.value ?? DEFAULT_GROUP_COLOR }"
              :title="c.label"
              @click="updateNodeData(id, { color: c.value })"
            />
          </div>
          <label class="color-custom">
            Autre couleur
            <input type="color" :value="data.color ?? DEFAULT_GROUP_COLOR" @input="updateNodeData(id, { color: $event.target.value })" />
          </label>
        </v-card>
      </v-menu>
      <span class="group-count">{{ count }} nœud{{ count > 1 ? 's' : '' }}</span>
      <LockButton :node-id="id" :locked="data.locked" />
    </div>
    <div v-if="!data.collapsed && count === 0" class="group-empty">Glissez des nœuds ici</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useVueFlow } from '@vue-flow/core';
import CollapseButton from './CollapseButton.vue';
import LockButton from './LockButton.vue';
import { DEFAULT_GROUP_COLOR, GROUP_COLORS } from '../../lib/groups';
import { useReadOnly } from './shared';

/**
 * Cadre qui regroupe des nœuds ; sa taille s'ajuste à eux (voir MappingEditor). Replié, il se réduit à son en-tête :
 * ses nœuds sont masqués et leurs liens aboutissent à l'en-tête (voir TypedEdge).
 */
defineOptions({ inheritAttrs: false });

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: Boolean,
});

const { updateNodeData, nodes } = useVueFlow();
const readOnly = useReadOnly(() => props.data.locked);
const count = computed(() => nodes.value.filter((n) => n.parentNode === props.id).length);
</script>
