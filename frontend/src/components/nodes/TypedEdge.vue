<template>
  <BaseEdge v-if="path" :id="id" :path="path[0]" :style="style" :interaction-width="20" />
</template>

<script setup>
import { computed } from 'vue';
import { BaseEdge, getBezierPath, useVueFlow } from '@vue-flow/core';
import { getSocket } from '../../lib/graph';
import { GROUP_HEADER } from '../../lib/groups';
import { baseOf, isList, SOCKET_COLORS, typeMismatch } from '../../lib/types';

defineOptions({ inheritAttrs: false });

/**
 * Lien coloré selon le type du socket de départ, en pointillés quand il porte une liste.
 * Un nœud caché dans un groupe replié : ses liens aboutissent à l'en-tête du groupe
 * (et un lien interne au groupe disparaît).
 */
const props = defineProps({
  id: { type: String, required: true },
  sourceNode: { type: Object, required: true },
  targetNode: { type: Object, required: true },
  sourceHandleId: { type: String, default: null },
  targetHandleId: { type: String, default: null },
  sourceX: { type: Number, required: true },
  sourceY: { type: Number, required: true },
  targetX: { type: Number, required: true },
  targetY: { type: Number, required: true },
  sourcePosition: { type: String, required: true },
  targetPosition: { type: String, required: true },
});

const { findNode } = useVueFlow();

const foldedGroupOf = (node) => {
  const parent = node.parentNode && findNode(node.parentNode);
  return parent?.data.collapsed ? parent : null;
};

const path = computed(() => {
  const from = foldedGroupOf(props.sourceNode);
  const to = foldedGroupOf(props.targetNode);
  if (from && from === to) return null;
  const header = (g) => g.computedPosition.y + GROUP_HEADER / 2;
  return getBezierPath({
    sourceX: from ? from.computedPosition.x + from.dimensions.width : props.sourceX,
    sourceY: from ? header(from) : props.sourceY,
    targetX: to ? to.computedPosition.x : props.targetX,
    targetY: to ? header(to) : props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  });
});

/** Types incompatibles : lien rouge en pointillés serrés (le détail est dans les contrôles). */
const style = computed(() => {
  const type = getSocket(props.sourceNode, props.sourceHandleId, 'source')?.type ?? 'any';
  const into = getSocket(props.targetNode, props.targetHandleId, 'target')?.type;
  if (into && typeMismatch(type, into) === 'incompatible') return { stroke: 'var(--danger)', strokeWidth: 2, strokeDasharray: '2 4' };
  return { stroke: SOCKET_COLORS[baseOf(type)], strokeWidth: 2, strokeDasharray: isList(type) ? '7 4' : undefined };
});
</script>
