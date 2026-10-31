import { findChain, isContainer, pathLabel } from './fields';
import { isSet } from './formats';
import { TRANSFORMS } from './transforms';
import { baseOf, isList } from './types';

/**
 * Le champ source est-il toujours présent ? Il faut qu'il soit obligatoire, ainsi que ses parents
 * jusqu'au tableau le plus proche (au-delà, l'absence d'un tableau donne simplement zéro élément).
 */
function sourceRequired(chain) {
  let i = chain.length - 1;
  while (i > 0 && chain[i - 1].type !== 'array') i--;
  return chain.slice(i).every((f) => f.required);
}

const base = (f) => (f.type === 'array' ? f.item ?? 'string' : f.type);

/**
 * Ce qui est garanti sur la valeur d'un socket de sortie :
 * `{ label, base, array, required, format, optionalFrom }` — `required` peut être `undefined` (inconnu) ;
 * `optionalFrom` nomme le champ source optionnel à l'origine d'un `required: false`.
 * `null` : sortie d'une transformation qui ne déclare pas de garanties (on lui fait confiance).
 */
function makeSocketInfo(byId, incoming) {
  const memo = new Map();

  function infoOf(nodeId, handle, depth = 0) {
    const key = `${nodeId}:${handle}`;
    if (memo.has(key)) return memo.get(key);
    const node = byId.get(nodeId);
    let info = null;
    if (depth > 50 || !node) info = null;
    else if (node.type === 'source') {
      const chain = findChain(node.data.fields, handle);
      if (chain) {
        const f = chain.at(-1);
        const label = `${node.data.label}.${pathLabel(chain)}`;
        const required = sourceRequired(chain);
        info = { label, base: base(f), array: f.type === 'array', required, format: f.format ?? {}, optionalFrom: required ? undefined : label };
      }
    } else if (node.type === 'transform') {
      const def = TRANSFORMS[node.data.kind];
      const output = def?.outputs.find((o) => o.id === handle);
      if (def?.guarantee && output) {
        const inputs = {};
        const input = (id) => {
          if (!inputs[id]) {
            const e = incoming.get(`${nodeId}:${id}`);
            const s = def.inputs.find((i) => i.id === id);
            inputs[id] = e
              ? { connected: true, info: infoOf(e.source, e.sourceHandle ?? '', depth + 1) }
              : { connected: false, info: null, value: node.data.values?.[id] ?? s?.default ?? '' };
          }
          return inputs[id];
        };
        const g = def.guarantee(input, { ...Object.fromEntries((def.params ?? []).map((p) => [p.id, p.default])), ...node.data.params });
        const used = Object.values(inputs);
        // Une liste branchée sur une entrée simple : le nœud est appliqué à chaque élément.
        const array = isList(output.type) || used.some((i) => i.info?.array);
        const optional = g.required === false ? used.find((i) => i.info?.required === false)?.info : undefined;
        info = {
          label: def.label,
          base: baseOf(output.type),
          array,
          required: g.required,
          format: g.format ?? {},
          optionalFrom: optional?.optionalFrom,
        };
      }
    }
    memo.set(key, info);
    return info;
  }
  return infoOf;
}

/**
 * Contraintes de format de la cible que la valeur reçue ne garantit pas : une borne doit être
 * au moins aussi stricte, un motif identique.
 */
function formatGaps(src, dst) {
  const want = dst.format ?? {};
  const have = src.base === base(dst) && src.array === (dst.type === 'array') ? src.format : {};
  const gaps = [];
  const shown = (key) => (isSet(have[key]) ? have[key] : 'non bornée');
  const atLeast = (key, label) => {
    if (isSet(want[key]) && (!isSet(have[key]) || have[key] < want[key])) gaps.push(`${label} ≥ ${want[key]} (garanti : ${shown(key)})`);
  };
  const atMost = (key, label) => {
    if (isSet(want[key]) && (!isSet(have[key]) || have[key] > want[key])) gaps.push(`${label} ≤ ${want[key]} (garanti : ${shown(key)})`);
  };

  if (dst.type === 'array') {
    atLeast('minItems', 'éléments');
    atMost('maxItems', 'éléments');
  }
  atLeast('minLength', 'longueur');
  atMost('maxLength', 'longueur');
  if (isSet(want.pattern) && want.pattern !== have.pattern) gaps.push(`motif /${want.pattern}/ non garanti`);
  atLeast('min', 'valeur');
  atMost('max', 'valeur');
  if (want.integer && !have.integer) gaps.push('entier non garanti');
  atLeast('minDate', 'date');
  atMost('maxDate', 'date');
  return gaps;
}

/**
 * Contrôle statique des champs cibles. Renvoie `byNode` (nœud → champ → problèmes) et `list`.
 * Un problème : `{ level: 'error' | 'warning', message }`.
 * - obligatoire et non mappé : erreur ;
 * - obligatoire mais alimenté par un champ source optionnel : avertissement ;
 * - format non garanti par ce qui alimente le champ : avertissement.
 * Les garanties traversent les transformations qui les déclarent (`guarantee`, ex. « Extraire » borne
 * la longueur) ; une transformation sans garanties lève les avertissements : c'est elle qui adapte la valeur.
 */
export function validateTargets(nodes, edges) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const incoming = new Map(edges.map((e) => [`${e.target}:${e.targetHandle}`, e]));
  const infoOf = makeSocketInfo(byId, incoming);
  const byNode = new Map();
  const list = [];

  for (const node of nodes) {
    if (node.type !== 'target') continue;
    const issues = new Map();
    const add = (f, chain, level, message) => {
      if (!issues.has(f.id)) issues.set(f.id, []);
      issues.get(f.id).push({ level, message });
      list.push({ nodeId: node.id, fieldId: f.id, path: `${node.data.label}.${pathLabel(chain)}`, level, message });
    };
    const linkOf = (f) => incoming.get(`${node.id}:${f.id}`);
    const isMapped = (f) => !!linkOf(f) || (f.children ?? []).some(isMapped);

    const walk = (fields, parents) => {
      for (const f of fields) {
        const chain = [...parents, f];
        const e = linkOf(f);
        if (f.required && !isMapped(f)) add(f, chain, 'error', 'Obligatoire mais non mappé');
        const info = e && infoOf(e.source, e.sourceHandle ?? '');
        if (info) {
          if (f.required && info.required === false) {
            const via = info.optionalFrom && info.optionalFrom !== info.label ? ` (via ${info.label})` : '';
            add(f, chain, 'warning', `Obligatoire, mais la source ${info.optionalFrom ?? info.label}${via} est optionnelle`);
          }
          const gaps = formatGaps(info, f);
          if (gaps.length) add(f, chain, 'warning', `Format non garanti par ${info.label} : ${gaps.join(', ')}`);
        }
        // Un conteneur optionnel laissé vide n'impose rien à ses sous-champs.
        if (isContainer(f) && (f.required || isMapped(f))) walk(f.children ?? [], chain);
      }
    };
    walk(node.data.fields, []);
    byNode.set(node.id, issues);
  }
  return { byNode, list };
}

/** Nombre de problèmes d'un nœud cible, par niveau. */
export function countIssues(issues) {
  const all = [...(issues?.values() ?? [])].flat();
  return { errors: all.filter((i) => i.level === 'error').length, warnings: all.filter((i) => i.level === 'warning').length };
}
