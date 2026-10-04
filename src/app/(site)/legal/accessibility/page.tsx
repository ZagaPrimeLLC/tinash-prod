import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Accessibility Statement" };

export default function Accessibility() {
  return (
    <>
      <h1>Accessibility Statement</h1>
      <p className="updated">Last updated: October 2026</p>
      <p>
        {site.legalName} is committed to making this website usable by
        everyone, including people with disabilities. We aim to conform to the
        Web Content Accessibility Guidelines (WCAG) 2.1, Level AA.
      </p>
      <h2>What we do</h2>
      <ul>
        <li>Maintain readable color contrast and visible keyboard focus states.</li>
        <li>Respect your system&apos;s reduced-motion preference — animations and background video are disabled or paused when it is set.</li>
        <li>Provide a pause control for background video.</li>
        <li>Use semantic headings, labels on all form fields, and alternative text for meaningful images.</li>
      </ul>
      <h2>Known limitations</h2>
      <p>
        Some decorative media may lack full alternatives while we continue to
        improve. We review the site regularly and fix issues as we find them.
      </p>
      <h2>Feedback</h2>
      <p>
        If anything on this site is hard for you to use, please tell us — we
        will fix it or provide the information another way. Contact{" "}
        <a href={`mailto:${site.email}`}>{site.email}</a> or call{" "}
        <a href={site.phoneHref}>{site.phone}</a>.
      </p>
    </>
  );
}
