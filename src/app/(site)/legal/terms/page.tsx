import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata("/legal/terms", {
  title: "Terms of Use",
  description:
    "The terms that apply when you use the Tinash Homecare Services website, including content, forms, and links to other sites.",
});

export default function Terms() {
  return (
    <>
      <h1>Terms of Use</h1>
      <p className="updated">Last updated: October 2026</p>
      <p>
        Welcome to the website of {site.legalName}. By using this website you
        agree to these terms.
      </p>
      <h2>Informational purpose</h2>
      <p>
        Content on this website is provided for general information about our
        services. It is <strong>not medical advice</strong>, and it does not
        create a care relationship. Care services are provided only under a
        written service agreement following an assessment.
      </p>
      <h2>No emergency use</h2>
      <p>
        Do not use this website for emergencies. If you or a loved one is
        experiencing a medical emergency, call 911.
      </p>
      <h2>Use of the site</h2>
      <p>
        You agree not to misuse this website — including attempting to access
        systems without authorization, submitting false or malicious content,
        or scraping personal information.
      </p>
      <h2>Intellectual property</h2>
      <p>
        The content, design, and branding of this website belong to{" "}
        {site.legalName} and may not be copied for commercial use without
        permission.
      </p>
      <h2>Consulting services</h2>
      <p>
        Consulting engagements are governed by a separate written agreement.
        Nothing on this website guarantees licensure, registration, or
        business results.
      </p>
      <h2>Disclaimer and limitation of liability</h2>
      <p>
        This website is provided &quot;as is.&quot; To the fullest extent
        permitted by law, {site.legalName} disclaims warranties of any kind and
        is not liable for damages arising from use of this website.
      </p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the State of New Jersey.</p>
      <h2>Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href={`mailto:${site.email}`}>{site.email}</a>.
      </p>
    </>
  );
}
