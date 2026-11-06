<template>
  <v-app-bar density="compact" flat border>
    <v-btn class="ml-2" prepend-icon="mdi-arrow-left" to="/">{{ t('Éditeur', 'Editor') }}</v-btn>
    <v-app-bar-title class="ml-4">{{ t('Nœuds', 'Nodes') }}</v-app-bar-title>
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
      :placeholder="t('Rechercher un nœud', 'Search a node')"
    />
    <LangSwitch class="mr-2" />
  </v-app-bar>

  <v-main>
    <div class="help">
      <nav class="help-nav">
        <div class="nav-title">{{ t('Sommaire', 'Contents') }}</div>
        <a class="nav-category" href="#principes" :class="{ active: hash === 'principes' }">{{ t('Principes', 'Principles') }}</a>
        <a class="nav-category" href="#legende" :class="{ active: hash === 'legende' }">{{ t('Légende', 'Legend') }}</a>
        <div v-for="s in sections" :key="s.key" class="nav-group">
          <a class="nav-category" :class="{ active: hash === `cat-${s.key}` }" :href="`#cat-${s.key}`">
            <span class="nav-dot" :style="{ background: s.color }" />
            <span class="flex-grow-1">{{ s.name }}</span>
            <span class="nav-count">{{ s.nodes.length }}</span>
          </a>
          <div class="nav-children" :style="{ '--branch': s.color }">
            <a v-for="n in s.nodes" :key="n.kind" class="nav-node" :class="{ active: hash === n.kind }" :href="`#${n.kind}`">{{ n.label }}</a>
          </div>
        </div>
      </nav>

      <div id="principes" class="help-content">
        <h1 class="page-title">
          <img class="logo" src="/icon.svg" alt="" />
          <span>
            ScheMap
            <small>{{ t('Schématiser et contrôler vos mappings de données', 'Draw and check your data mappings') }}</small>
          </span>
        </h1>
        <h2 class="chapter">{{ t('Principes', 'Principles') }}</h2>
        <template v-if="lang === 'en'">
          <p class="intro">
            ScheMap is used to draw, exhaustively, the passage from one model to another: the mapping between two
            interfaces, two formats or two applications. The goal is to stay in control of the transformation: each
            field of the target shows where its value comes from and which steps it went through, with no blind spot.
          </p>
          <p class="intro">
            The overall transformation is built as a chain of nodes. On the left, the <strong>sources</strong> describe
            the data received; on the right, the <strong>targets</strong> describe the expected data; in between,
            <strong>intermediate nodes</strong> clean, combine, compute or look up the values. Each node does one simple
            thing, and their sequence forms the complete transformation.
          </p>
          <p class="intro">
            The schema is more than a drawing: you can import one or more source examples to run the model, follow the
            values computed at each step and check the result obtained in the target. Once ready, the schema can be
            exported as a model, to be reused or shared, or as an image, for documentation.
          </p>
          <p class="intro">
            This approach is largely inspired by the node editor of <strong>Blender</strong>, the 3D creation software:
            the same sockets colored by type, the same links drawn from one node to another, the same way of building a
            complex result from simple bricks.
          </p>
          <h3 class="sub-chapter">Reading a node</h3>
          <p class="intro">
            A node receives values through its input sockets (on the left) and produces some through its output sockets
            (on the right). An unlinked input takes the value typed in the node. Any types can be linked: a different type
            is converted and reported (⚠), an incompatible type is reported as an error (⛔, red dotted link).
          </p>
          <p class="intro">
            A list plugged into a simple input applies the node to each item (except for list nodes, which work on the
            whole list).
          </p>
        </template>
        <template v-else>
        <p class="intro">
          ScheMap sert à schématiser, de manière exhaustive, le passage d’un modèle à un autre : le mapping entre
          deux interfaces, deux formats ou deux applications. L’objectif est de rester en contrôle de la transformation
          effectuée : chaque champ de la cible montre d’où vient sa valeur et par quelles étapes elle est passée, sans
          zone d’ombre.
        </p>
        <p class="intro">
          La transformation globale est construite comme une chaîne de nœuds. À gauche, les <strong>sources</strong>
          décrivent les données reçues ; à droite, les <strong>cibles</strong> décrivent les données attendues ; entre
          les deux, des <strong>nœuds intermédiaires</strong> nettoient, combinent, calculent ou recherchent les valeurs.
          Chaque nœud fait une seule chose simple, et c’est leur enchaînement qui forme la transformation complète.
        </p>
        <p class="intro">
          Le schéma n’est pas qu’un dessin : on peut importer un ou plusieurs exemples de sources pour exécuter le
          modèle, suivre les valeurs calculées à chaque étape et vérifier le résultat obtenu dans la cible. Une fois au
          point, le schéma s’exporte comme modèle, pour être repris ou partagé, ou comme image, pour la documentation.
        </p>
        <p class="intro">
          Cette approche est très largement inspirée de l’éditeur de nœuds de <strong>Blender</strong>, le logiciel
          de création 3D : mêmes sockets colorés selon le type, mêmes liens que l’on tire d’un nœud à l’autre, même
          façon de construire un résultat complexe à partir de briques simples.
        </p>
        <h3 class="sub-chapter">Lire un nœud</h3>
        <p class="intro">
          Un nœud reçoit des valeurs par ses sockets d’entrée (à gauche) et en produit par ses sockets de sortie (à droite).
          Une entrée non reliée prend la valeur saisie dans le nœud. Tous les types peuvent être reliés : un type différent
          est converti et signalé (⚠), un type incompatible est signalé en erreur (⛔, lien rouge en pointillés).
        </p>
        <p class="intro">
          Une liste branchée sur une entrée simple applique le nœud à chaque élément (sauf pour les nœuds de liste, qui
          travaillent sur la liste entière).
        </p>
        </template>

        <section id="legende" class="legend-chapter">
          <h2 class="chapter">{{ t('Légende', 'Legend') }}</h2>

          <LegendGrid />
        </section>

        <p v-if="!sections.length" class="text-medium-emphasis">{{ t('Aucun nœud ne correspond à', 'No node matches') }} « {{ search }} ».</p>

        <section v-for="s in sections" :id="`cat-${s.key}`" :key="s.key">
          <h2 class="chapter" :style="{ '--chapter': s.color }">
            <span class="chapter-dot" />
            {{ s.name }}
            <span class="chapter-count">{{ count(s.nodes.length, 'nœud', 'node') }}</span>
          </h2>
          <article v-for="n in s.nodes" :id="n.kind" :key="n.kind" class="node-doc" :class="{ highlight: hash === n.kind }">
            <header :style="{ background: n.color }">
              <span>{{ n.label }}</span>
            </header>
            <div class="node-doc-body">
              <p class="summary">{{ n.summary }}</p>

              <table v-if="n.def">
                <tbody>
                  <template v-if="n.def.inputs.length">
                    <tr class="group-row"><th colspan="3">{{ t('Entrées', 'Inputs') }}</th></tr>
                    <tr v-for="i in n.def.inputs" :key="`in-${i.id}`">
                      <td class="socket-cell">
                        <span class="swatch" :class="{ list: isList(i.type) }" :style="{ background: SOCKET_COLORS[baseOf(i.type)] }" />
                        <span v-if="i.perItem" class="per-item">∀</span>
                        {{ i.label }}
                      </td>
                      <td class="type">{{ socketTitle(i.type) }}</td>
                      <td class="note">
                        <template v-if="i.perItem">{{ t('évaluée pour chaque élément', 'evaluated for each item') }}</template>
                        <template v-if="i.default !== undefined"><span v-if="i.perItem"> · </span>{{ t('défaut :', 'default:') }} <code>{{ i.default }}</code></template>
                      </td>
                    </tr>
                  </template>
                  <template v-if="n.def.params?.length">
                    <tr class="group-row"><th colspan="3">{{ t('Réglages', 'Settings') }}</th></tr>
                    <tr v-for="p in n.def.params" :key="`p-${p.id}`">
                      <td>{{ p.label }}</td>
                      <td class="type">{{ p.options ? t('Choix', 'Choice') : t('Saisie', 'Input') }}</td>
                      <td class="note">
                        <template v-if="p.options">{{ p.options.map((o) => p.optionLabel(o, {})).join(' · ') }} — </template>
                        {{ t('défaut :', 'default:') }}
                        <code>{{ p.default === '' ? t('(vide)', '(empty)') : p.optionLabel ? p.optionLabel(p.default, {}) : p.default }}</code>
                      </td>
                    </tr>
                  </template>
                  <tr class="group-row"><th colspan="3">{{ t('Sorties', 'Outputs') }}</th></tr>
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

              <template v-if="n.preview">
                <span class="label">{{ t('Exemple', 'Example') }}</span>
                <NodePreview :def="n.def" :example="n.preview" />
              </template>

              <p v-if="n.def" class="guarantee">
                <span class="label">{{ t('Contrôle des cibles', 'Target checks') }}</span>
                <template v-if="n.guarantee">{{ n.guarantee }}</template>
                <template v-else>
                  {{
                    t(
                      'Pas de garantie déclarée : les champs cibles alimentés par ce nœud ne sont pas contrôlés (obligatoire, format).',
                      'No declared guarantee: the target fields fed by this node are not checked (required, format).',
                    )
                  }}
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
import LangSwitch from '../components/LangSwitch.vue';
import LegendGrid from '../components/LegendGrid.vue';
import NodePreview from '../components/NodePreview.vue';
import { count, lang, t } from '../lib/i18n';
import { BASE_NODES, NODE_DOCS } from '../lib/nodeDocs';
import { NODE_DOCS_EN } from '../lib/nodeDocsEn';
import { NODE_PREVIEWS } from '../lib/nodePreviews';
import { CATEGORIES, categoryLabel, TRANSFORMS } from '../lib/transforms';
import { baseOf, HEADER_COLORS, isList, SOCKET_COLORS, socketTitle } from '../lib/types';

const route = useRoute();
const search = ref('');
const hash = computed(() => route.hash.slice(1));

/** Textes de la doc dans la langue de l'interface (le français si l'anglais manque). */
const docOf = (kind) => (lang.value === 'en' ? NODE_DOCS_EN[kind] : undefined) ?? {};

const all = computed(() => [
  ...BASE_NODES.map((n) => ({ ...n, category: 'Modèle', color: HEADER_COLORS[n.color], ...docOf(n.kind) })),
  ...Object.entries(TRANSFORMS).map(([kind, def]) => ({
    kind,
    def,
    label: def.label,
    category: def.category,
    color: HEADER_COLORS[def.category],
    ...NODE_DOCS[kind],
    ...docOf(kind),
    preview: NODE_PREVIEWS[kind],
  })),
]);

const categoryName = (c) => (c === 'Modèle' ? t('Modèle', 'Model') : categoryLabel(c));
const normalize = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const sections = computed(() => {
  const q = normalize(search.value ?? '');
  const match = (n) => !q || normalize(`${n.label} ${n.summary ?? ''} ${categoryName(n.category)}`).includes(q);
  // `key` (français) sert aux ancres des liens, `name` est affiché.
  return ['Modèle', ...CATEGORIES]
    .map((key) => ({
      key,
      name: categoryName(key),
      color: key === 'Modèle' ? HEADER_COLORS.source : HEADER_COLORS[key],
      nodes: all.value.filter((n) => n.category === key && match(n)),
    }))
    .filter((s) => s.nodes.length);
});

onMounted(async () => {
  await nextTick();
  if (hash.value) document.getElementById(hash.value)?.scrollIntoView({ block: 'start' });
});
</script>

<style scoped>
/* Titre de la page : le logo et le nom du site. */
.page-title {
  display: flex;
  align-items: center;
  gap: 18px;
  margin: 16px 0 8px;
  font-size: 40px;
  font-weight: 800;
  line-height: 1.1;
}
.page-title small {
  display: block;
  margin-top: 4px;
  font-size: 15px;
  font-weight: 400;
  color: var(--muted);
}
.logo {
  flex: none;
  width: auto;
  height: 96px;
}
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
  padding: 3px 8px;
  border-radius: 4px;
}
.help-nav a:hover {
  background: var(--hover-overlay);
}
.help-nav a.active {
  color: var(--primary);
  font-weight: 600;
}
.nav-title {
  padding: 0 8px 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}
.nav-group {
  margin-top: 8px;
}
/* Catégorie : pastille de sa couleur, nom et nombre de nœuds. */
.nav-category {
  display: flex !important;
  align-items: center;
  gap: 8px;
  font-weight: 700;
}
.nav-dot {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 2px;
}
.nav-count {
  font-size: 11px;
  font-weight: 400;
  color: var(--muted);
}
/* Nœuds de la catégorie : en retrait, sous un filet à la couleur de la catégorie. */
.nav-children {
  margin: 2px 0 4px 12px;
  padding-left: 8px;
  border-left: 2px solid color-mix(in srgb, var(--branch) 45%, transparent);
}
.nav-node {
  color: color-mix(in srgb, var(--text) 80%, transparent) !important;
}
.nav-node.active {
  color: var(--primary) !important;
  background: color-mix(in srgb, var(--primary) 12%, transparent);
}
.help-content {
  scroll-margin-top: 60px;
  max-width: 880px;
  padding: 16px 32px 64px;
}
.intro {
  margin-bottom: 8px;
  line-height: 1.5;
}
.sub-chapter {
  margin: 20px 0 8px;
  font-size: 16px;
  font-weight: 700;
}
/* ── Légende ── */
.legend-chapter {
  scroll-margin-top: 60px;
}
/* Chapitre (catégorie) : grand titre souligné à la couleur de la catégorie. */
.chapter {
  --chapter: var(--muted);
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 48px 0 16px;
  padding-bottom: 8px;
  border-bottom: 3px solid var(--chapter);
  font-size: 24px;
  font-weight: 700;
  scroll-margin-top: 60px;
}
.help-content > .chapter:first-child {
  margin-top: 8px;
}
.chapter-dot {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: var(--chapter);
}
.chapter-count {
  margin-left: auto;
  font-size: 13px;
  font-weight: 400;
  color: var(--muted);
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
</style>
