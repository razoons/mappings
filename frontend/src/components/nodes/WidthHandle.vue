<template>
  <div
    v-if="!readOnly"
    class="width-handle nodrag nopan"
    :title="t('Glisser pour ajuster la largeur ; double-clic : largeur par défaut', 'Drag to adjust the width; double-click: default width')"
    @pointerdown="start"
    @dblclick.stop="updateNodeData(nodeId, { width: undefined })"
  />
</template>

<script setup>
import { useVueFlow } from '@vue-flow/core';
import { t } from '../../lib/i18n';

/**
 * Poignée au bord droit de l'en-tête d'un nœud (le reste du bord est laissé aux sockets) : on la tire pour régler
 * la largeur du nœud, gardée dans `data.width` en pixels (voir `widthStyle`) ; un double-clic rend la largeur par
 * défaut du type de nœud.
 */
const props = defineProps({
  nodeId: { type: String, required: true },
  readOnly: Boolean,
});

const MIN_WIDTH = 140;
const { updateNodeData, viewport } = useVueFlow();

function start(e) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const handle = e.currentTarget;
  const node = handle.closest('.node');
  const startX = e.clientX;
  const startWidth = node.getBoundingClientRect().width / viewport.value.zoom;
  handle.setPointerCapture(e.pointerId);
  const move = (ev) => {
    const width = Math.max(MIN_WIDTH, Math.round(startWidth + (ev.clientX - startX) / viewport.value.zoom));
    updateNodeData(props.nodeId, { width });
  };
  const end = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}
</script>
