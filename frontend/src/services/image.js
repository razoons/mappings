import { getRectOfNodes } from '@vue-flow/core';
import { toBlob } from 'html-to-image';

/**
 * Image PNG de tout le schéma (et non de la seule partie visible) : le calque des nœuds et des liens de Vue Flow
 * est recadré sur l'ensemble des nœuds affichés, sur le fond du thème courant.
 */
const PADDING = 40;
// Les navigateurs refusent les canevas trop grands : la résolution est réduite pour un très grand schéma.
const MAX_CANVAS = 16000;

/**
 * La copie faite par html-to-image perd deux choses : l'option choisie d'une liste déroulante (elle afficherait
 * la première) et le `fill: none` des tracés de liens venu de la feuille de style (ils deviendraient des aplats
 * noirs). On les écrit dans le DOM le temps de la capture ; la fonction renvoyée remet tout en place.
 */
function prepareForCapture(pane) {
  const undo = [];
  for (const select of pane.querySelectorAll('select')) {
    const option = select.options[select.selectedIndex];
    if (option && !option.hasAttribute('selected')) {
      option.setAttribute('selected', '');
      undo.push(() => option.removeAttribute('selected'));
    }
  }
  for (const path of pane.querySelectorAll('.vue-flow__edge path')) {
    if (!path.hasAttribute('fill')) {
      path.setAttribute('fill', 'none');
      undo.push(() => path.removeAttribute('fill'));
    }
  }
  return () => undo.forEach((fn) => fn());
}

export async function schemaImage(nodes, flowEl) {
  // Nœuds rangés dans un groupe replié : masqués, ils ne comptent pas dans le cadrage.
  const shown = nodes.filter((n) => !n.hidden && !n.class?.masked);
  if (!shown.length) throw new Error('le schéma est vide');
  const rect = getRectOfNodes(shown);
  const width = Math.ceil(rect.width + 2 * PADDING);
  const height = Math.ceil(rect.height + 2 * PADDING);
  // Calque qui porte le zoom et le déplacement de la vue : on le recadre sur tout le schéma, à l'échelle 1.
  const pane = flowEl.querySelector('.vue-flow__transformationpane');
  const restore = prepareForCapture(pane);
  try {
    return await toBlob(pane, {
      width,
      height,
      pixelRatio: Math.min(2, MAX_CANVAS / Math.max(width, height)),
      backgroundColor: getComputedStyle(flowEl).backgroundColor,
      style: { width: `${width}px`, height: `${height}px`, transform: `translate(${PADDING - rect.x}px, ${PADDING - rect.y}px) scale(1)` },
      // Sans le lien d'aide « ? » des nœuds (affiché au survol seulement) ni les tracés invisibles qui élargissent
      // la zone cliquable des liens.
      filter: (el) => !el.classList?.contains('help-link') && !el.classList?.contains('vue-flow__edge-interaction'),
    });
  } finally {
    restore();
  }
}
