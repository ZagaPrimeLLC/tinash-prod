'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { MAX_SEARCH_LENGTH, searchTerms, type BoardSearchResult } from '@/lib/crm/board-search';
import type { WorkItem } from '@/lib/crm/board';

export function useBoardSearch(boardId: string, query: string, items: WorkItem[]) {
  const search = query.trim();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    boardId: string; search: string; items: WorkItem[]; attempt: number;
    data?: BoardSearchResult; error?: string;
  } | null>(null);
  const invalid = searchTerms(search).length > 8 ? 'Use up to 8 words or quoted phrases.' : null;

  useEffect(() => {
    if (!search || invalid) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/board-search?${new URLSearchParams({ board: boardId, q: search })}`, {
          signal: controller.signal, cache: 'no-store',
        });
        const data = await response.json();
        if (controller.signal.aborted) return;
        setResult({ boardId, search, items, attempt, ...(response.ok ? { data } : { error: data.error || 'Search failed. Please try again.' }) });
      } catch {
        if (!controller.signal.aborted) setResult({ boardId, search, items, attempt, error: 'Search failed. Check your connection and try again.' });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [boardId, search, items, invalid, attempt]);

  const current = result?.boardId === boardId && result.search === search && result.items === items && result.attempt === attempt ? result : null;
  return {
    searching: !!search && !invalid && !current,
    data: search && !invalid ? current?.data : undefined,
    error: search ? invalid ?? current?.error : undefined,
    retry: () => setAttempt((value) => value + 1),
  };
}

export default function BoardSearch({ query, onChange, searching, count, total, warning, error, onRetry, disabled }: {
  query: string; onChange: (value: string) => void; searching: boolean; count: number; total: number;
  warning?: string; error?: string | null; onRetry: () => void; disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const active = !!query.trim();
  return (
    <div role="search" aria-label="Work board" className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <label htmlFor="board-search" className="mb-2 block text-sm font-semibold text-plum-950">Search this board</label>
      <div className="relative">
        {searching ? <Loader2 aria-hidden="true" className="absolute left-3 top-3 h-5 w-5 animate-spin text-teal-700" /> :
          <Search aria-hidden="true" className="absolute left-3 top-3 h-5 w-5 text-teal-700" />}
        <input ref={input} id="board-search" type="search" value={query} maxLength={MAX_SEARCH_LENGTH}
          onChange={(event) => onChange(event.target.value)} disabled={disabled}
          onKeyDown={(event) => { if (event.key === 'Escape') onChange(''); }}
          placeholder="Search summaries, notes, labels, and comments…"
          aria-describedby="board-search-help board-search-status"
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-20 text-sm text-plum-950 outline-none focus:border-plum-700 focus:ring-2 focus:ring-plum-700/15 [&::-webkit-search-cancel-button]:hidden" />
        {query && <button type="button" disabled={disabled} onClick={() => { onChange(''); input.current?.focus(); }}
          className="absolute right-2 top-2 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-slate-100">
          <X aria-hidden="true" className="h-3.5 w-3.5" /> Clear
        </button>}
      </div>
      <p id="board-search-help" className="mt-2 text-xs leading-relaxed text-slate-500">
        Searches full text in every column, including Done. Add words to narrow results, or use &quot;quotes for a phrase&quot;.
      </p>
      <p id="board-search-status" role="status" className="mt-2 text-xs font-medium text-teal-700">
        {searching ? 'Searching…' : error ? 'Showing all items while search is unavailable.' : active ?
          `${count} of ${total} items match${warning ? ' in available text' : ''}. Clear search to reorder cards.` : `${total} items on this board.`}
      </p>
      {warning && <p role="status" className="mt-2 text-xs text-amber-800">{warning}</p>}
      {error && <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-sm text-red-700">
        <span>{error}</span><button type="button" onClick={onRetry} className="font-semibold underline">Retry</button>
      </div>}
    </div>
  );
}
