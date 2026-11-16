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

// Explorateur de Chrome / Edge (File System Access API) désactivé : sur certains postes, Chrome le referme en
// « annulé » sans rien ouvrir ni écrire. Sélecteur de fichier classique pour ouvrir, téléchargement pour enregistrer.
const hasPicker = false;

const cancelled = (e) => e?.name === 'AbortError';

/**
 * Téléchargement de `content` (texte JSON ou `Blob`) sous `name`. Le lien est ajouté à la page (Firefox) et son
 * adresse n'est libérée qu'une minute après : si le navigateur demande où enregistrer, le téléchargement ne
 * démarre qu'une fois l'emplacement choisi, et une adresse déjà libérée ne donnerait aucun fichier.
 */
export function download(content, name) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name, style: 'display:none' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

function pickWithInput() {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
    input.addEventListener('change', () => resolve(input.files[0] ?? null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/**
 * `{ name, text, handle }` du fichier choisi (`data` : un fichier de données plutôt qu'un mapping) ; `handle` permet
 * d'y réécrire plus tard (`null` hors Chrome / Edge).
 */
export async function openFile({ data = false } = {}) {
  try {
    let file;
    let handle = null;
    if (hasPicker) {
      [handle] = await window.showOpenFilePicker(data ? { id: 'data', types: DATA_TYPES } : { id: PICKER_ID, types: TYPES });
      file = await handle.getFile();
    } else {
      file = await pickWithInput();
    }
    return file && { name: file.name, text: await file.text(), handle };
  } catch (e) {
    if (cancelled(e)) return null;
    throw e;
  }
}

/**
 * Explorateur « Enregistrer sous » : le fichier choisi, ou `null` si l'on annule. Seule l'annulation dans
 * l'explorateur compte comme telle : une erreur à l'écriture qui suit doit être signalée, pas passée sous silence.
 */
async function pickSaveFile(options) {
  try {
    const handle = await window.showSaveFilePicker(options);
    return handle;
  } catch (e) {
    if (cancelled(e)) return null;
    throw e;
  }
}

/** Écrit `content` (texte ou `Blob`) dans le fichier `handle`. */
async function write(handle, content) {
  try {
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  } catch (e) {
    throw new Error(`${e.name}: ${e.message}`);
  }
}

/**
 * Écrit `content` (texte, ou `Blob` pour une image) dans un fichier dont l'emplacement est choisi dans
 * l'explorateur ; renvoie son nom, ou `null` si l'on annule. `data` : fichier de données JSON ; `image` : image
 * PNG (sinon un mapping).
 */
export async function exportFile(content, suggestedName, { data = false, image = false } = {}) {
  if (!hasPicker) {
    download(content, suggestedName);
    return suggestedName;
  }
  const picker = image
    ? { id: 'image', suggestedName, types: IMAGE_TYPES }
    : data
      ? { id: 'data', suggestedName, types: DATA_TYPES }
      : { id: PICKER_ID, suggestedName, types: TYPES };
  const handle = await pickSaveFile(picker);
  if (!handle) return null;
  await write(handle, content);
  return handle.name;
}

/** Le navigateur sait-il réécrire un fichier déjà choisi (Chrome, Edge) ? */
export const canWriteBack = hasPicker;

/** Réécrit `text` dans le fichier `handle` (avec l'accord de l'utilisateur si le navigateur le redemande). */
export async function writeToHandle(handle, text) {
  const mode = { mode: 'readwrite' };
  if ((await handle.queryPermission?.(mode)) !== 'granted' && (await handle.requestPermission?.(mode)) !== 'granted') {
    throw new Error('permission refusée');
  }
  await write(handle, text);
}

/**
 * Enregistre `text` dans un fichier dont l'emplacement et le nom sont choisis dans l'explorateur (nom proposé :
 * `suggestedName`). Rend `{ name, handle }`, ou `null` si l'on annule. Hors Chrome / Edge : téléchargement sous
 * `suggestedName` (`handle` : `null`).
 */
export async function saveFileAs(text, suggestedName) {
  if (!hasPicker) {
    download(text, suggestedName);
    return { name: suggestedName, handle: null };
  }
  const handle = await pickSaveFile({ id: PICKER_ID, suggestedName, types: TYPES });
  if (!handle) return null;
  await writeToHandle(handle, text);
  return { name: handle.name, handle };
}
