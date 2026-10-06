// notify-office — emails the Tinash office (phane@) about every new website
// submission: care inquiries / contact / chat leads, consultation bookings,
// website job + general applications, newsletter signups.
//
// Called by database triggers (proj_tinash.notify_office_trigger) with only
// { table, id }. The function never trusts the request: it re-reads the record
// with the service role, only emails for records created in the last 15
// minutes, and logs each one in proj_tinash.notification_log so it is sent
// exactly once. That makes the public endpoint safe to leave without JWT
// verification (deploy with --no-verify-jwt).
//
// Sends through the Hostinger mailbox over SMTPS (465). This runs on Supabase,
// not Cloudflare: Cloudflare Workers cannot open sockets to Hostinger's SMTP
// host because it sits on Cloudflare's own network.
//
// Secrets (Edge Functions → Secrets): SMTP_USER, SMTP_PASS, NOTIFY_TO
// (comma-separated; default phane@tinashhomecareservices.com).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const TABLES = ["inquiries", "bookings", "applications", "newsletter_subscribers"] as const;
type Table = (typeof TABLES)[number];
const FRESH_MS = 15 * 60 * 1000;

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  db: { schema: "proj_tinash" },
  auth: { persistSession: false },
});

type Mail = { subject: string; fields: [string, unknown][]; body?: string | null; replyTo?: string | null };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
// denomailer cannot encode characters outside Latin-1 (em dashes, arrows,
// emoji in a visitor's message), so map the common ones and drop the rest.
const latin1 = (s: string) =>
  s.replace(/[\u2013\u2014]/g, "-").replace(/\u2192/g, "->").replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"').replace(/\u2026/g, "...").replace(/[^\x00-\xff]/g, "");
const present = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";
const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) : null;

async function build(table: Table, id: string): Promise<Mail | null> {
  if (table === "inquiries") {
    const { data: r } = await db.from("inquiries").select("*").eq("id", id).maybeSingle();
    if (!r) return null;
    const kind =
      r.service_interested === "chat-assistant" ? "Chat assistant callback request"
      : r.service_interested === "consulting" ? "Consulting inquiry"
      : r.service_interested === "caregiver-application" ? "Caregiver inquiry"
      : `${r.service_interested && r.service_interested !== "Not sure yet" ? r.service_interested + " " : "Care "}inquiry`;
    return {
      subject: `New ${kind} from ${r.name}`,
      fields: [["Name", r.name], ["Phone", r.phone], ["Email", r.email], ["Service", r.service_interested],
        ["From page", r.source_page], ["Received", when(r.created_at)], ["In the CRM", "Inbox"]],
      body: r.message,
      replyTo: r.email,
    };
  }
  if (table === "bookings") {
    const { data: r } = await db.from("bookings").select("*").eq("id", id).maybeSingle();
    if (!r) return null;
    return {
      subject: `New consultation booking: ${r.name} (${when(r.requested_slot)})`,
      fields: [["Name", r.name], ["Phone", r.phone], ["Email", r.email], ["Requested time", when(r.requested_slot)],
        ["Received", when(r.created_at)], ["In the CRM", "Inbox → bookings"]],
      body: r.notes,
      replyTo: r.email,
    };
  }
  if (table === "applications") {
    const { data: a } = await db
      .from("applications")
      .select("created_at, screening_answers, applicants(name, email, phone, source, about, resume_url), job_posts(title, location)")
      .eq("id", id)
      .maybeSingle();
    // deno-lint-ignore no-explicit-any
    const p = (a as any)?.applicants;
    if (!a || !p) return null;
    // Only website applications; CSV imports and the automatic feed are not emailed.
    if (!/website/i.test(p.source ?? "")) return null;
    // deno-lint-ignore no-explicit-any
    const job = (a as any).job_posts;
    // deno-lint-ignore no-explicit-any
    const ans = ((a as any).screening_answers ?? {}) as Record<string, unknown>;
    const yes = (v: unknown) => (v === true ? "Yes" : null);
    return {
      subject: `New job application: ${p.name}${job?.title ? ` — ${job.title}` : " (general application)"}`,
      fields: [["Name", p.name], ["Phone", p.phone], ["Email", p.email],
        ["Position", job?.title ? `${job.title}${job.location ? `, ${job.location}` : ""}` : `General application${ans.role ? ` (${ans.role})` : ""}`],
        ["Lives in", ans.area], ["Availability", ans.availability], ["CPR / First Aid", yes(ans.cpr_first_aid)],
        ["Drives with own car", yes(ans.driver_with_vehicle)], ["Résumé", p.resume_url ? "Attached (open it in the CRM)" : null],
        ["Received", when(a.created_at)], ["In the CRM", "Applicants"]],
      body: p.about,
      replyTo: p.email,
    };
  }
  if (table === "newsletter_subscribers") {
    const { data: r } = await db.from("newsletter_subscribers").select("*").eq("id", id).maybeSingle();
    if (!r) return null;
    return { subject: `New newsletter signup: ${r.email}`, fields: [["Email", r.email], ["Received", when(r.created_at)]] };
  }
  return null;
}

function render(m: Mail) {
  const rows = m.fields.filter(([, v]) => present(v)).map(([k, v]) => [k, String(v).trim()] as const);
  const text = [...rows.map(([k, v]) => `${k}: ${v}`), ...(present(m.body) ? ["", String(m.body).trim()] : []), "", "— Tinash website"].join("\n");
  const html =
    `<div style="font-family:Arial,sans-serif;color:#1c0f36;max-width:560px">` +
    `<p style="font-size:18px;font-weight:700;margin:0 0 4px"><span style="color:#29beb9">Tinash</span> <span style="color:#583092">Homecare Services</span></p>` +
    `<p style="font-weight:700;font-size:16px;margin:12px 0">${esc(m.subject)}</p>` +
    `<table style="border-collapse:collapse;font-size:14px">` +
    rows.map(([k, v]) => `<tr><td style="padding:4px 14px 4px 0;color:#583092;font-weight:600;vertical-align:top">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join("") +
    `</table>` +
    (present(m.body) ? `<p style="white-space:pre-wrap;font-size:14px;margin:16px 0 0;padding:12px;background:#f1f5f8;border-radius:8px">${esc(String(m.body).trim())}</p>` : "") +
    `<p style="font-size:12px;color:#7550b0;margin:16px 0 0">Reply to this email to answer the person directly. Manage it at crm.tinashhomecareservices.com.</p></div>`;
  return { text, html };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let table: Table, id: string;
  try {
    const b = await req.json();
    table = b.table;
    id = b.id;
  } catch {
    return new Response("bad json", { status: 400 });
  }
  if (!TABLES.includes(table) || !/^[0-9a-f-]{36}$/i.test(id ?? "")) return new Response("ignored", { status: 400 });

  // Fresh records only, so replaying old ids does nothing.
  const { data: row } = await db.from(table).select("created_at").eq("id", id).maybeSingle();
  if (!row || Date.now() - new Date(row.created_at).getTime() > FRESH_MS) return new Response("ignored", { status: 200 });

  const mail = await build(table, id);
  if (!mail) return new Response("skipped", { status: 200 });

  // Exactly once: the first caller to claim the record sends it.
  const { error: claimErr } = await db.from("notification_log").insert({ table_name: table, record_id: id });
  if (claimErr) return new Response("already sent", { status: 200 });

  const to = (Deno.env.get("NOTIFY_TO") || "phane@tinashhomecareservices.com").split(",").map((s) => s.trim()).filter(Boolean);
  const user = Deno.env.get("SMTP_USER")!;
  const { text, html } = render(mail);
  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get("SMTP_HOST") || "smtp.hostinger.com",
      port: Number(Deno.env.get("SMTP_PORT") || 465),
      tls: true,
      auth: { username: user, password: Deno.env.get("SMTP_PASS")! },
    },
  });
  try {
    await client.send({
      from: `Tinash Website <${user}>`,
      to,
      replyTo: mail.replyTo || undefined,
      subject: latin1(mail.subject),
      content: latin1(text),
      html: latin1(html),
    });
    await client.close();
  } catch (e) {
    // Release the claim so a retry can send it.
    await db.from("notification_log").delete().eq("table_name", table).eq("record_id", id);
    const msg = (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").slice(0, 300);
    console.error("notify-office send failed:", msg);
    // The reason is recorded in net._http_response for diagnosis (no secrets in it).
    return new Response(`send failed: ${msg}`, { status: 502 });
  }
  return new Response("sent", { status: 200 });
});
