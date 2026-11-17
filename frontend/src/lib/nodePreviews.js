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
  // Même thème que la démo (services/demo.js) : la pizzeria « La Bonne Pâte », sa commande en ligne, son fichier
  // fidélité et sa carte.

  // ── Entrée ──────────────────────────────────────────────
  const_string: { params: { value: 'LBP' } },
  const_number: { params: { value: '9,5' } },
  const_bool: { params: { value: 'vrai' } },
  now: {},

  // ── Structure ───────────────────────────────────────────
  current: { current: { item: { product: 'regina', qty: 1 }, index: 1 } },
  get_field: { inputs: { obj: { orderId: 'W-20481', items: [{ product: 'margherita' }, { product: 'regina' }] } }, params: { path: 'items[1].product' } },
  set_field: { inputs: { obj: { email: 'julie.martin@mail.com', points: 640 } }, each: { value: [['vrai', 'true'], () => true] }, params: { path: 'vip' } },
  remove_field: { inputs: { obj: { orderId: 'W-20481', phone: '0612345678', note: null } }, params: { keys: 'note' } },
  list_create: { inputs: { a: 'margherita', b: ['regina', 'tiramisu'] } },

  // ── Liste ───────────────────────────────────────────────
  list_filter: { inputs: { list: [9.5, 13, 4.5] }, each: { cond: [['élément > 5', 'item > 5'], (x) => x > 5] } },
  list_sort: { inputs: { list: ['tiramisu', 'regina', 'margherita'] } },
  list_map: {
    inputs: { list: [{ qty: 2, unitPrice: 9.5 }, { qty: 1, unitPrice: 13 }] },
    each: { value: ['qty × unitPrice', (x) => x.qty * x.unitPrice] },
  },
  list_at: { inputs: { list: ['margherita', 'regina', 'tiramisu'], index: '0' }, params: { from: 'Fin' } },
  list_find: {
    inputs: { list: [{ email: 'paul.durand@mail.com', firstName: 'paul' }, { email: 'julie.martin@mail.com', firstName: 'julie' }] },
    each: {
      cond: [['email = « julie.martin@mail.com »', 'email = “julie.martin@mail.com”'], (x) => x.email === 'julie.martin@mail.com'],
      value: ['firstName', (x) => x.firstName],
    },
  },
  lookup: { inputs: { key: 'julie.martin@mail.com', keys: ['paul.durand@mail.com', 'julie.martin@mail.com', 'nina.costa@mail.com'], values: [120, 640, 35] } },
  list_count: { inputs: { list: ['margherita', 'regina', 'tiramisu'] } },
  list_aggregate: { inputs: { list: [120, 640, 35] }, params: { op: 'Moyenne' } },
  list_test: { inputs: { list: [9.5, 13, 4.5] }, each: { cond: [['élément ≥ 5', 'item ≥ 5'], (x) => x >= 5] }, params: { op: 'Tous' } },
  list_slice: { inputs: { list: ['margherita', 'regina', 'calzone', 'tiramisu'], start: '1', count: '2' } },
  list_reverse: { inputs: { list: ['margherita', 'regina', 'tiramisu'] } },
  list_unique: { inputs: { list: ['margherita', 'regina', 'margherita', 'tiramisu'] } },
  list_join: { inputs: { list: ['Pizza Margherita', 'Tiramisu maison'] }, params: { sep: ', ' } },

  // ── Texte ───────────────────────────────────────────────
  concat: { inputs: { a: 'Julie', b: 'MARTIN' } },
  case: { inputs: { text: 'pizza quatre-fromages' }, params: { mode: 'Capitaliser' } },
  trim: { inputs: { text: '  Julie.Martin@Mail.com ' } },
  substring: { inputs: { text: 'LBP-W-20481', count: '3' }, params: { mode: 'Gauche' } },
  replace: { inputs: { text: '06 12 34 56 78' }, params: { search: ' ', replace: '' } },
  split: { inputs: { text: 'Julie Martin' }, params: { sep: ' ', index: '1' } },
  split_list: { inputs: { text: 'margherita, regina ,tiramisu' } },
  length: { inputs: { text: 'W-20481' } },

  // ── Math ────────────────────────────────────────────────
  math: { inputs: { a: '2', b: '9.5' }, params: { op: 'Multiplication' } },
  round: { inputs: { value: '40.996' }, params: { decimals: '2' } },

  // ── Logique ─────────────────────────────────────────────
  compare: { inputs: { a: '640', b: '500' }, params: { op: '≥' } },
  logic: { inputs: { a: 'true', b: 'false' }, params: { op: 'ET' } },
  not: { inputs: { a: 'true' } },
  switch: { inputs: { cond: 'true', yes: 'Client VIP', no: 'Client' } },
  coalesce: { inputs: { value: '', fallback: 'Aucune' } },

  // ── Conversion ──────────────────────────────────────────
  to_string: { inputs: { value: 9.5 } },
  to_number: { inputs: { value: '9,5' } },
  transcode: { inputs: { table: { margherita: 'Pizza Margherita', regina: 'Pizza Regina', tiramisu: 'Tiramisu maison' }, value: 'regina', fallback: '??' } },
  to_integer: { inputs: { value: '2.7' }, params: { mode: 'Arrondi' } },
  to_bool: { inputs: { value: 'oui' } },

  // ── Date ────────────────────────────────────────────────
  date_format: { inputs: { date: '2026-11-07' }, params: { format: 'JJ/MM/AAAA' } },
  date_part: { inputs: { date: '2026-11-07' }, params: { part: 'Jour de la semaine', days: 'lun, mar, mer, jeu, ven, sam, dim' } },
  age: { inputs: { date: '1990-06-15', ref: '2026-11-07' } },
};
