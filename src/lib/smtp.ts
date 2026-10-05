import 'server-only';

/**
 * Minimal SMTP client for Cloudflare Workers (implicit TLS, AUTH PLAIN).
 *
 * Uses Workers TCP sockets. `cloudflare:sockets` is imported at runtime with a
 * computed specifier so neither webpack nor esbuild tries to resolve it at
 * build time; workerd provides it. Only call this on Cloudflare.
 */

type Mail = {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  to: string[];
  replyTo?: string | null;
  subject: string;
  text: string;
  html: string;
};

type Socket = {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  close(): Promise<void>;
};

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (s: string) => btoa(String.fromCharCode(...enc.encode(s)));
// RFC 2047 encoded-word, so names/subjects with any characters are safe.
const header = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

export async function sendSmtp(m: Mail): Promise<void> {
  // Depends on a runtime value so no bundler/minifier can fold it into a
  // literal (which webpack and esbuild would then try to resolve and fail).
  const mod = (globalThis as { __TINASH_SOCKETS__?: string }).__TINASH_SOCKETS__ ?? 'cloudflare:sockets';
  const { connect } = (await import(/* webpackIgnore: true */ mod)) as {
    connect: (a: { hostname: string; port: number }, o: { secureTransport: 'on' }) => Socket;
  };
  const socket = connect({ hostname: m.host, port: m.port }, { secureTransport: 'on' });
  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  let buf = '';

  // Reads one (possibly multi-line) SMTP reply and checks its status code.
  async function reply(expect: number): Promise<string> {
    for (;;) {
      const lines = buf.split('\r\n');
      const done = lines.findIndex((l) => /^\d{3} /.test(l));
      if (done >= 0) {
        const msg = lines.slice(0, done + 1).join('\n');
        buf = lines.slice(done + 1).join('\r\n');
        const code = Number(msg.slice(msg.lastIndexOf('\n') + 1, msg.lastIndexOf('\n') + 4));
        if (code !== expect) throw new Error(`SMTP expected ${expect}, got: ${msg.slice(0, 200)}`);
        return msg;
      }
      const { value, done: eof } = await reader.read();
      if (eof) throw new Error('SMTP connection closed');
      buf += dec.decode(value);
    }
  }
  const send = (line: string) => writer.write(enc.encode(line + '\r\n'));

  try {
    await reply(220);
    await send(`EHLO tinashhomecareservices.com`);
    await reply(250);
    await send(`AUTH PLAIN ${b64(`\0${m.user}\0${m.pass}`)}`);
    await reply(235);
    await send(`MAIL FROM:<${m.user}>`);
    await reply(250);
    for (const r of m.to) {
      await send(`RCPT TO:<${r}>`);
      await reply(250);
    }
    await send('DATA');
    await reply(354);

    const boundary = `b${crypto.randomUUID().replace(/-/g, '')}`;
    const dotSafe = (s: string) => s.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
    const msg = [
      `From: ${header(clean(m.fromName))} <${m.user}>`,
      `To: ${m.to.join(', ')}`,
      ...(m.replyTo ? [`Reply-To: <${clean(m.replyTo)}>`] : []),
      `Subject: ${header(clean(m.subject))}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@tinashhomecareservices.com>`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      ...(b64(m.text).match(/.{1,76}/g) ?? []),
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      ...(b64(m.html).match(/.{1,76}/g) ?? []),
      `--${boundary}--`,
    ].join('\r\n');
    await writer.write(enc.encode(dotSafe(msg) + '\r\n.\r\n'));
    await reply(250);
    await send('QUIT');
  } finally {
    try {
      await socket.close();
    } catch {
      /* already closed */
    }
  }
}
