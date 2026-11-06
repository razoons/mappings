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
        :placeholder="t('Rechercher un nœud…', 'Search a node…')"
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
        <v-list-item v-if="!items.length" class="text-medium-emphasis">{{ t('Aucun résultat', 'No results') }}</v-list-item>
      </v-list>
    </v-card>
  </v-menu>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { t } from '../lib/i18n';
import { CATEGORIES, categoryLabel, TRANSFORMS } from '../lib/transforms';
import { HEADER_COLORS } from '../lib/types';

/** Menu d'ajout de nœud (Shift+A) ; `pick` émet `source`, `target`, `group` ou une clé de TRANSFORMS. */
const props = defineProps({
  /** Position écran `{ x, y }` ; nul = fermé. `only` : liste des nœuds proposés (sinon tous). */
  at: { type: Object, default: null },
});
const emit = defineEmits(['pick', 'close']);

// Recalculé quand la langue change (libellés et catégories traduits).
const ITEMS = computed(() => [
  { kind: 'source', label: t('Source de données', 'Data source'), category: t('Données', 'Data'), color: HEADER_COLORS.source },
  { kind: 'target', label: t('Cible de données', 'Data target'), category: t('Données', 'Data'), color: HEADER_COLORS.target },
  { kind: 'group', label: t('Groupe', 'Group'), category: t('Organisation', 'Layout'), color: HEADER_COLORS.group },
  ...CATEGORIES.flatMap((category) =>
    Object.entries(TRANSFORMS)
      .filter(([, def]) => def.category === category)
      .map(([kind, def]) => ({ kind, label: def.label, category: categoryLabel(category), color: HEADER_COLORS[category] })),
  ),
]);

const normalize = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const query = ref('');
const active = ref(0);
const search = ref(null);

const items = computed(() => {
  const q = normalize(query.value.trim());
  const allowed = props.at?.only ? ITEMS.value.filter((i) => props.at.only.includes(i.kind)) : ITEMS.value;
  return q ? allowed.filter((i) => normalize(`${i.label} ${i.category}`).includes(q)) : allowed;
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
