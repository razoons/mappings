<template>
  <button
    class="icon-btn lock nodrag"
    :class="{ on: schemaLocked || locked }"
    :title="
      schemaLocked
        ? 'Schéma verrouillé : déverrouillez-le depuis les contrôles en bas à gauche'
        : locked
          ? 'Déverrouiller le nœud'
          : 'Verrouiller le nœud (position, suppression et contenu)'
    "
    :disabled="schemaLocked"
    @click="updateNodeData(nodeId, { locked: !locked })"
  >
    <LockIcon :locked="schemaLocked || locked" />
  </button>
</template>

<script setup>
import { inject } from 'vue';
import { useVueFlow } from '@vue-flow/core';
import LockIcon from '../LockIcon.vue';
import { SCHEMA_LOCK_KEY } from './shared';

/** Cadenas d'en-tête : verrouille le nœud (position, suppression, contenu). */
defineProps({
  nodeId: { type: String, required: true },
  locked: Boolean,
});

const schemaLocked = inject(SCHEMA_LOCK_KEY);
const { updateNodeData } = useVueFlow();
</script>
