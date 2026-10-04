import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Nondiscrimination Notice" };

export default function Nondiscrimination() {
  return (
    <>
      <h1>Notice of Nondiscrimination</h1>
      <p className="updated">Last updated: October 2026</p>
      <p>
        {site.legalName} complies with applicable Federal civil rights laws,
        including Section 1557 of the Affordable Care Act, and does not
        discriminate on the basis of race, color, national origin, age,
        disability, or sex (including pregnancy, sexual orientation, and gender
        identity).
      </p>
      <h2>Free aids and services</h2>
      <p>We provide, free of charge:</p>
      <ul>
        <li>
          Language assistance services for people whose primary language is not
          English, such as qualified interpreters and information written in
          other languages.
        </li>
        <li>
          Auxiliary aids and services for people with disabilities to
          communicate effectively with us, such as written information in other
          formats.
        </li>
      </ul>
      <p>
        If you need these services, contact us at{" "}
        <a href={site.phoneHref}>{site.phone}</a> or{" "}
        <a href={`mailto:${site.email}`}>{site.email}</a>.
      </p>
      <h2>Language assistance</h2>
      <p>
        ATENCIÓN: si habla español, tiene a su disposición servicios gratuitos
        de asistencia lingüística. Llame al {site.phone}.
      </p>
      <p>
        ATANSYON: Si w pale Kreyòl Ayisyen, gen sèvis èd pou lang ki disponib
        gratis pou ou. Rele {site.phone}.
      </p>
      <p>
        注意：如果您使用繁體中文，您可以免費獲得語言援助服務。請致電{" "}
        {site.phone}。
      </p>
      <h2>Grievances</h2>
      <p>
        If you believe we have failed to provide these services or
        discriminated in another way, you can file a grievance with our Civil
        Rights Coordinator at <a href={`mailto:${site.email}`}>{site.email}</a>{" "}
        or {site.phone}. You can also file a civil rights complaint with the
        U.S. Department of Health and Human Services, Office for Civil Rights,
        at{" "}
        <a
          href="https://ocrportal.hhs.gov/ocr/portal/lobby.jsf"
          rel="noopener noreferrer"
        >
          ocrportal.hhs.gov
        </a>{" "}
        or by phone at 1-800-368-1019 (TDD: 1-800-537-7697).
      </p>
    </>
  );
}
