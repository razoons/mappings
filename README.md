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

**Exporter › Image du schéma** enregistre une image PNG de tout le schéma (pas seulement la partie visible), sur le fond du thème courant.

**Partager** copie un lien qui contient tout le schéma (compressé dans l’adresse, après `#` : rien n’est envoyé au serveur ni stocké). L’ouvrir charge le schéma, après confirmation s’il remplace un mapping en cours. Les fichiers de données chargés sur les sources n’en font pas partie. Compter environ 2 à 4 000 caractères pour un schéma courant.

Le mapping en cours est conservé dans le navigateur. **Ouvrir** (`Ctrl O`) charge un fichier `.json` choisi dans l’explorateur ; **Exporter** (`Ctrl S`) demande à chaque fois où l’enregistrer (sous Chrome / Edge ; les autres navigateurs le téléchargent).

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

Règles des champs : `*` à côté du nom rend un champ obligatoire, `⚙` (au survol) définit son format — longueur min. / max. et expression régulière pour un texte, bornes pour un nombre ou un entier, bornes pour une date, nombre d’éléments pour une liste. Chaque champ cible est contrôlé (panneau **Contrôles** en haut à droite — son icône donne le résultat global : ✔ conforme, ⚠ avertissements, ⛔ erreurs ; un clic sur un problème centre la vue sur le nœud — compteur dans l’en-tête de la cible, ligne surlignée) :

- ⛔ obligatoire mais non mappé ;
- ⛔ types incompatibles (ex. texte → date ; le lien est tracé en pointillés rouges) — tout lien est permis, le contrôle le signale ; contrôlé aussi sur les entrées des transformations ;
- ⚠ types différents mais convertis implicitement (ex. nombre → texte, nombre → entier) ;
- ⚠ obligatoire mais relié à un champ source optionnel (le champ, ou un de ses parents jusqu’au tableau le plus proche) ;
- ⚠ format non garanti par le champ source (ses bornes doivent être au moins aussi strictes, son motif identique).

Les garanties traversent les transformations qui savent les calculer (Extraire, Concaténer, Casse, Nettoyer espaces, Longueur) : « Extraire 32 caractères » vers une cible limitée à 12 est signalé. Les autres transformations lèvent les avertissements : c’est elles qui adaptent la valeur.

La page **Nœuds** (bouton de la barre d’outils, ou `?` dans l’en-tête d’un nœud) détaille chaque nœud : entrées, sorties, réglages, comportement, exemple et garanties pour le contrôle des cibles.

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
