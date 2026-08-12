'use strict';
// ═══════════════════════════════════════════════════════════════════
// DEMO-RECORDER — Aufzeichnung menschlich pilotierter Spiele (Als
// Auftrag): Al spielt das Deck selbst gegen die CPU und "zeigt", wie
// es zu spielen ist; die Aufzeichnung dokumentiert Play-by-Play mit
// jedem Detail der States. Auswertung danach von Hand/per Analyse —
// und als Stufe 2 perspektivisch die Übersetzung der Demos in die
// bestehenden Profil-Kanäle (gameStartPicks, targetPriors, timing …).
//
// Aktivierung: PP_DEMO_RECORD=1 beim Serverstart; hängt sich im
// Singleplayer (Mensch = Spieler 0 vs CPU) ein. Dateien landen unter
// data/demo-games/demo-<mittlerer-Held>-<zeitstempel>.json
//
// DATEIFORMAT (ein JSON-Objekt je Spiel):
//   meta:   { recordedAt, pilotIdx, usernames, heroes (beide Seiten —
//             identifizieren das Deck), firstPlayer }
//   events: chronologischer Strom aus drei Ereignis-Arten:
//     { k:'state',  turn, ... }  — VOLLER Snapshot zu jedem Zugbeginn
//         je Spieler: gold, hand (exakt, BEIDE Seiten — es ist Als
//         eigener Server), deckSize, discard (Liste), heroes
//         (hp/maxHp/statuses/abilityZones), board (Kreaturen mit
//         hp/countern/faceDown je Slot), equips
//     { k:'log',    turn, type, data } — jedes Engine-Log-Ereignis
//         (Plays, Schaden, Heilung, Bounces, Draws …), beide Seiten
//     { k:'prompt', turn, pi, forPilot, title, ptype, prompt, answer,
//       handBefore } — jede Entscheidungsfrage MIT der Antwort; bei
//         forPilot=true ist das Als dokumentierte Entscheidung samt
//         Optionen/validTargets und exakter Hand davor
//   result: { winnerIdx, pilotWon, reason, turns } + End-Snapshot
//
// MCTS-Simulationen der CPU (engine._inMctsSim) werden überall
// ausgefiltert — aufgezeichnet wird nur das echte Spiel.
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const MAX_ARR = 400;      // Sicherheitskappe für Arrays im Klon
const MAX_STR = 4000;     // Sicherheitskappe für Strings

function safeClone(x) {
  try {
    const seen = new WeakSet();
    return JSON.parse(JSON.stringify(x, function (key, value) {
      if (typeof value === 'function') return undefined;
      if (typeof value === 'string' && value.length > MAX_STR) {
        return value.slice(0, MAX_STR) + '…';
      }
      if (value && typeof value === 'object') {
        if (seen.has(value)) return '[zirkulär]';
        seen.add(value);
        if (Array.isArray(value) && value.length > MAX_ARR) {
          return value.slice(0, MAX_ARR);
        }
      }
      return value;
    }));
  } catch {
    try { return String(x); } catch { return null; }
  }
}


// ═══════════════════════════════════════════════════════════════════
// CPU GEGEN CPU WIRD NIE AUFGEZEICHNET (10.8., Als Vorgabe)
//
// Der Recorder existiert, um MENSCHLICH pilotierte Partien zu
// dokumentieren — Als Entscheidungen samt Optionen und Hand. Eine
// Partie ohne Menschen am Steuer enthält davon nichts, kostet aber
// je Spiel: safeClone auf jedes Log-Ereignis, alle 1,5 s die ganze
// Datei neu als JSON auf die Platte, am Ende gzip + Datenbankzeile.
// Im Headless-Training lief das bis hierher bei JEDEM Spiel mit
// (belegt: 10 031 der 10 046 Zeilen in `demo_games` tragen eine
// `train-…`-roomId).
//
// Die Sperre sitzt bewusst HIER und nicht in server.js: `startGameEngine`
// ist zwar der einzige heutige Aufrufer, aber eine Regel, die nur an der
// Aufrufstelle steht, kann ein künftiger Pfad vergessen. Im Modul kann
// sie niemand umgehen.
//
// Zwei unabhängige Kennzeichen, beide präzise (kein Menschen-Spiel
// trägt sie):
//   • engine._isSelfPlay — gesetzt von ALLEN drei CPU-gegen-CPU-Pfaden
//     (Headless-Training, Self-Play-Batch, cpu_vs_cpu-Zuschauermodus)
//   • process.env.PP_TRAIN — Headless-Sammellauf, hat nie einen Menschen
//
// Ausdrücklich einschaltbar bleibt es mit PP_DEMO_RECORD_CPU=1 — etwa
// um das Verhalten der CPU in einer Partie nachzuvollziehen. Bewusst
// eine EIGENE Variable und nicht PP_DEMO_RECORD, damit ein für den
// Webserver gesetztes Flag nicht versehentlich das Training wieder
// mitschreiben lässt.
// ═══════════════════════════════════════════════════════════════════

/** Läuft diese Partie CPU gegen CPU (Training, Self-Play, Zuschauermodus)? */
function isCpuVsCpuGame(engine) {
  if (engine && engine._isSelfPlay) return true;
  if (process.env.PP_TRAIN) return true;
  return false;
}

/** Darf diese Partie aufgezeichnet werden? */
function demoRecordingAllowed(engine) {
  if (!isCpuVsCpuGame(engine)) return true;
  return process.env.PP_DEMO_RECORD_CPU === '1';
}

// Einmal je Prozess melden, dass nicht aufgezeichnet wird — sonst ist
// "keine Demo-Datei" nicht unterscheidbar von "Recorder kaputt". Je
// Spiel zu melden wäre im Training nur Rauschen.
let _cpuSkipGemeldet = false;

/**
 * Hält den Aufnahme-Ordner beschränkt. **Nur nötig im Live-Betrieb:**
 * seit die Aufnahme standardmäßig läuft, schreibt JEDE Partie eine
 * Datei — auf Dauer wächst der Ordner unbegrenzt, und auf einer
 * kleinen Instanz ist das ein echter Ausfallgrund.
 *
 * `PP_DEMO_MAX_FILES` (Standard 1000) setzt die Obergrenze; 0 schaltet
 * das Aufräumen ab. Gelöscht wird ausschließlich nach dem Muster
 * `demo-*.json` in genau diesem Ordner, älteste zuerst — nie etwas
 * anderes, und nie mehr als nötig.
 */

/**
 * Legt die fertige Aufnahme in der Datenbank ab (lokal SQLite, live
 * Turso — dieselbe Schicht wie für Nutzer und Decks).
 *
 * WARUM ERST AM SPIELENDE und nicht laufend: die Datei wird alle 1,5 s
 * fortgeschrieben, damit ein Einfrieren den Verlauf hinterlässt. Diesen
 * Takt gegen eine REMOTE-Datenbank zu fahren wäre pro Partie ein paar
 * Dutzend Netzrunden — Schreibkontingent und Latenz sprechen dagegen.
 * Die Datei bleibt also der laufende Mitschnitt (auf Render flüchtig,
 * für Forensik reicht das), die Datenbank bekommt EINEN Schreibvorgang
 * mit dem fertigen Spiel.
 *
 * Der Inhalt wird gzip-komprimiert abgelegt (typisch Faktor 8-12 bei
 * diesen JSONs) und liegt als BLOB; die Kopfdaten stehen daneben als
 * eigene Spalten, damit sich später ohne Auspacken filtern lässt
 * ("alle PvP-Partien mit Deck X").
 */
async function _persistToDatabase(doc, meta) {
  let db;
  try { db = require('../../db'); } catch { return false; }
  if (!db?.run) return false;
  try {
    const zlib = require('zlib');
    const payload = zlib.gzipSync(Buffer.from(JSON.stringify(doc), 'utf-8'));
    await db.run(`CREATE TABLE IF NOT EXISTS demo_games (
      id TEXT PRIMARY KEY,
      created_at INTEGER DEFAULT (unixepoch()),
      mode TEXT,
      room_id TEXT,
      players TEXT,
      heroes TEXT,
      winner_idx INTEGER,
      reason TEXT,
      turns INTEGER,
      events INTEGER,
      bytes INTEGER,
      payload BLOB
    )`);
    await db.run(
      `INSERT OR REPLACE INTO demo_games
       (id, mode, room_id, players, heroes, winner_idx, reason, turns, events, bytes, payload)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [meta.id, meta.mode || null, meta.roomId || null,
       JSON.stringify(meta.players || []), JSON.stringify(meta.heroes || []),
       meta.winnerIdx == null ? null : meta.winnerIdx, meta.reason || null,
       meta.turns || 0, meta.events || 0, payload.length, payload],
    );
    console.log(`[demo-recorder] in der Datenbank abgelegt (${(payload.length / 1024).toFixed(0)} KB gepackt, ${meta.turns} Runden)`);
    return true;
  } catch (e) {
    console.error('[demo-recorder] Datenbank-Ablage fehlgeschlagen:', e.message);
    return false;
  }
}

function _pruneOldRecordings(dir) {
  try {
    const max = process.env.PP_DEMO_MAX_FILES == null
      ? 1000 : parseInt(process.env.PP_DEMO_MAX_FILES, 10);
    if (!Number.isFinite(max) || max <= 0) return;
    const entries = fs.readdirSync(dir)
      .filter(f => /^demo-.*\.json$/.test(f))
      .map(f => {
        const full = path.join(dir, f);
        let mtime = 0;
        try { mtime = fs.statSync(full).mtimeMs; } catch { return null; }
        return { full, mtime };
      })
      .filter(Boolean);
    if (entries.length <= max) return;
    entries.sort((a, b) => a.mtime - b.mtime);
    const weg = entries.slice(0, entries.length - max);
    for (const e of weg) { try { fs.unlinkSync(e.full); } catch { } }
    console.log(`[demo-recorder] ${weg.length} alte Aufnahmen entfernt (Grenze ${max})`);
  } catch { /* Aufräumen darf das Spiel nie stören */ }
}

function attachDemoRecorder(engine, opts = {}) {
  if (engine._demoRecorder) return engine._demoRecorder;
  // CPU gegen CPU: nichts anhängen. Kein Ereignisstrom, keine Datei,
  // keine Datenbankzeile, kein Nachzügler-Intervall — und vor allem
  // kein Überschreiben von `engine._crashTrailSink`, den der
  // Trainings-Runner für seine Heap-Sonde vorher gesetzt hat.
  if (!demoRecordingAllowed(engine)) {
    if (!_cpuSkipGemeldet) {
      _cpuSkipGemeldet = true;
      console.log('[demo-recorder] CPU-gegen-CPU-Partien werden nicht aufgezeichnet '
        + '(PP_DEMO_RECORD_CPU=1 erzwingt die Aufnahme).');
    }
    return null;
  }
  const pilotIdx = opts.pilotIdx != null ? opts.pilotIdx : 0;
  const outDir = opts.outDir || path.join(__dirname, '..', '..', 'data', 'demo-games');

  const events = [];
  let finished = false;

  // Ordner SOFORT anlegen — sichtbare Bestätigung, dass die Aufnahme
  // läuft (Als erster Start scheiterte still an der Env-Syntax).
  try { fs.mkdirSync(outDir, { recursive: true }); } catch { }

  // ── LAUFENDES ZWISCHENSPEICHERN (1.8., Als Auftrag) ────────────────
  // Bisher entstand die Datei ERST am Spielende. Hängt oder stürzt die
  // Partie vorher (Als Fall: CPU blieb in Main Phase 1 stehen), ist die
  // gesamte Aufnahme verloren — genau die Spiele, die am
  // interessantesten wären, hinterließen nichts.
  //
  // Der Dateiname steht deshalb ab dem ERSTEN Ereignis fest, und der
  // Strom wird fortgeschrieben. Am Spielende wird dieselbe Datei mit dem
  // vollständigen Dokument überschrieben, damit KEINE Teildatei
  // danebenliegt und Auswerter nicht doppelt zählen. `partial: true`
  // unterscheidet die Zwischenstände; nur fertige Spiele tragen
  // `result`.
  //
  // Der Zeitstempel wird beim Anlegen eingefroren (nicht bei jedem
  // Schreiben neu gebildet), sonst wandert der Name mit.
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const _t0 = Date.now();
  let outFile = null;
  let lastFlushAt = 0;
  let flushPending = false;
  const FLUSH_MIN_MS = 1500;   // nicht öfter als alle 1,5 s auf Platte

  const heroSlug = () => {
    try {
      const mid = engine.gs?.players?.[pilotIdx]?.heroes?.[1]?.name;
      return String(mid || 'pilot').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pilot';
    } catch { return 'pilot'; }
  };

  const filePath = () => {
    if (!outFile) outFile = path.join(outDir, `demo-${heroSlug()}-${ts}.json`);
    return outFile;
  };

  // ── SYNCHRONE HEAP-SONDE AUCH IM MENSCHEN-SPIEL (1.8.) ────────────
  // Dieselbe Mechanik wie im Training (`engine._crashProbe`, gerufen aus
  // runHooks und snapshot()): sie meldet je 100 MB Heap-Zuwachs MIT
  // Auslöser, Zug, Phase und Zählern — und funktioniert auch dann, wenn
  // der Event-Loop blockiert ist, weil sie am Fortschritt der Engine
  // hängt und nicht an der Uhr.
  //
  // Im Training hatte sie einen Sink, in der Live-Partie nicht. Als
  // Einfrieren gegen Steam Dwarf Mines (Beginn Main Phase 1) hinterließ
  // deshalb nur den Ereignisstrom bis dahin, aber keine Speicherspur —
  // obwohl es dasselbe Matchup und dieselbe Phase ist wie beim
  // Trainings-OOM. Der Sink schreibt in DIESELBE Demo-Datei.
  const probes = [];
  engine._crashTrailSink = (rec) => {
    try {
      probes.push({ ms: Date.now() - _t0, ...rec });
      if (probes.length > 60) probes.splice(0, probes.length - 60);
      flush(true);
    } catch { /* Forensik darf nie stören */ }
  };

  const buildDoc = (extra) => {
    const gs = engine.gs || {};
    return {
      meta: {
        recordedAt: new Date().toISOString(),
        pilotIdx,
        usernames: (gs.players || []).map(p => p?.username),
        heroes: (gs.players || []).map(p => (p?.heroes || []).map(h => h?.name)),
        firstPlayer: opts.firstPlayer,
        mode: opts.mode || null,
        roomId: opts.roomId || null,
      },
      events,
      ...(probes.length ? { heapProbes: probes } : {}),
      ...extra,
    };
  };

  // force=true umgeht die Zeitsperre (Spielende, letzter Stand).
  const flush = (force) => {
    if (finished && !force) return;
    const now = Date.now();
    if (!force && now - lastFlushAt < FLUSH_MIN_MS) { flushPending = true; return; }
    lastFlushAt = now; flushPending = false;
    try {
      fs.mkdirSync(outDir, { recursive: true });
      const doc = buildDoc({
        partial: true,
        partialNote: 'Spiel lief bei diesem Schreibvorgang noch — kein Ergebnis vorhanden.',
        turnsSoFar: engine.gs?.turn ?? null,
        phase: engine.gs?.currentPhase ?? null,
        activePlayer: engine.gs?.activePlayer ?? null,
      });
      fs.writeFileSync(filePath(), JSON.stringify(doc, null, 1), { encoding: 'utf-8' });
    } catch { /* Aufnahme darf das Spiel nie stören */ }
  };
  // Falls die Zeitsperre einen Schreibvorgang verschluckt hat, ihn
  // nachholen — sonst fehlt bei einem Einfrieren genau das letzte
  // Ereignis, also das interessanteste.
  const catchUp = setInterval(() => { if (flushPending && !finished) flush(true); }, 2000);
  if (catchUp.unref) catchUp.unref();

  const cardDB = (() => {
    try { return engine._getCardDB ? engine._getCardDB() : {}; } catch { return {}; }
  })();

  const boardOf = (owner) => {
    const out = [];
    for (const inst of (engine.cardInstances || [])) {
      if (inst.owner !== owner) continue;
      if (inst.zone !== 'support' && inst.zone !== 'equip') continue;
      out.push({
        zone: inst.zone,
        heroIdx: inst.heroIdx,
        zoneSlot: inst.zoneSlot,
        name: inst.name,
        hp: inst.hp,
        maxHp: inst.maxHp,
        level: cardDB[inst.name]?.level ?? null,
        counters: safeClone(inst.counters || {}),
        faceDown: !!inst.faceDown,
        summonedTurn: inst.summonedTurn,
      });
    }
    return out;
  };

  const snapshot = () => {
    const gs = engine.gs || {};
    return {
      k: 'state',
      turn: gs.turn,
      activePlayer: gs.activePlayer,
      players: (gs.players || []).map((ps, pi) => ({
        pi,
        username: ps?.username,
        gold: ps?.gold || 0,
        hand: (ps?.hand || []).slice(),
        deckSize: (ps?.mainDeck || []).length,
        discard: (ps?.discardPile || []).slice(),
        heroes: (ps?.heroes || []).map((h, hi) => (h ? {
          hi, name: h.name, hp: h.hp, maxHp: h.maxHp,
          statuses: safeClone(h.statuses || {}),
          abilities: safeClone(ps.abilityZones?.[hi] || []),
        } : null)),
        board: boardOf(pi),
      })),
    };
  };

  // ── Log-Strom + Zugbeginn-Snapshots ──
  const origLog = engine.log.bind(engine);
  engine.log = function (type, data) {
    try {
      if (!engine._inMctsSim && !finished) {
        if (type === 'turn_start') events.push(snapshot());
        events.push({ k: 'log', turn: engine.gs?.turn, type, data: safeClone(data) });
        flush(type === 'turn_start');   // Zugwechsel immer sofort sichern
      }
    } catch { /* Aufzeichnung stört nie das Spiel */ }
    return origLog(type, data);
  };

  // ── Jede Entscheidungsfrage samt Antwort ──
  const origPrompt = engine.promptGeneric.bind(engine);
  engine.promptGeneric = async function (pi, promptData) {
    if (engine._inMctsSim || finished) return origPrompt(pi, promptData);
    const rec = {
      k: 'prompt',
      turn: engine.gs?.turn,
      pi,
      forPilot: pi === pilotIdx,
      title: promptData?.title,
      ptype: promptData?.type,
      prompt: safeClone(promptData),
      handBefore: (engine.gs?.players?.[pilotIdx]?.hand || []).slice(),
    };
    const answer = await origPrompt(pi, promptData);
    try {
      rec.answer = safeClone(answer);
      events.push(rec);
      flush();
    } catch { /* nie stören */ }
    return answer;
  };

  // ── Zweiter Prompt-Trichter: Ziel-Auswahlen (promptEffectTarget) ──
  // Als absichtliche Fehl-Picks (Stun an negative_status_immune,
  // Schaden an submerged) machten sichtbar, dass die menschliche
  // ZIELWAHL nicht über promptGeneric läuft — sie hängt an
  // engine.promptEffectTarget/_pendingPrompt. Aufgezeichnet wird die
  // Frage samt Zielliste MIT Immunitäts-Hinweisen (statuses/buffs je
  // Ziel) und die Antwort — damit ist jeder Fehl-Pick im Play-by-Play
  // selbsterklärend.
  if (typeof engine.promptEffectTarget === 'function') {
    const origEffTarget = engine.promptEffectTarget.bind(engine);
    engine.promptEffectTarget = async function (pi, validTargets, config = {}) {
      if (engine._inMctsSim || finished) return origEffTarget(pi, validTargets, config);
      const stateOf = (t) => {
        try {
          if (t?.type === 'hero') {
            const h = engine.gs?.players?.[t.owner]?.heroes?.[t.heroIdx];
            return h ? { statuses: Object.keys(h.statuses || {}), buffs: Object.keys(h.buffs || {}) } : null;
          }
          const inst = t?.cardInstance;
          return inst ? { counters: Object.keys(inst.counters || {}), buffs: Object.keys(inst.counters?.buffs || {}) } : null;
        } catch { return null; }
      };
      const rec = {
        k: 'prompt', ptype: 'effectTarget',
        turn: engine.gs?.turn, pi, forPilot: pi === pilotIdx,
        title: config?.title,
        validTargets: (validTargets || []).slice(0, 60).map(t => ({
          id: t?.id, type: t?.type, owner: t?.owner,
          cardName: t?.cardName || t?.cardInstance?.name,
          state: stateOf(t),
        })),
      };
      const answer = await origEffTarget(pi, validTargets, config);
      try {
        rec.answer = safeClone(answer);
        events.push(rec);
      flush();
      } catch { /* nie stören */ }
      return answer;
    };
  }

  const finish = (winnerIdx, reason) => {
    if (finished) return null;
    finished = true;
    try { clearInterval(catchUp); } catch { }
    try {
      // DIESELBE Datei überschreiben, die schon die Teilstände trägt —
      // sonst läge neben jedem fertigen Spiel eine verwaiste Teildatei
      // und Auswertungen zählten es doppelt.
      const doc = buildDoc({
        result: {
          winnerIdx, reason,
          pilotWon: winnerIdx === pilotIdx,
          turns: engine.gs?.turn,
          finalState: snapshot(),
        },
      });
      // ── ZU KURZE PARTIEN VERWERFEN (1.8., Als Vorgabe) ────────────
      // Bricht jemand kurz nach dem Start ab, ist die Aufnahme für das
      // Training wertlos — sie soll weder Platz noch ein Schreibkontingent
      // kosten. Schwelle über `PP_DEMO_MIN_TURNS` (Standard 5 Runden),
      // 0 nimmt alles auf.
      const minTurns = process.env.PP_DEMO_MIN_TURNS == null
        ? 5 : parseInt(process.env.PP_DEMO_MIN_TURNS, 10);
      const turns = engine.gs?.turn || 0;
      if (Number.isFinite(minTurns) && minTurns > 0 && turns < minTurns) {
        // Auch die laufend fortgeschriebene Teildatei wieder wegräumen.
        try { if (outFile && fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch { }
        console.log(`[demo-recorder] verworfen — nur ${turns} Runden (Schwelle ${minTurns})`);
        return null;
      }

      fs.mkdirSync(outDir, { recursive: true });
      const file = filePath();
      fs.writeFileSync(file, JSON.stringify(doc, null, 1), { encoding: 'utf-8' });
      console.log(`[demo-recorder] Spiel aufgezeichnet → ${file} (${events.length} Ereignisse, pilotWon=${doc.result.pilotWon})`);
      // Dauerhafte Ablage (lokal SQLite / live Turso) — genau EIN
      // Schreibvorgang je Partie. Bewusst nicht abgewartet: die Antwort
      // an die Spieler darf nicht an der Datenbank hängen.
      _persistToDatabase(doc, {
        id: path.basename(file, '.json'),
        mode: opts.mode || null, roomId: opts.roomId || null,
        players: doc.meta.usernames, heroes: doc.meta.heroes,
        winnerIdx, reason, turns, events: events.length,
      }).catch(() => {});
      _pruneOldRecordings(outDir);
      return file;
    } catch (err) {
      console.error('[demo-recorder] Schreiben fehlgeschlagen:', err.message);
      return null;
    }
  };

  // ── Spielende: an den bereits gesetzten Handler ketten ──
  const prevGameOver = engine.onGameOver;
  engine.onGameOver = function (room, winnerIdx, reason) {
    try { finish(winnerIdx, reason); } catch { /* nie stören */ }
    return typeof prevGameOver === 'function'
      ? prevGameOver(room, winnerIdx, reason) : undefined;
  };

  // Start-Snapshot (vor Mulligan) in den Strom
  try { events.push(snapshot()); flush(true); } catch { }

  const api = { finish, _events: events };
  engine._demoRecorder = api;
  return api;
}

// `demoRecordingAllowed` wird mitexportiert, damit ein Aufrufer die
// Entscheidung schon VOR dem Anhängen abfragen kann (z. B. um sich das
// Laden zu sparen) — die Wahrheit steht aber weiterhin nur hier.
module.exports = { attachDemoRecorder, demoRecordingAllowed, isCpuVsCpuGame };
