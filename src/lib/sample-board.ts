import type { BoardCard, InquiryCard } from './crm-types';

// Static, invented data for the dev-only CRM preview. Nothing here is real.
const hoursAgo = (n: number) => new Date(Date.now() - n * 3600000).toISOString();
const job = { title: 'Certified Home Health Aide (CHHA)', location: 'Essex County, NJ' };

export const sampleBoard: BoardCard[] = [
  ['s1', 'hired', 92, 6, 2, 'Amara Okafor', 'Indeed'],
  ['s2', 'checks', 85, 20, 1, 'Denise Whitfield', 'Website'],
  ['s3', 'interview', 88, 30, 2, 'Rosa Delgado', 'Website'],
  ['s4', 'screening', null, 70, 1, 'Marcus Bell', 'Referral'],
  ['s5', 'new', null, null, 0, 'Tunde Adeyemi', 'Website'],
  ['s6', 'new', null, null, 0, 'Jasmine Carter', 'Indeed'],
  ['s7', 'archived', null, 96, 3, 'Priya Raman', 'Referral'],
].map(([id, stage, score, contact, attempts, name, source]) => ({
  id: id as string, stage: stage as string, owner: null,
  qualified: score != null, ready: stage === 'hired' || stage === 'checks', score: score as number | null,
  lastContactAt: contact == null ? null : hoursAgo(contact as number), createdAt: hoursAgo(120),
  attempts: attempts as number, archiveReason: stage === 'archived' ? 'Unresponsive after 3 attempts' : null,
  applicant: { name: name as string, phone: '973-555-0100', email: 'applicant@example.com', source: source as string },
  position: job,
}));

export const sampleInquiries: InquiryCard[] = [
  ['i1', 'new', 'Grace M.', 'Companion Care', 3],
  ['i2', 'contacted', 'Robert K.', 'GUIDE Program', 26],
  ['i3', 'assessment_scheduled', 'The Alvarez family', 'Live-In & 24/7 Care', 50],
  ['i4', 'care_plan_sent', 'Linda P.', 'Respite Care', 80],
  ['i5', 'client_started', 'James O.', 'Skilled Nursing', 200],
].map(([id, stage, name, service, h]) => ({
  id: id as string, stage: stage as string, name: name as string, phone: '973-555-0100', email: null,
  service: service as string, createdAt: hoursAgo(h as number), handledAt: stage === 'new' ? null : hoursAgo(1), mine: false,
}));
