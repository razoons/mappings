import { lang } from './i18n';

/**
 * Formats de date d'un champ Date ou Date et heure (`format.dateFormat`) : la valeur est un texte écrit dans ce
 * format (ex. `31/01/2026` pour `DD/MM/YYYY`). Une source le lit en date, une cible écrit la date dans ce format.
 * Sans format, une date s'écrit en ISO 8601 (`2026-01-31`, `2026-01-31T08:30:00`).
 *
 * Jetons (forme canonique, celle qui est enregistrée) : `YYYY` (année), `YY` (année sur 2 chiffres), `MM` (mois),
 * `DD` (jour), `HH` (heure 00-23), `mm` (minutes), `ss` (secondes) ; tout autre caractère est pris tel quel.
 * À la saisie, la casse est libre (`dd/mm/yyyy`) et les jetons français sont acceptés (`JJ/MM/AAAA`) : `mm` vaut
 * les minutes juste après une heure (`HH:mm`), le mois sinon.
 */

export const isDateType = (type) => type === 'date' || type === 'datetime';

/** Formats proposés, par type de champ. */
export const DATE_FORMAT_PRESETS = {
  date: ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY', 'DD.MM.YYYY', 'YYYY/MM/DD', 'YYYYMMDD', 'DD/MM/YY'],
  datetime: [
    'YYYY-MM-DDTHH:mm:ss',
    'YYYY-MM-DD HH:mm:ss',
    'YYYY-MM-DD HH:mm',
    'DD/MM/YYYY HH:mm:ss',
    'DD/MM/YYYY HH:mm',
    'MM/DD/YYYY HH:mm',
    'YYYYMMDDHHmmss',
  ],
};

/** Format d'une date sans format choisi : ISO 8601. */
export const DEFAULT_DATE_FORMATS = { date: 'YYYY-MM-DD', datetime: 'YYYY-MM-DDTHH:mm:ss' };

/** Format réellement utilisé par une valeur de type `type` (`date`, `datetime`) : le sien, ou ISO. */
export const effectiveDateFormat = (type, format) => format || DEFAULT_DATE_FORMATS[type];

/** Le format comporte-t-il une heure ? */
export const hasTime = (format) => tokenize(format).some((p) => TIME.has(p.token));

const TIME = new Set(['HH', 'mm', 'ss']);

/** Découpe un format en jetons `{ token }` et textes `{ text }` (saisie libre, voir plus haut). */
function tokenize(input) {
  const parts = [];
  let last = null; // dernier jeton rencontré
  let i = 0;
  const s = String(input);
  while (i < s.length) {
    const four = s.slice(i, i + 4).toLowerCase();
    const two = s.slice(i, i + 2).toLowerCase();
    let token = null;
    let len = 2;
    if (four === 'yyyy' || four === 'aaaa') [token, len] = ['YYYY', 4];
    else if (two === 'yy' || two === 'aa') token = 'YY';
    else if (two === 'dd' || two === 'jj') token = 'DD';
    else if (two === 'hh') token = 'HH';
    else if (two === 'ss') token = 'ss';
    else if (two === 'mm') token = last === 'HH' ? 'mm' : 'MM';
    if (token) {
      parts.push({ token });
      last = token;
      i += len;
    } else {
      const prev = parts.at(-1);
      if (prev?.text !== undefined) prev.text += s[i];
      else parts.push({ text: s[i] });
      i++;
    }
  }
  return parts;
}

const canonical = (parts) => parts.map((p) => p.token ?? p.text).join('');

/**
 * Forme canonique d'un format saisi (`'dd/mm/yyyy'` → `'DD/MM/YYYY'`), ou `{ error }` s'il n'est pas utilisable
 * pour `type` (`date` : année, mois et jour, sans heure ; `datetime` : avec au moins l'heure).
 */
export function normalizeDateFormat(input, type = 'date') {
  const parts = tokenize(String(input ?? '').trim());
  const tokens = parts.filter((p) => p.token).map((p) => p.token);
  const count = (tk) => tokens.filter((x) => x === tk).length;
  const years = count('YYYY') + count('YY');
  if (years !== 1 || count('MM') !== 1 || count('DD') !== 1) return { error: 'ymd' };
  if (['HH', 'mm', 'ss'].some((tk) => count(tk) > 1)) return { error: 'duplicate' };
  const hasTime = tokens.some((tk) => TIME.has(tk));
  if (type === 'date' && hasTime) return { error: 'time-in-date' };
  if (type === 'datetime' && !count('HH')) return { error: 'no-hour' };
  if ((count('ss') && !count('mm')) || (count('mm') && !count('HH'))) return { error: 'time-gap' };
  return { format: canonical(parts) };
}

/** Message d'erreur d'un format refusé par `normalizeDateFormat`. */
export function dateFormatError(error, t) {
  return (
    {
      ymd: t('il faut une fois l’année (AAAA ou AA), le mois (MM) et le jour (JJ)', 'year (YYYY or YY), month (MM) and day (DD) are each needed once'),
      duplicate: t('heure, minutes ou secondes en double', 'hour, minutes or seconds repeated'),
      'time-in-date': t('pas d’heure dans le format d’une date (choisissez le type Date et heure)', 'no time in a date format (choose the Date and time type)'),
      'no-hour': t('il faut l’heure (HH) dans le format d’une date et heure', 'a date-time format needs the hour (HH)'),
      'time-gap': t('minutes sans heure ou secondes sans minutes', 'minutes without hour or seconds without minutes'),
    }[error] ?? error
  );
}

/** Format tel qu'affiché dans la langue de l'interface (`JJ/MM/AAAA` en français). */
export function displayDateFormat(format) {
  if (!format || lang.value !== 'fr') return format ?? '';
  return tokenize(format)
    .map((p) => (p.token ? ({ YYYY: 'AAAA', YY: 'AA', DD: 'JJ' }[p.token] ?? p.token) : p.text))
    .join('');
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Lit un texte écrit dans `format` (date UTC) ; date invalide s'il ne le respecte pas ou si la date n'existe pas (31/02). */
export function parseDate(text, format) {
  const parts = tokenize(format);
  const order = [];
  const re = new RegExp(
    `^${parts
      .map((p) => {
        if (!p.token) return escape(p.text);
        order.push(p.token);
        return p.token === 'YYYY' ? '(\\d{4})' : '(\\d{2})';
      })
      .join('')}$`,
  );
  const m = re.exec(String(text).trim());
  if (!m) return new Date(NaN);
  const v = { YYYY: null, YY: null, MM: 1, DD: 1, HH: 0, mm: 0, ss: 0 };
  order.forEach((tk, i) => (v[tk] = Number(m[i + 1])));
  const year = v.YYYY ?? (v.YY < 70 ? 2000 + v.YY : 1900 + v.YY);
  const d = new Date(Date.UTC(year, v.MM - 1, v.DD, v.HH, v.mm, v.ss));
  const same =
    d.getUTCFullYear() === year && d.getUTCMonth() === v.MM - 1 && d.getUTCDate() === v.DD && d.getUTCHours() === v.HH && d.getUTCMinutes() === v.mm && d.getUTCSeconds() === v.ss;
  return same ? d : new Date(NaN);
}

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** Écrit une date (UTC) dans `format`. */
export function formatDate(date, format) {
  const v = {
    YYYY: pad(date.getUTCFullYear(), 4),
    YY: pad(date.getUTCFullYear() % 100),
    MM: pad(date.getUTCMonth() + 1),
    DD: pad(date.getUTCDate()),
    HH: pad(date.getUTCHours()),
    mm: pad(date.getUTCMinutes()),
    ss: pad(date.getUTCSeconds()),
  };
  return tokenize(format)
    .map((p) => (p.token ? v[p.token] : p.text))
    .join('');
}

/** Type simple d'un champ (celui de ses éléments pour une liste). */
const scalarType = (f) => (f.type === 'array' ? f.item ?? 'string' : f.type);

/** Format de date d'un champ (`undefined` s'il n'en a pas ou si ce n'est pas une date). */
export const dateFormatOf = (f) => (isDateType(scalarType(f)) ? f.format?.dateFormat || undefined : undefined);

/** Un texte devient une date selon le format (ou ISO s'il ne le respecte pas) ; le reste est rendu tel quel. */
function toDate(v, format) {
  if (typeof v !== 'string') return v;
  const d = parseDate(v, format);
  return Number.isNaN(d.getTime()) ? v : d;
}

/** Valeur lue dans un champ source : un texte au format de date du champ devient une date. */
export function readDateValue(f, v) {
  const format = dateFormatOf(f);
  if (!format) return v;
  return Array.isArray(v) ? v.map((x) => toDate(x, format)) : toDate(v, format);
}

/** Valeur écrite dans un champ cible : une date valide est écrite au format de date du champ. */
export function writeDateValue(f, v) {
  const format = dateFormatOf(f);
  if (!format) return v;
  const write = (x) => (x instanceof Date && !Number.isNaN(x.getTime()) ? formatDate(x, format) : x);
  return Array.isArray(v) ? v.map(write) : write(v);
}
