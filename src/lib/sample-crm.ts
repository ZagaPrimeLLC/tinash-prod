import type { WorkItem } from '@/lib/crm/board';

/** Static data for the dev only design preview. Nothing here is real. */
const iso = (days: number) => new Date(Date.now() + days * 864e5).toISOString();

export const sampleWork: WorkItem[] = [
  ['Post a CHHA opening for the new Essex County client', 'New client starting next week. Needs a caregiver posting up with the schedule and hours before we can start screening.', 'todo', 'task', 'high', 2, ['recruitment']],
  ['Confirm Tuesday consultation calls', 'Call everyone who requested a consultation for Tuesday to confirm the time.', 'todo', 'todo', 'normal', 3, ['coordinator']],
  ['Two CPR certifications expire next month', 'Check the training page and book both people onto the next class before the cards lapse.', 'todo', 'issue', 'high', 14, ['compliance', 'training']],
  ['Move the WhatsApp action items onto this board', 'Everything agreed verbally in the group chat needs an owner and a due date here instead.', 'in_progress', 'story', 'urgent', 5, ['operations']],
  ['Chase the three applicants with no contact in 48 hours', 'Anything sitting past two days on the applicant board goes cold.', 'in_progress', 'task', 'high', -1, ['recruitment']],
  ['Follow up on GUIDE Program referrals', 'Call back families who asked about GUIDE this week and help them check eligibility.', 'in_progress', 'epic', 'urgent', 0, ['infrastructure']],
  ['Fill in the Privacy Officer and Civil Rights Coordinator names', 'Both are highlighted on the compliance pages until someone confirms who they are.', 'review', 'issue', 'high', 7, ['compliance']],
  ['Decide the retention period for job applications', 'How long do we keep a resume after a hire decision?', 'review', 'todo', 'normal', 10, ['compliance']],
  ['Onboarding pack sent to the two new caregivers', 'Both opened it. Waiting on their certification copies.', 'review', 'task', 'normal', 0, ['onboarding']],
  ['Replace the placeholder testimonials on the website', 'Six placeholders are live. Need real, permissioned words from families.', 'backlog', 'task', 'normal', 0, ['website']],
  ['Website relaunch', 'New site live.', 'done', 'milestone', 'normal', 0, ['website']],
  ['Compliance pages published', 'Privacy, HIPAA notice, nondiscrimination, accessibility and terms are live.', 'done', 'milestone', 'normal', 0, ['compliance']],
].map(([title, notes, stage, work_type, priority, due, labels], i) => ({
  id: `sample-${i}`,
  title: title as string,
  notes: notes as string,
  stage: stage as string,
  work_type: work_type as string,
  priority: priority as string,
  position: 1000 + i,
  labels: labels as string[],
  owner_id: i === 4 || i === 1 ? 'me' : null,
  boardIds: [3, 5, 6, 10].includes(i) ? ['b-ops', 'b-lead'] : ['b-ops'],
  due_at: (due as number) !== 0 ? iso(due as number) : null,
  completed_at: stage === 'done' ? iso(-2) : null,
  created_at: iso(-20),
  updated_at: iso(-1),
}));

export const sampleBoards = [
  { id: 'b-ops', key: 'operations', name: 'Operations',
    description: 'The day to day board. Recruitment, coordination, compliance and everything the office is carrying.',
    visible_to: ['admin', 'ops'], position: 10, archived: false },
  { id: 'b-lead', key: 'leadership', name: 'Leadership',
    description: 'What leadership needs to see. Decisions waiting, items at risk, and anything the office has escalated.',
    visible_to: ['admin', 'ops', 'leadership'], position: 20, archived: false },
];
