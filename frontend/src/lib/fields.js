import { bilingual, t } from './i18n';
import { cleanFormat } from './formats';
import { isPlainObject } from './lists';
import { listOf, uid } from './types';

export const isContainer = (f) => f.type === 'object' || (f.type === 'array' && f.item === 'object');

/** Chaîne des champs de la racine jusqu'au champ `id`. */
export function findChain(fields, id) {
  for (const f of fields) {
    if (f.id === id) return [f];
    const sub = f.children && findChain(f.children, id);
    if (sub) return [f, ...sub];
  }
  return undefined;
}

export const allFields = (fields) => fields.flatMap((f) => [f, ...allFields(f.children ?? [])]);

export const descendantIds = (f) => allFields(f.children ?? []).map((d) => d.id);

/**
 * Type du socket de sortie d'un champ source. Sous un tableau, un champ produit une liste
 * (toutes les valeurs) tant que ce tableau n'est pas en cours d'itération.
 */
export function sourceSocketType(chain) {
  const last = chain.at(-1);
  if (last.type === 'array') return listOf(last.item ?? 'string');
  const inArray = chain.slice(0, -1).some((f) => f.type === 'array');
  return inArray ? listOf(last.type) : last.type;
}

/** Type du socket d'entrée d'un champ cible (sous un tableau, il est évalué pour chaque élément). */
export const targetSocketType = (f) => (f.type === 'array' ? listOf(f.item ?? 'string') : f.type);

/** `orders[].lines[].qty` */
export const pathLabel = (chain) =>
  chain.map((f, i) => f.name + (f.type === 'array' && i < chain.length - 1 ? '[]' : '')).join('.');

export function mapField(fields, id, fn) {
  return fields.map((f) => (f.id === id ? fn(f) : f.children ? { ...f, children: mapField(f.children, id, fn) } : f));
}

export function removeField(fields, id) {
  return fields.filter((f) => f.id !== id).map((f) => (f.children ? { ...f, children: removeField(f.children, id) } : f));
}

/** Position de dépôt : `before`, `after`, `inside-start` ou `inside-end`. */
function insertField(fields, targetId, f, pos) {
  return fields.flatMap((x) => {
    if (x.id === targetId) {
      if (pos === 'before') return [f, x];
      if (pos === 'after') return [x, f];
      const children = x.children ?? [];
      return [{ ...x, collapsed: false, children: pos === 'inside-start' ? [f, ...children] : [...children, f] }];
    }
    return x.children ? [{ ...x, children: insertField(x.children, targetId, f, pos) }] : [x];
  });
}

/** Déplace un champ (avec ses descendants) ; `targetId` nul = fin de la racine. Refuse de le déposer en lui-même. */
export function moveField(fields, dragId, targetId, pos) {
  if (dragId === targetId) return fields;
  const dragged = findChain(fields, dragId)?.at(-1);
  if (!dragged || descendantIds(dragged).includes(targetId ?? '')) return fields;
  const without = removeField(fields, dragId);
  return targetId ? insertField(without, targetId, dragged, pos) : [...without, dragged];
}

/** Replie ou déplie tous les objets et tableaux de l'arbre. */
export const setTreeCollapsed = (fields, collapsed) =>
  fields.map((f) => (f.children ? { ...f, collapsed, children: setTreeCollapsed(f.children, collapsed) } : f));

/** Lignes visibles de l'arbre ; les descendants d'un nœud replié sont listés dans `hidden`. */
export function flattenRows(fields, depth = 0, parents = []) {
  return fields.flatMap((field) => {
    const chain = [...parents, field];
    const children = field.children ?? [];
    if (field.collapsed) return [{ field, depth, chain, hidden: allFields(children) }];
    return [{ field, depth, chain, hidden: [] }, ...flattenRows(children, depth + 1, chain)];
  });
}

/** Types proposés pour un champ : `[clé, libellé]` (libellé dans la langue de l'interface). */
export const TYPE_OPTIONS = [
  ['string', 'Texte', 'Text'],
  ['number', 'Nombre', 'Number'],
  ['integer', 'Entier', 'Integer'],
  ['boolean', 'Booléen', 'Boolean'],
  ['date', 'Date', 'Date'],
  ['object', 'Objet', 'Object'],
  ['array:object', 'Liste d’objets', 'List of objects'],
  ['array:string', 'Liste de textes', 'List of texts'],
  ['array:number', 'Liste de nombres', 'List of numbers'],
  ['array:integer', 'Liste d’entiers', 'List of integers'],
  ['array:boolean', 'Liste de booléens', 'List of booleans'],
  ['array:date', 'Liste de dates', 'List of dates'],
].map(([key, fr, en]) => {
  const option = [key, fr];
  bilingual(option, 1, en);
  return option;
});

export const typeKey = (f) => (f.type === 'array' ? `array:${f.item ?? 'string'}` : f.type);

export function applyTypeKey(f, key) {
  const [type, item] = key.split(':');
  const next = { id: f.id, name: f.name, type, collapsed: f.collapsed };
  if (type === 'array') next.item = item;
  if (isContainer(next)) next.children = f.children ?? [];
  if (f.required) next.required = true;
  const format = cleanFormat(next, f.format);
  if (format) next.format = format;
  return next;
}

export const newField = (siblings, name) => ({
  id: uid('f'),
  name: name ?? `${t('champ', 'field')}_${siblings.length + 1}`,
  type: 'string',
});

/** Crée un champ dont le type correspond à un socket (ex. lien lâché dans le vide). */
export function fieldFromSocket(name, t) {
  const list = t.endsWith('[]');
  const base = t.replace('[]', '');
  const prim = base === 'any' ? 'string' : base;
  const field = list ? { id: uid('f'), name, type: 'array', item: prim } : { id: uid('f'), name, type: prim };
  if (isContainer(field)) field.children = [];
  return field;
}

/** Anciens fichiers : un nombre au format « entier » devient un champ de type Entier. */
export function migrateFields(fields) {
  return fields.map((f) => {
    let next = f;
    if (f.format?.integer) {
      const { integer, ...format } = f.format;
      next = { ...f, format: Object.keys(format).length ? format : undefined };
      if (integer && f.type === 'number') next.type = 'integer';
      if (integer && f.type === 'array' && f.item === 'number') next.item = 'integer';
      if (!next.format) delete next.format;
    }
    return next.children ? { ...next, children: migrateFields(next.children) } : next;
  });
}

// ── Déduction depuis un exemple JSON ───────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

function primitiveOf(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'string' && ISO_DATE.test(v)) return 'date';
  return 'string';
}

function inferField(name, v) {
  if (Array.isArray(v)) {
    const objects = v.filter(isPlainObject);
    if (objects.length) return { id: uid('f'), name, type: 'array', item: 'object', children: inferFields(Object.assign({}, ...objects)) };
    const items = v.filter((x) => x != null).map(primitiveOf);
    // Un seul décimal suffit pour que la liste soit de nombres.
    const item = items.every((t) => t === 'integer') ? items[0] : items.includes('number') ? 'number' : items[0];
    return { id: uid('f'), name, type: 'array', item: item ?? 'string' };
  }
  if (isPlainObject(v)) return { id: uid('f'), name, type: 'object', children: inferFields(v) };
  return { id: uid('f'), name, type: primitiveOf(v) };
}

const inferFields = (obj) => Object.entries(obj).map(([k, v]) => inferField(k, v));

/** Un tableau à la racine est rangé dans un champ `items`, la racine d'un modèle étant toujours un objet. */
export function parseDocument(text) {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return { items: parsed };
  if (!isPlainObject(parsed)) throw new Error('Il faut un objet JSON ou un tableau.');
  return parsed;
}

const EXAMPLE_VALUES = { string: 'texte', number: 0.5, integer: 0, boolean: false, date: '2026-01-01' };

/** Valeur type d'un champ (« texte », 0…), pour un exemple qui n'en précise pas. */
export const exampleOf = (f) => {
  if (f.type === 'object') return sampleFromFields(f.children ?? []);
  if (f.type === 'array') return [f.item === 'object' ? sampleFromFields(f.children ?? []) : EXAMPLE_VALUES[f.item ?? 'string']];
  return EXAMPLE_VALUES[f.type];
};

const sampleFromFields = (fields) => Object.fromEntries(fields.map((f) => [f.name, exampleOf(f)]));

// ── Synchronisation structure ⇄ JSON d’exemple ─────────────

/**
 * Réécrit un document d’exemple après une modification de la structure (déplacement, renommage…) :
 * chaque champ reprend sa valeur d’origine, retrouvée par son id. Un champ sorti d’un tableau
 * prend la valeur du premier élément ; un champ nouveau ou dont le type a changé, une valeur d’exemple.
 */
export function reshapeSample(oldFields, doc, newFields) {
  const read = (id, bound) => {
    const chain = findChain(oldFields, id);
    if (!chain) return undefined;
    let node = doc;
    for (const [i, f] of chain.entries()) {
      node = isPlainObject(node) ? node[f.name] : undefined;
      if (f.type === 'array' && i < chain.length - 1) node = bound.has(f.id) ? bound.get(f.id) : Array.isArray(node) ? node[0] : undefined;
    }
    return node;
  };
  const sameType = (f) => {
    const prev = findChain(oldFields, f.id)?.at(-1);
    return prev !== undefined && typeKey(prev) === typeKey(f);
  };

  const build = (fields, bound) =>
    Object.fromEntries(
      fields.map((f) => {
        if (f.type === 'object') return [f.name, build(f.children ?? [], bound)];
        const v = sameType(f) ? read(f.id, bound) : undefined;
        if (f.type === 'array' && f.item === 'object') {
          // Itère sur les éléments d’origine du tableau : ses sous-champs y lisent leurs valeurs.
          const items = Array.isArray(v) && v.length ? v : [undefined];
          return [f.name, items.map((el) => build(f.children ?? [], new Map(bound).set(f.id, el)))];
        }
        return [f.name, v === undefined ? exampleOf(f) : v];
      }),
    );
  return build(newFields, new Map());
}

/**
 * Met à jour la structure d’après un document JSON en gardant l’id (donc les liens) des champs
 * retrouvés par leur nom. Une valeur vide (null, []) ne dit rien du type : le champ existant est conservé.
 */
export function syncFields(old, obj) {
  return Object.entries(obj).map(([name, v]) => {
    const prev = old.find((f) => f.name === name);
    const inferred = inferField(name, v);
    if (!prev) return inferred;
    if (v == null || (Array.isArray(v) && v.length === 0)) return prev;
    const next = { ...inferred, id: prev.id, collapsed: prev.collapsed };
    if (prev.required) next.required = true;
    // Une chaîne peut être un texte ou une date : on garde le choix fait par l’utilisateur.
    const textual = (t) => t === 'string' || t === 'date';
    if (textual(next.type) && textual(prev.type)) next.type = prev.type;
    if (next.type === 'array' && prev.type === 'array' && textual(next.item) && textual(prev.item)) next.item = prev.item;
    // Un exemple entier ne dit pas si le champ est entier ou décimal : on garde le choix fait.
    if (next.type === 'integer' && prev.type === 'number') next.type = 'number';
    if (next.type === 'array' && prev.type === 'array' && next.item === 'integer' && prev.item === 'number') next.item = 'number';
    const format = cleanFormat(next, prev.format);
    if (format) next.format = format;
    if (next.children) {
      const sub = Array.isArray(v) ? Object.assign({}, ...v.filter(isPlainObject)) : v;
      next.children = syncFields(prev.children ?? [], sub);
    }
    return next;
  });
}
