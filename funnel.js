'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SPIELER-TRICHTER (Funnel): wie viele kommen, spielen, lernen, melden sich an?
//
//  DATENSPARSAM: Es gibt KEINE Besucher-, Sitzungs- oder Konto-IDs in der Statistik und keine Einzelereignisse. Gespeichert werden
//  nur ZAEHLER je Tag:  funnel_counts(day, ev, n, src, dev, cnt)
//    day  Tag (UTC)                          ev   Ereignis (Liste unten)       n    Tutorial-Mission 1..7 (sonst 0)
//    src  grobe Quelle: utm_source oder Referrer-Host, sonst '(direkt)'         dev  phone | tablet | desktop
//  Keine Zeitstempel unter Tagesgenauigkeit, keine IP, keine E-Mail, kein Name, nichts, was einen Menschen wiedererkennt.
//  Der Browser merkt sich nichts Eindeutiges: `src`/`dev` stehen nur in sessionStorage (Tab-Sitzung) und gehen als Header
//  `x-pp-src` / `x-pp-dev` mit — Kategorien, die sich Tausende teilen. Der Server haelt fuer die Dauer einer Sitzung im Arbeits-
//  speicher (nie in der Datenbank), welche Zaehler fuer diese Sitzung schon gezaehlt sind (damit z. B. ein Gast nicht mehrfach als
//  „spielt eine Partie" zaehlt) und welche Quelle er hat; das verschwindet mit dem Serverneustart.
//
//  Ereignisse (`ev`):
//    landing              Seite geladen (einmal je Browser-Tab-Sitzung)
//    guest_start          „Try as Guest"
//    tutorial_start       Tutorial-Mission gestartet (n), je Sitzung und Mission einmal
//    tutorial_complete    Tutorial-Mission erstmals geschafft (n) — je Konto die erste Loesung
//    cpu_guest_start      Gast startet eine CPU-Partie (kein Tutorial), je Gast-Sitzung einmal
//    cpu_guest_end        Gast-Partie beendet;  cpu_guest_win  davon gewonnen   (jede Partie zaehlt)
//    signup_submit        Anmeldeformular abgeschickt (Mailcode verschickt)
//    signup_done          Konto angelegt;  signup_m_form | signup_m_guest_modal | signup_m_google  = Weg;
//                         signup_via_guest_played (der Gast hatte CPU-Partien gespielt) | signup_via_guest_only (Gast, nichts gespielt)
//                         | signup_direct (nicht aus einer Gast-Sitzung)
//  Grenze: Wer als Gast spielt, die Seite schliesst und spaeter ein Konto anlegt, zaehlt als „direkt" — ohne Wiedererkennung
//  laesst sich das nicht verbinden. Ebenso gibt es keine eindeutigen Besucher: Zaehler sind Seitenaufrufe, Sitzungen bzw. Konten.
//
//  Abfrage: GET /api/funnel/report?from=<ms|ISO>&to=<ms|ISO> mit Header `x-funnel-token` = FUNNEL_TOKEN aus der Umgebung
//  (mind. 24 Zeichen; ohne FUNNEL_TOKEN ist die Route abgeschaltet: 404). Das Auswertewerkzeug liegt in scripts/funnel/.
//  Aus: Seite einmal mit ?nostats=1 oeffnen (merkt sich der Browser; ?nostats=0 hebt es auf); Do-Not-Track und Global Privacy
//  Control werden respektiert; Bots (User-Agent) zaehlen nicht.
// ═══════════════════════════════════════════════════════════════════
const crypto = require('crypto');

const BOT_RE = /bot|crawler|spider|crawling|headless|lighthouse|facebookexternalhit|slurp|preview|monitor|curl\/|wget|python-requests|node-fetch|axios|undici/i;
const DEVICES = new Set(['phone', 'tablet', 'desktop']);
const MAX_SOURCES = 60;          // so viele verschiedene Quellen-Etiketten insgesamt; weitere zaehlen als 'sonstige'
const EVENTS = new Set(['landing', 'guest_start', 'tutorial_start', 'tutorial_complete', 'cpu_guest_start', 'cpu_guest_end', 'cpu_guest_win',
  'signup_submit', 'signup_done', 'signup_m_form', 'signup_m_guest_modal', 'signup_m_google', 'signup_via_guest_played', 'signup_via_guest_only', 'signup_direct']);

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function limiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now(); const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
    arr.push(now); hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
    return arr.length <= max;
  };
}
/** Quelle sauber auf ein kurzes Etikett bringen: Kleinbuchstaben, a-z 0-9 . _ - */
function cleanSrc(s) { const t = String(s || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24); return t || '(direkt)'; }
function cleanDev(s) { s = String(s || ''); return DEVICES.has(s) ? s : ''; }
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

async function ensureSchema(db) {
  // Alte Stande dieses Moduls speicherten Besucher-IDs und Einzelereignisse: weg damit.
  await db.execute('DROP TABLE IF EXISTS funnel_events');
  await db.execute('DROP TABLE IF EXISTS funnel_visitors');
  await db.execute('DROP TABLE IF EXISTS funnel_users');
  await db.execute(`CREATE TABLE IF NOT EXISTS funnel_counts (
    day TEXT NOT NULL, ev TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, src TEXT NOT NULL DEFAULT '(direkt)', dev TEXT NOT NULL DEFAULT '',
    cnt INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, ev, n, src, dev)
  )`);
  await db.run('DELETE FROM funnel_counts WHERE day < ?', [dayOf(Date.now() - 800 * 86400000)]);
}

/** Kopfzeilen-Auswertung: hat der Browser die Aufzeichnung abgeschaltet? */
const optedOut = (req) => !!(req && req.headers && req.headers['x-pp-off'] === '1');

function mount({ app, db }) {
  const state = new Map();   // userId -> { src, dev, off, seen:Set } — nur Arbeitsspeicher, nur fuer die Sitzung
  const hitOk = limiter(60, 60 * 1000), reportOk = limiter(30, 60 * 1000);
  const knownSrc = new Set();

  async function srcLabel(raw) {
    const s = cleanSrc(raw);
    if (s === '(direkt)' || knownSrc.has(s)) return s;
    if (knownSrc.size === 0) { try { (await db.all('SELECT DISTINCT src FROM funnel_counts')).forEach(r => knownSrc.add(r.src)); } catch { /* leer */ } if (knownSrc.has(s)) return s; }
    if (knownSrc.size >= MAX_SOURCES) return 'sonstige';
    knownSrc.add(s); return s;
  }

  /** Sitzung eines Kontos merken: Quelle/Geraet aus den Headern; `off` = Aufzeichnung abgeschaltet. */
  function remember(userId, req) {
    if (!userId || !req) return;
    if (state.size > 20000) state.clear();
    const cur = state.get(userId) || { src: '(direkt)', dev: '', off: false, seen: new Set() };
    if (optedOut(req)) cur.off = true;
    if (req.headers['x-pp-src']) cur.src = cleanSrc(req.headers['x-pp-src']);
    if (req.headers['x-pp-dev']) cur.dev = cleanDev(req.headers['x-pp-dev']);
    state.set(userId, cur);
  }
  const forget = (userId) => { state.delete(userId); };

  /** Zaehler um 1 erhoehen. `once`: je Sitzung (Konto) nur einmal. Wirft nie. */
  async function record(ev, { userId = null, req = null, n = 0, once = false } = {}) {
    try {
      if (!EVENTS.has(ev)) return;
      let ctx = userId ? state.get(userId) : null;
      if (userId && !ctx) { if (state.size > 20000) state.clear(); ctx = { src: '(direkt)', dev: '', off: false, seen: new Set() }; state.set(userId, ctx); }
      if ((ctx && ctx.off) || (req && optedOut(req))) return;
      if (once) { const k = ev + ':' + n; if (ctx.seen.has(k)) return; ctx.seen.add(k); }
      let src = ctx ? ctx.src : (req && req.headers['x-pp-src'] ? cleanSrc(req.headers['x-pp-src']) : '(direkt)');
      const dev = ctx ? ctx.dev : (req ? cleanDev(req.headers['x-pp-dev']) : '');
      src = await srcLabel(src);
      await db.run(`INSERT INTO funnel_counts (day, ev, n, src, dev, cnt) VALUES (?, ?, ?, ?, ?, 1)
        ON CONFLICT(day, ev, n, src, dev) DO UPDATE SET cnt = cnt + 1`, [dayOf(Date.now()), ev, Number(n) || 0, src, dev]);
    } catch (e) { console.error('[funnel] record:', e.message); }
  }

  // ── Seitenaufruf (Landing): nur Etiketten, keine ID ─────────────
  app.post('/api/funnel/hit', async (req, res) => {
    res.status(204).end();
    try {
      if (!hitOk(req.ip || '')) return;
      if (BOT_RE.test(String(req.headers['user-agent'] || ''))) return;
      const b = req.body || {};
      const fake = { headers: { 'x-pp-src': b.src || b.ref || '', 'x-pp-dev': b.device || '' } };
      await record('landing', { req: fake });
    } catch (e) { console.error('[funnel] hit:', e.message); }
  });

  // ── Auswertung ────────────────────────────────────────────────
  const enabled = () => (process.env.FUNNEL_TOKEN || '').length >= 24;
  const toMs = (v, d) => { if (v === undefined || v === '') return d; const n = Number(v); if (Number.isFinite(n) && n > 1e11) return n; const t = Date.parse(String(v)); return Number.isFinite(t) ? t : d; };

  async function report(from, to) {
    const d0 = dayOf(from), d1 = dayOf(to), rng = [d0, d1];
    const sum = async (ev, extra = '', args = []) => { const r = await db.get(`SELECT COALESCE(SUM(cnt), 0) AS c FROM funnel_counts WHERE ev = ? AND day BETWEEN ? AND ? ${extra}`, [ev, ...rng, ...args]); return r ? Number(r.c) : 0; };
    const steps = [];
    for (const [key, label, ev] of [['landing', 'Landing Page aufgerufen', 'landing'], ['guest', 'Try as Guest geklickt', 'guest_start'], ['tutorial_start', 'Tutorial gestartet (Missionen, je Sitzung einmal)', 'tutorial_start'],
      ['cpu_guest', 'Gast: CPU-Partie gestartet (kein Tutorial, je Gast einmal)', 'cpu_guest_start'], ['signup_submit', 'Anmeldeformular abgeschickt', 'signup_submit'], ['signup_done', 'Konto angelegt', 'signup_done']])
      steps.push({ key, label, count: await sum(ev) });
    const tutorial = [];
    for (let k = 1; k <= 7; k++) tutorial.push({ n: k, started: await sum('tutorial_start', 'AND n = ?', [k]), completed: await sum('tutorial_complete', 'AND n = ?', [k]) });
    const viaGuestPlayed = await sum('signup_via_guest_played'), viaGuestOnly = await sum('signup_via_guest_only'), direct = await sum('signup_direct');
    const signups = { total: await sum('signup_done'), viaGuestPlayed, viaGuestOnly, direct,
      byMethod: { form: await sum('signup_m_form'), guest_modal: await sum('signup_m_guest_modal'), google: await sum('signup_m_google') } };
    const bySource = {};
    for (const [key, ev] of [['landing', 'landing'], ['guest', 'guest_start'], ['tutorial_start', 'tutorial_start'], ['cpu_guest', 'cpu_guest_start'], ['signup_done', 'signup_done']]) {
      for (const r of await db.all('SELECT src AS s, SUM(cnt) AS c FROM funnel_counts WHERE ev = ? AND day BETWEEN ? AND ? GROUP BY src', [ev, ...rng])) (bySource[r.s] = bySource[r.s] || {})[key] = Number(r.c);
    }
    const devices = (await db.all("SELECT CASE WHEN dev = '' THEN '?' ELSE dev END AS d, SUM(cnt) AS c FROM funnel_counts WHERE ev = 'landing' AND day BETWEEN ? AND ? GROUP BY d", rng)).map(r => ({ d: r.d, c: Number(r.c) }));
    const daily = (await db.all(`SELECT day, ev, SUM(cnt) AS c FROM funnel_counts WHERE day BETWEEN ? AND ? AND ev IN ('landing', 'guest_start', 'tutorial_start', 'signup_done') GROUP BY day, ev ORDER BY day`, rng)).map(r => ({ day: r.day, ev: r.ev, c: Number(r.c) }));
    return { generated: Date.now(), from, to, steps, tutorial, signups, bySource, devices, daily,
      guestGames: { games: await sum('cpu_guest_end'), wins: await sum('cpu_guest_win') },
      notes: 'Zaehler, keine Personen: Landing = Seitenaufrufe (einmal je Tab-Sitzung); Gast/Tutorial/Gast-Partie je Sitzung bzw. Konto einmal; Mission geschafft = erste Loesung je Konto.' };
  }

  app.get('/api/funnel/report', async (req, res) => {
    if (!enabled()) return res.status(404).end();
    if (!reportOk(req.ip || '')) return res.status(429).json({ error: 'Too many requests' });
    if (!safeEqual(req.headers['x-funnel-token'] || '', process.env.FUNNEL_TOKEN)) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const to = toMs(req.query.to, Date.now()), from = toMs(req.query.from, to - 7 * 24 * 3600 * 1000);
      res.setHeader('Cache-Control', 'no-store');
      res.json(await report(from, to));
    } catch (e) { console.error('[funnel] report:', e.message); res.status(500).json({ error: 'Report failed' }); }
  });

  return { record, remember, forget, optedOut };
}

module.exports = { ensureSchema, mount, optedOut };
