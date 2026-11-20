<template>
  <v-app-bar density="compact" flat border>
    <v-btn
      class="ml-1"
      :icon="collectionsOpen ? 'mdi-dock-left' : 'mdi-folder-multiple-outline'"
      :title="collectionsOpen ? t('Masquer les collections', 'Hide the collections') : t('Afficher les collections', 'Show the collections')"
      @click="collectionsOpen = !collectionsOpen"
    />
    <v-btn prepend-icon="mdi-folder-open-outline" :title="t('Ouvrir un fichier sauvegardé (Ctrl O) ; un mapping ou une collection est ajouté', 'Open a saved file (Ctrl O); a mapping or a collection is added')" @click="openDocument">{{ t('Ouvrir', 'Open') }}</v-btn>
    <v-btn prepend-icon="mdi-download-outline" :title="t('Télécharger les collections et la bibliothèque dans un fichier (Ctrl S)', 'Download the collections and the library to a file (Ctrl S)')" @click="downloadDocument">{{ t('Télécharger', 'Download') }}</v-btn>
    <button
      class="doc-name"
      :title="`${doc.modified ? t('Modifié depuis la dernière sauvegarde', 'Changed since the last save') : t('Sauvegardé', 'Saved')} — ${t('cliquer pour changer le nom du fichier téléchargé', 'click to change the name of the downloaded file')}`"
      @click="renameDocumentFile"
    >
      <v-icon icon="mdi-file-document-outline" size="16" />
      <span class="doc-name-text">{{ doc.name ?? DEFAULT_FILE }}</span><span v-if="doc.modified" class="doc-modified"> ●</span>
      <v-icon class="doc-name-edit" icon="mdi-pencil-outline" size="14" />
    </button>
    <v-divider vertical inset class="mx-2" />
    <template v-if="!editingModelId">
      <!-- Démo : seulement avec un mapping affiché (pas un modèle composite). -->
      <template v-if="!compositeOpen">
        <v-btn prepend-icon="mdi-school-outline" :title="t('Ajouter la démo : un dossier « Démo » dans les mappings et dans la bibliothèque', 'Add the demo: a “Demo” folder in the mappings and in the library')" @click="loadDemo">{{ t('Démo', 'Demo') }}</v-btn>
        <v-divider vertical inset class="mx-2" />
      </template>
      <v-btn icon="mdi-arrow-collapse-vertical" :title="t('Tout replier', 'Collapse all')" @click="collapseAll(true)" />
      <v-btn icon="mdi-arrow-expand-vertical" :title="t('Tout déplier', 'Expand all')" @click="collapseAll(false)" />
      <v-btn icon="mdi-graph-outline" :title="t('Réorganiser le schéma (colonnes dans le sens des liens)', 'Rearrange the schema (columns following the links)')" :disabled="schemaLocked" @click="arrangeSchema" />
      <v-divider vertical inset class="mx-2" />
    </template>
    <span v-if="shown.name" class="flow-name" :class="{ composite: shown.kind }" :title="shown.title">
      <v-icon :icon="shown.icon" size="16" />
      <span v-if="shown.kind" class="flow-kind">{{ shown.kind }}</span>
      <span v-if="shown.folders" class="flow-folders">{{ shown.folders }} ›</span>
      <span class="flow-title">{{ shown.name }}</span>
    </span>
    <v-spacer />
    <v-btn prepend-icon="mdi-help-circle-outline" href="/noeuds" :title="t('Documentation des nœuds', 'Node documentation')">{{ t('Nœuds', 'Nodes') }}</v-btn>
    <v-btn prepend-icon="mdi-email-outline" href="/aide" :title="t('Aide et contact', 'Help and contact')">{{ t('Aide', 'Help') }}</v-btn>
    <LangSwitch />
    <v-btn :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'" :title="t('Changer de thème', 'Switch theme')" @click="toggleTheme" />
  </v-app-bar>

  <CollectionsPanel
    ref="panelRef"
    v-model="collectionsOpen"
    @export="exportItem"
    @image="exportImage"
    @import="open"
    :editing-model-id="editingModelId"
    @edit-model="editModel"
    @use-model="useModel"
    @new-composite="newComposite"
    @new-mapping="newMapping"
    @open-flow="openFlow"
    @legend="legendOpen = true"
    @shortcuts="shortcutsOpen = true"
  />
  <ImpactDialog :request="impactRequest" />

  <v-main>
    <ModelEditor v-if="editingModelId" ref="modelEditorRef" :item-id="editingModelId" @save="saveEditedModel" @close="closeModelEditor()" />
    <div v-show="!editingModelId" class="editor" @mousemove="mouse = { x: $event.clientX, y: $event.clientY }" @dragover="onModelDragOver" @drop="onModelDrop">
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
            :title="schemaLocked ? t('Déverrouiller le schéma', 'Unlock the schema') : t('Verrouiller tout le schéma (positions, liens et valeurs)', 'Lock the whole schema (positions, links and values)')"
            @click="schemaLocked = !schemaLocked"
          >
            <LockIcon :locked="schemaLocked" />
          </ControlButton>
        </Controls>
        <!-- Modèle composite ouvert : même bandeau que l'éditeur des modèles (brouillon jusqu'à l'enregistrement). -->
        <!-- Bandeau d'un modèle composite : seulement enregistrer, annuler, fermer (le reste dans les infobulles). -->
        <Panel v-if="compositeOpen" position="top-center" class="model-bar">
          <v-btn
            size="small"
            color="primary"
            variant="flat"
            prepend-icon="mdi-content-save-outline"
            :disabled="!compositeDirty"
            :title="`${t('Enregistrer le modèle composite', 'Save the composite model')} — ${compositeUsageText}`"
            @click="saveComposite"
          >
            {{ t('Enregistrer', 'Save') }}
          </v-btn>
          <v-btn size="small" variant="text" prepend-icon="mdi-undo" :disabled="!compositeDirty" :title="t('Annuler les modifications : revenir à la version enregistrée', 'Discard the changes: back to the saved version')" @click="discardComposite">
            {{ t('Annuler', 'Discard') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            icon="mdi-close"
            :title="compositeReturnName ? t(`Fermer et revenir au mapping « ${compositeReturnName} »`, `Close and go back to the mapping “${compositeReturnName}”`) : t('Fermer et revenir au mapping', 'Close and go back to the mapping')"
            @click="closeComposite"
          />
        </Panel>
        <Panel position="top-right" class="side-panel">
          <!-- Boutons flottants d'ajout et de légende, au-dessus du panneau des contrôles. -->
          <v-btn
            class="add-fab side-block text-none"
            color="primary"
            block
            height="48"
            rounded="lg"
            elevation="4"
            prepend-icon="mdi-plus"
            :disabled="schemaLocked"
            :title="t('Ajouter un nœud (Shift A, ou clic droit sur le fond)', 'Add a node (Shift A, or right-click on the background)')"
            @click="openAddMenuBelow"
          >
            {{ t('Ajouter', 'Add') }} <kbd>Shift A</kbd>
          </v-btn>
          <ChecksPanel :issues="results.issues.list" :has-targets="nodes.some((n) => n.type === 'target')" @focus="focusNode" />
        </Panel>
      </VueFlow>
    </div>

    <AddMenu :at="addMenu" @pick="pick" @close="addMenu = null" />

    <!-- Modèle lâché sur le schéma : l'ajouter comme source ou comme cible. -->
    <v-menu
      :model-value="!!modelDrop"
      :target="modelDrop ? [modelDrop.x, modelDrop.y] : undefined"
      @update:model-value="!$event && (modelDrop = null)"
    >
      <v-list density="compact" min-width="240">
        <v-list-subheader>{{ t('Ajouter', 'Add') }} « {{ modelDrop && find(modelDrop.id)?.name }} »</v-list-subheader>
        <v-list-item prepend-icon="mdi-arrow-right-bold-box-outline" :title="t('Comme source', 'As a source')" @click="dropModelAs('source')" />
        <v-list-item prepend-icon="mdi-arrow-left-bold-box-outline" :title="t('Comme cible', 'As a target')" @click="dropModelAs('target')" />
      </v-list>
    </v-menu>

    <v-menu
      :model-value="!!nodeMenu"
      :target="nodeMenu ? [nodeMenu.x, nodeMenu.y] : undefined"
      @update:model-value="!$event && (nodeMenu = null)"
    >
      <v-list density="compact" min-width="220">
        <v-list-subheader v-if="nodeMenu?.ids.length > 1">{{ count(nodeMenu.ids.length, 'nœud', 'node') }}</v-list-subheader>
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
          {{ t('Légende', 'Legend') }}
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" size="small" :title="t('Fermer', 'Close')" @click="legendOpen = false" />
        </v-card-title>
        <v-card-text><LegendGrid link-base="/noeuds" /></v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="shortcutsOpen" max-width="760" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center">
          {{ t('Raccourcis', 'Shortcuts') }}
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" size="small" :title="t('Fermer', 'Close')" @click="shortcutsOpen = false" />
        </v-card-title>
        <v-card-text><ShortcutsGrid /></v-card-text>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snack.show" :color="snack.color" :timeout="snack.action ? 10000 : snack.color === 'error' ? 3500 : 1800">
      {{ snack.text }}
      <template v-if="snack.action" #actions>
        <v-btn variant="text" @click="snack.action.run(), (snack.show = false)">{{ snack.action.label }}</v-btn>
      </template>
    </v-snackbar>
  </v-main>
</template>

<script setup>
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, watch, watchEffect } from 'vue';
import { useTheme } from 'vuetify';
import { Panel, VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { ControlButton, Controls } from '@vue-flow/controls';
import AddMenu from '../components/AddMenu.vue';
import LegendGrid from '../components/LegendGrid.vue';
import ShortcutsGrid from '../components/ShortcutsGrid.vue';
import LangSwitch from '../components/LangSwitch.vue';
import LockIcon from '../components/LockIcon.vue';
import ChecksPanel from '../components/ChecksPanel.vue';
import CollectionsPanel from '../components/CollectionsPanel.vue';
import ImpactDialog from '../components/ImpactDialog.vue';
import ModelEditor from '../components/ModelEditor.vue';
import SourceNode from '../components/nodes/SourceNode.vue';
import TargetNode from '../components/nodes/TargetNode.vue';
import TransformNode from '../components/nodes/TransformNode.vue';
import GroupNode from '../components/nodes/GroupNode.vue';
import LibraryNode from '../components/nodes/LibraryNode.vue';
import TypedEdge from '../components/nodes/TypedEdge.vue';
import { DATA_FILES_KEY, EDGE_INSERT_KEY, FIELD_ORIGIN_KEY, LIBRARIES_KEY, LIST_LINK_KEY, MODEL_LINK_KEY, RESULTS_KEY, SCHEMA_LOCK_KEY } from '../components/nodes/shared';
import { askChoice, askConfirm, askText } from '../services/dialogs';
import { applyList, createList, libraryListNodes, listContent, listImpactOf, listOf, revertListNode, sameList } from '../services/valueLists';
import {
  applyModel,
  compositeContent,
  compositeOutput,
  createComposite,
  createModel,
  folderOf,
  hooks as modelHooks,
  impactOf,
  MODEL_DRAG_TYPE,
  modelOf,
  refreshComposite,
  renameItem,
  revertNode,
  sameFields,
  sampleForSource,
  stripFields,
  usageCounts,
  usesComposite,
} from '../services/models';
import { checkDocument, describeProblem } from '../lib/conformity';
import { installDemo } from '../services/demo';
import { count, t } from '../lib/i18n';
import { allFields, fieldFromSocket, migrateFields, parseDocument, newField, setTreeCollapsed } from '../lib/fields';
import { autoLayout } from '../lib/layout';
import { fitGroup, groupAround, groupAt, groupsFirst, isGroup, newGroup, removeKeepingChildren, reparent } from '../lib/groups';
import { createsCycle, evaluateGraph, getSocket, originsOf } from '../lib/graph';
import { librariesOf, LIBRARY_OUTPUT, LIBRARY_TABLE } from '../lib/libraries';
import { validateTargets } from '../lib/rules';
import { initialParams, inputsOf, TRANSFORMS } from '../lib/transforms';
import { canConnect, isList, typeMismatch, uid } from '../lib/types';
import { download, exportFile, openFile } from '../services/files';
import { doc, markSaved, renameDocument } from '../services/document';
import { schemaImage } from '../services/image';
import {
  activeCollection,
  activeMapping,
  addCollection,
  addImportedLibrary,
  addImportedModels,
  allMappings,
  collectionFile,
  collectionNamed,
  replaceCollection,
  find,
  locate,
  firstMapping,
  insertMapping,
  isComposite,
  makeMapping,
  leafCount,
  mappingFile,
  readFile,
  restoreWorkspace,
  saveNow,
  workspace,
  workspaceFile,
} from '../services/collections';

const FLOW_ID = 'mapping';
const THEME_KEY = 'mapping-theme';
const SCHEMA_LOCKED_KEY = 'mapping-schema-locked';
const COLLECTIONS_OPEN_KEY = 'mapping-collections-open';

/** Panneau des collections affiché (mémorisé dans le navigateur). */
const collectionsOpen = ref(localStorage.getItem(COLLECTIONS_OPEN_KEY) !== '0');
watch(collectionsOpen, (open) => localStorage.setItem(COLLECTIONS_OPEN_KEY, open ? '1' : '0'));

const nodeTypes = {
  source: markRaw(SourceNode),
  target: markRaw(TargetNode),
  transform: markRaw(TransformNode),
  library: markRaw(LibraryNode),
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

/**
 * Mapping ouvert : son nom (champ de la barre d'outils) est celui de l'élément de la collection, proposé aussi à
 * l'export et repris par les liens de partage.
 */
const current = reactive({
  get name() {
    return activeMapping()?.name ?? '';
  },
  set name(value) {
    const mapping = activeMapping();
    if (mapping) mapping.name = value;
  },
});
const legendOpen = ref(false);
const shortcutsOpen = ref(false);
/** Panneau de gauche (pour y lancer le renommage d'un nouveau mapping). */
const panelRef = ref(null);
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
/** Affiche `graph` ; `fit` : cadre ensuite la vue sur tout le schéma. */
function load(graph, { fit = true } = {}) {
  const copy = JSON.parse(JSON.stringify(graph));
  for (const n of copy.nodes) if (n.data?.fields) n.data.fields = migrateFields(n.data.fields);
  setNodes(groupsFirst(copy.nodes));
  setEdges(copy.edges.map((e) => ({ ...e, type: 'typed' })));
  fitPending = fit;
}
onNodesInitialized(() => {
  if (!fitPending) return;
  fitPending = false;
  fitView({ padding: 0.15 });
});

/** Copie du schéma affiché, détachée de l'éditeur, pour la ranger dans la collection. */
const snapshot = () => JSON.parse(JSON.stringify(serialize()));

/** Range le schéma affiché dans son élément de la collection (enregistrée ensuite dans le navigateur). */
let saveTimer;
function saveGraph(mapping = activeMapping()) {
  clearTimeout(saveTimer);
  if (!mapping) return;
  mapping.graph = snapshot();
}
// Écrit après chaque modification (avec un léger délai pendant les déplacements).
watch(
  [nodes, edges],
  () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveGraph, 300);
  },
  { deep: true },
);
// En quittant la page, rien d'encore en attente ne doit se perdre.
const flushOnUnload = () => {
  saveGraph();
  saveNow();
};
onMounted(() => window.addEventListener('beforeunload', flushOnUnload));
onBeforeUnmount(() => window.removeEventListener('beforeunload', flushOnUnload));

/** Affiche le flux ouvert de la collection, avec un historique d'annulation neuf. */
function openActive({ fit = true } = {}) {
  clearTimeout(historyTimer);
  Object.assign(history, { past: [], future: [], present: null, settling: false });
  load(activeMapping()?.graph ?? { nodes: [], edges: [] }, { fit });
}

// Les modèles de la bibliothèque modifient les flux enregistrés : le flux affiché y est d'abord rangé, puis rechargé.
modelHooks.flush = () => saveGraph();
modelHooks.reload = () => openActive({ fit: false });

// Changement de mapping dans la collection : le précédent est rangé tel qu'affiché, puis le nouveau est chargé.
// Après une restauration « tout remplacer », le schéma affiché appartient à l'ancien contenu : il n'est pas rangé.
let discardDisplayed = false;
watch(
  () => workspace.activeId,
  (id, previous) => {
    const before = !discardDisplayed && find(previous);
    discardDisplayed = false;
    // Modèle composite quitté sans passer par son bandeau : ses modifications sont enregistrées plutôt que perdues.
    const leftDirty = before && isComposite(before) && compositeWasDirty;
    if (before) saveGraph(before);
    else clearTimeout(saveTimer);
    if (leftDirty) refreshComposite(before);
    dataFiles.clear();
    nodeMenu.value = null;
    addMenu.value = null;
    openActive();
    startCompositeSession(previous);
  },
);

// ── Modèle composite ouvert ─────────────────────────────────
// Son schéma s'affiche à la place du mapping. Comme dans l'éditeur des modèles, les changements sont un brouillon
// (rangé au fil de l'eau dans le schéma) : ses champs et ses données ne changent, dans la bibliothèque et dans les
// mappings qui l'utilisent, qu'à « Enregistrer le modèle ». Fermer ramène au mapping d'où il a été ouvert.

/** `id` : modèle ouvert ; `returnTo` : mapping d'où il a été ouvert ; `saved` : version enregistrée de son schéma (JSON). */
const compositeSession = reactive({ id: null, returnTo: null, saved: '' });

/** Contenu d'un schéma qui compte pour le modèle (sans les positions ni la sélection). */
const graphKey = (g) =>
  JSON.stringify({
    nodes: g.nodes.map(({ id, type, data, parentNode }) => ({ id, type, data, parentNode })),
    edges: g.edges.map(({ source, sourceHandle, target, targetHandle }) => ({ source, sourceHandle, target, targetHandle })),
  });

function startCompositeSession(previous = null) {
  const item = activeMapping();
  if (!isComposite(item)) return Object.assign(compositeSession, { id: null, returnTo: null, saved: '' });
  if (compositeSession.id === item.id) return;
  const prev = previous ? find(previous) : null;
  compositeSession.returnTo = prev?.type === 'mapping' ? prev.id : isComposite(prev) ? compositeSession.returnTo : null;
  compositeSession.id = item.id;
  compositeSession.saved = JSON.stringify(serialize());
}

/** Le schéma affiché diffère de sa version enregistrée, ou les champs du modèle ne le suivent pas encore. */
const compositeDirty = computed(() => {
  const item = activeMapping();
  if (!isComposite(item) || compositeSession.id !== item.id) return false;
  const live = serialize();
  if (graphKey(live) !== graphKey(JSON.parse(compositeSession.saved))) return true;
  const content = compositeContent(live);
  return !sameFields(content.fields, item.fields) || content.sample !== item.sample;
});

// État avant un changement de schéma affiché (le calcul suit le schéma affiché : il faut le retenir avant).
let compositeWasDirty = false;
watch(compositeDirty, (dirty) => (compositeWasDirty = dirty));

const compositeUsageText = computed(() => {
  const n = compositeOpen.value ? (usageCounts().get(workspace.activeId) ?? 0) : 0;
  return n ? t(`utilisé par ${n} mapping`, `used by ${n} mapping${n > 1 ? 's' : ''}`) : t('utilisé par aucun mapping', 'used by no mapping');
});
const compositeReturnName = computed(() => (compositeSession.returnTo && find(compositeSession.returnTo)?.name) || '');

/** Enregistre le modèle composite : ses champs et ses données suivent son schéma, dans les mappings aussi. */
function saveComposite() {
  const item = activeMapping();
  if (!isComposite(item)) return;
  saveGraph();
  refreshComposite(item);
  compositeSession.saved = JSON.stringify(serialize());
  notify(t(`Modèle « ${item.name} » enregistré.`, `Model “${item.name}” saved.`), 'success');
}

/** Revient à la version enregistrée du schéma. */
function discardComposite() {
  const item = activeMapping();
  if (!isComposite(item)) return;
  clearTimeout(saveTimer);
  item.graph = JSON.parse(compositeSession.saved);
  openActive({ fit: false });
}

/** Avant de quitter un modèle composite modifié : l'enregistrer, abandonner les modifications, ou rester (`false`). */
async function leaveComposite() {
  if (!compositeDirty.value) return true;
  const choice = await askChoice({
    title: t('Modifications non enregistrées', 'Unsaved changes'),
    text: t('Le modèle composite ouvert a des modifications non enregistrées.', 'The open composite model has unsaved changes.'),
    choices: [
      { value: 'discard', label: t('Abandonner', 'Discard'), color: 'error' },
      { value: 'save', label: t('Enregistrer', 'Save'), color: 'primary' },
    ],
  });
  if (choice === 'save') saveComposite();
  else if (choice === 'discard') discardComposite();
  return !!choice;
}

/** Ferme le modèle composite : retour au mapping d'où il a été ouvert (le premier mapping sinon). */
async function closeComposite() {
  if (!(await leaveComposite())) return;
  const back = (compositeSession.returnTo && find(compositeSession.returnTo)) || firstMapping();
  if (back) workspace.activeId = back.id;
  else insertMapping(makeMapping());
}

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

/**
 * Exporte un élément de la collection dans un fichier JSON dont l'emplacement est choisi dans l'explorateur :
 * un mapping seul, ou une collection (un dossier s'exporte comme une collection).
 */
async function exportItem(id) {
  saveGraph(); // le schéma affiché, même modifié à l'instant
  const item = find(id);
  if (!item) return;
  try {
    const text = item.type === 'mapping' ? mappingFile(id) : collectionFile(id);
    const name = await exportFile(text, `${item.name || (item.type === 'mapping' ? 'mapping' : 'collection')}.json`);
    if (name) notify(`${t('Exporté', 'Exported')} : ${name}`, 'success');
  } catch (e) {
    notify(`${t('Export impossible', 'Export failed')} : ${e.message}`, 'error');
  }
}

// ── Fichier de travail : Ouvrir, Télécharger ───────────

const DEFAULT_FILE = 'schemap.json';
watchEffect(() => {
  document.title = `${doc.name ?? t('Non sauvegardé', 'Not saved')}${doc.modified ? ' ●' : ''} — ScheMap`;
});

/** Le schéma affiché est celui d'un modèle composite de la bibliothèque. */
const compositeOpen = computed(() => isComposite(activeMapping()));

/**
 * Élément affiché, pour la barre d'outils : mapping, modèle composite, ou modèle / liste ouvert dans l'éditeur de
 * la bibliothèque. `kind` : étiquette des éléments de la bibliothèque (rien pour un mapping) ; `folders` : ses
 * dossiers (« Pizzeria › Livraisons »).
 */
const shown = computed(() => {
  const id = editingModelId.value ?? workspace.activeId;
  const loc = id ? locate(id) : null;
  const folders = (loc?.path ?? []).map((p) => p.name).join(' › ');
  const path = (name) => [folders, name].filter(Boolean).join(' › ');
  if (editingModelId.value) {
    const list = loc?.item.type === 'valuelist';
    const kind = list ? t('Liste de valeurs', 'Value list') : t('Modèle', 'Model');
    return { kind, icon: list ? 'mdi-format-list-bulleted' : 'mdi-database-outline', folders, name: loc?.item.name ?? '', title: `${kind} : ${path(loc?.item.name ?? '')}` };
  }
  if (compositeOpen.value) {
    return {
      kind: t('Modèle composite', 'Composite model'),
      icon: 'mdi-database-cog-outline',
      folders,
      name: current.name,
      title: `${t('Modèle composite affiché', 'Displayed composite model')} : ${path(current.name)} — ${t('ses champs sont ceux de sa cible, et ses données ce qu’elle produit', 'its fields are those of its target, and its data what the target produces')}`,
    };
  }
  return { kind: null, icon: 'mdi-source-branch', folders, name: current.name, title: `${t('Mapping affiché', 'Displayed mapping')} : ${path(current.name)}` };
});

/** Nom du fichier téléchargé : à changer avant de télécharger (« .json » ajouté s'il manque). */
async function renameDocumentFile() {
  let name = await askText({ title: t('Nom du fichier', 'File name'), label: t('Nom du fichier téléchargé', 'Name of the downloaded file'), initial: doc.name ?? DEFAULT_FILE, okLabel: t('Renommer', 'Rename') });
  name = name?.trim();
  if (!name) return;
  if (!/\.json$/i.test(name)) name += '.json';
  renameDocument(name);
}

/** Télécharger : collections et bibliothèque dans un fichier JSON (le schéma affiché est d'abord rangé). */
function downloadDocument() {
  saveGraph();
  const name = doc.name ?? DEFAULT_FILE;
  download(workspaceFile(), name);
  markSaved(name, null);
  notify(`${t('Téléchargé', 'Downloaded')} : ${name}`, 'success');
}

/**
 * Ouvrir : un fichier sauvegardé remplace les collections et la bibliothèque (avec accord si le travail n'est pas
 * sauvegardé), et devient le fichier de travail. Un mapping, une collection ou un export de la bibliothèque
 * s'ajoute, comme avec l'import du panneau.
 */
async function openDocument() {
  if (editingModelId.value && !(await leaveModel())) return;
  try {
    const file = await openFile();
    if (!file) return;
    const content = readFile(file.text, file.name);
    if (!content.workspace) return addImported(content);
    if (
      doc.modified &&
      !(await askConfirm({
        title: t('Travail non sauvegardé', 'Unsaved work'),
        text: t(
          `Ouvrir « ${file.name} » remplace les collections et la bibliothèque actuelles, modifiées depuis la dernière sauvegarde. Continuer ?`,
          `Opening “${file.name}” replaces the current collections and library, changed since the last save. Continue?`,
        ),
        okLabel: t('Ouvrir', 'Open'),
        danger: true,
      }))
    )
      return;
    await applyWorkspace(content.workspace, { replace: true });
    // Le schéma rechargé est rangé tel qu'affiché (après le délai d'écriture) : l'empreinte est prise ensuite.
    await new Promise((r) => setTimeout(r, 400));
    saveGraph();
    markSaved(file.name, file.handle);
    notify(`${t('Ouvert', 'Opened')} : ${file.name}`, 'success');
  } catch (e) {
    notify(`${t('Ouverture impossible', 'Cannot open')} : ${e.message}`, 'error');
  }
}

/** Charge une sauvegarde complète (tout remplacer, ou l'ajouter) et affiche le mapping ouvert. */
async function applyWorkspace(saved, options) {
  editingModelId.value = null;
  saveGraph();
  discardDisplayed = !!options.replace;
  const n = restoreWorkspace(saved, options);
  openActive();
  await nextTick();
  discardDisplayed = false;
  dataFiles.clear();
  return n;
}

/** Restaure une sauvegarde complète importée depuis le panneau : tout remplacer, ou l'ajouter à ce qui existe. */
async function restore(saved) {
  const when = saved.savedAt ? new Date(saved.savedAt).toLocaleString() : null;
  const choice = await askChoice({
    title: t('Restaurer une sauvegarde complète', 'Restore a full backup'),
    text: t(
      `Sauvegarde${when ? ` du ${when}` : ''} : ${count(saved.collections.length, 'collection', 'collection')}. « Tout remplacer » efface les collections et la bibliothèque actuelles ; « Ajouter » les garde et y ajoute celles de la sauvegarde.`,
      `Backup${when ? ` of ${when}` : ''}: ${count(saved.collections.length, 'collection', 'collection')}. “Replace everything” erases the current collections and library; “Add” keeps them and adds those of the backup.`,
    ),
    choices: [
      { value: 'add', label: t('Ajouter', 'Add') },
      { value: 'replace', label: t('Tout remplacer', 'Replace everything'), color: 'warning' },
    ],
  });
  if (!choice) return;
  if (editingModelId.value && !(await leaveModel())) return;
  const replace = choice === 'replace';
  const n = await applyWorkspace(saved, { replace, folderName: t(`Sauvegarde${when ? ` du ${when}` : ''}`, `Backup${when ? ` of ${when}` : ''}`) });
  const what = `${count(n.collections, 'collection', 'collection')}, ${count(n.library, 'élément de bibliothèque', 'library item', 'éléments de bibliothèque', 'library items')}`;
  notify(replace ? t(`Sauvegarde restaurée (${what}).`, `Backup restored (${what}).`) : t(`Sauvegarde ajoutée (${what}).`, `Backup added (${what}).`), 'success');
}

/** Attend que le schéma affiché soit dessiné (nœuds mesurés), au plus une seconde et demie. */
function rendered() {
  return new Promise((resolve) => {
    const done = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
    const timer = setTimeout(done, 1500);
    const { off } = onNodesInitialized(() => {
      clearTimeout(timer);
      off();
      done();
    });
  });
}

/** Image PNG de tout le schéma du mapping `id` (ouvert d'abord s'il ne l'est pas), enregistrée à l'emplacement choisi. */
async function exportImage(id = workspace.activeId) {
  try {
    if (id !== workspace.activeId) {
      const wait = rendered();
      workspace.activeId = id;
      await wait;
    }
    if (!nodes.value.length) return notify(t('Ce mapping est vide : aucune image à exporter.', 'This mapping is empty: no image to export.'), 'warning');
    const blob = await schemaImage(nodes.value, vueFlowRef.value);
    const name = await exportFile(blob, `${current.name || 'schema'}.png`, { image: true });
    if (name) notify(`${t('Image exportée', 'Image exported')} : ${name}`, 'success');
  } catch (e) {
    notify(`${t('Export de l’image impossible', 'Image export failed')} : ${e.message}`, 'error');
  }
}

/**
 * Ajoute ce qu'un fichier importé contient : un mapping, à côté du mapping ouvert ; une collection,
 * à la liste des collections (son premier mapping est ouvert).
 */
async function addImported({ collection, mapping, library, workspace: saved, models = [] }) {
  collectionsOpen.value = true;
  if (saved) return restore(saved);
  // Une collection du même nom existe déjà : la remplacer, garder les deux, ou ne rien importer.
  let replaced = null;
  const existing = collection && collectionNamed(collection.name);
  if (existing) {
    const n = leafCount(existing);
    const choice = await askChoice({
      title: t(`La collection « ${existing.name} » existe déjà`, `The collection “${existing.name}” already exists`),
      text: t(
        `La remplacer supprime ses ${count(n, 'mapping', 'mapping')} actuels au profit de ceux du fichier. Exportez-la d’abord pour la garder.`,
        `Replacing it deletes its current ${count(n, 'mapping', 'mapping')} in favor of those of the file. Export it first to keep it.`,
      ),
      choices: [
        { value: 'both', label: t('Garder les deux', 'Keep both') },
        { value: 'replace', label: t('Remplacer', 'Replace'), color: 'warning' },
      ],
    });
    if (!choice) return;
    if (choice === 'replace') replaced = existing;
  }
  if (library) {
    const n = addImportedLibrary(library);
    return notify(t(`${count(n, 'élément ajouté', 'item added', 'éléments ajoutés', 'items added')} à la bibliothèque.`, `${count(n, 'item', 'item')} added to the library.`), 'success');
  }
  // Modèles joints aux flux : ajoutés à la racine de la bibliothèque s'ils n'y sont pas déjà.
  const added = addImportedModels(models);
  const extra = added ? t(` et ${count(added, 'élément', 'item')} dans la bibliothèque`, ` and ${count(added, 'item', 'item')} in the library`) : '';
  if (mapping) {
    insertMapping(mapping);
    return notify(t(`Mapping « ${mapping.name} » ajouté à la collection « ${activeCollection().name} »${extra}.`, `Mapping « ${mapping.name} » added to the collection « ${activeCollection().name} »${extra}.`), 'success');
  }
  if (replaced) replaceCollection(replaced.id, collection);
  else addCollection(collection);
  const first = firstMapping(collection.items);
  if (first) workspace.activeId = first.id;
  const n = count(leafCount(collection), 'mapping', 'mapping');
  notify(
    replaced
      ? t(`Collection « ${collection.name} » remplacée (${n})${extra}.`, `Collection « ${collection.name} » replaced (${n})${extra}.`)
      : t(`Collection « ${collection.name} » ajoutée (${n})${extra}.`, `Collection « ${collection.name} » added (${n})${extra}.`),
    'success',
  );
}

/** Importe un fichier choisi dans l'explorateur (mapping ou collection). */
async function open() {
  try {
    const file = await openFile();
    if (!file) return;
    await addImported(readFile(file.text, file.name));
  } catch (e) {
    notify(`${t('Ouverture impossible', 'Cannot open')} : ${e.message}`, 'error');
  }
}

/** Nouveau mapping vide, rangé à côté du mapping ouvert. */
async function newMapping() {
  if (editingModelId.value && !(await leaveModel())) return;
  if (!(await leaveComposite())) return;
  editingModelId.value = null;
  const mapping = insertMapping(makeMapping());
  // Son nom se saisit tout de suite, dans le panneau de gauche.
  collectionsOpen.value = true;
  panelRef.value?.renameMapping(mapping.id);
}

/** Démo : un dossier « Démo » dans les mappings et dans la bibliothèque (voir services/demo.js). */
function loadDemo() {
  installDemo();
  notify(
    t(
      'Démo ajoutée : un dossier « Démo » dans les mappings (le mapping, ouvert) et dans la bibliothèque (une liste, deux modèles simples, un modèle composite).',
      'Demo added: a “Demo” folder in the mappings (the mapping, now open) and in the library (a list, two simple models, a composite model).',
    ),
    'success',
  );
}

openActive();
startCompositeSession();

// ── Bibliothèque : modèles et listes de valeurs ─────────────

/** Avertissement d'impact en cours (voir ImpactDialog) ; `askImpact` rend le choix : `apply`, `saveAs` ou `null`. */
const impactRequest = ref(null);
const askImpact = (request) =>
  new Promise((resolve) => {
    impactRequest.value = {
      ...request,
      resolve: (choice) => {
        impactRequest.value = null;
        resolve(choice);
      },
    };
  });

const sampleOfNode = (node) => (node.type === 'source' ? node.data.sample : undefined);

/** Nombre d'autres flux (que celui ouvert) qui utilisent chaque élément de la bibliothèque. */
const otherUsage = computed(() => {
  const counts = new Map();
  for (const { mapping } of allMappings()) {
    if (mapping.id === workspace.activeId) continue;
    const ids = mapping.graph.nodes.flatMap((n) => [n.data?.modelId, n.data?.listId]).filter(Boolean);
    for (const id of new Set(ids)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
});

/**
 * Champs dont les références aux nœuds Liste de valeurs du flux reliés à la bibliothèque sont remplacées par l'id
 * de la liste partagée : c'est ainsi qu'un modèle désigne une liste, quel que soit le flux.
 */
function sharedRefs(fields) {
  const listIdOf = new Map(nodes.value.filter((n) => n.type === 'library' && n.data.listId).map((n) => [n.id, n.data.listId]));
  const walk = (list) =>
    list.map((f) => {
      const ref = f.format?.library;
      const next = listIdOf.has(ref) ? { ...f, format: { ...f.format, library: listIdOf.get(ref) } } : f;
      return f.children ? { ...next, children: walk(f.children) } : next;
    });
  return walk(fields);
}

/** Une liste vient d'être reliée à la bibliothèque : les champs du flux qui désignaient son nœud désignent la liste. */
function relinkFieldsToList(nodeId, listId) {
  for (const n of nodes.value) {
    if ((n.type !== 'source' && n.type !== 'target') || !allFields(n.data.fields).some((f) => f.format?.library === nodeId)) continue;
    const walk = (list) =>
      list.map((f) => {
        const next = f.format?.library === nodeId ? { ...f, format: { ...f.format, library: listId } } : f;
        return f.children ? { ...next, children: walk(f.children) } : next;
      });
    updateNodeData(n.id, { fields: walk(n.data.fields) });
  }
}

/** Les deux sortes d'éléments de la bibliothèque, et comment un nœud du flux s'y relie. */
const KINDS = {
  model: {
    key: 'modelId',
    itemOf: modelOf,
    diverged: (data) => !sameFields(sharedRefs(data.fields), modelOf(data).fields),
    content: (node) => ({ fields: stripFields(sharedRefs(node.data.fields)), sample: sampleOfNode(node) }),
    create: (name, node, folderId) => createModel(name, sharedRefs(node.data.fields), sampleOfNode(node), folderId),
    impact: (id, c, from) => impactOf(id, c.fields, from),
    apply: (id, c, from) => applyModel(id, c.fields, { sample: c.sample, from }),
    revert: revertNode,
    texts: {
      createTitle: t('Enregistrer dans la bibliothèque', 'Save to the library'),
      nameLabel: t('Nom du modèle', 'Model name'),
      created: (name) => t(`Modèle « ${name} » ajouté à la bibliothèque.`, `Model “${name}” added to the library.`),
      saveAsTitle: t('Enregistrer sous un nouveau modèle', 'Save as a new model'),
      variant: (origin, name) => t(`Nouveau modèle « ${name} » créé ; « ${origin} » n’a pas changé.`, `New model “${name}” created; “${origin}” did not change.`),
      changeTitle: (name) => t(`Modifier le modèle « ${name} » ?`, `Change the model “${name}”?`),
      saved: (name) => t(`Modèle « ${name} » enregistré.`, `Model “${name}” saved.`),
    },
  },
  list: {
    key: 'listId',
    itemOf: listOf,
    diverged: (data) => !sameList(data, listOf(data)),
    content: (node) => listContent(node.data),
    create: (name, node, folderId) => createList(name, node.data, folderId),
    impact: (id, c, from) => listImpactOf(id, c, from),
    apply: (id, c, from) => applyList(id, c, { from }),
    revert: revertListNode,
    texts: {
      createTitle: t('Enregistrer dans la bibliothèque', 'Save to the library'),
      nameLabel: t('Nom de la liste de valeurs', 'Value list name'),
      created: (name) => t(`Liste « ${name} » ajoutée à la bibliothèque.`, `List “${name}” added to the library.`),
      saveAsTitle: t('Enregistrer sous une nouvelle liste', 'Save as a new list'),
      variant: (origin, name) => t(`Nouvelle liste « ${name} » créée ; « ${origin} » n’a pas changé.`, `New list “${name}” created; “${origin}” did not change.`),
      changeTitle: (name) => t(`Modifier la liste « ${name} » ?`, `Change the list “${name}”?`),
      saved: (name) => t(`Liste « ${name} » enregistrée.`, `List “${name}” saved.`),
    },
  },
};

/** Nom proposé pour une variante : celui d'origine suivi de « (variante) », sans répéter le nom du nœud s'il est le même. */
const variantName = (origin, label) => (origin ? `${origin.name} ${t('(variante)', '(variant)')}` : label);

/** Lien d'un nœud du flux avec la bibliothèque (bandeau ModelLink, bouton « base de données + »), pour une sorte d'élément. */
function libraryLink(kindName) {
  const kind = KINDS[kindName];

  async function create(nodeId) {
    const node = findNode(nodeId);
    if (!node) return;
    const name = await askText({ title: kind.texts.createTitle, label: kind.texts.nameLabel, initial: node.data.label, okLabel: t('Enregistrer', 'Save') });
    if (!name) return;
    const item = kind.create(name, node, null);
    updateNodeData(nodeId, { [kind.key]: item.id });
    if (kindName === 'list') relinkFieldsToList(nodeId, item.id);
    notify(kind.texts.created(name), 'success');
  }

  async function saveAs(nodeId) {
    const node = findNode(nodeId);
    if (!node) return;
    const origin = kind.itemOf(node.data);
    const name = await askText({ title: kind.texts.saveAsTitle, label: kind.texts.nameLabel, initial: variantName(origin, node.data.label), okLabel: t('Créer', 'Create') });
    if (!name) return;
    const item = kind.create(name, node, origin ? folderOf(origin.id) : null);
    updateNodeData(nodeId, { [kind.key]: item.id });
    // Une variante de liste : les champs du flux qui désignaient ce nœud (ou l'ancienne liste) suivent la nouvelle.
    if (kindName === 'list') {
      relinkFieldsToList(nodeId, item.id);
      if (origin && !nodes.value.some((n) => n.data?.listId === origin.id)) relinkFieldsToList(origin.id, item.id);
    }
    notify(kind.texts.variant(origin?.name ?? '', name), 'success');
  }

  async function save(nodeId) {
    const node = findNode(nodeId);
    const item = kind.itemOf(node?.data);
    if (!item) return;
    const from = { mappingId: workspace.activeId, nodeId };
    const content = kind.content(node);
    const { changes, flows } = kind.impact(item.id, content, from);
    if (flows.length) {
      const choice = await askImpact({
        title: kind.texts.changeTitle(item.name),
        intro: t(
          'Cet élément de la bibliothèque est aussi utilisé ailleurs : la modification s’appliquera à tous ces mappings, sauf là où il a été modifié localement. Pour ne rien changer ailleurs, enregistrez-le sous un nouveau nom.',
          'It is also used elsewhere: the change will apply to all these mappings, except where it was changed locally. To change nothing elsewhere, save as a new item.',
        ),
        changes,
        flows,
        allowSaveAs: true,
        saveAsLabel: kind.texts.saveAsTitle,
        applyLabel: t('Appliquer à tous les mappings', 'Apply to all mappings'),
      });
      if (choice === 'saveAs') return saveAs(nodeId);
      if (choice !== 'apply') return;
    }
    kind.apply(item.id, content, from);
    notify(kind.texts.saved(item.name), 'success');
  }

  return {
    linkedId: (data) => data?.[kind.key],
    itemOf: kind.itemOf,
    diverged: kind.diverged,
    create,
    save,
    saveAs,
    revert: (nodeId) => kind.revert(workspace.activeId, nodeId),
    unlink: (nodeId) => updateNodeData(nodeId, { [kind.key]: undefined }),
    // Les champs d'un modèle composite viennent de son schéma : ils ne s'enregistrent pas depuis un flux.
    canSave: (item) => !isComposite(item),
    otherFlows: (id) => otherUsage.value.get(id) ?? 0,
  };
}

provide(MODEL_LINK_KEY, libraryLink('model'));
provide(LIST_LINK_KEY, libraryLink('list'));

/**
 * Origine des champs d'un modèle composite (préfixe affiché devant leur nom) : dans son schéma ouvert, pour sa cible ;
 * dans un flux, pour un nœud relié à un modèle composite (d'après le schéma enregistré de ce modèle).
 */
const fieldOrigins = computed(() => {
  const map = new Map();
  const fill = (nodeId, fields, graph, outputId) => {
    const origins = new Map();
    for (const f of allFields(fields)) {
      const names = originsOf(graph.nodes, graph.edges, outputId, f.id);
      if (names.length) origins.set(f.id, names.join(' + '));
    }
    map.set(nodeId, origins);
  };
  const live = { nodes: nodes.value, edges: edges.value };
  if (compositeOpen.value) {
    const out = compositeOutput(live);
    if (out) fill(out.id, out.data.fields, live, out.id);
  }
  for (const n of nodes.value) {
    const item = n.data?.modelId ? find(n.data.modelId) : null;
    if (!isComposite(item)) continue;
    const out = compositeOutput(item.graph);
    if (out) fill(n.id, n.data.fields, item.graph, out.id);
  }
  return map;
});
provide(FIELD_ORIGIN_KEY, (nodeId, fieldId) => fieldOrigins.value.get(nodeId)?.get(fieldId) ?? '');

const LOCKED_MESSAGE = () => t('Schéma verrouillé : déverrouillez-le (cadenas en bas à gauche) pour ajouter un nœud.', 'Schema locked: unlock it (padlock at the bottom left) to add a node.');

/** Position dans le schéma : là où un élément a été lâché (`screen`), sinon une fraction (`fx`, `fy`) de la vue. */
function flowPosition(screen, fx, fy) {
  const rect = vueFlowRef.value.getBoundingClientRect();
  return project(screen ? { x: screen.x - rect.left, y: screen.y - rect.top } : { x: rect.width * fx, y: rect.height * fy });
}

/** Nœud Liste de valeurs relié à une liste de la bibliothèque. */
const listNode = (list, position) => ({ id: uid('library'), type: 'library', position, data: { label: list.name, ...listContent(list), listId: list.id } });

/**
 * Ajoute un élément de la bibliothèque au flux ouvert : un modèle comme source ou comme cible, une liste comme nœud
 * Liste de valeurs. Les listes que désignent les champs d'un modèle ne sont pas ajoutées : elles sont contrôlées
 * depuis la bibliothèque ; un nœud n'est utile que pour un transcodage (sa sortie Table) ou ses valeurs. `screen` :
 * point de l'écran où le placer (là où il a été lâché).
 */
async function useModel(itemId, kind, screen = null) {
  const item = find(itemId);
  if (!item) return;
  // Le nœud s'ajoute au flux : celui-ci revient à l'écran.
  if (editingModelId.value) {
    if (!(await leaveModel())) return;
    editingModelId.value = null;
  }
  if (schemaLocked.value) return notify(LOCKED_MESSAGE(), 'warning');
  if (isComposite(activeMapping()) && usesComposite(itemId, workspace.activeId)) {
    return notify(
      t(`« ${item.name} » utilise ce modèle composite : il ne peut pas y être ajouté.`, `“${item.name}” uses this composite model: it cannot be added to it.`),
      'warning',
    );
  }
  if (item.type === 'valuelist') {
    addNodes([listNode(item, flowPosition(screen, 0.1, 0.6))]);
    return notify(t(`Liste « ${item.name} » ajoutée au mapping.`, `List “${item.name}” added to the mapping.`), 'success');
  }
  const position = flowPosition(screen, kind === 'source' ? 0.15 : 0.6, 0.25);
  const data = { label: item.name, fields: JSON.parse(JSON.stringify(item.fields)), modelId: itemId, ...(kind === 'source' && { sample: sampleForSource(item) }) };
  addNodes([{ id: uid(kind), type: kind, position, data }]);
  notify(
    kind === 'source'
      ? t(`Modèle « ${item.name} » ajouté au mapping comme source.`, `Model “${item.name}” added to the mapping as a source.`)
      : t(`Modèle « ${item.name} » ajouté au mapping comme cible.`, `Model “${item.name}” added to the mapping as a target.`),
    'success',
  );
}

/** Modèle glissé depuis le panneau et lâché sur le schéma : `{ id, x, y }` (écran), en attente du choix source / cible. */
const modelDrop = ref(null);
const isModelDrag = (e) => [...(e.dataTransfer?.types ?? [])].includes(MODEL_DRAG_TYPE);

function onModelDragOver(e) {
  if (!isModelDrag(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
}

function onModelDrop(e) {
  if (!isModelDrag(e)) return;
  e.preventDefault();
  const id = e.dataTransfer.getData(MODEL_DRAG_TYPE);
  if (!id) return;
  if (schemaLocked.value) return notify(LOCKED_MESSAGE(), 'warning');
  // Une liste s'ajoute directement ; pour un modèle, on choisit source ou cible.
  if (find(id)?.type === 'valuelist') return useModel(id, 'library', { x: e.clientX, y: e.clientY });
  modelDrop.value = { id, x: e.clientX, y: e.clientY };
}

function dropModelAs(kind) {
  const { id, x, y } = modelDrop.value;
  modelDrop.value = null;
  useModel(id, kind, { x, y });
}

// ── Éditeur de la bibliothèque ──────────────────────────────
// Un modèle ou une liste s'ouvre à la place du flux, sur son propre canevas (ModelEditor) ; le flux reste en mémoire.

/** Élément de la bibliothèque ouvert dans son éditeur (`null` : le flux est affiché). */
const editingModelId = ref(null);
const modelEditorRef = ref(null);

/** Quitter l'élément ouvert : avec accord s'il a des modifications non enregistrées. */
const leaveModel = async () =>
  !modelEditorRef.value?.dirty ||
  askConfirm({
    title: t('Modifications non enregistrées', 'Unsaved changes'),
    text: t('L’élément de la bibliothèque ouvert a des modifications non enregistrées. Les abandonner ?', 'The open library item has unsaved changes. Discard them?'),
    okLabel: t('Abandonner', 'Discard'),
    danger: true,
  });

async function editModel(id) {
  // Un modèle composite s'ouvre comme un flux : son schéma.
  // Déjà affiché, sauf si un modèle ou une liste est ouvert par-dessus : on y revient alors.
  if (isComposite(find(id))) return id === workspace.activeId && !editingModelId.value ? undefined : openFlow(id);
  if (!(await leaveComposite())) return;
  if (id === editingModelId.value || !(await leaveModel())) return;
  saveGraph();
  nodeMenu.value = null;
  addMenu.value = null;
  editingModelId.value = id;
}

async function closeModelEditor() {
  if (!(await leaveModel())) return;
  editingModelId.value = null;
}

/**
 * Nouveau modèle composite dans la bibliothèque (dans le dossier `folderId`), vide ou copié du mapping `fromId` ;
 * son schéma s'ouvre aussitôt.
 */
async function newComposite(folderId = null, fromId = null) {
  if (fromId) saveGraph();
  const from = fromId ? find(fromId) : null;
  if (from && !compositeOutput(from.graph)) {
    return notify(t('Ce mapping n’a pas de cible : c’est elle qui donne les champs du modèle composite.', 'This mapping has no target: it gives the fields of the composite model.'), 'warning');
  }
  const name = await askText({
    title: t('Nouveau modèle composite', 'New composite model'),
    label: t('Nom du modèle composite', 'Composite model name'),
    initial: from ? from.name : t('Modèle composite', 'Composite model'),
    okLabel: t('Créer', 'Create'),
  });
  if (!name) return;
  const item = createComposite(name, from?.graph ?? null, folderId);
  await openFlow(item.id);
  notify(
    t(
      `Modèle composite « ${name} » créé : ajoutez ses sources (glissez des modèles), reliez-les à sa cible (« Rechercher par clé » pour une jointure).`,
      `Composite model “${name}” created: add its sources (drag models), link them to its target (“Look up by key” for a join).`,
    ),
    'success',
  );
}

/** Ouvre un flux de la collection (et ferme l'éditeur de la bibliothèque s'il était ouvert). */
async function openFlow(id) {
  if (editingModelId.value && !(await leaveModel())) return;
  if (id !== workspace.activeId && !(await leaveComposite())) return;
  editingModelId.value = null;
  // Sans id : seulement revenir au mapping (un nouveau mapping vient d'être ouvert par le panneau).
  if (id) workspace.activeId = id;
}

// Élément supprimé pendant qu'il est ouvert : retour au flux.
watch(
  () => editingModelId.value && !find(editingModelId.value),
  (gone) => gone && (editingModelId.value = null),
);

async function saveEditedModel(payload) {
  const id = editingModelId.value;
  const result = await commitLibraryEdit(id, payload);
  if (result === 'applied') modelEditorRef.value?.reload();
  else if (result?.created) editingModelId.value = result.created; // la variante créée s'ouvre à sa place
}

/**
 * Enregistre une modification faite dans la bibliothèque (`payload` : `{ name, fields, sample }` pour un modèle,
 * `{ name, list }` pour une liste). Si le contenu change et que des flux l'utilisent, avertit d'abord. Rend
 * `applied`, `{ created }` (enregistré sous un nouvel élément) ou `null` (annulé).
 */
async function commitLibraryEdit(id, payload) {
  const item = find(id);
  if (!item) return null;
  const isList = item.type === 'valuelist';
  const kind = KINDS[isList ? 'list' : 'model'];
  const content = isList ? payload.list : { fields: payload.fields, sample: payload.sample };
  const changed = isList ? !sameList(content, item) : !sameFields(content.fields, item.fields);
  const { changes, flows } = kind.impact(id, content, null);
  if (flows.length && changed) {
    const choice = await askImpact({
      title: kind.texts.changeTitle(item.name),
      intro: t(
        'Cet élément de la bibliothèque est utilisé par des mappings : la modification s’y appliquera, sauf là où il a été modifié localement.',
        'It is used by mappings: the change will apply to them, except where it was changed locally.',
      ),
      changes,
      flows,
      allowSaveAs: true,
      saveAsLabel: kind.texts.saveAsTitle,
      applyLabel: t('Appliquer', 'Apply'),
    });
    if (choice === 'saveAs') {
      const name = await askText({ title: kind.texts.saveAsTitle, label: kind.texts.nameLabel, initial: variantName(item, payload.name), okLabel: t('Créer', 'Create') });
      if (!name) return null;
      const created = isList ? createList(name, content, folderOf(id)) : createModel(name, content.fields, content.sample, folderOf(id));
      notify(kind.texts.variant(item.name, name), 'success');
      return { created: created.id };
    }
    if (choice !== 'apply') return null;
  }
  if (payload.name && payload.name !== item.name) renameItem(id, payload.name);
  if (isList) applyList(id, content);
  else applyModel(id, content.fields, { sample: content.sample });
  notify(kind.texts.saved(item.name), 'success');
  return 'applied';
}

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
      dataFiles.set(id, { name, error: `${t('JSON invalide', 'Invalid JSON')} : ${e.message}` });
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
      : checkDocument(node.data.fields, file.doc, libraries.value);
    for (const p of problems) {
      const issue = { level: p.level, message: `${t('Fichier', 'File')} : ${p.path ? `${p.path} — ` : ''}${describeProblem(p)}` };
      const key = p.fieldId ?? '';
      issues.set(key, [...(issues.get(key) ?? []), issue]);
      list.push({ nodeId: id, fieldId: key, path: `${node.data.label} › ${file.name}${p.path ? ` › ${p.path}` : ''}`, level: p.level, message: describeProblem(p) });
    }
    byNode.set(id, issues);
  }
  return { byNode, list };
}

/** Bibliothèques de valeurs du schéma (nœuds Bibliothèque), pour les règles et les contrôles des champs. */
/** Listes de la bibliothèque sans nœud dans le flux : les champs qui les désignent sont contrôlés quand même. */
const sharedLists = computed(() => libraryListNodes(new Set(nodes.value.map((n) => n.type === 'library' && n.data.listId).filter(Boolean))));
const libraries = computed(() => librariesOf([...nodes.value, ...sharedLists.value]));
provide(LIBRARIES_KEY, libraries);

const results = computed(() => {
  const docs = new Map([...dataFiles].filter(([, f]) => f.doc).map(([id, f]) => [id, f.doc]));
  const targets = validateTargets(nodes.value, edges.value, sharedLists.value);
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
  const id = uid(kind === 'source' || kind === 'target' || kind === 'library' ? kind : 'n');
  let node;
  let handle;

  if (kind === 'source' || kind === 'target') {
    // Tiré depuis le bon côté : on crée directement le champ correspondant.
    const matches = link && (kind === 'source') === (link.side === 'target');
    const field = matches ? fieldFromSocket(link.socket.name.replace(/\s+/g, '_').toLowerCase(), link.socket.type) : newField([], 'id');
    node =
      kind === 'source'
        ? { id, type: 'source', position, data: { label: t('Nouvelle source', 'New source'), fields: [field], sample: '{}' } }
        : { id, type: 'target', position, data: { label: t('Nouvelle cible', 'New target'), fields: [field] } };
    if (matches) handle = field.id;
  } else if (kind === 'library') {
    // Tirée depuis une entrée objet (la Table d'un Transcoder) : une table de correspondance ; sinon sa liste de valeurs.
    const table = link?.side === 'target' && link.socket.type === 'object';
    node = { id, type: 'library', position, data: { label: t('Nouvelle liste de valeurs', 'New value list'), item: 'string', values: [], ...(table && { mapped: true, outItem: 'string', targets: [] }) } };
    if (link?.side === 'target') handle = table ? LIBRARY_TABLE : LIBRARY_OUTPUT;
  } else {
    const def = TRANSFORMS[kind];
    node = { id, type: 'transform', position, data: { kind, params: initialParams(TRANSFORMS[kind]), values: {} } };
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
  // Éditeur de modèles ouvert : les raccourcis du flux ne s'appliquent pas (Ctrl S enregistre le modèle).
  if (editingModelId.value) {
    if (ctrl && key === 's' && !e.shiftKey) {
      e.preventDefault();
      modelEditorRef.value?.save();
    } else if (ctrl && key === 's') {
      e.preventDefault();
      downloadDocument();
    } else if (ctrl && key === 'o') {
      e.preventDefault();
      openDocument();
    } else if (e.key === '?' && !isEditable(e.target)) {
      shortcutsOpen.value = true;
    }
    return;
  }
  if (ctrl && (key === 's' || key === 'o')) {
    e.preventDefault();
    if (key === 'o') openDocument();
    else downloadDocument();
    return;
  }
  if (placing.value && key === 'escape') return endPlacing(false);
  if (isEditable(e.target)) return;
  if (e.key === '?') {
    e.preventDefault();
    shortcutsOpen.value = true;
    return;
  }
  if (schemaLocked.value) {
    if (ctrl && (key === 'z' || key === 'y')) {
      e.preventDefault();
      notify(t('Schéma verrouillé : déverrouillez-le (cadenas en bas à gauche) pour annuler ou rétablir.', 'Schema locked: unlock it (padlock at the bottom left) to undo or redo.'), 'warning');
    } else if (e.shiftKey && key === 'a') {
      e.preventDefault();
      notify(t('Schéma verrouillé : déverrouillez-le (cadenas en bas à gauche) pour ajouter un nœud.', 'Schema locked: unlock it (padlock at the bottom left) to add a node.'), 'warning');
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
  const node = { id, type: 'transform', position: { x: p.x - 100, y: p.y - 40 }, data: { kind, params: initialParams(TRANSFORMS[kind]), values: {} } };
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
  const kept = locked
    ? t(
        ` (${locked} nœud${locked > 1 ? 's' : ''} verrouillé${locked > 1 ? 's' : ''} laissé${locked > 1 ? 's' : ''} en place)`,
        ` (${count(locked, 'nœud verrouillé', 'locked node', 'nœuds verrouillés')} left in place)`,
      )
    : '';
  notify(`${t('Schéma réorganisé', 'Schema rearranged')}${kept}.`, 'success', {
    label: t('Annuler', 'Undo'),
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
    if ('label' in data) data.label = `${data.label} (${t('copie', 'copy')})`;
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
    { label: allCollapsed ? t('Déplier', 'Expand') : t('Replier', 'Collapse'), action: () => patchNodes(targets, () => ({ collapsed: !allCollapsed })) },
    ...(trees.length
      ? [
          { label: t('Déplier toute l’arborescence', 'Expand the whole tree'), action: () => tree(false) },
          { label: t('Replier toute l’arborescence', 'Collapse the whole tree'), action: () => tree(true) },
        ]
      : []),
    ...(groupable.length
      ? [
          {
            label: groupable.length > 1 ? t('Grouper la sélection', 'Group the selection') : t('Créer un groupe autour', 'Create a group around'),
            hint: 'Ctrl G',
            disabled: ro,
            action: () => groupSelection(groupable),
          },
        ]
      : []),
    ...(grouped.length ? [{ label: t('Sortir du groupe', 'Remove from the group'), disabled: ro, action: () => rebuild((ns) => reparent(ns, grouped, null)) }] : []),
    ...(groups.length
      ? [{ label: t('Dégrouper (garder les nœuds)', 'Ungroup (keep the nodes)'), disabled: ro, action: () => rebuild((ns) => removeKeepingChildren(ns, groups)) }]
      : []),
    { label: t('Dupliquer', 'Duplicate'), hint: 'Ctrl D', disabled: ro, action: () => duplicate(ids) },
    { label: allLocked ? t('Déverrouiller', 'Unlock') : t('Verrouiller', 'Lock'), disabled: ro, action: () => patchNodes(targets, () => ({ locked: !allLocked })) },
    {
      label:
        unlocked.length && unlocked.length < ids.length
          ? t(`Supprimer (${unlocked.length} non verrouillé${unlocked.length > 1 ? 's' : ''})`, `Delete (${unlocked.length} unlocked)`)
          : t('Supprimer', 'Delete'),
      hint: t('Suppr', 'Del'),
      danger: true,
      disabled: ro || !unlocked.length,
      action: () => deleteNodes(unlocked),
    },
  ];
});
</script>
