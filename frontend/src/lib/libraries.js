import { t } from './i18n';

/**
 * Bibliothèque de valeurs : nœud `library` qui porte une liste de valeurs autorisées, d'un type donné, et
 * facultativement une table de correspondance (chaque valeur → une valeur d'un autre référentiel).
 * `data` : `{ label, item, values, mapped?, outItem?, targets? }` :
 * - `item` vaut `string | number | integer | date`, `values` les valeurs (textes pour `string` et `date`,
 *   nombres pour `number` et `integer`) ;
 * - `mapped` : la colonne Correspondance est affichée et la sortie « Table » existe ; `outItem` est son type,
 *   `targets` ses valeurs, au même rang que `values` (`null` : pas de correspondance pour cette valeur).
 *
 * Un champ (source ou cible, simple ou liste de valeurs simples) s'y réfère par `format.library` (id du nœud) :
 * sa valeur — ou chaque élément d'une liste — doit faire partie de la bibliothèque. Plusieurs champs peuvent
 * partager la même bibliothèque. Sa sortie « Valeurs » fournit la liste aux transformations, sa sortie « Table »
 * l'objet `{ valeur: correspondance }` au nœud Transcoder.
 */

export const LIBRARY_TYPES = ['string', 'integer', 'number', 'date'];

/** Sockets de sortie d'une bibliothèque : la liste des valeurs, la table de correspondance. */
export const LIBRARY_OUTPUT = 'values';
export const LIBRARY_TABLE = 'table';

/** Une valeur saisie, sans espaces autour, convertie selon le type de la bibliothèque (`undefined` si elle est vide ou illisible). */
export function parseLibraryValue(item, raw) {
  const s = String(raw ?? '').trim();
  if (s === '') return undefined;
  if (item === 'number' || item === 'integer') {
    const n = Number(s.replace(',', '.'));
    if (Number.isNaN(n)) return undefined;
    return item === 'integer' ? Math.trunc(n) : n;
  }
  if (item === 'date' && Number.isNaN(new Date(s).getTime())) return undefined;
  return s;
}

/** Clé de comparaison : une date vaut son instant, un nombre sa valeur (5 et « 5 » se valent). */
function keyOf(item, v) {
  if (item === 'date') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? `?${v}` : `d${d.getTime()}`;
  }
  if (item === 'number' || item === 'integer') {
    const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
    return Number.isNaN(n) ? `?${v}` : `n${n}`;
  }
  return `s${v}`;
}

/** Valeurs sans doublon (dans l'ordre). */
export function unique(values, item) {
  const seen = new Set();
  return values.filter((v) => {
    const k = keyOf(item, v);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── Lignes (valeur → correspondance) ───────────────────────

/** Lignes d'une bibliothèque : `[{ value, target }]` (`target` : `null` sans correspondance). */
export const rowsOf = (data) => (data.values ?? []).map((value, i) => ({ value, target: data.targets?.[i] ?? null }));

/**
 * Données d'une bibliothèque à partir de lignes saisies : valeurs et correspondances converties selon leur type,
 * lignes à valeur vide ou illisible retirées, doublons retirés (la première ligne l'emporte).
 */
export function fromRows(rows, item, outItem = 'string') {
  const seen = new Set();
  const values = [];
  const targets = [];
  for (const r of rows) {
    const value = parseLibraryValue(item, r.value);
    if (value === undefined || seen.has(keyOf(item, value))) continue;
    seen.add(keyOf(item, value));
    values.push(value);
    targets.push(parseLibraryValue(outItem, r.target) ?? null);
  }
  return { values, targets };
}

/** Clé d'une valeur dans la table de correspondance (une date sans heure s'écrit AAAA-MM-JJ, comme dans la bibliothèque). */
export function tableKey(v) {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '';
    const iso = v.toISOString();
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
  }
  return String(v ?? '');
}

/** Table de correspondance d'une bibliothèque : `{ valeur: correspondance }`, sans les valeurs qui n'en ont pas. */
export const tableOf = (data) =>
  Object.fromEntries(rowsOf(data).filter((r) => r.target !== null && r.target !== '').map((r) => [tableKey(r.value), r.target]));

// ── Ensembles de valeurs (contrôles) ───────────────────────

/**
 * Ensemble de valeurs : `{ id?, label, item, values, indexOf(v), has(v) }`. `has(v)` dit si une valeur en fait
 * partie, `indexOf(v)` son rang (`-1` sinon). Une bibliothèque en est un ; les valeurs que garantit un nœud
 * Transcoder aussi.
 */
export function valueSet(label, item, values, id) {
  const kept = unique(values, item);
  const keys = kept.map((v) => keyOf(item, v));
  const indexOf = (v) => keys.indexOf(keyOf(item, v));
  return { id, label, item, values: kept, indexOf, has: (v) => indexOf(v) >= 0 };
}

/**
 * Bibliothèques du schéma, par id : un ensemble de valeurs (voir `valueSet`), plus, pour une table de
 * correspondance, `mapped: true`, `mappedValues` (les valeurs qui ont une correspondance) et `targetValues`
 * (les correspondances).
 */
export function librariesOf(nodes) {
  const map = new Map();
  for (const n of nodes) {
    if (n.type !== 'library') continue;
    const label = n.data.label || t('Bibliothèque', 'Library');
    const item = n.data.item ?? 'string';
    const lib = valueSet(label, item, n.data.values ?? [], n.id);
    if (n.data.mapped) {
      const rows = rowsOf(n.data).filter((r) => r.target !== null && r.target !== '');
      const outItem = n.data.outItem ?? 'string';
      Object.assign(lib, {
        mapped: true,
        outItem,
        mappedValues: valueSet(label, item, rows.map((r) => r.value)),
        targetValues: valueSet(t(`correspondances de « ${label} »`, `mappings of “${label}”`), outItem, rows.map((r) => r.target)),
      });
    }
    map.set(n.id, lib);
  }
  return map;
}

/** Valeurs de `a` absentes de `b` (pour savoir si un ensemble de valeurs en garantit un autre). */
export const missingFrom = (a, b) => a.values.filter((v) => !b.has(v));

/** Nom affiché d'une bibliothèque référencée (« bibliothèque supprimée » si elle n'existe plus). */
export const libraryName = (libraries, id) => libraries?.get(id)?.label ?? t('bibliothèque supprimée', 'deleted library');
