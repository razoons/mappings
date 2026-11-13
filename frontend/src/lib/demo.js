/*
 * Démo : une pizzeria qui livre à domicile (« La Bonne Pâte »).
 * Deux sources — la commande passée sur le site et le fichier fidélité des clients — alimentent le bon de livraison
 * remis au livreur. Le client est retrouvé dans le fichier fidélité grâce à son email. La bibliothèque « Carte »
 * liste les codes produits autorisés et sert aussi de table de transcodage code → libellé affiché sur le bon.
 */

const order = {
  orderId: 'W-20481',
  createdAt: '2026-11-07T19:42:00Z',
  email: '  Julie.Martin@Mail.com ',
  phone: '06 12 34 56 78',
  address: { street: '12 rue des Lilas', zip: '69003', city: 'lyon' },
  items: [
    { product: 'margherita', size: 'M', qty: 2, unitPrice: 9.5 },
    { product: 'regina', size: 'L', qty: 1, unitPrice: 13 },
    { product: 'tiramisu', size: '', qty: 2, unitPrice: 4.5 },
  ],
  note: null,
};

const loyalty = {
  clients: [
    { email: 'paul.durand@mail.com', firstName: 'paul', lastName: 'durand', points: 120 },
    { email: 'julie.martin@mail.com', firstName: 'julie', lastName: 'martin', points: 640 },
    { email: 'nina.costa@mail.com', firstName: 'nina', lastName: 'costa', points: 35 },
  ],
};

const transform = (id, x, y, data) => ({
  id,
  type: 'transform',
  position: { x, y },
  data: { params: {}, values: {}, ...data },
});

const nodes = [
  {
    id: 'web',
    type: 'source',
    position: { x: 0, y: 698 },
    data: {
      label: 'Commande en ligne',
      sample: JSON.stringify(order, null, 2),
      fields: [
        { id: 'w_id', name: 'orderId', type: 'string', required: true, format: { maxLength: 7 } },
        { id: 'w_date', name: 'createdAt', type: 'date', required: true },
        { id: 'w_email', name: 'email', type: 'string', required: true },
        { id: 'w_phone', name: 'phone', type: 'string', required: true },
        {
          id: 'w_addr',
          name: 'address',
          type: 'object',
          required: true,
          children: [
            { id: 'a_street', name: 'street', type: 'string', required: true },
            { id: 'a_zip', name: 'zip', type: 'string', required: true, format: { pattern: '^\\d{5}$' } },
            { id: 'a_city', name: 'city', type: 'string', required: true },
          ],
        },
        {
          id: 'w_items',
          name: 'items',
          type: 'array',
          item: 'object',
          required: true,
          format: { minItems: 1 },
          children: [
            { id: 'i_product', name: 'product', type: 'string', required: true, format: { library: 'menu' } },
            { id: 'i_size', name: 'size', type: 'string' },
            { id: 'i_qty', name: 'qty', type: 'integer', required: true, format: { min: 1 } },
            { id: 'i_price', name: 'unitPrice', type: 'number', required: true, format: { min: 0 } },
          ],
        },
        { id: 'w_note', name: 'note', type: 'string' },
      ],
    },
  },
  {
    id: 'crm',
    type: 'source',
    position: { x: 0, y: 1269 },
    data: {
      label: 'Fichier fidélité',
      sample: JSON.stringify(loyalty, null, 2),
      fields: [
        {
          id: 'clients',
          name: 'clients',
          type: 'array',
          item: 'object',
          children: [
            { id: 'c_email', name: 'email', type: 'string', required: true },
            { id: 'c_first', name: 'firstName', type: 'string' },
            { id: 'c_last', name: 'lastName', type: 'string', required: true },
            { id: 'c_points', name: 'points', type: 'integer', format: { min: 0 } },
          ],
        },
      ],
    },
  },

  // Carte : codes produits autorisés, et leur libellé (table de transcodage)
  {
    id: 'menu',
    type: 'library',
    position: { x: 0, y: 200 },
    data: {
      label: 'Carte',
      item: 'string',
      values: ['margherita', 'regina', 'quatre-fromages', 'calzone', 'tiramisu'],
      mapped: true,
      outItem: 'string',
      targets: ['Pizza Margherita', 'Pizza Regina', 'Pizza 4 fromages', 'Calzone', 'Tiramisu maison'],
    },
  },

  // Référence du bon : « LBP-W-20481 »
  transform('ref', 590, 0, { kind: 'concat', params: { sep: '-' }, values: { a: 'LBP' } }),
  // Livraison : jour en toutes lettres, date, adresse
  transform('weekday', 590, 198, { kind: 'date_part', params: { part: 'Jour de la semaine' } }),
  transform('date', 590, 396, { kind: 'date_format', params: { format: 'JJ/MM/AAAA' } }),
  transform('city', 590, 542, { kind: 'case', params: { mode: 'Capitaliser' } }),
  transform('zipCity', 910, 566, { kind: 'concat' }),
  transform('address', 1230, 654, { kind: 'concat', params: { sep: ', ' } }),
  // Contact : email nettoyé, téléphone sans espaces
  transform('trimEmail', 590, 860, { kind: 'trim' }),
  transform('lowerEmail', 910, 764, { kind: 'case', params: { mode: 'minuscules' } }),
  transform('phone', 590, 688, { kind: 'replace', params: { search: ' ', replace: '' } }),
  // Fidélité : le client dont l'email correspond
  transform('sameEmail', 1230, 968, { kind: 'compare', params: { op: '=' } }),
  transform('first', 590, 1616, { kind: 'case', params: { mode: 'Capitaliser' } }),
  transform('last', 590, 1762, { kind: 'case', params: { mode: 'MAJUSCULES' } }),
  transform('fullName', 910, 1434, { kind: 'concat' }),
  transform('findName', 1550, 963, { kind: 'list_find' }),
  transform('findPoints', 1550, 1161, { kind: 'list_find' }),
  transform('isVip', 1870, 974, { kind: 'compare', params: { op: '≥' }, values: { b: '500' } }),
  transform('message', 2190, 972, {
    kind: 'switch',
    values: { yes: 'Merci pour votre fidélité, un dessert vous est offert !', no: 'Bon appétit !' },
  }),
  // Articles : libellé (transcodé via la carte), montant par ligne, totaux
  transform('product', 590, 980, { kind: 'transcode' }),
  transform('label', 910, 910, { kind: 'concat' }),
  transform('amount', 590, 1444, { kind: 'math', params: { op: 'Multiplication' } }),
  transform('sum', 910, 1254, { kind: 'list_aggregate' }),
  transform('total', 1230, 1140, { kind: 'round', params: { decimals: '2' } }),
  transform('qtySum', 590, 1126, { kind: 'list_aggregate' }),
  transform('qtyInt', 910, 1108, { kind: 'to_integer' }),
  // Remarque du client, ou « Aucune »
  transform('note', 590, 1298, { kind: 'coalesce', values: { fallback: 'Aucune' } }),

  {
    id: 'slip',
    type: 'target',
    position: { x: 2510, y: 573 },
    data: {
      label: 'Bon de livraison',
      fields: [
        { id: 't_ref', name: 'ref', type: 'string', required: true, format: { maxLength: 12 } },
        {
          id: 't_delivery',
          name: 'livraison',
          type: 'object',
          children: [
            { id: 't_day', name: 'jour', type: 'string' },
            { id: 't_date', name: 'date', type: 'string', required: true },
            { id: 't_addr', name: 'adresse', type: 'string', required: true },
          ],
        },
        {
          id: 't_client',
          name: 'client',
          type: 'object',
          children: [
            { id: 't_name', name: 'nom', type: 'string' },
            { id: 't_email', name: 'email', type: 'string', required: true },
            { id: 't_phone', name: 'telephone', type: 'string', required: true },
            { id: 't_vip', name: 'vip', type: 'boolean' },
          ],
        },
        {
          id: 't_items',
          name: 'articles',
          type: 'array',
          item: 'object',
          required: true,
          children: [
            { id: 't_label', name: 'libelle', type: 'string', required: true },
            { id: 't_qty', name: 'quantite', type: 'integer', required: true, format: { min: 1 } },
            { id: 't_amount', name: 'montant', type: 'number' },
          ],
        },
        { id: 't_count', name: 'nbArticles', type: 'integer' },
        { id: 't_total', name: 'total', type: 'number' },
        { id: 't_message', name: 'message', type: 'string' },
        { id: 't_note', name: 'remarque', type: 'string' },
      ],
    },
  },
];

const link = (source, sourceHandle, target, targetHandle) => ({
  id: `e-${source}-${sourceHandle}-${target}-${targetHandle}`,
  type: 'typed',
  source,
  sourceHandle,
  target,
  targetHandle,
});

const edges = [
  // référence
  link('web', 'w_id', 'ref', 'b'),
  link('ref', 'result', 'slip', 't_ref'),
  // livraison
  link('web', 'w_date', 'weekday', 'date'),
  link('weekday', 'name', 'slip', 't_day'),
  link('web', 'w_date', 'date', 'date'),
  link('date', 'result', 'slip', 't_date'),
  link('web', 'a_city', 'city', 'text'),
  link('web', 'a_zip', 'zipCity', 'a'),
  link('city', 'result', 'zipCity', 'b'),
  link('web', 'a_street', 'address', 'a'),
  link('zipCity', 'result', 'address', 'b'),
  link('address', 'result', 'slip', 't_addr'),
  // contact
  link('web', 'w_email', 'trimEmail', 'text'),
  link('trimEmail', 'result', 'lowerEmail', 'text'),
  link('lowerEmail', 'result', 'slip', 't_email'),
  link('web', 'w_phone', 'phone', 'text'),
  link('phone', 'result', 'slip', 't_phone'),
  // fidélité : client retrouvé par son email
  link('crm', 'c_email', 'sameEmail', 'a'),
  link('lowerEmail', 'result', 'sameEmail', 'b'),
  link('crm', 'c_first', 'first', 'text'),
  link('crm', 'c_last', 'last', 'text'),
  link('first', 'result', 'fullName', 'a'),
  link('last', 'result', 'fullName', 'b'),
  link('crm', 'clients', 'findName', 'list'),
  link('sameEmail', 'result', 'findName', 'cond'),
  link('fullName', 'result', 'findName', 'value'),
  link('findName', 'result', 'slip', 't_name'),
  link('crm', 'clients', 'findPoints', 'list'),
  link('sameEmail', 'result', 'findPoints', 'cond'),
  link('crm', 'c_points', 'findPoints', 'value'),
  link('findPoints', 'result', 'isVip', 'a'),
  link('isVip', 'result', 'slip', 't_vip'),
  link('isVip', 'result', 'message', 'cond'),
  link('message', 'result', 'slip', 't_message'),
  // articles
  link('web', 'w_items', 'slip', 't_items'),
  link('menu', 'table', 'product', 'table'),
  link('web', 'i_product', 'product', 'value'),
  link('product', 'result', 'label', 'a'),
  link('web', 'i_size', 'label', 'b'),
  link('label', 'result', 'slip', 't_label'),
  link('web', 'i_qty', 'slip', 't_qty'),
  link('web', 'i_qty', 'amount', 'a'),
  link('web', 'i_price', 'amount', 'b'),
  link('amount', 'result', 'slip', 't_amount'),
  // totaux
  link('web', 'w_items', 'sum', 'list'),
  link('amount', 'result', 'sum', 'value'),
  link('sum', 'result', 'total', 'value'),
  link('total', 'result', 'slip', 't_total'),
  link('web', 'w_items', 'qtySum', 'list'),
  link('web', 'i_qty', 'qtySum', 'value'),
  link('qtySum', 'result', 'qtyInt', 'value'),
  link('qtyInt', 'result', 'slip', 't_count'),
  // remarque
  link('web', 'w_note', 'note', 'value'),
  link('note', 'result', 'slip', 't_note'),
];

/** Graphe d'exemple ; renvoie une copie neuve à chaque appel. */
export const demoGraph = () => structuredClone({ nodes, edges });
