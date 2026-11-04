import { bindsOf, isPlainObject, pickItems, tagList } from './lists';
import { coerce } from './types';

/**
 * Définition d'un nœud de transformation :
 * - `inputs` / `outputs` : sockets `{ id, label, type, default?, perItem? }`. Une entrée `perItem`
 *   est réévaluée pour chaque élément de la liste du nœud (comme un « field » Blender) ;
 * - `params` : réglages `{ id, label, default, options?, optionLabel? }` (`optionLabel(option, params)` : texte affiché
 *   pour une option, selon les autres réglages) ;
 * - `list` : le nœud manipule des listes (pas d'application automatique élément par élément) ;
 * - `compute(inputs, params, ctx)` où `ctx.item(inputId, list, index)` évalue une entrée `perItem`,
 *   `ctx.connected(inputId)` dit si elle est reliée et `ctx.current` donne l'élément de l'itération englobante ;
 * - `variadic: { type, min }` (facultatif) : entrées en nombre libre A, B, C… ; il y en a toujours une de libre
 *   après la dernière utilisée (reliée ou saisie), et au moins `min` (voir `inputsOf`) ;
 * - `guarantee(input, params, inputIds)` (facultatif) : ce que le nœud garantit sur sa sortie, `{ required, format }`,
 *   pour le contrôle des champs cibles. `input(id)` donne `{ connected, info, value }` : `info` décrit ce que
 *   garantit l'amont (`{ required, format }`, ou `null` si inconnu), `value` la valeur saisie d'une entrée libre.
 *   Sans `guarantee`, le contrôle fait confiance au nœud.
 */

const out = (type, label = 'Résultat') => [{ id: 'result', label, type }];

// ── Noms des jours (dimanche en premier, comme getUTCDay) et des mois ──
const NAMES = {
  'lundi, mardi…': {
    days: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
    months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  },
  'lun, mar…': {
    days: ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'],
    months: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
  },
  'monday, tuesday…': {
    days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    months: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
  },
  'mon, tue…': {
    days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    months: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
  },
};
const NAME_STYLES = Object.keys(NAMES);
/** Libellé d'un style de noms : des mois si la partie choisie est le mois (« janvier, février… »), sinon des jours. */
const nameStyleLabel = (style, p) => {
  const months = p.part === 'Mois' && NAMES[style]?.months;
  return months ? `${months[0]}, ${months[1]}…` : style;
};

/*
 * `passes` : une sortie « Tout » qui ne fait que transmettre des entrées prend le type réel de ce qui y entre
 * (voir outputType dans graph.js), pour que les contrôles de type voient à travers le nœud.
 * `inputs` : les entrées transmises (`'variadic'` : toutes les entrées en nombre libre) ;
 * `as` : `'same'` (défaut) le type commun, `'item'` l'élément d'une liste, `'list'` une liste de ce type ;
 * `unless` : une entrée qui, reliée, fournit seule la sortie (ex. la Valeur de « Élément n »).
 */

// ── Entrées en nombre libre (A, B, C… puis #27, #28…) ─────

export const variadicId = (i) => (i < 26 ? String.fromCharCode(97 + i) : `i${i + 1}`);
const variadicLabel = (i) => (i < 26 ? String.fromCharCode(65 + i) : `#${i + 1}`);
/** Rang d'une entrée en nombre libre d'après son id (`-1` si l'id n'en est pas une). */
const variadicIndex = (id) => (/^[a-z]$/.test(id) ? id.charCodeAt(0) - 97 : /^i\d+$/.test(id) ? Number(id.slice(1)) - 1 : -1);
const variadicInputs = (type, n) => Array.from({ length: n }, (_, i) => ({ id: variadicId(i), label: variadicLabel(i), type }));

// ── Garanties (contrôle des cibles) ────────────────────────

/** Garanties d'une entrée texte : celles de l'amont, ou la longueur exacte d'une valeur saisie. */
function textInfo(i) {
  if (i.connected) return i.info ?? {};
  const n = Array.from(String(i.value)).length;
  // Une saisie vide ne fournit rien : la valeur n'est pas garantie présente.
  return { required: n > 0, format: { minLength: n, maxLength: n } };
}

/** Plus petite des bornes connues (`undefined` si aucune). */
const minOf = (...xs) => {
  const known = xs.filter((x) => typeof x === 'number' && !Number.isNaN(x));
  return known.length ? Math.min(...known) : undefined;
};

/** Valeur min. / max. d'une entrée nombre : la valeur saisie, ou la borne garantie par l'amont. */
const typed = (i) => Math.max(0, Math.trunc(Number(i.value)) || 0);
const maxNumber = (i) => (i.connected ? i.info?.format?.max : typed(i));
const minNumber = (i) => (i.connected ? i.info?.format?.min : typed(i));

/** Copie de `obj` où le chemin `a.b.c` vaut `value` (les objets intermédiaires sont créés). */
function setPath(obj, path, value) {
  const [key, ...rest] = path.split('.');
  const base = isPlainObject(obj) ? obj : {};
  return { ...base, [key]: rest.length ? setPath(base[key], rest.join('.'), value) : value };
}

/** Copie de `obj` sans le chemin `a.b.c`. */
function removePath(obj, path) {
  if (!isPlainObject(obj)) return obj;
  const [key, ...rest] = path.split('.');
  if (!(key in obj)) return obj;
  if (rest.length) return { ...obj, [key]: removePath(obj[key], rest.join('.')) };
  const { [key]: _, ...others } = obj;
  return others;
}

const capitalize = (s) => s.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());

function looseCompare(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (a !== '' && b !== '' && !isNaN(na) && !isNaN(nb)) return na - nb;
  return String(a ?? '').localeCompare(String(b ?? ''));
}

const pad = (n) => String(n).padStart(2, '0');

const LIST_IN = { id: 'list', label: 'Liste', type: 'any[]' };
const indexes = (list) => list.map((_, i) => i);

export const TRANSFORMS = {
  // ── Entrée ──────────────────────────────────────────────
  const_string: {
    label: 'Texte',
    category: 'Entrée',
    inputs: [],
    outputs: out('string', 'Texte'),
    params: [{ id: 'value', label: 'Valeur', default: '' }],
    compute: (_, p) => ({ result: p.value }),
  },
  const_number: {
    label: 'Nombre',
    category: 'Entrée',
    inputs: [],
    outputs: out('number', 'Nombre'),
    params: [{ id: 'value', label: 'Valeur', default: '0' }],
    compute: (_, p) => ({ result: Number(p.value.replace(',', '.')) }),
  },
  const_bool: {
    label: 'Booléen',
    category: 'Entrée',
    inputs: [],
    outputs: out('boolean', 'Booléen'),
    params: [{ id: 'value', label: 'Valeur', default: 'vrai', options: ['vrai', 'faux'] }],
    compute: (_, p) => ({ result: p.value === 'vrai' }),
  },
  now: {
    label: 'Maintenant',
    category: 'Entrée',
    inputs: [],
    outputs: out('date', 'Date'),
    compute: () => ({ result: new Date() }),
  },

  // ── Structure ───────────────────────────────────────────
  current: {
    label: 'Élément courant',
    category: 'Structure',
    list: true,
    inputs: [],
    outputs: [
      { id: 'item', label: 'Élément', type: 'any' },
      { id: 'index', label: 'Index', type: 'integer' },
    ],
    compute: (_, __, ctx) => ({ item: ctx.current?.item, index: ctx.current?.index ?? 0 }),
  },
  get_field: {
    label: 'Lire un champ',
    category: 'Structure',
    inputs: [{ id: 'obj', label: 'Objet', type: 'object' }],
    outputs: out('any', 'Valeur'),
    params: [{ id: 'path', label: 'Chemin', default: 'id' }],
    compute: ({ obj }, p) => ({
      result: p.path
        .split('.')
        .reduce((v, k) => (isPlainObject(v) ? v[k] : Array.isArray(v) ? v[Number(k)] : undefined), obj),
    }),
  },
  set_field: {
    label: 'Définir un champ',
    category: 'Structure',
    list: true,
    inputs: [
      { id: 'obj', label: 'Objet(s)', type: 'any' },
      { id: 'value', label: 'Valeur', type: 'any', perItem: true },
    ],
    outputs: out('any', 'Objet(s)'),
    params: [{ id: 'path', label: 'Clé', default: 'champ' }],
    // Sur une liste, chaque objet reçoit sa propre valeur (l'élément est alors l'élément courant).
    compute: ({ obj }, p, ctx) => {
      const one = (o, list, i) => setPath(o, p.path, ctx.item('value', list, i));
      if (Array.isArray(obj)) return { result: tagList(obj.map((o, i) => one(o, obj, i)), bindsOf(obj)) };
      return { result: one(obj, [obj], 0) };
    },
  },
  remove_field: {
    label: 'Retirer des champs',
    category: 'Structure',
    list: true,
    inputs: [{ id: 'obj', label: 'Objet(s)', type: 'any' }],
    outputs: out('any', 'Objet(s)'),
    params: [{ id: 'keys', label: 'Clés (a, b.c)', default: 'id' }],
    compute: ({ obj }, p) => {
      const paths = p.keys.split(',').map((k) => k.trim()).filter(Boolean);
      const one = (o) => paths.reduce(removePath, o);
      return { result: Array.isArray(obj) ? tagList(obj.map(one), bindsOf(obj)) : one(obj) };
    },
  },
  list_create: {
    label: 'Créer une liste',
    category: 'Structure',
    list: true,
    // Autant d'entrées que nécessaire : il y en a toujours une libre en bas.
    variadic: { type: 'any', min: 2 },
    inputs: variadicInputs('any', 2),
    outputs: out('any[]', 'Liste'),
    passes: { result: { inputs: 'variadic', as: 'list' } },
    // Dans l'ordre A, B, C… : les entrées reliées et les valeurs saisies ; une entrée vide est ignorée.
    compute: (inputs, _, ctx) => ({
      result: Object.entries(inputs)
        .filter(([id, v]) => ctx.connected(id) || (v !== '' && v != null))
        .flatMap(([, v]) => v),
    }),
  },

  // ── Liste ───────────────────────────────────────────────
  list_filter: {
    label: 'Filtrer',
    category: 'Liste',
    list: true,
    inputs: [LIST_IN, { id: 'cond', label: 'Garder si', type: 'boolean', perItem: true, default: 'true' }],
    outputs: out('any[]', 'Liste'),
    passes: { result: { inputs: ['list'] } },
    compute: ({ list }, _, ctx) => ({ result: pickItems(list, indexes(list).filter((i) => ctx.item('cond', list, i))) }),
  },
  list_sort: {
    label: 'Trier',
    category: 'Liste',
    list: true,
    inputs: [LIST_IN, { id: 'key', label: 'Clé', type: 'any', perItem: true }],
    outputs: out('any[]', 'Liste'),
    passes: { result: { inputs: ['list'] } },
    params: [{ id: 'order', label: 'Ordre', default: 'Croissant', options: ['Croissant', 'Décroissant'] }],
    compute: ({ list }, p, ctx) => {
      const keys = indexes(list).map((i) => (ctx.connected('key') ? ctx.item('key', list, i) : list[i]));
      const dir = p.order === 'Croissant' ? 1 : -1;
      return { result: pickItems(list, indexes(list).sort((a, b) => dir * looseCompare(keys[a], keys[b]))) };
    },
  },
  list_map: {
    label: 'Transformer chaque',
    category: 'Liste',
    list: true,
    inputs: [LIST_IN, { id: 'value', label: 'Valeur', type: 'any', perItem: true }],
    outputs: out('any[]', 'Liste'),
    passes: { result: { inputs: ['value'], as: 'list' } },
    compute: ({ list }, _, ctx) => ({
      result: tagList(
        indexes(list).map((i) => ctx.item('value', list, i)),
        bindsOf(list),
      ),
    }),
  },
  list_at: {
    label: 'Élément n',
    category: 'Liste',
    list: true,
    inputs: [
      LIST_IN,
      { id: 'index', label: 'Index', type: 'integer', default: '0' },
      { id: 'value', label: 'Valeur', type: 'any', perItem: true },
    ],
    outputs: out('any', 'Élément'),
    passes: { result: { inputs: ['list'], as: 'item', unless: 'value' } },
    params: [{ id: 'from', label: 'Depuis', default: 'Début', options: ['Début', 'Fin'] }],
    compute: ({ list, index }, p, ctx) => {
      const i = p.from === 'Fin' ? list.length - 1 - index : index;
      if (i < 0 || i >= list.length) return { result: null };
      return { result: ctx.connected('value') ? ctx.item('value', list, i) : list[i] };
    },
  },
  list_find: {
    label: 'Trouver',
    category: 'Liste',
    list: true,
    inputs: [
      LIST_IN,
      { id: 'cond', label: 'Condition', type: 'boolean', perItem: true, default: 'true' },
      { id: 'value', label: 'Valeur', type: 'any', perItem: true },
    ],
    outputs: [
      { id: 'result', label: 'Élément', type: 'any' },
      { id: 'found', label: 'Trouvé', type: 'boolean' },
    ],
    passes: { result: { inputs: ['list'], as: 'item', unless: 'value' } },
    compute: ({ list }, _, ctx) => {
      const i = indexes(list).find((i) => ctx.item('cond', list, i));
      if (i === undefined) return { result: null, found: false };
      return { result: ctx.connected('value') ? ctx.item('value', list, i) : list[i], found: true };
    },
  },
  list_count: {
    label: 'Compter',
    category: 'Liste',
    list: true,
    inputs: [LIST_IN],
    outputs: out('integer', 'Nombre'),
    compute: ({ list }) => ({ result: list.length }),
  },
  list_aggregate: {
    label: 'Agréger',
    category: 'Liste',
    list: true,
    inputs: [LIST_IN, { id: 'value', label: 'Valeur', type: 'number', perItem: true }],
    outputs: out('number'),
    params: [{ id: 'op', label: 'Opération', default: 'Somme', options: ['Somme', 'Moyenne', 'Minimum', 'Maximum'] }],
    compute: ({ list }, p, ctx) => {
      const nums = indexes(list).map((i) => (ctx.connected('value') ? ctx.item('value', list, i) : coerce(list[i], 'number')));
      if (!nums.length) return { result: 0 };
      const sum = nums.reduce((a, b) => a + b, 0);
      const ops = {
        Somme: sum,
        Moyenne: sum / nums.length,
        Minimum: Math.min(...nums),
        Maximum: Math.max(...nums),
      };
      return { result: ops[p.op] };
    },
  },
  list_test: {
    label: 'Tester les éléments',
    category: 'Liste',
    list: true,
    inputs: [LIST_IN, { id: 'cond', label: 'Condition', type: 'boolean', perItem: true, default: 'true' }],
    outputs: out('boolean'),
    params: [{ id: 'op', label: 'Mode', default: 'Au moins un', options: ['Au moins un', 'Tous', 'Aucun'] }],
    compute: ({ list }, p, ctx) => {
      const ok = indexes(list).map((i) => ctx.item('cond', list, i));
      return { result: p.op === 'Tous' ? ok.every(Boolean) : p.op === 'Aucun' ? !ok.some(Boolean) : ok.some(Boolean) };
    },
  },
  list_slice: {
    label: 'Tranche',
    category: 'Liste',
    list: true,
    inputs: [
      LIST_IN,
      { id: 'start', label: 'Début', type: 'integer', default: '0' },
      { id: 'count', label: 'Nombre', type: 'integer', default: '10' },
    ],
    outputs: out('any[]', 'Liste'),
    passes: { result: { inputs: ['list'] } },
    compute: ({ list, start, count }) => ({ result: pickItems(list, indexes(list).slice(start, start + count)) }),
  },
  list_reverse: {
    label: 'Inverser',
    category: 'Liste',
    list: true,
    inputs: [LIST_IN],
    outputs: out('any[]', 'Liste'),
    passes: { result: { inputs: ['list'] } },
    compute: ({ list }) => ({ result: pickItems(list, indexes(list).reverse()) }),
  },
  list_unique: {
    label: 'Dédoublonner',
    category: 'Liste',
    list: true,
    inputs: [LIST_IN, { id: 'key', label: 'Clé', type: 'any', perItem: true }],
    outputs: out('any[]', 'Liste'),
    passes: { result: { inputs: ['list'] } },
    compute: ({ list }, _, ctx) => {
      const seen = new Set();
      const keep = indexes(list).filter((i) => {
        const k = JSON.stringify(ctx.connected('key') ? ctx.item('key', list, i) : list[i]);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return { result: pickItems(list, keep) };
    },
  },
  list_join: {
    label: 'Joindre en texte',
    category: 'Liste',
    list: true,
    inputs: [{ id: 'list', label: 'Liste', type: 'string[]' }],
    outputs: out('string'),
    params: [{ id: 'sep', label: 'Séparateur', default: ', ' }],
    compute: ({ list }, p) => ({ result: list.join(p.sep) }),
  },

  // ── Texte ───────────────────────────────────────────────
  concat: {
    label: 'Concaténer',
    category: 'Texte',
    variadic: { type: 'string', min: 2 },
    inputs: variadicInputs('string', 2),
    outputs: out('string'),
    params: [{ id: 'sep', label: 'Séparateur', default: ' ' }],
    // Les entrées arrivent dans l'ordre A, B, C… ; les vides sont ignorées (pas de séparateur en double).
    compute: (inputs, p) => ({ result: Object.values(inputs).filter((x) => x !== '').join(p.sep) }),
    guarantee: (input, p, ids) => {
      const parts = ids.map((id) => textInfo(input(id)));
      const lengths = parts.map((t) => t.format?.maxLength);
      const bounded = lengths.every((n) => typeof n === 'number');
      const required = parts.some((t) => t.required) ? true : parts.every((t) => t.required === false) ? false : undefined;
      // Une entrée toujours vide (saisie vide) est ignorée : pas de séparateur pour elle.
      const kept = parts.filter((t) => t.format?.maxLength !== 0).length;
      const seps = Math.max(0, kept - 1) * Array.from(p.sep).length;
      return { required, format: { maxLength: bounded ? lengths.reduce((x, y) => x + y, 0) + seps : undefined } };
    },
  },
  case: {
    label: 'Casse',
    category: 'Texte',
    inputs: [{ id: 'text', label: 'Texte', type: 'string' }],
    outputs: out('string'),
    params: [{ id: 'mode', label: 'Mode', default: 'minuscules', options: ['MAJUSCULES', 'minuscules', 'Capitaliser'] }],
    compute: ({ text }, p) => ({
      result: p.mode === 'MAJUSCULES' ? text.toUpperCase() : p.mode === 'minuscules' ? text.toLowerCase() : capitalize(text),
    }),
    guarantee: (input) => {
      const t = textInfo(input('text'));
      return { required: t.required, format: { minLength: t.format?.minLength, maxLength: t.format?.maxLength } };
    },
  },
  trim: {
    label: 'Nettoyer espaces',
    category: 'Texte',
    inputs: [{ id: 'text', label: 'Texte', type: 'string' }],
    outputs: out('string'),
    compute: ({ text }) => ({ result: text.trim().replace(/\s+/g, ' ') }),
    guarantee: (input) => {
      const t = textInfo(input('text'));
      return { required: t.required, format: { maxLength: t.format?.maxLength } };
    },
  },
  substring: {
    label: 'Extraire (gauche / droite)',
    category: 'Texte',
    inputs: [
      { id: 'text', label: 'Texte', type: 'string' },
      { id: 'count', label: 'Nb car.', type: 'integer', default: '3' },
      { id: 'start', label: 'Début (milieu)', type: 'integer', default: '1' },
    ],
    outputs: out('string'),
    params: [{ id: 'mode', label: 'Mode', default: 'Gauche', options: ['Gauche', 'Droite', 'Milieu'] }],
    // Par caractère (et non par unité UTF-16) : un emoji compte pour un. Début à partir de 1, comme MID.
    compute: ({ text, count, start }, p) => {
      const chars = Array.from(text);
      const n = Math.max(0, Math.trunc(count) || 0);
      if (p.mode === 'Droite') return { result: n ? chars.slice(-n).join('') : '' };
      const from = p.mode === 'Milieu' ? Math.max(0, (Math.trunc(start) || 1) - 1) : 0;
      return { result: chars.slice(from, from + n).join('') };
    },
    guarantee: (input, p) => {
      const t = textInfo(input('text'));
      const count = input('count');
      // En milieu, le début peut tomber après la fin du texte : pas de longueur minimale.
      const minLength = p.mode === 'Milieu' ? undefined : minOf(minNumber(count), t.format?.minLength);
      return { required: t.required, format: { minLength, maxLength: minOf(maxNumber(count), t.format?.maxLength) } };
    },
  },
  replace: {
    label: 'Remplacer',
    category: 'Texte',
    inputs: [{ id: 'text', label: 'Texte', type: 'string' }],
    outputs: out('string'),
    params: [
      { id: 'search', label: 'Chercher', default: '' },
      { id: 'replace', label: 'Par', default: '' },
    ],
    compute: ({ text }, p) => ({ result: p.search ? text.replaceAll(p.search, p.replace) : text }),
  },
  split: {
    label: 'Découper',
    category: 'Texte',
    inputs: [{ id: 'text', label: 'Texte', type: 'string' }],
    outputs: out('string', 'Morceau'),
    params: [
      { id: 'sep', label: 'Séparateur', default: ',' },
      { id: 'index', label: 'Index', default: '0' },
    ],
    compute: ({ text }, p) => ({ result: text.split(p.sep).at(Number(p.index) || 0) ?? '' }),
  },
  split_list: {
    label: 'Découper en liste',
    category: 'Texte',
    inputs: [{ id: 'text', label: 'Texte', type: 'string' }],
    outputs: out('string[]', 'Liste'),
    params: [{ id: 'sep', label: 'Séparateur', default: ',' }],
    compute: ({ text }, p) => ({ result: text === '' ? [] : text.split(p.sep).map((x) => x.trim()) }),
  },
  length: {
    label: 'Longueur',
    category: 'Texte',
    inputs: [{ id: 'text', label: 'Texte', type: 'string' }],
    outputs: out('integer', 'Longueur'),
    compute: ({ text }) => ({ result: text.length }),
    guarantee: (input) => {
      const t = textInfo(input('text'));
      return { required: true, format: { min: t.format?.minLength ?? 0, max: t.format?.maxLength } };
    },
  },

  // ── Math ────────────────────────────────────────────────
  math: {
    label: 'Math',
    category: 'Math',
    inputs: [
      { id: 'a', label: 'A', type: 'number' },
      { id: 'b', label: 'B', type: 'number' },
    ],
    outputs: out('number'),
    params: [
      {
        id: 'op',
        label: 'Opération',
        default: 'Addition',
        options: ['Addition', 'Soustraction', 'Multiplication', 'Division', 'Modulo', 'Puissance', 'Minimum', 'Maximum'],
      },
    ],
    compute: ({ a, b }, p) => {
      const ops = {
        Addition: () => a + b,
        Soustraction: () => a - b,
        Multiplication: () => a * b,
        Division: () => a / b,
        Modulo: () => a % b,
        Puissance: () => a ** b,
        Minimum: () => Math.min(a, b),
        Maximum: () => Math.max(a, b),
      };
      return { result: ops[p.op]() };
    },
  },
  round: {
    label: 'Arrondir',
    category: 'Math',
    inputs: [{ id: 'value', label: 'Valeur', type: 'number' }],
    outputs: out('number'),
    params: [
      { id: 'mode', label: 'Mode', default: 'Arrondi', options: ['Arrondi', 'Plancher', 'Plafond'] },
      { id: 'decimals', label: 'Décimales', default: '0' },
    ],
    compute: ({ value }, p) => {
      const f = 10 ** (Number(p.decimals) || 0);
      const fn = p.mode === 'Plancher' ? Math.floor : p.mode === 'Plafond' ? Math.ceil : Math.round;
      return { result: fn(value * f) / f };
    },
  },

  // ── Logique ─────────────────────────────────────────────
  compare: {
    label: 'Comparer',
    category: 'Logique',
    inputs: [
      { id: 'a', label: 'A', type: 'any' },
      { id: 'b', label: 'B', type: 'any' },
    ],
    outputs: out('boolean'),
    params: [{ id: 'op', label: 'Opérateur', default: '=', options: ['=', '≠', '>', '<', '≥', '≤', 'contient', 'commence par'] }],
    compute: ({ a, b }, p) => {
      const c = () => looseCompare(a, b);
      const ops = {
        '=': () => c() === 0,
        '≠': () => c() !== 0,
        '>': () => c() > 0,
        '<': () => c() < 0,
        '≥': () => c() >= 0,
        '≤': () => c() <= 0,
        contient: () => String(a).includes(String(b)),
        'commence par': () => String(a).startsWith(String(b)),
      };
      return { result: ops[p.op]() };
    },
  },
  logic: {
    label: 'Opération booléenne',
    category: 'Logique',
    inputs: [
      { id: 'a', label: 'A', type: 'boolean' },
      { id: 'b', label: 'B', type: 'boolean' },
    ],
    outputs: out('boolean'),
    params: [{ id: 'op', label: 'Opération', default: 'OU', options: ['ET', 'OU', 'OU exclusif'] }],
    compute: ({ a, b }, p) => ({ result: p.op === 'ET' ? a && b : p.op === 'OU' ? a || b : a !== b }),
  },
  not: {
    label: 'Contraire',
    category: 'Logique',
    inputs: [{ id: 'a', label: 'Booléen', type: 'boolean' }],
    outputs: out('boolean'),
    compute: ({ a }) => ({ result: !a }),
  },
  switch: {
    label: 'Condition (si/sinon)',
    category: 'Logique',
    inputs: [
      { id: 'cond', label: 'Condition', type: 'boolean' },
      { id: 'yes', label: 'Si vrai', type: 'any' },
      { id: 'no', label: 'Si faux', type: 'any' },
    ],
    outputs: out('any'),
    passes: { result: { inputs: ['yes', 'no'] } },
    compute: ({ cond, yes, no }) => ({ result: cond ? yes : no }),
  },
  coalesce: {
    label: 'Valeur par défaut',
    category: 'Logique',
    inputs: [
      { id: 'value', label: 'Valeur', type: 'any' },
      { id: 'fallback', label: 'Défaut', type: 'any' },
    ],
    outputs: out('any'),
    passes: { result: { inputs: ['value', 'fallback'] } },
    compute: ({ value, fallback }) => ({
      result: value == null || value === '' || (value instanceof Date && isNaN(value.getTime())) ? fallback : value,
    }),
  },

  // ── Conversion ──────────────────────────────────────────
  to_string: {
    label: 'En texte',
    category: 'Conversion',
    inputs: [{ id: 'value', label: 'Valeur', type: 'any' }],
    outputs: out('string'),
    compute: ({ value }) => ({ result: value }),
  },
  to_number: {
    label: 'En nombre',
    category: 'Conversion',
    inputs: [{ id: 'value', label: 'Valeur', type: 'any' }],
    outputs: out('number'),
    compute: ({ value }) => ({ result: value }),
  },
  to_integer: {
    label: 'En entier',
    category: 'Conversion',
    inputs: [{ id: 'value', label: 'Valeur', type: 'number' }],
    outputs: out('integer'),
    params: [{ id: 'mode', label: 'Mode', default: 'Tronquer', options: ['Tronquer', 'Arrondi', 'Plancher', 'Plafond'] }],
    compute: ({ value }, p) => {
      const fn = { Tronquer: Math.trunc, Arrondi: Math.round, Plancher: Math.floor, Plafond: Math.ceil }[p.mode] ?? Math.trunc;
      return { result: fn(value) };
    },
  },
  to_bool: {
    label: 'En booléen',
    category: 'Conversion',
    inputs: [{ id: 'value', label: 'Valeur', type: 'any' }],
    outputs: out('boolean'),
    compute: ({ value }) => ({ result: value }),
  },

  // ── Date ────────────────────────────────────────────────
  date_format: {
    label: 'Formater date',
    category: 'Date',
    inputs: [{ id: 'date', label: 'Date', type: 'date' }],
    outputs: out('string'),
    params: [
      {
        id: 'format',
        label: 'Format',
        default: 'JJ/MM/AAAA',
        options: ['ISO 8601', 'AAAA-MM-JJ', 'JJ/MM/AAAA', 'MM/JJ/AAAA', 'Timestamp (ms)'],
      },
    ],
    compute: ({ date }, p) => {
      if (isNaN(date.getTime())) return { result: '' };
      const [y, m, j] = [date.getUTCFullYear(), pad(date.getUTCMonth() + 1), pad(date.getUTCDate())];
      const formats = {
        'ISO 8601': date.toISOString(),
        'AAAA-MM-JJ': `${y}-${m}-${j}`,
        'JJ/MM/AAAA': `${j}/${m}/${y}`,
        'MM/JJ/AAAA': `${m}/${j}/${y}`,
        'Timestamp (ms)': String(date.getTime()),
      };
      return { result: formats[p.format] };
    },
  },
  date_part: {
    label: 'Partie de date',
    category: 'Date',
    inputs: [{ id: 'date', label: 'Date', type: 'date' }],
    outputs: [
      { id: 'result', label: 'Nombre', type: 'integer' },
      { id: 'name', label: 'Nom', type: 'string' },
    ],
    params: [
      { id: 'part', label: 'Partie', default: 'Année', options: ['Année', 'Mois', 'Jour', 'Jour de la semaine'] },
      { id: 'names', label: 'Nom', default: NAME_STYLES[0], options: NAME_STYLES, optionLabel: nameStyleLabel },
    ],
    compute: ({ date }, p) => {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return { result: null, name: null };
      const parts = {
        Année: date.getUTCFullYear(),
        Mois: date.getUTCMonth() + 1,
        Jour: date.getUTCDate(),
        'Jour de la semaine': date.getUTCDay(),
      };
      const n = parts[p.part];
      // Nom du jour de la semaine ou du mois ; pour l'année et le jour du mois, le nombre en texte.
      const names = NAMES[p.names] ?? NAMES[NAME_STYLES[0]];
      const name = p.part === 'Jour de la semaine' ? names.days[n] : p.part === 'Mois' ? names.months[n - 1] : String(n);
      return { result: n, name };
    },
  },
  age: {
    label: 'Âge (années)',
    category: 'Date',
    inputs: [
      { id: 'date', label: 'Date', type: 'date' },
      { id: 'ref', label: 'Référence', type: 'date' },
    ],
    outputs: out('integer', 'Années'),
    compute: ({ date, ref }) => {
      const r = isNaN(ref.getTime()) ? new Date() : ref;
      let years = r.getUTCFullYear() - date.getUTCFullYear();
      if (r.getUTCMonth() < date.getUTCMonth() || (r.getUTCMonth() === date.getUTCMonth() && r.getUTCDate() < date.getUTCDate())) years--;
      return { result: years };
    },
  },
};

export const CATEGORIES = ['Entrée', 'Structure', 'Liste', 'Texte', 'Math', 'Logique', 'Conversion', 'Date'];

/**
 * Entrées d'un nœud. Pour un nœud à entrées en nombre libre : jusqu'à la dernière utilisée (reliée — `connected`
 * liste les ids des entrées reliées — ou saisie), plus une libre, et au moins `min`.
 */
export function inputsOf(def, node, connected = []) {
  if (!def?.variadic) return def?.inputs ?? [];
  const filled = Object.entries(node?.data?.values ?? {}).filter(([, v]) => v !== '' && v != null).map(([k]) => k);
  const last = Math.max(-1, ...[...connected, ...filled].map(variadicIndex));
  return variadicInputs(def.variadic.type, Math.max(def.variadic.min, last + 2));
}

/** Socket d'entrée `id` d'un nœud (y compris une entrée en nombre libre au-delà de celles affichées). */
export function inputSocket(def, id) {
  if (def?.variadic) {
    const i = variadicIndex(id);
    return i < 0 ? undefined : { id, label: variadicLabel(i), type: def.variadic.type };
  }
  return def?.inputs.find((s) => s.id === id);
}

export function paramsWithDefaults(def, params) {
  const result = {};
  for (const p of def.params ?? []) result[p.id] = params[p.id] ?? p.default;
  return result;
}
