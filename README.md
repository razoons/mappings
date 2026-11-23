# ScheMap — éditeur nodal

Éditeur visuel de mappings JSON : on relie les champs d'une **source** (son modèle de données : champs, types, caractère obligatoire et formats) à ceux d'une **cible**, en passant si besoin par des nœuds de transformation (texte, math, logique, listes, dates…). Chaque champ affiche sa valeur (celle du modèle de données, ou d’un fichier de données déposé sur la source), et le panneau **Contrôles** vérifie le mapping en direct.

Application 100 % navigateur (aucun serveur), déployée sur **Firebase Hosting** : Vue 3 + Vite + Vuetify + [Vue Flow](https://vueflow.dev).

---

## Utilisation

| Action | Comment |
|---|---|
| Ajouter un nœud | Bouton **Ajouter**, `Shift A` ou clic droit sur le fond |
| Relier | Glisser d'un socket à l'autre ; lâché dans le vide, le lien propose de créer le nœud à raccorder |
| Délier | Attraper l'extrémité d'un lien et la lâcher dans le vide |
| Modèle de données d'une source / cible | Bouton `{ }` de l'en-tête : le modèle en YAML (voir ci-dessous), ou édition directe des champs (glisser `⋮⋮` pour les déplacer) |
| Replier, supprimer | Clic droit sur un nœud (agit sur toute la sélection) ; `Suppr` |
| Réorganiser | Bouton de la barre d’outils : les nœuds sont rangés en colonnes dans le sens des liens (sources → transformations → cibles), en limitant les croisements ; un groupe garde ses nœuds ensemble, un nœud verrouillé ne bouge pas ; « Annuler » dans le message remet les positions d’avant |
| Survol d’un lien | Un bouton « + » apparaît au milieu : il ouvre le menu d’ajout, limité aux nœuds qui peuvent s’intercaler sur ce lien. Une pastille marque chaque extrémité : la saisir pour changer le point d’accroche (y compris à l’intérieur d’un groupe, dont seul l’en-tête capte la souris). |
| Insérer sur un lien | Glisser un nœud de transformation encore libre (sans lien) sur un lien : le lien s’éclaire en orange, lâcher intercale le nœud (entrée et sortie choisies selon les types). |
| Dupliquer | « Dupliquer » au clic droit ou `Ctrl D` : la copie (avec les liens internes à la sélection ; un groupe avec ses nœuds) suit la souris, un clic gauche la dépose — dans un groupe si on clique dessus ; `Échap` ou clic droit annule |
| Annuler / rétablir | `Ctrl Z` annule la dernière action (jusqu’à 20 en arrière), `Ctrl Y` ou `Ctrl Shift Z` la rétablit. Dans un champ de saisie, ces raccourcis agissent sur le texte. |
| Grouper | `Ctrl G` sur la sélection, « Grouper » au clic droit, ou « Groupe » dans le menu d’ajout. Glisser un nœud dans / hors d’un cadre l’y range / l’en sort (c’est le pointeur au lâcher qui compte). Le cadre s’ajuste tout seul à ses nœuds : il grandit ou rétrécit quand on les déplace, les replie ou les modifie. Replié, un groupe se réduit à son en-tête et ses liens y aboutissent. Supprimer un groupe garde ses nœuds. La pastille de l’en-tête choisit sa couleur. |

**Exporter en image** (menu `⋯` d’un mapping dans le panneau des collections) enregistre une image PNG de tout le schéma (pas seulement la partie visible), sur le fond du thème courant ; le mapping est ouvert s’il ne l’était pas.

**Collections** (panneau de gauche, à la manière de Postman ; le bouton tout à gauche de la barre d’outils l’affiche ou le masque) : les mappings sont rangés dans des collections, éventuellement dans des dossiers imbriqués. Un clic ouvre un mapping : celui qu’on quitte est conservé tel quel. Le menu `⋯` (ou clic droit) d’un élément propose nouveau mapping, nouveau dossier, renommer (aussi par double-clic), dupliquer, exporter et supprimer. On réorganise par glisser-déposer : sur un dossier ou une collection, l’élément y entre ; sur un mapping, il se place juste avant. Le champ **Filtrer** cherche dans les noms. Toutes les collections sont conservées dans le navigateur ; un avertissement s’affiche si son espace de stockage est plein.

Onglet **Mappings** du panneau : trois boutons à côté du filtre, **nouveau dossier** (une collection), **nouveau mapping** (ajouté à côté de celui qui est ouvert) et **importer**. **Démo** (barre d’outils) installe, sans rien effacer, la pizzeria « La Bonne Pâte » : dans la bibliothèque, un dossier « Démo » avec la liste « Carte », deux modèles simples (« Commande en ligne », « Fichier fidélité ») et le modèle composite « Commande fidélité » (la commande, plus les points du client retrouvé par son email) ; dans les mappings, un dossier « Démo » avec le mapping « Démo » (10 nœuds), qui fait de la commande fidélité le bon de livraison. Un nouveau mapping (bouton du panneau ou menu d’une collection / d’un dossier) se nomme aussitôt, dans le panneau (Entrée valide). Le nom d’un mapping se change dans le panneau (double-clic ou menu › Renommer) : la barre d’outils n’en a plus. Le bouton d’import du panneau importe un fichier `.json` choisi dans l’explorateur : un mapping seul est ajouté à côté du mapping ouvert, une collection est ajoutée à la liste. Si une collection du même nom existe déjà (sans tenir compte des majuscules), l’application propose de la **remplacer** (à la même place) ou de **garder les deux**. Le menu `⋯` exporte un mapping seul, une collection, ou un dossier (exporté comme une collection) . Les exports sont téléchargés.

**Ouvrir / Télécharger** (barre d’outils, comme un document) : le travail entier — toutes les collections et toute la bibliothèque — tient dans un fichier (`{ "format": "schemap-workspace", "version": 1, "savedAt", "collections", "library", "activeId" }`), dont le nom s’affiche en haut (● : modifié depuis la dernière sauvegarde ; aussi dans le titre de l’onglet).

- **Ouvrir** (`Ctrl O`) : un fichier sauvegardé remplace les collections et la bibliothèque (accord demandé si le travail n’est pas sauvegardé) et devient le fichier ouvert. Un mapping, une collection ou un export de la bibliothèque s’ajoute, comme avec l’import du panneau.
- **Télécharger** (`Ctrl S`) : télécharge le fichier sous son nom (ou `schemap.json`) ; il devient le fichier ouvert. Dans l’éditeur de la bibliothèque, `Ctrl S` enregistre le modèle ou la liste ouvert (`Ctrl Maj S` télécharge).
- **Nom du fichier** : un clic sur le nom affiché en haut permet de le changer avant de télécharger (`.json` est ajouté s’il manque).
- **Mapping affiché** : son nom, précédé de sa collection et de ses dossiers, s’affiche dans la barre d’outils.
- L’import du panneau accepte aussi un fichier sauvegardé : il propose de **tout remplacer** ou de l’**ajouter** (ses collections à la liste, sa bibliothèque dans un dossier « Sauvegarde du … », sans les éléments déjà présents).

Fichier de collection : `{ "format": "schemap-collection", "version": 1, "name", "items", "models" }`, où chaque élément est un dossier `{ "type": "folder", "name", "items" }` ou un mapping `{ "type": "mapping", "name", "nodes", "edges" }` (même contenu qu’un fichier de mapping), et `models` les modèles de la bibliothèque qu’utilisent ces mappings. Au premier lancement, l’ancien mapping en cours est repris dans la collection « Mes mappings ».

**Bibliothèque** (second onglet du panneau) : les éléments réutilisables par plusieurs mappings, rangés dans des dossiers — les **modèles** (structure d’une source ou d’une cible) et les **listes de valeurs** (énumérations, avec en option une table de correspondance pour le transcodage).

- *Créer* : boutons du panneau (nouveau modèle, nouvelle liste, nouveau dossier), ou bouton « base de données + » de l’en-tête d’une source, d’une cible ou d’une Liste de valeurs d’un mapping : le nœud est alors relié à l’élément créé. Le nom est demandé dans une fenêtre de l’application.
- *Listes de valeurs* : elles se comportent comme les modèles (même éditeur graphique, même bandeau « modifiée ici » dans un mapping, mêmes avertissements). Une liste se glisse sur le schéma (ajoutée directement) ou s’ajoute par son menu `⋯`. L’avertissement d’une modification liste les valeurs retirées, les correspondances changées, et, pour chaque mapping, les champs contrôlés par la liste et les liens de sa table. Un champ d’un modèle peut se référer à une liste de la bibliothèque (règles `⚙` dans l’éditeur du modèle) : le champ est contrôlé dans tout mapping, sans que la liste y ait de nœud : un nœud Liste de valeurs n’est utile que pour un transcodage (sa sortie Table) ou pour fournir ses valeurs à une transformation. Enregistrer une liste depuis un mapping fait désigner la liste partagée par les champs du mapping qui s’y référaient.
- *Utiliser* : glisser le modèle depuis le panneau et le lâcher sur le schéma ; un menu demande s’il s’ajoute comme source ou comme cible, à l’endroit du lâcher. Ou bien menu `⋯` d’un modèle › « Ajouter au mapping ouvert comme source / comme cible ». Le nombre à droite d’un modèle est celui des mappings qui l’utilisent.
- *Modifier dans la bibliothèque* : clic sur le modèle. Il s’ouvre à la place du mapping, sur son propre canevas, avec le même arbre de champs qu’une source (nom, type, obligatoire, règles, exemples, glisser `⋮⋮`, `{ }` pour le YAML), sans sockets ni ajout de nœuds. Les changements restent un brouillon jusqu’à « Enregistrer » du bandeau du haut (`Ctrl S`) ; « Annuler » revient à la version enregistrée ; quitter avec des changements non enregistrés demande confirmation. La croix du bandeau du haut ou un clic sur un mapping (ou un modèle composite) du panneau y ramène ; la barre d’outils affiche l’élément ouvert (« Modèle » ou « Liste de valeurs », ses dossiers et son nom), comme pour un modèle composite. S’il est utilisé et que sa structure change, un avertissement liste les champs supprimés ou modifiés et, pour chaque mapping, les champs reliés touchés (les liens d’un champ supprimé sont retirés) ; on peut appliquer, annuler, ou enregistrer sous un nouveau modèle.
- *Modifier depuis un mapping* : un nœud relié porte un bandeau au nom du modèle. Dès qu’on change ses champs, il passe en « modifié ici » : « Enregistrer dans le modèle » (avec le même avertissement sur les autres mappings), « Nouveau modèle… » (variante reliée à ce nœud, l’original ne change pas), `↺` (revenir au modèle) ; `✕` délie le nœud (ses champs restent, propres au mapping).
- *Modèles composites* : un modèle construit avec des nœuds, ex. « Commande fidélité » = le modèle Commande en ligne, plus les points du client du Fichier fidélité dont l’email est celui de la commande. Bouton « modèle composite » du panneau (ou menu `⋯` d’un dossier), ou menu `⋯` d’un mapping › « Copier en modèle composite ». Il s’ouvre (clic dans la bibliothèque) à la place du mapping, avec le même bandeau qu’un modèle : les changements restent un brouillon jusqu’à « Enregistrer » (bandeau du haut), « Annuler » revient à la version enregistrée, et `✕` ramène au mapping d’où il a été ouvert, où on peut alors le glisser. Dans son schéma, on glisse les modèles sources, on les relie à sa cible, avec le nœud « Rechercher par clé » pour une jointure (Clé : email de la commande ; Clés : clients[].email du fichier fidélité ; Valeurs : clients[].points). Les champs du modèle sont ceux de sa cible, et ses données ce qu’elle produit avec les exemples des sources. Devant chaque champ, une icône de lien donne au survol la source d’où il vient (« Commande en ligne », « Fichier fidélité » ; pas répétée sur un sous-champ venu de la même source que son objet), dans son schéma comme dans les mappings qui l’utilisent. Ajouté à un mapping (comme tout modèle), il donne directement les données jointes ; à l’enregistrement, ses changements s’y appliquent (champs et données, sauf là où ils ont été modifiés). Un modèle composite peut en utiliser un autre, mais pas lui-même.
  - *Source entière comme objet* : la ligne « Toute la source », au-dessus de ses champs, donne tout son document, d’un bloc. Relié à la ligne « Toute la cible » d’une cible, la cible entière reprend tous les champs de la source, en tête de liste ; « + Ajouter un champ » lui en ajoute de propres (par exemple un Objet relié à une autre source entière), placés après ; relié à un champ **Objet** ou **Liste d’objets** d’une cible, ce champ seul les reprend. Les champs repris (marque `⧉`) sont en lecture seule (nom, type, règles : ils se modifient dans la source et suivent ses changements), et la valeur est le document entier (une liste d’objets en reçoit un élément). Délier garde les champs, redevenus modifiables. La structure traverse les nœuds qui transmettent une entrée telle quelle (« Rechercher par clé » avec la source entière en Valeurs, « Valeur par défaut », « Condition », filtres, tris…) : un modèle composite ainsi construit donne, dans les mappings, tous les sous-champs de ses objets. Pour enlever des champs, intercaler **Retirer des champs** sur le lien : branché sur une source entière, il liste ses champs à décocher, et la cible suit. Fonctionne aussi dans un mapping ordinaire.
- Seuls la structure et les règles des champs sont partagées : les exemples d’une source et l’état replié des champs restent propres à chaque mapping. Un nœud modifié localement n’est pas mis à jour par un changement du modèle. Supprimer un modèle délie ses nœuds sans toucher à leurs champs.
- Export / import : un modèle, une liste ou un dossier de la bibliothèque s’exporte depuis son menu (`{ "format": "schemap-models", "items" }`) ; un mapping ou une collection exporté emporte les modèles et listes qu’il utilise. À l’import, ils sont rangés à la racine de la bibliothèque (les dossiers d’un dossier exporté sont gardés) ; les éléments déjà présents (même identifiant) sont gardés tels quels.
- En bas du panneau : **Légende** (types, sockets, liens, couleurs) et **Raccourcis** (clavier et souris, aussi avec la touche `?`).
- Les questions (nom d’un nouvel élément, confirmation d’une suppression ou d’un abandon de modifications) s’affichent dans des fenêtres de l’application, pas dans celles du navigateur.

Verrouillage : le cadenas d’en-tête (ou « Verrouiller » au clic droit) fige un nœud — ni déplacement, ni suppression, ni modification ; le cadenas des contrôles en bas à gauche verrouille tout le schéma (ni ajout, ni lien, ni modification). Le repli reste toujours possible.

Données réelles : déposez un fichier JSON sur une source (ou bouton `⤒` de son en-tête). Il remplace les valeurs du modèle de données pour le calcul, sans toucher au modèle décrit dans le nœud, et il est contrôlé contre ce modèle : ⛔ champ obligatoire absent, type ou format non respecté ; ⚠ champ en trop. Un bandeau dans la source résume le résultat, le détail est dans le panneau **Contrôles**. Le fichier reste en mémoire : il n’est ni sauvegardé ni exporté avec le mapping. Le bouton **Résultat** d’une cible montre le JSON produit, sa conformité au modèle de la cible, et permet de le copier ou de l’exporter.

Types : Texte, Nombre (décimal), Entier, Booléen, Date, Objet, et les listes de chacun. Un entier convient partout où un nombre est attendu ; un nombre relié à un champ Entier est tronqué, et le contrôle le signale (« En entier » permet de choisir l’arrondi).

Modèle de données en YAML : un champ par clé, avec son `type` (string, number, integer, boolean, date, object, array), `required: true` s’il est obligatoire, sa `description` (texte libre), son format et son `example`. Forme courte : `nom: string`.

```yaml
client:
  type: object
  required: true
  fields:
    email: { type: string, required: true, maxLength: 60, example: julie.martin@mail.com }
    points: integer
    vip: boolean
items:
  type: array
  items: object          # type des éléments
  minItems: 1
  fields:
    product: { type: string, required: true, library: Carte }   # nom d'une liste de valeurs
    qty: { type: integer, required: true }
    ref: { type: string, pattern: '^W-\d+$' }   # entre apostrophes : \d reste tel quel
```

`example` : pour une source, les exemples sont les données du calcul tant qu’aucun fichier n’est chargé (un champ sans exemple reçoit une valeur type) ; une liste d’objets peut recevoir la liste complète dans son `example` (ex. plusieurs commandes). Pour une cible, ils documentent le format attendu. L’exemple d’un champ simple d’une source (hors liste) se modifie aussi directement dans sa colonne **Valeur** (bordure rouge s’il ne respecte pas les règles du champ) ; ce n’est pas possible quand un fichier de données est chargé. Un exemple qui ne respecte pas le type ou le format de son champ est refusé.

« Importer un exemple JSON » déduit le modèle d’un document collé dans la fenêtre (les champs existants gardent leurs règles et leurs liens ; les valeurs du document deviennent les exemples).

Règles des champs : `*` à côté du nom rend un champ obligatoire, `⚙` (au survol) donne sa **description** (ce que contient le champ, affichée au survol de son nom ; `💬` quand il n’a pas de format) et définit son format — longueur min. / max. et expression régulière pour un texte, bornes pour un nombre ou un entier, bornes pour une date, nombre d’éléments pour une liste, et **valeurs autorisées** (texte, nombre, entier, date) : une liste de valeurs.

Listes de valeurs : le nœud **Liste de valeurs** (menu d’ajout › Données ; anciennement « Bibliothèque ») porte une liste de valeurs typée (textes, entiers, nombres ou dates), saisie ligne à ligne ou en bloc (`≡`, une valeur par ligne). Un champ s’y réfère dans ses règles (`⚙` › Valeurs autorisées ; en YAML `listeValeurs: Pays`, l’ancien mot-clé `bibliothèque` reste accepté) : sa valeur, ou chaque élément d’une liste, doit en faire partie. Plusieurs champs, dans des sources et cibles différentes, partagent la même liste ; le nœud indique combien de champs l’utilisent. Sa sortie **Valeurs** fournit la liste aux transformations. Contrôles : ⛔ valeur hors liste (fichier de données, exemple, résultat d’une cible) ; ⚠ champ cible alimenté par une source qui ne garantit pas ces valeurs (elle doit se référer à la même liste, ou à une liste dont toutes les valeurs y figurent) ; ⚠ liste absente (supprimée de la bibliothèque ; une liste de la bibliothèque n’a pas besoin de nœud dans le mapping pour être contrôlée). Dans une source, l’exemple d’un champ à liste de valeurs se choisit dans une liste déroulante.

Transcodage : cocher **Table de correspondance** dans une liste de valeurs ajoute une colonne (avec son propre type) qui associe à chaque valeur sa valeur dans un autre référentiel (`margherita → Pizza Margherita`), et une sortie **Table**. En bloc (`≡`) : `valeur ; correspondance` par ligne, ou un copier-coller de deux colonnes de tableur. Le nœud **Transcoder** (catégorie Conversion) reçoit cette table et une valeur (ou une liste, traduite élément par élément) et sort sa correspondance, ou sa valeur « Si absente ». Les contrôles suivent : une source liée à `ISO3`, transcodée vers une cible liée à `ISO2`, n’est pas signalée si toutes les correspondances (et la valeur « Si absente ») font partie d’`ISO2` ; ⚠ si une valeur peut rester sans correspondance alors que la cible est obligatoire. Chaque champ cible est contrôlé (panneau **Contrôles** en haut à droite — son icône donne le résultat global : ✔ conforme, ⚠ avertissements, ⛔ erreurs ; un clic sur un problème centre la vue sur le nœud — compteur dans l’en-tête de la cible, ligne surlignée) :

- ⛔ obligatoire mais non mappé ;
- ⛔ types incompatibles (ex. texte → date ; le lien est tracé en pointillés rouges) — tout lien est permis, le contrôle le signale ; contrôlé aussi sur les entrées des transformations ;
- ⚠ types différents mais convertis implicitement (ex. nombre → texte, nombre → entier) ;
- ⚠ obligatoire mais relié à un champ source optionnel (le champ, ou un de ses parents jusqu’au tableau le plus proche) ;
- ⚠ format non garanti par le champ source (ses bornes doivent être au moins aussi strictes, son motif identique).

Les garanties traversent les transformations qui savent les calculer (Extraire, Concaténer, Casse, Nettoyer espaces, Longueur) : « Extraire 32 caractères » vers une cible limitée à 12 est signalé. Les autres transformations lèvent les avertissements : c’est elles qui adaptent la valeur.

La page **Nœuds** (bouton de la barre d’outils, ou `?` dans l’en-tête d’un nœud) détaille chaque nœud : entrées, sorties, réglages, comportement, exemple et garanties pour le contrôle des cibles.

La page **Aide** (bouton de la barre d’outils) donne l’adresse email de contact et les versions de navigateur compatibles.

Formes des sockets : rond = valeur unique, losange = liste, losange pointé (`∀`) = entrée évaluée pour chaque élément. Un lien prend la couleur du type qu'il transporte, en pointillés pour une liste.

### Organisation du code

```
frontend/src/
  lib/          moteur sans dépendance à Vue : types, champs, transformations, évaluation du graphe
  components/   nœuds Vue Flow (nodes/), menus, panneau des contrôles, dialogues
  views/        MappingEditor.vue — l'éditeur
  services/     ouverture / export de fichiers
scripts/setup.js  configuration de Firebase Hosting
```

---

## Démarrage local

```bash
npm run dev   # installe les dépendances du frontend et lance Vite sur http://localhost:5173
```

---

## Mise en ligne (Firebase Hosting)

> **Prérequis** : Firebase CLI (`npm install -g firebase-tools`) et un projet Google Cloud / Firebase existant.

```bash
npm run setup
```

Le script demande un projet unique ou deux projets séparés (dev / prod), renseigne leurs ID dans `package.json` et `.firebaserc`, vous connecte à Firebase puis ajoute Firebase et le site Hosting à chaque projet (étapes ignorées s'ils existent déjà).

| Commande | Description |
|---|---|
| `npm run build` | Construit le frontend dans `frontend/dist` |
| `npm run deploy:dev` | Construit puis déploie sur le projet dev |
| `npm run deploy:prod` | Construit puis déploie sur le projet prod |
