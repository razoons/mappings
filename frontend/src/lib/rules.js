import { displayDateFormat, effectiveDateFormat, isDateType } from './dateFormats';
import { elementOf, MIXED_DATE_FORMAT, normalize, unknownInfo } from './guarantees';
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
 * Ce qui est garanti sur la valeur d'un socket de sortie (voir lib/guarantees.js) :
 * `{ label, base, array, required, format, optionalFrom, risk?, unknown? }` — `required` peut être `undefined` (inconnu) ;
 * `optionalFrom` nomme le champ source optionnel à l'origine d'un `required: false`.
 * Une transformation qui ne garantit rien donne `unknown: true` : aucune règle de la cible n'est alors garantie.
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
        // Les éléments d'une liste de valeurs simples sont présents (le contrôle du fichier source le vérifie).
        info = normalize({ label, base: base(f), array: f.type === 'array', itemRequired: f.type === 'array' ? true : undefined, required, format: f.format ?? {}, optionalFrom: required ? undefined : label });
      }
    } else if (node.type === 'library') {
      // Chaque valeur fournie fait partie de la bibliothèque, par définition.
      if (handle === LIBRARY_OUTPUT) info = normalize({ label: node.data.label, base: node.data.item ?? 'string', array: true, itemRequired: true, required: true, format: { library: node.id } });
      // Table de correspondance : `table` désigne la bibliothèque, pour les garanties du nœud Transcoder.
      if (handle === LIBRARY_TABLE) info = { label: node.data.label, base: 'object', array: false, required: true, format: {}, table: node.id };
    } else if (node.type === 'transform') {
      const def = TRANSFORMS[node.data.kind];
      const output = def?.outputs.find((o) => o.id === handle);
      if (def && output) {
        const inputs = {};
        const input = (id) => {
          if (!inputs[id]) {
            const e = incoming.get(`${nodeId}:${id}`);
            const s = inputSocket(def, id);
            const upstream = e ? infoOf(e.source, e.sourceHandle ?? '', depth + 1) : null;
            inputs[id] = e
              ? {
                  connected: true,
                  // Une liste sur une entrée simple d'un nœud qui ne gère pas les listes : il est appliqué à chaque élément.
                  info: upstream?.array && !def.list && !isList(s?.type ?? 'any') ? elementOf(upstream) : upstream,
                  upstream,
                  type: s?.type,
                }
              : { connected: false, info: null, value: node.data.values?.[id] ?? s?.default ?? '', type: s?.type };
          }
          return inputs[id];
        };
        const ids = inputsOf(def, node, linkedInputsOf(incoming, nodeId)).map((i) => i.id);
        const params = { ...Object.fromEntries((def.params ?? []).map((p) => [p.id, p.default])), ...node.data.params };
        const g = def.guarantee?.(input, params, ids, { libraries, output: handle }) ?? unknownInfo(output.type);
        // Toutes les entrées directes, lues ou non par les garanties : une liste sur l'une d'elles fait itérer le nœud.
        if (!def.list) for (const id of ids) if (!inputSocket(def, id)?.perItem) input(id);
        const used = Object.values(inputs);
        // Appliqué à chaque élément des listes reçues : le résultat est une liste, aussi longue que la plus longue.
        const lists = def.list ? [] : used.filter((i) => i.upstream?.array && i.info !== i.upstream).map((i) => i.upstream);
        const mapped = lists.length > 0;
        const counts = (key, pick) => (lists.every((l) => l.format?.[key] !== undefined) ? pick(...lists.map((l) => l.format[key])) : undefined);
        let base = g.base ?? baseOf(output.type);
        let format = g.format ?? {};
        let required = g.required;
        let itemRequired = g.itemRequired;
        let array = def.list ? !!(g.array ?? isList(output.type)) : (g.array ?? isList(output.type)) || mapped;
        if (mapped) {
          // Un nœud qui rend déjà une liste, itéré : une liste de listes, dont les éléments ne sont pas contrôlables.
          if (g.array ?? isList(output.type)) [base, format] = ['any', {}];
          // Listes de longueurs différentes : au-delà de la plus courte, les éléments manquent.
          itemRequired = lists.length === 1 ? required : undefined;
          required = lists.every((l) => l.required === true) ? true : lists.some((l) => l.required === false) ? false : undefined;
          format = { ...format, minItems: counts('minItems', Math.max), maxItems: counts('maxItems', Math.max) };
          array = true;
        }
        const optional = required === false ? used.map((i) => i.upstream ?? i.info).find((x) => x?.required === false) : undefined;
        info = normalize({
          label: def.label,
          base,
          array,
          required,
          itemRequired,
          format,
          optionalFrom: optional?.optionalFrom,
          risk: g.risk ?? used.find((i) => i.info?.risk)?.info?.risk,
          unknown: !!g.unknown,
        });
      }
    }
    memo.set(key, info);
    return info;
  }
  return infoOf;
}

/**
 * Contraintes de format de la cible que la valeur reçue ne garantit pas : une borne doit être
 * au moins aussi stricte, un motif identique. `{ warnings, errors }` : les décimales en trop sont une erreur.
 * Une règle que la valeur ne renseigne pas n'est pas garantie ; `Infinity` : non bornée.
 */
function formatGaps(src, dst, libraries) {
  const want = dst.format ?? {};
  const dstBase = base(dst);
  // Un entier convient là où un nombre est attendu ; l'inverse perd les décimales.
  const sameKind = src.base === dstBase || (src.base === 'integer' && dstBase === 'number');
  const have = sameKind && src.array === (dst.type === 'array') ? src.format : {};
  const gaps = [];
  const errors = [];
  const shown = (key) => (isSet(have[key]) && have[key] !== Infinity ? have[key] : t('non bornée', 'unbounded'));
  // Bornes de date : comparées en instants (comme le contrôle de conformité), pas en textes.
  const value = (key, v) => (key === 'minDate' || key === 'maxDate' ? new Date(v).getTime() : v);
  const atLeast = (key, label) => {
    if (isSet(want[key]) && (!isSet(have[key]) || value(key, have[key]) < value(key, want[key]))) gaps.push(`${label} ≥ ${want[key]} (${t('garanti', 'guaranteed')} : ${shown(key)})`);
  };
  const atMost = (key, label, list = gaps) => {
    if (isSet(want[key]) && (!isSet(have[key]) || value(key, have[key]) > value(key, want[key]))) list.push(`${label} ≤ ${want[key]} (${t('garanti', 'guaranteed')} : ${shown(key)})`);
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
  atMost('maxDecimals', t('décimales', 'decimals'), errors);
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
  return { warnings: gaps, errors };
}

/**
 * Liste d'objets cible sans lien propre, dont des sous-champs sont reliés : la 1re liste branchée sur un sous-champ
 * dicte le nombre d'éléments (comme à l'évaluation), sinon il y a exactement un élément.
 */
function itemCountGaps(f, infoOfChild) {
  const want = f.format ?? {};
  if (!isSet(want.minItems) && !isSet(want.maxItems)) return [];
  const driver = (f.children ?? []).filter((c) => c.type !== 'array').map(infoOfChild).find((i) => i?.array);
  const have = driver ? { min: driver.required === true ? driver.format?.minItems : 0, max: driver.format?.maxItems } : { min: 1, max: 1 };
  const shown = (v) => (v === undefined ? t('non borné', 'unbounded') : v);
  const gaps = [];
  if (isSet(want.minItems) && !(have.min >= want.minItems)) gaps.push(`≥ ${want.minItems} (${t('garanti', 'guaranteed')} : ${shown(have.min)})`);
  if (isSet(want.maxItems) && !(have.max <= want.maxItems)) gaps.push(`≤ ${want.maxItems} (${t('garanti', 'guaranteed')} : ${shown(have.max)})`);
  return gaps;
}

/**
 * Formats de date différents entre la valeur reçue et le champ cible (date ou date et heure), `null` sinon.
 * Sans format choisi, une date est en ISO (AAAA-MM-JJ, AAAA-MM-JJTHH:mm:ss).
 */
function dateFormatGap(src, dst) {
  const dstBase = base(dst);
  if (!isDateType(dstBase)) return null;
  const to = effectiveDateFormat(dstBase, dst.format?.dateFormat);
  // Valeur de type inconnu : son format de date ne l'est pas davantage.
  if (src.base === 'any')
    return t(
      `Format de date non garanti : ${displayDateFormat(to)} attendu (insérer « Changer le format de date »)`,
      `Date format not guaranteed: ${displayDateFormat(to)} expected (insert “Change date format”)`,
    );
  if (!isDateType(src.base)) return null;
  const from = effectiveDateFormat(src.base, src.format?.dateFormat);
  if (from === to) return null;
  const shown = `${from === MIXED_DATE_FORMAT ? t('formats variés', 'mixed formats') : displayDateFormat(from)} → ${displayDateFormat(to)}`;
  return t(
    `Formats de date différents : ${shown} (aligner les formats, ou insérer « Changer le format de date »)`,
    `Different date formats: ${shown} (align the formats, or insert “Change date format”)`,
  );
}

/** Écart de type d'un lien : `{ level, message }` ou `null`. */
export function linkMismatch(byId, e, incoming) {
  const fromType = outputType((id) => byId.get(id), (id, h) => incoming.get(`${id}:${h}`), e.source, e.sourceHandle);
  const from = fromType && { type: fromType };
  const to = getSocket(byId.get(e.target), e.targetHandle, 'target');
  const kind = from && to && typeMismatch(from.type, to.type);
  // Valeur de type inconnu (« Tout ») vers un type précis : rien ne garantit le type.
  if (!kind && from && to && baseOf(from.type) === 'any' && !['any', 'object'].includes(baseOf(to.type)))
    return { level: 'warning', message: t(`Type non garanti : ${socketTitle('any')} → ${socketTitle(baseOf(to.type))}`, `Type not guaranteed: ${socketTitle('any')} → ${socketTitle(baseOf(to.type))}`) };
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
 * Les garanties traversent les transformations (lib/transformGuarantees.js, ex. « Extraire » borne la longueur) ;
 * ce qu'une transformation ne garantit pas est signalé : le chemin entier doit garantir le format attendu.
 */
export function validateTargets(nodes, edges, sharedLists = []) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const incoming = new Map(edges.map((e) => [`${e.target}:${e.targetHandle}`, e]));
  const libraries = librariesOf([...nodes, ...sharedLists]);
  const infoOf = makeSocketInfo(byId, incoming, libraries);
  const linkedInputs = (nodeId) => linkedInputsOf(incoming, nodeId);
  const byNode = new Map();
  const list = [];

  for (const node of nodes) {
    if (node.type !== 'target') continue;
    const issues = new Map();
    // `kind` : nature du problème quand le lien doit aussi le montrer (ex. `date-format`).
    const add = (f, chain, level, message, kind) => {
      if (!issues.has(f.id)) issues.set(f.id, []);
      issues.get(f.id).push(kind ? { level, message, kind } : { level, message });
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
        const raw = e && (infoOf(e.source, e.sourceHandle ?? '') ?? { ...unknownInfo(), label: byId.get(e.source)?.data?.label ?? '?' });
        // Sous-champ d'une liste d'objets : la valeur est celle de chaque élément.
        const info = raw?.array && f.type !== 'array' && parents.some((p) => p.type === 'array') ? { ...elementOf(raw), label: raw.label, optionalFrom: raw.optionalFrom } : raw;
        if (info) {
          if (f.required && info.required === undefined) {
            add(f, chain, 'warning', t(`Obligatoire, mais ${info.label} ne garantit pas de valeur`, `Required, but ${info.label} does not guarantee a value`));
          } else if (f.required && info.required === false && !info.optionalFrom) {
            // La transformation elle-même peut ne rien donner (ex. Transcoder sans valeur « Si absente »).
            add(f, chain, 'warning', t(`Obligatoire, mais ${info.label} peut ne rien donner`, `Required, but ${info.label} may give nothing`));
          } else if (f.required && info.required === false) {
            const via = info.optionalFrom && info.optionalFrom !== info.label ? ` (via ${info.label})` : '';
            const from = `${info.optionalFrom ?? info.label}${via}`;
            add(f, chain, 'warning', t(`Obligatoire, mais la source ${from} est optionnelle`, `Required, but the source ${from} is optional`));
          }
          if (info.risk === 'number') add(f, chain, 'warning', t(`${info.label} : un texte converti en nombre peut ne pas en être un`, `${info.label}: a text converted to a number may not be one`));
          const dateGap = dateFormatGap(info, f);
          if (dateGap) add(f, chain, 'error', dateGap, 'date-format');
          const gaps = formatGaps(info, f, libraries);
          if (gaps.errors.length) add(f, chain, 'error', t(`Format non garanti par ${info.label} : ${gaps.errors.join(', ')}`, `Format not guaranteed by ${info.label}: ${gaps.errors.join(', ')}`));
          if (gaps.warnings.length) add(f, chain, 'warning', t(`Format non garanti par ${info.label} : ${gaps.warnings.join(', ')}`, `Format not guaranteed by ${info.label}: ${gaps.warnings.join(', ')}`));
        }
        if (f.type === 'array' && !e && isMapped(f)) {
          const gaps = itemCountGaps(f, (c) => linkOf(c) && infoOf(linkOf(c).source, linkOf(c).sourceHandle ?? ''));
          if (gaps.length) add(f, chain, 'warning', t(`Nombre d'éléments non garanti : ${gaps.join(', ')}`, `Number of items not guaranteed: ${gaps.join(', ')}`));
        }
        // Un conteneur optionnel laissé vide n'impose rien à ses sous-champs.
        if (isSet(f.format?.library) && !libraries.has(f.format.library))
          add(f, chain, 'warning', t('Liste de valeurs absente (supprimée de la bibliothèque) : valeurs non contrôlées', 'Value list missing (deleted from the library): values not checked'));
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
