import { allFields, findChain, sourceSocketType, targetSocketType } from './fields';
import { bindsOf, isPlainObject, tagList } from './lists';
import { inputsOf, inputSocket, paramsWithDefaults, TRANSFORMS, variadicId } from './transforms';
import { baseOf, coerce, isList, isNumeric, listOf } from './types';

/** Décrit le socket `handleId` d'un nœud (`{ name, type }`), côté sortie (`source`) ou entrée (`target`). */
export function getSocket(node, handleId, side) {
  if (!node || !handleId) return undefined;
  if (node.type === 'source' || node.type === 'target') {
    if ((node.type === 'source') !== (side === 'source')) return undefined;
    const chain = findChain(node.data.fields, handleId);
    if (!chain) return undefined;
    const field = chain.at(-1);
    return { name: field.name, type: node.type === 'source' ? sourceSocketType(chain) : targetSocketType(field) };
  }
  const def = TRANSFORMS[node.data.kind];
  const s = side === 'source' ? def?.outputs.find((s) => s.id === handleId) : inputSocket(def, handleId);
  return s && { name: s.label, type: s.type };
}

/**
 * Type réel de la sortie `handle` d'un nœud : le type déclaré, sauf pour une sortie « Tout » qui transmet ses
 * entrées (`passes`) : elle prend le type de ce qui y entre (liens en amont, ou valeur saisie).
 * `getNode(id)` donne un nœud, `incomingOf(nodeId, inputId)` le lien qui arrive sur une entrée.
 */
export function outputType(getNode, incomingOf, nodeId, handle, depth = 0) {
  const node = getNode(nodeId);
  const declared = getSocket(node, handle, 'source')?.type;
  const def = node?.type === 'transform' ? TRANSFORMS[node.data.kind] : null;
  const pass = def?.passes?.[handle];
  if (!pass || depth > 50) return declared;
  const override = pass.unless && incomingOf(nodeId, pass.unless);
  if (override) return outputType(getNode, incomingOf, override.source, override.sourceHandle, depth + 1);

  const ids =
    pass.inputs === 'variadic'
      ? inputsOf(def, node, Array.from({ length: 60 }, (_, i) => variadicId(i)).filter((id) => incomingOf(nodeId, id))).map((i) => i.id)
      : pass.inputs;
  const types = ids
    .map((id) => {
      const e = incomingOf(nodeId, id);
      if (e) return outputType(getNode, incomingOf, e.source, e.sourceHandle, depth + 1);
      const declaredIn = inputSocket(def, id)?.type;
      if (declaredIn && declaredIn !== 'any' && declaredIn !== 'any[]') return declaredIn;
      return literalType(node.data.values?.[id] ?? inputSocket(def, id)?.default);
    })
    .filter(Boolean);
  if (!types.length) return declared;
  if (pass.as === 'list') return listOf(commonType(types.map(baseOf)));
  if (pass.as === 'item') return baseOf(commonType(types));
  return commonType(types);
}

/** Type d'une valeur saisie dans une entrée « Tout » (`null` si vide : elle ne compte pas). */
function literalType(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  if (/^-?\d+$/.test(s)) return 'integer';
  if (s !== '' && !Number.isNaN(Number(s))) return 'number';
  if (/^(true|false)$/i.test(s)) return 'boolean';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return 'date';
  return 'string';
}

/** Type commun : identique partout, « Nombre » pour un mélange d'entiers et de nombres, « Texte » si l'un est un texte, sinon « Tout ». */
function commonType(types) {
  if (types.every((t) => t === types[0])) return types[0];
  const list = types.every(isList);
  if (!list && types.some(isList)) return 'any';
  // Mélange : des nombres restent un nombre ; avec un texte, la sortie peut être un texte (le cas le plus strict).
  const bases = types.map(baseOf);
  const base = bases.every(isNumeric) ? 'number' : bases.includes('any') ? 'any' : bases.includes('string') ? 'string' : 'any';
  return list ? listOf(base) : base;
}

const inKey = (nodeId, handle) => `${nodeId}:${handle}`;

/**
 * Contexte d'évaluation (`scope`) : éléments de tableaux source « en cours » (clé `nœud:champ`),
 * plus l'élément de l'itération la plus proche.
 */
const ROOT_SCOPE = { id: 0, binds: new Map() };

/**
 * Évalue le graphe. Renvoie :
 * - `outputs` : valeurs des sorties hors itération, par nœud ;
 * - `targets` : pour chaque cible, le document produit (`value`) et la 1re valeur de chaque champ (`preview`).
 * `dataFiles` (nœud source → document) : données qui remplacent les valeurs du modèle de données d'une source.
 */
export function evaluateGraph(nodes, edges, dataFiles = new Map()) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const incoming = new Map(edges.map((e) => [inKey(e.target, e.targetHandle), e]));
  const samples = new Map();
  /** Ids des entrées reliées de chaque nœud. */
  const linkedInputs = new Map();
  for (const e of edges) linkedInputs.set(e.target, [...(linkedInputs.get(e.target) ?? []), e.targetHandle]);
  const connectedInputs = (nodeId) => linkedInputs.get(nodeId) ?? [];
  const memo = new Map();
  const visiting = new Set();
  let scopeSeq = 0;

  const extend = (scope, binds, item, index) => {
    const next = new Map(scope.binds);
    for (const [k, v] of Object.entries(binds ?? {})) next.set(k, v);
    return { id: ++scopeSeq, binds: next, current: { item, index } };
  };

  const upstream = (nodeId, handle, scope) => {
    const e = incoming.get(inKey(nodeId, handle));
    return e ? { connected: true, value: valueOf(e.source, e.sourceHandle ?? '', scope) } : { connected: false, value: undefined };
  };

  function valueOf(nodeId, handle, scope) {
    const node = byId.get(nodeId);
    if (node?.type === 'source') return readSource(node, handle, scope);
    if (node?.type === 'transform') return outputsOf(node, scope)[handle];
    return undefined;
  }

  function sampleOf(node) {
    if (dataFiles.has(node.id)) return dataFiles.get(node.id);
    if (!samples.has(node.id)) {
      let parsed = {};
      try {
        parsed = JSON.parse(node.data.sample || '{}');
      } catch {
        /* modèle de données invalide : signalé dans le nœud */
      }
      samples.set(node.id, parsed);
    }
    return samples.get(node.id);
  }

  /** Parcourt le chemin ; chaque tableau non lié multiplie les valeurs (projection aplatie). */
  function collect(v, segs, binds, key) {
    if (!segs.length) return { entries: [{ value: v, binds }], list: false };
    const [seg, ...rest] = segs;
    const child = isPlainObject(v) ? v[seg.name] : undefined;
    if (seg.type !== 'array') return collect(child, rest, binds, key);
    const arr = Array.isArray(child) ? child : [];
    return { list: true, entries: arr.flatMap((item) => collect(item, rest, { ...binds, [key(seg)]: item }, key).entries) };
  }

  function readSource(node, handle, scope) {
    const chain = findChain(node.data.fields, handle);
    if (!chain) return undefined;
    const key = (f) => `${node.id}:${f.id}`;
    // On repart de l'élément lié le plus profond (le champ lui-même exclu : un tableau demandé reste une liste).
    let root = sampleOf(node);
    let start = 0;
    for (let k = chain.length - 2; k >= 0; k--) {
      if (chain[k].type === 'array' && scope.binds.has(key(chain[k]))) {
        root = scope.binds.get(key(chain[k]));
        start = k + 1;
        break;
      }
    }
    const { entries, list } = collect(root, chain.slice(start), {}, key);
    const base = baseOf(sourceSocketType(chain));
    if (!list) return coerce(entries[0]?.value, base);
    return coerce(
      tagList(
        entries.map((e) => e.value),
        entries.map((e) => e.binds),
      ),
      listOf(base),
    );
  }

  function outputsOf(node, scope) {
    const memoKey = `${node.id}|${scope.id}`;
    const hit = memo.get(memoKey);
    if (hit) return hit;
    const def = TRANSFORMS[node.data.kind];
    if (!def || visiting.has(memoKey)) return {};
    visiting.add(memoKey);

    const inline = (s) => node.data.values[s.id] ?? s.default ?? '';
    const inputs = inputsOf(def, node, connectedInputs(node.id));
    const direct = inputs.filter((i) => !i.perItem);
    const raw = {};
    for (const inp of direct) {
      const up = upstream(node.id, inp.id, scope);
      raw[inp.id] = up.connected ? up.value : inline(inp);
    }

    const ctx = {
      connected: (id) => incoming.has(inKey(node.id, id)),
      current: scope.current,
      item: (id, list, index) => {
        const inp = inputs.find((s) => s.id === id);
        const up = upstream(node.id, id, extend(scope, bindsOf(list)?.[index], list[index], index));
        return coerce(up.connected ? up.value : inline(inp), inp.type);
      },
    };

    const params = paramsWithDefaults(def, node.data.params);
    // Une liste branchée sur une entrée simple : le nœud est appliqué à chaque élément.
    const vectorized = def.list ? [] : direct.filter((i) => !isList(i.type) && Array.isArray(raw[i.id]));
    const result = {};
    try {
      if (vectorized.length) {
        const lists = vectorized.map((i) => raw[i.id]);
        const len = Math.max(...lists.map((l) => l.length));
        const driver = lists.find((l) => l.length === len && bindsOf(l));
        const columns = def.outputs.map(() => []);
        for (let k = 0; k < len; k++) {
          const args = {};
          for (const inp of direct) {
            const v = vectorized.includes(inp) ? raw[inp.id][k] : raw[inp.id];
            args[inp.id] = coerce(v, inp.type);
          }
          const r = def.compute(args, params, ctx);
          def.outputs.forEach((o, j) => columns[j].push(coerce(r[o.id], o.type)));
        }
        def.outputs.forEach((o, j) => (result[o.id] = tagList(columns[j], driver && bindsOf(driver))));
      } else {
        const args = Object.fromEntries(direct.map((i) => [i.id, coerce(raw[i.id], i.type)]));
        const r = def.compute(args, params, ctx);
        for (const o of def.outputs) result[o.id] = coerce(r[o.id], o.type);
      }
    } catch {
      /* entrée invalide : sorties laissées vides */
    }

    visiting.delete(memoKey);
    memo.set(memoKey, result);
    return result;
  }

  // ── Construction des cibles ──────────────────────────────

  const isMapped = (nodeId, f) => incoming.has(inKey(nodeId, f.id)) || (f.children ?? []).some((c) => isMapped(nodeId, c));

  /** Sans lien sur le tableau cible, la 1re liste source branchée sur un enfant dicte l'itération. */
  function implicitDriver(nodeId, children, scope) {
    for (const c of children) {
      if (c.type === 'array' || !incoming.has(inKey(nodeId, c.id))) continue;
      const v = upstream(nodeId, c.id, scope).value;
      if (Array.isArray(v) && bindsOf(v)) return v;
    }
    return undefined;
  }

  function buildObject(nodeId, fields, scope, preview) {
    const obj = {};
    for (const f of fields) obj[f.name] = buildField(nodeId, f, scope, preview);
    return obj;
  }

  function buildField(nodeId, f, scope, preview) {
    const up = upstream(nodeId, f.id, scope);
    const children = f.children ?? [];
    let v = null;

    if (f.type === 'array' && f.item === 'object') {
      const structured = children.some((c) => isMapped(nodeId, c));
      const list = up.connected ? coerce(up.value, 'any[]') : implicitDriver(nodeId, children, scope);
      if (list) {
        const binds = bindsOf(list);
        v = list.map((item, i) => (structured ? buildObject(nodeId, children, extend(scope, binds?.[i], item, i), preview) : item));
      } else {
        v = structured ? [buildObject(nodeId, children, scope, preview)] : [];
      }
    } else if (f.type === 'array') {
      v = up.connected ? coerce(up.value, listOf(f.item ?? 'string')) : [];
    } else if (f.type === 'object') {
      const base = up.connected && isPlainObject(up.value) ? up.value : {};
      const built = buildObject(nodeId, children, scope, preview);
      const obj = { ...base };
      for (const c of children) if (isMapped(nodeId, c) || !(c.name in base)) obj[c.name] = built[c.name];
      v = obj;
    } else if (up.connected) {
      v = coerce(up.value, f.type);
    }

    if (!(f.id in preview)) preview[f.id] = v;
    return v;
  }

  const outputs = new Map();
  const targets = new Map();
  for (const n of nodes) {
    if (n.type === 'transform') outputs.set(n.id, outputsOf(n, ROOT_SCOPE));
    else if (n.type === 'source')
      outputs.set(n.id, Object.fromEntries(allFields(n.data.fields).map((f) => [f.id, readSource(n, f.id, ROOT_SCOPE)])));
    else if (n.type === 'target') {
      const preview = {};
      targets.set(n.id, { value: buildObject(n.id, n.data.fields, ROOT_SCOPE, preview), preview });
    }
  }
  return { outputs, targets };
}

/** Refuse les cycles : la source ne doit pas être atteignable depuis la cible (`ignoredEdgeId` : lien en cours de déplacement). */
export function createsCycle(edges, source, target, ignoredEdgeId) {
  const stack = [target];
  const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (id === source) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of edges) if (e.source === id && e.id !== ignoredEdgeId) stack.push(e.target);
  }
  return false;
}
