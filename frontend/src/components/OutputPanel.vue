<template>
  <v-btn v-if="!open" size="small" prepend-icon="mdi-chevron-left" @click="open = true">Aperçu</v-btn>
  <v-card v-else class="output-panel" width="360">
    <div class="d-flex">
      <v-tabs v-model="tab" density="compact" class="flex-grow-1" grow>
        <v-tab value="json">JSON</v-tab>
        <v-tab value="formulas">Formules</v-tab>
        <v-tab value="checks">
          Contrôles
          <span v-if="issues.length" class="tab-count" :class="{ error: hasErrors }">{{ issues.length }}</span>
        </v-tab>
      </v-tabs>
      <v-btn icon="mdi-chevron-right" variant="text" size="small" title="Masquer" @click="open = false" />
    </div>
    <v-divider />
    <div class="panel-content">
      <p v-if="!targets.length" class="text-medium-emphasis">Ajoutez une cible (Shift+A) pour voir le résultat.</p>
      <template v-if="tab === 'json'">
        <section v-for="t in targets" :key="t.id">
          <h4>
            {{ t.data.label }}
            <v-btn size="x-small" variant="tonal" @click="copy(jsonOf(t))">Copier</v-btn>
          </h4>
          <pre>{{ jsonOf(t) }}</pre>
        </section>
      </template>
      <template v-else-if="tab === 'checks'">
        <p v-if="targets.length && !issues.length" class="text-medium-emphasis">Aucun problème : champs obligatoires mappés, formats garantis.</p>
        <ul class="checks">
          <li v-for="(i, k) in issues" :key="k" :class="i.level">
            <span class="issue-mark">{{ i.level === 'error' ? '⛔' : '⚠' }}</span>
            <span class="font-weight-bold">{{ i.path }}</span>
            <div>{{ i.message }}</div>
          </li>
        </ul>
      </template>
      <ul v-else class="formulas">
        <li v-for="(d, i) in formulas" :key="i">
          <span class="font-weight-bold">{{ d.path }}</span>
          <span class="arrow">{{ d.iterates ? '↻ pour chaque' : '←' }}</span>
          <code v-if="d.expr">{{ d.expr }}</code>
          <span v-else class="text-medium-emphasis">non mappé</span>
        </li>
      </ul>
    </div>
  </v-card>
</template>

<script setup>
import { computed, ref } from 'vue';
import { describeTargets } from '../lib/graph';

const props = defineProps({
  nodes: { type: Array, required: true },
  edges: { type: Array, required: true },
  results: { type: Object, required: true },
});

const tab = ref('json');
const open = ref(true);
const targets = computed(() => props.nodes.filter((n) => n.type === 'target'));
const formulas = computed(() => (tab.value === 'formulas' ? describeTargets(props.nodes, props.edges) : []));

const issues = computed(() => props.results.issues.list);
const hasErrors = computed(() => issues.value.some((i) => i.level === 'error'));

const jsonOf = (t) => JSON.stringify(props.results.targets.get(t.id)?.value ?? {}, null, 2);
const copy = (text) => navigator.clipboard.writeText(text);
</script>
