/**
 * Exemples concrets des nœuds, dessinés sur la page « Nœuds » sous forme de nœud (voir NodePreview.vue). Le
 * résultat n'est pas écrit ici : il est calculé par le nœud lui-même.
 * - `inputs` : valeurs des entrées. Un texte ou un nombre est saisi dans le nœud ; une liste ou un objet arrive par
 *   un lien ;
 * - `each` : entrées « pour chaque élément » (∀) reliées, `[libellé affiché, (élément) => valeur]` (libellé : texte,
 *   ou paire `[français, anglais]`) ;
 * - `current` : élément en cours de parcours (`{ item, index }`), pour « Élément courant » ;
 * - `params` : réglages.
 */
export const NODE_PREVIEWS = {
  // ── Entrée ──────────────────────────────────────────────
  const_string: { params: { value: 'FR' } },
  const_number: { params: { value: '19,6' } },
  const_bool: { params: { value: 'vrai' } },
  now: {},

  // ── Structure ───────────────────────────────────────────
  current: { current: { item: { sku: 'B-12', qty: 3 }, index: 2 } },
  get_field: { inputs: { obj: { client: 'Ada', lignes: [{ sku: 'A-1' }, { sku: 'B-12' }] } }, params: { path: 'lignes[1].sku' } },
  set_field: { inputs: { obj: { id: 1, nom: 'Ada' } }, each: { value: ['"FR"', () => 'FR'] }, params: { path: 'pays' } },
  remove_field: { inputs: { obj: { id: 1, nom: 'Ada', interne: 'x' } }, params: { keys: 'interne' } },
  list_create: { inputs: { a: 'x', b: ['y', 'z'] } },

  // ── Liste ───────────────────────────────────────────────
  list_filter: { inputs: { list: [1, 5, 8, 3] }, each: { cond: [['élément > 4', 'item > 4'], (x) => x > 4] } },
  list_sort: { inputs: { list: ['Zoé', 'Ada', 'Léo'] } },
  list_map: {
    inputs: { list: [{ qty: 2, price: 5 }, { qty: 1, price: 3 }] },
    each: { value: ['qty × price', (x) => x.qty * x.price] },
  },
  list_at: { inputs: { list: ['a', 'b', 'c'], index: '0' }, params: { from: 'Fin' } },
  list_find: {
    inputs: { list: [{ email: 'paul@mail.fr', nom: 'Paul' }, { email: 'ada@mail.fr', nom: 'Ada' }] },
    each: { cond: [['email = « ada@mail.fr »', 'email = “ada@mail.fr”'], (x) => x.email === 'ada@mail.fr'], value: [['nom', 'name'], (x) => x.nom] },
  },
  list_count: { inputs: { list: ['a', 'b', 'c'] } },
  list_aggregate: { inputs: { list: [2, 4, 9] }, params: { op: 'Moyenne' } },
  list_test: { inputs: { list: [12, 30, 7] }, each: { cond: [['élément ≥ 10', 'item ≥ 10'], (x) => x >= 10] }, params: { op: 'Tous' } },
  list_slice: { inputs: { list: ['a', 'b', 'c', 'd'], start: '1', count: '2' } },
  list_reverse: { inputs: { list: [1, 2, 3] } },
  list_unique: { inputs: { list: ['a', 'b', 'a', 'c'] } },
  list_join: { inputs: { list: ['vip', 'newsletter'] }, params: { sep: ', ' } },

  // ── Texte ───────────────────────────────────────────────
  concat: { inputs: { a: 'Ada', b: 'Lovelace' } },
  case: { inputs: { text: 'jean-luc picard' }, params: { mode: 'Capitaliser' } },
  trim: { inputs: { text: '  Ada   Lovelace ' } },
  substring: { inputs: { text: 'FR76-3000-6000', count: '4' }, params: { mode: 'Gauche' } },
  replace: { inputs: { text: '06.12.34.56.78' }, params: { search: '.', replace: '' } },
  split: { inputs: { text: 'Ada Lovelace' }, params: { sep: ' ', index: '1' } },
  split_list: { inputs: { text: 'vip, newsletter ,promo' } },
  length: { inputs: { text: 'Lovelace' } },

  // ── Math ────────────────────────────────────────────────
  math: { inputs: { a: '2', b: '9.5' }, params: { op: 'Multiplication' } },
  round: { inputs: { value: '12.346' }, params: { decimals: '2' } },

  // ── Logique ─────────────────────────────────────────────
  compare: { inputs: { a: 'paid', b: 'paid' }, params: { op: '=' } },
  logic: { inputs: { a: 'true', b: 'false' }, params: { op: 'ET' } },
  not: { inputs: { a: 'true' } },
  switch: { inputs: { cond: 'true', yes: 'majeur', no: 'mineur' } },
  coalesce: { inputs: { value: '', fallback: 'inconnu' } },

  // ── Conversion ──────────────────────────────────────────
  to_string: { inputs: { value: 19.6 } },
  to_number: { inputs: { value: '3,5' } },
  transcode: { inputs: { table: { FRA: 'FR', ENG: 'GB', ESP: 'ES' }, value: 'ENG', fallback: '??' } },
  to_integer: { inputs: { value: '2.7' }, params: { mode: 'Arrondi' } },
  to_bool: { inputs: { value: 'oui' } },

  // ── Date ────────────────────────────────────────────────
  date_format: { inputs: { date: '2026-09-14' }, params: { format: 'JJ/MM/AAAA' } },
  date_part: { inputs: { date: '2026-09-14' }, params: { part: 'Jour de la semaine', days: 'lun, mar, mer, jeu, ven, sam, dim' } },
  age: { inputs: { date: '1990-06-15', ref: '2026-06-14' } },
};
