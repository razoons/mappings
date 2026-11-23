import { t } from '../lib/i18n';
import { LIBRARY_TABLE } from '../lib/libraries';
import { addCollection, addToLibrary, insertMapping, makeCollection, makeFolder, makeMapping } from './collections';
import { createComposite, createModel, sampleForSource } from './models';
import { createList, listContent } from './valueLists';

/*
 * Démo : une pizzeria qui livre à domicile (« La Bonne Pâte »). Elle installe :
 * - dans la bibliothèque, un dossier « Démo » : la liste « Carte » (codes produits → libellés), deux modèles simples
 *   (« Commande en ligne », « Fichier fidélité ») et le modèle composite « Commande fidélité » (la commande, plus
 *   les points fidélité du client retrouvé par son email) ;
 * - dans les mappings, un dossier « Démo » avec le mapping « Démo » (10 nœuds) : la commande fidélité devient le
 *   bon de livraison remis au livreur (libellés transcodés via la carte, montants, total, client VIP).
 */

const order = {
  orderId: 'W-20481',
  createdAt: '2026-11-07T19:42:00Z',
  email: 'julie.martin@mail.com',
  items: [
    { product: 'margherita', qty: 2, unitPrice: 9.5 },
    { product: 'regina', qty: 1, unitPrice: 13 },
    { product: 'tiramisu', qty: 2, unitPrice: 4.5 },
  ],
};

const loyalty = {
  clients: [
    { email: 'paul.durand@mail.com', firstName: 'paul', lastName: 'durand', points: 120 },
    { email: 'julie.martin@mail.com', firstName: 'julie', lastName: 'martin', points: 640 },
    { email: 'nina.costa@mail.com', firstName: 'nina', lastName: 'costa', points: 35 },
  ],
};

const MENU = {
  item: 'string',
  values: ['margherita', 'regina', 'quatre-fromages', 'calzone', 'tiramisu'],
  mapped: true,
  outItem: 'string',
  targets: ['Pizza Margherita', 'Pizza Regina', 'Pizza 4 fromages', 'Calzone', 'Tiramisu maison'],
};

const orderFields = (menuId) => [
  { id: 'w_id', name: 'orderId', type: 'string', required: true, format: { maxLength: 7 } },
  { id: 'w_date', name: 'createdAt', type: 'date', required: true },
  { id: 'w_email', name: 'email', type: 'string', required: true },
  {
    id: 'w_items',
    name: 'items',
    type: 'array',
    item: 'object',
    required: true,
    format: { minItems: 1 },
    children: [
      { id: 'i_product', name: 'product', type: 'string', required: true, format: { library: menuId } },
      { id: 'i_qty', name: 'qty', type: 'integer', required: true, format: { min: 1 } },
      { id: 'i_price', name: 'unitPrice', type: 'number', required: true, format: { min: 0 } },
    ],
  },
];

const LOYALTY_FIELDS = [
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
];

/** Champs du modèle composite : ceux de sa cible. */
const compositeFields = (menuId) => [
  { id: 'k_id', name: 'orderId', type: 'string', required: true },
  { id: 'k_date', name: 'createdAt', type: 'date', required: true },
  { id: 'k_email', name: 'email', type: 'string', required: true },
  {
    id: 'k_items',
    name: 'items',
    type: 'array',
    item: 'object',
    required: true,
    children: [
      { id: 'k_product', name: 'product', type: 'string', required: true, format: { library: menuId } },
      { id: 'k_qty', name: 'qty', type: 'integer', required: true, format: { min: 1 } },
      { id: 'k_price', name: 'unitPrice', type: 'number', required: true },
    ],
  },
  { id: 'k_points', name: 'points', type: 'integer' },
];

const SLIP_FIELDS = [
  { id: 't_ref', name: 'ref', type: 'string', required: true },
  { id: 't_date', name: 'date', type: 'string', required: true },
  { id: 't_email', name: 'email', type: 'string', required: true },
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
  { id: 't_total', name: 'total', type: 'number' },
  { id: 't_vip', name: 'vip', type: 'boolean' },
  { id: 't_message', name: 'message', type: 'string' },
];

const clone = (v) => JSON.parse(JSON.stringify(v));

const transform = (id, x, y, data) => ({ id, type: 'transform', position: { x, y }, data: { params: {}, values: {}, ...data } });

const link = (source, sourceHandle, target, targetHandle) => ({
  id: `e-${source}-${sourceHandle}-${target}-${targetHandle}`,
  type: 'typed',
  source,
  sourceHandle,
  target,
  targetHandle,
});

/** Nœud source relié au modèle `model` de la bibliothèque (ses champs, son exemple). */
const modelSource = (id, model, x, y) => ({
  id,
  type: 'source',
  position: { x, y },
  data: { label: model.name, fields: clone(model.fields), modelId: model.id, sample: sampleForSource(model) },
});

/** Schéma du modèle composite : la commande et le fichier fidélité, joints par l'email du client. */
function compositeGraph(orderModel, loyaltyModel, menuId) {
  return {
    nodes: [
      modelSource('order', orderModel, 0, 0),
      modelSource('loyalty', loyaltyModel, 0, 360),
      transform('points', 560, 380, { kind: 'lookup' }),
      { id: 'out', type: 'target', position: { x: 900, y: 60 }, data: { label: 'Commande fidélité', fields: compositeFields(menuId) } },
    ],
    edges: [
      link('order', 'w_id', 'out', 'k_id'),
      link('order', 'w_date', 'out', 'k_date'),
      link('order', 'w_email', 'out', 'k_email'),
      link('order', 'w_items', 'out', 'k_items'),
      link('order', 'i_product', 'out', 'k_product'),
      link('order', 'i_qty', 'out', 'k_qty'),
      link('order', 'i_price', 'out', 'k_price'),
      // Jointure : les points du client dont l'email est celui de la commande.
      link('order', 'w_email', 'points', 'key'),
      link('loyalty', 'c_email', 'points', 'keys'),
      link('loyalty', 'c_points', 'points', 'values'),
      link('points', 'result', 'out', 'k_points'),
    ],
  };
}

/** Schéma du mapping « Démo » (10 nœuds) : la commande fidélité devient le bon de livraison. */
function mappingGraph(composite, menu) {
  return {
    nodes: [
      modelSource('src', composite, 0, 0),
      { id: 'menu', type: 'library', position: { x: 0, y: 440 }, data: { label: menu.name, ...listContent(menu), listId: menu.id } },
      // Référence du bon : « LBP-W-20481 » ; date de la commande
      transform('ref', 560, 0, { kind: 'concat', params: { sep: '-' }, values: { a: 'LBP' } }),
      transform('date', 560, 150, { kind: 'date_reformat', params: { from: 'auto', format: 'DD/MM/YYYY' } }),
      // Articles : libellé transcodé via la carte, montant par ligne, total
      transform('label', 560, 300, { kind: 'transcode' }),
      transform('amount', 560, 470, { kind: 'math', params: { op: 'Multiplication' } }),
      transform('total', 880, 470, { kind: 'list_aggregate' }),
      // Fidélité : client VIP à partir de 500 points, et son message
      transform('vip', 560, 640, { kind: 'compare', params: { op: '≥' }, values: { b: '500' } }),
      transform('message', 880, 640, {
        kind: 'switch',
        values: { yes: 'Merci pour votre fidélité, un dessert vous est offert !', no: 'Bon appétit !' },
      }),
      { id: 'slip', type: 'target', position: { x: 1200, y: 120 }, data: { label: 'Bon de livraison', fields: clone(SLIP_FIELDS) } },
    ],
    edges: [
      link('src', 'k_id', 'ref', 'b'),
      link('ref', 'result', 'slip', 't_ref'),
      link('src', 'k_date', 'date', 'date'),
      link('date', 'result', 'slip', 't_date'),
      link('src', 'k_email', 'slip', 't_email'),
      link('src', 'k_items', 'slip', 't_items'),
      link('menu', LIBRARY_TABLE, 'label', 'table'),
      link('src', 'k_product', 'label', 'value'),
      link('label', 'result', 'slip', 't_label'),
      link('src', 'k_qty', 'slip', 't_qty'),
      link('src', 'k_qty', 'amount', 'a'),
      link('src', 'k_price', 'amount', 'b'),
      link('amount', 'result', 'slip', 't_amount'),
      link('src', 'k_items', 'total', 'list'),
      link('amount', 'result', 'total', 'value'),
      link('total', 'result', 'slip', 't_total'),
      link('src', 'k_points', 'vip', 'a'),
      link('vip', 'result', 'slip', 't_vip'),
      link('vip', 'result', 'message', 'cond'),
      link('message', 'result', 'slip', 't_message'),
    ],
  };
}

/**
 * Installe la démo : le dossier « Démo » de la bibliothèque (liste, modèles simples, modèle composite) et le dossier
 * « Démo » des mappings, avec son mapping, qui s'ouvre. Chaque appel crée de nouveaux éléments.
 */
export function installDemo() {
  const name = t('Démo', 'Demo');
  const folder = addToLibrary(makeFolder(name));
  const menu = createList('Carte', MENU, folder.id);
  const orderModel = createModel('Commande en ligne', orderFields(menu.id), JSON.stringify(order, null, 2), folder.id);
  const loyaltyModel = createModel('Fichier fidélité', LOYALTY_FIELDS, JSON.stringify(loyalty, null, 2), folder.id);
  const composite = createComposite('Commande fidélité', compositeGraph(orderModel, loyaltyModel, menu.id), folder.id);
  const collection = addCollection(makeCollection(name));
  return insertMapping(makeMapping(name, mappingGraph(composite, menu)), collection.id);
}
