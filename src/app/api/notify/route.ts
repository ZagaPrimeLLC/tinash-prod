import { NextResponse } from "next/server";
import { notifyOffice } from "@/lib/notify";

/**
 * Office notification for submissions the browser has already saved to
 * Supabase directly (consultation bookings, applications, newsletter). The
 * record is safe in the CRM before this is called; this only sends the email.
 * Inquiries and chat leads use /api/inquiry instead.
 *
 * The recipient is fixed server-side (NOTIFY_TO), so the worst abuse is spam
 * to the office inbox; the per-IP limiter below keeps that in check.
 */
const hits = new Map<string, { n: number; t: number }>();

type Kind = "booking" | "application" | "newsletter";

export async function POST(req: Request) {
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const h = hits.get(ip);
  const fresh = h && now - h.t < 600_000;
  if (fresh && h.n >= 6) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  hits.set(ip, { n: fresh ? h.n + 1 : 1, t: fresh ? h.t : now });
  if (hits.size > 5000) hits.clear();

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const s = (k: string, n = 300) => (typeof b[k] === "string" ? (b[k] as string).slice(0, n).trim() : "");
  const kind = s("kind", 20) as Kind;
  const name = s("name", 200);
  const email = s("email", 200);
  const phone = s("phone", 50);

  if (kind === "booking") {
    if (!name || (!phone && !email)) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    await notifyOffice({
      subject: `New consultation booking: ${name}${s("slot", 80) ? ` (${s("slot", 80)})` : ""}`,
      fields: [
        ["Name", name],
        ["Phone", phone],
        ["Email", email],
        ["Requested time", s("slot", 120)],
        ["Service", s("service", 80)],
        ["From page", s("source_page", 200)],
        ["Saved in CRM", "Yes (CRM → Inbox)"],
      ],
      body: s("message", 4000),
      replyTo: email || null,
    });
  } else if (kind === "application") {
    if (!name) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    const job = s("job", 160);
    await notifyOffice({
      subject: `New job application: ${name}${job ? ` — ${job}` : " (general application)"}`,
      fields: [
        ["Name", name],
        ["Phone", phone],
        ["Email", email],
        ["Position", job || "General application"],
        ["Town", s("town", 120)],
        ["Availability", s("availability", 120)],
        ["CPR / First Aid", s("cpr", 10)],
        ["Has a car", s("drives", 10)],
        ["Résumé attached in CRM", s("resume", 10)],
        ["Saved in CRM", "Yes (CRM → Applicants)"],
      ],
      body: s("experience", 4000),
      replyTo: email || null,
    });
  } else if (kind === "newsletter") {
    if (!email) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    await notifyOffice({
      subject: `New newsletter signup: ${email}`,
      fields: [["Email", email], ["From page", s("source_page", 200)]],
    });
  } else {
    return NextResponse.json({ error: "bad_kind" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
