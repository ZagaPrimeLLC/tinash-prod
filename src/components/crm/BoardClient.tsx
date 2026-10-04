'use client';

import { useState, useTransition, useMemo } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, closestCorners, useDroppable,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { Plus, X, Loader2 } from 'lucide-react';
import {
  STAGES, WORK_TYPES, PRIORITIES, type WorkItem, type Board,
} from '@/lib/crm/board';
import BoardCard, { CardBody } from '@/components/crm/BoardCard';
import BoardSearch, { useBoardSearch } from '@/components/crm/BoardSearch';
import {
  createItem, moveItem, claimItem, setBoardLink, applyColumnOrder,
} from '@/app/(dashboard)/dashboard/board/actions';

const stageIndex = (k: string) => STAGES.findIndex((s) => s.key === k);

function Column({
  stage, children, disabled,
}: { stage: string; children: React.ReactNode; disabled: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${stage}`, data: { stage }, disabled });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[8rem] space-y-2.5 rounded-lg p-1 transition ${
        isOver ? 'bg-plum-700/5 ring-2 ring-dashed ring-plum-700/25' : ''
      }`}
    >
      {children}
    </div>
  );
}

export default function BoardClient({
  items, canWrite, userId, boards, board,
}: {
  items: WorkItem[]; canWrite: boolean; userId: string | null;
  boards: Board[]; board: Board;
}) {
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const filterOn = !!query.trim();
  const search = useBoardSearch(board.id, query, items);

  // Local copy so a drag lands instantly. The server refreshes it afterwards.
  const [cards, setCards] = useState<WorkItem[]>(items);
  // When the server sends fresh items, reset the local copy during render (no effect, no extra paint).
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setCards(items);
  }

  const sensors = useSensors(
    // A small drag threshold so clicking a button on the card still works.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // On a phone, a short hold starts the drag so the board can still scroll.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const visibleCards = useMemo(() => search.data ? cards.filter((card) => !!search.data?.matches[card.id]) : cards, [cards, search.data]);

  const byStage = useMemo(() => {
    const m: Record<string, WorkItem[]> = {};
    for (const s of STAGES) m[s.key] = [];
    for (const c of [...visibleCards].sort((a, b) => a.position - b.position)) {
      (m[c.stage] ??= []).push(c);
    }
    return m;
  }, [visibleCards]);

  const active = activeId ? cards.find((c) => c.id === activeId) ?? null : null;

  /**
   * What a screen reader says during a keyboard drag. Without these, dnd-kit
   * announces the raw row id ("item sample-9 was moved over sample-9"), which
   * tells a blind user nothing about where their card went.
   */
  const titleOf = (id: string) => cards.find((c) => c.id === id)?.title ?? 'card';
  const columnOfId = (id: string) => {
    const key = id.startsWith('col:') ? id.slice(4) : cards.find((c) => c.id === id)?.stage;
    return STAGES.find((s) => s.key === key)?.label ?? 'the board';
  };

  const announcements = {
    onDragStart: ({ active: a }: { active: { id: string | number } }) =>
      `Picked up ${titleOf(String(a.id))}. Use the arrow keys to move it, space to drop it, escape to cancel.`,
    onDragOver: ({ active: a, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
      over ? `${titleOf(String(a.id))} is over ${columnOfId(String(over.id))}.` : '',
    onDragEnd: ({ active: a, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
      over
        ? `Dropped ${titleOf(String(a.id))} into ${columnOfId(String(over.id))}.`
        : `${titleOf(String(a.id))} was returned to where it started.`,
    onDragCancel: ({ active: a }: { active: { id: string | number } }) =>
      `Cancelled. ${titleOf(String(a.id))} is back where it started.`,
  };

  function columnOf(id: string): string | null {
    if (id.startsWith('col:')) return id.slice(4);
    return cards.find((c) => c.id === id)?.stage ?? null;
  }

  function onDragStart(e: DragStartEvent) {
    if (filterOn) return;
    setActiveId(String(e.active.id));
    setError(null);
  }

  /** Moves the card between columns while the pointer is still down. */
  function onDragOver(e: DragOverEvent) {
    if (filterOn) return;
    const { active: a, over } = e;
    if (!over) return;
    const from = columnOf(String(a.id));
    const to = columnOf(String(over.id));
    if (!from || !to || from === to) return;

    setCards((prev) =>
      prev.map((c) => (c.id === String(a.id) ? { ...c, stage: to } : c))
    );
  }

  function onDragEnd(e: DragEndEvent) {
    const { active: a, over } = e;
    setActiveId(null);
    if (filterOn) return;
    if (!over) return;

    const movedId = String(a.id);
    const target = columnOf(String(over.id));
    if (!target) return;

    // Settle the order inside the destination column.
    const col = [...(byStage[target] ?? [])];
    const oldIndex = col.findIndex((c) => c.id === movedId);
    const overIndex = col.findIndex((c) => c.id === String(over.id));
    const ordered =
      oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex
        ? arrayMove(col, oldIndex, overIndex)
        : col;

    setCards((prev) => {
      const others = prev.filter((c) => c.stage !== target);
      return [
        ...others,
        ...ordered.map((c, i) => ({ ...c, stage: target, position: (i + 1) * 1000 })),
      ];
    });

    const ids = ordered.map((c) => c.id);
    start(async () => {
      const r = await applyColumnOrder(board.id, target, ids, movedId);
      if (!r.ok) {
        setError(r.error);
        setCards(items); // put it back where it was
      }
    });
  }

  function move(item: WorkItem, dir: -1 | 1) {
    const next = STAGES[stageIndex(item.stage) + dir];
    if (!next) return;
    setBusyId(item.id);
    setError(null);
    start(async () => {
      const r = await moveItem(item.id, next.key);
      if (!r.ok) setError(r.error);
      setBusyId(null);
    });
  }

  function claim(item: WorkItem) {
    setBusyId(item.id);
    setError(null);
    start(async () => {
      const r = await claimItem(item.id, item.owner_id !== userId);
      if (!r.ok) setError(r.error);
      setBusyId(null);
    });
  }

  function share(item: WorkItem, boardId: string, on: boolean) {
    setBusyId(item.id);
    setError(null);
    start(async () => {
      const r = await setBoardLink(item.id, boardId, on);
      if (!r.ok) setError(r.error);
      setBusyId(null);
    });
  }

  return (
    <div className="p-5 sm:p-8">
      <BoardSearch query={query} onChange={setQuery} searching={search.searching}
        count={visibleCards.length} total={cards.length} warning={search.data?.warning}
        error={search.error} onRetry={search.retry} disabled={!!activeId} />
      {search.data && visibleCards.length === 0 && (
        <p className="mb-5 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-600">
          No matching items. Try fewer words or clear the search.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </p>
      )}
      {canWrite && (
        <p className="mb-4 text-xs text-slate-500">
          Open a card to view details, edit notes, or comment. {filterOn ? 'Use the arrows on a card to change its status.' :
            'Drag its handle to move it, or use the arrows on the card. On a phone, hold the handle for a moment first.'}
        </p>
      )}

      <DndContext
        // A fixed id keeps the accessibility description ids identical on the
        // server and the client. Without it React warns about a hydration
        // mismatch on every board render.
        id="tinash-board"
        accessibility={{ announcements }}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => { setActiveId(null); setCards(items); }}
      >
        {search.data ? <div aria-label="Search results" className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleCards.map((item) => <div key={item.id} className="min-w-0">
            <p className="mb-2 text-xs font-semibold text-teal-700">{STAGES.find((stage) => stage.key === item.stage)?.label ?? item.stage}</p>
            <BoardCard item={item} canWrite={canWrite} canDrag={false} searchMatch={search.data?.matches[item.id]}
              mine={!!userId && item.owner_id === userId} busy={busyId === item.id}
              boards={boards} currentBoardId={board.id} onMove={(direction) => move(item, direction)}
              onClaim={() => claim(item)} onShare={(id, on) => share(item, id, on)} />
          </div>)}
        </div> : <div className="flex gap-4 overflow-x-auto pb-4" aria-busy={search.searching}>
          {STAGES.map((stage) => {
            const col = byStage[stage.key] ?? [];
            return (
              <section key={stage.key} className="flex w-[86vw] shrink-0 flex-col sm:w-[300px]">
                <div className="mb-3 flex items-center gap-2">
                  <stage.icon className={`h-4 w-4 ${stage.key === 'blocked' ? 'text-red-600' : 'text-teal-700'}`} />
                  <h2 className={`text-sm font-bold ${stage.key === 'blocked' ? 'text-red-700' : 'text-plum-950'}`}>{stage.label}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                    stage.key === 'blocked' && col.length > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {col.length}
                  </span>
                  {canWrite && (
                    <button
                      onClick={() => { setAdding(adding === stage.key ? null : stage.key); setError(null); }}
                      aria-label={`Add an item to ${stage.label}`}
                      className="ml-auto rounded-md p-1 text-slate-400 hover:bg-white hover:text-plum-700"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="mb-3 text-[11px] text-slate-400">{stage.hint}</p>

                {adding === stage.key && (
                  <form
                    action={(fd) => {
                      setError(null);
                      start(async () => {
                        const r = await createItem(fd);
                        if (r.ok) setAdding(null);
                        else setError(r.error);
                      });
                    }}
                    className="mb-3 rounded-lg border border-plum-700/20 bg-white p-3 shadow-sm"
                  >
                    <input type="hidden" name="stage" value={stage.key} />
                    <input type="hidden" name="board_id" value={board.id} />
                    <div className="flex items-center justify-between">
                      <label htmlFor={`t-${stage.key}`} className="text-xs font-bold text-plum-950">
                        New item
                      </label>
                      <button type="button" onClick={() => setAdding(null)} aria-label="Cancel"
                        className="rounded p-1 text-slate-400 hover:bg-slate-100">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input id={`t-${stage.key}`} name="title" required autoFocus
                      placeholder="What needs doing?"
                      className="mt-2 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm" />
                    <textarea name="notes" rows={2} placeholder="Any detail (optional)"
                      className="mt-2 w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs" />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select name="work_type" defaultValue="task" aria-label="Type"
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-xs">
                        {WORK_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </select>
                      <select name="priority" defaultValue="normal" aria-label="Priority"
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-xs">
                        {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                      </select>
                    </div>
                    <input type="date" name="due_at" aria-label="Due date"
                      className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
                    <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" name="mine" className="rounded border-slate-300" />
                      Assign it to me
                    </label>
                    <button type="submit" disabled={pending}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-plum-700 px-3 py-2 text-xs font-bold text-white hover:bg-plum-800 disabled:opacity-60">
                      {pending && <Loader2 className="h-3 w-3 animate-spin" />}
                      Add to {stage.label}
                    </button>
                  </form>
                )}

                <SortableContext items={col.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <Column stage={stage.key} disabled={filterOn || !canWrite}>
                    {col.map((item) => (
                      <BoardCard
                        key={item.id}
                        item={item}
                        canWrite={canWrite}
                        canDrag={canWrite && !filterOn}
                        searchMatch={search.data?.matches[item.id]}
                        mine={!!userId && item.owner_id === userId}
                        busy={busyId === item.id}
                        boards={boards}
                        currentBoardId={board.id}
                        onMove={(d) => move(item, d)}
                        onClaim={() => claim(item)}
                        onShare={(bid, on) => share(item, bid, on)}
                      />
                    ))}
                    {col.length === 0 && adding !== stage.key && (
                      <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                        {filterOn && search.data ? 'No matches in this column' : canWrite && !filterOn ? 'Drop a card here' : 'Nothing here'}
                      </p>
                    )}
                  </Column>
                </SortableContext>
              </section>
            );
          })}
        </div>}

        <DragOverlay>
          {active && (
            <article className="w-[280px] rotate-2 rounded-lg border border-plum-700/30 bg-white p-3 shadow-2xl">
              <CardBody item={active} boards={boards} currentBoardId={board.id} dragging />
            </article>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
