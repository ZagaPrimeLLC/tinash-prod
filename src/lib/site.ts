import { servicesByLine } from "@/lib/services";

// Central site configuration — edit here, reflected everywhere.
// Socials match the original WordPress site (tinashhomecareservices.com,
// checked Oct 2026). Phone and hours match the Google Business Profile.
export const site = {
  name: "Tinash Homecare Services",
  legalName: "Tinash Homecare Services LLC",
  tagline: "Care that lets your loved one stay home",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://tinashhomecareservices.com",
  // Team CRM host. Never linked from the public site.
  crmUrl: process.env.NEXT_PUBLIC_CRM_URL ?? "https://crm.tinashhomecareservices.com",
  logo: "/brand/logo.png",
  logoWhite: "/brand/logo-white.png",
  phone: "+1 (973) 636-8328",
  phoneHref: "tel:+19736368328",
  whatsappHref: "https://wa.me/19736368328",
  email: "info@tinashhomecareservices.com",
  hours: [
    { days: "Mon–Fri", time: "9:00 AM – 5:00 PM" },
    { days: "Sat–Sun", time: "11:00 AM – 2:00 PM" },
  ],
  // Free consultation booking (contact page + chatbot). Tinash's real
  // availability has not been confirmed yet.
  // TODO(confirm): consultation days/hours with the Tinash office.
  consultation: {
    days: [1, 2, 3, 4, 5], // 0 = Sun … 6 = Sat → Mon–Fri
    startMinutes: 10 * 60, // 10:00 AM
    endMinutes: 16 * 60, // last consultation finishes by 4:00 PM
    slotMinutes: 30,
    weeksAhead: 3,
    minNoticeHours: 24,
    timeZone: "America/New_York",
    label: "Weekdays, 10:00 AM – 4:00 PM",
  },
  address: {
    region: "NJ",
    country: "US",
  },
  serviceArea: [
    "Essex County",
    "Union County",
    "Middlesex County",
    "Somerset County",
    "Morris County",
    "Hudson County",
  ],
  social: [
    { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61559684791137" },
    { label: "Instagram", href: "https://www.instagram.com/tinashhomecareservices/" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/tinash-home-care-916bb2303/" },
    { label: "X (Twitter)", href: "https://twitter.com/tinashhomecare" },
  ],
  nav: [
    { label: "Home", href: "/" },
    {
      label: "Services",
      href: "/services",
      groups: [
        {
          title: "Home Care",
          href: "/services#home-care",
          links: servicesByLine("home-care").map((s) => ({ label: s.name, href: `/services/${s.slug}` })),
        },
        {
          title: "DDD Services",
          href: "/ddd-services",
          links: [
            { label: "How DDD services work", href: "/ddd-services" },
            ...servicesByLine("ddd").map((s) => ({ label: s.name, href: `/services/${s.slug}` })),
          ],
        },
        {
          title: "Medicare Program",
          href: "/guide-dementia-care",
          links: [{ label: "GUIDE Dementia Care", href: "/guide-dementia-care" }],
        },
      ],
    },
    { label: "DDD Services", href: "/ddd-services" },
    { label: "About", href: "/about" },
    { label: "Careers", href: "/careers" },
    { label: "Consulting", href: "/consulting" },
    { label: "Contact", href: "/contact" },
  ],
} as const;
