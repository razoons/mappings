<template>
  <v-menu
    :model-value="!!at"
    :target="at ? [at.x, at.y] : undefined"
    :close-on-content-click="false"
    @update:model-value="!$event && emit('close')"
  >
    <v-card width="260">
      <v-text-field
        ref="search"
        v-model="query"
        placeholder="Rechercher un nœud…"
        density="compact"
        variant="solo-filled"
        flat
        hide-details
        autofocus
        @keydown="onKeydown"
      />
      <v-list density="compact" max-height="380" nav>
        <template v-for="(item, idx) in items" :key="item.kind">
          <v-list-subheader v-if="!query && item.category !== items[idx - 1]?.category">{{ item.category }}</v-list-subheader>
          <v-list-item :active="idx === active" color="primary" @mouseenter="active = idx" @click="emit('pick', item.kind)">
            <template #prepend>
              <span class="dot mr-3" :style="{ background: item.color }" />
            </template>
            <v-list-item-title>
              {{ item.label }}<span v-if="query" class="text-medium-emphasis"> — {{ item.category }}</span>
            </v-list-item-title>
          </v-list-item>
        </template>
        <v-list-item v-if="!items.length" class="text-medium-emphasis">Aucun résultat</v-list-item>
      </v-list>
    </v-card>
  </v-menu>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { CATEGORIES, TRANSFORMS } from '../lib/transforms';
import { HEADER_COLORS } from '../lib/types';

/** Menu d'ajout de nœud (Shift+A) ; `pick` émet `source`, `target`, `group` ou une clé de TRANSFORMS. */
const props = defineProps({
  /** Position écran `{ x, y }` ; nul = fermé. */
  at: { type: Object, default: null },
});
const emit = defineEmits(['pick', 'close']);

const ITEMS = [
  { kind: 'source', label: 'Source de données', category: 'Données', color: HEADER_COLORS.source },
  { kind: 'target', label: 'Cible de données', category: 'Données', color: HEADER_COLORS.target },
  { kind: 'group', label: 'Groupe', category: 'Organisation', color: HEADER_COLORS.group },
  ...CATEGORIES.flatMap((category) =>
    Object.entries(TRANSFORMS)
      .filter(([, def]) => def.category === category)
      .map(([kind, def]) => ({ kind, label: def.label, category, color: HEADER_COLORS[category] })),
  ),
];

const normalize = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const query = ref('');
const active = ref(0);
const search = ref(null);

const items = computed(() => {
  const q = normalize(query.value.trim());
  return q ? ITEMS.filter((i) => normalize(`${i.label} ${i.category}`).includes(q)) : ITEMS;
});

watch(query, () => (active.value = 0));
watch(
  () => props.at,
  (at) => {
    if (!at) return;
    query.value = '';
    nextTick(() => search.value?.focus());
  },
);

function onKeydown(e) {
  if (e.key === 'ArrowDown') active.value = Math.min(active.value + 1, items.value.length - 1);
  else if (e.key === 'ArrowUp') active.value = Math.max(active.value - 1, 0);
  else if (e.key === 'Enter' && items.value[active.value]) emit('pick', items.value[active.value].kind);
  else return;
  e.preventDefault();
}
</script>
