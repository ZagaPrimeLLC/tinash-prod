/** A caregiver applicant on the Applicants pipeline. */
export type BoardCard = {
  id: string;
  stage: string;
  owner: string | null;
  qualified: boolean;
  ready: boolean;
  score: number | null;
  lastContactAt: string | null;
  createdAt: string;
  attempts: number;
  archiveReason: string | null;
  applicant: { name: string; phone: string | null; email: string | null; source: string | null };
  position: { title: string; location: string | null } | null;
};

/** A family's care inquiry on the Care inquiries pipeline. Contact details only, never clinical. */
export type InquiryCard = {
  id: string;
  stage: string;
  name: string;
  phone: string | null;
  email: string | null;
  service: string | null;
  createdAt: string;
  handledAt: string | null;
  mine: boolean;
};
