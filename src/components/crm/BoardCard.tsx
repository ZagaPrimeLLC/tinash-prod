'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  User, CalendarClock, ChevronLeft, ChevronRight, Share2, Check, GripVertical,
} from 'lucide-react';
import { STAGES, typeMeta, priorityMeta, isOverdue, type WorkItem, type Board } from '@/lib/crm/board';
import { dateLabel } from '@/components/crm/ui';
import type { SearchMatch } from '@/lib/crm/board-search';

const stageIndex = (k: string) => STAGES.findIndex((s) => s.key === k);

/** The card body, shared by the real card and the one that follows the cursor. */
export function CardBody({
  item, boards, currentBoardId, dragging = false,
}: { item: WorkItem; boards: Board[]; currentBoardId: string; dragging?: boolean }) {
  const t = typeMeta(item.work_type);
  const p = priorityMeta(item.priority);
  const late = isOverdue(item);
  const elsewhere = boards.filter((b) => b.id !== currentBoardId && (item.boardIds ?? []).includes(b.id));

  return (
    <>
      <div className="flex items-start gap-2">
        <span className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded ring-1 ring-inset ${t.tone}`}>
          <t.icon className="h-3 w-3" />
        </span>
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-plum-950">{item.title}</p>
        {item.priority !== 'normal' && (
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${p.tone}`}>
            {p.label}
          </span>
        )}
      </div>

      {item.notes && !dragging && (
        <p className="mt-2 line-clamp-2 pl-7 text-xs leading-relaxed text-slate-500">{item.notes}</p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-7 text-[11px] text-slate-500">
        {item.due_at && (
          <span className={`inline-flex items-center gap-1 ${late ? 'font-semibold text-red-600' : ''}`}>
            <CalendarClock className="h-3 w-3" />
            {dateLabel(item.due_at)}
          </span>
        )}
        {elsewhere.map((b) => (
          <span key={b.id} className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 font-semibold text-violet-800">
            <Share2 className="h-3 w-3" />{b.name}
          </span>
        ))}
        {item.labels?.map((l) => (
          <span key={l} className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{l}</span>
        ))}
      </div>
    </>
  );
}

export default function BoardCard({
  item, canWrite, canDrag = canWrite, searchMatch, mine, busy, boards, currentBoardId, onMove, onClaim, onShare,
}: {
  item: WorkItem; canWrite: boolean; mine: boolean; busy: boolean;
  canDrag?: boolean; searchMatch?: SearchMatch;
  boards: Board[]; currentBoardId: string;
  onMove: (dir: -1 | 1) => void; onClaim: () => void;
  onShare: (boardId: string, on: boolean) => void;
}) {
  const [sharing, setSharing] = useState(false);
  const on = item.boardIds ?? [];
  const i = stageIndex(item.stage);
  const late = isOverdue(item);

  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging,
  } = useSortable({ id: item.id, disabled: !canWrite || !canDrag, data: { stage: item.stage } });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group rounded-lg border bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${
        isDragging ? 'opacity-30' : busy ? 'opacity-50' : 'hover:border-slate-300 hover:shadow-md'
      } ${late ? 'border-red-200' : 'border-slate-200'}`}
    >
      <div className="flex items-start gap-1">
        {canWrite && canDrag && (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag ${item.title}. Or press space, then the arrow keys.`}
            className="-ml-1 mt-px shrink-0 cursor-grab touch-none rounded p-0.5 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-500 focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <Link
          href={`/dashboard/board/${item.id}?b=${encodeURIComponent(boards.find((b) => b.id === currentBoardId)?.key ?? '')}`}
          aria-label={`Open ${item.title}`}
          className="min-w-0 flex-1 rounded text-left outline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-plum-700"
        >
          <CardBody item={item} boards={boards} currentBoardId={currentBoardId} />
          {searchMatch && <div className="mt-3 rounded-md bg-teal-500/10 p-2 text-xs">
            <p className="font-semibold text-plum-700">Matched in {searchMatch.sources.join(', ').toLowerCase()}</p>
            <p className="mt-1 break-words leading-relaxed text-slate-600">{searchMatch.excerpt}</p>
          </div>}
        </Link>
      </div>

      {canWrite && (
        <div className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-2.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <button
            onClick={() => onMove(-1)}
            disabled={i <= 0 || busy}
            aria-label={`Move "${item.title}" to the previous column`}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-plum-700 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={i >= STAGES.length - 1 || busy}
            aria-label={`Move "${item.title}" to the next column`}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-plum-700 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {boards.length > 1 && (
            <button
              onClick={() => setSharing((v) => !v)}
              disabled={busy}
              aria-expanded={sharing}
              aria-label="Show this card on other boards"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-plum-700"
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClaim}
            disabled={busy}
            className="ml-auto rounded px-2 py-1 text-[11px] font-semibold text-teal-700 hover:bg-slate-100"
          >
            {mine ? 'Release' : 'Take it'}
          </button>
        </div>
      )}

      {canWrite && mine && (
        <span className="mt-2 inline-flex items-center gap-1 rounded bg-teal-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-plum-700">
          <User className="h-3 w-3" /> Mine
        </span>
      )}

      {canWrite && sharing && (
        <div className="mt-2 rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-200">
          <p className="mb-2 text-[11px] font-bold text-plum-950">Show this card on</p>
          <ul className="space-y-1">
            {boards.map((b) => {
              const isOn = on.includes(b.id);
              return (
                <li key={b.id}>
                  <button
                    onClick={() => onShare(b.id, !isOn)}
                    disabled={busy}
                    className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] hover:bg-white"
                  >
                    <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                      isOn ? 'border-plum-700 bg-plum-700 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {isOn && <Check className="h-3 w-3" />}
                    </span>
                    <span className={isOn ? 'font-semibold text-plum-950' : 'text-slate-600'}>{b.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
            It stays one card. A change on either board shows on both.
          </p>
        </div>
      )}
    </article>
  );
}
