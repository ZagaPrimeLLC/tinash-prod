import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Simple in-memory rate limit per instance.
const hits = new Map<string, { n: number; t: number }>();

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const now = Date.now();
  const h = hits.get(ip);
  if (h && now - h.t < 60_000 && h.n >= 5) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  hits.set(ip, { n: h && now - h.t < 60_000 ? h.n + 1 : 1, t: h && now - h.t < 60_000 ? h.t : now });

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  // Honeypot — bots fill every field.
  if (body.company) return NextResponse.json({ ok: true });

  const name = (body.name ?? "").toString().slice(0, 200).trim();
  const phone = (body.phone ?? "").toString().slice(0, 50).trim();
  const email = (body.email ?? "").toString().slice(0, 200).trim();
  const message = (body.message ?? "").toString().slice(0, 4000).trim();
  const kind = ["care", "consulting", "careers"].includes(body.kind)
    ? body.kind
    : "care";

  if (!name || !phone) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
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
        subject: `[Tinash site] New ${kind} inquiry from ${name}`,
        text: `Kind: ${kind}\nName: ${name}\nPhone: ${phone}\nEmail: ${email || "-"}\n\n${message}`,
      }),
    });
    if (!res.ok) {
      console.error("Resend error", res.status, await res.text());
      return NextResponse.json({ error: "send_failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  // Not configured yet — log so submissions appear in Vercel function logs.
  console.log("INQUIRY (email not configured)", { kind, name, phone, email, message });
  return NextResponse.json({ ok: true, note: "email_not_configured" });
}
