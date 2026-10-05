import 'server-only';
import { sendSmtp } from '@/lib/smtp';

/**
 * Office notification email for every website submission (inquiries, chat
 * leads, consultation bookings, job/general applications, newsletter).
 *
 * Sends through the Hostinger mailbox over SMTP using Cloudflare Workers TCP
 * sockets (src/lib/smtp.ts; free, no third-party email service). Configure on the worker:
 *   SMTP_USER   mailbox address, e.g. dev@tinashhomecareservices.com  (secret or var)
 *   SMTP_PASS   that mailbox's password                               (secret)
 *   NOTIFY_TO   comma-separated recipients (default phane@tinashhomecareservices.com)
 * Optional: SMTP_HOST (smtp.hostinger.com), SMTP_PORT (465), NOTIFY_FROM_NAME.
 * If SMTP is not configured but RESEND_API_KEY is, Resend is used instead.
 * Otherwise (and always in local `next dev`) the message is only logged.
 *
 * Never put health information in these emails; the public forms ask people
 * not to send any, and this only relays what they typed.
 */

export type Notification = {
  subject: string;
  /** Label/value pairs rendered one per line. Empty values are skipped. */
  fields: [string, string | null | undefined][];
  /** Longer free text (the visitor's message), shown after the fields. */
  body?: string | null;
  replyTo?: string | null;
};

const DEFAULT_TO = 'phane@tinashhomecareservices.com';

function recipients(): string[] {
  return (process.env.NOTIFY_TO || DEFAULT_TO)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
}

function render(n: Notification) {
  const lines = n.fields.filter(([, v]) => v && String(v).trim()).map(([k, v]) => `${k}: ${String(v).trim()}`);
  const text = [...lines, ...(n.body?.trim() ? ['', n.body.trim()] : []), '', '— Tinash website (manage it in the CRM)'].join('\n');
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const html =
    `<div style="font-family:Arial,sans-serif;color:#1c0f36;max-width:560px">` +
    `<p style="font-weight:700;font-size:16px;margin:0 0 12px">${esc(n.subject)}</p>` +
    `<table style="border-collapse:collapse;font-size:14px">` +
    n.fields
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#583092;font-weight:600;vertical-align:top">${esc(k)}</td><td style="padding:4px 0">${esc(String(v).trim())}</td></tr>`)
      .join('') +
    `</table>` +
    (n.body?.trim() ? `<p style="white-space:pre-wrap;font-size:14px;margin:16px 0 0;padding:12px;background:#f1f5f8;border-radius:8px">${esc(n.body.trim())}</p>` : '') +
    `<p style="font-size:12px;color:#7550b0;margin:16px 0 0">Tinash website · manage it in the CRM</p></div>`;
  return { text, html };
}

const onWorkers = () => typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';

/** Sends the notification. Never throws: a failed email must not fail the form. */
export async function notifyOffice(n: Notification): Promise<'sent' | 'logged' | 'failed'> {
  const to = recipients();
  const { text, html } = render(n);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  try {
    if (user && pass && onWorkers()) {
      await sendSmtp({
        host: process.env.SMTP_HOST || 'smtp.hostinger.com',
        port: Number(process.env.SMTP_PORT || 465),
        user,
        pass,
        fromName: process.env.NOTIFY_FROM_NAME || 'Tinash Website',
        to,
        replyTo: n.replyTo,
        subject: n.subject,
        text,
        html,
      });
      return 'sent';
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.INQUIRY_FROM ?? 'Tinash Website <onboarding@resend.dev>',
          to,
          reply_to: n.replyTo || undefined,
          subject: n.subject,
          text,
          html,
        }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}`);
      return 'sent';
    }
  } catch (e) {
    console.error('notifyOffice failed:', e instanceof Error ? e.message : e);
    return 'failed';
  }

  console.log('NOTIFY (email not configured)', { to, subject: n.subject, text });
  return 'logged';
}
