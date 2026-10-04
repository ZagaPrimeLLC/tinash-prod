// Tinash runs two service lines that New Jersey regulates and funds
// separately, so the site presents them separately:
//  - Home Care: private-duty home care and skilled nursing for seniors and
//    adults (health care service firm side; paid privately or by insurance).
//  - DDD Services: Medicaid waiver services for adults 21+ with intellectual
//    or developmental disabilities, chosen with a DDD support coordinator and
//    paid from the person's DDD budget. DDD approval is per service, so only
//    list services Tinash is approved to deliver.
// The Medicare GUIDE dementia program is a third, separate program with its
// own page (/guide-dementia-care).

export type ServiceLine = "home-care" | "ddd";

export type Service = {
  slug: string;
  line: ServiceLine;
  name: string;
  short: string;
  image: string;
  hero: string;
  body: string[];
  bullets: string[];
  /** DDD only: which DDD program(s) fund this service. */
  dddProgram?: string;
};

export const serviceLines: Record<
  ServiceLine,
  { label: string; href: string; tagline: string; who: string; payment: string; start: string }
> = {
  "home-care": {
    label: "Home Care",
    href: "/services#home-care",
    tagline: "Nursing and personal care at home for seniors and adults.",
    who: "Seniors and adults who need help at home — after a hospital stay, with a chronic condition, or as needs grow with age.",
    // TODO(confirm): add MLTSS / NJ FamilyCare MCO, VA, or other payers only once Tinash is contracted.
    payment: "Private pay and long-term care insurance. Call us to talk through options.",
    start: "Call us or request a free in-home care assessment.",
  },
  ddd: {
    label: "DDD Services",
    href: "/ddd-services",
    tagline: "NJ DDD-approved supports for adults with intellectual and developmental disabilities.",
    who: "Adults 21 and older who are eligible for the NJ Division of Developmental Disabilities (DDD) and enrolled in the Supports Program or Community Care Program.",
    payment: "Paid from the person's DDD budget through NJ FamilyCare (Medicaid) — no bill to the family.",
    start: "Ask your support coordinator to add Tinash to your Individualized Service Plan (ISP), or call us and we'll help.",
  },
};

export const services: Service[] = [
  // ---- Home Care ----
  {
    slug: "skilled-nursing",
    line: "home-care",
    name: "Skilled Nursing",
    short:
      "Nurses at home for medication management, health checks, wound care, and appointment support.",
    image: "/media/caregiver.webp",
    hero: "Nursing care, without the waiting room",
    body: [
      "Some care needs a nurse. Our nurses come to the home to manage medications, check in on health, and handle wound care — so your loved one gets clinical attention without the trips, the traffic, or the waiting room.",
      "We also go with clients to doctor appointments, take notes, and report back to the family, so everyone leaves knowing what was said and what happens next.",
    ],
    bullets: [
      "Medication pours, set-up, and administration",
      "Nurse check-ins: vital signs and health monitoring",
      "Wound care and dressing changes",
      "Accompaniment to doctor appointments, with notes for the family",
      "Coordination with physicians and care teams",
      "Teaching for family caregivers",
    ],
  },
  {
    slug: "senior-care",
    line: "home-care",
    name: "Daily Senior Care",
    short:
      "Daily personal care and attention for seniors who need steady support.",
    image: "/media/hero-poster.webp",
    hero: "Daily care for the people who raised us",
    body: [
      "Primarily designed for senior citizens who need special care and constant attention, our daily care keeps mornings calm, medications on time, and days full.",
      "Caregivers are matched for personality as much as skill — because the right fit is what makes care feel like family.",
    ],
    bullets: [
      "Bathing, dressing, and grooming support",
      "Mobility and transfer assistance",
      "Meal planning and preparation",
      "Medication reminders and appointment support",
    ],
  },
  {
    slug: "companion-care",
    line: "home-care",
    name: "Companion Care",
    short:
      "Friendly, reliable company — conversation, meals, errands, and a watchful eye.",
    image: "/media/companion.webp",
    hero: "Companionship that brightens every day",
    body: [
      "Loneliness is as serious a health risk as any diagnosis. Our companion caregivers bring warmth, conversation, and consistency into the home — the same familiar face, visit after visit.",
      "From shared meals and card games to light housekeeping and errands, companion care keeps daily life moving and gives families peace of mind between visits.",
    ],
    bullets: [
      "Conversation and meaningful activities",
      "Meal preparation and light housekeeping",
      "Errands, groceries, and appointments",
      "Medication reminders",
      "Regular family updates",
    ],
  },
  {
    slug: "live-in-care",
    line: "home-care",
    name: "Live-In & 24/7 Care",
    short:
      "Round-the-clock support from caregivers who are there through the night.",
    image: "/media/livein.webp",
    hero: "Round-the-clock care, right at home",
    body: [
      "Some clients need more than visits — they need someone there. Our live-in caregivers provide continuous support so your loved one is safe, comfortable, and never alone.",
      "We build 24/7 schedules with trained, supervised caregivers and a clear care plan the whole family can see.",
    ],
    bullets: [
      "Live-in and rotating 24/7 schedules",
      "Personal care and mobility support",
      "Overnight safety and fall prevention",
      "Care plans reviewed with the family",
      "Backup coverage — no missed shifts",
    ],
  },
  {
    slug: "respite-care",
    line: "home-care",
    name: "Respite Care",
    short:
      "Temporary relief for family caregivers of seniors and adults — hours, days, or weeks at a time.",
    image: "/media/respite.webp",
    hero: "Rest for you. Great care for them.",
    body: [
      "Family caregivers burn out — it's not a failure, it's human. Respite care gives you time to rest, travel, or simply breathe, while a professional caregiver steps in with an individualized plan.",
      "Use it for an afternoon a week or a two-week stretch. Your routine, their comfort, no disruption. (Caring for an adult who receives NJ DDD services? See DDD Respite.)",
    ],
    bullets: [
      "Flexible scheduling — from 4 hours to multi-week",
      "Individualized care plans",
      "Personal care, meals, and activities",
      "Clear handoff notes back to the family",
    ],
  },

  // ---- DDD Services ----
  {
    slug: "individual-supports",
    line: "ddd",
    name: "Individual Supports",
    dddProgram: "Community Care Program",
    short:
      "One-to-one support at home for DDD participants — daily living, steady routines, and growing independence.",
    image: "/media/ddd.webp",
    hero: "Support at home, built around the person",
    body: [
      "Individual Supports are one-to-one services delivered in the person's home. A trained Direct Support Professional helps with daily living — and, just as important, builds the skills to do more of it independently.",
      "In New Jersey, Individual Supports are a DDD Community Care Program service. The hours and goals are written into the person's Individualized Service Plan (ISP) with their support coordinator.",
    ],
    bullets: [
      "Help with self-care, meals, and household routines",
      "Building daily living and independence skills",
      "Keeping schedules and routines steady",
      "Trained, supervised Direct Support Professionals",
      "Progress shared with the planning team",
    ],
  },
  {
    slug: "community-based-supports",
    line: "ddd",
    name: "Community-Based Supports",
    dddProgram: "Supports Program",
    short:
      "One-to-one support out in the community — errands, activities, and real connection for DDD participants.",
    image: "/media/respite.webp",
    hero: "Out in the community, with the right support",
    body: [
      "Community-Based Supports pair a participant with a trained staff member for one-to-one time in the community: running errands, joining activities, practicing travel and social skills, and building real connections with the people and places that matter.",
      "In New Jersey, Community-Based Supports are a DDD Supports Program service, planned with the person's support coordinator and tracked against the goals in their ISP.",
    ],
    bullets: [
      "Errands, shopping, and community outings",
      "Classes, worship, recreation, and social activities",
      "Practicing travel, money, and social skills",
      "One-to-one support from trained staff",
      "Goals tracked against the ISP",
    ],
  },
  {
    slug: "ddd-respite",
    line: "ddd",
    name: "DDD Respite",
    dddProgram: "Supports Program & Community Care Program",
    short:
      "Short-term relief for unpaid family caregivers of DDD participants, paid from the participant's DDD budget.",
    image: "/media/companion.webp",
    hero: "A break for the family. Steady support for them.",
    body: [
      "Respite gives unpaid family caregivers time to rest, work, or handle life — while a trained staff member supports their loved one, keeping routines and preferences on track.",
      "For DDD participants, respite is available in both the Supports Program and the Community Care Program and is paid from the person's DDD budget, so there's no bill to the family.",
    ],
    bullets: [
      "In-home respite by the hour or the day",
      "Familiar, consistent staff",
      "Routines and preferences followed",
      "Scheduled around the family",
      "Planned with your support coordinator",
    ],
  },
];

export const servicesByLine = (line: ServiceLine) =>
  services.filter((s) => s.line === line);

export function getService(slug: string) {
  return services.find((s) => s.slug === slug);
}
