<template>
  <!-- Replié : même gabarit que le bouton « Ajouter » placé au-dessus. -->
  <v-btn v-if="!open" class="side-block checks-collapsed text-none" block height="48" rounded="lg" elevation="4" :title="status.label" @click="open = true">
    <v-icon :icon="status.icon" :color="status.color" start />
    <span class="font-weight-bold">{{ t('Contrôles', 'Checks') }}</span>
    <span v-if="issues.length" class="tab-count ml-2" :class="{ error: errors }">{{ issues.length }}</span>
    <v-spacer />
    <v-icon icon="mdi-chevron-down" end />
  </v-btn>
  <v-card v-else class="checks-panel side-block" rounded="lg" elevation="4">
    <!-- Tout l'en-tête replie le panneau, comme le bouton replié le déplie. -->
    <div class="checks-header clickable" role="button" tabindex="0" :title="t('Replier', 'Collapse')" @click="open = false" @keydown.enter="open = false">
      <v-icon :icon="status.icon" :color="status.color" />
      <div class="flex-grow-1">
        <div class="font-weight-bold">{{ t('Contrôles', 'Checks') }}</div>
        <div class="text-caption text-medium-emphasis">{{ status.label }}</div>
      </div>
      <v-icon icon="mdi-chevron-up" class="mr-1" />
    </div>
    <v-divider />
    <div v-if="issues.length" class="checks-content">
      <ul class="checks">
        <li v-for="(i, k) in issues" :key="k" :class="i.level" :title="t('Afficher le nœud', 'Show the node')" @click="emit('focus', i.nodeId)">
          <span class="issue-mark">{{ i.level === 'error' ? '⛔' : '⚠' }}</span>
          <span class="font-weight-bold">{{ i.path }}</span>
          <div>{{ i.message }}</div>
        </li>
      </ul>
    </div>
  </v-card>
</template>

<script setup>
import { computed, ref } from 'vue';
import { count, t } from '../lib/i18n';

const props = defineProps({
  /** Problèmes relevés par `validateTargets` (`list`). */
  issues: { type: Array, required: true },
  /** Au moins une cible : sans cible, il n'y a rien à contrôler. */
  hasTargets: Boolean,
});
const emit = defineEmits(['focus']);

const open = ref(false);
const errors = computed(() => props.issues.filter((i) => i.level === 'error').length);
const warnings = computed(() => props.issues.length - errors.value);

/** Résultat global : erreur s'il y en a une, sinon avertissement, sinon conforme. */
const status = computed(() => {
  if (!props.hasTargets) return { icon: 'mdi-help-circle-outline', color: undefined, label: t('Ajoutez une cible (Shift+A) pour la contrôler', 'Add a target (Shift+A) to check it') };
  if (errors.value)
    return {
      icon: 'mdi-close-circle',
      color: 'error',
      label: [count(errors.value, 'erreur', 'error'), warnings.value && count(warnings.value, 'avertissement', 'warning')].filter(Boolean).join(', '),
    };
  if (warnings.value) return { icon: 'mdi-alert', color: 'warning', label: count(warnings.value, 'avertissement', 'warning') };
  return { icon: 'mdi-check-circle', color: 'success', label: t('Tout est conforme : champs obligatoires mappés, types et formats garantis', 'All good: required fields mapped, types and formats guaranteed') };
});
</script>
