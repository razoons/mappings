<template>
  <div class="shortcuts">
    <section v-for="group in groups" :key="group.title">
      <h3>{{ group.title }}</h3>
      <div v-for="row in group.rows" :key="row.label" class="shortcut-row">
        <span class="keys">
          <template v-for="(combo, i) in row.keys" :key="i">
            <span v-if="i" class="or">{{ t('ou', 'or') }}</span>
            <template v-for="(k, j) in combo" :key="j">
              <span v-if="j" class="plus">+</span>
              <span v-if="isMouse(k)" class="mouse">{{ k }}</span>
              <kbd v-else>{{ k }}</kbd>
            </template>
          </template>
        </span>
        <span class="label">{{ row.label }}</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { t } from '../lib/i18n';

/** Geste de souris (écrit en minuscules : « clic droit », « molette »…), affiché comme du texte et non comme une touche. */
const isMouse = (k) => /^[a-zéèà]/.test(k);

/** Raccourcis clavier et souris de l'éditeur, par thème. `keys` : combinaisons équivalentes, chacune une liste de touches. */
const groups = computed(() => {
  const ctrl = t('Ctrl', 'Ctrl');
  const click = t('clic', 'click');
  return [
    {
      title: t('Schéma', 'Schema'),
      rows: [
        { keys: [['Shift', 'A'], [t('clic droit sur le fond', 'right-click on the background')]], label: t('Ajouter un nœud', 'Add a node') },
        { keys: [[ctrl, 'Z']], label: t('Annuler (jusqu’à 20 actions)', 'Undo (up to 20 actions)') },
        { keys: [[ctrl, 'Y'], [ctrl, 'Shift', 'Z']], label: t('Rétablir', 'Redo') },
        { keys: [[ctrl, 'D']], label: t('Dupliquer la sélection (un clic la dépose, Échap annule)', 'Duplicate the selection (a click drops it, Esc cancels)') },
        { keys: [[ctrl, 'G']], label: t('Grouper la sélection', 'Group the selection') },
        { keys: [[t('Suppr', 'Del')], [t('Retour arrière', 'Backspace')]], label: t('Supprimer la sélection', 'Delete the selection') },
        { keys: [[t('clic droit sur un nœud', 'right-click on a node')]], label: t('Menu du nœud (replier, grouper, verrouiller…)', 'Node menu (collapse, group, lock…)') },
        { keys: [['Shift', t('glisser sur le fond', 'drag on the background')]], label: t('Sélectionner une zone', 'Select an area') },
        { keys: [[ctrl, click]], label: t('Ajouter un nœud à la sélection', 'Add a node to the selection') },
        { keys: [[t('molette', 'wheel')]], label: t('Zoomer', 'Zoom') },
        { keys: [[t('glisser le fond', 'drag the background')]], label: t('Déplacer la vue', 'Move the view') },
        { keys: [[t('Échap', 'Esc')]], label: t('Annuler une duplication en cours', 'Cancel a pending duplication') },
      ],
    },
    {
      title: t('Fichiers', 'Files'),
      rows: [
        { keys: [[ctrl, 'S']], label: t('Exporter le mapping ouvert ; dans la bibliothèque, enregistrer le modèle ou la liste ouvert', 'Export the open mapping; in the library, save the open model or list') },
        { keys: [[ctrl, 'O']], label: t('Importer un fichier (mapping, collection, bibliothèque)', 'Import a file (mapping, collection, library)') },
      ],
    },
    {
      title: t('Panneau de gauche', 'Left panel'),
      rows: [
        { keys: [[t('double-clic', 'double-click')]], label: t('Renommer (Entrée valide, Échap annule)', 'Rename (Enter confirms, Esc cancels)') },
        { keys: [[t('clic droit', 'right-click')]], label: t('Menu de l’élément', 'Item menu') },
        { keys: [[t('glisser-déposer', 'drag and drop')]], label: t('Ranger un élément ; un modèle ou une liste lâché sur le schéma s’y ajoute', 'Move an item; a model or list dropped on the schema is added to it') },
      ],
    },
    {
      title: t('Saisie', 'Input'),
      rows: [
        { keys: [[t('Entrée', 'Enter')]], label: t('Valider une valeur (liste de valeurs, exemple, nom)', 'Confirm a value (value list, example, name)') },
        { keys: [['⋮⋮']], label: t('Glisser pour déplacer un champ', 'Drag to move a field') },
        { keys: [['?']], label: t('Afficher ces raccourcis', 'Show these shortcuts') },
      ],
    },
  ];
});
</script>

<style>
.shortcuts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 8px 32px;
}
.shortcuts h3 {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.7;
  margin: 8px 0 6px;
}
.shortcut-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  font-size: 0.875rem;
}
.shortcut-row .keys {
  flex: 0 0 170px;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 3px;
}
.shortcut-row kbd {
  font-size: 0.75rem;
  padding: 1px 6px;
}
.shortcut-row .mouse {
  font-style: italic;
  opacity: 0.85;
}
.shortcut-row .plus,
.shortcut-row .or {
  opacity: 0.6;
  font-size: 0.75rem;
}
.shortcut-row .or {
  margin: 0 3px;
}
.shortcut-row .label {
  flex: 1;
}
</style>
