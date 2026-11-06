/** Documentation des nœuds en anglais : mêmes clés que `NODE_DOCS` (nodeDocs.js), plus les nœuds de `BASE_NODES`. */
export const NODE_DOCS_EN = {
  const_string: { summary: 'Provides a fixed text, typed in the node.' },
  const_number: { summary: 'Provides a fixed number. A comma is accepted as the decimal separator.' },
  const_bool: { summary: 'Provides true or false.' },
  now: {
    summary: 'Date and time at the moment of evaluation.',
    details: ['The value changes at every recalculation: use it for export dates, not for stable comparisons.'],
  },
  current: {
    summary: 'Item (and its index, from 0) of the list being iterated.',
    details: [
      'Plug it into a “for each item” (∀) input of a list node, or inside an iterated target array: it is then the item being processed.',
      'Outside any iteration, the item is empty and the index is 0.',
    ],
  },
  get_field: {
    summary: 'Reads a value in an object from a dotted path.',
    details: ['An index in brackets designates an array item: “lines[0].sku”.', 'A path that cannot be found gives an empty value.'],
  },
  set_field: {
    summary: 'Adds or replaces a key in an object, or in each object of a list.',
    details: [
      'The path can be dotted (“address.city”): intermediate objects are created.',
      'On a list, the value is evaluated for each object: plug “Current item” or a source field to give each one its own value.',
    ],
  },
  remove_field: {
    summary: 'Removes one or more keys from an object, or from each object of a list.',
    details: ['Keys separated by commas; a dotted path removes a nested key (“address.zip”).'],
  },
  list_create: {
    summary: 'Builds a list from its inputs A, B, C…',
    details: [
      'As many inputs as needed: as soon as an input is linked or filled, a new free input appears below.',
      'Linked inputs and typed values count, in order; an empty input is ignored.',
      'An input that already receives a list is flattened: its items are added one by one.',
    ],
  },
  list_filter: {
    summary: 'Keeps the items for which the condition is true.',
    details: ['The condition (∀) is evaluated for each item: build it from the item’s fields, e.g. Compare(status, “paid”).'],
  },
  list_sort: {
    summary: 'Sorts the list, ascending or descending.',
    details: [
      'Without a key, the items themselves are compared; with a key (∀), the key is compared, e.g. the date of each order.',
      'Two numeric values are compared as numbers, otherwise as texts (alphabetical order).',
    ],
  },
  list_map: {
    summary: 'Replaces each item with the value computed for it.',
    details: ['The value (∀) is evaluated for each item; the result has as many items as the original list.'],
  },
  list_at: {
    summary: 'Takes the item at a given index, from the start or from the end.',
    details: [
      'The index starts at 0: from the end, 0 is the last item.',
      'If “Value” (∀) is linked, you get the value computed for this item rather than the whole item.',
      'Out of bounds: empty value.',
    ],
  },
  list_find: {
    summary: 'First item that matches the condition.',
    details: ['“Found” tells whether an item was found; otherwise the item is empty.', 'If “Value” (∀) is linked, you get the value computed for the found item.'],
  },
  list_count: { summary: 'Number of items in the list.' },
  list_aggregate: {
    summary: 'Sum, average, minimum or maximum of the items.',
    details: [
      'Without “Value”, the items are converted to numbers; with “Value” (∀), it is the value that is aggregated, e.g. qty × price.',
      'An empty list gives 0.',
    ],
  },
  list_test: {
    summary: 'True if at least one, all, or none of the items match the condition.',
    details: ['On an empty list: “All” and “None” are true, “At least one” is false.'],
  },
  list_slice: { summary: 'Extracts part of the list: “Count” items from “Start” (index 0).' },
  list_reverse: { summary: 'Reverses the order of the items.' },
  list_unique: {
    summary: 'Removes duplicates, keeping the first occurrence.',
    details: ['With a key (∀), two items are duplicates if they have the same key, e.g. the same email.'],
  },
  list_join: { summary: 'Joins a list of texts into a single text, with a separator.' },
  concat: {
    summary:
      'Puts its inputs A, B, C… end to end, separated by the separator. The number of inputs is free: an empty input always appears at the bottom to add one.',
    details: ['Empty inputs are ignored: no double separator.'],
    guarantee: 'Max. length = sum of the inputs’ max. lengths + separators (if all are bounded). Required as soon as one input is.',
  },
  case: {
    summary: 'Puts the text in UPPERCASE, in lowercase, or capitalizes each word.',
    details: ['“Capitalize” puts a capital letter after a space, a hyphen or an apostrophe: “jean-luc” → “Jean-Luc”.'],
    guarantee: 'Keeps the min. and max. lengths of the input.',
  },
  trim: {
    summary: 'Removes spaces at the start and end, and reduces multiple spaces to one.',
    guarantee: 'Keeps the max. length of the input.',
  },
  substring: {
    summary: 'Keeps the first N characters (Left), the last N (Right), or N characters from a position (Middle).',
    details: [
      'In Middle mode, “Start” begins at 1 (like MID). It is ignored in the other modes.',
      'A shorter text is returned whole; an emoji or an accented letter counts as one character.',
    ],
    guarantee: 'Max. length = min(Chars, max. length of the input). In Left / Right, min. length = min(Chars, min. length of the input).',
  },
  replace: {
    summary: 'Replaces every occurrence of a text with another.',
    details: ['Literal, case-sensitive search (no regular expression).', 'Leaving “With” empty deletes the searched text.'],
  },
  split: {
    summary: 'Splits the text on a separator and keeps the piece at the given index.',
    details: ['The index starts at 0; a negative index counts from the end (-1 = last piece).', 'Index out of bounds: empty text.'],
  },
  split_list: { summary: 'Splits the text into a list on a separator; each piece is trimmed of its spaces.' },
  length: {
    summary: 'Number of characters of the text.',
    guarantee: 'Integer, between the min. and max. lengths of the input.',
  },
  math: {
    summary: 'Operation between two numbers A and B.',
    details: ['Division by 0: infinite result (or invalid for 0 / 0).', 'Modulo: remainder of the division of A by B.'],
  },
  round: { summary: 'Rounds to the nearest, down (floor) or up (ceiling), with a number of decimals.' },
  compare: {
    summary: 'Compares A and B; result true or false.',
    details: [
      'If A and B look like numbers, they are compared as numbers (“10” > “9”); otherwise as texts.',
      '“contains” and “starts with” work on the text, case-sensitive.',
    ],
  },
  logic: { summary: 'Combines two booleans: AND, OR, XOR.' },
  not: { summary: 'Inverts a boolean.' },
  switch: { summary: 'Returns “If true” when the condition is true, otherwise “If false”.' },
  coalesce: {
    summary: 'Returns the value, or the default value if it is empty.',
    details: ['Considered empty: missing, null, empty text, invalid date. 0 and false are not empty.'],
  },
  to_string: {
    summary: 'Converts a value to text.',
    details: ['A date becomes an ISO 8601 text, an object or a list its JSON.'],
  },
  to_number: {
    summary: 'Converts a value to a (decimal) number.',
    details: ['A decimal comma is accepted (“3,5” → 3.5). True → 1, false → 0, a date → its timestamp in ms.', 'Empty text → 0; non-numeric text → invalid.'],
  },
  to_integer: {
    summary: 'Converts a number to an integer: truncated (integer part), rounded, floor or ceiling.',
    details: [
      'Truncate and Floor differ for negatives: -2.7 → -2 (truncated), -3 (floor).',
      'Put it before an Integer target field fed by a decimal number: the conversion becomes explicit and is no longer reported.',
    ],
  },
  to_bool: {
    summary: 'Converts a value to a boolean.',
    details: ['True texts: true, 1, oui, yes, vrai, y, o, x (case-insensitive). Everything else is false.', 'Number: true if it is not 0.'],
  },
  date_format: {
    summary: 'Writes a date as text in the chosen format.',
    details: ['Computed in UTC.', 'Invalid date: empty text.'],
  },
  date_part: {
    summary: 'Extracts the year, the month, the day of the month or the day of the week: as a number and as a name.',
    details: [
      'Number: month from 1 to 12; day of the week 0 = Sunday, 1 = Monday … 6 = Saturday.',
      'Name (text): the day of the week or the month, taken from the comma-separated list typed in the node: the 7 days from Monday to Sunday (Days setting), or the 12 months from January to December (Months setting). Your choice: “Mon, Tue, Wed…”, “lundi, mardi…”, “M, T, W, T, F, S, S”… For the year and the day of the month, it is the number as text.',
      'A name missing from the list gives an empty text.',
      'Computed in UTC.',
    ],
  },
  age: {
    summary: 'Number of full years between the date and the reference.',
    details: ['Without a reference (or with an invalid one), today’s date is used.'],
  },

  // ── Nœuds de structure (BASE_NODES) ─────────────────────
  source: {
    label: 'Source',
    summary: 'Describes the input data: its data model (fields, types, required and formats).',
    details: [
      'Each field has an output socket. Under an array, a field produces the list of its values (diamond), except when this array is being iterated.',
      'The { } button edits the data model in YAML (type, required, format and example of each field); “Import a JSON example” infers it from a document. Fields found by name keep their links. Examples are used for the calculation until a data file is loaded; a list of objects can receive the full list as its example.',
      'A data file dropped on the node (or loaded with ⤒) replaces the model’s values for the calculation, without changing the model. It is checked: ⛔ required missing, type or format not respected; ⚠ extra field. It is not saved with the mapping.',
      'Rules: * makes a field required, ⚙ sets its format. They are used to check the target fields it feeds.',
    ],
  },
  target: {
    label: 'Target',
    summary: 'Describes the document to produce. Each field receives a value through a link; the Value column shows the one obtained with the sources’ data.',
    details: [
      'The Result button shows the JSON produced (with the loaded data files, otherwise the data models’ values), its conformity to the target’s model, and lets you copy or export it.',
      'Linking a list to an array of objects iterates it: its sub-fields are evaluated for each item.',
      'Without a link on the array, the first source list linked to one of its sub-fields drives the iteration.',
      'An object linked to a source object copies it; the linked sub-fields replace their values in it.',
      'Checks: ⛔ required not mapped; ⛔ incompatible types; ⚠ type implicitly converted; ⚠ required fed by an optional source; ⚠ format not guaranteed. Details in the Checks panel.',
    ],
  },
  group: {
    label: 'Group',
    summary: 'Frame that organizes nodes. No effect on the calculation.',
    details: [
      'Ctrl G groups the selection. Dragging a node into the frame puts it in, out of the frame takes it out.',
      'Collapsed, the group shrinks to its header and the links of its nodes end there. Deleting it keeps its nodes.',
    ],
  },
};
