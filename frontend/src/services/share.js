/**
 * Partage d'un mapping par lien : le mapping est compressé (deflate) puis encodé en base64url dans le fragment
 * de l'adresse (`…/#m=…`). Le fragment n'est jamais envoyé au serveur : rien n'est stocké, le lien contient tout.
 */
const PREFIX = '#m=';

async function pipe(bytes, transform) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Lien de partage du mapping `graph` (objet JSON). */
export async function shareLink(graph) {
  const bytes = await pipe(new TextEncoder().encode(JSON.stringify(graph)), new CompressionStream('deflate-raw'));
  return `${location.origin}/${PREFIX}${toBase64Url(bytes)}`;
}

/** Mapping contenu dans l'adresse courante, ou `null` s'il n'y en a pas. Lève une erreur si le lien est abîmé. */
export async function sharedGraph() {
  if (!location.hash.startsWith(PREFIX)) return null;
  const bytes = await pipe(fromBase64Url(location.hash.slice(PREFIX.length)), new DecompressionStream('deflate-raw'));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Retire le mapping de l'adresse (un rechargement reprend alors la sauvegarde du navigateur). */
export const clearSharedGraph = () => history.replaceState(history.state, '', location.pathname + location.search);
