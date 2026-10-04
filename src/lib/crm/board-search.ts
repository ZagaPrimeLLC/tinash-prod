import type { WorkItem } from './board';

export type SearchMatch = { sources: string[]; excerpt: string };
export type BoardSearchResult = { matches: Record<string, SearchMatch>; warning?: string };
export const MAX_SEARCH_LENGTH = 200;

export function searchTerms(query: string): string[] {
  return [...new Set(Array.from(query.matchAll(/"([^"]+)"|(\S+)/g), (match) =>
    (match[1] ?? match[2]).toLowerCase().trim()
  ).filter(Boolean))];
}

export function searchExcerpt(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  const positions = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0);
  const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 45);
  const end = Math.min(text.length, start + 190);
  return `${start ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ')}${end < text.length ? '…' : ''}`;
}

export function matchItem(item: Pick<WorkItem, 'title' | 'notes' | 'labels'>, terms: string[], comments: string[] = []): SearchMatch | null {
  const fields = [
    { source: 'Summary', text: item.title },
    { source: 'Notes', text: item.notes ?? '' },
    { source: 'Labels', text: (item.labels ?? []).join(' ') },
    ...comments.map((text) => ({ source: 'Comment', text })),
  ];
  if (!terms.every((term) => fields.some(({ text }) => text.toLowerCase().includes(term)))) return null;
  const matching = fields.filter(({ text }) => terms.some((term) => text.toLowerCase().includes(term)));
  // Show a match hidden by the card preview before repeating its summary.
  const excerpt = matching.find(({ source }) => source === 'Comment') ?? matching.find(({ source }) => source === 'Notes') ?? matching[0];
  return { sources: [...new Set(matching.map(({ source }) => source))], excerpt: excerpt ? searchExcerpt(excerpt.text, terms) : '' };
}

// LIKE treats %, _ and backslash specially; PostgREST also treats * as %.
// Escape SQL wildcards, then quote the whole value for the URL filter grammar.
// A literal * is narrowed again by matchItem after this broad database filter.
export function commentSearchFilter(terms: string[]): string {
  return terms.map((term) => {
    const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
    return `body.ilike."${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }).join(',');
}
