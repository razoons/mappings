import { effectiveDateFormat, isDateType } from './dateFormats';
import { valueSet } from './libraries';
import { baseOf, decimalsOf, isList } from './types';

/**
 * Garanties sur une valeur (contrôle statique des cibles, voir lib/rules.js) :
 * `{ base, array, required, format }`.
 * - `base` : type de la valeur (de ses éléments pour une liste) ; `'any'` : type inconnu ;
 * - `required` : `true` toujours présente (ni absente, ni vide), `false` peut manquer, `undefined` inconnu ;
 * - `itemRequired` (liste) : même chose pour chacun de ses éléments ;
 * - `format` : règles garanties (mêmes clés que le format d'un champ, lib/formats.js), plus `allowed`
 *   (ensemble des valeurs possibles, voir lib/libraries.js). Une règle absente n'est pas garantie ;
 *   `maxDecimals: Infinity` : décimales non bornées ; `dateFormat` : `MIXED_DATE_FORMAT` si plusieurs formats sont possibles.
 * `null` : rien n'est garanti (valeur inconnue).
 */

/** Format de date d'une valeur qui peut en avoir plusieurs. */
export const MIXED_DATE_FORMAT = '*';

/** Valeur absente, comme pour le contrôle de conformité (un texte d'espaces est une valeur). */
const blank = (v) => v === undefined || v === null || v === '';
const LIST_KEYS = ['minItems', 'maxItems'];
const LOWER = ['minLength', 'min', 'minItems', 'minDate'];
const UPPER = ['maxLength', 'max', 'maxItems', 'maxDate', 'maxDecimals'];

/** Garanties complétées : un entier n'a pas de décimales, une date a un format (ISO par défaut). */
export function normalize(info) {
  if (!info) return null;
  const format = { ...(info.format ?? {}) };
  // Une borne incalculable (NaN) n'est pas une garantie.
  for (const [k, v] of Object.entries(format)) if (v === undefined || v === null || v === '' || Number.isNaN(v)) delete format[k];
  if (info.base === 'integer') format.maxDecimals = 0;
  if (isDateType(info.base)) format.dateFormat = effectiveDateFormat(info.base, format.dateFormat);
  return { ...info, format };
}

/** Nombre lu dans une saisie (virgule acceptée), `undefined` s'il n'en est pas un. */
export function numberOf(v) {
  if (blank(v)) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const n = Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/** Garanties d'une valeur saisie dans une entrée de type `type` (une entrée « Tout » prend le type du texte saisi). */
export function literalInfo(value, type = 'any') {
  const t = baseOf(type);
  if (blank(value)) return normalize({ base: t, array: false, required: false, format: {} });
  const s = String(value);
  const n = numberOf(value);
  const kind = t !== 'any' ? t : n !== undefined ? (Number.isInteger(n) ? 'integer' : 'number') : /^(true|false)$/i.test(s.trim()) ? 'boolean' : 'string';
  if (kind === 'number' || kind === 'integer') {
    if (n === undefined) return normalize({ base: kind, array: false, required: false, format: {} });
    const v = kind === 'integer' ? Math.trunc(n) : n;
    return normalize({ base: kind, array: false, required: true, format: { min: v, max: v, maxDecimals: decimalsOf(v), allowed: valueSet('', kind, [v]) } });
  }
  if (kind === 'string') {
    const len = Array.from(s).length;
    return normalize({ base: 'string', array: false, required: true, format: { minLength: len, maxLength: len, allowed: valueSet('', 'string', [s]) } });
  }
  // Booléen, date… : présente, sans autre garantie.
  return normalize({ base: kind, array: false, required: true, format: {} });
}

/** Garanties d'une entrée d'un nœud (`{ connected, info, value, type }`, voir lib/rules.js). */
export const inputInfo = (i) => (i.connected ? i.info : literalInfo(i.value, i.type));

/** Présence garantie d'une entrée (reliée : celle de l'amont ; saisie : non vide). */
export const presence = (i) => (i.connected ? i.info?.required : !blank(i.value));

/** Toutes présentes : `false` si l'une peut manquer, `undefined` si l'une est inconnue. */
export function allPresent(list) {
  return list.includes(false) ? false : list.includes(undefined) ? undefined : true;
}

/** Au moins une présente : `true` si l'une l'est toujours, `false` si toutes peuvent manquer. */
export function anyPresent(list) {
  return list.includes(true) ? true : list.includes(undefined) ? undefined : false;
}

/** Ensemble des valeurs possibles d'une valeur (bibliothèque ou ensemble garanti), `undefined` sinon. */
export const valuesOf = (info, libraries) => (info?.format?.library && libraries?.get(info.format.library)) || info?.format?.allowed;

/** Type commun de plusieurs valeurs (`'any'` s'ils diffèrent). */
function commonBase(bases) {
  if (bases.every((b) => b === bases[0])) return bases[0];
  if (bases.every((b) => b === 'integer' || b === 'number')) return 'number';
  return 'any';
}

/**
 * Garanties d'une valeur qui peut venir de l'une ou l'autre de plusieurs valeurs (Condition, Valeur par défaut…) :
 * ne reste garanti que ce que toutes garantissent. `required` : toutes présentes (voir `allPresent`).
 */
export function unionInfo(infos, libraries) {
  if (!infos.length || infos.some((i) => !i)) return null;
  const all = infos.map(normalize);
  const base = commonBase(all.map((i) => i.base));
  const format = {};
  for (const k of LOWER) {
    const xs = all.map((i) => i.format[k]);
    if (xs.every((x) => x !== undefined)) format[k] = xs.reduce((a, b) => (a < b ? a : b));
  }
  for (const k of UPPER) {
    const xs = all.map((i) => i.format[k]);
    if (xs.every((x) => x !== undefined)) format[k] = xs.reduce((a, b) => (a > b ? a : b));
  }
  // Décimales : non bornées dès qu'une valeur n'est pas un nombre borné.
  if (base === 'number' && format.maxDecimals === undefined) format.maxDecimals = Infinity;
  const same = (k) => all.every((i) => i.format[k] === all[0].format[k]);
  if (same('pattern') && all[0].format.pattern !== undefined) format.pattern = all[0].format.pattern;
  if (same('library') && all[0].format.library !== undefined) format.library = all[0].format.library;
  else {
    const sets = all.map((i) => valuesOf(i, libraries));
    if (sets.every(Boolean)) format.allowed = valueSet('', base, sets.flatMap((s) => s.values));
  }
  if (all.every((i) => isDateType(i.base))) format.dateFormat = same('dateFormat') ? all[0].format.dateFormat : MIXED_DATE_FORMAT;
  const array = all.every((i) => i.array) ? true : all.every((i) => !i.array) ? false : undefined;
  const itemRequired = array ? allPresent(all.map((i) => i.itemRequired)) : undefined;
  return normalize({ base: array === undefined ? 'any' : base, array: !!array, required: allPresent(all.map((i) => i.required)), itemRequired, format });
}

/** Garanties d'un élément d'une liste (sans les règles sur le nombre d'éléments) ; sa présence est `itemRequired`. */
export function elementOf(info) {
  if (!info) return null;
  const format = Object.fromEntries(Object.entries(info.format ?? {}).filter(([k]) => !LIST_KEYS.includes(k)));
  return normalize({ ...info, array: false, required: info.array ? info.itemRequired : info.required, itemRequired: undefined, format });
}

/** Garanties d'une liste dont les éléments ont les garanties `item`, avec `minItems` / `maxItems`. */
export function listInfo(item, counts = {}, required = true) {
  const format = { ...(item?.format ?? {}) };
  for (const k of LIST_KEYS) delete format[k];
  if (counts.minItems !== undefined) format.minItems = counts.minItems;
  if (counts.maxItems !== undefined) format.maxItems = counts.maxItems;
  return normalize({ base: item?.base ?? 'any', array: true, required, itemRequired: item?.required, format: item ? format : { ...counts } });
}

/**
 * Garanties d'une valeur qui, absente, est remplacée par 0, une liste vide ou un texte vide (entrées converties d'un
 * nœud) : les bornes doivent alors inclure 0, et les valeurs possibles ne sont plus garanties.
 */
export function orEmpty(info) {
  if (!info || info.required === true) return info;
  const f = { ...info.format };
  if (f.min !== undefined) f.min = Math.min(f.min, 0);
  if (f.max !== undefined) f.max = Math.max(f.max, 0);
  if (f.minItems !== undefined) f.minItems = 0;
  if (f.minLength !== undefined) f.minLength = 0;
  delete f.allowed;
  delete f.library;
  return normalize({ ...info, format: f });
}

/** Ne garde que les règles de format données (le reste n'est plus garanti). */
export function keep(info, keys, extra = {}) {
  if (!info) return null;
  const format = Object.fromEntries(Object.entries(info.format ?? {}).filter(([k]) => keys.includes(k)));
  return normalize({ ...info, ...extra, format: { ...format, ...(extra.format ?? {}) } });
}

/** Garanties de type « Tout » : rien n'est connu. */
export const unknownInfo = (type = 'any') => ({ base: baseOf(type), array: isList(type), required: undefined, format: {}, unknown: true });

// ── Intervalles (bornes min / max d'un nombre) ─────────────

/** Bornes `[min, max]` d'une valeur numérique (`undefined` pour une borne inconnue). */
export const boundsOf = (info) => [info?.format?.min, info?.format?.max];

const known = (...xs) => xs.every((x) => typeof x === 'number' && !Number.isNaN(x));

/** Bornes du résultat d'une opération sur deux intervalles ; `[undefined, undefined]` si elles ne sont pas sûres. */
export function intervalOf(op, [a1, a2], [b1, b2]) {
  const none = [undefined, undefined];
  switch (op) {
    case 'Addition':
      return [known(a1, b1) ? a1 + b1 : undefined, known(a2, b2) ? a2 + b2 : undefined];
    case 'Soustraction':
      return [known(a1, b2) ? a1 - b2 : undefined, known(a2, b1) ? a2 - b1 : undefined];
    case 'Multiplication': {
      if (!known(a1, a2, b1, b2)) return none;
      const p = [a1 * b1, a1 * b2, a2 * b1, a2 * b2];
      return [Math.min(...p), Math.max(...p)];
    }
    case 'Division': {
      // Diviseur qui peut valoir 0 : pas de borne.
      if (!known(a1, a2, b1, b2) || (b1 <= 0 && b2 >= 0)) return none;
      const p = [a1 / b1, a1 / b2, a2 / b1, a2 / b2];
      return [Math.min(...p), Math.max(...p)];
    }
    case 'Minimum':
      return [known(a1, b1) ? Math.min(a1, b1) : undefined, known(a2, b2) ? Math.min(a2, b2) : undefined];
    case 'Maximum':
      return [known(a1, b1) ? Math.max(a1, b1) : undefined, known(a2, b2) ? Math.max(a2, b2) : undefined];
    case 'Modulo': {
      // Le reste a le signe de A et reste plus petit que |B|.
      if (!known(b1, b2)) return none;
      const m = Math.max(Math.abs(b1), Math.abs(b2));
      return [known(a1) && a1 >= 0 ? 0 : -m, known(a2) && a2 <= 0 ? 0 : m];
    }
    default:
      return none;
  }
}
