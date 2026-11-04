import { GROUP_HEADER, isGroup } from './groups';

/**
 * Disposition automatique en colonnes, attentive aux sockets : un lien part d'une ligne précise d'une source
 * et arrive sur une ligne précise d'une cible, c'est la hauteur de ces lignes qui compte.
 *
 * 1. Blocs : un nœud, ou un groupe entier (il se déplace avec ses nœuds) ; un nœud verrouillé ne bouge pas.
 * 2. Colonnes : les sources à gauche, chaque transformation une colonne après la plus lointaine de ses entrées,
 *    les cibles tout à droite ; un bloc sans entrée (constante…) se place juste avant ce qu'il alimente.
 * 3. Hauteurs : chaque bloc vise la hauteur moyenne des sockets auxquels il est relié (balayages gauche → droite
 *    puis droite → gauche) ; dans une colonne, les blocs sont rangés dans cet ordre et serrés sans chevauchement,
 *    au plus près de ces hauteurs (régression isotone : optimum exact).
 *
 * `nodes` : nœuds « simples » (position relative à leur groupe) ; `sizes` : taille mesurée de chaque nœud ;
 * `handles` : position verticale de chaque socket dans son nœud (`id → { source: Map, target: Map }`).
 * Renvoie les nouvelles positions des blocs déplacés (nœuds hors groupe et groupes).
 */
const COLUMN_GAP = 110;
const ROW_GAP = 28;
const SWEEPS = 4;

export function autoLayout(nodes, edges, sizes, handles) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const sizeOf = (id) => sizes.get(id) ?? { w: 200, h: 100 };

  // ── Blocs ────────────────────────────────────────────────
  const blockOf = (id) => byId.get(id)?.parentNode ?? id;
  const blocks = nodes.filter((n) => !n.parentNode).map((n) => ({ id: n.id, node: n, ...sizeOf(n.id), fixed: !!n.data.locked }));
  const block = new Map(blocks.map((b) => [b.id, b]));

  /** Décalage vertical d'un socket dans son bloc (dans un groupe replié : l'en-tête, où aboutissent ses liens). */
  function socketOffset(nodeId, handleId, side) {
    const n = byId.get(nodeId);
    const parent = n?.parentNode && byId.get(n.parentNode);
    if (parent?.data.collapsed) return GROUP_HEADER / 2;
    const own = handles.get(nodeId)?.[side]?.get(handleId) ?? sizeOf(nodeId).h / 2;
    return (parent ? n.position.y : 0) + own;
  }

  const links = edges
    .map((e) => ({
      from: blockOf(e.source),
      to: blockOf(e.target),
      fromY: socketOffset(e.source, e.sourceHandle, 'source'),
      toY: socketOffset(e.target, e.targetHandle, 'target'),
    }))
    .filter((l) => l.from !== l.to && block.has(l.from) && block.has(l.to));
  const incoming = (id) => links.filter((l) => l.to === id);
  const outgoing = (id) => links.filter((l) => l.from === id);

  // ── Colonnes ─────────────────────────────────────────────
  const kindOf = (b) => {
    const members = isGroup(b.node) ? nodes.filter((n) => n.parentNode === b.id) : [b.node];
    if (members.length && members.every((n) => n.type === 'source')) return 'source';
    if (members.length && members.every((n) => n.type === 'target')) return 'target';
    return 'middle';
  };
  const rank = new Map();
  const rankOf = (id, seen = new Set()) => {
    if (rank.has(id)) return rank.get(id);
    if (seen.has(id)) return 0; // cycle (normalement refusé) : on coupe
    seen.add(id);
    const b = block.get(id);
    const ins = incoming(id);
    const r = kindOf(b) === 'source' || !ins.length ? 0 : 1 + Math.max(...ins.map((l) => rankOf(l.from, seen)));
    rank.set(id, r);
    return r;
  };
  blocks.forEach((b) => rankOf(b.id));
  const middleMax = Math.max(0, ...blocks.filter((b) => kindOf(b) !== 'target').map((b) => rank.get(b.id)));
  const lastRank = middleMax + 1;
  for (const b of blocks) if (kindOf(b) === 'target') rank.set(b.id, lastRank);
  // Sans entrée (constante, « Maintenant »…) : juste avant le premier bloc qu'il alimente.
  for (const b of blocks) {
    if (kindOf(b) === 'source' || incoming(b.id).length) continue;
    const outs = outgoing(b.id).map((l) => rank.get(l.to));
    if (outs.length) rank.set(b.id, Math.max(0, Math.min(...outs) - 1));
  }

  const columns = [];
  for (const b of blocks) (columns[rank.get(b.id)] ??= []).push(b);
  const used = columns.filter(Boolean);

  // ── Position de départ : là où se trouvait le schéma, colonnes dans l'ordre vertical actuel ──
  const left = Math.min(...blocks.map((b) => b.node.position.x));
  const top = Math.min(...blocks.map((b) => b.node.position.y));
  const y = new Map();
  let x = left;
  const xOf = new Map();
  for (const col of used) {
    col.sort((a, b) => a.node.position.y - b.node.position.y);
    let cursor = top;
    for (const b of col) {
      y.set(b.id, b.fixed ? b.node.position.y : cursor);
      cursor = y.get(b.id) + b.h + ROW_GAP;
    }
    // Un bloc fixe (verrouillé) garde sa place : la colonne commence après lui, et la suivante aussi.
    const fixed = col.filter((b) => b.fixed);
    if (fixed.length) x = Math.max(x, ...fixed.map((b) => b.node.position.x + b.w + COLUMN_GAP));
    const movable = col.filter((b) => !b.fixed);
    for (const b of col) xOf.set(b.id, b.fixed ? b.node.position.x : x);
    x = Math.max(x + Math.max(0, ...movable.map((b) => b.w)) + (movable.length ? COLUMN_GAP : 0), ...fixed.map((b) => b.node.position.x + b.w + COLUMN_GAP));
  }

  // ── Hauteurs : balayages ───────────────────────────────────
  /** Hauteur visée par le bloc : moyenne, sur ses liens, de la hauteur du socket d'en face moins celle du sien. */
  function ideal(b, useIn, useOut) {
    const wanted = [
      ...(useIn ? incoming(b.id).map((l) => y.get(l.from) + l.fromY - l.toY) : []),
      ...(useOut ? outgoing(b.id).map((l) => y.get(l.to) + l.toY - l.fromY) : []),
    ];
    return wanted.length ? wanted.reduce((s, v) => s + v, 0) / wanted.length : y.get(b.id);
  }

  /** Range la colonne au plus près des hauteurs visées, dans leur ordre et sans chevauchement. */
  function placeColumn(col, useIn, useOut) {
    const movable = col.filter((b) => !b.fixed);
    const targets = new Map(movable.map((b) => [b.id, ideal(b, useIn, useOut)]));
    movable.sort((a, b) => targets.get(a.id) - targets.get(b.id));
    // Régression isotone (pool adjacent violators) sur les hauteurs ramenées à des blocs de taille nulle.
    let offset = 0;
    const pools = [];
    for (const b of movable) {
      pools.push({ sum: targets.get(b.id) - offset, count: 1, items: [{ b, offset }] });
      offset += b.h + ROW_GAP;
      while (pools.length > 1 && pools.at(-2).sum / pools.at(-2).count > pools.at(-1).sum / pools.at(-1).count) {
        const last = pools.pop();
        const prev = pools.at(-1);
        prev.sum += last.sum;
        prev.count += last.count;
        prev.items.push(...last.items);
      }
    }
    for (const p of pools) for (const { b, offset: o } of p.items) y.set(b.id, p.sum / p.count + o);
  }

  for (let s = 0; s < SWEEPS; s++) {
    if (s % 2 === 0) for (let c = 1; c < used.length; c++) placeColumn(used[c], true, c < used.length - 1 && s > 0);
    else for (let c = used.length - 2; c >= 0; c--) placeColumn(used[c], c > 0, true);
  }

  // Le schéma garde son coin haut gauche (sauf s'il y a des blocs fixes : on reste aligné sur eux).
  const shift = blocks.some((b) => b.fixed) ? 0 : top - Math.min(...blocks.map((b) => y.get(b.id)));
  const positions = new Map();
  for (const b of blocks) if (!b.fixed) positions.set(b.id, { x: xOf.get(b.id), y: y.get(b.id) + shift });
  return positions;
}
