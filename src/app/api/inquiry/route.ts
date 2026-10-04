import { NextResponse } from "next/server";
import { anonClient } from "@/lib/supabase/anon";
import { isCareService } from "@/lib/care-services";

export const runtime = "nodejs";

/**
 * Lead relay. Normal path: the browser has already written the lead to
 * Supabase `inquiries` (so the database rate limit sees the visitor's real IP)
 * and calls this with `stored: true` only to send the optional email.
 * Fallback path (`stored` false — Supabase not configured or unreachable from
 * the browser): store it here if Supabase is configured, then email / log.
 */

// Per-instance limiter in front of the email relay. The durable rate limit is
// the database trigger on proj_tinash.inquiries (see supabase/migrations).
const hits = new Map<string, { n: number; t: number }>();

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const h = hits.get(ip);
  if (h && now - h.t < 60_000 && h.n >= 5) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "60" } });
  }
  hits.set(ip, { n: h && now - h.t < 60_000 ? h.n + 1 : 1, t: h && now - h.t < 60_000 ? h.t : now });
  if (hits.size > 5000) hits.clear();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const str = (k: string, n: number) => (typeof body[k] === "string" ? (body[k] as string) : "").slice(0, n).trim();

  // Honeypot — bots fill every field.
  if (str("company", 200)) return NextResponse.json({ ok: true });

  const name = str("name", 200);
  const phone = str("phone", 50);
  const email = str("email", 200);
  const message = str("message", 4000);
  const kindRaw = str("kind", 20);
  const kind = ["care", "consulting", "careers", "chat"].includes(kindRaw) ? kindRaw : "care";
  const service = isCareService(body.service) ? body.service : "";
  const stored = body.stored === true;
  const sourcePage = str("source_page", 200) || null;

  if (!name || (!phone && !email)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Supabase first, email second: an email-only lead can be lost silently.
  let savedNow = false;
  if (!stored) {
    const db = anonClient();
    if (db) {
      const { error } = await db.from("inquiries").insert({
        name,
        phone: phone || null,
        email: email || null,
        service_interested:
          kind === "consulting" ? "consulting"
          : kind === "chat" ? "chat-assistant"
          : kind === "careers" ? "caregiver-application"
          : service || "Not sure yet",
        message: message || null,
        source_page: sourcePage,
      });
      if (error?.code === "PT429") {
        return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "600" } });
      }
      if (error) console.error("inquiry: database insert failed", error.code, error.message);
      else savedNow = true;
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.INQUIRY_TO;
  const from = process.env.INQUIRY_FROM ?? "Tinash Website <onboarding@resend.dev>";

  if (apiKey && to) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email || undefined,
        subject: `[Tinash site] New ${service ? `${service} ` : ""}${kind} inquiry from ${name}`,
        text:
          `Kind: ${kind}\nService: ${service || "-"}\nName: ${name}\nPhone: ${phone || "-"}\nEmail: ${email || "-"}\n` +
          `Page: ${sourcePage ?? "-"}\nSaved in CRM: ${stored || savedNow ? "yes" : "NO — reply from this email"}\n\n${message}`,
      }),
    });
    if (!res.ok) {
      console.error("Resend error", res.status, await res.text());
      // The lead is safe if it reached the database; only fail when it did not.
      if (!stored && !savedNow) return NextResponse.json({ error: "send_failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!stored && !savedNow) {
    // Neither database nor email configured yet — log so it shows in function logs.
    console.log("INQUIRY (not stored; email not configured)", { kind, service, name, phone, email, message });
  }
  return NextResponse.json({ ok: true, note: "email_not_configured" });
}
