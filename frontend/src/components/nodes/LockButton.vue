<template>
  <button
    class="icon-btn lock nodrag"
    :class="{ on: schemaLocked || locked }"
    :title="
      schemaLocked
        ? t('Schéma verrouillé : déverrouillez-le depuis les contrôles en bas à gauche', 'Schema locked: unlock it from the controls at the bottom left')
        : locked
          ? t('Déverrouiller le nœud', 'Unlock the node')
          : t('Verrouiller le nœud (position, suppression et contenu)', 'Lock the node (position, deletion and content)')
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
import { t } from '../../lib/i18n';
import { SCHEMA_LOCK_KEY } from './shared';

/** Cadenas d'en-tête : verrouille le nœud (position, suppression, contenu). */
defineProps({
  nodeId: { type: String, required: true },
  locked: Boolean,
});

const schemaLocked = inject(SCHEMA_LOCK_KEY);
const { updateNodeData } = useVueFlow();
</script>
