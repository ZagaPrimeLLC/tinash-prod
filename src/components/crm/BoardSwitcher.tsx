'use client';

import Link from 'next/link';
import { Lock, Users2 } from 'lucide-react';
import type { Board } from '@/lib/crm/board';

const ROLE_WORDS: Record<string, string> = {
  admin: 'Admin',
  ops: 'Operations',
  leadership: 'Leadership',
  viewer: 'Viewers',
};

export default function BoardSwitcher({
  boards, current,
}: { boards: Board[]; current: string }) {
  if (boards.length <= 1) return null;

  return (
    <div className="border-b border-slate-200 bg-white px-5 sm:px-8">
      <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Boards">
        {boards.map((b) => {
          const active = b.key === current;
          const restricted = !b.visible_to.includes('viewer');
          return (
            <Link
              key={b.id}
              href={`/dashboard/board?b=${b.key}`}
              aria-current={active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm transition ${
                active
                  ? 'border-teal-500 font-bold text-plum-950'
                  : 'border-transparent font-medium text-slate-500 hover:border-slate-300 hover:text-plum-700'
              }`}
            >
              {restricted
                ? <Lock className={`h-3.5 w-3.5 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
                : <Users2 className={`h-3.5 w-3.5 ${active ? 'text-teal-600' : 'text-slate-400'}`} />}
              {b.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function BoardNote({ board }: { board: Board }) {
  const roles = board.visible_to.map((r) => ROLE_WORDS[r] ?? r);
  const everyone = board.visible_to.length >= 4;
  return (
    <p className="text-xs text-slate-500">
      {everyone ? 'Visible to everyone on the team.' : `Only ${roles.join(', ')} can open this board.`}
    </p>
  );
}
