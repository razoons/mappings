<template>
  <div class="preview">
    <div class="node node-transform locked">
      <div class="node-header" :style="{ background: HEADER_COLORS[def.category] }">
        <span class="node-title-static pl-1">{{ def.label }}</span>
      </div>

      <div class="node-body">
        <div v-for="o in def.outputs" :key="o.id" class="row out-row">
          <span>{{ o.label }}</span>
          <span class="vue-flow__handle vue-flow__handle-right" v-bind="socketAttrs(o.type)" />
          <span class="wire out" :style="{ background: SOCKET_COLORS[baseOf(o.type)] }" />
          <span class="pill out" :title="show(outputs[o.id])">{{ show(outputs[o.id]) }}</span>
        </div>

        <div v-for="p in (def.params ?? []).filter((p) => !p.when || p.when(params))" :key="p.id" class="row">
          <select v-if="p.options" disabled :title="p.label">
            <option>{{ p.optionLabel ? p.optionLabel(params[p.id], params) : params[p.id] }}</option>
          </select>
          <label v-else class="param-input">
            <span>{{ p.label }}</span>
            <input disabled :value="params[p.id]" />
          </label>
        </div>

        <div v-for="i in inputs" :key="i.id" class="row in-row">
          <span class="vue-flow__handle vue-flow__handle-left" v-bind="socketAttrs(i.type, i.perItem)" />
          <span>{{ i.label }}<span v-if="i.perItem" class="per-item-mark"> ∀</span></span>
          <template v-if="wired(i.id)">
            <span class="wire in" :style="{ background: SOCKET_COLORS[baseOf(i.type)] }" />
            <span class="pill in" :class="{ each: each[i.id] }" :title="incoming(i.id)">{{ incoming(i.id) }}</span>
          </template>
          <template v-else-if="!isList(i.type) && (i.default !== undefined || !i.perItem)">
            <input v-if="i.type === 'boolean'" type="checkbox" disabled :checked="coerce(inline(i), 'boolean')" />
            <input v-else class="inline-input" disabled :value="inline(i)" />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { socketAttrs } from './nodes/shared';
import { t } from '../lib/i18n';
import { isPlainObject } from '../lib/lists';
import { inputsOf, paramsWithDefaults } from '../lib/transforms';
import { baseOf, coerce, HEADER_COLORS, isList, SOCKET_COLORS } from '../lib/types';

/** Un nœud dessiné avec un exemple : valeurs d'entrée, réglages, et sorties calculées par le nœud. */
const props = defineProps({
  def: { type: Object, required: true },
  example: { type: Object, required: true },
});

const values = computed(() => props.example.inputs ?? {});
const each = computed(() => props.example.each ?? {});
const params = computed(() => paramsWithDefaults(props.def, props.example.params ?? {}));

/** Une liste ou un objet arrive par un lien (on ne peut pas les saisir dans le nœud), comme une entrée ∀. */
const wired = (id) => id in each.value || Array.isArray(values.value[id]) || isPlainObject(values.value[id]);
const inline = (i) => values.value[i.id] ?? i.default ?? '';
const label = (l) => (Array.isArray(l) ? t(...l) : l);
const incoming = (id) => (each.value[id] ? label(each.value[id][0]) : show(values.value[id]));

const inputs = computed(() => inputsOf(props.def, { data: { values: values.value } }, Object.keys(values.value).filter(wired)));

const outputs = computed(() => {
  const ctx = {
    connected: wired,
    current: props.example.current,
    item: (id, list, index) => {
      const inp = inputs.value.find((s) => s.id === id);
      const fn = each.value[id]?.[1];
      return coerce(fn ? fn(list[index], index) : inline(inp), inp.type);
    },
  };
  const args = Object.fromEntries(inputs.value.filter((i) => !i.perItem).map((i) => [i.id, coerce(inline(i), i.type)]));
  try {
    const r = props.def.compute(args, params.value, ctx);
    return Object.fromEntries(props.def.outputs.map((o) => [o.id, coerce(r[o.id], o.type)]));
  } catch {
    return {};
  }
});

/** Valeur écrite en entier, façon JSON lisible : "texte", [1, 2], { clé: valeur }, vrai. */
function show(v) {
  if (v === undefined || v === null) return t('vide', 'empty');
  if (v instanceof Date) return isNaN(v.getTime()) ? t('date invalide', 'invalid date') : v.toISOString().replace('T00:00:00.000Z', '').slice(0, 16).replace('T', ' ');
  if (Array.isArray(v)) return `[${v.map(show).join(', ')}]`;
  if (isPlainObject(v)) return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${show(x)}`).join(', ')} }`;
  if (typeof v === 'string') return `"${v}"`;
  if (typeof v === 'boolean') return v ? t('vrai', 'true') : t('faux', 'false');
  if (typeof v === 'number') return String(+v.toFixed(4));
  return String(v);
}
</script>

<style scoped>
/* Le nœud au centre ; les valeurs qui entrent à gauche, le résultat à droite, au bout d'un bout de lien. */
.preview {
  display: flex;
  justify-content: center;
  padding: 8px 210px 12px;
  margin: 4px 0 10px;
  border-radius: 6px;
  background: var(--bg);
  background-image: radial-gradient(var(--dashed) 1px, transparent 1px);
  background-size: 16px 16px;
}
.node {
  flex: none;
  box-shadow: var(--node-shadow);
}
.vue-flow__handle {
  pointer-events: none;
}
.wire {
  position: absolute;
  top: 50%;
  width: 22px;
  height: 2px;
  transform: translateY(-50%);
  opacity: 0.85;
}
.wire.in {
  right: 100%;
}
.wire.out {
  left: 100%;
}
.pill {
  position: absolute;
  top: 50%;
  max-width: 190px;
  padding: 1px 8px;
  transform: translateY(-50%);
  overflow: hidden;
  border: 1px solid var(--node-border);
  border-radius: 10px;
  background: var(--node);
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.pill.in {
  right: calc(100% + 22px);
}
.pill.in.each {
  font-family: inherit;
  font-style: italic;
  color: var(--muted);
}
.pill.out {
  left: calc(100% + 22px);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}
</style>
