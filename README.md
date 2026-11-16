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

**Copier le lien de partage** (menu `⋯` d’un élément du panneau des collections) copie un lien qui contient tout le mapping, ou toute la collection (ou tout le dossier) avec ses mappings. Le contenu est compressé dans l’adresse, après `#` : rien n’est envoyé au serveur ni stocké. L’ouvrir ajoute ce contenu sans rien remplacer : un mapping à côté du mapping ouvert, une collection à la liste. Les fichiers de données chargés sur les sources n’en font pas partie. Compter environ 2 à 4 000 caractères pour un schéma courant ; au-delà de 30 000, un avertissement signale que certains outils pourraient couper le lien.

**Collections** (panneau de gauche, à la manière de Postman ; le bouton tout à gauche de la barre d’outils l’affiche ou le masque) : les mappings sont rangés dans des collections, éventuellement dans des dossiers imbriqués. Un clic ouvre un mapping : celui qu’on quitte est conservé tel quel. Le menu `⋯` (ou clic droit) d’un élément propose nouveau mapping, nouveau dossier, renommer (aussi par double-clic), dupliquer, exporter et supprimer. On réorganise par glisser-déposer : sur un dossier ou une collection, l’élément y entre ; sur un mapping, il se place juste avant. Le champ **Filtrer** cherche dans les noms. Toutes les collections sont conservées dans le navigateur ; un avertissement s’affiche si son espace de stockage est plein.

**Nouveau** et **Démo** ajoutent un mapping à côté de celui qui est ouvert, sans rien effacer. Le bouton d’import du panneau (ou `Ctrl O`) importe un fichier `.json` choisi dans l’explorateur : un mapping seul est ajouté à côté du mapping ouvert, une collection est ajoutée à la liste. Le menu `⋯` exporte un mapping seul, une collection, ou un dossier (exporté comme une collection) ; `Ctrl S` exporte le mapping ouvert. L’emplacement est demandé à chaque fois (sous Chrome / Edge ; les autres navigateurs le téléchargent).

Fichier de collection : `{ "format": "schemap-collection", "version": 1, "name", "items", "models" }`, où chaque élément est un dossier `{ "type": "folder", "name", "items" }` ou un mapping `{ "type": "mapping", "name", "nodes", "edges" }` (même contenu qu’un fichier de mapping), et `models` les modèles de la bibliothèque qu’utilisent ces flux. Au premier lancement, l’ancien mapping en cours est repris dans la collection « Mes flux ».

**Modèles** (second onglet du panneau) : la bibliothèque des modèles de données, rangés dans des dossiers, réutilisables comme source ou cible par plusieurs flux.

- *Créer* : bouton « base de données + » du panneau, ou du titre d’une source / cible d’un flux (« Enregistrer ce modèle dans la bibliothèque ») : le nœud est alors relié au modèle.
- *Utiliser* : glisser le modèle depuis le panneau et le lâcher sur le schéma ; un menu demande s’il s’ajoute comme source ou comme cible, à l’endroit du lâcher. Ou bien menu `⋯` d’un modèle › « Ajouter au flux ouvert comme source / comme cible ». Le nombre à droite d’un modèle est celui des flux qui l’utilisent.
- *Modifier dans la bibliothèque* : clic sur le modèle. Il s’ouvre à la place du flux, sur son propre canevas, avec le même arbre de champs qu’une source (nom, type, obligatoire, règles, exemples, glisser `⋮⋮`, `{ }` pour le YAML), sans sockets ni ajout de nœuds. Les changements restent un brouillon jusqu’à « Enregistrer le modèle » (`Ctrl S`) ; « Annuler les modifications » revient à la version enregistrée ; quitter avec des changements non enregistrés demande confirmation. « Retour au flux » (barre d’outils) ou un clic sur un flux du panneau ramène au flux. S’il est utilisé et que sa structure change, un avertissement liste les champs supprimés ou modifiés et, pour chaque flux, les champs reliés touchés (les liens d’un champ supprimé sont retirés) ; on peut appliquer, annuler, ou enregistrer sous un nouveau modèle.
- *Modifier depuis un flux* : un nœud relié porte un bandeau au nom du modèle. Dès qu’on change ses champs, il passe en « modifié ici » : « Enregistrer dans le modèle » (avec le même avertissement sur les autres flux), « Nouveau modèle… » (variante reliée à ce nœud, l’original ne change pas), `↺` (revenir au modèle) ; `✕` délie le nœud (ses champs restent, propres au flux).
- Seuls la structure et les règles des champs sont partagées : les exemples d’une source et l’état replié des champs restent propres à chaque flux. Un nœud modifié localement n’est pas mis à jour par un changement du modèle. Supprimer un modèle délie ses nœuds sans toucher à leurs champs.
- Export / import : un modèle ou un dossier de modèles s’exporte depuis son menu (`{ "format": "schemap-models", "items" }`) ; à l’import, les modèles déjà présents (même identifiant) sont gardés tels quels.

Verrouillage : le cadenas d’en-tête (ou « Verrouiller » au clic droit) fige un nœud — ni déplacement, ni suppression, ni modification ; le cadenas des contrôles en bas à gauche verrouille tout le schéma (ni ajout, ni lien, ni modification). Le repli reste toujours possible.

Données réelles : déposez un fichier JSON sur une source (ou bouton `⤒` de son en-tête). Il remplace les valeurs du modèle de données pour le calcul, sans toucher au modèle décrit dans le nœud, et il est contrôlé contre ce modèle : ⛔ champ obligatoire absent, type ou format non respecté ; ⚠ champ en trop. Un bandeau dans la source résume le résultat, le détail est dans le panneau **Contrôles**. Le fichier reste en mémoire : il n’est ni sauvegardé ni exporté avec le mapping. Le bouton **Résultat** d’une cible montre le JSON produit, sa conformité au modèle de la cible, et permet de le copier ou de l’exporter.

Types : Texte, Nombre (décimal), Entier, Booléen, Date, Objet, et les listes de chacun. Un entier convient partout où un nombre est attendu ; un nombre relié à un champ Entier est tronqué, et le contrôle le signale (« En entier » permet de choisir l’arrondi).

Modèle de données en YAML : un champ par clé, avec son `type` (string, number, integer, boolean, date, object, array), `required: true` s’il est obligatoire, son format et son `example`. Forme courte : `nom: string`.

```yaml
client:
  type: object
  required: true
  fields:
    nom: { type: string, required: true, maxLength: 60, example: Ada Lovelace }
    pays: { type: string, library: Pays }   # nom d'un nœud Bibliothèque
    age: integer
commandes:
  type: array
  items: object          # type des éléments
  minItems: 1
  fields:
    ref: { type: string, required: true, pattern: '^C-\d+$' }   # entre apostrophes : \d reste tel quel
```

`example` : pour une source, les exemples sont les données du calcul tant qu’aucun fichier n’est chargé (un champ sans exemple reçoit une valeur type) ; une liste d’objets peut recevoir la liste complète dans son `example` (ex. plusieurs commandes). Pour une cible, ils documentent le format attendu. L’exemple d’un champ simple d’une source (hors liste) se modifie aussi directement dans sa colonne **Valeur** (bordure rouge s’il ne respecte pas les règles du champ) ; ce n’est pas possible quand un fichier de données est chargé. Un exemple qui ne respecte pas le type ou le format de son champ est refusé.

« Importer un exemple JSON » déduit le modèle d’un document collé dans la fenêtre (les champs existants gardent leurs règles et leurs liens ; les valeurs du document deviennent les exemples).

Règles des champs : `*` à côté du nom rend un champ obligatoire, `⚙` (au survol) définit son format — longueur min. / max. et expression régulière pour un texte, bornes pour un nombre ou un entier, bornes pour une date, nombre d’éléments pour une liste, et **valeurs autorisées** (texte, nombre, entier, date) : une bibliothèque de valeurs.

Bibliothèques de valeurs : le nœud **Bibliothèque** (menu d’ajout › Données) porte une liste de valeurs typée (textes, entiers, nombres ou dates), saisie ligne à ligne ou en bloc (`≡`, une valeur par ligne). Un champ s’y réfère dans ses règles (`⚙` › Valeurs autorisées ; en YAML `bibliothèque: Pays`) : sa valeur, ou chaque élément d’une liste, doit en faire partie. Plusieurs champs, dans des sources et cibles différentes, partagent la même bibliothèque ; le nœud indique combien de champs l’utilisent. Sa sortie **Valeurs** fournit la liste aux transformations. Contrôles : ⛔ valeur hors bibliothèque (fichier de données, exemple, résultat d’une cible) ; ⚠ champ cible alimenté par une source qui ne garantit pas ces valeurs (elle doit se référer à la même bibliothèque, ou à une bibliothèque dont toutes les valeurs y figurent) ; ⚠ bibliothèque supprimée. Dans une source, l’exemple d’un champ à bibliothèque se choisit dans une liste déroulante.

Transcodage : cocher **Table de correspondance** dans une bibliothèque ajoute une colonne (avec son propre type) qui associe à chaque valeur sa valeur dans un autre référentiel (`FRA → FR`), et une sortie **Table**. En bloc (`≡`) : `valeur ; correspondance` par ligne, ou un copier-coller de deux colonnes de tableur. Le nœud **Transcoder** (catégorie Conversion) reçoit cette table et une valeur (ou une liste, traduite élément par élément) et sort sa correspondance, ou sa valeur « Si absente ». Les contrôles suivent : une source liée à `ISO3`, transcodée vers une cible liée à `ISO2`, n’est pas signalée si toutes les correspondances (et la valeur « Si absente ») font partie d’`ISO2` ; ⚠ si une valeur peut rester sans correspondance alors que la cible est obligatoire. Chaque champ cible est contrôlé (panneau **Contrôles** en haut à droite — son icône donne le résultat global : ✔ conforme, ⚠ avertissements, ⛔ erreurs ; un clic sur un problème centre la vue sur le nœud — compteur dans l’en-tête de la cible, ligne surlignée) :

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
