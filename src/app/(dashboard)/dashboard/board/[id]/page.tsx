import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import PageHeader from '@/components/crm/PageHeader';
import { Card, CardHead, Empty, Notice, Pill, dateLabel } from '@/components/crm/ui';
import { WorkItemDetails, WorkItemCommentForm, ItemInfoForm, type TeamOption } from '@/components/crm/WorkItemDetails';
import { getSession } from '@/lib/crm/session';
import { canWrite } from '@/lib/crm/nav';
import { typeMeta, priorityMeta, stageMeta, type WorkItem } from '@/lib/crm/board';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Work item' };

type Comment = { id: string; author_id: string | null; body: string; created_at: string };
type BoardLink = { boards: { id: string; key: string; name: string } | null };
const PAGE_SIZE = 50;

export default async function WorkItemPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ b?: string; from?: string; page?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const { supabase, user, role } = await getSession();
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
  if (error) return <div className="p-5 sm:p-8"><Notice tone="warn">Could not load this item. Please try again shortly.</Notice></div>;
  if (!data) notFound(); // RLS makes inaccessible tasks indistinguishable from missing ones.
  const item = data as WorkItem;
  const writes = canWrite(role);
  const page = Math.min(10000, Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1));
  const [{ data: rows, count, error: commentError }, { data: links }] = await Promise.all([
    supabase.from('task_comments').select('id, author_id, body, created_at', { count: 'exact' })
      .eq('task_id', id).order('created_at', { ascending: false }).order('id', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('board_items').select('boards(id, key, name)').eq('task_id', id),
  ]);
  const comments = (rows ?? []) as Comment[];
  const boards = ((links ?? []) as unknown as BoardLink[]).flatMap((link) => link.boards ? [link.boards] : []);
  const authors = [...new Set([item.owner_id, ...comments.map((comment) => comment.author_id)].filter((value): value is string => !!value))];
  const { data: profiles } = authors.length
    ? await supabase.from('profiles').select('id, display_name').in('id', authors)
    : { data: [] as { id: string; display_name: string | null }[] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const nameOf = (author: string | null) => author === user?.id ? 'You' : author ? names.get(author) || 'Team member' : 'Former team member';

  const originBoard = boards.find((board) => board.key === query.b) ?? boards[0];
  const fromMyWork = query.from === 'my-work';
  const backHref = fromMyWork ? '/dashboard/my-work' : `/dashboard/board${originBoard ? `?b=${encodeURIComponent(originBoard.key)}` : ''}`;
  const detailQuery = new URLSearchParams();
  if (originBoard) detailQuery.set('b', originBoard.key);
  if (fromMyWork) detailQuery.set('from', 'my-work');
  const hrefForPage = (number: number) => {
    const search = new URLSearchParams(detailQuery);
    if (number > 1) search.set('page', String(number));
    return `/dashboard/board/${id}${search.size ? `?${search}` : ''}#comments`;
  };
  const type = typeMeta(item.work_type);
  const priority = priorityMeta(item.priority);

  // People who can own work, for the "Assigned to" list (only writers need it).
  const { data: teamRows } = writes ? await supabase.rpc('team_list') : { data: [] };
  const team: TeamOption[] = ((teamRows ?? []) as { user_id: string; email: string; display_name: string | null }[])
    .map((m) => ({ id: m.user_id, name: m.user_id === user?.id ? `${m.display_name || m.email} (you)` : m.display_name || m.email }));
  // The date picker shows the due date as the office sees it, in New York.
  const dueOn = item.due_at
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(item.due_at))
    : '';

  return (
    <>
      <div className="px-5 pt-5 sm:px-8">
        <Link href={backHref} className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-teal-700 hover:text-plum-700">
          <ArrowLeft className="h-4 w-4" /> Back to {fromMyWork ? 'my work' : originBoard?.name ?? 'work board'}
        </Link>
      </div>
      <div className="[&_h1]:break-words"><PageHeader title={item.title} lead={`${type.label} · ${stageMeta(item.stage).label}`} /></div>
      <div className="max-w-6xl space-y-6 p-5 sm:p-8">
        {!writes && <Notice>You can view this item and its comments. The operations team can edit details and post updates.</Notice>}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
          <Card><WorkItemDetails id={id} title={item.title} notes={item.notes} canWrite={writes} /></Card>
          <Card>
            <ItemInfoForm id={id} stage={item.stage} priority={item.priority} workType={item.work_type}
              ownerId={item.owner_id} dueOn={dueOn} team={team} canWrite={writes}>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm lg:block lg:space-y-4">
              <div><dt className="text-xs text-slate-500">Status</dt><dd className="mt-1"><Pill>{stageMeta(item.stage).label}</Pill></dd></div>
              <div><dt className="text-xs text-slate-500">Priority</dt><dd className="mt-1"><Pill tone={priority.tone}>{priority.label}</Pill></dd></div>
              <div><dt className="text-xs text-slate-500">Assigned to</dt><dd className="mt-1 text-plum-950">{item.owner_id ? nameOf(item.owner_id) : 'Unassigned'}</dd></div>
              <div><dt className="text-xs text-slate-500">Type</dt><dd className="mt-1 text-plum-950">{type.label}</dd></div>
              <div><dt className="text-xs text-slate-500">Due date</dt><dd className="mt-1 text-plum-950">{item.due_at
                ? new Date(item.due_at).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })
                : 'No due date'}</dd></div>
              <div><dt className="text-xs text-slate-500">Created</dt><dd className="mt-1 text-plum-950">{dateLabel(item.created_at)}</dd></div>
              {boards.length > 0 && <div><dt className="text-xs text-slate-500">Boards</dt><dd className="mt-1 flex flex-wrap gap-2">{boards.map((board) =>
                <Link key={board.id} href={`/dashboard/board?b=${encodeURIComponent(board.key)}`} className="font-semibold text-teal-700 hover:underline">{board.name}</Link>
              )}</dd></div>}
            </dl>
            </ItemInfoForm>
          </Card>
        </div>
        <Card>
          <section id="comments" aria-label="Comments" className="scroll-mt-20">
            <CardHead title={`Comments${commentError ? '' : ` (${count ?? 0})`}`} sub="Newest first. Shared across every board this item appears on." icon={MessageSquare} />
            {commentError ? <div className="p-5"><Notice tone="warn">Comments could not be loaded. Please try again shortly.</Notice></div> : <>
              {writes && <WorkItemCommentForm id={id} latestHref={hrefForPage(1)} />}
              {comments.length === 0 ? <div className="p-5"><Empty>{page === 1 ? 'No comments yet.' : 'No comments on this page. Use Newer to return to recent comments.'}</Empty></div> :
                <ol className="divide-y divide-slate-100">
                  {comments.map((comment) => <li key={comment.id} className="px-5 py-5 sm:px-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-plum-950">{nameOf(comment.author_id)}</span>
                      <time dateTime={comment.created_at} className="text-xs text-slate-400">{new Date(comment.created_at).toLocaleString('en-US', {
                        timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
                      })}</time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{comment.body}</p>
                  </li>)}
                </ol>}
              {(page > 1 || (count ?? 0) > PAGE_SIZE) && <nav aria-label="Comment pages" className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm">
                {page > 1 ? <Link href={hrefForPage(page - 1)} className="font-semibold text-teal-700 hover:underline">Newer</Link> : <span />}
                <span className="text-xs text-slate-500">Page {page}</span>
                {page * PAGE_SIZE < (count ?? 0) ? <Link href={hrefForPage(page + 1)} className="font-semibold text-teal-700 hover:underline">Older</Link> : <span />}
              </nav>}
            </>}
          </section>
        </Card>
      </div>
    </>
  );
}
