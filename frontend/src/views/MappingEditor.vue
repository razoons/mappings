<template>
  <v-app-bar density="compact" flat border>
    <v-text-field
      v-model="current.name"
      class="ml-3 flex-grow-0"
      width="220"
      density="compact"
      variant="solo-filled"
      flat
      hide-details
      placeholder="Sans titre"
      title="Nom du mapping (nom proposé à l’export et dans les liens de partage)"
    />
    <v-divider vertical inset class="mx-2" />
    <v-btn prepend-icon="mdi-file-outline" :disabled="schemaLocked" @click="newMapping">Nouveau</v-btn>
    <v-btn prepend-icon="mdi-folder-open-outline" title="Ouvrir un fichier (Ctrl O)" :disabled="schemaLocked" @click="open">
      Ouvrir
    </v-btn>
    <v-menu>
      <template #activator="{ props: menu }">
        <v-btn v-bind="menu" prepend-icon="mdi-export" append-icon="mdi-menu-down">Exporter</v-btn>
      </template>
      <v-list density="compact">
        <v-list-item prepend-icon="mdi-code-json" title="Mapping (.json)" subtitle="Pour le rouvrir ou le partager" @click="exportMapping">
          <template #append><kbd>Ctrl S</kbd></template>
        </v-list-item>
        <v-list-item prepend-icon="mdi-image-outline" title="Image du schéma (.png)" subtitle="Tout le schéma, sur le fond du thème" @click="exportImage" />
      </v-list>
    </v-menu>
    <v-btn prepend-icon="mdi-share-variant" title="Copier un lien qui ouvre ce schéma" @click="shareMapping">Partager</v-btn>
    <v-btn prepend-icon="mdi-school-outline" :disabled="schemaLocked" @click="loadDemo">Démo</v-btn>
    <v-divider vertical inset class="mx-2" />
    <v-btn icon="mdi-arrow-collapse-vertical" title="Tout replier" @click="collapseAll(true)" />
    <v-btn icon="mdi-arrow-expand-vertical" title="Tout déplier" @click="collapseAll(false)" />
    <v-btn icon="mdi-graph-outline" title="Réorganiser le schéma (colonnes dans le sens des liens)" :disabled="schemaLocked" @click="arrangeSchema" />
    <v-spacer />
    <v-btn prepend-icon="mdi-map-legend" title="Légende : types, sockets, liens, couleurs" @click="legendOpen = true">Légende</v-btn>
    <v-btn prepend-icon="mdi-help-circle-outline" href="/noeuds" target="_blank" title="Documentation des nœuds (nouvel onglet)">Nœuds</v-btn>
    <v-btn :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'" title="Changer de thème" @click="toggleTheme" />
  </v-app-bar>

  <v-main>
    <div class="editor" @mousemove="mouse = { x: $event.clientX, y: $event.clientY }">
      <VueFlow
        :id="FLOW_ID"
        :node-types="nodeTypes"
        :edge-types="edgeTypes"
        :is-valid-connection="isValidConnection"
        :nodes-draggable="!schemaLocked"
        :nodes-connectable="!schemaLocked"
        :edges-updatable="!schemaLocked"
        :delete-key-code="null"
        :min-zoom="0.2"
        @pane-context-menu="onPaneContextMenu"
        @node-drag-start="dragging = true"
        @node-drag="onNodeDrag"
        @node-drag-stop="onNodeDragStop"
      >
        <Background variant="lines" :gap="24" color="var(--grid)" />
        <Controls :show-interactive="false">
          <ControlButton
            class="schema-lock"
            :class="{ on: schemaLocked }"
            :title="schemaLocked ? 'Déverrouiller le schéma' : 'Verrouiller tout le schéma (positions, liens et valeurs)'"
            @click="schemaLocked = !schemaLocked"
          >
            <LockIcon :locked="schemaLocked" />
          </ControlButton>
        </Controls>
        <Panel position="top-right" class="side-panel">
          <!-- Bouton flottant d'ajout, au-dessus du panneau des contrôles. -->
          <v-btn
            class="add-fab side-block text-none"
            color="primary"
            block
            height="48"
            rounded="lg"
            elevation="4"
            prepend-icon="mdi-plus"
            :disabled="schemaLocked"
            title="Ajouter un nœud (Shift A, ou clic droit sur le fond)"
            @click="openAddMenuBelow"
          >
            Ajouter <kbd>Shift A</kbd>
          </v-btn>
          <ChecksPanel :issues="results.issues.list" :has-targets="nodes.some((n) => n.type === 'target')" @focus="focusNode" />
        </Panel>
      </VueFlow>
    </div>

    <AddMenu :at="addMenu" @pick="pick" @close="addMenu = null" />

    <v-menu
      :model-value="!!nodeMenu"
      :target="nodeMenu ? [nodeMenu.x, nodeMenu.y] : undefined"
      @update:model-value="!$event && (nodeMenu = null)"
    >
      <v-list density="compact" min-width="220">
        <v-list-subheader v-if="nodeMenu?.ids.length > 1">{{ nodeMenu.ids.length }} nœuds</v-list-subheader>
        <v-list-item
          v-for="entry in nodeMenuEntries"
          :key="entry.label"
          :title="entry.label"
          :base-color="entry.danger ? 'error' : undefined"
          :disabled="entry.disabled"
          @click="entry.action()"
        >
          <template v-if="entry.hint" #append><kbd>{{ entry.hint }}</kbd></template>
        </v-list-item>
      </v-list>
    </v-menu>

    <v-dialog v-model="legendOpen" max-width="980" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center">
          Légende
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" size="small" title="Fermer" @click="legendOpen = false" />
        </v-card-title>
        <v-card-text><LegendGrid link-base="/noeuds" /></v-card-text>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snack.show" :color="snack.color" :timeout="snack.action ? 5000 : snack.color === 'error' ? 3500 : 1800">
      {{ snack.text }}
      <template v-if="snack.action" #actions>
        <v-btn variant="text" @click="snack.action.run(), (snack.show = false)">{{ snack.action.label }}</v-btn>
      </template>
    </v-snackbar>
  </v-main>
</template>

<script setup>
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue';
import { useTheme } from 'vuetify';
import { Panel, VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { ControlButton, Controls } from '@vue-flow/controls';
import AddMenu from '../components/AddMenu.vue';
import LegendGrid from '../components/LegendGrid.vue';
import LockIcon from '../components/LockIcon.vue';
import ChecksPanel from '../components/ChecksPanel.vue';
import SourceNode from '../components/nodes/SourceNode.vue';
import TargetNode from '../components/nodes/TargetNode.vue';
import TransformNode from '../components/nodes/TransformNode.vue';
import GroupNode from '../components/nodes/GroupNode.vue';
import TypedEdge from '../components/nodes/TypedEdge.vue';
import { DATA_FILES_KEY, EDGE_INSERT_KEY, RESULTS_KEY, SCHEMA_LOCK_KEY } from '../components/nodes/shared';
import { checkDocument, describeProblem } from '../lib/conformity';
import { demoGraph } from '../lib/demo';
import { fieldFromSocket, migrateFields, parseDocument, newField, setTreeCollapsed } from '../lib/fields';
import { autoLayout } from '../lib/layout';
import { fitGroup, groupAround, groupAt, groupsFirst, isGroup, newGroup, removeKeepingChildren, reparent } from '../lib/groups';
import { createsCycle, evaluateGraph, getSocket } from '../lib/graph';
import { validateTargets } from '../lib/rules';
import { inputsOf, TRANSFORMS } from '../lib/transforms';
import { canConnect, isList, typeMismatch, uid } from '../lib/types';
import { exportFile, openFile } from '../services/files';
import { schemaImage } from '../services/image';
import { clearSharedGraph, shareLink, sharedGraph } from '../services/share';

const FLOW_ID = 'mapping';
const STORAGE_KEY = 'mapping-current';
const THEME_KEY = 'mapping-theme';
const SCHEMA_LOCKED_KEY = 'mapping-schema-locked';

const nodeTypes = {
  source: markRaw(SourceNode),
  target: markRaw(TargetNode),
  transform: markRaw(TransformNode),
  group: markRaw(GroupNode),
};
const edgeTypes = { typed: markRaw(TypedEdge) };

const {
  nodes,
  edges,
  setNodes,
  setEdges,
  addNodes,
  removeNodes,
  addEdges,
  removeEdges,
  updateEdge,
  updateNode,
  updateNodeData,
  updateNodeInternals,
  findNode,
  project,
  vueFlowRef,
  fitView,
  onConnect,
  onConnectStart,
  onConnectEnd,
  onEdgeUpdateStart,
  onEdgeUpdate,
  onEdgeUpdateEnd,
  onNodeContextMenu,
  onNodesInitialized,
} = useVueFlow(FLOW_ID);

// ── Thème ───────────────────────────────────────────────────

const theme = useTheme();
const isDark = computed(() => theme.global.current.value.dark);
function toggleTheme() {
  theme.global.name.value = isDark.value ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme.global.name.value);
}

// ── Verrouillage ────────────────────────────────────────────

/** Schéma verrouillé : ni ajout, ni déplacement, ni lien, ni modification des nœuds (le repli reste possible). */
const schemaLocked = ref(localStorage.getItem(SCHEMA_LOCKED_KEY) === '1');
provide(SCHEMA_LOCK_KEY, schemaLocked);
watch(schemaLocked, (locked) => {
  localStorage.setItem(SCHEMA_LOCKED_KEY, locked ? '1' : '0');
  if (locked) addMenu.value = null;
});

/** Groupe survolé pendant un glisser-déposer de nœuds. */
const dropGroup = ref(null);
/** Copies en cours de placement (voir « Dupliquer ») : `{ ids, tops: [{ id, dx, dy }] }`. */
const placing = ref(null);

// Propriétés d'affichage dérivées des données :
// - nœud verrouillé : ni déplaçable, ni supprimable (`undefined` laisse jouer le réglage global du schéma) ;
// - groupe replié : réduit à son en-tête, ses nœuds masqués et leurs liens non déplaçables (ils aboutissent à l'en-tête).
watch(
  () => [
    dropGroup.value,
    placing.value?.ids.join(','),
    nodes.value.map((n) => `${n.id}:${!!n.data.locked}:${!!n.data.collapsed}:${n.parentNode ?? ''}`).join('|'),
    edges.value.map((e) => e.id).join('|'),
  ],
  () => {
    const folded = new Set(nodes.value.filter((n) => isGroup(n) && n.data.collapsed).map((n) => n.id));
    for (const n of nodes.value) {
      const masked = folded.has(n.parentNode);
      n.draggable = n.data.locked || masked ? false : undefined;
      n.selectable = masked ? false : undefined;
      if (masked) n.selected = false;
      const moving = !!placing.value?.ids.includes(n.id);
      n.class = isGroup(n) ? { folded: !!n.data.collapsed, 'drop-target': dropGroup.value === n.id, placing: moving } : { masked, placing: moving };
    }
    const maskedNode = (id) => folded.has(findNode(id)?.parentNode);
    for (const e of edges.value) e.updatable = maskedNode(e.source) || maskedNode(e.target) ? false : undefined;
  },
  { immediate: true },
);

// ── Chargement et export ────────────────────────────────────

/** Nom du mapping (champ de la barre d'outils) : nom de fichier proposé à l'export, repris par les liens de partage. */
const current = reactive({ name: 'Sans titre' });
const legendOpen = ref(false);
const snack = reactive({ show: false, text: '', color: undefined, action: null });
/** Message en bas de l'écran ; `action` : bouton `{ label, run }` (ex. annuler). */
const notify = (text, color, action = null) => Object.assign(snack, { show: true, text, color, action });

/** Copie simple des nœuds (le groupe d'un nœud dans `parentNode`, la taille d'un groupe dans `style`). */
const plainNodes = () =>
  nodes.value.map(({ id, type, position, data, parentNode, style, selected }) => ({
    id,
    type,
    position: { x: position.x, y: position.y },
    data,
    parentNode,
    ...(type === 'group' && { style: { width: style?.width, height: style?.height } }),
    selected,
  }));

const serialize = () => ({
  nodes: plainNodes().map(({ selected: _, ...n }) => n),
  edges: edges.value.map(({ id, source, sourceHandle, target, targetHandle }) => ({ id, source, sourceHandle, target, targetHandle })),
});

/** Restructure les nœuds (groupes, suppression…) à partir de leur copie simple. */
const rebuild = (fn) => setNodes(groupsFirst(fn(plainNodes())));
const measuredSizes = () => new Map(nodes.value.map((n) => [n.id, { w: n.dimensions.width, h: n.dimensions.height }]));

let fitPending = false;
function load(graph) {
  const copy = JSON.parse(JSON.stringify(graph));
  for (const n of copy.nodes) if (n.data?.fields) n.data.fields = migrateFields(n.data.fields);
  setNodes(groupsFirst(copy.nodes));
  setEdges(copy.edges.map((e) => ({ ...e, type: 'typed' })));
  fitPending = true;
}
onNodesInitialized(() => {
  if (!fitPending) return;
  fitPending = false;
  fitView({ padding: 0.15 });
});

/** Reprend le mapping enregistré dans le navigateur ; sans sauvegarde, l’éditeur reste vide. */
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.graph) {
      current.name = saved.name;
      return load(saved.graph);
    }
  } catch {
    /* sauvegarde corrompue : on repart d’un mapping vide */
  }
}

// Brouillon local, écrit après chaque modification (avec un léger délai pendant les déplacements).
let saveTimer;
watch(
  [nodes, edges, current],
  () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, graph: serialize() })), 300);
  },
  { deep: true },
);

// ── Historique (Ctrl+Z / Ctrl+Y) ────────────────────────────
// Un instantané (JSON du mapping) par modification, pris une fois l'action terminée (après un court délai, jamais
// au milieu d'un déplacement) ; l'interface (sélection, zoom) n'en fait pas partie.
const HISTORY_SIZE = 20;
const history = { past: [], future: [], present: null, settling: false };
let historyTimer;

function record() {
  clearTimeout(historyTimer);
  if (placing.value || nodes.value.some((n) => n.dragging)) return (historyTimer = setTimeout(record, 400));
  const s = JSON.stringify({ name: current.name, ...serialize() });
  // Juste après un retour en arrière, les ajustements automatiques (taille des groupes…) ne sont pas une action.
  if (history.settling || history.present === null) return Object.assign(history, { present: s, settling: false });
  if (s === history.present) return;
  history.past.push(history.present);
  if (history.past.length > HISTORY_SIZE) history.past.shift();
  history.present = s;
  history.future = [];
}
watch([nodes, edges, current], () => {
  clearTimeout(historyTimer);
  historyTimer = setTimeout(record, 400);
}, { deep: true });

function travel(from, to) {
  record(); // une modification encore en attente compte comme la dernière action
  if (!from.length) return;
  to.push(history.present);
  const s = from.pop();
  const { name, nodes: ns, edges: es } = JSON.parse(s);
  Object.assign(history, { present: s, settling: true });
  current.name = name;
  setNodes(groupsFirst(ns));
  setEdges(es.map((e) => ({ ...e, type: 'typed' })));
}
const undo = () => travel(history.past, history.future);
const redo = () => travel(history.future, history.past);

/** Exporte le mapping dans un fichier JSON dont l'emplacement est choisi dans l'explorateur. */
async function exportMapping() {
  try {
    const text = JSON.stringify({ version: 1, name: current.name, ...serialize() }, null, 2);
    const name = await exportFile(text, `${current.name || 'mapping'}.json`);
    if (name) notify(`Exporté : ${name}`, 'success');
  } catch (e) {
    notify(`Export impossible : ${e.message}`, 'error');
  }
}

/** Image PNG de tout le schéma, enregistrée à l'emplacement choisi. */
async function exportImage() {
  try {
    const blob = await schemaImage(nodes.value, vueFlowRef.value);
    const name = await exportFile(blob, `${current.name || 'schema'}.png`, { image: true });
    if (name) notify(`Image exportée : ${name}`, 'success');
  } catch (e) {
    notify(`Export de l’image impossible : ${e.message}`, 'error');
  }
}

/** Copie un lien qui contient tout le schéma (les fichiers de données chargés n'en font pas partie). */
async function shareMapping() {
  try {
    const link = await shareLink({ version: 1, name: current.name, ...serialize() });
    await navigator.clipboard.writeText(link);
    const size = link.length.toLocaleString('fr-FR');
    notify(`Lien copié`, 'success');
  } catch (e) {
    notify(`Partage impossible : ${e.message}`, 'error');
  }
}

/** Ouvre le schéma contenu dans le lien de partage, s'il y en a un ; le mapping en cours n'est remplacé qu'avec accord. */
async function openShared() {
  let graph;
  try {
    graph = await sharedGraph();
  } catch {
    clearSharedGraph();
    return notify('Lien de partage illisible (incomplet ou abîmé) : le mapping en cours est conservé.', 'error');
  }
  if (!graph) return;
  clearSharedGraph();
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return notify('Le lien ne contient pas un mapping.', 'error');
  const name = graph.name || 'Sans titre';
  if (nodes.value.length && !confirm(`Ouvrir le schéma partagé « ${name} » ? Il remplace le mapping en cours (exportez-le d'abord si besoin).`)) return;
  current.name = name;
  load(graph);
  notify(`Schéma partagé « ${name} » ouvert.`, 'success');
}

async function open() {
  if (schemaLocked.value) return;
  try {
    const file = await openFile();
    if (!file) return;
    const graph = JSON.parse(file.text);
    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error('ce n’est pas un fichier de mapping');
    current.name = graph.name ?? file.name.replace(/\.json$/i, '');
    load(graph);
  } catch (e) {
    notify(`Ouverture impossible : ${e.message}`, 'error');
  }
}

function newMapping() {
  if (nodes.value.length && !confirm('Tout effacer ?')) return;
  current.name = 'Sans titre';
  load({ nodes: [], edges: [] });
}

function loadDemo() {
  current.name = 'Démo';
  load(demoGraph());
}

restore();
openShared();

// ── Évaluation ──────────────────────────────────────────────

/**
 * Fichiers de données déposés sur les sources (nœud → `{ name, doc }` ou `{ name, error }`) : ils remplacent
 * les valeurs du modèle de données pour le calcul, sans toucher au modèle. Gardés en mémoire seulement (ni sauvegardés ni exportés).
 */
const dataFiles = reactive(new Map());
provide(DATA_FILES_KEY, {
  get: (id) => dataFiles.get(id),
  load(id, { name, text }) {
    try {
      dataFiles.set(id, { name, doc: markRaw(parseDocument(text)) });
    } catch (e) {
      dataFiles.set(id, { name, error: `JSON invalide : ${e.message}` });
    }
  },
  clear: (id) => dataFiles.delete(id),
});

/** Conformité de chaque fichier de données au modèle de sa source, au format des contrôles. */
function checkDataFiles() {
  const byNode = new Map();
  const list = [];
  for (const [id, file] of dataFiles) {
    const node = findNode(id);
    if (node?.type !== 'source') continue;
    const issues = new Map();
    const problems = file.error
      ? [{ level: 'error', fieldId: null, path: '', message: file.error, count: 1 }]
      : checkDocument(node.data.fields, file.doc);
    for (const p of problems) {
      const issue = { level: p.level, message: `Fichier : ${p.path ? `${p.path} — ` : ''}${describeProblem(p)}` };
      const key = p.fieldId ?? '';
      issues.set(key, [...(issues.get(key) ?? []), issue]);
      list.push({ nodeId: id, fieldId: key, path: `${node.data.label} › ${file.name}${p.path ? ` › ${p.path}` : ''}`, level: p.level, message: describeProblem(p) });
    }
    byNode.set(id, issues);
  }
  return { byNode, list };
}

const results = computed(() => {
  const docs = new Map([...dataFiles].filter(([, f]) => f.doc).map(([id, f]) => [id, f.doc]));
  const targets = validateTargets(nodes.value, edges.value);
  const files = checkDataFiles();
  return {
    ...evaluateGraph(nodes.value, edges.value, docs),
    issues: { byNode: new Map([...targets.byNode, ...files.byNode]), list: [...files.list, ...targets.list] },
  };
});
provide(RESULTS_KEY, results);

/** Centre la vue sur un nœud (clic sur un problème du panneau Contrôles) et le sélectionne. */
function focusNode(id) {
  const node = findNode(id);
  if (!node) return;
  for (const n of nodes.value) n.selected = n.id === id;
  fitView({ nodes: [id], padding: 0.4, maxZoom: 1.2, duration: 300 });
}

// ── Liens ───────────────────────────────────────────────────

/** Lien en cours de tirage ; lâché dans le vide, il est raccordé au nœud choisi dans le menu d'ajout. */
let pending = null;
let connected = false;
/** Lien attrapé par une extrémité pour être déplacé. */
let updating = null;

function isValidConnection(c) {
  if (c.source === c.target) return false;
  const from = getSocket(findNode(c.source), c.sourceHandle, 'source');
  const to = getSocket(findNode(c.target), c.targetHandle, 'target');
  // Tous les types se relient : un écart de type est signalé par les contrôles.
  if (!from || !to) return false;
  return !createsCycle(edges.value, c.source, c.target, updating?.id);
}

const edgesInto = (target, targetHandle) => edges.value.filter((e) => e.target === target && e.targetHandle === targetHandle);

/** Une entrée n'accepte qu'un seul lien : le nouveau remplace l'ancien. */
function connect(c) {
  removeEdges(edgesInto(c.target, c.targetHandle));
  addEdges([{ id: uid('e'), type: 'typed', source: c.source, sourceHandle: c.sourceHandle, target: c.target, targetHandle: c.targetHandle }]);
}

onConnectStart(({ nodeId, handleId, handleType }) => {
  pending = { nodeId, handleId, side: handleType };
  connected = false;
});

onConnect((c) => {
  connected = true;
  connect(c);
});

onConnectEnd((event) => {
  const p = pending;
  pending = null;
  if (connected || updating || !p || !event || event.target.closest?.('.vue-flow__node, .vue-flow__panel, .vue-flow__controls')) return;
  const socket = getSocket(findNode(p.nodeId), p.handleId, p.side);
  if (!socket) return;
  const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;
  addMenu.value = { x: clientX, y: clientY, pending: { ...p, socket } };
});

onEdgeUpdateStart(({ edge }) => (updating = { id: edge.id, done: false }));

onEdgeUpdate(({ edge, connection }) => {
  updating.done = true;
  removeEdges(edgesInto(connection.target, connection.targetHandle).filter((e) => e.id !== edge.id));
  updateEdge(edge, connection);
});

// Lien attrapé puis lâché dans le vide = déconnexion.
onEdgeUpdateEnd(({ edge }) => {
  if (updating && !updating.done) removeEdges([edge.id]);
  updating = null;
});

// ── Ajout de nœuds ──────────────────────────────────────────

/** Menu d'ajout ouvert à `{ x, y }` (écran), avec éventuellement un lien en attente. */
const addMenu = ref(null);
const mouse = ref({ x: 300, y: 200 });

/** Menu d'ajout sous le bouton flottant, aligné sur son bord droit (le menu fait environ 320 px de large). */
function openAddMenuBelow(e) {
  const r = e.currentTarget.getBoundingClientRect();
  addMenu.value = { x: Math.max(8, r.right - 320), y: r.bottom + 6 };
}

function onPaneContextMenu(e) {
  e.preventDefault();
  nodeMenu.value = null;
  if (!schemaLocked.value) addMenu.value = { x: e.clientX, y: e.clientY };
}

function pick(kind) {
  const { x, y, pending: link, insert } = addMenu.value;
  addMenu.value = null;
  if (insert) addOnEdge(kind, { x, y }, insert);
  else addNode(kind, { x, y }, link);
}

function addNode(kind, screen, link) {
  const rect = vueFlowRef.value.getBoundingClientRect();
  const position = project({ x: screen.x - rect.left, y: screen.y - rect.top });
  if (kind === 'group') {
    rebuild((ns) => [...ns.map((n) => ({ ...n, selected: false })), { ...newGroup(position), selected: true }]);
    return;
  }
  if (link?.side === 'target') position.x -= 260;
  const id = uid(kind === 'source' || kind === 'target' ? kind : 'n');
  let node;
  let handle;

  if (kind === 'source' || kind === 'target') {
    // Tiré depuis le bon côté : on crée directement le champ correspondant.
    const matches = link && (kind === 'source') === (link.side === 'target');
    const field = matches ? fieldFromSocket(link.socket.name.replace(/\s+/g, '_').toLowerCase(), link.socket.type) : newField([], 'id');
    node =
      kind === 'source'
        ? { id, type: 'source', position, data: { label: 'Nouvelle source', fields: [field], sample: '{}' } }
        : { id, type: 'target', position, data: { label: 'Nouvelle cible', fields: [field] } };
    if (matches) handle = field.id;
  } else {
    const def = TRANSFORMS[kind];
    node = { id, type: 'transform', position, data: { kind, params: {}, values: {} } };
    if (link) {
      const candidates = link.side === 'source' ? def.inputs : def.outputs;
      const ok = (s) => (link.side === 'source' ? canConnect(link.socket.type, s.type) : canConnect(s.type, link.socket.type));
      // Une liste se branche de préférence sur une entrée liste (et inversement).
      handle = (candidates.find((s) => ok(s) && isList(s.type) === isList(link.socket.type)) ?? candidates.find(ok))?.id;
    }
  }

  for (const n of nodes.value) n.selected = false;
  addNodes([{ ...node, selected: true }]);
  if (link && handle) {
    connect(
      link.side === 'source'
        ? { source: link.nodeId, sourceHandle: link.handleId, target: id, targetHandle: handle }
        : { source: id, sourceHandle: handle, target: link.nodeId, targetHandle: link.handleId },
    );
  }
}

const isEditable = (el) => el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

function onKeydown(e) {
  const key = e.key.toLowerCase();
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && (key === 's' || key === 'o')) {
    e.preventDefault();
    if (key === 's') exportMapping();
    else open();
    return;
  }
  if (placing.value && key === 'escape') return endPlacing(false);
  if (isEditable(e.target)) return;
  if (schemaLocked.value) {
    if (ctrl && (key === 'z' || key === 'y')) {
      e.preventDefault();
      notify('Schéma verrouillé : déverrouillez-le (cadenas en bas à gauche) pour annuler ou rétablir.', 'warning');
    }
    return;
  }
  if (ctrl && (key === 'z' || key === 'y')) {
    e.preventDefault();
    if (key === 'y' || e.shiftKey) redo();
    else undo();
  } else if (e.shiftKey && key === 'a') {
    e.preventDefault();
    addMenu.value = { ...mouse.value };
  } else if (ctrl && key === 'd') {
    e.preventDefault();
    duplicate(nodes.value.filter((n) => n.selected).map((n) => n.id));
  } else if (ctrl && key === 'g') {
    e.preventDefault();
    groupSelection(nodes.value.filter((n) => n.selected).map((n) => n.id));
  } else if (key === 'delete' || key === 'backspace') {
    removeEdges(edges.value.filter((e) => e.selected));
    deleteNodes(nodes.value.filter((n) => n.selected).map((n) => n.id));
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown));
// Un fichier lâché hors d'une source ne doit pas faire quitter la page (le navigateur l'ouvrirait).
const swallowFileDrop = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files') && e.preventDefault();
onMounted(() => {
  window.addEventListener('dragover', swallowFileDrop);
  window.addEventListener('drop', swallowFileDrop);
});
onBeforeUnmount(() => {
  window.removeEventListener('dragover', swallowFileDrop);
  window.removeEventListener('drop', swallowFileDrop);
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

// ── Groupes et suppression ──────────────────────────────────

const groupSelection = (ids) => rebuild((ns) => groupAround(ns, measuredSizes(), ids));

/** Supprime les nœuds non verrouillés parmi `ids` et leurs liens ; supprimer un groupe garde ses nœuds. */
function deleteNodes(ids) {
  const gone = nodes.value.filter((n) => ids.includes(n.id) && !n.data.locked).map((n) => n.id);
  if (!gone.length) return;
  removeEdges(edges.value.filter((e) => gone.includes(e.source) || gone.includes(e.target)));
  rebuild((ns) => removeKeepingChildren(ns, gone));
}

// Glisser-déposer dans un groupe : c'est le pointeur qui désigne le groupe visé.
function pointerGroup(event, dragged) {
  if (dragged.every(isGroup)) return null;
  const p = 'changedTouches' in event ? event.changedTouches[0] : event;
  const rect = vueFlowRef.value.getBoundingClientRect();
  return groupAt(plainNodes(), measuredSizes(), project({ x: p.clientX - rect.left, y: p.clientY - rect.top }))?.id ?? null;
}

const movedIds = (dragged, groupId) => dragged.filter((n) => !isGroup(n) && (n.parentNode ?? null) !== groupId).map((n) => n.id);

function onNodeDrag({ event, nodes: dragged }) {
  const g = pointerGroup(event, dragged);
  dropGroup.value = movedIds(dragged, g).length ? g : null;
  showInsertion(insertionAt(event, dragged));
}

function onNodeDragStop({ event, nodes: dragged }) {
  dragging.value = false;
  const g = pointerGroup(event, dragged);
  dropGroup.value = null;
  const ids = movedIds(dragged, g);
  if (ids.length) rebuild((ns) => reparent(ns, ids, g));
  const insertion = insertionAt(event, dragged);
  showInsertion(null);
  if (insertion) insertOnEdge(insertion);
}

// ── Insertion sur un lien ───────────────────────────────────
// Comme dans Blender : un nœud de transformation encore libre (sans aucun lien), lâché sur un lien, s'y intercale.

const INSERT_DISTANCE = 14; // px à l'écran entre le pointeur et le lien

/** Lien sous le pointeur où le nœud glissé peut s'intercaler : `{ edge, input, output, node }` ou `null`. */
function insertionAt(event, dragged) {
  if (dragged.length !== 1) return null;
  const node = findNode(dragged[0].id);
  const def = node?.type === 'transform' && TRANSFORMS[node.data.kind];
  if (!def || edges.value.some((e) => e.source === node.id || e.target === node.id)) return null;
  const p = 'changedTouches' in event ? event.changedTouches[0] : event;
  let best = null;
  for (const edge of edges.value) {
    const d = edgeDistance(edge.id, p.clientX, p.clientY);
    if (d > INSERT_DISTANCE || (best && d >= best.d)) continue;
    const sockets = insertSockets(def, node, edge);
    if (sockets) best = { d, edge, ...sockets, node: node.id };
  }
  return best;
}

/** Entrée et sortie par lesquelles un nœud (type `def`) s'intercale sur `edge` : `{ input, output }` ou `null`. */
function insertSockets(def, node, edge) {
  const from = getSocket(findNode(edge.source), edge.sourceHandle, 'source')?.type;
  const to = getSocket(findNode(edge.target), edge.targetHandle, 'target')?.type;
  const input = bestSocket(inputsOf(def, node), (s) => typeMismatch(from, s.type));
  const output = bestSocket(def.outputs, (s) => typeMismatch(s.type, to));
  return input && output ? { input: input.id, output: output.id } : null;
}

/** Socket de même type de préférence, sinon convertible ; jamais incompatible. */
const bestSocket = (sockets, mismatch) => sockets.find((s) => mismatch(s) === null) ?? sockets.find((s) => mismatch(s) === 'conversion');

// Bouton « + » d'un lien : le menu d'ajout ne propose que les nœuds qui peuvent s'y intercaler.
provide(EDGE_INSERT_KEY, (edgeId, screen) => {
  const edge = edges.value.find((e) => e.id === edgeId);
  if (!edge || schemaLocked.value) return;
  const only = Object.entries(TRANSFORMS)
    .filter(([kind, def]) => insertSockets(def, { data: { kind, values: {} } }, edge))
    .map(([kind]) => kind);
  nodeMenu.value = null;
  addMenu.value = { ...screen, insert: edgeId, only };
});

/** Crée un nœud `kind` centré sur `screen` et l'intercale sur le lien `edgeId`. */
function addOnEdge(kind, screen, edgeId) {
  const edge = edges.value.find((e) => e.id === edgeId);
  const def = TRANSFORMS[kind];
  if (!edge || !def) return;
  const id = uid('n');
  const p = toFlow(screen);
  const node = { id, type: 'transform', position: { x: p.x - 100, y: p.y - 40 }, data: { kind, params: {}, values: {} } };
  const sockets = insertSockets(def, node, edge);
  if (!sockets) return;
  for (const n of nodes.value) n.selected = false;
  addNodes([{ ...node, selected: true }]);
  insertOnEdge({ edge, ...sockets, node: id });
}

/** Distance à l'écran entre un point et le tracé d'un lien (échantillonné). */
function edgeDistance(id, x, y) {
  const path = vueFlowRef.value?.querySelector(`.vue-flow__edge[data-id="${CSS.escape(id)}"] path.vue-flow__edge-path`);
  const m = path?.getScreenCTM();
  if (!m) return Infinity;
  const box = path.getBoundingClientRect();
  const far = INSERT_DISTANCE;
  if (x < box.left - far || x > box.right + far || y < box.top - far || y > box.bottom + far) return Infinity;
  const len = path.getTotalLength();
  let d = Infinity;
  for (let i = 0; i <= 60; i++) {
    const q = path.getPointAtLength((len * i) / 60).matrixTransform(m);
    d = Math.min(d, Math.hypot(q.x - x, q.y - y));
  }
  return d;
}

/** Met en évidence le lien qui recevra le nœud. */
function showInsertion(insertion) {
  for (const e of edges.value) {
    const on = e.id === insertion?.edge.id;
    if (!!e.class !== on) e.class = on ? 'insert-target' : undefined;
  }
}

function insertOnEdge({ edge, input, output, node }) {
  removeEdges([edge.id]);
  addEdges([
    { id: uid('e'), type: 'typed', source: edge.source, sourceHandle: edge.sourceHandle, target: node, targetHandle: input },
    { id: uid('e'), type: 'typed', source: node, sourceHandle: output, target: edge.target, targetHandle: edge.targetHandle },
  ]);
}

// Un groupe déplié s'ajuste à ses nœuds (position, taille, repli…). Pas pendant un glisser :
// le cadre suivrait le nœud, qu'on ne pourrait plus sortir du groupe.
const dragging = ref(false);
watch(
  () =>
    dragging.value ||
    nodes.value
      .map((n) => `${n.id}:${n.parentNode ?? ''}:${!!n.data.collapsed}:${Math.round(n.position.x)},${Math.round(n.position.y)}:${n.dimensions.width}x${n.dimensions.height}`)
      .join('|'),
  () => {
    if (dragging.value) return;
    const sizes = measuredSizes();
    for (const g of nodes.value) {
      if (!isGroup(g) || g.data.collapsed) continue;
      const children = nodes.value.filter((n) => n.parentNode === g.id);
      const fit = fitGroup(g, children, sizes);
      if (!fit) continue;
      for (const n of children) updateNode(n.id, { position: { x: n.position.x - fit.dx, y: n.position.y - fit.dy } });
      updateNode(g.id, {
        position: { x: g.position.x + fit.dx, y: g.position.y + fit.dy },
        style: { ...g.style, width: `${fit.width}px`, height: `${fit.height}px` },
      });
    }
  },
);

// ── Réorganisation ──────────────────────────────────────────

/** Hauteur de chaque socket dans son nœud, mesurée par Vue Flow (milieu du socket). */
const socketHeights = () =>
  new Map(
    nodes.value.map((n) => {
      const side = (list) => new Map((list ?? []).map((h) => [h.id, h.y + h.height / 2]));
      return [n.id, { source: side(n.handleBounds?.source), target: side(n.handleBounds?.target) }];
    }),
  );

/** Range les nœuds en colonnes dans le sens des liens (les nœuds verrouillés restent en place) ; annulable. */
function arrangeSchema() {
  if (schemaLocked.value || !nodes.value.length) return;
  const before = new Map(nodes.value.map((n) => [n.id, { ...n.position }]));
  const positions = autoLayout(plainNodes(), edges.value, measuredSizes(), socketHeights());
  rebuild((ns) => ns.map((n) => (positions.has(n.id) ? { ...n, position: positions.get(n.id) } : n)));
  nextTick(() => fitView({ padding: 0.15, duration: 300 }));
  const locked = nodes.value.filter((n) => n.data.locked).length;
  notify(`Schéma réorganisé${locked ? ` (${locked} nœud${locked > 1 ? 's' : ''} verrouillé${locked > 1 ? 's' : ''} laissé${locked > 1 ? 's' : ''} en place)` : ''}.`, 'success', {
    label: 'Annuler',
    run: () => {
      rebuild((ns) => ns.map((n) => (before.has(n.id) ? { ...n, position: before.get(n.id) } : n)));
      nextTick(() => fitView({ padding: 0.15, duration: 300 }));
    },
  });
}

// ── Duplication ─────────────────────────────────────────────

const toFlow = (p) => {
  const rect = vueFlowRef.value.getBoundingClientRect();
  return project({ x: p.x - rect.left, y: p.y - rect.top });
};

/**
 * Duplique les nœuds `ids` (un groupe avec ses nœuds) et les liens qui les relient entre eux. Les copies
 * suivent la souris jusqu'au clic gauche qui les dépose (dans le groupe sous le pointeur, s'il y en a un) ;
 * Échap ou clic droit annule.
 */
function duplicate(ids) {
  if (schemaLocked.value || placing.value || !ids.length) return;
  const all = plainNodes();
  const byId = new Map(all.map((n) => [n.id, n]));
  const chosen = new Set(ids);
  for (const n of all) if (n.parentNode && chosen.has(n.parentNode)) chosen.add(n.id);
  const originals = all.filter((n) => chosen.has(n.id));
  const newId = new Map(originals.map((n) => [n.id, uid(isGroup(n) ? 'g' : hasTree(n) ? n.type : 'n')]));
  const inCopiedGroup = (n) => n.parentNode && chosen.has(n.parentNode);
  const abs = (n) => (n.parentNode ? { x: byId.get(n.parentNode).position.x + n.position.x, y: byId.get(n.parentNode).position.y + n.position.y } : n.position);
  const tops = originals.filter((n) => !inCopiedGroup(n));
  const left = Math.min(...tops.map((n) => abs(n).x));
  const top = Math.min(...tops.map((n) => abs(n).y));
  const at = toFlow(mouse.value);

  const copies = originals.map(({ parentNode, selected: _, ...n }) => {
    const data = JSON.parse(JSON.stringify(n.data));
    delete data.locked;
    if ('label' in data) data.label = `${data.label} (copie)`;
    const copy = { ...n, id: newId.get(n.id), data, selected: false };
    if (inCopiedGroup({ parentNode })) return { ...copy, parentNode: newId.get(parentNode), position: { ...n.position } };
    const p = abs({ ...n, parentNode });
    return { ...copy, position: { x: at.x + p.x - left, y: at.y + p.y - top } };
  });
  const links = edges.value
    .filter((e) => chosen.has(e.source) && chosen.has(e.target))
    .map((e) => ({ id: uid('e'), type: 'typed', source: newId.get(e.source), sourceHandle: e.sourceHandle, target: newId.get(e.target), targetHandle: e.targetHandle }));

  for (const n of nodes.value) n.selected = false;
  addNodes(groupsFirst(copies));
  addEdges(links);
  placing.value = {
    ids: copies.map((c) => c.id),
    tops: copies.filter((c) => !c.parentNode).map((c) => ({ id: c.id, dx: c.position.x - at.x, dy: c.position.y - at.y, group: isGroup(c) })),
  };
  window.addEventListener('pointermove', onPlacingMove);
  window.addEventListener('pointerdown', onPlacingDown, true);
}

/** Groupe sous le pointeur où déposer les copies (aucun si elles contiennent un groupe : pas d'imbrication). */
function placingGroup(p) {
  if (placing.value.tops.some((t) => t.group)) return null;
  const others = plainNodes().filter((n) => !placing.value.ids.includes(n.id));
  return groupAt(others, measuredSizes(), toFlow(p))?.id ?? null;
}

function onPlacingMove(e) {
  const at = toFlow({ x: e.clientX, y: e.clientY });
  for (const t of placing.value.tops) updateNode(t.id, { position: { x: at.x + t.dx, y: at.y + t.dy } });
  dropGroup.value = placingGroup({ x: e.clientX, y: e.clientY });
}

function onPlacingDown(e) {
  // Le clic sert à déposer : Vue Flow ne doit pas le recevoir (désélection, déplacement du fond…).
  e.preventDefault();
  e.stopPropagation();
  window.addEventListener('click', (c) => c.stopPropagation(), { capture: true, once: true });
  window.addEventListener('contextmenu', (c) => c.preventDefault(), { capture: true, once: true });
  if (e.button === 0) onPlacingMove(e);
  endPlacing(e.button === 0);
}

function endPlacing(keep) {
  window.removeEventListener('pointermove', onPlacingMove);
  window.removeEventListener('pointerdown', onPlacingDown, true);
  const { ids, tops } = placing.value;
  const g = dropGroup.value;
  placing.value = null;
  dropGroup.value = null;
  if (!keep) {
    removeEdges(edges.value.filter((e) => ids.includes(e.source) || ids.includes(e.target)));
    removeNodes(ids);
    return;
  }
  if (g) rebuild((ns) => reparent(ns, tops.map((t) => t.id), g));
  nextTick(() => {
    for (const n of nodes.value) n.selected = ids.includes(n.id);
  });
}
onBeforeUnmount(() => placing.value && endPlacing(false));

// ── Repli et menu contextuel des nœuds ──────────────────────

function patchNodes(list, patch) {
  for (const n of list) updateNodeData(n.id, patch(n));
  nextTick(() => updateNodeInternals(list.map((n) => n.id)));
}

const hasTree = (n) => n.type === 'source' || n.type === 'target';

/** Replie (ou déplie) les nœuds et, dans les sources et cibles, toute l'arborescence des champs. */
const collapseAll = (collapsed) =>
  patchNodes(nodes.value, (n) => (hasTree(n) ? { collapsed, fields: setTreeCollapsed(n.data.fields, collapsed) } : { collapsed }));

/** Clic droit sur un nœud : le menu agit sur toute la sélection si le nœud en fait partie. */
const nodeMenu = ref(null);

onNodeContextMenu(({ event, node }) => {
  event.preventDefault();
  addMenu.value = null;
  const ids = node.selected ? nodes.value.filter((n) => n.selected).map((n) => n.id) : [node.id];
  if (!node.selected) for (const n of nodes.value) n.selected = n.id === node.id;
  nodeMenu.value = { x: event.clientX, y: event.clientY, ids };
});

const nodeMenuEntries = computed(() => {
  if (!nodeMenu.value) return [];
  const { ids } = nodeMenu.value;
  const targets = nodes.value.filter((n) => ids.includes(n.id));
  const allCollapsed = targets.every((n) => n.data.collapsed);
  const trees = targets.filter(hasTree);
  const tree = (collapsed) => patchNodes(trees, (n) => ({ collapsed: false, fields: setTreeCollapsed(n.data.fields, collapsed) }));
  const allLocked = targets.every((n) => n.data.locked);
  const unlocked = targets.filter((n) => !n.data.locked).map((n) => n.id);
  const ro = schemaLocked.value;
  const groupable = targets.filter((n) => !isGroup(n)).map((n) => n.id);
  const grouped = targets.filter((n) => n.parentNode).map((n) => n.id);
  const groups = targets.filter(isGroup).map((n) => n.id);
  return [
    { label: allCollapsed ? 'Déplier' : 'Replier', action: () => patchNodes(targets, () => ({ collapsed: !allCollapsed })) },
    ...(trees.length
      ? [
          { label: 'Déplier toute l’arborescence', action: () => tree(false) },
          { label: 'Replier toute l’arborescence', action: () => tree(true) },
        ]
      : []),
    ...(groupable.length
      ? [
          {
            label: groupable.length > 1 ? 'Grouper la sélection' : 'Créer un groupe autour',
            hint: 'Ctrl G',
            disabled: ro,
            action: () => groupSelection(groupable),
          },
        ]
      : []),
    ...(grouped.length ? [{ label: 'Sortir du groupe', disabled: ro, action: () => rebuild((ns) => reparent(ns, grouped, null)) }] : []),
    ...(groups.length
      ? [{ label: 'Dégrouper (garder les nœuds)', disabled: ro, action: () => rebuild((ns) => removeKeepingChildren(ns, groups)) }]
      : []),
    { label: 'Dupliquer', hint: 'Ctrl D', disabled: ro, action: () => duplicate(ids) },
    { label: allLocked ? 'Déverrouiller' : 'Verrouiller', disabled: ro, action: () => patchNodes(targets, () => ({ locked: !allLocked })) },
    {
      label: unlocked.length && unlocked.length < ids.length ? `Supprimer (${unlocked.length} non verrouillé${unlocked.length > 1 ? 's' : ''})` : 'Supprimer',
      hint: 'Suppr',
      danger: true,
      disabled: ro || !unlocked.length,
      action: () => deleteNodes(unlocked),
    },
  ];
});
</script>
