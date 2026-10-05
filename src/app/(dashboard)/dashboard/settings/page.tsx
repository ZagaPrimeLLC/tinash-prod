import PageHeader from '@/components/crm/PageHeader';
import SettingsClient, { type Invite } from '@/components/crm/SettingsClient';
import type { Member } from '@/components/crm/TeamAccess';
import IntakeKeys, { type IntakeKey } from '@/components/crm/IntakeKeys';
import { Card, CardHead } from '@/components/crm/ui';
import { getSession } from '@/lib/crm/session';
import { canWrite } from '@/lib/crm/nav';
import { site } from '@/lib/site';
import type { Board } from '@/lib/crm/board';
import { Building2, ShieldCheck, Database } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const { supabase, user, role } = await getSession();

  if (!canWrite(role)) {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="p-5 sm:p-8">
          <Card>
            <div className="p-6">
              <ShieldCheck className="h-7 w-7 text-slate-400" />
              <h2 className="mt-3 font-bold text-plum-950">Settings are for the operations team</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Your role can use the CRM but not configure it. Ask an administrator if something
                needs changing.
              </p>
            </div>
          </Card>
        </div>
      </>
    );
  }

  const isAdmin = role === 'admin';
  const [boardsRes, teamRes, keysRes, invitesRes] = await Promise.all([
    supabase.from('boards').select('*').eq('archived', false).order('position'),
    supabase.rpc('team_list'),
    isAdmin
      ? supabase.from('intake_keys').select('id, label, source, key_prefix, created_at, last_used_at, revoked_at').order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as IntakeKey[] }),
    isAdmin
      ? supabase.from('team_invites').select('id, email, role, job_title, created_at')
          .is('accepted_at', null).is('revoked_at', null).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as Invite[] }),
  ]);

  const boards = (boardsRes.data ?? []) as Board[];
  const team = (teamRes.data ?? []) as Member[];

  return (
    <>
      <PageHeader
        title="Settings"
        lead="Who is on the team and what they can do, boards and who can open them, and the applicant feed."
      />

      <SettingsClient
        boards={boards}
        team={team}
        invites={(invitesRes.data ?? []) as Invite[]}
        isAdmin={isAdmin}
        meId={user?.id ?? null}
      />

      {isAdmin && (
        <div id="intake" className="scroll-mt-6 px-5 pb-6 sm:px-8">
          <IntakeKeys keys={(keysRes.data ?? []) as IntakeKey[]} endpoint={`${site.crmUrl}/api/intake`} />
        </div>
      )}

      <div className="grid gap-6 px-5 pb-8 sm:px-8 xl:grid-cols-2">
        <Card>
          <CardHead title="Agency details" sub="Shown across the public website" icon={Building2} />
          <dl className="divide-y divide-slate-100 text-sm">
            {[
              ['Legal name', site.legalName],
              ['Phone', site.phone],
              ['Email', site.email],
              ['Office hours', site.hours.map((h) => `${h.days} ${h.time}`).join(' · ')],
              ['Consultations', `${site.consultation.label} (configurable in site.ts)`],
              ['Service area', site.serviceArea.join(', ')],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-wrap justify-between gap-3 px-5 py-3">
                <dt className="text-slate-600">{k}</dt>
                <dd className="text-right font-medium text-plum-950">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            These live in the site content file and change with a deploy, so the website and the
            CRM can never disagree about them.
          </p>
        </Card>

        <Card>
          <CardHead title="How access works" sub="What each role can do" icon={Database} />
          <dl className="divide-y divide-slate-100 text-sm">
            {[
              ['Administrator', 'Everything, including changing roles and creating boards.'],
              ['Operations', 'Runs the boards, recruitment, onboarding and training. Cannot change roles.'],
              ['Leadership', 'Opens the boards shared with leadership. Changes nothing.'],
              ['Viewer', 'Read only, and only boards explicitly shared with viewers.'],
            ].map(([k, v]) => (
              <div key={k} className="px-5 py-3">
                <dt className="font-semibold text-plum-950">{k}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-slate-600">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-slate-100 px-5 py-3 text-xs leading-relaxed text-slate-500">
            A role is checked by the database on every request, so restricting a board actually
            withholds its cards rather than hiding a link. Someone new must sign in once before a
            role can be given to them.
          </p>
        </Card>
      </div>
    </>
  );
}
