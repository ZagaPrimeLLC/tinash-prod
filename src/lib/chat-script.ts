// A guided assistant, not a language model. Every answer below is drawn from
// what Tinash actually states on this site (src/lib/services.ts, the GUIDE page,
// the careers and consulting pages, src/lib/site.ts), so it cannot invent a
// service, a price or an eligibility rule. Anything it cannot answer goes to a
// person. Compliance: Tinash is a *partner* of PocketRN, the CMS-selected GUIDE
// participant — never describe Tinash itself as a GUIDE participant.
import { site } from '@/lib/site';

export type ChatOption = { id: string; label: string; next: string };

export type ChatNode = {
  id: string;
  say: string[];
  options?: ChatOption[];
  capture?: 'lead';
  link?: { href: string; label: string };
};

const hours = site.hours.map((h) => `${h.days} ${h.time}`).join(', ');

/** The usual "what next" choices after describing a service. */
const NEXT: ChatOption[] = [
  { id: 'book', label: 'Book a free consultation call', next: 'booking' },
  { id: 'call-me', label: 'Just have someone call me', next: 'lead' },
  { id: 'other', label: 'See other services', next: 'homecare' },
];

export const CHAT: Record<string, ChatNode> = {
  start: {
    id: 'start',
    say: [
      `Hello, and thanks for visiting ${site.name}.`,
      'I can tell you about our services, help you book a free consultation call, or take your details so someone calls you back.',
      'Please keep any medical or personal health details out of this chat. We will go through anything clinical on the phone.',
      'What brings you here?',
    ],
    options: [
      { id: 'family', label: 'I need care for a family member', next: 'family' },
      { id: 'guide', label: 'Dementia support through Medicare (GUIDE)', next: 'guide' },
      { id: 'book', label: 'Book a free consultation call', next: 'booking' },
      { id: 'job', label: 'I want to work as a caregiver', next: 'job' },
      { id: 'consulting', label: 'I want to start a homecare agency', next: 'consulting' },
      { id: 'other', label: 'Something else', next: 'human' },
    ],
  },

  family: {
    id: 'family',
    say: [
      'We provide care across New Jersey, including ' +
        `${site.serviceArea.slice(0, 3).join(', ')} and surrounding communities.`,
      'Tinash has two service lines, so first: which sounds closest?',
    ],
    options: [
      { id: 'homecare', label: 'Home care for a senior or adult', next: 'homecare' },
      { id: 'ddd', label: 'NJ DDD services for an adult with a developmental disability', next: 'ddd' },
      { id: 'guide', label: 'Support for someone living with dementia (Medicare GUIDE)', next: 'guide' },
      { id: 'unsure', label: "I'm not sure yet", next: 'assessment' },
    ],
  },

  homecare: {
    id: 'homecare',
    say: [
      'Home care is nursing and personal care at home for seniors and adults, arranged directly with us (private pay or long-term care insurance).',
      'Which of these sounds closest?',
    ],
    options: [
      { id: 'nursing', label: 'A nurse at home (Skilled Nursing)', next: 'nursing' },
      { id: 'senior', label: 'Daily personal care for a senior', next: 'senior' },
      { id: 'companion', label: 'Company and help around the house', next: 'companion' },
      { id: 'livein', label: 'Someone there around the clock', next: 'livein' },
      { id: 'respite', label: 'A break for me as the family caregiver', next: 'respite' },
      { id: 'unsure', label: "I'm not sure yet", next: 'assessment' },
    ],
  },

  nursing: {
    id: 'nursing',
    say: [
      'That is our Skilled Nursing service: nurses at home for medication management, health checks, wound care, and appointment support.',
      'It includes medication pours, set-up, and administration; nurse check-ins with vital signs and health monitoring; wound care and dressing changes; accompaniment to doctor appointments, with notes for the family; and coordination with physicians and care teams.',
      'What would you like to do next?',
    ],
    options: NEXT,
    link: { href: '/services/skilled-nursing', label: 'Read about Skilled Nursing' },
  },
  companion: {
    id: 'companion',
    say: [
      'That is Companion Care: friendly, reliable company — conversation, meals, errands, and a watchful eye.',
      'It covers conversation and meaningful activities, meal preparation and light housekeeping, errands, groceries and appointments, medication reminders, and regular family updates.',
    ],
    options: NEXT,
    link: { href: '/services/companion-care', label: 'Read about Companion Care' },
  },
  livein: {
    id: 'livein',
    say: [
      'That is Live-In & 24/7 Care: round-the-clock support from caregivers who are there through the night.',
      'We offer live-in and rotating 24/7 schedules, personal care and mobility support, overnight safety and fall prevention, and care plans reviewed with the family.',
    ],
    options: NEXT,
    link: { href: '/services/live-in-care', label: 'Read about Live-In & 24/7 Care' },
  },
  respite: {
    id: 'respite',
    say: [
      'That is Respite Care: temporary relief for family caregivers — hours, days, or weeks at a time.',
      'Scheduling is flexible, from 4 hours to multi-week, with an individualized care plan and clear handoff notes back to the family.',
    ],
    options: NEXT,
    link: { href: '/services/respite-care', label: 'Read about Respite Care' },
  },
  senior: {
    id: 'senior',
    say: [
      'That is Daily Senior Care: daily personal care and attention for seniors who need steady support.',
      'It includes bathing, dressing and grooming support, mobility and transfer assistance, meal planning and preparation, and medication reminders and appointment support.',
    ],
    options: NEXT,
    link: { href: '/services/senior-care', label: 'Read about Daily Senior Care' },
  },
  ddd: {
    id: 'ddd',
    say: [
      'Our DDD services are for adults 21 and older who are eligible for the NJ Division of Developmental Disabilities (DDD). They are paid from the person\'s DDD budget through NJ FamilyCare, so there is no bill to the family.',
      'Which would you like to hear about?',
    ],
    options: [
      { id: 'individual', label: 'One-to-one support at home (Individual Supports)', next: 'individual' },
      { id: 'cbs', label: 'Support out in the community (Community-Based Supports)', next: 'cbs' },
      { id: 'ddd-respite', label: 'A break for the family caregiver (DDD Respite)', next: 'ddd-respite' },
      { id: 'how', label: 'How do I start DDD services?', next: 'ddd-start' },
    ],
  },
  individual: {
    id: 'individual',
    say: [
      'Individual Supports are one-to-one services in the person\'s home: help with self-care, meals and household routines, and building the skills to do more independently.',
      'In New Jersey they are a DDD Community Care Program service, written into the Individualized Service Plan (ISP) with the support coordinator.',
    ],
    options: [
      { id: 'how', label: 'How do I start DDD services?', next: 'ddd-start' },
      { id: 'call-me', label: 'Have someone call me', next: 'lead' },
      { id: 'other', label: 'See other DDD services', next: 'ddd' },
    ],
    link: { href: '/services/individual-supports', label: 'Read about Individual Supports' },
  },
  cbs: {
    id: 'cbs',
    say: [
      'Community-Based Supports are one-to-one time out in the community: errands, classes, worship, recreation, and practicing travel, money and social skills.',
      'In New Jersey they are a DDD Supports Program service, planned with the support coordinator.',
    ],
    options: [
      { id: 'how', label: 'How do I start DDD services?', next: 'ddd-start' },
      { id: 'call-me', label: 'Have someone call me', next: 'lead' },
      { id: 'other', label: 'See other DDD services', next: 'ddd' },
    ],
    link: { href: '/services/community-based-supports', label: 'Read about Community-Based Supports' },
  },
  'ddd-respite': {
    id: 'ddd-respite',
    say: [
      'DDD Respite gives unpaid family caregivers a break while trained staff support their loved one at home.',
      'It is available in both the Supports Program and the Community Care Program and is paid from the person\'s DDD budget.',
    ],
    options: [
      { id: 'how', label: 'How do I start DDD services?', next: 'ddd-start' },
      { id: 'call-me', label: 'Have someone call me', next: 'lead' },
      { id: 'other', label: 'See other DDD services', next: 'ddd' },
    ],
    link: { href: '/services/ddd-respite', label: 'Read about DDD Respite' },
  },
  'ddd-start': {
    id: 'ddd-start',
    say: [
      'Three steps: confirm DDD eligibility (age 21+, a developmental disability, and NJ FamilyCare eligibility); ask your support coordinator to select Tinash for the services you want in your ISP; then we introduce your staff and agree a schedule.',
      `Support coordinators are welcome to refer directly — call ${site.phone}.`,
    ],
    options: [
      { id: 'call-me', label: 'Have someone call me', next: 'lead' },
      { id: 'book', label: 'Book a free consultation call', next: 'booking' },
    ],
    link: { href: '/ddd-services', label: 'How DDD services work' },
  },
  assessment: {
    id: 'assessment',
    say: [
      "That's exactly what our free care assessment is for — we meet your loved one and recommend only what actually helps.",
      'The easiest first step is a free consultation call.',
    ],
    options: [
      { id: 'book', label: 'Book a free consultation call', next: 'booking' },
      { id: 'call-me', label: 'Just have someone call me', next: 'lead' },
    ],
  },

  guide: {
    id: 'guide',
    say: [
      'GUIDE (Guiding an Improved Dementia Experience) is a Medicare program from the CMS Innovation Center that supports people living with dementia and the family members who care for them.',
      'Tinash delivers GUIDE services locally in partnership with PocketRN, the CMS-selected GUIDE participant. Families get a dedicated nurse, a 24/7 nurse line, caregiver training, care coordination, and — for qualifying families — in-home respite from Tinash caregivers.',
      'For eligible beneficiaries there is no cost to enroll.',
    ],
    options: [
      { id: 'who', label: 'Who qualifies?', next: 'guide-eligibility' },
      { id: 'call-me', label: 'Have someone call me about GUIDE', next: 'lead' },
    ],
    link: { href: '/guide-dementia-care', label: 'Read about the GUIDE Program' },
  },
  'guide-eligibility': {
    id: 'guide-eligibility',
    say: [
      'Your loved one may be eligible for GUIDE if all three apply: they have traditional Medicare (Original Medicare, not a Medicare Advantage plan); they have a dementia diagnosis; and they are not currently enrolled in hospice.',
      `Not sure? Call ${site.guidePhone} and we will help you check eligibility. Please do not share diagnosis details in this chat.`,
    ],
    options: [
      { id: 'call-me', label: 'Have someone call me', next: 'lead' },
      { id: 'other', label: 'Ask about something else', next: 'start' },
    ],
    link: { href: site.guidePhoneHref, label: `Call ${site.guidePhone}` },
  },

  booking: {
    id: 'booking',
    say: [
      `Free consultation calls are available ${site.consultation.label} (New Jersey time).`,
      'Pick a time on the contact page and our team will call to confirm it.',
    ],
    link: { href: '/contact?cta=chat#book', label: 'Choose a time' },
    options: [{ id: 'call-me', label: 'Rather someone just called me', next: 'lead' }],
  },

  job: {
    id: 'job',
    say: [
      'We are hiring caregivers across New Jersey — CHHAs, DSPs, companions, and compassionate people ready to train.',
      'We offer flexible schedules, paid training and real supervision, and clients matched to your skills. You can see open positions and apply on the Careers page.',
    ],
    link: { href: '/careers', label: 'See open positions' },
    options: [
      { id: 'call-me', label: 'Have the hiring team call me', next: 'lead' },
      { id: 'no', label: "I'll use the Careers page", next: 'end' },
    ],
  },

  consulting: {
    id: 'consulting',
    say: [
      'Tinash Consulting helps people launch their own homecare agency: entity setup, licensing pathway, policies and documentation, staffing, and systems — from people who run an agency every day.',
      'Engagements are practical and milestone-based. No guarantees of licensure are made.',
    ],
    link: { href: '/consulting', label: 'Read about consulting' },
    options: [{ id: 'call-me', label: 'Have someone call me', next: 'lead' }],
  },

  human: {
    id: 'human',
    say: [
      'That one is better answered by a person.',
      `Leave your name and a number and someone will call you back, usually within one business day. Office hours: ${hours}.`,
    ],
    options: [{ id: 'yes', label: 'Take my details', next: 'lead' }],
  },
  lead: { id: 'lead', say: [], capture: 'lead' },
  end: {
    id: 'end',
    say: [
      `No problem. If you change your mind, call or text ${site.phone}, or message us on WhatsApp. Office hours: ${hours}.`,
    ],
  },
};
