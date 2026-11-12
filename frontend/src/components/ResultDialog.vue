<template>
  <v-dialog :model-value="modelValue" max-width="720" scrollable @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon :icon="status.icon" :color="status.color" />
        {{ t('Résultat', 'Result') }} — {{ label }}
      </v-card-title>
      <v-card-subtitle>{{ sourcesLabel }}</v-card-subtitle>
      <v-card-text>
        <p class="text-body-2 mb-2">{{ status.label }}</p>
        <ul v-if="problems.length" class="checks mb-3">
          <li v-for="(p, k) in problems" :key="k" :class="p.level">
            <span class="issue-mark">{{ p.level === 'error' ? '⛔' : '⚠' }}</span>
            <span class="font-weight-bold">{{ p.path || t('(racine)', '(root)') }}</span>
            <div>{{ describeProblem(p) }}</div>
          </li>
        </ul>
        <pre class="result-json">{{ text }}</pre>
      </v-card-text>
      <v-card-actions>
        <v-btn @click="emit('update:modelValue', false)">{{ t('Fermer', 'Close') }}</v-btn>
        <v-spacer />
        <v-btn prepend-icon="mdi-content-copy" @click="copy">{{ copied ? t('Copié', 'Copied') : t('Copier', 'Copy') }}</v-btn>
        <v-btn color="primary" variant="flat" prepend-icon="mdi-export" @click="save">{{ t('Exporter', 'Export') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, ref } from 'vue';
import { checkDocument, describeProblem } from '../lib/conformity';
import { t } from '../lib/i18n';
import { exportFile } from '../services/files';
import { useLibraries } from './nodes/shared';

/** Document produit par une cible, et sa conformité au modèle de la cible. */
const props = defineProps({
  modelValue: Boolean,
  label: { type: String, required: true },
  fields: { type: Array, required: true },
  value: { type: Object, default: () => ({}) },
  /** Données utilisées : noms des fichiers chargés sur les sources (sinon les valeurs de leurs modèles de données). */
  sources: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:modelValue']);

const copied = ref(false);
const text = computed(() => JSON.stringify(props.value, null, 2));
const libraries = useLibraries();
const problems = computed(() => (props.modelValue ? checkDocument(props.fields, props.value, libraries.value) : []));

const sourcesLabel = computed(() => {
  if (!props.sources.length)
    return t(
      'Calculé avec les valeurs des modèles de données des sources (aucun fichier de données chargé).',
      'Computed with the values of the sources’ data models (no data file loaded).',
    );
  return `${t('Calculé avec :', 'Computed with:')} ${props.sources.join(', ')}.`;
});

const status = computed(() => {
  const errors = problems.value.filter((p) => p.level === 'error').length;
  if (errors) return { icon: 'mdi-close-circle', color: 'error', label: t(
        `Le résultat ne respecte pas le modèle de la cible (${errors} problème${errors > 1 ? 's' : ''}).`,
        `The result does not match the target’s model (${errors} problem${errors > 1 ? 's' : ''}).`,
      ),
    };
  if (problems.value.length) return { icon: 'mdi-alert', color: 'warning', label: t('Le résultat respecte le modèle, avec des avertissements.', 'The result matches the model, with warnings.') };
  return { icon: 'mdi-check-circle', color: 'success', label: t('Le résultat respecte le modèle de la cible.', 'The result matches the target’s model.') };
});

async function copy() {
  await navigator.clipboard.writeText(text.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}

const save = () => exportFile(text.value, `${props.label || t('resultat', 'result')}.json`, { data: true });
</script>
