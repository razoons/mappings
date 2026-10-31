<template>
  <v-app-bar density="compact" flat border>
    <v-btn class="ml-2" prepend-icon="mdi-arrow-left" to="/">Éditeur</v-btn>
    <v-app-bar-title>Nœuds</v-app-bar-title>
    <v-text-field
      v-model="search"
      class="mr-3"
      max-width="280"
      density="compact"
      variant="solo-filled"
      flat
      hide-details
      clearable
      prepend-inner-icon="mdi-magnify"
      placeholder="Rechercher un nœud"
    />
  </v-app-bar>

  <v-main>
    <div class="help">
      <nav class="help-nav">
        <template v-for="s in sections" :key="s.name">
          <a class="nav-category" :href="`#cat-${s.name}`">{{ s.name }}</a>
          <a v-for="n in s.nodes" :key="n.kind" class="nav-node" :href="`#${n.kind}`">{{ n.label }}</a>
        </template>
      </nav>

      <div class="help-content">
        <p class="intro">
          Un nœud reçoit des valeurs par ses sockets d’entrée (à gauche) et en produit par ses sockets de sortie (à droite).
          Une entrée non reliée prend la valeur saisie dans le nœud. Tous les types peuvent être reliés : un type différent
          est converti et signalé (⚠), un type incompatible est signalé en erreur (⛔, lien rouge en pointillés).
        </p>
        <ul class="legend">
          <li><span class="swatch" :style="{ background: SOCKET_COLORS.string }" /> valeur unique</li>
          <li><span class="swatch list" :style="{ background: SOCKET_COLORS.string }" /> liste</li>
          <li><span class="per-item">∀</span> entrée évaluée pour chaque élément de la liste du nœud</li>
          <li v-for="(color, t) in SOCKET_COLORS" :key="t"><span class="swatch" :style="{ background: color }" /> {{ socketTitle(t) }}</li>
        </ul>
        <p class="intro">
          Une liste branchée sur une entrée simple applique le nœud à chaque élément (sauf pour les nœuds de liste, qui
          travaillent sur la liste entière).
        </p>

        <p v-if="!sections.length" class="text-medium-emphasis">Aucun nœud ne correspond à « {{ search }} ».</p>

        <section v-for="s in sections" :id="`cat-${s.name}`" :key="s.name">
          <h2>{{ s.name }}</h2>
          <article v-for="n in s.nodes" :id="n.kind" :key="n.kind" class="node-doc" :class="{ highlight: hash === n.kind }">
            <header :style="{ background: n.color }">
              <span>{{ n.label }}</span>
            </header>
            <div class="node-doc-body">
              <p class="summary">{{ n.summary }}</p>

              <table v-if="n.def">
                <tbody>
                  <template v-if="n.def.inputs.length">
                    <tr class="group-row"><th colspan="3">Entrées</th></tr>
                    <tr v-for="i in n.def.inputs" :key="`in-${i.id}`">
                      <td class="socket-cell">
                        <span class="swatch" :class="{ list: isList(i.type) }" :style="{ background: SOCKET_COLORS[baseOf(i.type)] }" />
                        <span v-if="i.perItem" class="per-item">∀</span>
                        {{ i.label }}
                      </td>
                      <td class="type">{{ socketTitle(i.type) }}</td>
                      <td class="note">
                        <template v-if="i.perItem">évaluée pour chaque élément</template>
                        <template v-if="i.default !== undefined"><span v-if="i.perItem"> · </span>défaut : <code>{{ i.default }}</code></template>
                      </td>
                    </tr>
                  </template>
                  <template v-if="n.def.params?.length">
                    <tr class="group-row"><th colspan="3">Réglages</th></tr>
                    <tr v-for="p in n.def.params" :key="`p-${p.id}`">
                      <td>{{ p.label }}</td>
                      <td class="type">{{ p.options ? 'Choix' : 'Saisie' }}</td>
                      <td class="note">
                        <template v-if="p.options">{{ p.options.join(' · ') }} — </template>
                        défaut : <code>{{ p.default === '' ? '(vide)' : p.default }}</code>
                      </td>
                    </tr>
                  </template>
                  <tr class="group-row"><th colspan="3">Sorties</th></tr>
                  <tr v-for="o in n.def.outputs" :key="`out-${o.id}`">
                    <td class="socket-cell">
                      <span class="swatch" :class="{ list: isList(o.type) }" :style="{ background: SOCKET_COLORS[baseOf(o.type)] }" />
                      {{ o.label }}
                    </td>
                    <td class="type">{{ socketTitle(o.type) }}</td>
                    <td />
                  </tr>
                </tbody>
              </table>

              <ul v-if="n.details?.length" class="details">
                <li v-for="(d, k) in n.details" :key="k">{{ d }}</li>
              </ul>

              <div v-if="n.example" class="example">
                <span class="label">Exemple</span>
                <code>{{ n.example.in }}</code>
                <span class="arrow">→</span>
                <code>{{ n.example.out }}</code>
              </div>

              <p v-if="n.def" class="guarantee">
                <span class="label">Contrôle des cibles</span>
                <template v-if="n.guarantee">{{ n.guarantee }}</template>
                <template v-else>
                  Pas de garantie déclarée : les champs cibles alimentés par ce nœud ne sont pas contrôlés (obligatoire, format).
                </template>
              </p>
            </div>
          </article>
        </section>
      </div>
    </div>
  </v-main>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { BASE_NODES, NODE_DOCS } from '../lib/nodeDocs';
import { CATEGORIES, TRANSFORMS } from '../lib/transforms';
import { baseOf, HEADER_COLORS, isList, SOCKET_COLORS, socketTitle } from '../lib/types';

const route = useRoute();
const search = ref('');
const hash = computed(() => route.hash.slice(1));

const all = [
  ...BASE_NODES.map((n) => ({ ...n, category: 'Modèle', color: HEADER_COLORS[n.color] })),
  ...Object.entries(TRANSFORMS).map(([kind, def]) => ({
    kind,
    def,
    label: def.label,
    category: def.category,
    color: HEADER_COLORS[def.category],
    ...NODE_DOCS[kind],
  })),
];

const normalize = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const sections = computed(() => {
  const q = normalize(search.value ?? '');
  const match = (n) => !q || normalize(`${n.label} ${n.summary ?? ''} ${n.category}`).includes(q);
  return ['Modèle', ...CATEGORIES]
    .map((name) => ({ name, nodes: all.filter((n) => n.category === name && match(n)) }))
    .filter((s) => s.nodes.length);
});

onMounted(async () => {
  await nextTick();
  if (hash.value) document.getElementById(hash.value)?.scrollIntoView({ block: 'start' });
});
</script>

<style scoped>
.help {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  height: 100%;
}
.help-nav {
  position: sticky;
  top: 48px;
  height: calc(100vh - 48px);
  overflow: auto;
  padding: 12px 8px 24px 16px;
  border-right: 1px solid var(--divider);
  font-size: 13px;
}
.help-nav a {
  display: block;
  color: inherit;
  text-decoration: none;
  padding: 2px 6px;
  border-radius: 4px;
}
.help-nav a:hover {
  background: var(--hover-overlay);
}
.nav-category {
  margin-top: 10px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}
.help-content {
  max-width: 880px;
  padding: 16px 32px 64px;
}
.intro {
  margin-bottom: 8px;
  line-height: 1.5;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  margin-bottom: 8px;
  list-style: none;
  font-size: 13px;
}
h2 {
  margin: 28px 0 10px;
  font-size: 18px;
  scroll-margin-top: 60px;
}
.node-doc {
  margin-bottom: 16px;
  border: 1px solid var(--node-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--node);
  scroll-margin-top: 60px;
}
.node-doc.highlight {
  box-shadow: 0 0 0 2px var(--primary);
}
.node-doc header {
  padding: 5px 12px;
  color: #fff;
  font-weight: 600;
}
.node-doc-body {
  padding: 10px 14px 12px;
  font-size: 13px;
  line-height: 1.5;
}
.summary {
  margin-bottom: 8px;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 8px;
}
td,
th {
  padding: 3px 8px 3px 0;
  text-align: left;
  vertical-align: top;
}
.group-row th {
  padding-top: 8px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  border-bottom: 1px solid var(--divider);
}
td:first-child {
  width: 34%;
}
td.type {
  width: 22%;
  color: var(--muted);
}
td.note {
  color: var(--muted);
}
.socket-cell {
  white-space: nowrap;
}
.swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 50%;
  vertical-align: -1px;
}
.swatch.list {
  border-radius: 1px;
  transform: rotate(45deg) scale(0.9);
}
.per-item {
  margin-right: 4px;
  color: var(--muted);
  font-weight: 700;
}
code {
  padding: 0 4px;
  border-radius: 3px;
  background: var(--code-bg);
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
}
.details {
  margin: 4px 0 8px 18px;
}
.example,
.guarantee {
  margin-top: 6px;
}
.label {
  margin-right: 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}
.arrow {
  margin: 0 6px;
  color: var(--muted);
}
</style>
