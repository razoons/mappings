/**
 * Ouverture / export de fichiers via l'explorateur du système (File System Access API, Chrome et Edge).
 * Ailleurs : sélecteur de fichier classique pour ouvrir, téléchargement pour exporter.
 * Une annulation de l'utilisateur renvoie `null`.
 */
const TYPES = [{ description: 'Mapping JSON', accept: { 'application/json': ['.json'] } }];
// `id` : l'explorateur rouvre le dernier dossier utilisé pour les mappings.
const PICKER_ID = 'mapping';

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

/** `{ name, text }` du fichier choisi. */
export async function openFile() {
  try {
    let file;
    if (hasPicker) {
      const [handle] = await window.showOpenFilePicker({ id: PICKER_ID, types: TYPES });
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

/** Écrit `text` dans un fichier dont l'emplacement est choisi dans l'explorateur ; renvoie son nom. */
export async function exportFile(text, suggestedName) {
  try {
    if (hasPicker) {
      const handle = await window.showSaveFilePicker({ id: PICKER_ID, suggestedName, types: TYPES });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return handle.name;
    }
    const blob = new Blob([text], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: suggestedName });
    a.click();
    URL.revokeObjectURL(a.href);
    return suggestedName;
  } catch (e) {
    if (cancelled(e)) return null;
    throw e;
  }
}
