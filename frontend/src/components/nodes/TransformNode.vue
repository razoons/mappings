<template>
  <div v-if="!def" class="node">{{ t('Nœud inconnu', 'Unknown node') }} : {{ data.kind }}</div>
  <div v-else class="node node-transform" :class="{ selected, collapsed: data.collapsed, locked: readOnly }">
    <div class="node-header" :style="{ background: HEADER_COLORS[def.category] }">
      <CollapseButton :node-id="id" :collapsed="data.collapsed" />
      <span class="node-title-static">{{ def.label }}</span>
      <a class="icon-btn help-link nodrag" :href="`/noeuds#${data.kind}`" :title="t('Documentation de ce nœud', 'Documentation of this node')">?</a>
      <LockButton :node-id="id" :locked="data.locked" />
      <template v-if="data.collapsed">
        <Handle
          v-for="i in inputs"
          :id="i.id"
          :key="`in-${i.id}`"
          type="target"
          :position="Position.Left"
          :connectable="false"
          class="socket hidden-socket"
        />
        <Handle
          v-for="o in def.outputs"
          :id="o.id"
          :key="`out-${o.id}`"
          type="source"
          :position="Position.Right"
          :connectable="false"
          class="socket hidden-socket"
        />
      </template>
    </div>

    <div v-if="!data.collapsed" class="node-body">
      <div v-for="o in def.outputs" :key="o.id" class="row out-row">
        <span class="out-value" :title="formatValue(outputs[o.id])">{{ formatValue(outputs[o.id]) }}</span>
        <span>{{ o.label }}</span>
        <Handle :id="o.id" type="source" :position="Position.Right" v-bind="socketAttrs(o.type)" />
      </div>

      <div v-for="p in shownParams" :key="p.id" class="row">
        <select v-if="p.options" class="nodrag" :disabled="readOnly" :title="p.label" :value="params[p.id]" @change="setParam(p.id, $event.target.value)">
          <option v-for="o in p.options" :key="o" :value="o">{{ p.optionLabel ? p.optionLabel(o, params) : o }}</option>
        </select>
        <label v-else class="param-input">
          <span>{{ p.label }}</span>
          <input class="nodrag" :disabled="readOnly" :value="params[p.id]" :title="params[p.id]" @input="setParam(p.id, $event.target.value)" />
        </label>
      </div>

      <div
        v-for="i in inputs"
        :key="i.id"
        class="row in-row"
        :class="issueOf(i) && `issue-${issueOf(i).level}`"
        :title="issueOf(i)?.message"
      >
        <Handle :id="i.id" type="target" :position="Position.Left" v-bind="socketAttrs(i.type, i.perItem)" />
        <span>
          <span v-if="issueOf(i)" class="issue-mark">{{ issueOf(i).level === 'error' ? '⛔' : '⚠' }}</span>{{ i.label }}<span v-if="i.perItem" class="per-item-mark" :title="t('Évalué pour chaque élément de la liste', 'Evaluated for each item of the list')"> ∀</span>
        </span>
        <template v-if="hasInlineValue(i)">
          <input
            v-if="i.type === 'boolean'"
            type="checkbox"
            class="nodrag"
            :disabled="readOnly"
            :checked="coerce(valueOf(i), 'boolean')"
            @change="setValue(i.id, String($event.target.checked))"
          />
          <input
            v-else
            class="inline-input nodrag"
            :disabled="readOnly"
            :type="isNumeric(i.type) ? 'number' : i.type === 'date' ? 'date' : 'text'"
            :step="i.type === 'integer' ? 1 : 'any'"
            :placeholder="i.type === 'date' ? '' : '…'"
            :value="valueOf(i)"
            @input="setValue(i.id, $event.target.value)"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, watch } from 'vue';
import { Handle, Position, useVueFlow } from '@vue-flow/core';
import CollapseButton from './CollapseButton.vue';
import LockButton from './LockButton.vue';
import { t } from '../../lib/i18n';
import { inputsOf, paramsWithDefaults, TRANSFORMS } from '../../lib/transforms';
import { coerce, formatValue, HEADER_COLORS, isList, isNumeric } from '../../lib/types';
import { socketAttrs, useReadOnly, useResults } from './shared';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: Boolean,
});

const { updateNodeData, updateNodeInternals, edges } = useVueFlow();
const { outputsOf, issuesOf } = useResults();
const issueOf = (i) => issuesOf(props.id).get(i.id)?.[0];

const readOnly = useReadOnly(() => props.data.locked);
const def = computed(() => TRANSFORMS[props.data.kind]);
const params = computed(() => paramsWithDefaults(def.value, props.data.params));
// Un réglage avec `when` n'apparaît que s'il sert avec les autres réglages (ex. les noms des jours).
const shownParams = computed(() => (def.value.params ?? []).filter((p) => !p.when || p.when(params.value)));
const outputs = computed(() => outputsOf(props.id));
const connected = computed(() => new Set(edges.value.filter((e) => e.target === props.id).map((e) => e.targetHandle)));
/** Entrées affichées (pour « Concaténer » : celles utilisées, plus une libre en bas). */
const inputs = computed(() => inputsOf(def.value, props, [...connected.value]));
// Une entrée apparaît ou disparaît : Vue Flow doit re-mesurer les sockets.
watch(
  () => inputs.value.length,
  () => nextTick(() => updateNodeInternals([props.id])),
);

/** Valeur saisie directement sur une entrée simple non connectée. */
const hasInlineValue = (i) => !connected.value.has(i.id) && !isList(i.type) && (i.default !== undefined || !i.perItem);
const valueOf = (i) => props.data.values[i.id] ?? i.default ?? '';

const setParam = (key, v) => updateNodeData(props.id, { params: { ...props.data.params, [key]: v } });
const setValue = (key, v) => updateNodeData(props.id, { values: { ...props.data.values, [key]: v } });
</script>
