<template>
  <div class="legend-grid">
    <div class="legend-card">
      <h3>Types de données</h3>
      <p class="legend-note">La couleur d’un socket et du lien qui en part indique le type de la valeur.</p>
      <table class="legend-table">
        <tbody>
          <tr v-for="t in TYPE_DOCS" :key="t.type">
            <td class="sample"><span class="lg-socket" :style="{ background: SOCKET_COLORS[t.type] }" /></td>
            <td class="name">{{ socketTitle(t.type) }}</td>
            <td class="note">{{ t.text }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="legend-card">
      <h3>Sockets</h3>
      <p class="legend-note">À gauche d’un nœud les entrées, à droite les sorties.</p>
      <table class="legend-table">
        <tbody>
          <tr>
            <td class="sample"><span class="lg-socket" :style="{ background: SOCKET_COLORS.string }" /></td>
            <td class="name">Rond</td>
            <td class="note">Une valeur unique.</td>
          </tr>
          <tr>
            <td class="sample"><span class="lg-socket list" :style="{ background: SOCKET_COLORS.string }" /></td>
            <td class="name">Losange</td>
            <td class="note">Une liste (ex. « Liste de textes »).</td>
          </tr>
          <tr>
            <td class="sample"><span class="lg-socket list per-item" :style="{ background: SOCKET_COLORS.boolean }" /></td>
            <td class="name">Losange pointé <span class="per-item">∀</span></td>
            <td class="note">Entrée évaluée pour chaque élément de la liste du nœud (ex. la condition de Filtrer).</td>
          </tr>
          <tr>
            <td class="sample"><span class="lg-input">abc</span></td>
            <td class="name">Champ de saisie</td>
            <td class="note">Une entrée non reliée prend la valeur saisie à côté de son socket.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="legend-card">
      <h3>Liens</h3>
      <p class="legend-note">Un lien prend la couleur du type de la sortie dont il part.</p>
      <table class="legend-table">
        <tbody>
          <tr v-for="l in LINK_DOCS" :key="l.name">
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
            <td class="name">{{ l.name }}</td>
            <td class="note">{{ l.text }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="legend-card">
      <h3>Couleurs des nœuds</h3>
      <p class="legend-note">L’en-tête d’un nœud a la couleur de sa catégorie.</p>
      <div class="legend-chips">
        <a
          v-for="c in NODE_COLORS"
          :key="c.label"
          class="lg-chip"
          :href="linkBase + c.href"
          :target="linkBase ? '_blank' : undefined"
          :style="{ background: c.color }"
        >{{ c.label }}</a>
      </div>
      <p class="legend-note mt-3">Un groupe peut prendre une autre couleur (pastille de son en-tête).</p>
    </div>

    <div class="legend-card wide">
      <h3>Champs, contrôles et verrous</h3>
      <table class="legend-table">
        <tbody>
          <tr v-for="m in MARK_DOCS" :key="m.name">
            <td class="sample"><span class="lg-mark" :class="m.cls">{{ m.mark }}</span></td>
            <td class="name">{{ m.name }}</td>
            <td class="note">{{ m.text }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { CATEGORIES } from '../lib/transforms';
import { HEADER_COLORS, SOCKET_COLORS, socketTitle } from '../lib/types';

/** Légende de l'éditeur : types, sockets, liens, couleurs et repères. Utilisée par la page Nœuds et l'éditeur. */
defineProps({
  /** Préfixe des liens vers la documentation (`/noeuds` hors de la page Nœuds : ils s'ouvrent dans un onglet). */
  linkBase: { type: String, default: '' },
});

/** Légende : types de données. */
const TYPE_DOCS = [
  { type: 'string', text: 'Chaîne de caractères.' },
  { type: 'number', text: 'Nombre décimal (accepte aussi un entier).' },
  { type: 'integer', text: 'Nombre entier (comptes, index, longueurs…).' },
  { type: 'boolean', text: 'Vrai ou faux.' },
  { type: 'date', text: 'Date ou date-heure (ISO, ex. 2026-09-14).' },
  { type: 'object', text: 'Objet : un ensemble de champs.' },
  { type: 'any', text: 'Tout type : la valeur passe telle quelle.' },
];

/** Légende : apparence des liens. */
const LINK_DOCS = [
  { name: 'Trait plein', color: SOCKET_COLORS.string, text: 'Une valeur unique.' },
  { name: 'Tirets', color: SOCKET_COLORS.string, dash: '7 4', text: 'Une liste.' },
  { name: 'Pointillés rouges', color: 'var(--danger)', dash: '2 4', text: 'Types incompatibles : erreur dans les contrôles.' },
  { name: 'Blanc', color: 'var(--edge-highlight)', text: 'Lien survolé ou sélectionné (Suppr le supprime).' },
  { name: 'Bouton +', color: 'var(--edge-highlight)', plus: true, text: 'Au milieu d’un lien survolé : ajoute un nœud intercalé sur ce lien.' },
  { name: 'Pastilles', color: 'var(--edge-highlight)', ends: true, text: 'Aux extrémités d’un lien survolé : les saisir pour changer le point d’accroche.' },
  { name: 'Orange épais', color: 'var(--accent)', width: 4, text: 'Le nœud glissé s’intercalera sur ce lien si on le lâche.' },
];

/** Légende : couleurs des en-têtes de nœuds. */
const NODE_COLORS = [
  { label: 'Source', color: HEADER_COLORS.source, href: '#source' },
  { label: 'Cible', color: HEADER_COLORS.target, href: '#target' },
  { label: 'Groupe', color: HEADER_COLORS.group, href: '#group' },
  ...CATEGORIES.map((c) => ({ label: c, color: HEADER_COLORS[c], href: `#cat-${c}` })),
];

/** Légende : repères sur les champs et les nœuds. */
const MARK_DOCS = [
  { mark: '*', cls: 'required', name: 'Obligatoire', text: 'Le champ doit être présent. Cliquer l’étoile bascule obligatoire / optionnel.' },
  { mark: '≤ 25 car.', cls: 'rule', name: 'Format', text: 'Règle de format du champ (longueur, bornes, motif, dates, taille de liste) ; cliquer pour la modifier.' },
  { mark: '⛔', cls: 'error', name: 'Erreur', text: 'Champ obligatoire non alimenté, types incompatibles, fichier de données non conforme…' },
  { mark: '⚠', cls: 'warning', name: 'Avertissement', text: 'Conversion de type, source optionnelle vers un champ obligatoire, format non garanti, champ en trop…' },
  { mark: '2', cls: 'count', name: 'Pastille de nœud', text: 'Nombre de problèmes relevés sur ce nœud ; le détail est dans le panneau Contrôles.' },
  { mark: '🔓', cls: 'lock', name: 'Cadenas ouvert', text: 'Nœud ou groupe modifiable.' },
  { mark: '🔒', cls: 'lock on', name: 'Cadenas orange', text: 'Nœud, groupe ou schéma verrouillé : ni déplacement ni modification.' },
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
