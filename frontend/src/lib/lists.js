/**
 * Une liste qui circule dans le graphe garde la trace des éléments source dont chacun de ses items provient
 * (clé = `nœudSource:champTableau`). Quand on itère dessus, ces liaisons rendent les champs `orders[].x`
 * relatifs à l'élément courant, même après un filtre, un tri ou une transformation.
 */
const LIST_BINDS = new WeakMap();

export function tagList(items, binds) {
  if (binds) LIST_BINDS.set(items, binds);
  return items;
}

export const bindsOf = (list) => (Array.isArray(list) ? LIST_BINDS.get(list) : undefined);

/** Sous-liste (filtre, tri, tranche…) qui conserve les liaisons des items retenus. */
export function pickItems(list, indexes) {
  const b = bindsOf(list);
  return tagList(
    indexes.map((i) => list[i]),
    b && indexes.map((i) => b[i]),
  );
}

export const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);
