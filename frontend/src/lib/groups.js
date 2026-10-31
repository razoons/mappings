import { uid } from './types';

/**
 * Groupes : cadres qui rassemblent des nœuds (rattachés par `parentNode`, positions relatives au groupe).
 * Les groupes ne s'imbriquent pas. Ces fonctions travaillent sur des nœuds « simples »
 * `{ id, type, position, data, parentNode?, style? }` ; `sizes` donne la taille mesurée de chaque nœud.
 */

/** Hauteur d'un groupe replié (son en-tête seul). */
export const GROUP_HEADER = 34;
const PADDING = 30;

export const isGroup = (n) => n?.type === 'group';

/** Vue Flow exige qu'un parent précède ses enfants. */
export const groupsFirst = (nodes) => [...nodes.filter(isGroup), ...nodes.filter((n) => !isGroup(n))];

export const newGroup = (position, width = 420, height = 280) => ({
  id: uid('g'),
  type: 'group',
  position,
  style: { width: `${width}px`, height: `${height}px` },
  data: { label: 'Groupe' },
});

function absolutePosition(n, byId) {
  const parent = n.parentNode ? byId.get(n.parentNode) : undefined;
  return parent ? { x: parent.position.x + n.position.x, y: parent.position.y + n.position.y } : n.position;
}

/** Groupe déplié sous le point `p` (le dernier affiché l'emporte). */
export function groupAt(nodes, sizes, p) {
  return nodes
    .filter((g) => isGroup(g) && !g.data.collapsed)
    .reverse()
    .find((g) => {
      const { w, h } = sizes.get(g.id) ?? { w: 0, h: 0 };
      return p.x >= g.position.x && p.x <= g.position.x + w && p.y >= g.position.y && p.y <= g.position.y + h;
    });
}

/** Range les nœuds `ids` dans `groupId` (ou les sort de tout groupe si nul) sans les déplacer à l'écran. */
export function reparent(nodes, ids, groupId) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const group = groupId ? byId.get(groupId) : undefined;
  return groupsFirst(
    nodes.map((n) => {
      if (!ids.includes(n.id) || isGroup(n) || (n.parentNode ?? null) === (groupId ?? null)) return n;
      const abs = absolutePosition(n, byId);
      const { parentNode: _, ...rest } = n;
      return group ? { ...rest, parentNode: group.id, position: { x: abs.x - group.position.x, y: abs.y - group.position.y } } : { ...rest, position: abs };
    }),
  );
}

/** Crée un groupe qui englobe les nœuds `ids`. */
export function groupAround(nodes, sizes, ids) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const members = nodes.filter((n) => ids.includes(n.id) && !isGroup(n));
  if (!members.length) return nodes;
  const boxes = members.map((n) => ({ ...absolutePosition(n, byId), ...(sizes.get(n.id) ?? { w: 0, h: 0 }) }));
  const x = Math.min(...boxes.map((b) => b.x)) - PADDING;
  const y = Math.min(...boxes.map((b) => b.y)) - PADDING - GROUP_HEADER;
  const width = Math.max(...boxes.map((b) => b.x + b.w)) + PADDING - x;
  const height = Math.max(...boxes.map((b) => b.y + b.h)) + PADDING - y;
  const group = newGroup({ x, y }, width, height);
  return reparent([group, ...nodes], members.map((n) => n.id), group.id);
}

/** Supprime les nœuds `ids` ; les enfants d'un groupe supprimé restent à leur place (sauf s'ils sont eux-mêmes supprimés). */
export function removeKeepingChildren(nodes, ids) {
  const spared = nodes.filter((n) => n.parentNode && ids.includes(n.parentNode) && !ids.includes(n.id)).map((n) => n.id);
  return reparent(nodes, spared, null).filter((n) => !ids.includes(n.id));
}
