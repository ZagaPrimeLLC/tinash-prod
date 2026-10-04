# Tinash Homecare Services — tinash-prod

Public site for tinashhomecareservices.com (Next.js App Router, Tailwind v4, Framer Motion) + ops CRM (phase 2).

## Dev
npm install && npm run dev

## Env (forms)
- RESEND_API_KEY — Resend key
- INQUIRY_TO — where inquiries are emailed
- INQUIRY_FROM — verified sender, e.g. "Tinash Website <no-reply@tinashhomecareservices.com>"

Until these are set, form submissions return OK and are visible in Vercel function logs only.

## Media
AI-generated placeholders in public/media (Higgsfield). Replace with real client/caregiver photography when available.
