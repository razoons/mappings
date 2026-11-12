import { t } from './i18n';
import { bindsOf, isPlainObject, tagList } from './lists';

/**
 * Types de sockets : un scalaire (`string`, `number`, `integer`, `boolean`, `date`, `object`, `any`)
 * ou une liste de scalaires (`string[]`…).
 *
 * Champ d'un modèle : `{ id, name, type, item?, children?, collapsed?, required?, format? }` où `type` vaut
 * `string | number | integer | boolean | date | object | array` et `item` le type des éléments d'un tableau
 * (`required` et `format` : voir lib/formats.js).
 */
export const isList = (t) => t.endsWith('[]');
export const baseOf = (t) => t.replace('[]', '');
export const listOf = (s) => `${s}[]`;

export const SOCKET_COLORS = {
  string: '#70b2ff',
  number: '#a1a1a1',
  integer: '#5f9e6e',
  boolean: '#cca6d6',
  date: '#e8a33d',
  object: '#8f73e6',
  any: '#3fd6a3',
};

const TYPE_LABELS = {
  string: ['Texte', 'Text'],
  number: ['Nombre', 'Number'],
  integer: ['Entier', 'Integer'],
  boolean: ['Booléen', 'Boolean'],
  date: ['Date', 'Date'],
  object: ['Objet', 'Object'],
  any: ['Tout', 'Any'],
};

const LIST_LABELS = {
  string: ['Liste de textes', 'List of texts'],
  number: ['Liste de nombres', 'List of numbers'],
  integer: ['Liste d’entiers', 'List of integers'],
  boolean: ['Liste de booléens', 'List of booleans'],
  date: ['Liste de dates', 'List of dates'],
  object: ['Liste d’objets', 'List of objects'],
  any: ['Liste', 'List'],
};

const pick = (pair) => pair && t(...pair);
export const socketTitle = (type) => pick(isList(type) ? LIST_LABELS[baseOf(type)] : TYPE_LABELS[type]);

/** Types numériques : un entier est aussi un nombre. */
export const isNumeric = (t) => t === 'number' || t === 'integer';

export const HEADER_COLORS = {
  source: '#2b6e4c',
  target: '#8c3b2c',
  library: '#6b5a2e',
  group: '#5b6170',
  Entrée: '#83314a',
  Structure: '#7a4a6a',
  Liste: '#1f7a6a',
  Texte: '#3c5f8c',
  Math: '#3e4f8f',
  Logique: '#6a3d8a',
  Conversion: '#55595e',
  Date: '#8a6a24',
};

export const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Écart entre deux types de base (une liste peut alimenter une entrée simple, évaluée par élément) :
 * `null` si aucun, `'conversion'` si la valeur est convertie implicitement (nombre → texte, nombre → entier…),
 * `'incompatible'` si la conversion n'a pas de sens (texte → date…). Tout lien est permis : le contrôle le signale.
 */
export function typeMismatch(from, to) {
  const [f, t] = [baseOf(from), baseOf(to)];
  if (f === t || f === 'any' || t === 'any' || (f === 'integer' && t === 'number')) return null;
  if (t === 'string') return 'conversion';
  if (isNumeric(t) && (isNumeric(f) || f === 'boolean' || f === 'date')) return 'conversion';
  if (t === 'boolean' && isNumeric(f)) return 'conversion';
  return 'incompatible';
}

/** Types qui se branchent sans perte de sens (choix du socket quand un lien crée un nœud). */
export const canConnect = (from, to) => typeMismatch(from, to) !== 'incompatible';

const TRUTHY = ['true', '1', 'oui', 'yes', 'vrai', 'y', 'o', 'x'];

function coerceScalar(v, type) {
  switch (type) {
    case 'any':
    case 'object':
      return v;
    case 'string':
      if (v == null) return '';
      if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString();
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    case 'number':
      if (v == null || v === '') return 0;
      if (typeof v === 'number') return v;
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (v instanceof Date) return v.getTime();
      return Number(String(v).trim().replace(',', '.'));
    case 'integer':
      return Math.trunc(coerceScalar(v, 'number'));
    case 'boolean':
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      if (v == null) return false;
      return TRUTHY.includes(String(v).trim().toLowerCase());
    case 'date':
      if (v instanceof Date) return v;
      if (v == null || v === '') return new Date(NaN);
      return new Date(v);
  }
}

export function coerce(v, type) {
  if (!isList(type)) return coerceScalar(v, type);
  const base = baseOf(type);
  const arr = Array.isArray(v) ? v : v == null || v === '' ? [] : [v];
  if (base === 'any' || base === 'object') return arr;
  return tagList(
    arr.map((x) => coerceScalar(x, base)),
    bindsOf(arr),
  );
}

export function formatValue(v, depth = 0) {
  if (v === undefined) return '';
  if (v === null) return 'null';
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return t('Date invalide', 'Invalid date');
    const iso = v.toISOString();
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso.slice(0, 16).replace('T', ' ');
  }
  if (Array.isArray(v)) {
    if (depth > 0) return `[${v.length}]`;
    const head = v.slice(0, 3).map((x) => formatValue(x, 1));
    return `[${v.length}] ${head.join(', ')}${v.length > 3 ? ', …' : ''}`;
  }
  if (isPlainObject(v)) {
    const keys = Object.keys(v);
    return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', …' : ''}}`;
  }
  if (typeof v === 'string') return `"${v}"`;
  if (typeof v === 'boolean') return v ? t('vrai', 'true') : t('faux', 'false');
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(+v.toFixed(4));
  return String(v);
}
