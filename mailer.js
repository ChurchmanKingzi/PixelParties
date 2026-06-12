// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — MAILER
//  Minimal, dependency-free SMTP-over-TLS sender. (The npm registry
//  is TLS-blocked on the build machine, so we don't pull nodemailer.)
//
//  Configure via env (e.g. a .env file, which server.js loads):
//    SMTP_HOST   e.g. smtp.gmail.com
//    SMTP_PORT   465 (implicit TLS, recommended) or 587 (STARTTLS)
//    SMTP_USER   full login, e.g. you@gmail.com
//    SMTP_PASS   app password (Gmail: create one at myaccount.google.com)
//    SMTP_FROM   optional, e.g. "Pixel Parties <you@gmail.com>"
//    SMTP_SECURE optional "true"/"false"; inferred from port otherwise
//
//  When SMTP is not configured, sendMail() falls back to printing the
//  message (and any code in it) to the server console, so the whole
//  verification / reset flow is fully testable in dev without a
//  provider. Swap in real creds before launch — no code change needed.
// ════════════════════════════════════════════════════════════════
const tls = require('tls');
const net = require('net');
const os = require('os');
const crypto = require('crypto');

function config() {
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  return {
    host: process.env.SMTP_HOST || '',
    port,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@pixelparties',
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === 'true'
      : port === 465,
    // Local-dev escape hatch: when a TLS-intercepting antivirus/proxy
    // (e.g. Avast Mail Shield) re-signs the SMTP connection with an
    // untrusted root, Node rejects the cert. Set SMTP_TLS_INSECURE=true
    // to skip cert verification. ONLY use on a trusted local machine —
    // it disables protection against a real man-in-the-middle. Never set
    // this on a public server; fix the antivirus instead.
    insecure: process.env.SMTP_TLS_INSECURE === 'true',
  };
}

function isConfigured() {
  const c = config();
  return !!(c.host && c.user && c.pass);
}

// Pull the bare address out of a "Name <addr@host>" / "addr@host" string.
function addressOf(s) {
  const m = /<([^>]+)>/.exec(s);
  return (m ? m[1] : s).trim();
}

// ── SMTP response reader ────────────────────────────────────────
// A reply is complete when a line matches /^\d{3} / (space after the
// code). /^\d{3}-/ lines are continuations.
function makeReader() {
  let buf = '';
  let waiter = null;
  function tryResolve() {
    if (!waiter) return;
    const lines = buf.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (/^\d{3} /.test(lines[i])) {
        const replyLines = lines.slice(0, i + 1);
        buf = lines.slice(i + 1).join('\n');
        const code = parseInt(replyLines[replyLines.length - 1].slice(0, 3), 10);
        const w = waiter; waiter = null;
        w.resolve({ code, text: replyLines.join('\n') });
        return;
      }
    }
  }
  return {
    feed(chunk) { buf += chunk; tryResolve(); },
    read() { return new Promise((resolve, reject) => { waiter = { resolve, reject }; tryResolve(); }); },
    fail(err) { if (waiter) { const w = waiter; waiter = null; w.reject(err); } },
  };
}

function send(sock, line) {
  return new Promise((resolve, reject) => {
    sock.write(line + '\r\n', 'utf8', err => (err ? reject(err) : resolve()));
  });
}

async function expect(reader, okCodes, what) {
  const { code, text } = await reader.read();
  const ok = Array.isArray(okCodes) ? okCodes.includes(code) : code === okCodes;
  if (!ok) throw new Error(`SMTP ${what} failed: ${text.trim()}`);
  return { code, text };
}

function buildMessage({ from, to, subject, text, html }) {
  const boundary = 'pp_' + crypto.randomBytes(12).toString('hex');
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomBytes(16).toString('hex')}@pixelparties>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text || '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html || `<pre>${text || ''}</pre>`,
    `--${boundary}--`,
    '',
  ];
  const raw = headers.join('\r\n') + '\r\n\r\n' + parts.join('\r\n');
  // Normalise to CRLF and dot-stuff (lines starting with '.').
  return raw.replace(/\r?\n/g, '\r\n').replace(/\r\n\./g, '\r\n..');
}

async function smtpSend(msg) {
  const c = config();
  const hostname = (os.hostname() || 'localhost').replace(/[^\w.-]/g, '') || 'localhost';

  let sock = c.secure
    ? tls.connect({ host: c.host, port: c.port, servername: c.host, rejectUnauthorized: !c.insecure })
    : net.connect({ host: c.host, port: c.port });
  sock.setEncoding('utf8');
  let reader = makeReader();
  sock.on('data', d => reader.feed(d));
  const fatal = new Promise((_, reject) => {
    sock.on('error', e => { reader.fail(e); reject(e); });
    sock.on('close', () => reader.fail(new Error('SMTP connection closed')));
  });

  const run = (async () => {
    await Promise.race([
      new Promise(res => sock.once(c.secure ? 'secureConnect' : 'connect', res)),
      fatal,
    ]);
    await expect(reader, 220, 'greeting');
    await send(sock, `EHLO ${hostname}`);
    await expect(reader, 250, 'EHLO');

    if (!c.secure) {
      await send(sock, 'STARTTLS');
      await expect(reader, 220, 'STARTTLS');
      // Upgrade the plain socket to TLS and re-attach a fresh reader.
      const upgraded = tls.connect({ socket: sock, host: c.host, servername: c.host, rejectUnauthorized: !c.insecure });
      upgraded.setEncoding('utf8');
      reader = makeReader();
      upgraded.on('data', d => reader.feed(d));
      upgraded.on('error', e => reader.fail(e));
      await new Promise((res, rej) => { upgraded.once('secureConnect', res); upgraded.once('error', rej); });
      sock = upgraded;
      await send(sock, `EHLO ${hostname}`);
      await expect(reader, 250, 'EHLO(TLS)');
    }

    // AUTH LOGIN
    await send(sock, 'AUTH LOGIN');
    await expect(reader, 334, 'AUTH');
    await send(sock, Buffer.from(c.user).toString('base64'));
    await expect(reader, 334, 'AUTH user');
    await send(sock, Buffer.from(c.pass).toString('base64'));
    await expect(reader, 235, 'AUTH pass');

    await send(sock, `MAIL FROM:<${addressOf(c.from)}>`);
    await expect(reader, 250, 'MAIL FROM');
    await send(sock, `RCPT TO:<${addressOf(msg.to)}>`);
    await expect(reader, [250, 251], 'RCPT TO');
    await send(sock, 'DATA');
    await expect(reader, 354, 'DATA');
    await send(sock, buildMessage({ ...msg, from: c.from }) + '\r\n.');
    await expect(reader, 250, 'send');
    await send(sock, 'QUIT').catch(() => {});
    try { sock.end(); } catch {}
  })();

  // 20s overall timeout guard.
  await Promise.race([
    run,
    new Promise((_, rej) => setTimeout(() => rej(new Error('SMTP timeout')), 20000)),
  ]).finally(() => { try { sock.destroy(); } catch {} });
}

/**
 * Send an email. Resolves on success; rejects on hard SMTP failure.
 * In dev (no SMTP configured) it logs to the console and resolves.
 */
async function sendMail({ to, subject, text, html }) {
  if (!isConfigured()) {
    console.log('\n──────── [mailer:dev] email not sent (SMTP not configured) ────────');
    console.log(`  To:      ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log('  ' + (text || '').split('\n').join('\n  '));
    console.log('────────────────────────────────────────────────────────────────\n');
    return { dev: true };
  }
  await smtpSend({ to, subject, text, html });
  return { sent: true };
}

module.exports = { sendMail, isConfigured };
