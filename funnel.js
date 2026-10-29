'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SPIELER-TRICHTER (Funnel): wie viele kommen, spielen, lernen, melden sich an?
//
//  Zaehlt NUR Ereignisse, keine Personen: ein Besucher ist eine zufaellige ID aus dem localStorage des Browsers
//  (`pp_vid`, kein Name, keine IP, keine E-Mail). Gespeichert wird in drei Tabellen derselben Datenbank:
//    funnel_events    Zeit, Akteur (Besucher-ID oder 'u:<Konto-ID>'), Ereignis, Nummer (Tutorial-Mission), Gast-Flag, Meta
//    funnel_visitors  Erstkontakt je Besucher: utm_source/medium/campaign/content, Referrer-Host, Geraet
//    funnel_users     Konto-ID -> Besucher-ID (damit Socket-Ereignisse ohne Header dem Besucher zugeordnet werden)
//
//  Ereignisse (`ev`):
//    landing            Seite geladen (einmal je Browser-Tab-Sitzung; n=1: Besucher war schon einmal da)
//    guest_start        „Try as Guest"
//    tutorial_start     Tutorial-Mission gestartet (n = Nummer 1..7)
//    tutorial_complete  Tutorial-Mission geschafft (n)
//    cpu_start          CPU-Partie gestartet (g=1: als Gast). Das Tutorial ist KEINE CPU-Partie.
//    cpu_end            CPU-Partie beendet (g, n=1 gewonnen / 0 verloren)
//    signup_submit      Anmeldeformular abgeschickt (Code wurde gemailt)
//    signup_done        Konto angelegt (meta.m: form | guest_modal | google)
//
//  Abfrage: GET /api/funnel/report?from=<ms|ISO>&to=<ms|ISO> mit Header `x-funnel-token` = FUNNEL_TOKEN aus der Umgebung
//  (mind. 24 Zeichen; ohne FUNNEL_TOKEN ist die Route abgeschaltet: 404). Es gibt KEINE Oberflaeche im Spiel —
//  das Auswertewerkzeug liegt in scripts/funnel/ und laeuft beim Betreiber.
//
//  Aufzeichnung ausschalten (eigene Tests): Seite einmal mit ?nostats=1 oeffnen (merkt sich der Browser); ?nostats=0 hebt es auf.
//  Do-Not-Track / Global Privacy Control werden ebenfalls respektiert. Bots (User-Agent) werden nicht gezaehlt.
// ═══════════════════════════════════════════════════════════════════
const crypto = require('crypto');

const BOT_RE = /bot|crawler|spider|crawling|headless|lighthouse|facebookexternalhit|slurp|preview|monitor|curl\/|wget|python-requests|node-fetch|axios|undici/i;
const VID_RE = /^[A-Za-z0-9_-]{16,48}$/;
const RETENTION_MS = 400 * 24 * 3600 * 1000;
const MAX_STR = 80;

function clean(s) { return (typeof s === 'string' ? s : '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, MAX_STR) || null; }
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

/** Besucher-ID aus dem Header: gueltige ID, 'skip' (nicht aufzeichnen) oder null. */
function vidOf(req) {
  const v = req && req.headers ? String(req.headers['x-pp-vid'] || '') : '';
  if (v === 'skip') return 'skip';
  return VID_RE.test(v) ? v : null;
}

async function ensureSchema(db) {
  await db.execute(`CREATE TABLE IF NOT EXISTS funnel_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    actor TEXT NOT NULL,
    vid TEXT,
    user_id TEXT,
    ev TEXT NOT NULL,
    n INTEGER,
    g INTEGER,
    meta TEXT
  )`);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_funnel_ev_ts ON funnel_events(ev, ts)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_funnel_vid ON funnel_events(vid, ev)');
  await db.execute(`CREATE TABLE IF NOT EXISTS funnel_visitors (
    vid TEXT PRIMARY KEY, first_ts INTEGER NOT NULL, src TEXT, med TEXT, camp TEXT, content TEXT, ref TEXT, device TEXT
  )`);
  await db.execute('CREATE TABLE IF NOT EXISTS funnel_users (user_id TEXT PRIMARY KEY, vid TEXT NOT NULL, ts INTEGER NOT NULL)');
  const cutoff = Date.now() - RETENTION_MS;
  await db.run('DELETE FROM funnel_events WHERE ts < ?', [cutoff]);
  await db.run('DELETE FROM funnel_visitors WHERE first_ts < ?', [cutoff]);
}

/**
 * @param {object} o
 * @param {import('express').Express} o.app
 * @param {object} o.db   db.js (get/all/run)
 */
function mount({ app, db }) {
  const userVid = new Map();   // user_id -> vid | 'skip'
  const hitOk = limiter(60, 60 * 1000), reportOk = limiter(30, 60 * 1000);

  async function vidForUser(userId) {
    if (!userId) return null;
    if (userVid.has(userId)) return userVid.get(userId);
    let v = null;
    try { const r = await db.get('SELECT vid FROM funnel_users WHERE user_id = ?', [userId]); v = r ? r.vid : null; } catch { /* Statistik darf nie stoeren */ }
    if (userVid.size > 20000) userVid.clear();
    userVid.set(userId, v); return v;
  }

  /** Konto einem Besucher zuordnen (Gast-Anlage, Login, Registrierung). 'skip' = nichts aufzeichnen. */
  async function mapUser(userId, vid) {
    if (!userId || !vid) return;
    try {
      userVid.set(userId, vid);
      await db.run('INSERT INTO funnel_users (user_id, vid, ts) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET vid = excluded.vid', [userId, vid, Date.now()]);
    } catch (e) { console.error('[funnel] mapUser:', e.message); }
  }

  /** Ereignis eintragen. Wirft nie. */
  async function record(ev, { userId = null, vid = null, n = null, g = null, meta = null } = {}) {
    try {
      let v = vid || (userId ? await vidForUser(userId) : null);
      if (v === 'skip') return;
      if (v && !VID_RE.test(v)) v = null;
      if (!v && !userId) return;
      const actor = v || ('u:' + userId);
      await db.run('INSERT INTO funnel_events (ts, actor, vid, user_id, ev, n, g, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [Date.now(), actor, v, userId, ev, n, g, meta ? JSON.stringify(meta).slice(0, 400) : null]);
    } catch (e) { console.error('[funnel] record:', e.message); }
  }

  // ── Seitenaufruf (Landing) ────────────────────────────────────
  app.post('/api/funnel/hit', async (req, res) => {
    res.status(204).end();
    try {
      const ip = req.ip || '';
      if (!hitOk(ip)) return;
      if (BOT_RE.test(String(req.headers['user-agent'] || ''))) return;
      const b = req.body || {};
      const vid = typeof b.vid === 'string' && VID_RE.test(b.vid) ? b.vid : null;
      if (!vid) return;
      const now = Date.now();
      await db.run('INSERT OR IGNORE INTO funnel_visitors (vid, first_ts, src, med, camp, content, ref, device) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [vid, now, clean(b.src), clean(b.med), clean(b.camp), clean(b.content), clean(b.ref), ['phone', 'desktop', 'tablet'].includes(b.device) ? b.device : null]);
      await record('landing', { vid, n: b.returning ? 1 : 0, meta: { st: b.standalone ? 1 : 0 } });
    } catch (e) { console.error('[funnel] hit:', e.message); }
  });

  // ── Auswertung ────────────────────────────────────────────────
  const enabled = () => (process.env.FUNNEL_TOKEN || '').length >= 24;
  const toMs = (v, d) => { if (v === undefined || v === '') return d; const n = Number(v); if (Number.isFinite(n) && n > 1e11) return n; const t = Date.parse(String(v)); return Number.isFinite(t) ? t : d; };

  async function report(from, to) {
    const one = async (sql, args) => { const r = await db.get(sql, args); return r ? Object.values(r)[0] || 0 : 0; };
    const rng = [from, to];
    const uniq = (ev, extra = '', args = []) => one(`SELECT COUNT(DISTINCT actor) FROM funnel_events WHERE ev = ? AND ts BETWEEN ? AND ? ${extra}`, [ev, ...rng, ...args]);
    const cohort = (ev, extra = '', args = []) => one(`SELECT COUNT(DISTINCT e.vid) FROM funnel_events e WHERE e.ev = ? AND e.ts >= ? ${extra}
      AND e.vid IN (SELECT vid FROM funnel_events WHERE ev = 'landing' AND ts BETWEEN ? AND ?)`, [ev, from, ...args, ...rng]);
    const step = async (key, label, ev, extra = '', args = []) => ({ key, label, all: await uniq(ev, extra, args), cohort: await cohort(ev, extra, args), events: await one(`SELECT COUNT(*) FROM funnel_events WHERE ev = ? AND ts BETWEEN ? AND ? ${extra}`, [ev, ...rng, ...args]) });

    const steps = [];
    steps.push(await step('landing', 'Landing Page besucht', 'landing'));
    steps.push(await step('guest', 'Try as Guest geklickt', 'guest_start'));
    steps.push(await step('tutorial_start', 'Tutorial gestartet (irgendeine Mission)', 'tutorial_start'));
    const tutorial = [];
    for (let k = 1; k <= 7; k++) {
      tutorial.push({ n: k, started: await uniq('tutorial_start', 'AND n = ?', [k]), startedCohort: await cohort('tutorial_start', 'AND e.n = ?', [k]),
        completed: await uniq('tutorial_complete', 'AND n = ?', [k]), completedCohort: await cohort('tutorial_complete', 'AND e.n = ?', [k]) });
    }
    steps.push(await step('cpu_guest', 'Gast: CPU-Partie gestartet (kein Tutorial)', 'cpu_start', 'AND g = 1'));
    steps.push(await step('cpu_guest_done', 'Gast: CPU-Partie beendet', 'cpu_end', 'AND g = 1'));
    steps.push(await step('signup_submit', 'Anmeldeformular abgeschickt', 'signup_submit'));
    steps.push(await step('signup_done', 'Konto angelegt', 'signup_done'));

    // Konto-Anlagen: kamen sie ueber den Gastmodus?
    const su = await db.all(`SELECT e.actor, e.vid, e.meta, e.ts,
        CASE WHEN e.vid IS NULL THEN 0 ELSE EXISTS(SELECT 1 FROM funnel_events x WHERE x.vid = e.vid AND x.ev = 'guest_start' AND x.ts <= e.ts) END AS was_guest,
        CASE WHEN e.vid IS NULL THEN 0 ELSE EXISTS(SELECT 1 FROM funnel_events x WHERE x.vid = e.vid AND x.ev = 'cpu_start' AND x.g = 1 AND x.ts <= e.ts) END AS guest_played,
        CASE WHEN e.vid IS NULL THEN 0 ELSE EXISTS(SELECT 1 FROM funnel_events x WHERE x.vid = e.vid AND x.ev = 'tutorial_start' AND x.ts <= e.ts) END AS did_tutorial
      FROM funnel_events e WHERE e.ev = 'signup_done' AND e.ts BETWEEN ? AND ?`, rng);
    const signups = { total: su.length, unattributed: 0, viaGuestPlayed: 0, viaGuestNoGame: 0, direct: 0, withTutorial: 0, byMethod: {} };
    for (const r of su) {
      let m = 'unknown'; try { m = (JSON.parse(r.meta || '{}').m) || 'unknown'; } catch { /* leer */ }
      signups.byMethod[m] = (signups.byMethod[m] || 0) + 1;
      if (!r.vid) { signups.unattributed++; continue; }
      if (r.guest_played) signups.viaGuestPlayed++; else if (r.was_guest) signups.viaGuestNoGame++; else signups.direct++;
      if (r.did_tutorial) signups.withTutorial++;
    }

    // Aufschluesselung nach Quelle (Erstkontakt des Besuchers)
    const bySource = {};
    for (const [key, ev, extra] of [['landing', 'landing', ''], ['guest', 'guest_start', ''], ['tutorial_start', 'tutorial_start', ''], ['cpu_guest', 'cpu_start', 'AND e.g = 1'], ['signup_done', 'signup_done', '']]) {
      const rows = await db.all(`SELECT COALESCE(v.src, '(keine)') AS s, COUNT(DISTINCT e.vid) AS c FROM funnel_events e LEFT JOIN funnel_visitors v ON v.vid = e.vid
        WHERE e.ev = ? AND e.ts BETWEEN ? AND ? AND e.vid IS NOT NULL ${extra} GROUP BY s`, [ev, ...rng]);
      for (const r of rows) (bySource[r.s] = bySource[r.s] || {})[key] = r.c;
    }
    const devices = await db.all('SELECT COALESCE(device, \'?\') AS d, COUNT(*) AS c FROM funnel_visitors WHERE first_ts BETWEEN ? AND ? GROUP BY d', rng);
    const referrers = await db.all('SELECT COALESCE(ref, \'(direkt)\') AS r, COUNT(*) AS c FROM funnel_visitors WHERE first_ts BETWEEN ? AND ? GROUP BY r ORDER BY c DESC LIMIT 15', rng);
    const daily = await db.all(`SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch') AS day, ev, COUNT(DISTINCT actor) AS c FROM funnel_events
      WHERE ts BETWEEN ? AND ? AND ev IN ('landing', 'guest_start', 'tutorial_start', 'signup_done') GROUP BY day, ev ORDER BY day`, rng);
    const newVsReturning = await db.all(`SELECT n, COUNT(DISTINCT actor) AS c FROM funnel_events WHERE ev = 'landing' AND ts BETWEEN ? AND ? GROUP BY n`, rng);
    const cpuEnd = await db.get(`SELECT COUNT(*) AS games, SUM(CASE WHEN n = 1 THEN 1 ELSE 0 END) AS wins FROM funnel_events WHERE ev = 'cpu_end' AND g = 1 AND ts BETWEEN ? AND ?`, rng);
    return { generated: Date.now(), from, to, steps, tutorial, signups, bySource, devices, referrers, daily,
      newVsReturning: { new: (newVsReturning.find(r => r.n === 0) || {}).c || 0, returning: (newVsReturning.find(r => r.n === 1) || {}).c || 0 },
      guestGames: { games: cpuEnd ? cpuEnd.games : 0, wins: cpuEnd ? cpuEnd.wins || 0 : 0 },
      notes: 'all = eindeutige Akteure im Zeitraum (Besucher-ID, sonst Konto); cohort = davon Besucher, die im Zeitraum auch die Landing Page besucht haben (nur mit Besucher-ID).' };
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

  return { record, mapUser, vidOf };
}

module.exports = { ensureSchema, mount, vidOf, VID_RE };
