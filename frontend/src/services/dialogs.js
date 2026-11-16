import { reactive } from 'vue';

/**
 * Fenêtres de question de l'application (à la place de `prompt` et `confirm` du navigateur), affichées par
 * AppDialogs.vue. Une seule à la fois ; chaque fonction rend une promesse.
 */
export const dialog = reactive({ current: null });

function ask(request) {
  return new Promise((resolve) => {
    dialog.current = {
      ...request,
      resolve: (value) => {
        dialog.current = null;
        resolve(value);
      },
    };
  });
}

/** Demande un texte (un nom…) : rend le texte saisi, sans espaces autour, ou `null` si l'on annule ou s'il est vide. */
export const askText = ({ title, label, initial = '', okLabel, text }) =>
  ask({ kind: 'text', title, label, initial, okLabel, text }).then((v) => (typeof v === 'string' && v.trim() ? v.trim() : null));

/**
 * Demande de choisir entre plusieurs actions : `choices` est une liste `{ value, label, color? }` (la dernière est
 * le bouton principal). Rend la `value` choisie, ou `null` si l'on annule.
 */
export const askChoice = ({ title, text, lines = [], choices }) => ask({ kind: 'choice', title, text, lines, choices }).then((v) => v ?? null);

/** Demande une confirmation : rend `true` ou `false`. `danger` : bouton de confirmation en rouge ; `lines` : liste affichée sous le texte. */
export const askConfirm = ({ title, text, lines = [], okLabel, danger = false }) => ask({ kind: 'confirm', title, text, lines, okLabel, danger }).then((v) => v === true);
