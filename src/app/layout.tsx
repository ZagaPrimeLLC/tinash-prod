import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { site } from "@/lib/site";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT", "WONK"],
});

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — In-Home Care & DDD Services in New Jersey`,
    template: `%s — ${site.name}`,
  },
  description:
    "Licensed in-home care across New Jersey: companion care, live-in & 24/7 care, respite, and NJ DDD services. Get a free care assessment today.",
  openGraph: {
    title: `${site.name} — In-Home Care in New Jersey`,
    description:
      "Companion care, live-in & 24/7 care, respite, and NJ DDD services — delivered with warmth, at home.",
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
  openingHours: "Mo-Su 00:00-24:00",
  description:
    "In-home care agency serving New Jersey families: companion care, live-in and 24/7 care, respite care, and NJ DDD (Division of Developmental Disabilities) services.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
