<template>
  <v-menu v-model="open" :close-on-content-click="false" location="bottom start">
    <template #activator="{ props: menu }">
      <button
        v-bind="menu"
        class="rules-btn nodrag"
        :class="{ set: !!summary }"
        :title="summary ? `Format : ${summary}` : 'Règles du champ (obligatoire, format)'"
      >{{ summary || '⚙' }}</button>
    </template>

    <v-card class="rules-card" width="260" density="compact">
      <v-card-title class="text-subtitle-2">Règles — {{ field.name }}</v-card-title>
      <v-card-text>
        <v-checkbox
          :model-value="!!field.required"
          :disabled="locked"
          label="Obligatoire"
          density="compact"
          hide-details
          @update:model-value="emit('update', { required: $event })"
        />
        <template v-for="k in keys" :key="k.key">
          <v-checkbox
            v-if="k.kind === 'bool'"
            :model-value="!!format[k.key]"
            :disabled="locked"
            :label="k.label"
            density="compact"
            hide-details
            @update:model-value="set(k, $event)"
          />
          <v-text-field
            v-else
            :model-value="format[k.key] ?? ''"
            :disabled="locked"
            :label="k.label"
            :type="k.kind === 'text' ? 'text' : k.kind === 'date' ? 'date' : 'number'"
            :min="k.kind === 'int' ? 0 : undefined"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            class="mt-2"
            @update:model-value="set(k, $event)"
          />
        </template>
        <p v-if="!keys.length" class="text-caption text-medium-emphasis mt-2">Pas de format pour ce type.</p>
      </v-card-text>
    </v-card>
  </v-menu>
</template>

<script setup>
import { computed, ref } from 'vue';
import { formatKeys, formatSummary } from '../../lib/formats';

const props = defineProps({
  field: { type: Object, required: true },
  locked: Boolean,
});
const emit = defineEmits(['update']);

const open = ref(false);
const keys = computed(() => formatKeys(props.field));
const format = computed(() => props.field.format ?? {});
const summary = computed(() => formatSummary(props.field));

function set(k, raw) {
  let v = raw;
  if (k.kind === 'int' || k.kind === 'number') {
    v = raw === '' || raw == null ? undefined : Number(raw);
    if (Number.isNaN(v)) v = undefined;
    if (k.kind === 'int' && v !== undefined) v = Math.max(0, Math.trunc(v));
  }
  if (k.kind === 'text' || k.kind === 'date') v = raw || undefined;
  emit('update', { format: { ...format.value, [k.key]: v } });
}
</script>
