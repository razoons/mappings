import { ref } from 'vue';

/**
 * Langue de l'interface : français ou anglais. Les textes sont écrits en paires, `t('Ouvrir', 'Open')`, là où ils
 * servent. `lang` est réactif : un texte lu dans un gabarit ou un `computed` suit le changement de langue.
 * Les valeurs enregistrées dans les schémas (options des réglages, catégories) restent en français : seul leur
 * affichage est traduit.
 */
const KEY = 'mapping-lang';
const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
const browser = typeof navigator !== 'undefined' ? navigator.language : 'fr';

export const lang = ref(stored ?? (browser?.toLowerCase().startsWith('fr') ? 'fr' : 'en'));

export function setLang(l) {
  lang.value = l;
  localStorage.setItem(KEY, l);
  document.documentElement.lang = l;
}
if (typeof document !== 'undefined') document.documentElement.lang = lang.value;

/** Texte dans la langue courante. */
export const t = (fr, en) => (lang.value === 'en' ? en : fr);

/** `n` suivi du mot au singulier ou au pluriel : `count(3, 'nœud', 'node')` → « 3 nœuds » / « 3 nodes ». */
export const count = (n, fr, en, frPlural = `${fr}s`, enPlural = `${en}s`) => `${n} ${n > 1 ? t(frPlural, enPlural) : t(fr, en)}`;

/** Remplace `obj[key]` (texte français) par un accesseur qui rend `en` quand l'interface est en anglais. */
export function bilingual(obj, key, en) {
  // Déjà traduit (objet partagé entre plusieurs définitions) : on garde la première traduction.
  if (Object.getOwnPropertyDescriptor(obj, key)?.get) return;
  const fr = obj[key];
  if (en === undefined || fr === undefined) return;
  Object.defineProperty(obj, key, { get: () => t(fr, en), enumerable: true, configurable: true });
}

/** Locale des nombres et des dates. */
export const numberLocale = () => (lang.value === 'en' ? 'en-US' : 'fr-FR');
