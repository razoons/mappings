<template>
  <button
    class="icon-btn hide-unused nodrag mdi"
    :class="on ? 'on mdi-eye-off-outline' : 'mdi-eye-outline'"
    :title="
      on
        ? t('Champs inutilisés masqués : cliquer pour tout afficher', 'Unused fields hidden: click to show all')
        : t('Masquer les champs inutilisés (sans lien, sans erreur ni avertissement)', 'Hide unused fields (no link, no error or warning)')
    "
    @click="updateNodeData(nodeId, { hideUnused: !on })"
  />
</template>

<script setup>
import { useVueFlow } from '@vue-flow/core';
import { t } from '../../lib/i18n';

/** Bouton d'en-tête d'une source ou d'une cible : masque les champs sans lien et sans problème. */
defineProps({
  nodeId: { type: String, required: true },
  on: Boolean,
});

const { updateNodeData } = useVueFlow();
</script>
