import type { LucideIcon } from 'lucide-react';
import {
  Layers, CircleDot, Timer, Ban, Eye, CheckCircle2,
  Bug, Flag, ListTodo, BookOpen, Wrench, AlertTriangle,
} from 'lucide-react';

/** Board columns, in the same vocabulary as the ZagaPrime CRM delivery board. */
export const STAGES = [
  { key: 'backlog',     label: 'Backlog',     icon: Layers,       hint: 'raised, not started' },
  { key: 'todo',        label: 'To Do',       icon: CircleDot,    hint: 'agreed and queued' },
  { key: 'in_progress', label: 'In Progress', icon: Timer,        hint: 'someone is on it' },
  { key: 'blocked',     label: 'Blocked',     icon: Ban,          hint: 'stuck, waiting on someone or something' },
  { key: 'review',      label: 'Review',      icon: Eye,          hint: 'waiting on a check' },
  { key: 'done',        label: 'Done',        icon: CheckCircle2, hint: 'finished' },
] as const;

export type StageKey = (typeof STAGES)[number]['key'];
export const STAGE_KEYS = STAGES.map((s) => s.key) as readonly StageKey[];

export const WORK_TYPES = [
  { key: 'epic',      label: 'Epic',      icon: BookOpen,      tone: 'bg-violet-100 text-violet-800 ring-violet-200' },
  { key: 'story',     label: 'Story',     icon: Layers,        tone: 'bg-sky-100 text-sky-800 ring-sky-200' },
  { key: 'task',      label: 'Task',      icon: Wrench,        tone: 'bg-blue-100 text-blue-800 ring-blue-200' },
  { key: 'todo',      label: 'Todo',      icon: ListTodo,      tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
  { key: 'issue',     label: 'Issue',     icon: AlertTriangle, tone: 'bg-amber-100 text-amber-900 ring-amber-200' },
  { key: 'bug',       label: 'Bug',       icon: Bug,           tone: 'bg-rose-100 text-rose-800 ring-rose-200' },
  { key: 'milestone', label: 'Milestone', icon: Flag,          tone: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
] as const;

export type WorkType = (typeof WORK_TYPES)[number]['key'];

export const PRIORITIES = [
  { key: 'urgent', label: 'Urgent', tone: 'bg-red-600 text-white',        dot: 'bg-red-600' },
  { key: 'high',   label: 'High',   tone: 'bg-orange-100 text-orange-900', dot: 'bg-orange-500' },
  { key: 'normal', label: 'Normal', tone: 'bg-slate-100 text-slate-700',   dot: 'bg-slate-400' },
  { key: 'low',    label: 'Low',    tone: 'bg-slate-50 text-slate-500',    dot: 'bg-slate-300' },
] as const;

export type Priority = (typeof PRIORITIES)[number]['key'];

export function typeMeta(key: string) {
  return WORK_TYPES.find((t) => t.key === key) ?? WORK_TYPES[2];
}
export function priorityMeta(key: string) {
  return PRIORITIES.find((p) => p.key === key) ?? PRIORITIES[2];
}
export function stageMeta(key: string) {
  return STAGES.find((s) => s.key === key) ?? STAGES[0];
}

export type Board = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  visible_to: string[];
  position: number;
  archived: boolean;
};

export type WorkItem = {
  id: string;
  title: string;
  notes: string | null;
  stage: string;
  work_type: string;
  priority: string;
  position: number;
  labels: string[];
  owner_id: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  /** Every board this card sits on. One task row, several places it shows. */
  boardIds?: string[];
};

/** Overdue, and not already finished. */
export function isOverdue(item: Pick<WorkItem, 'due_at' | 'stage'>): boolean {
  if (!item.due_at || item.stage === 'done') return false;
  return new Date(item.due_at).getTime() < Date.now();
}

export type { LucideIcon };
