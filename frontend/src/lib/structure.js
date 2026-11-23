import { allFields, isContainer } from './fields';
import { TRANSFORMS } from './transforms';

/**
 * Objets entiers : une source se relie aussi d'un bloc (socket « Document » de son en-tête) à la cible entière
 * (socket de son en-tête : les champs de la source y sont repris, `data.mirror` sur le nœud ; la cible peut avoir en
 * plus ses propres champs, placés après), ou à un champ Objet ou Liste d'objets d'une cible. Ce champ reprend alors la structure de la source : ses sous-champs en sont une copie
 * (`mirror: true` sur le champ), en lecture seule dans la cible, et sa valeur est le document entier.
 * « Retirer des champs », intercalé sur le lien, enlève des champs de cette structure comme de la valeur.
 */

/** Id du socket « Document » d'une source, et du socket d'en-tête d'une cible (jamais celui d'un champ). */
export const SOURCE_DOC = '__doc';

/** Séparateur des ids des sous-champs repris : `<champ cible>><champ source>`. */
const SEP = '>';

/** Clés de « Retirer des champs » : `a, b.c, lignes[].sku` → `[['a'], ['b', 'c'], ['lignes', 'sku']]`. */
export const keyPaths = (text) =>
  String(text ?? '')
    .split(',')
    .map((k) => k.trim().replace(/\[\]/g, ''))
    .filter(Boolean)
    .map((k) => k.split('.').filter(Boolean));

/** Champs sans ceux que désignent les chemins (noms ; une liste d'objets est traversée). */
export function omitFields(fields, paths) {
  if (!paths.length) return fields;
  return fields
    .filter((f) => !paths.some((p) => p.length === 1 && p[0] === f.name))
    .map((f) => {
      const sub = paths.filter((p) => p.length > 1 && p[0] === f.name).map((p) => p.slice(1));
      return sub.length && f.children ? { ...f, children: omitFields(f.children, sub) } : f;
    });
}

/**
 * Structure (champs) de la valeur que donne la sortie `handle` du nœud `nodeId`, quand elle est connue : le
 * document entier d'une source, éventuellement réduit par des « Retirer des champs », et transmis par les nœuds
 * qui font passer une entrée telle quelle (`passes` : « Rechercher par clé », « Valeur par défaut », « Condition »,
 * filtres et tris…). `null` sinon.
 * `incoming` : liens par entrée (`nœud:entrée` → lien).
 */
export function structureOf(byId, incoming, nodeId, handle, depth = 0) {
  const node = byId.get(nodeId);
  if (!node || depth > 50) return null;
  if (node.type === 'source') return handle === SOURCE_DOC ? (node.data.fields ?? []) : null;
  if (node.type === 'transform' && node.data.kind === 'remove_field' && handle === 'result') {
    const e = incoming.get(`${nodeId}:obj`);
    const up = e && structureOf(byId, incoming, e.source, e.sourceHandle, depth + 1);
    return up ? omitFields(up, keyPaths(node.data.params?.keys ?? 'id')) : null;
  }
  const pass = node.type === 'transform' && TRANSFORMS[node.data.kind]?.passes?.[handle];
  if (!pass) return null;
  const from = (id) => {
    const e = incoming.get(`${nodeId}:${id}`);
    return e ? structureOf(byId, incoming, e.source, e.sourceHandle, depth + 1) : null;
  };
  if (pass.unless && incoming.has(`${nodeId}:${pass.unless}`)) return from(pass.unless);
  const ids =
    pass.inputs === 'variadic'
      ? [...incoming.keys()].filter((k) => k.startsWith(`${nodeId}:`)).map((k) => k.slice(nodeId.length + 1))
      : pass.inputs;
  // La 1re entrée transmise dont la structure est connue (ex. « Valeurs » de Rechercher par clé).
  for (const id of ids) {
    const s = from(id);
    if (s) return s;
  }
  return null;
}

/** Copie de la structure `struct` pour le champ cible `fieldId` (états replié / déplié de `previous` gardés). */
function mirrorOf(fieldId, struct, previous) {
  const collapsed = new Set(allFields(previous ?? []).filter((f) => f.collapsed).map((f) => f.id));
  const copy = (fields) =>
    fields.map(({ collapsed: _, mirror: __, ...f }) => {
      const id = `${fieldId}${SEP}${f.id}`;
      const next = { ...f, id };
      if (collapsed.has(id)) next.collapsed = true;
      if (f.children) next.children = copy(f.children);
      return next;
    });
  return copy(struct);
}

/**
 * Aligne les cibles et les champs cibles reliés à un objet entier sur sa structure. Rend les nœuds cibles à
 * modifier : Map id → `{ fields, mirror }` (`mirror` : la cible entière est reprise). Une cible ou un champ qui
 * n'est plus relié à un objet entier garde ses champs, redevenus modifiables.
 */
export function syncMirrors(nodes, edges) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const incoming = new Map(edges.map((e) => [`${e.target}:${e.targetHandle}`, e]));
  const changes = new Map();
  for (const n of nodes) {
    if (n.type !== 'target' || !n.data?.fields) continue;
    const walk = (fields) =>
      fields.map((f) => {
        if (!isContainer(f)) return f;
        const e = incoming.get(`${n.id}:${f.id}`);
        const struct = e && structureOf(byId, incoming, e.source, e.sourceHandle);
        if (struct) return { ...f, mirror: true, children: mirrorOf(f.id, struct, f.children) };
        const { mirror: _, ...rest } = f;
        return { ...rest, children: walk(f.children ?? []) };
      });
    const root = incoming.get(`${n.id}:${SOURCE_DOC}`);
    const struct = root && structureOf(byId, incoming, root.source, root.sourceHandle);
    // Cible entière reprise : les champs de la source d'abord, puis ceux propres à la cible.
    const next = struct
      ? [...mirrorOf(SOURCE_DOC, struct, n.data.fields), ...walk(n.data.fields.filter((f) => !isRootCopy(f)))]
      : walk(n.data.fields);
    const mirror = !!struct;
    if (mirror !== !!n.data.mirror || JSON.stringify(next) !== JSON.stringify(n.data.fields)) changes.set(n.id, { fields: next, mirror });
  }
  return changes;
}

/** Champ d'une cible repris de la source reliée à la cible entière (ou l'ayant été). */
export const isRootCopy = (f) => f.id.startsWith(`${SOURCE_DOC}${SEP}`);

/** Ids des champs repris d'un objet entier (en lecture seule) dans une cible. */
export const mirroredIds = (data) =>
  new Set(
    allFields(data.fields).flatMap((f) => [
      ...(data.mirror && isRootCopy(f) ? [f.id] : []),
      ...(f.mirror ? allFields(f.children ?? []).map((c) => c.id) : []),
    ]),
  );

/** Applique à des données de nœud un changement rendu par `syncMirrors`. */
export function withMirror(data, { fields, mirror }) {
  const { mirror: _, ...rest } = data;
  return { ...rest, fields, ...(mirror && { mirror: true }) };
}

/** Champs sans la marque `mirror` (champs d'un modèle composite : une copie n'est reliée à rien). */
export const unmirror = (fields) =>
  fields.map(({ mirror: _, ...f }) => (f.children ? { ...f, children: unmirror(f.children) } : f));
