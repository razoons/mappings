<template>
  <button
    class="chevron nodrag"
    :class="{ collapsed }"
    :title="collapsed ? 'Déplier le nœud' : 'Replier le nœud'"
    @click="setCollapsed(!collapsed)"
  >
    <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
      <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>

<script setup>
import { useCollapse } from './shared';

const props = defineProps({
  nodeId: { type: String, required: true },
  collapsed: Boolean,
});

const setCollapsed = useCollapse(props.nodeId);
</script>
