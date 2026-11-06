/**
 * Ouverture / export de fichiers via l'explorateur du système (File System Access API, Chrome et Edge).
 * Ailleurs : sélecteur de fichier classique pour ouvrir, téléchargement pour exporter.
 * Une annulation de l'utilisateur renvoie `null`.
 */
const TYPES = [{ description: 'Mapping JSON', accept: { 'application/json': ['.json'] } }];
// `id` : l'explorateur rouvre le dernier dossier utilisé pour les mappings (et, à part, pour les données).
const PICKER_ID = 'mapping';
const DATA_TYPES = [{ description: 'JSON', accept: { 'application/json': ['.json'] } }];
const IMAGE_TYPES = [{ description: 'Image PNG', accept: { 'image/png': ['.png'] } }];

const hasPicker = 'showOpenFilePicker' in window;

const cancelled = (e) => e?.name === 'AbortError';

function pickWithInput() {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
    input.addEventListener('change', () => resolve(input.files[0] ?? null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/** `{ name, text }` du fichier choisi (`data` : un fichier de données plutôt qu'un mapping). */
export async function openFile({ data = false } = {}) {
  try {
    let file;
    if (hasPicker) {
      const [handle] = await window.showOpenFilePicker(data ? { id: 'data', types: DATA_TYPES } : { id: PICKER_ID, types: TYPES });
      file = await handle.getFile();
    } else {
      file = await pickWithInput();
    }
    return file && { name: file.name, text: await file.text() };
  } catch (e) {
    if (cancelled(e)) return null;
    throw e;
  }
}

/**
 * Écrit `content` (texte, ou `Blob` pour une image) dans un fichier dont l'emplacement est choisi dans
 * l'explorateur ; renvoie son nom. `data` : fichier de données JSON ; `image` : image PNG (sinon un mapping).
 */
export async function exportFile(content, suggestedName, { data = false, image = false } = {}) {
  try {
    if (hasPicker) {
      const picker = image
        ? { id: 'image', suggestedName, types: IMAGE_TYPES }
        : data
          ? { id: 'data', suggestedName, types: DATA_TYPES }
          : { id: PICKER_ID, suggestedName, types: TYPES };
      const handle = await window.showSaveFilePicker(picker);
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return handle.name;
    }
    const blob = content instanceof Blob ? content : new Blob([content], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: suggestedName });
    a.click();
    URL.revokeObjectURL(a.href);
    return suggestedName;
  } catch (e) {
    if (cancelled(e)) return null;
    throw e;
  }
}
