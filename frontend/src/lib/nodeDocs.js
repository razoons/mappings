/**
 * Documentation des nœuds, affichée sur la page « Nœuds ». Les entrées, sorties et réglages sont
 * lus dans les définitions (transforms.js) : ici, seulement ce qu'elles ne disent pas.
 * `summary` : une phrase ; `details` : précisions ; `guarantee` : ce que
 * le nœud garantit au contrôle des champs cibles.
 */
export const NODE_DOCS = {
  // ── Entrée ──────────────────────────────────────────────
  const_string: {
    summary: 'Fournit un texte fixe, saisi dans le nœud.',
  },
  const_number: {
    summary: 'Fournit un nombre fixe. La virgule est acceptée comme séparateur décimal.',
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
    details: ['Un index entre crochets désigne un élément de tableau : « lignes[0].sku ».', 'Un chemin introuvable donne une valeur vide.'],
  },
  set_field: {
    summary: 'Ajoute ou remplace une clé dans un objet, ou dans chaque objet d’une liste.',
    details: [
      'Le chemin peut être pointé (« adresse.ville ») : les objets intermédiaires sont créés.',
      'Sur une liste, la valeur est évaluée pour chaque objet : branchez « Élément courant » ou un champ source pour donner à chacun sa propre valeur.',
    ],
  },
  remove_field: {
    summary: 'Retire une ou plusieurs clés d’un objet, ou de chaque objet d’une liste.',
    details: ['Clés séparées par des virgules ; un chemin pointé retire une clé imbriquée (« adresse.cp »).'],
  },
  list_create: {
    summary: 'Construit une liste à partir de ses entrées A, B, C…',
    details: [
      'Autant d’entrées que nécessaire : dès qu’une entrée est reliée ou remplie, une nouvelle entrée libre apparaît en dessous.',
      'Les entrées reliées et les valeurs saisies comptent, dans l’ordre ; une entrée vide est ignorée.',
      'Une entrée qui reçoit déjà une liste est aplatie : ses éléments sont ajoutés un à un.',
    ],
  },

  // ── Liste ───────────────────────────────────────────────
  list_filter: {
    summary: 'Garde les éléments pour lesquels la condition est vraie.',
    details: ['La condition (∀) est évaluée pour chaque élément : construisez-la à partir des champs de l’élément, ex. Comparer(statut, « paid »).'],
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
  },
  list_at: {
    summary: 'Prend l’élément à un index donné, depuis le début ou depuis la fin.',
    details: [
      'L’index commence à 0 : depuis la fin, 0 désigne le dernier élément.',
      'Si « Valeur » (∀) est reliée, on obtient la valeur calculée pour cet élément plutôt que l’élément entier.',
      'Hors limites : valeur vide.',
    ],
  },
  list_find: {
    summary: 'Premier élément qui vérifie la condition.',
    details: ['« Trouvé » indique si un élément a été trouvé ; sinon l’élément est vide.', 'Si « Valeur » (∀) est reliée, on obtient la valeur calculée pour l’élément trouvé.'],
  },
  list_count: {
    summary: 'Nombre d’éléments de la liste.',
  },
  list_aggregate: {
    summary: 'Somme, moyenne, minimum ou maximum des éléments.',
    details: ['Sans « Valeur », les éléments sont convertis en nombres ; avec « Valeur » (∀), c’est elle qui est agrégée, ex. qty × price.', 'Une liste vide donne 0.'],
  },
  list_test: {
    summary: 'Vrai si au moins un, tous, ou aucun des éléments vérifie la condition.',
    details: ['Sur une liste vide : « Tous » et « Aucun » sont vrais, « Au moins un » est faux.'],
  },
  list_slice: {
    summary: 'Extrait une partie de la liste : « Nombre » éléments à partir de « Début » (index 0).',
  },
  list_reverse: {
    summary: 'Inverse l’ordre des éléments.',
  },
  list_unique: {
    summary: 'Retire les doublons en gardant la première occurrence.',
    details: ['Avec une clé (∀), deux éléments sont des doublons s’ils ont la même clé, ex. le même email.'],
  },
  list_join: {
    summary: 'Assemble une liste de textes en un seul texte, avec un séparateur.',
  },

  // ── Texte ───────────────────────────────────────────────
  concat: {
    summary: 'Met bout à bout ses entrées A, B, C…, séparées par le séparateur. Le nombre d’entrées est libre : une entrée vide apparaît toujours en bas pour en ajouter une.',
    details: ['Les entrées vides sont ignorées : pas de séparateur en double.'],
    guarantee: 'Longueur max. = somme des longueurs max. des entrées + séparateurs (si toutes sont bornées). Obligatoire dès qu’une entrée l’est.',
  },
  case: {
    summary: 'Met le texte en MAJUSCULES, en minuscules, ou capitalise chaque mot.',
    details: ['« Capitaliser » met une majuscule après une espace, un tiret ou une apostrophe : « jean-luc » → « Jean-Luc ».'],
    guarantee: 'Conserve les longueurs min. et max. de l’entrée.',
  },
  trim: {
    summary: 'Retire les espaces au début et à la fin, et réduit les espaces multiples à un seul.',
    guarantee: 'Conserve la longueur max. de l’entrée.',
  },
  substring: {
    summary: 'Garde les N premiers caractères (Gauche), les N derniers (Droite), ou N caractères à partir d’une position (Milieu).',
    details: [
      'En mode Milieu, « Début » commence à 1 (comme STXT / MID). Il est ignoré dans les autres modes.',
      'Un texte plus court est rendu en entier ; un emoji ou une lettre accentuée compte pour un caractère.',
    ],
    guarantee: 'Longueur max. = min(Nb car., longueur max. de l’entrée). En Gauche / Droite, longueur min. = min(Nb car., longueur min. de l’entrée).',
  },
  replace: {
    summary: 'Remplace toutes les occurrences d’un texte par un autre.',
    details: ['Recherche littérale, sensible à la casse (pas d’expression régulière).', 'Laisser « Par » vide supprime le texte cherché.'],
  },
  split: {
    summary: 'Découpe le texte selon un séparateur et garde le morceau à l’index donné.',
    details: ['L’index commence à 0 ; un index négatif compte depuis la fin (-1 = dernier morceau).', 'Index hors limites : texte vide.'],
  },
  split_list: {
    summary: 'Découpe le texte en liste selon un séparateur ; chaque morceau est nettoyé de ses espaces.',
  },
  length: {
    summary: 'Nombre de caractères du texte.',
    guarantee: 'Entier, entre les longueurs min. et max. de l’entrée.',
  },

  // ── Math ────────────────────────────────────────────────
  math: {
    summary: 'Opération entre deux nombres A et B.',
    details: ['Division par 0 : résultat infini (ou invalide pour 0 / 0).', 'Modulo : reste de la division de A par B.'],
  },
  round: {
    summary: 'Arrondit au plus proche, à l’inférieur (plancher) ou au supérieur (plafond), avec un nombre de décimales.',
  },

  // ── Logique ─────────────────────────────────────────────
  compare: {
    summary: 'Compare A et B ; résultat vrai ou faux.',
    details: [
      'Si A et B ressemblent à des nombres, ils sont comparés comme des nombres (« 10 » > « 9 ») ; sinon comme des textes.',
      '« contient » et « commence par » travaillent sur le texte, en respectant la casse.',
    ],
  },
  logic: {
    summary: 'Combine deux booléens : ET, OU, OU exclusif.',
  },
  not: {
    summary: 'Inverse un booléen.',
  },
  switch: {
    summary: 'Renvoie « Si vrai » quand la condition est vraie, sinon « Si faux ».',
  },
  coalesce: {
    summary: 'Renvoie la valeur, ou la valeur par défaut si elle est vide.',
    details: ['Est considéré comme vide : absent, null, texte vide, date invalide. 0 et faux ne sont pas vides.'],
  },

  // ── Conversion ──────────────────────────────────────────
  to_string: {
    summary: 'Convertit une valeur en texte.',
    details: ['Une date devient un texte ISO 8601, un objet ou une liste son JSON.'],
  },
  to_number: {
    summary: 'Convertit une valeur en nombre (décimal).',
    details: ['La virgule décimale est acceptée (« 3,5 » → 3.5). Vrai → 1, faux → 0, une date → son timestamp en ms.', 'Texte vide → 0 ; texte non numérique → invalide.'],
  },
  to_integer: {
    summary: 'Convertit un nombre en entier : tronqué (partie entière), arrondi, plancher ou plafond.',
    details: ['Tronquer et Plancher diffèrent pour les négatifs : -2.7 → -2 (tronqué), -3 (plancher).', 'À placer devant un champ cible Entier alimenté par un nombre décimal : la conversion devient explicite et n’est plus signalée.'],
  },
  transcode: {
    summary: 'Traduit une valeur d’un référentiel à un autre (FRA → FR) avec la table de correspondance d’une bibliothèque.',
    details: [
      'Table : la sortie Table d’une bibliothèque dont la case « Table de correspondance » est cochée. Une même bibliothèque peut alimenter plusieurs Transcoder.',
      'Valeur absente de la table (ou sans correspondance) : la sortie vaut « Si absente », ou rien si elle est vide. Branchez-y la valeur d’origine pour la garder telle quelle.',
      'Sur une liste, chaque élément est traduit.',
      'La sortie a le type de la colonne Correspondance.',
      'Garanties : si la valeur vient d’un champ lié à la même bibliothèque (ou dont toutes les valeurs ont une correspondance), la sortie fait partie des correspondances ; sinon elle peut aussi valoir « Si absente ». Une cible liée à une bibliothèque qui contient toutes ces valeurs n’est donc pas signalée.',
    ],
  },
  to_bool: {
    summary: 'Convertit une valeur en booléen.',
    details: ['Textes vrais : true, 1, oui, yes, vrai, y, o, x (sans tenir compte de la casse). Tout le reste est faux.', 'Nombre : vrai s’il est différent de 0.'],
  },

  // ── Date ────────────────────────────────────────────────
  date_format: {
    summary: 'Écrit une date sous forme de texte dans le format choisi.',
    details: ['Calculé en UTC.', 'Date invalide : texte vide.'],
  },
  date_part: {
    summary: 'Extrait l’année, le mois, le jour du mois ou le jour de la semaine : en nombre et en nom.',
    details: [
      'Nombre : mois de 1 à 12 ; jour de la semaine 0 = dimanche, 1 = lundi … 6 = samedi.',
      'Nom (texte) : le jour de la semaine ou le mois, pris dans la liste saisie dans le nœud, séparée par des virgules : les 7 jours du lundi au dimanche (réglage Jours), ou les 12 mois de janvier à décembre (réglage Mois). Au choix : « lun, mar, mer… », « Monday, Tuesday… », « L, M, M, J, V, S, D »… Pour l’année et le jour du mois, c’est le nombre en texte.',
      'Un nom absent de la liste donne un texte vide.',
      'Calculé en UTC.',
    ],
  },
  age: {
    summary: 'Nombre d’années révolues entre la date et la référence.',
    details: ['Sans référence (ou référence invalide), la date du jour est utilisée.'],
  },
};

/** Nœuds de structure, hors transformations. */
export const BASE_NODES = [
  {
    kind: 'source',
    label: 'Source',
    color: 'source',
    summary: 'Décrit les données d’entrée : son modèle de données (champs, types, caractère obligatoire et formats).',
    details: [
      'Chaque champ a un socket de sortie. Sous un tableau, un champ produit la liste de ses valeurs (losange), sauf quand ce tableau est en cours de parcours.',
      'Le bouton { } édite le modèle de données en YAML (type, obligatoire, format et exemple de chaque champ, mots-clés français ou anglais) ; « Importer un exemple JSON » le déduit d’un document. Les champs retrouvés par leur nom gardent leurs liens. Les exemples servent au calcul tant qu’aucun fichier de données n’est chargé ; une liste d’objets peut recevoir la liste complète en exemple.',
      'Un fichier de données déposé sur le nœud (ou chargé par ⤒) remplace les valeurs du modèle pour le calcul, sans changer le modèle. Il est contrôlé : ⛔ obligatoire absent, type ou format non respecté ; ⚠ champ en trop. Il n’est pas enregistré avec le mapping.',
      'Règles : * rend un champ obligatoire, ⚙ définit son format. Elles servent à contrôler les champs cibles qu’il alimente.',
    ],
  },
  {
    kind: 'target',
    label: 'Cible',
    color: 'target',
    summary: 'Décrit le document à produire. Chaque champ reçoit une valeur par un lien ; la colonne Valeur montre celle obtenue avec les données des sources.',
    details: [
      'Le bouton Résultat montre le JSON produit (avec les fichiers de données chargés, sinon les valeurs des modèles de données), sa conformité au modèle de la cible, et permet de le copier ou de l’exporter.',
      'Relier une liste à un tableau d’objets le parcourt : ses sous-champs sont évalués pour chaque élément.',
      'Sans lien sur le tableau, la première liste source reliée à un de ses sous-champs dicte le parcours.',
      'Un objet relié à un objet source le recopie ; les sous-champs reliés y remplacent leurs valeurs.',
      'Contrôles : ⛔ obligatoire non mappé ; ⛔ types incompatibles ; ⚠ type converti implicitement ; ⚠ obligatoire alimenté par une source optionnelle ; ⚠ format non garanti. Détail dans le panneau Contrôles.',
    ],
  },
  {
    kind: 'library',
    label: 'Bibliothèque',
    color: 'library',
    summary: 'Liste de valeurs autorisées (textes, entiers, nombres ou dates), partagée par les champs qui s’y réfèrent.',
    details: [
      'Un champ de source ou de cible s’y réfère dans ses règles (⚙ › Valeurs autorisées) : sa valeur — ou chaque élément d’une liste — doit faire partie de la bibliothèque. Plusieurs champs, dans des nœuds différents, peuvent partager la même bibliothèque ; la modifier les met tous à jour. En YAML : « bibliothèque: Pays ».',
      'Saisie : une valeur par ligne du nœud (Entrée pour ajouter), ou toutes à la fois avec ≡ (une par ligne). Les doublons sont ignorés. Changer le type convertit les valeurs et retire celles qui ne s’y prêtent pas.',
      'Contrôles : ⛔ une valeur hors bibliothèque dans un fichier de données, un exemple ou le résultat d’une cible ; ⚠ un champ cible alimenté par une source qui ne garantit pas ces valeurs (la source doit se référer à la même bibliothèque, ou à une bibliothèque dont toutes les valeurs y figurent) ; ⚠ une bibliothèque supprimée.',
      'La sortie Valeurs donne la liste, à brancher sur une transformation de liste (Trouver, Tester les éléments…) ou sur une liste cible.',
      'Table de correspondance (case à cocher) : chaque valeur reçoit une correspondance dans un autre référentiel (FRA → FR), avec son propre type. La sortie Table alimente le nœud Transcoder. En bloc (≡) : « valeur ; correspondance » par ligne, ou un copier-coller de deux colonnes de tableur.',
      'Pour une source, l’exemple d’un champ qui a une bibliothèque se choisit dans une liste déroulante.',
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
