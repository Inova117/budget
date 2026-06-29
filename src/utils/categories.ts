// Map the AI's generic fallbacks to the canonical "Miscellaneous" bucket so we
// don't mint near-duplicate per-user categories, AND so the confirm modal shows
// the SAME label that will actually be saved.
export const MISC_ALIASES = new Set([
    'other', 'others', 'otro', 'otros', 'misc', 'varios', 'miscelaneo', 'misceláneo',
]);

export function canonicalCategory(name: string): string {
    const n = (name ?? '').trim();
    return MISC_ALIASES.has(n.toLowerCase()) ? 'Miscellaneous' : n;
}
