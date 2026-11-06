<template>
  <v-dialog :model-value="modelValue" max-width="680" @update:model-value="emit('update:modelValue', $event)">
    <v-card :title="title">
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-3">{{ readOnly ? t('Nœud verrouillé : consultation seule.', 'Locked node: read only.') : description }}</p>
        <v-textarea v-model="text" :readonly="readOnly" class="code-input" variant="outlined" rows="18" spellcheck="false" autofocus hide-details />
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-3">{{ error }}</v-alert>
      </v-card-text>
      <v-card-actions>
        <v-btn @click="emit('update:modelValue', false)">{{ readOnly ? t('Fermer', 'Close') : t('Annuler', 'Cancel') }}</v-btn>
        <v-spacer />
        <v-btn
          v-for="a in readOnly ? [] : actions"
          :key="a.label"
          :color="a.primary ? 'primary' : undefined"
          :variant="a.primary ? 'flat' : 'text'"
          @click="run(a)"
        >
          {{ a.label }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';
import { t } from '../lib/i18n';

const props = defineProps({
  modelValue: Boolean,
  title: { type: String, required: true },
  description: { type: String, required: true },
  initial: { type: String, required: true },
  /** `{ label, primary?, run(text, setText) }` : `run` renvoie `true` pour fermer ; une exception est affichée. */
  actions: { type: Array, required: true },
  /** Consultation seule (nœud verrouillé) : ni édition ni action. */
  readOnly: Boolean,
});
const emit = defineEmits(['update:modelValue']);

const text = ref('');
const error = ref(null);

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    text.value = props.initial;
    error.value = null;
    // Curseur et défilement en haut : le début du texte (aide, premiers champs) est visible.
    nextTick(() => {
      const ta = document.querySelector('.v-overlay--active .code-input textarea');
      if (!ta) return;
      ta.setSelectionRange(0, 0);
      ta.scrollTop = 0;
    });
  },
  { immediate: true },
);

function run(action) {
  try {
    error.value = null;
    if (action.run(text.value, (next) => (text.value = next))) emit('update:modelValue', false);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}
</script>
