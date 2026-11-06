import { Document, parse, YAMLMap } from 'yaml';
import { checkDocument, describeProblem } from './conformity';
import { exampleOf, isContainer } from './fields';
import { cleanFormat, formatKeys } from './formats';
import { lang, t } from './i18n';
import { isPlainObject } from './lists';
import { uid } from './types';

/**
 * Modèle de données en YAML : un champ par clé, décrit par son type, `required`, son format et son exemple.
 *
 *   client:
 *     type: object
 *     required: true
 *     fields:
 *       nom: { type: string, required: true, maxLength: 60, example: Ada Lovelace }
 *       age: integer                      # forme courte : le type seul
 *   commandes:
 *     type: array
 *     items: object                       # éléments : string, number, integer, boolean, date ou object
 *     minItems: 1
 *     fields:
 *       ref: { type: string, required: true, pattern: '^C-\d+$', example: C-42 }
 *
 * `example` donne une valeur d'exemple ; pour une source, ce sont les données du calcul tant qu'aucun fichier
 * n'est chargé. Une liste d'objets peut recevoir la liste complète (plusieurs éléments) dans son `example`.
 *
 * Le YAML est écrit avec les mots-clés de la langue de l'interface (en français : `obligatoire`, `champs`,
 * `texte`…) ; à la lecture, les deux vocabulaires sont acceptés.
 */

const TYPES = ['string', 'number', 'integer', 'boolean', 'date', 'object', 'array'];
const ITEM_TYPES = TYPES.filter((t) => t !== 'array');

// ── Vocabulaire français ───────────────────────────────────

/** Mots-clés français du YAML (les clés de format comprises). */
const KEYS_FR = {
  type: 'type',
  required: 'obligatoire',
  example: 'exemple',
  fields: 'champs',
  items: 'éléments',
  minLength: 'longueurMin',
  maxLength: 'longueurMax',
  pattern: 'motif',
  min: 'min',
  max: 'max',
  minDate: 'dateMin',
  maxDate: 'dateMax',
  minItems: 'élémentsMin',
  maxItems: 'élémentsMax',
};
const TYPES_FR = { string: 'texte', number: 'nombre', integer: 'entier', boolean: 'booléen', date: 'date', object: 'objet', array: 'liste' };

const plain = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Saisie : le mot français, avec ou sans accents ni majuscules, donne le mot anglais.
const KEY_OF = Object.fromEntries(Object.entries(KEYS_FR).map(([en, fr]) => [plain(fr), en]));
const ALIASES = Object.fromEntries(Object.entries(TYPES_FR).map(([en, fr]) => [plain(fr), en]));
const YES = { oui: true, vrai: true, non: false, faux: false };

/** Mot-clé et nom de type dans la langue de l'interface. */
const word = (key) => (lang.value === 'fr' ? (KEYS_FR[key] ?? key) : key);
const typeWord = (type) => (lang.value === 'fr' ? (TYPES_FR[type] ?? type) : type);

/** Remet en anglais les mots-clés d'une description de champ (et de ses sous-champs) ; les exemples sont gardés tels quels. */
function normalizeSpec(spec) {
  if (!isPlainObject(spec)) return spec;
  const out = {};
  for (const [k, v] of Object.entries(spec)) out[KEY_OF[plain(k)] ?? k] = v;
  if (typeof out.required === 'string' && plain(out.required) in YES) out.required = YES[plain(out.required)];
  if (isPlainObject(out.fields)) out.fields = normalizeFields(out.fields);
  return out;
}
const normalizeFields = (obj) => Object.fromEntries(Object.entries(obj).map(([name, spec]) => [name, normalizeSpec(spec)]));

/** Aide en commentaire en tête de l'éditeur YAML. */
export const yamlHelp = () =>
  t(
    `# Modèle de données : un champ par clé.
#   type        : texte, nombre, entier, booléen, date, objet, liste (forme courte : « nom: texte »)
#   obligatoire : oui pour un champ obligatoire
#   format      : longueurMin, longueurMax, motif (texte) ; min, max (nombre, entier) ;
#                 dateMin, dateMax (date, ex. 2026-01-31) ; élémentsMin, élémentsMax (liste)
#   exemple     : valeur d'exemple (données du calcul d'une source sans fichier) ; une liste d'objets
#                 peut recevoir la liste complète, ex. plusieurs commandes
#   objet       : ses sous-champs dans « champs »
#   liste       : le type des éléments dans « éléments » (et « champs » pour une liste d'objets)
# Les mots-clés anglais (required, fields, string…) sont aussi acceptés.
`,
    `# Data model: one field per key.
#   type     : string, number, integer, boolean, date, object, array (short form: “name: string”)
#   required : true for a required field
#   format   : minLength, maxLength, pattern (text); min, max (number, integer);
#              minDate, maxDate (date, e.g. 2026-01-31); minItems, maxItems (list)
#   example  : example value (data used by a source without a file); a list of objects
#              can receive the full list, e.g. several orders
#   object   : its sub-fields in “fields”
#   array    : the item type in “items” (and “fields” for a list of objects)
`,
  );

// ── Champs → YAML ──────────────────────────────────────────

/** Description YAML d'un champ ; `value` : sa valeur dans le document d'exemple (`undefined` s'il n'y en a pas). */
function describe(f, value) {
  const node = { [word('type')]: typeWord(f.type) };
  if (f.type === 'array') node[word('items')] = typeWord(f.item ?? 'string');
  if (f.required) node[word('required')] = lang.value === 'fr' ? 'oui' : true;
  for (const [k, v] of Object.entries(f.format ?? {})) node[word(k)] = v;
  if (f.type === 'object') {
    node[word('fields')] = toPlain(f.children ?? [], isPlainObject(value) ? value : undefined);
  } else if (f.type === 'array' && f.item === 'object') {
    // Plusieurs éléments : la liste complète en exemple ; sinon, l'exemple de chaque sous-champ.
    const list = Array.isArray(value) ? value : undefined;
    node[word('fields')] = toPlain(f.children ?? [], list?.length === 1 && isPlainObject(list[0]) ? list[0] : undefined);
    if (list && list.length > 1) node[word('example')] = list;
  } else if (value !== undefined && value !== null) {
    node[word('example')] = value;
  }
  // Forme courte quand le type suffit.
  return Object.keys(node).length === 1 ? typeWord(f.type) : node;
}

const toPlain = (fields, doc) => Object.fromEntries(fields.map((f) => [f.name, describe(f, doc?.[f.name])]));

/**
 * YAML du modèle ; `doc` : document d'exemple dont les valeurs deviennent les `example` des champs.
 * Un champ sans sous-champs s'écrit sur une ligne (`{ type: string, required: true, example: Ada }`).
 */
export function fieldsToYaml(fields, doc) {
  if (!fields.length) return `${yamlHelp()}\n{}\n`;
  const yaml = new Document(toPlain(fields, isPlainObject(doc) ? doc : undefined));
  const flowLeaves = (map) => {
    for (const pair of map.items) {
      if (!(pair.value instanceof YAMLMap)) continue;
      const sub = pair.value.get(word('fields'), true);
      if (sub instanceof YAMLMap) flowLeaves(sub);
      else pair.value.flow = true;
    }
  };
  flowLeaves(yaml.contents);
  return `${yamlHelp()}\n${yaml.toString({ lineWidth: 0 })}`;
}

// ── YAML → champs ──────────────────────────────────────────

const typeName = (v) => (typeof v === 'string' ? (ALIASES[plain(v)] ?? v.toLowerCase()) : v);

/**
 * Lit le modèle YAML : `{ fields, sample, hasExamples }`. Les champs retrouvés par leur nom (au même niveau)
 * gardent leur id, donc leurs liens, et leur état replié. `sample` est le document d'exemple tiré des `example` ;
 * un champ qui n'en a pas reçoit une valeur type si `defaults` (les données de calcul d'une source doivent être
 * complètes), sinon il est omis (cible : seuls les exemples donnés sont gardés). Lève une erreur explicite (avec le chemin du champ) si le modèle
 * est invalide ou si un exemple ne respecte pas le type ou le format de son champ.
 */
export function yamlToFields(text, oldFields = [], { defaults = true } = {}) {
  let root;
  try {
    root = parse(text) ?? {};
  } catch (e) {
    throw new Error(`${t('YAML invalide', 'Invalid YAML')} : ${e.message.split('\n')[0]}`);
  }
  if (!isPlainObject(root)) throw new Error(t('Le modèle doit être une liste de champs « nom: description ».', 'The model must be a list of fields “name: description”.'));
  root = normalizeFields(root);
  const fields = readFields(root, oldFields, '');
  const explicit = new Set();
  const full = buildSample(root, fields, explicit);
  const wrong = checkDocument(fields, full).find((p) => p.level === 'error' && explicit.has(p.fieldId));
  if (wrong) throw new Error(`${t('Exemple non conforme', 'Invalid example')} — ${wrong.path} : ${describeProblem(wrong)}`);
  const sample = defaults ? full : buildSample(root, fields, new Set(), false);
  return { fields, sample, hasExamples: explicit.size > 0 };
}

/**
 * Document d'exemple tiré des `example` ; `explicit` reçoit les ids des champs qui en ont un. Sans `defaults`,
 * un champ sans exemple (et un objet vide) est omis au lieu de recevoir une valeur type.
 */
function buildSample(specs, fields, explicit, defaults = true) {
  const doc = {};
  for (const f of fields) {
    const raw = specs?.[f.name];
    const spec = isPlainObject(raw) ? raw : {};
    const given = spec.example !== undefined && spec.example !== null;
    // Une liste d'objets donnée en entier vaut exemple pour tous ses sous-champs.
    const markAll = (x) => {
      explicit.add(x.id);
      (x.children ?? []).forEach(markAll);
    };
    if (f.type === 'object') {
      const sub = buildSample(spec.fields, f.children ?? [], explicit, defaults);
      if (defaults || Object.keys(sub).length) doc[f.name] = sub;
    } else if (f.type === 'array' && f.item === 'object') {
      if (given) markAll(f);
      const item = given ? null : buildSample(spec.fields, f.children ?? [], explicit, defaults);
      if (given) doc[f.name] = [spec.example].flat();
      else if (defaults || Object.keys(item).length) doc[f.name] = [item];
    } else if (given) {
      explicit.add(f.id);
      doc[f.name] = f.type === 'array' ? [spec.example].flat() : spec.example;
    } else if (defaults) {
      doc[f.name] = exampleOf(f);
    }
  }
  return doc;
}

function readFields(obj, olds, path) {
  return Object.entries(obj).map(([name, spec]) => readField(name, spec, olds.find((f) => f.name === name), path ? `${path}.${name}` : name));
}

function readField(name, raw, old, path) {
  const fail = (message) => {
    throw new Error(`${path} : ${message}`);
  };
  const spec = typeof raw === 'string' ? { type: raw } : raw;
  if (!isPlainObject(spec)) fail(t('attendu un type (ex. « texte ») ou une description { type: …, obligatoire: … }', 'expected a type (e.g. “string”) or a description { type: …, required: … }'));

  const type = typeName(spec.type ?? (spec.fields ? 'object' : undefined));
  if (!TYPES.includes(type)) fail(t(`type « ${spec.type ?? '(absent)'} » inconnu (types : ${TYPES.map(typeWord).join(', ')})`, `unknown type “${spec.type ?? '(missing)'}” (types: ${TYPES.join(', ')})`));
  const field = { id: old?.id ?? uid('f'), name, type };
  if (old?.collapsed) field.collapsed = true;
  if (type === 'array') {
    const item = typeName(spec.items ?? 'string');
    if (!ITEM_TYPES.includes(item)) fail(t(`éléments « ${spec.items} » inconnu (types : ${ITEM_TYPES.map(typeWord).join(', ')})`, `unknown items “${spec.items}” (types: ${ITEM_TYPES.join(', ')})`));
    field.item = item;
  }

  const allowed = new Set(['type', 'required', ...formatKeys(field).map((k) => k.key)]);
  if (field.type === 'array') allowed.add('items');
  if (isContainer(field)) allowed.add('fields');
  // Un objet n'a pas d'exemple propre : ce sont ceux de ses sous-champs.
  if (field.type !== 'object') allowed.add('example');
  for (const key of Object.keys(spec)) {
    if (!allowed.has(key)) fail(t(`clé « ${word(key)} » non prévue pour ce type (clés possibles : ${[...allowed].map(word).join(', ')})`, `key “${key}” not allowed for this type (possible keys: ${[...allowed].join(', ')})`));
  }

  if (spec.required !== undefined && typeof spec.required !== 'boolean') fail(t('obligatoire vaut oui ou non', 'required must be true or false'));
  if (spec.required) field.required = true;

  const format = {};
  for (const k of formatKeys(field)) {
    const v = spec[k.key];
    if (v === undefined || v === null) continue;
    if (k.kind === 'text') {
      if (typeof v !== 'string') fail(t(`${word(k.key)} doit être un texte`, `${k.key} must be a text`));
      try {
        new RegExp(v);
      } catch {
        fail(t(`${word(k.key)} : expression régulière invalide`, `${k.key}: invalid regular expression`));
      }
    } else if (k.kind === 'date') {
      if (typeof v !== 'string' || Number.isNaN(new Date(v).getTime())) fail(t(`${word(k.key)} doit être une date (ex. 2026-01-31)`, `${k.key} must be a date (e.g. 2026-01-31)`));
    } else if (typeof v !== 'number' || (k.kind !== 'number' && !Number.isInteger(v)) || (k.kind === 'int' && v < 0)) {
      fail(
        t(
          `${word(k.key)} doit être un ${k.kind === 'number' ? 'nombre' : k.kind === 'int' ? 'entier positif' : 'entier'}`,
          `${k.key} must be ${k.kind === 'number' ? 'a number' : k.kind === 'int' ? 'a positive integer' : 'an integer'}`,
        ),
      );
    }
    format[k.key] = v;
  }
  const cleaned = cleanFormat(field, format);
  if (cleaned) field.format = cleaned;

  if (isContainer(field)) {
    if (spec.fields !== undefined && spec.fields !== null && !isPlainObject(spec.fields)) fail(t('champs doit lister les sous-champs « nom: description »', 'fields must list the sub-fields “name: description”'));
    const oldChildren = old && isContainer(old) ? old.children ?? [] : [];
    field.children = readFields(spec.fields ?? {}, oldChildren, field.type === 'array' ? `${path}[]` : path);
  }
  return field;
}
