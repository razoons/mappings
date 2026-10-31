const sample = {
  customer: { firstName: 'ada', lastName: 'Lovelace', email: '  Ada.Lovelace@Example.com ' },
  orders: [
    {
      id: 'A-1001',
      date: '2026-09-14',
      status: 'paid',
      lines: [
        { sku: 'KB-01', qty: 1, price: 89.9 },
        { sku: 'MS-07', qty: 2, price: 24.5 },
      ],
    },
    { id: 'A-1002', date: '2026-10-02', status: 'cancelled', lines: [{ sku: 'HD-11', qty: 1, price: 129 }] },
    { id: 'A-1003', date: '2026-10-28', status: 'paid', lines: [{ sku: 'CB-02', qty: 3, price: 9.99 }] },
  ],
  tags: ['vip', 'newsletter'],
};

const transform = (id, x, y, data) => ({
  id,
  type: 'transform',
  position: { x, y },
  data: { params: {}, values: {}, ...data },
});

const nodes = [
  {
    id: 'src',
    type: 'source',
    position: { x: 0, y: 0 },
    data: {
      label: 'Boutique',
      sample: JSON.stringify(sample, null, 2),
      fields: [
        {
          id: 'customer',
          name: 'customer',
          type: 'object',
          children: [
            { id: 'c_first', name: 'firstName', type: 'string' },
            { id: 'c_last', name: 'lastName', type: 'string' },
            { id: 'c_email', name: 'email', type: 'string', required: true },
          ],
        },
        {
          id: 'orders',
          name: 'orders',
          type: 'array',
          item: 'object',
          children: [
            { id: 'o_id', name: 'id', type: 'string', required: true, format: { maxLength: 10 } },
            { id: 'o_date', name: 'date', type: 'date' },
            { id: 'o_status', name: 'status', type: 'string' },
            {
              id: 'o_lines',
              name: 'lines',
              type: 'array',
              item: 'object',
              children: [
                { id: 'l_sku', name: 'sku', type: 'string' },
                { id: 'l_qty', name: 'qty', type: 'number', required: true, format: { integer: true } },
                { id: 'l_price', name: 'price', type: 'number' },
              ],
            },
          ],
        },
        { id: 'tags', name: 'tags', type: 'array', item: 'string' },
      ],
    },
  },
  transform('cap', 540, -150, { kind: 'case', params: { mode: 'Capitaliser' } }),
  transform('concat', 790, -190, { kind: 'concat' }),
  transform('trim', 540, -10, { kind: 'trim' }),
  transform('lower', 790, 10, { kind: 'case', params: { mode: 'minuscules' } }),
  transform('paid', 540, 120, { kind: 'compare', params: { op: '=' }, values: { b: 'paid' } }),
  transform('filter', 790, 150, { kind: 'list_filter' }),
  transform('datefmt', 790, 290, { kind: 'date_format' }),
  transform('lineTotal', 540, 300, { kind: 'math', params: { op: 'Multiplication' } }),
  transform('sum', 790, 420, { kind: 'list_aggregate' }),
  transform('count', 540, 470, { kind: 'list_count' }),
  transform('last', 540, 580, { kind: 'list_at', params: { from: 'Fin' } }),
  transform('join', 790, 600, { kind: 'list_join' }),
  {
    id: 'tgt',
    type: 'target',
    position: { x: 1080, y: 20 },
    data: {
      label: 'Export ERP',
      fields: [
        {
          id: 't_client',
          name: 'client',
          type: 'object',
          children: [
            { id: 't_name', name: 'name', type: 'string', required: true, format: { maxLength: 60 } },
            { id: 't_email', name: 'email', type: 'string', required: true },
          ],
        },
        {
          id: 't_inv',
          name: 'invoices',
          type: 'array',
          item: 'object',
          children: [
            { id: 't_ref', name: 'ref', type: 'string', required: true, format: { maxLength: 12 } },
            { id: 't_date', name: 'date', type: 'string' },
            { id: 't_total', name: 'total', type: 'number' },
            {
              id: 't_items',
              name: 'items',
              type: 'array',
              item: 'object',
              children: [
                { id: 't_code', name: 'code', type: 'string', required: true },
                { id: 't_qty', name: 'qty', type: 'number', required: true, format: { integer: true, min: 1 } },
              ],
            },
          ],
        },
        { id: 't_count', name: 'orderCount', type: 'number' },
        { id: 't_last', name: 'lastOrderRef', type: 'string' },
        { id: 't_tags', name: 'tags', type: 'string' },
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
  // client : nom formaté, email nettoyé
  link('src', 'c_first', 'cap', 'text'),
  link('cap', 'result', 'concat', 'a'),
  link('src', 'c_last', 'concat', 'b'),
  link('concat', 'result', 'tgt', 't_name'),
  link('src', 'c_email', 'trim', 'text'),
  link('trim', 'result', 'lower', 'text'),
  link('lower', 'result', 'tgt', 't_email'),
  // invoices : une facture par commande payée
  link('src', 'orders', 'filter', 'list'),
  link('src', 'o_status', 'paid', 'a'),
  link('paid', 'result', 'filter', 'cond'),
  link('filter', 'result', 'tgt', 't_inv'),
  link('src', 'o_id', 'tgt', 't_ref'),
  link('src', 'o_date', 'datefmt', 'date'),
  link('datefmt', 'result', 'tgt', 't_date'),
  // total = Σ qty × price des lignes de la commande courante
  link('src', 'o_lines', 'sum', 'list'),
  link('src', 'l_qty', 'lineTotal', 'a'),
  link('src', 'l_price', 'lineTotal', 'b'),
  link('lineTotal', 'result', 'sum', 'value'),
  link('sum', 'result', 'tgt', 't_total'),
  // items : tableau imbriqué
  link('src', 'o_lines', 'tgt', 't_items'),
  link('src', 'l_sku', 'tgt', 't_code'),
  link('src', 'l_qty', 'tgt', 't_qty'),
  // agrégats
  link('src', 'orders', 'count', 'list'),
  link('count', 'result', 'tgt', 't_count'),
  link('src', 'orders', 'last', 'list'),
  link('src', 'o_id', 'last', 'value'),
  link('last', 'result', 'tgt', 't_last'),
  link('src', 'tags', 'join', 'list'),
  link('join', 'result', 'tgt', 't_tags'),
];

/** Graphe d'exemple ; renvoie une copie neuve à chaque appel. */
export const demoGraph = () => structuredClone({ nodes, edges });
