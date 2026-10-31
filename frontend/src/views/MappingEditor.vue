<template>
  <v-app-bar density="compact" flat border>
    <v-btn
      class="ml-3"
      color="primary"
      variant="flat"
      prepend-icon="mdi-plus"
      :disabled="schemaLocked"
      @click="openAddMenuBelow"
    >
      Ajouter <kbd>Shift A</kbd>
    </v-btn>
    <v-divider vertical inset class="mx-2" />
    <v-btn prepend-icon="mdi-file-outline" :disabled="schemaLocked" @click="newMapping">Nouveau</v-btn>
    <v-btn prepend-icon="mdi-folder-open-outline" title="Ouvrir un fichier (Ctrl O)" :disabled="schemaLocked" @click="open">
      Ouvrir
    </v-btn>
    <v-btn prepend-icon="mdi-export" title="Exporter dans un fichier (Ctrl S)" @click="exportMapping">Exporter</v-btn>
    <v-btn prepend-icon="mdi-school-outline" :disabled="schemaLocked" @click="loadDemo">Démo</v-btn>
    <v-divider vertical inset class="mx-2" />
    <v-btn icon="mdi-arrow-collapse-vertical" title="Tout replier" @click="collapseAll(true)" />
    <v-btn icon="mdi-arrow-expand-vertical" title="Tout déplier" @click="collapseAll(false)" />
    <v-spacer />
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
        <Panel position="top-right">
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

    <v-snackbar v-model="snack.show" :color="snack.color" timeout="3000">{{ snack.text }}</v-snackbar>
  </v-main>
</template>

<script setup>
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue';
import { useTheme } from 'vuetify';
import { Panel, VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { ControlButton, Controls } from '@vue-flow/controls';
import AddMenu from '../components/AddMenu.vue';
import LockIcon from '../components/LockIcon.vue';
import ChecksPanel from '../components/ChecksPanel.vue';
import SourceNode from '../components/nodes/SourceNode.vue';
import TargetNode from '../components/nodes/TargetNode.vue';
import TransformNode from '../components/nodes/TransformNode.vue';
import GroupNode from '../components/nodes/GroupNode.vue';
import TypedEdge from '../components/nodes/TypedEdge.vue';
import { RESULTS_KEY, SCHEMA_LOCK_KEY } from '../components/nodes/shared';
import { demoGraph } from '../lib/demo';
import { fieldFromSocket, migrateFields, newField, setTreeCollapsed } from '../lib/fields';
import { fitGroup, groupAround, groupAt, groupsFirst, isGroup, newGroup, removeKeepingChildren, reparent } from '../lib/groups';
import { createsCycle, evaluateGraph, getSocket } from '../lib/graph';
import { validateTargets } from '../lib/rules';
import { TRANSFORMS } from '../lib/transforms';
import { canConnect, isList, uid } from '../lib/types';
import { exportFile, openFile } from '../services/files';

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

/** Nom du mapping : nom de fichier proposé à l'export (celui du fichier ouvert, sinon « mapping »). */
const current = reactive({ name: 'mapping' });
const snack = reactive({ show: false, text: '', color: undefined });
const notify = (text, color) => Object.assign(snack, { show: true, text, color });

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
  current.name = 'mapping';
  load({ nodes: [], edges: [] });
}

function loadDemo() {
  current.name = 'Démo';
  load(demoGraph());
}

restore();

// ── Évaluation ──────────────────────────────────────────────

const results = computed(() => ({ ...evaluateGraph(nodes.value, edges.value), issues: validateTargets(nodes.value, edges.value) }));
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

function openAddMenuBelow(e) {
  const r = e.currentTarget.getBoundingClientRect();
  addMenu.value = { x: r.left, y: r.bottom + 4 };
}

function onPaneContextMenu(e) {
  e.preventDefault();
  nodeMenu.value = null;
  if (!schemaLocked.value) addMenu.value = { x: e.clientX, y: e.clientY };
}

function pick(kind) {
  const { x, y, pending: link } = addMenu.value;
  addMenu.value = null;
  addNode(kind, { x, y }, link);
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
  if (isEditable(e.target) || schemaLocked.value) return;
  if (e.shiftKey && key === 'a') {
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
}

function onNodeDragStop({ event, nodes: dragged }) {
  dragging.value = false;
  const g = pointerGroup(event, dragged);
  dropGroup.value = null;
  const ids = movedIds(dragged, g);
  if (ids.length) rebuild((ns) => reparent(ns, ids, g));
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
