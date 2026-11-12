<template>
  <div class="node node-library" :class="{ selected, collapsed: data.collapsed, locked: readOnly, mapped }">
    <div class="node-header" :style="{ background: HEADER_COLORS.library }">
      <CollapseButton :node-id="id" :collapsed="data.collapsed" />
      <span class="node-kind">{{ t('Bibliothèque', 'Library') }}</span>
      <input class="node-title nodrag" :disabled="readOnly" :value="data.label" @input="updateNodeData(id, { label: $event.target.value })" />
      <a class="icon-btn help-link nodrag" href="/noeuds#library" :title="t('Documentation de ce nœud', 'Documentation of this node')">?</a>
      <button class="icon-btn nodrag" :title="mapped ? t('Éditer toutes les lignes (une par ligne : valeur ; correspondance)', 'Edit all the rows (one per line: value ; mapping)') : t('Éditer toutes les valeurs (une par ligne)', 'Edit all the values (one per line)')" @click="editing = true">≡</button>
      <LockButton :node-id="id" :locked="data.locked" />
      <template v-if="data.collapsed">
        <Handle :id="LIBRARY_OUTPUT" type="source" :position="Position.Right" :connectable="false" class="socket hidden-socket" />
        <Handle v-if="mapped" :id="LIBRARY_TABLE" type="source" :position="Position.Right" :connectable="false" class="socket hidden-socket" />
      </template>
    </div>

    <div v-if="!data.collapsed" class="node-body">
      <div class="row out-row">
        <span class="out-value">{{ count(rows.length, 'valeur', 'value', 'valeurs', 'values') }}</span>
        <span>{{ t('Valeurs', 'Values') }}</span>
        <Handle :id="LIBRARY_OUTPUT" type="source" :position="Position.Right" v-bind="socketAttrs(listOf(item))" />
      </div>
      <div v-if="mapped" class="row out-row">
        <span class="out-value">{{ count(mappedCount, 'correspondance', 'mapping') }}</span>
        <span>{{ t('Table', 'Table') }}</span>
        <Handle :id="LIBRARY_TABLE" type="source" :position="Position.Right" v-bind="socketAttrs('object')" />
      </div>

      <div class="row library-types">
        <select class="nodrag" :disabled="readOnly" :value="item" :title="t('Type des valeurs', 'Type of the values')" @change="setTypes($event.target.value, outItem)">
          <option v-for="k in LIBRARY_TYPES" :key="k" :value="k">{{ socketTitle(k) }}</option>
        </select>
        <template v-if="mapped">
          <span class="library-arrow">→</span>
          <select class="nodrag" :disabled="readOnly" :value="outItem" :title="t('Type des correspondances', 'Type of the mappings')" @change="setTypes(item, $event.target.value)">
            <option v-for="k in LIBRARY_TYPES" :key="k" :value="k">{{ socketTitle(k) }}</option>
          </select>
        </template>
      </div>
      <label class="row library-toggle nodrag">
        <input type="checkbox" :disabled="readOnly" :checked="mapped" @change="setMapped($event.target.checked)" />
        <span :title="t('Associe à chaque valeur une valeur d’un autre référentiel (FRA → FR), à utiliser avec le nœud Transcoder', 'Associates each value with a value of another reference list (FRA → FR), to use with the Transcode node')">
          {{ t('Table de correspondance', 'Mapping table') }}
        </span>
      </label>

      <div class="library-values">
        <div v-for="(r, i) in rows" :key="`${i}:${r.value}`" class="row library-value">
          <input
            class="value-input nodrag"
            :disabled="readOnly"
            :type="inputType(item)"
            :value="r.value"
            :title="String(r.value)"
            @change="edit(i, { value: $event.target.value })"
            @keydown.enter="$event.target.blur()"
          />
          <template v-if="mapped">
            <span class="library-arrow">→</span>
            <input
              class="value-input nodrag"
              :disabled="readOnly"
              :type="inputType(outItem)"
              :value="r.target ?? ''"
              :placeholder="t('aucune', 'none')"
              :title="r.target === null ? t('Sans correspondance : Transcoder donne sa valeur « Si absente »', 'No mapping: Transcode gives its “If missing” value') : String(r.target)"
              @change="edit(i, { target: $event.target.value })"
              @keydown.enter="$event.target.blur()"
            />
          </template>
          <button v-if="!readOnly" class="icon-btn danger nodrag" :title="t('Retirer la ligne', 'Remove the row')" @click="removeAt(i)">×</button>
        </div>
        <p v-if="!rows.length" class="library-empty">{{ t('Aucune valeur : tout champ qui s’y réfère sera refusé.', 'No values: any field referring to it will be rejected.') }}</p>
      </div>

      <div v-if="!readOnly" class="row library-value">
        <input
          ref="draftInput"
          v-model="draft.value"
          class="value-input nodrag"
          :type="inputType(item)"
          :placeholder="t('+ Ajouter (Entrée)', '+ Add (Enter)')"
          @keydown.enter="add"
        />
        <template v-if="mapped">
          <span class="library-arrow">→</span>
          <input v-model="draft.target" class="value-input nodrag" :type="inputType(outItem)" @keydown.enter="add" />
        </template>
      </div>

      <div class="row library-usage" :title="usages.join('\n')">
        {{ usages.length ? t(`Utilisée par ${count(usages.length, 'champ', 'field')}`, `Used by ${count(usages.length, 'champ', 'field')}`) : t('Utilisée par aucun champ (règles ⚙ d’un champ)', 'Used by no field (rules ⚙ of a field)') }}
      </div>
    </div>

    <TextDialog
      v-model="editing"
      :title="`${mapped ? t('Correspondances', 'Mappings') : t('Valeurs', 'Values')} — ${data.label}`"
      :description="
        mapped
          ? t(
              'Une ligne par valeur : « valeur ; correspondance » (ou séparées par une tabulation, comme un copier-coller depuis un tableur). Une ligne sans correspondance est gardée. Les lignes vides et les doublons sont ignorés.',
              'One line per value: “value ; mapping” (or separated by a tab, as when pasting from a spreadsheet). A line without a mapping is kept. Empty lines and duplicates are ignored.',
            )
          : t(
              'Une valeur par ligne (espaces autour retirés). Les lignes vides et les doublons sont ignorés ; une valeur illisible pour le type choisi est refusée.',
              'One value per line (surrounding spaces removed). Empty lines and duplicates are ignored; a value unreadable for the chosen type is rejected.',
            )
      "
      :initial="dialogText()"
      :actions="dialogActions"
      :read-only="readOnly"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue';
import { Handle, Position, useVueFlow } from '@vue-flow/core';
import TextDialog from '../TextDialog.vue';
import CollapseButton from './CollapseButton.vue';
import LockButton from './LockButton.vue';
import { pathLabel } from '../../lib/fields';
import { count, t } from '../../lib/i18n';
import { fromRows, LIBRARY_OUTPUT, LIBRARY_TABLE, LIBRARY_TYPES, parseLibraryValue, rowsOf } from '../../lib/libraries';
import { HEADER_COLORS, listOf, socketTitle } from '../../lib/types';
import { socketAttrs, useReadOnly } from './shared';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: Boolean,
});

const { updateNodeData, updateNodeInternals, nodes, edges, removeEdges } = useVueFlow();
const readOnly = useReadOnly(() => props.data.locked);
const editing = ref(false);
const draft = reactive({ value: '', target: '' });
const draftInput = ref(null);

const item = computed(() => props.data.item ?? 'string');
const outItem = computed(() => props.data.outItem ?? 'string');
const mapped = computed(() => !!props.data.mapped);
const rows = computed(() => rowsOf(props.data));
const mappedCount = computed(() => rows.value.filter((r) => r.target !== null).length);
const inputType = (type) => (type === 'date' ? 'date' : type === 'string' ? 'text' : 'number');

/** Enregistre les lignes, converties selon les types (`types` : nouveaux types éventuels), sans doublon ni valeur vide. */
const setRows = (next, types = {}) => updateNodeData(props.id, { ...types, ...fromRows(next, types.item ?? item.value, types.outItem ?? outItem.value) });

function add() {
  if (parseLibraryValue(item.value, draft.value) === undefined) return;
  setRows([...rows.value, { value: draft.value, target: draft.target }]);
  Object.assign(draft, { value: '', target: '' });
  nextTick(() => draftInput.value?.focus());
}

/** Modifie une ligne ; une valeur vidée retire la ligne. */
const edit = (i, patch) => setRows(rows.value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
const removeAt = (i) => setRows(rows.value.filter((_, j) => j !== i));

/** Changement de type : les valeurs sont converties ; celles qui ne s'y prêtent pas sont retirées (ou perdent leur correspondance). */
const setTypes = (it, ot) => setRows(rows.value, { item: it, outItem: ot });

/** Sans table de correspondance, la sortie Table disparaît avec ses liens (les correspondances saisies sont gardées). */
function setMapped(on) {
  if (!on) removeEdges(edges.value.filter((e) => e.source === props.id && e.sourceHandle === LIBRARY_TABLE));
  updateNodeData(props.id, { mapped: on });
  nextTick(() => updateNodeInternals([props.id]));
}

// ── Édition en bloc ─────────────────────────────────────────

const dialogText = () => rows.value.map((r) => (mapped.value ? `${r.value} ; ${r.target ?? ''}` : String(r.value))).join('\n');

/** « valeur ; correspondance », ou séparées par une tabulation (copier-coller depuis un tableur). */
function splitLine(line) {
  const at = line.indexOf(line.includes('\t') ? '\t' : ';');
  return at < 0 ? { value: line, target: '' } : { value: line.slice(0, at), target: line.slice(at + 1) };
}

const dialogActions = [
  {
    get label() {
      return t('Enregistrer', 'Save');
    },
    primary: true,
    run: (text) => {
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
      // Sans la colonne Correspondance, une valeur gardée garde aussi sa correspondance.
      const kept = (l) => rows.value.find((r) => String(r.value) === l.trim())?.target ?? '';
      const next = lines.map((l) => (mapped.value ? splitLine(l) : { value: l, target: kept(l) }));
      const invalid = (type, v) => String(v).trim() !== '' && parseLibraryValue(type, v) === undefined;
      for (const r of next) {
        const [bad, type] = invalid(item.value, r.value) ? [r.value, item.value] : mapped.value && invalid(outItem.value, r.target) ? [r.target, outItem.value] : [];
        if (bad !== undefined) throw new Error(t(`« ${bad.trim()} » : ${socketTitle(type).toLowerCase()} illisible`, `“${bad.trim()}”: unreadable ${socketTitle(type).toLowerCase()}`));
      }
      setRows(next);
      return true;
    },
  },
];

// ── Champs qui s'y réfèrent ────────────────────────────────

/** Champs des sources et cibles qui se réfèrent à cette bibliothèque (« Boutique.client.pays »). */
const usages = computed(() => nodes.value.flatMap((n) => (n.type === 'source' || n.type === 'target' ? usagesIn(n) : [])));

function usagesIn(node) {
  const out = [];
  const walk = (fields, parents) => {
    for (const f of fields) {
      const chain = [...parents, f];
      if (f.format?.library === props.id) out.push(`${node.data.label}.${pathLabel(chain)}`);
      walk(f.children ?? [], chain);
    }
  };
  walk(node.data.fields, []);
  return out;
}
</script>
