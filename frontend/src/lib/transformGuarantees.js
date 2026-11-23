import { hasTime } from './dateFormats';
import {
  allPresent,
  anyPresent,
  boundsOf,
  elementOf,
  inputInfo,
  intervalOf,
  listInfo,
  numberOf,
  orEmpty,
  presence,
  unionInfo,
  valuesOf,
} from './guarantees';
import { tableKey, valueSet } from './libraries';
import { decimalsOf } from './types';

/**
 * Garanties de chaque nœud de transformation sur ses sorties (voir lib/guarantees.js), pour le contrôle des
 * champs cibles. Tous les nœuds en ont : un nœud absent d'ici ne garantit rien (ses sorties sont « inconnues »).
 *
 * `guarantee(input, params, inputIds, { libraries, output })` :
 * - `input(id)` : `{ connected, info, value, type }` — `info` : garanties de l'amont (d'un élément, si une liste
 *   arrive sur une entrée simple), `value` : la valeur saisie d'une entrée libre ;
 * - `output` : la sortie concernée (pour un nœud à plusieurs sorties) ;
 * - renvoie des garanties `{ base?, array?, required, format, risk? }`, ou `null` (rien de garanti).
 *   `risk` : la valeur peut ne pas avoir le type annoncé (ex. texte converti en nombre) ; signalé à part.
 *
 * Le principe : ne déclarer que ce qui est sûr. Dans le doute, une règle n'est pas garantie et le contrôle le signale.
 */

/** Valeur absente, comme dans les nœuds et le contrôle de conformité (un texte d'espaces est une valeur). */
const blank = (v) => v === undefined || v === null || v === '';

// ── Texte ──────────────────────────────────────────────────

/** Garanties d'une entrée texte (`{}` : rien de connu) ; une saisie vide est un texte vide (longueur 0). */
const textOf = (i) => (!i.connected && blank(i.value) ? { base: 'string', required: false, format: { minLength: 0, maxLength: 0 } } : (inputInfo(i) ?? { format: {} }));
/** Longueur minimale d'un texte : celle garantie, ou 1 s'il est toujours présent (non vide). */
const minLengthOf = (t) => t.format?.minLength ?? (t.required ? 1 : 0);

/** Plus petite des bornes connues (`undefined` si aucune). */
const minOf = (...xs) => {
  const k = xs.filter((x) => typeof x === 'number' && !Number.isNaN(x));
  return k.length ? Math.min(...k) : undefined;
};
const maxOfAll = (xs) => (xs.every((x) => typeof x === 'number') ? Math.max(...xs) : undefined);

/**
 * Valeur min. / max. d'un nombre de caractères ou d'éléments (ramené à un entier ≥ 0, comme le font les nœuds) :
 * la valeur saisie, ou les bornes garanties par l'amont (0 si elle peut manquer). Inconnues si elle n'est pas finie.
 */
const intBounds = (i) => {
  const clamp = (x) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.trunc(x)) : undefined);
  if (!i.connected) {
    const n = blank(i.value) ? 0 : numberOf(i.value);
    return n === undefined ? [undefined, undefined] : [clamp(n), clamp(n)];
  }
  const [lo, hi] = boundsOf(orEmpty(i.info));
  return [clamp(lo) ?? 0, clamp(hi)];
};

// ── Nombres ────────────────────────────────────────────────

/** Décimales garanties : un nombre, `Infinity` (non bornées) ou `undefined` (inconnues). */
/** Garanties d'une entrée numérique, une valeur absente valant 0 pour le nœud. */
const numberIn = (i) => orEmpty(inputInfo(i));

const decimalsOfInfo = (info) => (info ? (info.base === 'integer' ? 0 : info.format?.maxDecimals ?? Infinity) : undefined);

/** Valeur saisie d'une entrée non reliée (nombre), `undefined` sinon. */
const constantOf = (i) => (i.connected ? undefined : numberOf(i.value));

/** Exposant k si `n` vaut 10^k (k entier, ex. 100 → 2, 0.1 → -1), `undefined` sinon. */
function powerOfTen(n) {
  if (n === undefined || n <= 0) return undefined;
  const k = Math.round(Math.log10(n));
  return Number((10 ** k).toPrecision(12)) === n ? k : undefined;
}

/** Décimales du résultat d'une opération Math. */
function mathDecimals(op, a, b) {
  const [da, db] = [decimalsOfInfo(numberIn(a)), decimalsOfInfo(numberIn(b))];
  if (da === undefined || db === undefined) return undefined;
  // Multiplier ou diviser par une puissance de 10 décale la virgule.
  const shift = (d, k) => (d === Infinity ? Infinity : Math.max(0, d + k));
  const [ka, kb] = [powerOfTen(constantOf(a)), powerOfTen(constantOf(b))];
  switch (op) {
    case 'Multiplication':
      if (kb !== undefined) return shift(da, -kb);
      if (ka !== undefined) return shift(db, -ka);
      return da + db;
    case 'Division':
      return kb !== undefined ? shift(da, kb) : Infinity;
    case 'Puissance': {
      const n = constantOf(b);
      return Number.isInteger(n) && n >= 0 ? da * n : Infinity;
    }
    default: // Addition, Soustraction, Modulo, Minimum, Maximum
      return Math.max(da, db);
  }
}

/** Fonction d'arrondi d'un mode (Arrondi, Plancher, Plafond, Tronquer). */
const roundFn = (mode) => ({ Plancher: Math.floor, Plafond: Math.ceil, Tronquer: Math.trunc }[mode] ?? Math.round);

/** Bornes arrondies (l'arrondi est croissant : les bornes arrondies encadrent les valeurs arrondies). */
const roundBounds = ([lo, hi], fn, d = 0) => {
  const f = 10 ** d;
  const r = (x) => (typeof x === 'number' && Number.isFinite(x) ? fn(x * f) / f : undefined);
  return [r(lo), r(hi)];
};

// ── Listes ─────────────────────────────────────────────────

/** Garanties de la liste d'entrée (`null` si inconnue). */
/** Une liste absente est une liste vide pour le nœud. */
const listOf = (input) => orEmpty(inputInfo(input('list')));
const countsOf = (l) => ({ minItems: l?.format?.minItems, maxItems: l?.format?.maxItems });
/** Liste qui garde (une partie de) ses éléments : mêmes garanties d'élément. */
const sameItems = (input, counts) => {
  const l = listOf(input);
  return listInfo(l ? elementOf(l) : null, counts(countsOf(l), l), l?.required);
};
/** Valeur d'une liste ou de l'entrée Valeur (si reliée), pour un élément. */
const itemOrValue = (input) => (input('value').connected ? inputInfo(input('value')) : elementOf(listOf(input)));

// ── Dates ──────────────────────────────────────────────────

const DATE_PART_BOUNDS = { Mois: [1, 12], Jour: [1, 31], 'Jour de la semaine': [0, 6] };
const names = (list) => String(list ?? '').split(',').map((s) => s.trim());

/** Décimales d'Arrondir, telles que le nœud les applique. */
export const roundDecimals = (d) => Math.max(0, Math.trunc(Number(d)) || 0);

/** Garanties de chaque nœud (voir plus haut). */
export const GUARANTEES = {
  // ── Entrée ────────────────────────────────────────────────
  const_string: (_i, p) => (blank(p.value) ? { base: 'string', required: false, format: {} } : literal(p.value, 'string')),
  const_number: (_i, p) => literal(p.value, 'number'),
  const_bool: () => ({ base: 'boolean', required: true, format: {} }),
  // Date et heure du moment : une date et heure, sans format (ISO).
  now: () => ({ base: 'datetime', required: true, format: {} }),

  // ── Structure ─────────────────────────────────────────────
  // L'élément courant dépend de la liste parcourue : inconnu. L'index est un entier ≥ 0.
  current: (_i, _p, _ids, { output }) => (output === 'index' ? { base: 'integer', required: true, format: { min: 0 } } : null),
  // Valeur lue par un chemin libre : inconnue.
  get_field: () => null,
  set_field: (input) => ({ base: 'object', required: presence(input('obj')), format: {} }),
  remove_field: (input) => ({ base: 'object', required: presence(input('obj')), format: {} }),
  list_create: (input, _p, ids) => {
    // Une entrée saisie vide est ignorée ; une liste reliée apporte tous ses éléments.
    const used = ids.map((id) => input(id)).filter((i) => i.connected || !blank(i.value));
    const infos = used.map(inputInfo);
    // Une valeur de type inconnu peut être une liste (ses éléments sont alors ajoutés un à un) : rien de garanti.
    if (infos.some((x) => !x || x.base === 'any')) return listInfo(null, {}, true);
    const lists = infos.filter((x) => x.array);
    const singles = infos.filter((x) => !x.array);
    // Une liste absente donne un élément vide.
    const item = unionInfo([...singles, ...lists.map((l) => (l.required === true ? elementOf(l) : { ...elementOf(l), required: false }))]);
    const minItems = singles.length + lists.reduce((n, l) => n + (l.required === true ? (l.format.minItems ?? 0) : 1), 0);
    const maxItems = lists.every((l) => l.format.maxItems !== undefined) ? singles.length + lists.reduce((n, l) => n + Math.max(1, l.format.maxItems), 0) : undefined;
    return listInfo(item, { minItems, maxItems }, true);
  },

  // ── Liste ─────────────────────────────────────────────────
  list_filter: (input) => sameItems(input, (c) => ({ minItems: 0, maxItems: c.maxItems })),
  list_sort: (input) => sameItems(input, (c) => c),
  list_reverse: (input) => sameItems(input, (c) => c),
  list_unique: (input) => sameItems(input, (c) => ({ minItems: c.minItems >= 1 ? 1 : 0, maxItems: c.maxItems })),
  list_slice: (input) => {
    // slice(début, début + nombre) : borné par le nombre seulement si le début est un entier ≥ 0 connu.
    const [, count] = intBounds(input('count'));
    const start = input('start');
    const startOk = start.connected ? boundsOf(start.info)[0] >= 0 && start.info?.required === true : blank(start.value) || numberOf(start.value) >= 0;
    return sameItems(input, (c) => ({ minItems: 0, maxItems: startOk ? minOf(count, c.maxItems) : c.maxItems }));
  },
  list_map: (input) => {
    const l = listOf(input);
    const v = input('value');
    const item = inputInfo(v);
    return listInfo(item ? { ...item, array: false } : null, countsOf(l), l?.required);
  },
  // Index hors de la liste, élément non trouvé : pas de valeur.
  list_at: (input) => {
    const item = itemOrValue(input);
    return item ? { ...item, required: false } : null;
  },
  list_find: (input, _p, _ids, { output }) => {
    if (output === 'found') return { base: 'boolean', required: true, format: {} };
    const item = itemOrValue(input);
    return item ? { ...item, required: false } : null;
  },
  lookup: (input, _p, _ids, { output }) => {
    if (output === 'found') return { base: 'boolean', required: true, format: {} };
    const item = elementOf(inputInfo(input('values').connected ? input('values') : input('keys')));
    return item ? { ...item, required: false } : null;
  },
  list_count: (input) => {
    const c = countsOf(listOf(input));
    return { base: 'integer', required: true, format: { min: c.minItems ?? 0, max: c.maxItems } };
  },
  list_aggregate: (input, p) => {
    const l = listOf(input);
    const v = orEmpty(itemOrValue(input));
    const numeric = v && (v.base === 'number' || v.base === 'integer');
    // Liste vide : 0.
    const mayBeEmpty = !(l?.format?.minItems >= 1);
    const withZero = ([lo, hi]) => (mayBeEmpty ? [minOf(lo, 0), hi === undefined ? undefined : Math.max(hi, 0)] : [lo, hi]);
    const decimals = numeric ? decimalsOfInfo(v) : undefined;
    const format = {};
    if (p.op === 'Moyenne') format.maxDecimals = Infinity;
    else if (decimals !== undefined) format.maxDecimals = decimals;
    if (numeric && p.op !== 'Somme') [format.min, format.max] = withZero(boundsOf(v));
    if (numeric && p.op === 'Somme' && v.format.min >= 0) format.min = 0;
    return { base: 'number', required: true, format };
  },
  list_test: () => ({ base: 'boolean', required: true, format: {} }),
  list_join: (input, p) => {
    const l = listOf(input);
    const item = elementOf(l);
    const n = l?.format?.maxItems;
    const len = item?.format?.maxLength;
    const sep = Array.from(p.sep ?? '').length;
    // Présent (non vide) seulement si la liste a toujours un élément non vide.
    const required = l?.format?.minItems >= 1 && minLengthOf(item ?? {}) >= 1 ? true : false;
    const maxLength = n !== undefined && len !== undefined ? n * len + Math.max(0, n - 1) * sep : undefined;
    return { base: 'string', required, format: { maxLength } };
  },

  // ── Texte ─────────────────────────────────────────────────
  concat: (input, p, ids) => {
    const parts = ids.map((id) => textOf(input(id)));
    const lengths = parts.map((t) => t.format?.maxLength);
    const bounded = lengths.every((n) => typeof n === 'number');
    // Les entrées vides sont ignorées : présent si l'une est toujours présente.
    const required = anyPresent(parts.map((t) => t.required));
    // Une entrée toujours vide (saisie vide) est ignorée : pas de séparateur pour elle.
    const kept = parts.filter((t) => t.format?.maxLength !== 0).length;
    const seps = Math.max(0, kept - 1) * Array.from(p.sep).length;
    // Une partie qui peut manquer est ignorée : seules les parties toujours présentes comptent.
    const minLength = parts.reduce((n, t) => n + (t.required === true ? minLengthOf(t) : 0), 0);
    return { base: 'string', required, format: { minLength: minLength || undefined, maxLength: bounded ? lengths.reduce((x, y) => x + y, 0) + seps : undefined } };
  },
  case: (input) => {
    const t = textOf(input('text'));
    // Pas de longueur maximale : changer la casse peut allonger un texte (ß devient SS).
    return { base: 'string', required: t.required, format: { minLength: t.format?.minLength } };
  },
  // Un texte fait d'espaces devient vide : la présence n'est plus garantie.
  trim: (input) => {
    const t = textOf(input('text'));
    return { base: 'string', required: t.required === false ? false : undefined, format: { maxLength: t.format?.maxLength } };
  },
  substring: (input, p) => {
    const t = textOf(input('text'));
    const [countMin, countMax] = intBounds(input('count'));
    // En milieu, le début peut tomber après la fin du texte : pas de longueur minimale.
    const minLength = p.mode === 'Milieu' ? 0 : minOf(countMin, minLengthOf(t)) ?? 0;
    const required = t.required === false ? false : minLength >= 1 ? true : undefined;
    return { base: 'string', required, format: { minLength: minLength || undefined, maxLength: minOf(countMax, t.format?.maxLength) } };
  },
  replace: (input, p) => {
    const t = textOf(input('text'));
    if (!p.search) return { ...t, base: 'string' };
    const [s, r] = [Array.from(p.search).length, Array.from(p.replace ?? '').length];
    return {
      base: 'string',
      // Remplacer par rien peut vider le texte.
      required: r > 0 || t.required === false ? t.required : undefined,
      format: { maxLength: r <= s ? t.format?.maxLength : undefined, minLength: r >= s ? t.format?.minLength : undefined },
    };
  },
  // Le morceau peut être vide (index absent, séparateurs consécutifs).
  split: (input) => {
    const t = textOf(input('text'));
    return { base: 'string', required: t.required === false ? false : undefined, format: { maxLength: t.format?.maxLength } };
  },
  split_list: (input) => {
    const t = textOf(input('text'));
    return listInfo({ base: 'string', required: undefined, format: { maxLength: t.format?.maxLength } }, { minItems: t.required ? 1 : 0 }, true);
  },
  length: (input) => {
    const t = orEmpty(textOf(input('text')));
    return { base: 'integer', required: true, format: { min: t.format?.minLength ?? 0, max: t.format?.maxLength } };
  },

  // ── Math ──────────────────────────────────────────────────
  math: (input, p) => {
    const [a, b] = [input('a'), input('b')];
    const [lo, hi] = intervalOf(p.op, boundsOf(numberIn(a)), boundsOf(numberIn(b)));
    return {
      base: 'number',
      required: allPresent([presence(a), presence(b)]),
      format: { min: lo, max: hi, maxDecimals: mathDecimals(p.op, a, b) },
    };
  },
  round: (input, p) => {
    const i = input('value');
    const v = numberIn(i);
    const d = roundDecimals(p.decimals);
    const before = decimalsOfInfo(v);
    const [min, max] = roundBounds(boundsOf(v), roundFn(p.mode), d);
    return { base: 'number', required: presence(i), format: { min, max, maxDecimals: before === undefined ? d : Math.min(d, before) } };
  },

  // ── Logique ───────────────────────────────────────────────
  compare: () => ({ base: 'boolean', required: true, format: {} }),
  logic: () => ({ base: 'boolean', required: true, format: {} }),
  not: () => ({ base: 'boolean', required: true, format: {} }),
  // L'une ou l'autre branche : seul ce que les deux garantissent reste garanti.
  switch: (input, _p, _ids, { libraries }) => unionInfo([inputInfo(input('yes')), inputInfo(input('no'))], libraries),
  coalesce: (input, _p, _ids, { libraries }) => {
    const [value, fallback] = [input('value'), input('fallback')];
    const v = inputInfo(value);
    // Valeur toujours présente : le défaut ne sert jamais ; pas de défaut : la valeur seule.
    if (v?.required === true || (!fallback.connected && blank(fallback.value))) return v;
    const u = unionInfo([v, inputInfo(fallback)], libraries);
    return u && { ...u, required: anyPresent([v?.required, presence(fallback)]) };
  },

  // ── Conversion ────────────────────────────────────────────
  to_string: (input) => {
    const v = inputInfo(input('value'));
    if (!v) return { base: 'string', required: undefined, format: {} };
    if (v.base === 'string') return v;
    return { base: 'string', required: v.required, format: {} };
  },
  to_number: (input) => {
    const v = orEmpty(inputInfo(input('value')));
    if (v && (v.base === 'number' || v.base === 'integer')) return v;
    if (v?.base === 'boolean') return { base: 'number', required: v.required, format: { min: 0, max: 1, maxDecimals: 0 } };
    if (v && (v.base === 'date' || v.base === 'datetime')) return { base: 'number', required: v.required, format: { maxDecimals: 0 } };
    // Texte : la conversion réussit seulement si toutes les valeurs possibles sont des nombres.
    const set = valuesOf(v);
    const nums = set?.values.map(numberOf);
    if (nums && nums.every((n) => n !== undefined)) {
      return { base: 'number', required: v.required, format: { min: Math.min(...nums), max: Math.max(...nums), maxDecimals: maxOfAll(nums.map(decimalsOf)), allowed: valueSet('', 'number', nums) } };
    }
    return { base: 'number', required: v?.required, format: {}, risk: 'number' };
  },
  to_integer: (input, p) => {
    const v = numberIn(input('value'));
    const [min, max] = roundBounds(boundsOf(v), roundFn(p.mode));
    return { base: 'integer', required: v?.required, format: { min, max } };
  },
  to_bool: () => ({ base: 'boolean', required: true, format: {} }),
  transcode: (input, _p, _ids, { libraries }) => {
    const table = input('table');
    const lib = table.connected && table.info?.table ? libraries.get(table.info.table) : undefined;
    // Table inconnue : rien de garanti.
    if (!lib?.mapped) return null;
    const value = input('value');
    const fallback = input('fallback');
    // Valeurs possibles en entrée : celles d'une bibliothèque, d'un ensemble garanti, ou la valeur saisie.
    const given = value.connected ? valuesOf(value.info, libraries) : valueSet('', lib.item, value.value === '' ? [] : [value.value]);
    // Toutes ont une correspondance : la valeur par défaut ne sert jamais.
    // Avec les clés de la recherche réelle (texte de la valeur) : « 05 » ne trouve pas 5.
    const keys = new Set(lib.mappedValues.values.map(tableKey));
    const covered = !!given && given.values.every((x) => keys.has(tableKey(x)));
    const typedFallback = !fallback.connected && fallback.value !== '';
    let allowed;
    if (covered) allowed = lib.targetValues;
    else if (!fallback.connected) allowed = valueSet(lib.targetValues.label, lib.outItem, [...lib.targetValues.values, ...(typedFallback ? [fallback.value] : [])]);
    // Présente : celle reçue si toutes ont une correspondance, sinon il faut une valeur par défaut.
    const required = covered ? (value.connected ? value.info?.required : true) : fallback.connected ? fallback.info?.required : typedFallback;
    return { required, base: lib.outItem, format: allowed ? { allowed } : {} };
  },

  // ── Date ──────────────────────────────────────────────────
  date_reformat: (input, p) => {
    const i = input('date');
    return { base: hasTime(p.format) ? 'datetime' : 'date', required: presence(i), format: { dateFormat: p.format } };
  },
  date_part: (input, p, _ids, { output }) => {
    const v = inputInfo(input('date'));
    const required = v?.required;
    if (output !== 'name') {
      const [min, max] = DATE_PART_BOUNDS[p.part] ?? [];
      // Date absente : le nombre vaut 0.
      return orEmpty({ base: 'integer', required, format: { min, max } });
    }
    const list = p.part === 'Jour de la semaine' ? names(p.days) : p.part === 'Mois' ? names(p.months) : null;
    if (!list) return { base: 'string', required, format: { minLength: 1 } };
    const wanted = p.part === 'Mois' ? 12 : 7;
    const used = list.slice(0, wanted);
    const complete = used.length === wanted && used.every((s) => s !== '');
    const lengths = used.map((s) => Array.from(s).length);
    return {
      base: 'string',
      required: complete ? required : false,
      format: { minLength: Math.min(...lengths) || undefined, maxLength: Math.max(...lengths), allowed: valueSet('', 'string', used.filter(Boolean)) },
    };
  },
  age: (input) => {
    const v = inputInfo(input('date'));
    return { base: 'integer', required: v?.required, format: { maxDecimals: 0 } };
  },
};

/** Garanties d'une valeur saisie dans un réglage. */
function literal(value, type) {
  const n = numberOf(value);
  if (type === 'number') {
    if (n === undefined) return { base: 'number', required: false, format: {}, risk: blank(value) ? undefined : 'number' };
    return { base: 'number', required: true, format: { min: n, max: n, maxDecimals: decimalsOf(n), allowed: valueSet('', 'number', [n]) } };
  }
  const len = Array.from(String(value)).length;
  return { base: 'string', required: true, format: { minLength: len, maxLength: len, allowed: valueSet('', 'string', [String(value)]) } };
}
