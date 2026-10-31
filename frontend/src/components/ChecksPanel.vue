<template>
  <v-btn v-if="!open" size="small" :title="status.label" @click="open = true">
    <v-icon :icon="status.icon" :color="status.color" start />
    Contrôles
    <span v-if="issues.length" class="tab-count ml-2" :class="{ error: errors }">{{ issues.length }}</span>
  </v-btn>
  <v-card v-else class="checks-panel" width="360">
    <div class="checks-header">
      <v-icon :icon="status.icon" :color="status.color" />
      <div class="flex-grow-1">
        <div class="font-weight-bold">Contrôles</div>
        <div class="text-caption text-medium-emphasis">{{ status.label }}</div>
      </div>
      <v-btn icon="mdi-chevron-right" variant="text" size="small" title="Masquer" @click="open = false" />
    </div>
    <v-divider />
    <div v-if="issues.length" class="checks-content">
      <ul class="checks">
        <li v-for="(i, k) in issues" :key="k" :class="i.level" title="Afficher le nœud" @click="emit('focus', i.nodeId)">
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

const props = defineProps({
  /** Problèmes relevés par `validateTargets` (`list`). */
  issues: { type: Array, required: true },
  /** Au moins une cible : sans cible, il n'y a rien à contrôler. */
  hasTargets: Boolean,
});
const emit = defineEmits(['focus']);

const open = ref(true);
const errors = computed(() => props.issues.filter((i) => i.level === 'error').length);
const warnings = computed(() => props.issues.length - errors.value);

const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** Résultat global : erreur s'il y en a une, sinon avertissement, sinon conforme. */
const status = computed(() => {
  if (!props.hasTargets) return { icon: 'mdi-help-circle-outline', color: undefined, label: 'Ajoutez une cible (Shift+A) pour la contrôler' };
  if (errors.value)
    return {
      icon: 'mdi-close-circle',
      color: 'error',
      label: [plural(errors.value, 'erreur'), warnings.value && plural(warnings.value, 'avertissement')].filter(Boolean).join(', '),
    };
  if (warnings.value) return { icon: 'mdi-alert', color: 'warning', label: plural(warnings.value, 'avertissement') };
  return { icon: 'mdi-check-circle', color: 'success', label: 'Tout est conforme : champs obligatoires mappés, types et formats garantis' };
});
</script>
