import { findChain, isContainer, pathLabel } from './fields';
import { getSocket, outputType } from './graph';
import { isSet } from './formats';
import { t } from './i18n';
import { LIBRARY_OUTPUT, LIBRARY_TABLE, librariesOf, missingFrom } from './libraries';
import { inputsOf, inputSocket, TRANSFORMS } from './transforms';
import { baseOf, isList, socketTitle, typeMismatch } from './types';

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
/** Ids des entrées reliées d'un nœud (`incoming` : clés `nœud:entrée`). */
const linkedInputsOf = (incoming, nodeId) =>
  [...incoming.keys()].filter((k) => k.startsWith(`${nodeId}:`)).map((k) => k.slice(nodeId.length + 1));

function makeSocketInfo(byId, incoming, libraries) {
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
    } else if (node.type === 'library') {
      // Chaque valeur fournie fait partie de la bibliothèque, par définition.
      if (handle === LIBRARY_OUTPUT) info = { label: node.data.label, base: node.data.item ?? 'string', array: true, required: true, format: { library: node.id } };
      // Table de correspondance : `table` désigne la bibliothèque, pour les garanties du nœud Transcoder.
      if (handle === LIBRARY_TABLE) info = { label: node.data.label, base: 'object', array: false, required: true, format: {}, table: node.id };
    } else if (node.type === 'transform') {
      const def = TRANSFORMS[node.data.kind];
      const output = def?.outputs.find((o) => o.id === handle);
      if (def?.guarantee && output) {
        const inputs = {};
        const input = (id) => {
          if (!inputs[id]) {
            const e = incoming.get(`${nodeId}:${id}`);
            const s = inputSocket(def, id);
            inputs[id] = e
              ? { connected: true, info: infoOf(e.source, e.sourceHandle ?? '', depth + 1) }
              : { connected: false, info: null, value: node.data.values?.[id] ?? s?.default ?? '' };
          }
          return inputs[id];
        };
        const ids = inputsOf(def, node, linkedInputsOf(incoming, nodeId)).map((i) => i.id);
        const params = { ...Object.fromEntries((def.params ?? []).map((p) => [p.id, p.default])), ...node.data.params };
        const g = def.guarantee(input, params, ids, { libraries });
        const used = Object.values(inputs);
        // Une liste branchée sur une entrée simple : le nœud est appliqué à chaque élément.
        const array = isList(output.type) || used.some((i) => i.info?.array);
        const optional = g.required === false ? used.find((i) => i.info?.required === false)?.info : undefined;
        info = {
          label: def.label,
          base: g.base ?? baseOf(output.type),
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
function formatGaps(src, dst, libraries) {
  const want = dst.format ?? {};
  const dstBase = base(dst);
  // Un entier convient là où un nombre est attendu ; l'inverse perd les décimales.
  const sameKind = src.base === dstBase || (src.base === 'integer' && dstBase === 'number');
  const have = sameKind && src.array === (dst.type === 'array') ? src.format : {};
  const gaps = [];
  const shown = (key) => (isSet(have[key]) ? have[key] : t('non bornée', 'unbounded'));
  const atLeast = (key, label) => {
    if (isSet(want[key]) && (!isSet(have[key]) || have[key] < want[key])) gaps.push(`${label} ≥ ${want[key]} (${t('garanti', 'guaranteed')} : ${shown(key)})`);
  };
  const atMost = (key, label) => {
    if (isSet(want[key]) && (!isSet(have[key]) || have[key] > want[key])) gaps.push(`${label} ≤ ${want[key]} (${t('garanti', 'guaranteed')} : ${shown(key)})`);
  };

  if (dst.type === 'array') {
    atLeast('minItems', t('éléments', 'items'));
    atMost('maxItems', t('éléments', 'items'));
  }
  atLeast('minLength', t('longueur', 'length'));
  atMost('maxLength', t('longueur', 'length'));
  if (isSet(want.pattern) && want.pattern !== have.pattern) gaps.push(t(`motif /${want.pattern}/ non garanti`, `pattern /${want.pattern}/ not guaranteed`));
  atLeast('min', t('valeur', 'value'));
  atMost('max', t('valeur', 'value'));
  atLeast('minDate', t('date', 'date'));
  atMost('maxDate', 'date');
  // Bibliothèque : la même, ou une dont toutes les valeurs font partie de celle de la cible.
  if (isSet(want.library) && have.library !== want.library) {
    const wanted = libraries.get(want.library);
    // Ce que garantit la valeur reçue : une bibliothèque, ou un ensemble de valeurs (ex. les correspondances d'un Transcoder).
    const given = isSet(have.library) ? libraries.get(have.library) : have.allowed;
    const extra = wanted && given ? missingFrom(given, wanted) : null;
    // Bibliothèque supprimée : signalé à part.
    if (wanted && (!extra || extra.length)) {
      const sample = extra?.length ? ` (${t('ex.', 'e.g.')} ${extra.slice(0, 3).map((v) => JSON.stringify(v)).join(', ')})` : '';
      gaps.push(t(`valeurs de « ${wanted.label} » non garanties${sample}`, `values of “${wanted.label}” not guaranteed${sample}`));
    }
  }
  return gaps;
}

/** Écart de type d'un lien : `{ level, message }` ou `null`. */
export function linkMismatch(byId, e, incoming) {
  const fromType = outputType((id) => byId.get(id), (id, h) => incoming.get(`${id}:${h}`), e.source, e.sourceHandle);
  const from = fromType && { type: fromType };
  const to = getSocket(byId.get(e.target), e.targetHandle, 'target');
  const kind = from && to && typeMismatch(from.type, to.type);
  if (!kind) return null;
  const types = `${socketTitle(baseOf(from.type))} → ${socketTitle(baseOf(to.type))}`;
  return kind === 'incompatible'
    ? { level: 'error', message: t(`Types incompatibles : ${types}`, `Incompatible types: ${types}`) }
    : { level: 'warning', message: t(`Type différent : ${types} (conversion implicite)`, `Different type: ${types} (implicit conversion)`) };
}

/**
 * Contrôle statique des champs cibles. Renvoie `byNode` (nœud → champ → problèmes) et `list`.
 * Un problème : `{ level: 'error' | 'warning', message }`.
 * - obligatoire et non mappé : erreur ;
 * - obligatoire mais alimenté par un champ source optionnel : avertissement ;
 * - format non garanti par ce qui alimente le champ : avertissement ;
 * - types différents : avertissement si la valeur est convertie, erreur si les types sont incompatibles
 *   (contrôlé aussi sur les entrées des transformations).
 * Les garanties traversent les transformations qui les déclarent (`guarantee`, ex. « Extraire » borne
 * la longueur) ; une transformation sans garanties lève les avertissements : c'est elle qui adapte la valeur.
 */
export function validateTargets(nodes, edges) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const incoming = new Map(edges.map((e) => [`${e.target}:${e.targetHandle}`, e]));
  const libraries = librariesOf(nodes);
  const infoOf = makeSocketInfo(byId, incoming, libraries);
  const linkedInputs = (nodeId) => linkedInputsOf(incoming, nodeId);
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
        if (f.required && !isMapped(f)) add(f, chain, 'error', t('Obligatoire mais non mappé', 'Required but not mapped'));
        const mismatch = e && linkMismatch(byId, e, incoming);
        if (mismatch) add(f, chain, mismatch.level, mismatch.message);
        const info = e && infoOf(e.source, e.sourceHandle ?? '');
        if (info) {
          if (f.required && info.required === false && !info.optionalFrom) {
            // La transformation elle-même peut ne rien donner (ex. Transcoder sans valeur « Si absente »).
            add(f, chain, 'warning', t(`Obligatoire, mais ${info.label} peut ne rien donner`, `Required, but ${info.label} may give nothing`));
          } else if (f.required && info.required === false) {
            const via = info.optionalFrom && info.optionalFrom !== info.label ? ` (via ${info.label})` : '';
            const from = `${info.optionalFrom ?? info.label}${via}`;
            add(f, chain, 'warning', t(`Obligatoire, mais la source ${from} est optionnelle`, `Required, but the source ${from} is optional`));
          }
          const gaps = formatGaps(info, f, libraries);
          if (gaps.length) add(f, chain, 'warning', t(`Format non garanti par ${info.label} : ${gaps.join(', ')}`, `Format not guaranteed by ${info.label}: ${gaps.join(', ')}`));
        }
        // Un conteneur optionnel laissé vide n'impose rien à ses sous-champs.
        if (isSet(f.format?.library) && !libraries.has(f.format.library))
          add(f, chain, 'warning', t('Bibliothèque de valeurs supprimée : valeurs non contrôlées', 'Value library deleted: values not checked'));
        if (isContainer(f) && (f.required || isMapped(f))) walk(f.children ?? [], chain);
      }
    };
    walk(node.data.fields, []);
    byNode.set(node.id, issues);
  }

  // Entrées des transformations : seul l'écart de type est contrôlé.
  for (const node of nodes) {
    const def = node.type === 'transform' && TRANSFORMS[node.data.kind];
    if (!def) continue;
    const issues = new Map();
    for (const inp of inputsOf(def, node, linkedInputs(node.id))) {
      const e = incoming.get(`${node.id}:${inp.id}`);
      const mismatch = e && linkMismatch(byId, e, incoming);
      if (!mismatch) continue;
      issues.set(inp.id, [mismatch]);
      list.push({ nodeId: node.id, fieldId: inp.id, path: `${def.label} › ${inp.label}`, ...mismatch });
    }
    byNode.set(node.id, issues);
  }
  return { byNode, list };
}

/** Nombre de problèmes d'un nœud cible, par niveau. */
export function countIssues(issues) {
  const all = [...(issues?.values() ?? [])].flat();
  return { errors: all.filter((i) => i.level === 'error').length, warnings: all.filter((i) => i.level === 'warning').length };
}
