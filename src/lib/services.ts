export type Service = {
  slug: string;
  name: string;
  short: string;
  image: string;
  hero: string;
  body: string[];
  bullets: string[];
};

export const services: Service[] = [
  {
    slug: "companion-care",
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
    name: "Respite Care",
    short:
      "Temporary relief for family caregivers — hours, days, or weeks at a time.",
    image: "/media/respite.webp",
    hero: "Rest for you. Great care for them.",
    body: [
      "Family caregivers burn out — it's not a failure, it's human. Respite care gives you time to rest, travel, or simply breathe, while a professional caregiver steps in with an individualized plan.",
      "Use it for an afternoon a week or a two-week stretch. Your routine, their comfort, no disruption.",
    ],
    bullets: [
      "Flexible scheduling — from 4 hours to multi-week",
      "Individualized care plans",
      "Personal care, meals, and activities",
      "Clear handoff notes back to the family",
    ],
  },
  {
    slug: "ddd-services",
    name: "DDD Services",
    short:
      "Approved supports for NJ Division of Developmental Disabilities participants and their families.",
    image: "/media/ddd.webp",
    hero: "DDD supports, explained in plain language",
    body: [
      "Navigating the NJ Division of Developmental Disabilities shouldn't require a law degree. We help participants and guardians understand their budgets and put them to work — individual supports, community inclusion, and respite delivered by trained staff.",
      "Our team supports participants with dignity-first care focused on independence, community participation, and real quality of life.",
    ],
    bullets: [
      "Individual supports in the home",
      "Community inclusion and day activities",
      "Respite for family caregivers",
      "Help understanding DDD budgets and goals",
      "Coordination with support coordinators",
    ],
  },
  {
    slug: "senior-care",
    name: "Daily Senior Care",
    short:
      "Daily personal care and attention for seniors who need steady support.",
    image: "/media/companion.webp",
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
    slug: "community-support",
    name: "Community Support",
    short:
      "Personalized support that keeps clients active and connected, around the clock.",
    image: "/media/ddd.webp",
    hero: "Connected to community, supported at home",
    body: [
      "Care doesn't stop at the front door. Our community support services keep clients engaged with the people and places that matter — classes, worship, parks, friends.",
      "Our team is available around the clock with a compassionate, supportive approach to every outing and every day.",
    ],
    bullets: [
      "Escorted outings and community activities",
      "Transportation coordination",
      "Social and recreational engagement",
      "24/7 team availability",
    ],
  },
];

export function getService(slug: string) {
  return services.find((s) => s.slug === slug);
}
