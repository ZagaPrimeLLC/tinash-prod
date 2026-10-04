import { getSession } from '@/lib/crm/session';
import { loadBoardItems } from '@/lib/crm/board-data';
import { commentSearchFilter, matchItem, searchTerms, MAX_SEARCH_LENGTH, type SearchMatch } from '@/lib/crm/board-search';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'private, no-store' },
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const boardId = params.get('board') ?? '';
  const query = (params.get('q') ?? '').trim();
  const terms = searchTerms(query);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(boardId) ||
      !terms.length || terms.length > 8 || query.length > MAX_SEARCH_LENGTH) {
    return json({ error: 'Enter up to 8 words or quoted phrases (200 characters maximum).' }, 400);
  }

  try {
    const { supabase, user, role, failed } = await getSession();
    if (!user) return json({ error: 'Sign in to search the work board.' }, 401);
    if (failed) return json({ error: 'Could not check access. Please try again.' }, 503);
    if (!role) return json({ error: 'Your account cannot access the work board.' }, 403);
    const { data: board, error: boardError } = await supabase.from('boards').select('id')
      .eq('id', boardId).eq('archived', false).maybeSingle();
    if (boardError) return json({ error: 'Could not load the board. Please try again.' }, 503);
    if (!board) return json({ error: 'This board is not available.' }, 404);

    // Every query uses the signed-in client and the existing row policies.
    const items = await loadBoardItems(supabase, boardId, request.signal);
    const comments = new Map<string, string[]>();
    let warning: string | undefined;
    const filter = commentSearchFilter(terms);
    commentsLoop: for (let start = 0; start < items.length; start += 100) {
      const ids = items.slice(start, start + 100).map((item) => item.id);
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('task_comments').select('id, task_id, body')
          .in('task_id', ids).or(filter).order('id').range(offset, offset + 499).abortSignal(request.signal);
        if (error) {
          // Notes remain searchable even before the comments migration is applied.
          comments.clear();
          warning = 'Comments could not be searched. Results include summaries, notes, and labels only.';
          break commentsLoop;
        }
        for (const row of data ?? []) comments.set(row.task_id, [...(comments.get(row.task_id) ?? []), row.body]);
        if ((data?.length ?? 0) < 500) break;
      }
    }
    const matches: Record<string, SearchMatch> = {};
    for (const item of items) {
      const match = matchItem(item, terms, comments.get(item.id));
      if (match) matches[item.id] = match;
    }
    return json({ matches, ...(warning ? { warning } : {}) });
  } catch {
    return json({ error: 'Search is unavailable right now. Please try again.' }, 503);
  }
}
