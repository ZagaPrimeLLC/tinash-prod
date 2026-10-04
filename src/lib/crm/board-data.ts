import type { createClient } from '@/lib/supabase/server';
import type { WorkItem } from './board';

type DatabaseClient = Awaited<ReturnType<typeof createClient>>;

const PAGE_SIZE = 500;

/** Read every page, rather than silently dropping cards at the API row limit. */
export async function loadBoardItems(supabase: DatabaseClient, boardId: string, signal?: AbortSignal): Promise<WorkItem[]> {
  const items: WorkItem[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase.from('board_items').select('task_id, position, tasks(*)')
      .eq('board_id', boardId).order('task_id').range(offset, offset + PAGE_SIZE - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw new Error('Could not load the board items. Please try again.');
    for (const row of data ?? []) {
      const task = row.tasks as unknown as WorkItem | null;
      if (task) items.push({ ...task, position: row.position, boardIds: [boardId] });
    }
    if ((data?.length ?? 0) < PAGE_SIZE) return items;
  }
}

export async function loadItemBoardLinks(supabase: DatabaseClient, items: WorkItem[]): Promise<void> {
  const links = new Map<string, string[]>();
  // Small ID batches keep request URLs within proxy limits.
  for (let start = 0; start < items.length; start += 100) {
    const ids = items.slice(start, start + 100).map((item) => item.id);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase.from('board_items').select('task_id, board_id')
        .in('task_id', ids).order('task_id').order('board_id').range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error('Could not load the linked boards. Please try again.');
      for (const row of data ?? []) links.set(row.task_id, [...(links.get(row.task_id) ?? []), row.board_id]);
      if ((data?.length ?? 0) < PAGE_SIZE) break;
    }
  }
  for (const item of items) item.boardIds = links.get(item.id) ?? item.boardIds;
}
