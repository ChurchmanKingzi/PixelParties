// Standalone SMTP diagnostic. Loads .env the same way server.js does,
// then sends one test email and prints the full error on failure.
//   node scripts/mail-test.js [recipient]
const fs = require('fs');
const path = require('path');

(function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
})();

const { sendMail, isConfigured } = require('../mailer');

const to = process.argv[2] || process.env.SMTP_USER;
console.log('host=%s port=%s user=%s from=%s configured=%s',
  process.env.SMTP_HOST, process.env.SMTP_PORT, process.env.SMTP_USER, process.env.SMTP_FROM, isConfigured());
console.log('Sending test email to:', to);

sendMail({ to, subject: 'Pixel Parties SMTP test', text: 'If you can read this, SMTP works.' })
  .then(r => { console.log('OK:', r); process.exit(0); })
  .catch(e => { console.error('FAILED:', e && e.stack || e); process.exit(1); });
