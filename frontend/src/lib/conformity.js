import { isSet } from './formats';
import { t } from './i18n';
import { isPlainObject } from './lists';

/**
 * Conformité d'un document JSON (fichier de données d'une source, résultat d'une cible) à un modèle de champs.
 * Renvoie des problèmes `{ level, fieldId, path, message, count, example }` regroupés par champ et par message
 * (une même erreur sur 300 éléments d'un tableau n'est listée qu'une fois, avec son nombre) :
 * - erreur : champ obligatoire absent, type ou format non respecté ;
 * - avertissement : champ en trop, absent du modèle (\`fieldId\` : celui de l'objet qui le contient, ou nul à la racine).
 * Un champ vaut absent s'il manque, s'il est \`null\` ou si c'est un texte vide. Le document n'est pas modifié.
 */
export function checkDocument(fields, doc) {
  const found = new Map();
  const add = (level, fieldId, path, message, example) => {
    const key = `${level}|${path}|${message}`;
    const hit = found.get(key);
    if (hit) hit.count++;
    else found.set(key, { level, fieldId, path, message, count: 1, example });
  };

  const missing = (v) => v === undefined || v === null || v === '';
  const join = (path, name) => (path ? `${path}.${name}` : name);

  function checkObject(fields, obj, path, ownerId) {
    const known = new Set(fields.map((f) => f.name));
    for (const key of Object.keys(obj)) if (!known.has(key)) add('warning', ownerId, join(path, key), t('Champ en trop (absent du modèle)', 'Extra field (not in the model)'));
    for (const f of fields) checkField(f, obj[f.name], join(path, f.name));
  }

  function checkField(f, v, path) {
    if (missing(v)) {
      if (f.required) add('error', f.id, path, t('Obligatoire mais absent', 'Required but missing'));
      return;
    }
    if (f.type === 'object') {
      if (!isPlainObject(v)) return add('error', f.id, path, t('Objet attendu', 'Object expected'), v);
      return checkObject(f.children ?? [], v, path, f.id);
    }
    if (f.type === 'array') {
      if (!Array.isArray(v)) return add('error', f.id, path, t('Liste attendue', 'List expected'), v);
      const x = f.format ?? {};
      if (isSet(x.minItems) && v.length < x.minItems) add('error', f.id, path, t(`Au moins ${x.minItems} élément(s) attendu(s)`, `At least ${x.minItems} item(s) expected`), v.length);
      if (isSet(x.maxItems) && v.length > x.maxItems) add('error', f.id, path, t(`Au plus ${x.maxItems} élément(s) attendu(s)`, `At most ${x.maxItems} item(s) expected`), v.length);
      for (const item of v) {
        if (f.item === 'object') {
          if (!isPlainObject(item)) add('error', f.id, `${path}[]`, t('Objet attendu', 'Object expected'), item);
          else checkObject(f.children ?? [], item, `${path}[]`, f.id);
        } else if (!missing(item)) {
          checkValue(f, f.item ?? 'string', item, `${path}[]`);
        }
      }
      return;
    }
    checkValue(f, f.type, v, path);
  }

  /** Type et format d'une valeur simple. */
  function checkValue(f, type, v, path) {
    const x = f.format ?? {};
    const err = (message) => add('error', f.id, path, message, v);
    switch (type) {
      case 'string': {
        if (typeof v !== 'string') return err(t('Texte attendu', 'Text expected'));
        const n = Array.from(v).length;
        if (isSet(x.minLength) && n < x.minLength) err(t(`Moins de ${x.minLength} caractères`, `Fewer than ${x.minLength} characters`));
        if (isSet(x.maxLength) && n > x.maxLength) err(t(`Plus de ${x.maxLength} caractères`, `More than ${x.maxLength} characters`));
        if (isSet(x.pattern)) {
          let re;
          try {
            re = new RegExp(x.pattern);
          } catch {
            return err(t(`Expression régulière du modèle invalide : /${x.pattern}/`, `Invalid regular expression in the model: /${x.pattern}/`));
          }
          if (!re.test(v)) err(t(`Ne respecte pas /${x.pattern}/`, `Does not match /${x.pattern}/`));
        }
        return;
      }
      case 'number':
      case 'integer':
        if (typeof v !== 'number' || Number.isNaN(v)) return err(type === 'integer' ? t('Entier attendu', 'Integer expected') : t('Nombre attendu', 'Number expected'));
        if (type === 'integer' && !Number.isInteger(v)) return err(t('Entier attendu', 'Integer expected'));
        if (isSet(x.min) && v < x.min) err(t(`Inférieur à ${x.min}`, `Less than ${x.min}`));
        if (isSet(x.max) && v > x.max) err(t(`Supérieur à ${x.max}`, `Greater than ${x.max}`));
        return;
      case 'boolean':
        if (typeof v !== 'boolean') err(t('Booléen attendu (true / false)', 'Boolean expected (true / false)'));
        return;
      case 'date': {
        const d = v instanceof Date ? v : typeof v === 'string' || typeof v === 'number' ? new Date(v) : null;
        if (!d || Number.isNaN(d.getTime())) return err(t('Date attendue (ex. 2026-01-31)', 'Date expected (e.g. 2026-01-31)'));
        if (isSet(x.minDate) && d < new Date(x.minDate)) err(t(`Antérieure au ${x.minDate}`, `Before ${x.minDate}`));
        if (isSet(x.maxDate) && d > new Date(x.maxDate)) err(t(`Postérieure au ${x.maxDate}`, `After ${x.maxDate}`));
        return;
      }
    }
  }

  if (isPlainObject(doc)) checkObject(fields, doc, '', null);
  else add('error', null, '', t('Le document doit être un objet JSON', 'The document must be a JSON object'));
  return [...found.values()];
}

/** Texte d'un problème de conformité : message, nombre d'occurrences et exemple de valeur fautive. */
export function describeProblem(p) {
  const times = p.count > 1 ? t(` (${p.count} fois)`, ` (${p.count} times)`) : '';
  const example = p.example === undefined ? '' : ` — ${t('ex. :', 'e.g.')} ${JSON.stringify(p.example)?.slice(0, 60)}`;
  return `${p.message}${times}${example}`;
}
