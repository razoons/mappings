<template>
  <v-menu v-model="open" :close-on-content-click="false" location="bottom start">
    <template #activator="{ props: menu }">
      <button
        v-bind="menu"
        class="rules-btn nodrag"
        :class="{ set: !!summary || !!field.description }"
        :title="buttonTitle"
      >{{ summary || (field.description ? '💬' : '⚙') }}</button>
    </template>

    <v-card class="rules-card" width="300" density="compact">
      <v-card-title class="text-subtitle-2">{{ t('Règles', 'Rules') }} — {{ field.name }}</v-card-title>
      <v-card-text>
        <v-textarea
          :model-value="field.description ?? ''"
          :disabled="locked"
          :label="t('Description', 'Description')"
          :placeholder="t('Ce que contient le champ', 'What the field holds')"
          rows="2"
          auto-grow
          density="compact"
          variant="outlined"
          hide-details
          class="mb-1"
          @change="emit('update', { description: $event.target.value })"
        />
        <v-checkbox
          :model-value="!!field.required"
          :disabled="locked"
          :label="t('Obligatoire', 'Required')"
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
          <v-select
            v-else-if="k.kind === 'library'"
            :model-value="format[k.key] ?? null"
            :items="libraryItems"
            :disabled="locked"
            :label="k.label"
            :no-data-text="t('Aucune liste de valeurs de ce type : ajoutez un nœud Liste de valeurs', 'No value list of this type: add a Value list node')"
            :hint="t('La valeur doit faire partie de la liste', 'The value must belong to the list')"
            persistent-hint
            density="compact"
            variant="outlined"
            clearable
            class="mt-2"
            @update:model-value="set(k, $event)"
          />
          <v-combobox
            v-else-if="k.kind === 'dateFormat'"
            v-model="dateFormatDraft"
            :items="dateFormatItems"
            :disabled="locked"
            :label="k.label"
            :hint="dateFormatHint"
            :error-messages="dateFormatProblem"
            persistent-hint
            density="compact"
            variant="outlined"
            clearable
            class="mt-2"
            @update:model-value="pickDateFormat(k, $event)"
            @blur="setDateFormat(k, dateFormatDraft)"
            @keydown.enter="setDateFormat(k, dateFormatDraft)"
          />
          <v-text-field
            v-else
            :model-value="format[k.key] ?? ''"
            :disabled="locked"
            :label="k.label"
            :type="k.kind === 'text' ? 'text' : k.kind === 'date' ? 'date' : k.kind === 'datetime' ? 'datetime-local' : 'number'"
            :min="k.kind === 'int' ? 0 : undefined"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            class="mt-2"
            @update:model-value="set(k, $event)"
          />
        </template>
        <p v-if="!keys.length" class="text-caption text-medium-emphasis mt-2">{{ t('Pas de format pour ce type.', 'No format for this type.') }}</p>
      </v-card-text>
    </v-card>
  </v-menu>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { DATE_FORMAT_PRESETS, dateFormatError, displayDateFormat, normalizeDateFormat } from '../../lib/dateFormats';
import { formatKeys, formatSummary } from '../../lib/formats';
import { lang, t } from '../../lib/i18n';
import { distinctLibraries, libraryName, libraryRef } from '../../lib/libraries';
import { useLibraries } from './shared';

const props = defineProps({
  field: { type: Object, required: true },
  locked: Boolean,
});
const emit = defineEmits(['update']);

const open = ref(false);
const keys = computed(() => formatKeys(props.field));
const format = computed(() => props.field.format ?? {});
const libraries = useLibraries();
const summary = computed(() => formatSummary(props.field, libraries.value));
const buttonTitle = computed(() => {
  const parts = [];
  if (props.field.description) parts.push(props.field.description);
  if (summary.value) parts.push(`Format : ${summary.value}`);
  return parts.length ? parts.join('\n') : t('Règles du champ (description, obligatoire, format)', 'Field rules (description, required, format)');
});

/** Bibliothèques proposées : celles du type du champ (une bibliothèque d'entiers convient à un nombre), plus celle déjà choisie. */
const libraryItems = computed(() => {
  const base = props.field.type === 'array' ? (props.field.item ?? 'string') : props.field.type;
  const current = format.value.library;
  const items = distinctLibraries(libraries.value)
    .filter((l) => libraries.value.get(current) === l || l.item === base || (base === 'number' && l.item === 'integer'))
    // Le choix en cours garde sa référence (id du nœud ou de la liste partagée) ; sinon, celle de la liste partagée.
    .map((l) => ({ title: `${l.label} (${l.values.length})`, value: libraries.value.get(current) === l ? current : libraryRef(l) }));
  if (current && !libraries.value.has(current)) items.push({ title: libraryName(libraries.value, current), value: current });
  return items;
});

function set(k, raw) {
  let v = raw;
  if (k.kind === 'int' || k.kind === 'integer' || k.kind === 'number') {
    v = raw === '' || raw == null ? undefined : Number(raw);
    if (Number.isNaN(v)) v = undefined;
    if (k.kind === 'integer' && v !== undefined) v = Math.trunc(v);
    if (k.kind === 'int' && v !== undefined) v = Math.max(0, Math.trunc(v));
  }
  if (k.kind === 'text' || k.kind === 'date' || k.kind === 'datetime' || k.kind === 'library') v = raw || undefined;
  emit('update', { format: { ...format.value, [k.key]: v } });
}

// ── Format de date ─────────────────────────────────────────

/** Type simple du champ (celui des éléments d'une liste). */
const scalarType = computed(() => (props.field.type === 'array' ? (props.field.item ?? 'string') : props.field.type));
const dateFormatItems = computed(() => (DATE_FORMAT_PRESETS[scalarType.value] ?? []).map(displayDateFormat));
const dateFormatHint = computed(() =>
  t('Au choix ou saisi (JJ, MM, AAAA, AA, HH, mm, ss) ; vide : ISO (AAAA-MM-JJ)', 'Pick or type one (DD, MM, YYYY, YY, HH, mm, ss); empty: ISO (YYYY-MM-DD)'),
);
/** Format en cours de saisie : enregistré quand il est choisi dans la liste, ou validé (Entrée, sortie du champ). */
const dateFormatDraft = ref(null);
/** Format saisi refusé (il n'est pas enregistré tant qu'il n'est pas utilisable). */
const dateFormatProblem = ref('');
watch(
  () => [props.field.format?.dateFormat, lang.value],
  ([f]) => (dateFormatDraft.value = displayDateFormat(f) || null),
  { immediate: true },
);

/** Choix dans la liste (ou effacement) : enregistré tout de suite ; une saisie attend sa validation. */
function pickDateFormat(k, value) {
  if (!value || dateFormatItems.value.includes(value)) setDateFormat(k, value);
}

function setDateFormat(k, raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) {
    dateFormatProblem.value = '';
    if (format.value[k.key]) set(k, undefined);
    return;
  }
  const norm = normalizeDateFormat(text, scalarType.value);
  dateFormatProblem.value = norm.error ? dateFormatError(norm.error, t) : '';
  if (!norm.error && norm.format !== format.value[k.key]) set(k, norm.format);
}
</script>
