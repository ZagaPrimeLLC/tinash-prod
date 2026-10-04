// Central site configuration — edit here, reflected everywhere.
// TODO(Kzee): confirm phone + email before DNS cutover.
export const site = {
  name: "Tinash Homecare Services",
  legalName: "Tinash Homecare Services LLC",
  tagline: "Care that lets your loved one stay home",
  url: "https://tinashhomecareservices.com",
  phone: "+1 (862) 203-0064", // TODO: confirm agency line
  phoneHref: "tel:+18622030064",
  email: "care@tinashhomecareservices.com", // TODO: confirm mailbox name
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
  social: {
    facebook: "",
    instagram: "",
  },
  nav: [
    { label: "Services", href: "/services" },
    { label: "DDD Services", href: "/services/ddd-services" },
    { label: "About", href: "/about" },
    { label: "Careers", href: "/careers" },
    { label: "Consulting", href: "/consulting" },
    { label: "Contact", href: "/contact" },
  ],
} as const;
