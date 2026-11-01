import { isSet } from './formats';
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
    for (const key of Object.keys(obj)) if (!known.has(key)) add('warning', ownerId, join(path, key), 'Champ en trop (absent du modèle)');
    for (const f of fields) checkField(f, obj[f.name], join(path, f.name));
  }

  function checkField(f, v, path) {
    if (missing(v)) {
      if (f.required) add('error', f.id, path, 'Obligatoire mais absent');
      return;
    }
    if (f.type === 'object') {
      if (!isPlainObject(v)) return add('error', f.id, path, 'Objet attendu', v);
      return checkObject(f.children ?? [], v, path, f.id);
    }
    if (f.type === 'array') {
      if (!Array.isArray(v)) return add('error', f.id, path, 'Liste attendue', v);
      const x = f.format ?? {};
      if (isSet(x.minItems) && v.length < x.minItems) add('error', f.id, path, `Au moins ${x.minItems} élément(s) attendu(s)`, v.length);
      if (isSet(x.maxItems) && v.length > x.maxItems) add('error', f.id, path, `Au plus ${x.maxItems} élément(s) attendu(s)`, v.length);
      for (const item of v) {
        if (f.item === 'object') {
          if (!isPlainObject(item)) add('error', f.id, `${path}[]`, 'Objet attendu', item);
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
        if (typeof v !== 'string') return err('Texte attendu');
        const n = Array.from(v).length;
        if (isSet(x.minLength) && n < x.minLength) err(`Moins de ${x.minLength} caractères`);
        if (isSet(x.maxLength) && n > x.maxLength) err(`Plus de ${x.maxLength} caractères`);
        if (isSet(x.pattern)) {
          let re;
          try {
            re = new RegExp(x.pattern);
          } catch {
            return err(`Expression régulière du modèle invalide : /${x.pattern}/`);
          }
          if (!re.test(v)) err(`Ne respecte pas /${x.pattern}/`);
        }
        return;
      }
      case 'number':
      case 'integer':
        if (typeof v !== 'number' || Number.isNaN(v)) return err(type === 'integer' ? 'Entier attendu' : 'Nombre attendu');
        if (type === 'integer' && !Number.isInteger(v)) return err('Entier attendu');
        if (isSet(x.min) && v < x.min) err(`Inférieur à ${x.min}`);
        if (isSet(x.max) && v > x.max) err(`Supérieur à ${x.max}`);
        return;
      case 'boolean':
        if (typeof v !== 'boolean') err('Booléen attendu (true / false)');
        return;
      case 'date': {
        const d = v instanceof Date ? v : typeof v === 'string' || typeof v === 'number' ? new Date(v) : null;
        if (!d || Number.isNaN(d.getTime())) return err('Date attendue (ex. 2026-01-31)');
        if (isSet(x.minDate) && d < new Date(x.minDate)) err(`Antérieure au ${x.minDate}`);
        if (isSet(x.maxDate) && d > new Date(x.maxDate)) err(`Postérieure au ${x.maxDate}`);
        return;
      }
    }
  }

  if (isPlainObject(doc)) checkObject(fields, doc, '', null);
  else add('error', null, '', 'Le document doit être un objet JSON');
  return [...found.values()];
}

/** Texte d'un problème de conformité : message, nombre d'occurrences et exemple de valeur fautive. */
export function describeProblem(p) {
  const times = p.count > 1 ? ` (${p.count} fois)` : '';
  const example = p.example === undefined ? '' : ` — ex. : ${JSON.stringify(p.example)?.slice(0, 60)}`;
  return `${p.message}${times}${example}`;
}
