/**
 * Documentation des nœuds, affichée sur la page « Nœuds ». Les entrées, sorties et réglages sont
 * lus dans les définitions (transforms.js) : ici, seulement ce qu'elles ne disent pas.
 * `summary` : une phrase ; `details` : précisions ; `example` : `{ in, out }` ; `guarantee` : ce que
 * le nœud garantit au contrôle des champs cibles.
 */
export const NODE_DOCS = {
  // ── Entrée ──────────────────────────────────────────────
  const_string: {
    summary: 'Fournit un texte fixe, saisi dans le nœud.',
    example: { in: 'Valeur = « FR »', out: '"FR"' },
  },
  const_number: {
    summary: 'Fournit un nombre fixe. La virgule est acceptée comme séparateur décimal.',
    example: { in: 'Valeur = « 19,6 »', out: '19.6' },
  },
  const_bool: {
    summary: 'Fournit vrai ou faux.',
  },
  now: {
    summary: 'Date et heure au moment de l’évaluation.',
    details: ['La valeur change à chaque recalcul : à utiliser pour des dates d’export, pas pour des comparaisons stables.'],
  },

  // ── Structure ───────────────────────────────────────────
  current: {
    summary: 'Élément (et son index, à partir de 0) de la liste en cours de parcours.',
    details: [
      'À brancher sur une entrée « pour chaque élément » (∀) d’un nœud de liste, ou dans un tableau cible itéré : il vaut alors l’élément traité.',
      'Hors de toute itération, l’élément est vide et l’index vaut 0.',
    ],
  },
  get_field: {
    summary: 'Lit une valeur dans un objet à partir d’un chemin pointé.',
    details: ['Les segments numériques désignent un index de tableau : « lignes.0.sku ».', 'Un chemin introuvable donne une valeur vide.'],
    example: { in: 'Objet = { client: { nom: "Ada" } }, Chemin = « client.nom »', out: '"Ada"' },
  },
  set_field: {
    summary: 'Ajoute ou remplace une clé dans un objet, ou dans chaque objet d’une liste.',
    details: [
      'Le chemin peut être pointé (« adresse.ville ») : les objets intermédiaires sont créés.',
      'Sur une liste, la valeur est évaluée pour chaque objet : branchez « Élément courant » ou un champ source pour donner à chacun sa propre valeur.',
    ],
    example: { in: 'Objet = { id: 1 }, Clé = « actif », Valeur = vrai', out: '{ id: 1, actif: true }' },
  },
  remove_field: {
    summary: 'Retire une ou plusieurs clés d’un objet, ou de chaque objet d’une liste.',
    details: ['Clés séparées par des virgules ; un chemin pointé retire une clé imbriquée (« adresse.cp »).'],
    example: { in: 'Objet = { id: 1, interne: "x" }, Clés = « interne »', out: '{ id: 1 }' },
  },
  list_create: {
    summary: 'Construit une liste à partir de ses entrées A, B et C.',
    details: ['Seules les entrées reliées comptent.', 'Une entrée qui reçoit déjà une liste est aplatie : ses éléments sont ajoutés un à un.'],
    example: { in: 'A = "x", B = ["y", "z"]', out: '["x", "y", "z"]' },
  },

  // ── Liste ───────────────────────────────────────────────
  list_filter: {
    summary: 'Garde les éléments pour lesquels la condition est vraie.',
    details: ['La condition (∀) est évaluée pour chaque élément : construisez-la à partir des champs de l’élément, ex. Comparer(statut, « paid »).'],
    example: { in: '[1, 5, 8], Garder si = élément > 4', out: '[5, 8]' },
  },
  list_sort: {
    summary: 'Trie la liste, croissant ou décroissant.',
    details: [
      'Sans clé, les éléments eux-mêmes sont comparés ; avec une clé (∀), c’est elle qui est comparée, ex. la date de chaque commande.',
      'Deux valeurs numériques sont comparées comme des nombres, sinon comme des textes (ordre alphabétique).',
    ],
  },
  list_map: {
    summary: 'Remplace chaque élément par la valeur calculée pour lui.',
    details: ['La valeur (∀) est évaluée pour chaque élément ; le résultat a autant d’éléments que la liste d’origine.'],
    example: { in: '[{ qty: 2, price: 5 }, { qty: 1, price: 3 }], Valeur = qty × price', out: '[10, 3]' },
  },
  list_at: {
    summary: 'Prend l’élément à un index donné, depuis le début ou depuis la fin.',
    details: [
      'L’index commence à 0 : depuis la fin, 0 désigne le dernier élément.',
      'Si « Valeur » (∀) est reliée, on obtient la valeur calculée pour cet élément plutôt que l’élément entier.',
      'Hors limites : valeur vide.',
    ],
    example: { in: '["a", "b", "c"], Index = 0, Depuis = Fin', out: '"c"' },
  },
  list_find: {
    summary: 'Premier élément qui vérifie la condition.',
    details: ['« Trouvé » indique si un élément a été trouvé ; sinon l’élément est vide.', 'Si « Valeur » (∀) est reliée, on obtient la valeur calculée pour l’élément trouvé.'],
  },
  list_count: {
    summary: 'Nombre d’éléments de la liste.',
    example: { in: '["a", "b"]', out: '2' },
  },
  list_aggregate: {
    summary: 'Somme, moyenne, minimum ou maximum des éléments.',
    details: ['Sans « Valeur », les éléments sont convertis en nombres ; avec « Valeur » (∀), c’est elle qui est agrégée, ex. qty × price.', 'Une liste vide donne 0.'],
    example: { in: '[2, 4, 9], Opération = Moyenne', out: '5' },
  },
  list_test: {
    summary: 'Vrai si au moins un, tous, ou aucun des éléments vérifie la condition.',
    details: ['Sur une liste vide : « Tous » et « Aucun » sont vrais, « Au moins un » est faux.'],
  },
  list_slice: {
    summary: 'Extrait une partie de la liste : « Nombre » éléments à partir de « Début » (index 0).',
    example: { in: '[a, b, c, d], Début = 1, Nombre = 2', out: '[b, c]' },
  },
  list_reverse: {
    summary: 'Inverse l’ordre des éléments.',
  },
  list_unique: {
    summary: 'Retire les doublons en gardant la première occurrence.',
    details: ['Avec une clé (∀), deux éléments sont des doublons s’ils ont la même clé, ex. le même email.'],
    example: { in: '["a", "b", "a"]', out: '["a", "b"]' },
  },
  list_join: {
    summary: 'Assemble une liste de textes en un seul texte, avec un séparateur.',
    example: { in: '["vip", "newsletter"], Séparateur = « , »', out: '"vip, newsletter"' },
  },

  // ── Texte ───────────────────────────────────────────────
  concat: {
    summary: 'Met bout à bout A, B et C, séparés par le séparateur.',
    details: ['Les entrées vides sont ignorées : pas de séparateur en double.'],
    example: { in: 'A = "Ada", B = "Lovelace", Séparateur = espace', out: '"Ada Lovelace"' },
    guarantee: 'Longueur max. = somme des longueurs max. des entrées + séparateurs (si toutes sont bornées). Obligatoire dès qu’une entrée l’est.',
  },
  case: {
    summary: 'Met le texte en MAJUSCULES, en minuscules, ou capitalise chaque mot.',
    details: ['« Capitaliser » met une majuscule après une espace, un tiret ou une apostrophe : « jean-luc » → « Jean-Luc ».'],
    guarantee: 'Conserve les longueurs min. et max. de l’entrée.',
  },
  trim: {
    summary: 'Retire les espaces au début et à la fin, et réduit les espaces multiples à un seul.',
    example: { in: '"  Ada   Lovelace "', out: '"Ada Lovelace"' },
    guarantee: 'Conserve la longueur max. de l’entrée.',
  },
  substring: {
    summary: 'Garde les N premiers caractères (Gauche), les N derniers (Droite), ou N caractères à partir d’une position (Milieu).',
    details: [
      'En mode Milieu, « Début » commence à 1 (comme STXT / MID). Il est ignoré dans les autres modes.',
      'Un texte plus court est rendu en entier ; un emoji ou une lettre accentuée compte pour un caractère.',
    ],
    example: { in: '"FR76-3000-6000", Mode = Gauche, Nb car. = 4', out: '"FR76"' },
    guarantee: 'Longueur max. = min(Nb car., longueur max. de l’entrée). En Gauche / Droite, longueur min. = min(Nb car., longueur min. de l’entrée).',
  },
  replace: {
    summary: 'Remplace toutes les occurrences d’un texte par un autre.',
    details: ['Recherche littérale, sensible à la casse (pas d’expression régulière).', 'Laisser « Par » vide supprime le texte cherché.'],
    example: { in: '"06 12 34", Chercher = espace, Par = (vide)', out: '"061234"' },
  },
  split: {
    summary: 'Découpe le texte selon un séparateur et garde le morceau à l’index donné.',
    details: ['L’index commence à 0 ; un index négatif compte depuis la fin (-1 = dernier morceau).', 'Index hors limites : texte vide.'],
    example: { in: '"Ada Lovelace", Séparateur = espace, Index = 1', out: '"Lovelace"' },
  },
  split_list: {
    summary: 'Découpe le texte en liste selon un séparateur ; chaque morceau est nettoyé de ses espaces.',
    example: { in: '"a, b ,c"', out: '["a", "b", "c"]' },
  },
  length: {
    summary: 'Nombre de caractères du texte.',
    guarantee: 'Entier, entre les longueurs min. et max. de l’entrée.',
  },

  // ── Math ────────────────────────────────────────────────
  math: {
    summary: 'Opération entre deux nombres A et B.',
    details: ['Division par 0 : résultat infini (ou invalide pour 0 / 0).', 'Modulo : reste de la division de A par B.'],
    example: { in: 'A = 7, B = 2, Opération = Modulo', out: '1' },
  },
  round: {
    summary: 'Arrondit au plus proche, à l’inférieur (plancher) ou au supérieur (plafond), avec un nombre de décimales.',
    example: { in: '12.346, Mode = Arrondi, Décimales = 2', out: '12.35' },
  },

  // ── Logique ─────────────────────────────────────────────
  compare: {
    summary: 'Compare A et B ; résultat vrai ou faux.',
    details: [
      'Si A et B ressemblent à des nombres, ils sont comparés comme des nombres (« 10 » > « 9 ») ; sinon comme des textes.',
      '« contient » et « commence par » travaillent sur le texte, en respectant la casse.',
    ],
    example: { in: 'A = statut, B = « paid », Opérateur = « = »', out: 'vrai si le statut vaut paid' },
  },
  logic: {
    summary: 'Combine deux booléens : ET, OU, OU exclusif.',
  },
  not: {
    summary: 'Inverse un booléen.',
  },
  switch: {
    summary: 'Renvoie « Si vrai » quand la condition est vraie, sinon « Si faux ».',
    example: { in: 'Condition = âge ≥ 18, Si vrai = « majeur », Si faux = « mineur »', out: '"majeur"' },
  },
  coalesce: {
    summary: 'Renvoie la valeur, ou la valeur par défaut si elle est vide.',
    details: ['Est considéré comme vide : absent, null, texte vide, date invalide. 0 et faux ne sont pas vides.'],
    example: { in: 'Valeur = "", Défaut = « inconnu »', out: '"inconnu"' },
  },

  // ── Conversion ──────────────────────────────────────────
  to_string: {
    summary: 'Convertit une valeur en texte.',
    details: ['Une date devient un texte ISO 8601, un objet ou une liste son JSON.'],
  },
  to_number: {
    summary: 'Convertit une valeur en nombre.',
    details: ['La virgule décimale est acceptée (« 3,5 » → 3.5). Vrai → 1, faux → 0, une date → son timestamp en ms.', 'Texte vide → 0 ; texte non numérique → invalide.'],
  },
  to_bool: {
    summary: 'Convertit une valeur en booléen.',
    details: ['Textes vrais : true, 1, oui, yes, vrai, y, o, x (sans tenir compte de la casse). Tout le reste est faux.', 'Nombre : vrai s’il est différent de 0.'],
  },

  // ── Date ────────────────────────────────────────────────
  date_format: {
    summary: 'Écrit une date sous forme de texte dans le format choisi.',
    details: ['Calculé en UTC.', 'Date invalide : texte vide.'],
    example: { in: '2026-09-14, Format = JJ/MM/AAAA', out: '"14/09/2026"' },
  },
  date_part: {
    summary: 'Extrait l’année, le mois (1–12), le jour du mois ou le jour de la semaine.',
    details: ['Jour de la semaine : 0 = dimanche, 1 = lundi … 6 = samedi.', 'Calculé en UTC.'],
  },
  age: {
    summary: 'Nombre d’années révolues entre la date et la référence.',
    details: ['Sans référence (ou référence invalide), la date du jour est utilisée.'],
    example: { in: 'Date = 1990-06-15, Référence = 2026-06-14', out: '35' },
  },
};

/** Nœuds de structure, hors transformations. */
export const BASE_NODES = [
  {
    kind: 'source',
    label: 'Source',
    color: 'source',
    summary: 'Décrit les données d’entrée : un arbre de champs, et un JSON d’exemple qui sert à prévisualiser le résultat.',
    details: [
      'Chaque champ a un socket de sortie. Sous un tableau, un champ produit la liste de ses valeurs (losange), sauf quand ce tableau est en cours de parcours.',
      'Le bouton { } édite le JSON d’exemple ; enregistrer met la structure à jour (les champs retrouvés par leur nom gardent leurs liens).',
      'Règles : * rend un champ obligatoire, ⚙ définit son format. Elles servent à contrôler les champs cibles qu’il alimente.',
    ],
  },
  {
    kind: 'target',
    label: 'Cible',
    color: 'target',
    summary: 'Décrit le document à produire. Chaque champ reçoit une valeur par un lien ; l’aperçu montre le JSON obtenu.',
    details: [
      'Relier une liste à un tableau d’objets le parcourt : ses sous-champs sont évalués pour chaque élément.',
      'Sans lien sur le tableau, la première liste source reliée à un de ses sous-champs dicte le parcours.',
      'Un objet relié à un objet source le recopie ; les sous-champs reliés y remplacent leurs valeurs.',
      'Contrôles : ⛔ obligatoire non mappé ; ⚠ obligatoire alimenté par une source optionnelle ; ⚠ format non garanti. Détail dans l’onglet Contrôles de l’aperçu.',
    ],
  },
  {
    kind: 'group',
    label: 'Groupe',
    color: 'group',
    summary: 'Cadre qui range des nœuds. Sans effet sur le calcul.',
    details: ['Ctrl G groupe la sélection. Glisser un nœud dans le cadre l’y range, hors du cadre l’en sort.', 'Replié, le groupe se réduit à son en-tête et les liens de ses nœuds y aboutissent. Le supprimer garde ses nœuds.'],
  },
];
