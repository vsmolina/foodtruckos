// Classify a ticket's special instructions so the KDS can make them impossible
// to miss. Square sends modifiers as free text ("No Ketchup", "Add Mustard",
// "Extra Cheese"); we key off the leading word, and every kind gets a word
// label as well as a colour, so it reads for colour-blind cooks too.

export type ModKind = 'remove' | 'add' | 'extra' | 'plain';

export type ClassifiedMod = { kind: ModKind; label: string | null; text: string };

const PREFIXES: Array<{ re: RegExp; kind: ModKind; label: string }> = [
  { re: /^(no|without|hold( the)?|sin|remove|minus)\s+/i, kind: 'remove', label: 'NO' },
  { re: /^(extra|double|xtra)\s+/i, kind: 'extra', label: 'EXTRA' },
  { re: /^(add|with|plus|con)\s+/i, kind: 'add', label: 'ADD' },
];

export function classifyModifier(raw: string): ClassifiedMod {
  const name = raw.trim();
  for (const p of PREFIXES) {
    const m = name.match(p.re);
    if (m) return { kind: p.kind, label: p.label, text: name.slice(m[0].length) };
  }
  return { kind: 'plain', label: null, text: name };
}

const ALLERGY_RE =
  /\b(allerg\w*|anaphyla\w*|celiac|gluten|peanut\w*|tree ?nut\w*|nuts?|shellfish|dairy|lactose|sesame|soy|egg allergy)\b/i;

/** A note that names an allergy or a dietary hazard. */
export function isAllergyNote(note: string): boolean {
  return ALLERGY_RE.test(note);
}
