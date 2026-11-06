import { bilingual, t } from './i18n';

/**
 * Règles d'un champ : `required` (booléen) et `format`, dont les clés dépendent du type
 * (pour un tableau de scalaires, elles portent sur chaque élément, plus le nombre d'éléments).
 */
const FORMAT_KEYS = {
  string: [
    { key: 'minLength', label: 'Longueur min.', en: 'Min. length', kind: 'int' },
    { key: 'maxLength', label: 'Longueur max.', en: 'Max. length', kind: 'int' },
    { key: 'pattern', label: 'Expression régulière', en: 'Regular expression', kind: 'text' },
  ],
  number: [
    { key: 'min', label: 'Minimum', en: 'Minimum', kind: 'number' },
    { key: 'max', label: 'Maximum', en: 'Maximum', kind: 'number' },
  ],
  integer: [
    { key: 'min', label: 'Minimum', en: 'Minimum', kind: 'integer' },
    { key: 'max', label: 'Maximum', en: 'Maximum', kind: 'integer' },
  ],
  date: [
    { key: 'minDate', label: 'Au plus tôt', en: 'Earliest', kind: 'date' },
    { key: 'maxDate', label: 'Au plus tard', en: 'Latest', kind: 'date' },
  ],
  array: [
    { key: 'minItems', label: 'Éléments min.', en: 'Min. items', kind: 'int' },
    { key: 'maxItems', label: 'Éléments max.', en: 'Max. items', kind: 'int' },
  ],
};
for (const k of Object.values(FORMAT_KEYS).flat()) bilingual(k, 'label', k.en);

/** Clés de format applicables à un champ. */
export function formatKeys(f) {
  if (f.type !== 'array') return FORMAT_KEYS[f.type] ?? [];
  return [...FORMAT_KEYS.array, ...(FORMAT_KEYS[f.item] ?? [])];
}

export const isSet = (v) => v !== undefined && v !== null && v !== '' && v !== false;

/** Ne garde du format que les clés valables pour le type du champ (après un changement de type). */
export function cleanFormat(f, format = f.format) {
  const keys = new Set(formatKeys(f).map((k) => k.key));
  const kept = Object.fromEntries(Object.entries(format ?? {}).filter(([k, v]) => keys.has(k) && isSet(v)));
  return Object.keys(kept).length ? kept : undefined;
}

/** Résumé court du format (`≤ 50 car.`, `0 … 100`, `entier`…). */
export function formatSummary(f) {
  const x = f.format ?? {};
  const parts = [];
  const range = (min, max, unit = '') => {
    if (isSet(min) && isSet(max)) parts.push(`${min}…${max}${unit}`);
    else if (isSet(min)) parts.push(`≥ ${min}${unit}`);
    else if (isSet(max)) parts.push(`≤ ${max}${unit}`);
  };
  range(x.minItems, x.maxItems, t(' élt', ' items'));
  range(x.minLength, x.maxLength, t(' car.', ' chars'));
  range(x.min, x.max);
  range(x.minDate, x.maxDate);
  if (isSet(x.pattern)) parts.push(`/${x.pattern}/`);
  return parts.join(', ');
}
