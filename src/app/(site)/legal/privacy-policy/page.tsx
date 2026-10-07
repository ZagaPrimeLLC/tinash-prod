import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata("/legal/privacy-policy", {
  title: "Privacy Policy",
  description:
    "How Tinash Homecare Services collects, uses, and protects the personal information you share through our website, forms, and chat.",
});

export default function PrivacyPolicy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="updated">Last updated: October 2026</p>
      <p>
        {site.legalName} (&quot;Tinash,&quot; &quot;we,&quot; &quot;us&quot;)
        respects your privacy. This policy explains what information this
        website collects, how we use it, and the choices you have.
      </p>
      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Information you give us:</strong> when you submit a care
          inquiry, job application, or consulting request, we collect the
          details you provide — typically your name, phone number, email, and
          your message. Please do not include medical, diagnosis, or insurance
          details in website forms; we discuss care needs privately by phone.
        </li>
        <li>
          <strong>Technical information:</strong> like most websites, our
          hosting provider logs basic technical data (IP address, browser type,
          pages visited) for security and performance.
        </li>
      </ul>
      <h2>How we use information</h2>
      <ul>
        <li>To respond to your inquiry and provide the services you request.</li>
        <li>To consider your application for employment.</li>
        <li>To operate, secure, and improve this website.</li>
      </ul>
      <p>
        We do <strong>not</strong> sell your personal information, and we do
        not use advertising trackers on pages where you contact us about care.
      </p>
      <h2>How we share information</h2>
      <p>
        We share information only with service providers who help us run this
        website and respond to inquiries (for example, email delivery and
        website hosting), and when required by law. Health information we
        receive in the course of providing care is protected as described in
        our{" "}
        <a href="/legal/hipaa-notice">Notice of Privacy Practices</a>.
      </p>
      <h2>Retention</h2>
      <p>
        We keep inquiry and application records only as long as needed for the
        purpose they were submitted for, or as required by law.
      </p>
      <h2>Your choices</h2>
      <p>
        You may contact us at{" "}
        <a href={`mailto:${site.email}`}>{site.email}</a> or{" "}
        <a href={site.phoneHref}>{site.phone}</a> to ask what information we
        hold about you, request a correction, or request deletion where the law
        allows.
      </p>
      <h2>Children</h2>
      <p>
        This website is intended for adults. We do not knowingly collect
        personal information from children through this website.
      </p>
      <h2>Changes</h2>
      <p>
        We may update this policy from time to time. The &quot;last
        updated&quot; date above reflects the current version.
      </p>
    </>
  );
}
