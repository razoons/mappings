<template>
  <BaseEdge v-if="path" :id="id" :path="path[0]" :style="style" :interaction-width="20" />
  <!-- Extrémités saisissables (changer le point d'accroche) : simple repère, la saisie reste celle de Vue Flow. -->
  <template v-if="path && hover && !schemaLocked && !folded">
    <circle class="edge-end edge-end-source" :cx="sourceX + ANCHOR_SHIFT" :cy="sourceY" r="6" />
    <circle class="edge-end edge-end-target" :cx="targetX - ANCHOR_SHIFT" :cy="targetY" r="6" />
  </template>
  <EdgeLabelRenderer v-if="path && hover && !schemaLocked">
    <button
      class="edge-insert nodrag nopan"
      :style="{ transform: `translate(-50%, -50%) translate(${path[1]}px, ${path[2]}px)` }"
      title="Ajouter un nœud sur ce lien"
      @mouseenter="enter"
      @mouseleave="leave"
      @click.stop="insert"
    >
      +
    </button>
  </EdgeLabelRenderer>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, ref } from 'vue';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useVueFlow } from '@vue-flow/core';
import { getSocket, outputType } from '../../lib/graph';
import { GROUP_HEADER } from '../../lib/groups';
import { EDGE_INSERT_KEY, SCHEMA_LOCK_KEY } from './shared';
import { baseOf, isList, SOCKET_COLORS, typeMismatch } from '../../lib/types';

defineOptions({ inheritAttrs: false });

/**
 * Lien coloré selon le type du socket de départ, en pointillés quand il porte une liste.
 * Un nœud caché dans un groupe replié : ses liens aboutissent à l'en-tête du groupe
 * (et un lien interne au groupe disparaît). Au survol, un bouton « + » au milieu du lien permet d'y intercaler un nœud.
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

const { findNode, edges, onEdgeMouseEnter, onEdgeMouseLeave } = useVueFlow();
const schemaLocked = inject(SCHEMA_LOCK_KEY);
const insertOn = inject(EDGE_INSERT_KEY);

// Survol : le bouton reste un instant après la sortie du lien, le temps d'y amener le pointeur.
const hover = ref(false);
let hideTimer;
const enter = () => {
  clearTimeout(hideTimer);
  hover.value = true;
};
const leave = () => {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => (hover.value = false), 300);
};
const hooks = [
  onEdgeMouseEnter(({ edge }) => edge.id === props.id && enter()),
  onEdgeMouseLeave(({ edge }) => edge.id === props.id && leave()),
];
onBeforeUnmount(() => {
  clearTimeout(hideTimer);
  hooks.forEach((h) => h.off());
});

function insert(e) {
  hover.value = false;
  const r = e.currentTarget.getBoundingClientRect();
  insertOn(props.id, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
}

const foldedGroupOf = (node) => {
  const parent = node.parentNode && findNode(node.parentNode);
  return parent?.data.collapsed ? parent : null;
};

/** Centre des zones de saisie des extrémités chez Vue Flow : décalées de leur rayon (10 px) vers l'intérieur du lien. */
const ANCHOR_SHIFT = 10;
const folded = computed(() => !!(foldedGroupOf(props.sourceNode) || foldedGroupOf(props.targetNode)));

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
  // Type réel : à travers les nœuds qui transmettent leurs entrées (Valeur par défaut, Condition…).
  const incoming = (nodeId, handle) => edges.value.find((e) => e.target === nodeId && e.targetHandle === handle);
  const type = outputType(findNode, incoming, props.sourceNode.id, props.sourceHandleId) ?? 'any';
  const into = getSocket(props.targetNode, props.targetHandleId, 'target')?.type;
  // Survol du bouton « + » : le lien reste en évidence comme sous le pointeur.
  const highlight = hover.value ? { stroke: 'var(--edge-highlight)' } : {};
  if (into && typeMismatch(type, into) === 'incompatible') return { stroke: 'var(--danger)', strokeWidth: 2, strokeDasharray: '2 4', ...highlight };
  return { stroke: SOCKET_COLORS[baseOf(type)], strokeWidth: 2, strokeDasharray: isList(type) ? '7 4' : undefined, ...highlight };
});
</script>
