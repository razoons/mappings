<template>
  <v-dialog :model-value="modelValue" max-width="560" @update:model-value="emit('update:modelValue', $event)">
    <v-card :title="title">
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-3">{{ readOnly ? 'Nœud verrouillé : consultation seule.' : description }}</p>
        <v-textarea v-model="text" :readonly="readOnly" class="json-input" variant="outlined" rows="12" spellcheck="false" autofocus hide-details />
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-3">{{ error }}</v-alert>
      </v-card-text>
      <v-card-actions>
        <v-btn @click="emit('update:modelValue', false)">{{ readOnly ? 'Fermer' : 'Annuler' }}</v-btn>
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
import { ref, watch } from 'vue';

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
  },
  { immediate: true },
);

function run(action) {
  try {
    error.value = null;
    if (action.run(text.value, (t) => (text.value = t))) emit('update:modelValue', false);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}
</script>
