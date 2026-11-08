<template>
  <div class="legend-grid">
    <div class="legend-card">
      <h3>{{ t('Types de données', 'Data types') }}</h3>
      <p class="legend-note">{{ t('La couleur d’un socket et du lien qui en part indique le type de la valeur.', 'The color of a socket, and of the link leaving it, shows the type of the value.') }}</p>
      <table class="legend-table">
        <tbody>
          <tr v-for="d in TYPE_DOCS" :key="d.type">
            <td class="sample"><span class="lg-socket" :style="{ background: SOCKET_COLORS[d.type] }" /></td>
            <td class="name">{{ socketTitle(d.type) }}</td>
            <td class="note">{{ t(...d.text) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="legend-card">
      <h3>Sockets</h3>
      <p class="legend-note">{{ t('À gauche d’un nœud les entrées, à droite les sorties.', 'Inputs on the left of a node, outputs on the right.') }}</p>
      <table class="legend-table">
        <tbody>
          <tr>
            <td class="sample"><span class="lg-socket" :style="{ background: SOCKET_COLORS.string }" /></td>
            <td class="name">{{ t('Rond', 'Circle') }}</td>
            <td class="note">{{ t('Une valeur unique.', 'A single value.') }}</td>
          </tr>
          <tr>
            <td class="sample"><span class="lg-socket list" :style="{ background: SOCKET_COLORS.string }" /></td>
            <td class="name">{{ t('Losange', 'Diamond') }}</td>
            <td class="note">{{ t('Une liste (ex. « Liste de textes »).', 'A list (e.g. “List of texts”).') }}</td>
          </tr>
          <tr>
            <td class="sample"><span class="lg-socket list per-item" :style="{ background: SOCKET_COLORS.boolean }" /></td>
            <td class="name">{{ t('Losange pointé', 'Dotted diamond') }} <span class="per-item">∀</span></td>
            <td class="note">{{ t('Entrée évaluée pour chaque élément de la liste du nœud (ex. la condition de Filtrer).', 'Input evaluated for each item of the node’s list (e.g. the condition of Filter).') }}</td>
          </tr>
          <tr>
            <td class="sample"><span class="lg-input">abc</span></td>
            <td class="name">{{ t('Champ de saisie', 'Input box') }}</td>
            <td class="note">{{ t('Une entrée non reliée prend la valeur saisie à côté de son socket.', 'An unlinked input takes the value typed next to its socket.') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="legend-card">
      <h3>{{ t('Liens', 'Links') }}</h3>
      <p class="legend-note">{{ t('Un lien prend la couleur du type de la sortie dont il part.', 'A link takes the color of the type of the output it leaves from.') }}</p>
      <table class="legend-table">
        <tbody>
          <tr v-for="l in LINK_DOCS" :key="l.name[0]">
            <td class="sample">
              <svg width="56" height="14" aria-hidden="true">
                <line x1="3" y1="7" x2="53" y2="7" :stroke="l.color" :stroke-width="l.width ?? 2" :stroke-dasharray="l.dash" />
                <template v-if="l.ends">
                  <circle cx="7" cy="7" r="4.5" fill="var(--bg)" stroke="var(--edge-highlight)" stroke-width="1.5" />
                  <circle cx="49" cy="7" r="4.5" fill="var(--bg)" stroke="var(--edge-highlight)" stroke-width="1.5" />
                </template>
                <template v-if="l.plus">
                  <circle cx="28" cy="7" r="6.5" fill="var(--edge-highlight)" />
                  <path d="M28 4v6M25 7h6" stroke="var(--bg)" stroke-width="1.6" />
                </template>
              </svg>
            </td>
            <td class="name">{{ t(...l.name) }}</td>
            <td class="note">{{ t(...l.text) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="legend-card">
      <h3>{{ t('Couleurs des nœuds', 'Node colors') }}</h3>
      <p class="legend-note">{{ t('L’en-tête d’un nœud a la couleur de sa catégorie.', 'A node’s header has the color of its category.') }}</p>
      <div class="legend-chips">
        <a
          v-for="c in NODE_COLORS"
          :key="c.label"
          class="lg-chip"
          :href="linkBase + c.href"
          :style="{ background: c.color }"
        >{{ c.label }}</a>
      </div>
      <p class="legend-note mt-3">{{ t('Un groupe peut prendre une autre couleur (pastille de son en-tête).', 'A group can take another color (swatch in its header).') }}</p>
    </div>

    <div class="legend-card wide">
      <h3>{{ t('Champs, contrôles et verrous', 'Fields, checks and locks') }}</h3>
      <table class="legend-table">
        <tbody>
          <tr v-for="m in MARK_DOCS" :key="m.cls">
            <td class="sample"><span class="lg-mark" :class="m.cls">{{ t(...m.mark) }}</span></td>
            <td class="name">{{ t(...m.name) }}</td>
            <td class="note">{{ t(...m.text) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { t } from '../lib/i18n';
import { CATEGORIES, categoryLabel } from '../lib/transforms';
import { HEADER_COLORS, SOCKET_COLORS, socketTitle } from '../lib/types';

/** Légende de l'éditeur : types, sockets, liens, couleurs et repères. Utilisée par la page Nœuds et l'éditeur. */
defineProps({
  /** Préfixe des liens vers la documentation (`/noeuds` hors de la page Nœuds : ils s'ouvrent dans un onglet). */
  linkBase: { type: String, default: '' },
});

/** Légende : types de données. */
// Textes en paires [français, anglais].
const TYPE_DOCS = [
  { type: 'string', text: ['Chaîne de caractères.', 'String of characters.'] },
  { type: 'number', text: ['Nombre décimal (accepte aussi un entier).', 'Decimal number (also accepts an integer).'] },
  { type: 'integer', text: ['Nombre entier (comptes, index, longueurs…).', 'Whole number (counts, indexes, lengths…).'] },
  { type: 'boolean', text: ['Vrai ou faux.', 'True or false.'] },
  { type: 'date', text: ['Date ou date-heure (ISO, ex. 2026-09-14).', 'Date or date-time (ISO, e.g. 2026-09-14).'] },
  { type: 'object', text: ['Objet : un ensemble de champs.', 'Object: a set of fields.'] },
  { type: 'any', text: ['Tout type : la valeur passe telle quelle.', 'Any type: the value passes as is.'] },
];

/** Légende : apparence des liens. */
const LINK_DOCS = [
  { name: ['Trait plein', 'Solid line'], color: SOCKET_COLORS.string, text: ['Une valeur unique.', 'A single value.'] },
  { name: ['Tirets', 'Dashes'], color: SOCKET_COLORS.string, dash: '7 4', text: ['Une liste.', 'A list.'] },
  {
    name: ['Pointillés rouges', 'Red dots'],
    color: 'var(--danger)',
    dash: '2 4',
    text: ['Types incompatibles : erreur dans les contrôles.', 'Incompatible types: error in the checks.'],
  },
  { name: ['Blanc', 'White'], color: 'var(--edge-highlight)', text: ['Lien survolé ou sélectionné (Suppr le supprime).', 'Hovered or selected link (Del deletes it).'] },
  {
    name: ['Bouton +', '+ button'],
    color: 'var(--edge-highlight)',
    plus: true,
    text: ['Au milieu d’un lien survolé : ajoute un nœud intercalé sur ce lien.', 'In the middle of a hovered link: adds a node inserted on this link.'],
  },
  {
    name: ['Pastilles', 'Handles'],
    color: 'var(--edge-highlight)',
    ends: true,
    text: ['Aux extrémités d’un lien survolé : les saisir pour changer le point d’accroche.', 'At the ends of a hovered link: grab them to change the attach point.'],
  },
  {
    name: ['Orange épais', 'Thick orange'],
    color: 'var(--accent)',
    width: 4,
    text: ['Le nœud glissé s’intercalera sur ce lien si on le lâche.', 'The dragged node will be inserted on this link if dropped.'],
  },
];

/** Légende : couleurs des en-têtes de nœuds. */
const NODE_COLORS = computed(() => [
  { label: t('Source', 'Source'), color: HEADER_COLORS.source, href: '#source' },
  { label: t('Cible', 'Target'), color: HEADER_COLORS.target, href: '#target' },
  { label: t('Groupe', 'Group'), color: HEADER_COLORS.group, href: '#group' },
  ...CATEGORIES.map((c) => ({ label: categoryLabel(c), color: HEADER_COLORS[c], href: `#cat-${c}` })),
]);

/** Légende : repères sur les champs et les nœuds. */
const MARK_DOCS = [
  {
    mark: ['*', '*'],
    cls: 'required',
    name: ['Obligatoire', 'Required'],
    text: ['Le champ doit être présent. Cliquer l’étoile bascule obligatoire / optionnel.', 'The field must be present. Clicking the star toggles required / optional.'],
  },
  {
    mark: ['≤ 25 car.', '≤ 25 chars'],
    cls: 'rule',
    name: ['Format', 'Format'],
    text: [
      'Règle de format du champ (longueur, bornes, motif, dates, taille de liste) ; cliquer pour la modifier.',
      'Format rule of the field (length, bounds, pattern, dates, list size); click to edit it.',
    ],
  },
  {
    mark: ['⛔', '⛔'],
    cls: 'error',
    name: ['Erreur', 'Error'],
    text: ['Champ obligatoire non alimenté, types incompatibles, fichier de données non conforme…', 'Required field not fed, incompatible types, data file not matching…'],
  },
  {
    mark: ['⚠', '⚠'],
    cls: 'warning',
    name: ['Avertissement', 'Warning'],
    text: [
      'Conversion de type, source optionnelle vers un champ obligatoire, format non garanti, champ en trop…',
      'Type conversion, optional source into a required field, format not guaranteed, extra field…',
    ],
  },
  {
    mark: ['2', '2'],
    cls: 'count',
    name: ['Pastille de nœud', 'Node badge'],
    text: ['Nombre de problèmes relevés sur ce nœud ; le détail est dans le panneau Contrôles.', 'Number of problems found on this node; details are in the Checks panel.'],
  },
  { mark: ['🔓', '🔓'], cls: 'lock', name: ['Cadenas ouvert', 'Open padlock'], text: ['Nœud ou groupe modifiable.', 'Editable node or group.'] },
  {
    mark: ['🔒', '🔒'],
    cls: 'lock on',
    name: ['Cadenas orange', 'Orange padlock'],
    text: ['Nœud, groupe ou schéma verrouillé : ni déplacement ni modification.', 'Locked node, group or schema: no moving, no editing.'],
  },
];
</script>

<style scoped>
.legend-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.legend-card {
  padding: 12px 14px;
  border: 1px solid var(--node-border);
  border-radius: 6px;
  background: var(--node);
  font-size: 13px;
}
.legend-card.wide {
  grid-column: 1 / -1;
}
.legend-card h3 {
  margin-bottom: 4px;
  font-size: 14px;
}
.legend-note {
  margin-bottom: 8px;
  color: var(--muted);
}
.legend-table td {
  padding: 4px 10px 4px 0;
  vertical-align: middle;
}
.legend-table td.sample {
  width: 64px;
  text-align: center;
}
.legend-table td.name {
  width: 130px;
  font-weight: 600;
  white-space: nowrap;
}
.legend-table td.note {
  color: var(--muted);
}
.lg-socket {
  position: relative;
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--socket-border);
  border-radius: 50%;
  vertical-align: middle;
}
.lg-socket.list {
  border-radius: 2px;
  transform: rotate(45deg);
}
.lg-socket.per-item::after {
  content: '';
  position: absolute;
  inset: 2.5px;
  border-radius: 50%;
  background: var(--socket-border);
}
.lg-input {
  display: inline-block;
  padding: 0 6px;
  border: 1px solid var(--field-border);
  border-radius: 4px;
  background: var(--field);
  font-size: 11px;
}
.legend-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.lg-chip {
  padding: 2px 10px;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}
.lg-mark {
  display: inline-block;
  min-width: 22px;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 18px;
}
.lg-mark.required {
  color: var(--danger);
  font-weight: 700;
}
.lg-mark.rule {
  background: var(--hover-overlay);
  font-size: 10px;
}
.lg-mark.error {
  background: color-mix(in srgb, var(--danger) 18%, transparent);
}
.lg-mark.warning {
  background: color-mix(in srgb, var(--warning) 16%, transparent);
}
.lg-mark.count {
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.3);
  color: #ffd27a;
}
.lg-mark.lock.on {
  background: var(--accent);
}
.per-item {
  margin-right: 4px;
  color: var(--muted);
  font-weight: 700;
}
</style>
