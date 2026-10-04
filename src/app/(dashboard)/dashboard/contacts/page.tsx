import PageHeader from '@/components/crm/PageHeader';
import { Card, CardHead, Empty, Pill, Stat, ago } from '@/components/crm/ui';
import { getSession } from '@/lib/crm/session';
import { INQUIRY_TONE as TONE, CLOSED_INQUIRY_STAGES, inquiryStageLabel } from '@/lib/pipeline';
import { Contact2, Mail, Phone, MousePointerClick, Repeat } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contacts' };


export default async function ContactsPage() {
  const { supabase } = await getSession();

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('last_seen_at', { ascending: false });

  const contacts = data ?? [];
  const open = contacts.filter((c) => !CLOSED_INQUIRY_STAGES.includes(c.status));
  const applicants = contacts.filter((c) => c.kind === 'applicant');
  const repeat = contacts.filter((c) => c.touches > 1);

  return (
    <>
      <PageHeader
        title="Contacts"
        lead="Everyone who has ever reached out through the website. Someone who contacts us twice is one person here, matched on their email or phone number, not two rows."
      />

      <div className="space-y-6 p-5 sm:p-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Contact2} label="People"       value={contacts.length} />
          <Stat icon={Mail}     label="Still open"   value={open.length}       sub="not started or archived" />
          <Stat icon={Repeat}   label="Came back"    value={repeat.length}     sub="contacted us more than once" />
          <Stat icon={Phone}    label="Caregiver applicants"  value={applicants.length} sub="applied for a role" />
        </section>

        <Card>
          <CardHead title="Everyone" sub={`${contacts.length} people`} icon={Contact2} />
          {error && <p className="px-5 py-3 text-sm text-red-700">{error.message}</p>}
          {contacts.length === 0 ? (
            <div className="p-5">
              <Empty>Nobody has contacted the website yet. The first form submission creates a record here automatically.</Empty>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold">Name</th>
                    <th className="px-5 py-2.5 font-semibold">Contact</th>
                    <th className="px-5 py-2.5 font-semibold">Came from</th>
                    <th className="px-5 py-2.5 font-semibold">Touches</th>
                    <th className="px-5 py-2.5 font-semibold">Last heard</th>
                    <th className="px-5 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contacts.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <span className="font-semibold text-plum-950">{c.full_name}</span>
                        {c.kind === 'applicant' && (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                            applicant
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex flex-col gap-0.5 text-xs text-slate-600">
                          {c.phone && (
                            <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 font-medium hover:text-plum-700">
                              <Phone className="h-3 w-3" />{c.phone}
                            </a>
                          )}
                          {c.email && (
                            <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-plum-700">
                              <Mail className="h-3 w-3" />{c.email}
                            </a>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        <span className="block">{c.first_source ?? 'website'}</span>
                        {c.first_cta && (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <MousePointerClick className="h-3 w-3" />{c.first_cta}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs font-semibold tabular-nums text-slate-700">{c.touches}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{ago(c.last_seen_at)}</td>
                      <td className="px-5 py-3"><Pill tone={TONE[c.status] ?? ''}>{inquiryStageLabel(c.status)}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-slate-100 px-5 py-3 text-xs leading-relaxed text-slate-500">
            Contact details and what someone asked about, nothing clinical. Health information never
            belongs here, and the website tells people not to send it.
          </p>
        </Card>
      </div>
    </>
  );
}
