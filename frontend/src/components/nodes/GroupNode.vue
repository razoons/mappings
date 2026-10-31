<template>
  <div class="group-node" :class="{ selected, collapsed: data.collapsed }">
    <NodeResizer v-if="!data.collapsed && !readOnly" :is-visible="selected" :min-width="220" :min-height="120" color="var(--primary)" />
    <div class="group-header">
      <CollapseButton :node-id="id" :collapsed="data.collapsed" />
      <input class="node-title nodrag" :disabled="readOnly" :value="data.label" @input="updateNodeData(id, { label: $event.target.value })" />
      <span class="group-count">{{ count }} nœud{{ count > 1 ? 's' : '' }}</span>
      <LockButton :node-id="id" :locked="data.locked" />
    </div>
    <div v-if="!data.collapsed && count === 0" class="group-empty">Glissez des nœuds ici</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useVueFlow } from '@vue-flow/core';
import { NodeResizer } from '@vue-flow/node-resizer';
import CollapseButton from './CollapseButton.vue';
import LockButton from './LockButton.vue';
import { useReadOnly } from './shared';

/**
 * Cadre redimensionnable qui regroupe des nœuds. Replié, il se réduit à son en-tête :
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
