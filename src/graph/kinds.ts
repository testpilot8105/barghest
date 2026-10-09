// The docked Timeline's series: one colour per kind of event, as Gotham colours each dated property (owner's approval,
// 10.10.2026, of the Graph design in the Content file). Blueprint's -3 shades, handed out busiest kind first so the
// big series always get the same strong colours; past fourteen kinds the list starts again.
const PALETTE = ['rose', 'lime', 'violet', 'turquoise', 'gold', 'vermilion', 'indigo', 'forest', 'cerulean', 'sepia', 'blue', 'red', 'orange', 'green'];

/** Kinds by how many events they have, most first, each with its palette variable. */
export function kindColours(counts: Map<string, number>): Array<{ kind: string; count: number; colour: string }> {
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([kind, count], i) => ({ kind, count, colour: `var(--bp-palette-${PALETTE[i % PALETTE.length]}-3)` }));
}
