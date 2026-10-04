import type { Metadata } from "next";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/site";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — In-Home Care & DDD Services in New Jersey`,
    template: `%s — ${site.name}`,
  },
  description:
    "Licensed in-home care across New Jersey: skilled nursing, companion care, live-in & 24/7 care, respite, and NJ DDD services. Get a free care assessment today.",
  openGraph: {
    title: `${site.name} — In-Home Care in New Jersey`,
    description:
      "Skilled nursing, companion care, live-in & 24/7 care, respite, and NJ DDD services — delivered with warmth, at home.",
    url: site.url,
    siteName: site.name,
    images: [{ url: "/media/hero-poster.webp", width: 1920, height: 1080 }],
    locale: "en_US",
    type: "website",
  },
  robots: { index: true, follow: true },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "HomeHealthCareService",
  name: site.name,
  url: site.url,
  telephone: site.phone,
  email: site.email,
  areaServed: site.serviceArea.map((county) => ({
    "@type": "AdministrativeArea",
    name: `${county}, NJ`,
  })),
  address: { "@type": "PostalAddress", addressRegion: "NJ", addressCountry: "US" },
  openingHours: ["Mo-Fr 09:00-19:00", "Sa-Su 10:00-14:00"],
  sameAs: site.social.map((s) => s.href),
  description:
    "In-home care agency serving New Jersey families: skilled nursing, companion care, live-in and 24/7 care, respite care, and NJ DDD (Division of Developmental Disabilities) services.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${inter.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Public header/footer live in (site)/layout.tsx so the CRM under
            (dashboard) and /login get their own chrome. */}
        {children}
      </body>
    </html>
  );
}
