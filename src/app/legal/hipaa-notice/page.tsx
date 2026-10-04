import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "HIPAA Notice of Privacy Practices",
};

export default function HipaaNotice() {
  return (
    <>
      <h1>Notice of Privacy Practices</h1>
      <p className="updated">
        Effective: October 2026 · This notice describes how health information
        about you may be used and disclosed and how you can get access to this
        information. Please review it carefully.
      </p>
      <h2>Our commitment</h2>
      <p>
        {site.legalName} is required by law to maintain the privacy of your
        protected health information (&quot;PHI&quot;), to provide you this
        notice of our legal duties and privacy practices, and to follow the
        terms of the notice currently in effect.
      </p>
      <h2>How we may use and disclose your health information</h2>
      <ul>
        <li>
          <strong>Treatment / services:</strong> to provide and coordinate your
          care — for example, sharing information with your caregivers, your
          support coordinator, or other providers involved in your care.
        </li>
        <li>
          <strong>Payment:</strong> to bill and collect payment for services —
          for example, submitting claims to Medicaid or other payers.
        </li>
        <li>
          <strong>Operations:</strong> for quality review, training, and
          administration of our agency.
        </li>
        <li>
          <strong>As required or permitted by law:</strong> including public
          health reporting, abuse or neglect reporting, health oversight,
          judicial proceedings, and to avert serious threats to health or
          safety.
        </li>
      </ul>
      <p>
        Other uses and disclosures — including most uses of psychotherapy
        notes, marketing, and any sale of PHI — will be made only with your
        written authorization, which you may revoke at any time.
      </p>
      <h2>Your rights</h2>
      <ul>
        <li>Request restrictions on certain uses and disclosures of your PHI.</li>
        <li>Request confidential communications (for example, to a specific phone number or address).</li>
        <li>Inspect and receive a copy of your health records, including an electronic copy.</li>
        <li>Request an amendment to your records if you believe they are incorrect or incomplete.</li>
        <li>Receive an accounting of certain disclosures we have made.</li>
        <li>Receive a paper copy of this notice at any time, even if you agreed to receive it electronically.</li>
        <li>Be notified if a breach of your unsecured PHI occurs.</li>
      </ul>
      <h2>Complaints</h2>
      <p>
        If you believe your privacy rights have been violated, you may file a
        complaint with us at <a href={`mailto:${site.email}`}>{site.email}</a>{" "}
        or {site.phone}, or with the U.S. Department of Health and Human
        Services, Office for Civil Rights. You will not be penalized or
        retaliated against for filing a complaint.
      </p>
      <h2>Changes to this notice</h2>
      <p>
        We reserve the right to change this notice and to make the revised
        notice effective for PHI we already hold. The current notice will
        always be posted on this page.
      </p>
      <h2>Privacy contact</h2>
      <p>
        Privacy Officer, {site.legalName} ·{" "}
        <a href={`mailto:${site.email}`}>{site.email}</a> · {site.phone}
      </p>
    </>
  );
}
