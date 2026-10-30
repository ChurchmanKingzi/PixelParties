// ═══════════════════════════════════════════
//  PIXEL PARTIES — Zustandslog für das CPU-Wertnetz (Stufe 1)
//
//  Zerlegt die Stellung einer laufenden Partie in Zahlen und Karten-Token, legt sie kompakt in eine Binärdatei neben die
//  Trainings-jsonl und liest sie wieder. Das Netz selbst kommt später (Stufe 2); hier geht es nur darum, dass jede Partie, die ab
//  jetzt gesammelt wird, die Stellungen enthält, aus denen man es trainieren kann. Was hier nicht mitgeschrieben wird, fehlt
//  allen bis dahin gesammelten Spielen — deshalb lieber ein Feld zu viel als eines zu wenig.
//
//  Schalter: `PP_VALUE_NET=log` (ohne ihn läuft alles wie bisher, kein Zustand wird gebaut).
//
//  Was ein Zustand enthält (`extractState`): beide Sitze mit Gold, Handgröße, Deck-/Ablagegrößen, Sperren, Zug-Zählern, Helden
//  (Name, HP, Max-HP, ATK, Statusmaske), Fähigkeiten je Held/Slot, Support-Karten (Kreaturen, Ausrüstung) mit HP/Status/Alter,
//  Surprises, Area-Karten, Permanents, Ablage und Gelöschte als Karte→Anzahl und die Hand; dazu der Bewertungswert des
//  handgeschriebenen Evaluators je Sitz (`ev`, Anfütterung für die Destillation). Der Zustand ist die VOLLE Sicht ohne
//  Deckreihenfolge; die ehrliche Sicht eines Sitzes (`honestView`) maskiert daraus Gegnerhand und verdeckte Karten des Gegners.
//
//  ERWEITERBAR: jeder Zustand endet mit einer Liste von Zusatzblöcken `(Typ, Länge, Bytes)`. Ein später ergänzter Block (etwa die
//  obersten Karten beider Decks) bricht keinen alten Leser: unbekannte Typen werden als Rohbytes durchgereicht. Ändert sich das
//  Grundlayout selbst, muss `FORMAT_VERSION` steigen. Die Kartennummern stammen aus `data/cpu-value/vocab.json` (nur anhängend,
//  siehe `scripts/value/build-vocab.js`); 0 heißt „unbekannt/leer".
//
//  Dateiformat (`<out>.jsonl.states`): Folge von Spielblöcken, je ein Block pro Partie, mit `gameIdx` als Schlüssel zur jsonl-Zeile.
//    Kopf (24 Bytes, little endian): 'PPVS' · Version u8 · Sieger u8 (0 keiner, 1 Sitz 0, 2 Sitz 1) · gepinnter Sitz u8 · reserviert u8 ·
//    gameIdx u32 · Zustände u32 · Rohlänge u32 · gepackte Länge u32; danach die deflate-gepackten Zustände (je `uv Länge` + Bytes).
//  Ein abgebrochener Schreibvorgang hinterlässt höchstens einen abgeschnittenen LETZTEN Block; `repairFile` schneidet ihn ab.
// ═══════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const FORMAT_VERSION = 1;
const MAGIC = 0x53565050;            // 'PPVS' (little endian)
const HEADER_BYTES = 24;
const MAX_STATES_PER_GAME = 1500;    // Notbremse gegen Endlosschleifen; normale Partien liegen weit darunter
const VOCAB_PATH = path.join(__dirname, '..', '..', 'data', 'cpu-value', 'vocab.json');

// Reihenfolge der Sitz-Zahlen im Zustand. Änderung = neue FORMAT_VERSION.
const SEAT_SCALARS = ['gold', 'hand', 'deck', 'potion', 'disc', 'del', 'locks', 'potUsed', 'atkPlayed', 'splPlayed', 'bonus', 'acted', 'dmg', 'cool', 'perm'];
const LOCK_KEYS = ['summonLocked', 'actionLocked', 'itemLocked', 'damageLocked', 'potionLocked', 'handLocked', 'drawLocked', 'searchLocked', 'goldLocked', 'supportSpellLocked'];

// Token-Felder, nur zur Doku und für den Rückleser: Held · Fähigkeit · Support · Surprise
const HERO_FIELDS = ['id', 'h', 'hp', 'maxHp', 'atk', 'mask', 'flags'];       // flags: 1 lebt · 2 hat gehandelt · 4 hat angegriffen
const ABIL_FIELDS = ['h', 'slot', 'id', 'n'];
const SUP_FIELDS = ['h', 'slot', 'id', 'hp', 'mask', 'flags', 'age', 'ctr', 'buffs'];   // flags: 1 verdeckt · 2 geliehen (Kontrolleur ≠ Brettseite) · 4 in diesem Zug gelegt
const SUR_FIELDS = ['h', 'slot', 'id'];

// ── Vokabular ────────────────────────────────────────────────────────
let _vocab = null;
const _unknown = new Map();          // Name → Häufigkeit (Diagnose: Karten, die dem Netz unsichtbar bleiben)
function loadVocab(force) {
  if (_vocab && !force) return _vocab;
  let raw = { version: 1, statuses: [], names: [''] };
  try { raw = JSON.parse(fs.readFileSync(VOCAB_PATH, { encoding: 'utf-8' })); } catch { /* ohne Vokabular: alles unbekannt */ }
  const idOfName = new Map();
  raw.names.forEach((n, i) => { if (n) idOfName.set(n, i); });
  const statusBit = new Map();
  (raw.statuses || []).forEach((s, i) => statusBit.set(s, i));
  _vocab = { names: raw.names, idOfName, statusBit, statuses: raw.statuses || [] };
  return _vocab;
}
function idOf(name) {
  if (!name) return 0;
  const id = loadVocab().idOfName.get(name);
  if (id) return id;
  _unknown.set(name, (_unknown.get(name) || 0) + 1);
  return 0;
}
function nameOf(id) { return loadVocab().names[id] || ''; }
function unknownNames() { return new Map(_unknown); }

// ── Bytes ────────────────────────────────────────────────────────────
class Writer {
  constructor(cap = 2048) { this.b = Buffer.allocUnsafe(cap); this.n = 0; }
  _need(k) {
    if (this.n + k <= this.b.length) return;
    const nb = Buffer.allocUnsafe(Math.max(this.b.length * 2, this.n + k));
    this.b.copy(nb, 0, 0, this.n); this.b = nb;
  }
  u8(v) { this._need(1); this.b[this.n++] = v & 255; }
  uv(v) {                                   // vorzeichenlos, LEB128
    v = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
    this._need(10);
    while (v >= 128) { this.b[this.n++] = (v % 128) | 128; v = Math.floor(v / 128); }
    this.b[this.n++] = v;
  }
  sv(v) { v = Number.isFinite(v) ? Math.trunc(v) : 0; this.uv(v >= 0 ? v * 2 : -v * 2 - 1); }   // vorzeichenbehaftet, Zickzack
  raw(buf) { this._need(buf.length); buf.copy(this.b, this.n); this.n += buf.length; }
  bytes() { return this.b.subarray(0, this.n); }
}
class Reader {
  constructor(buf, pos = 0) { this.b = buf; this.p = pos; }
  u8() { if (this.p >= this.b.length) throw new RangeError('Ende der Daten'); return this.b[this.p++]; }
  uv() {
    let v = 0, mul = 1, byte;
    do {
      byte = this.u8();
      v += (byte & 127) * mul; mul *= 128;
    } while (byte & 128);
    return v;
  }
  sv() { const z = this.uv(); return z % 2 ? -(z + 1) / 2 : z / 2; }
  raw(n) { if (this.p + n > this.b.length) throw new RangeError('Ende der Daten'); const s = this.b.subarray(this.p, this.p + n); this.p += n; return s; }
}

// ── Zustand aus der Engine ───────────────────────────────────────────
const num = (v) => {
  if (v == null || v === false) return 0;
  if (v === true) return 1;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : 0;
  if (Array.isArray(v)) return v.length;
  if (typeof v === 'object') return Number.isFinite(v.count) ? Math.round(v.count) : Object.keys(v).length;
  return 0;
};
const present = (v) => !!v && !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) && !(Array.isArray(v) && v.length === 0);
const statusMask = (st, bits) => {
  let m = 0;
  if (st && typeof st === 'object') for (const [k, val] of Object.entries(st)) { if (val && bits.has(k)) m += 2 ** bits.get(k); }
  return m;
};
const flat = (v, out = []) => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v) flat(x, out);
  else if (v && typeof v === 'object' && typeof v.name === 'string') out.push(v.name);
  return out;
};
const countMap = (names) => {
  const m = new Map();
  for (const n of names) { const id = idOf(n); m.set(id, (m.get(id) || 0) + 1); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
};
const byTuple = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

function seatState(engine, gs, seat, bits) {
  const ps = gs.players[seat];
  const sc = {
    gold: num(ps.gold), hand: (ps.hand || []).length, deck: (ps.mainDeck || []).length, potion: (ps.potionDeck || []).length,
    disc: (ps.discardPile || []).length, del: (ps.deletedPile || []).length,
    locks: 0, potUsed: num(ps.potionsUsedThisTurn), atkPlayed: num(ps.attacksPlayedThisTurn), splPlayed: num(ps.spellsPlayedThisTurn),
    bonus: num(ps.bonusActions), acted: num(ps.heroesActedThisTurn), dmg: num(ps.damageDealtThisGame),
    cool: (ps.coolnessStack || []).length, perm: (ps.permanents || []).length,
  };
  LOCK_KEYS.forEach((k, i) => { if (present(ps[k])) sc.locks += 2 ** i; });

  const acted = Array.isArray(ps.heroesActedThisTurn) ? ps.heroesActedThisTurn : [];
  const attacked = Array.isArray(ps.heroesAttackedThisTurn) ? ps.heroesAttackedThisTurn : [];
  const heroes = [];
  (ps.heroes || []).forEach((h, hi) => {
    if (!h || !h.name) return;
    heroes.push([idOf(h.name), hi, num(h.hp), num(h.maxHp), num(h.atk), statusMask(h.statuses, bits),
      ((h.hp || 0) > 0 ? 1 : 0) + (acted.includes(hi) ? 2 : 0) + (attacked.includes(hi) ? 4 : 0)]);
  });

  const abil = [];
  (ps.abilityZones || []).forEach((zone, hi) => (zone || []).forEach((slot, si) => {
    const m = new Map();
    for (const n of flat(slot)) { const id = idOf(n); m.set(id, (m.get(id) || 0) + 1); }
    for (const [id, n] of m) abil.push([hi, si, id, n]);
  }));
  abil.sort(byTuple);

  const sur = [];
  (ps.surpriseZones || []).forEach((zone, hi) => flat(zone).forEach((n, si) => sur.push([hi, si, idOf(n)])));

  return {
    sc, heroes, abil, sur,
    area: flat(gs.areaZones?.[seat] || []).map(idOf).sort((a, b) => a - b),
    perm: (ps.permanents || []).map(p => idOf(p && p.name)).sort((a, b) => a - b),
    disc: countMap(ps.discardPile || []),
    del: countMap(ps.deletedPile || []),
    hand: countMap(ps.hand || []),
    sup: [],
  };
}

/**
 * Stellung als Zwischenform (siehe Kopfkommentar). `trig`: 0 = Zugbeginn, 1 = nach einer Aktion. `ev`: Bewertung je Sitz oder null.
 * Reine Abfrage — verändert die Engine nicht.
 */
function extractState(engine, trig, ev) {
  const gs = engine.gs;
  if (!gs || !gs.players || !gs.players[0] || !gs.players[1]) return null;
  const bits = loadVocab().statusBit;
  const seats = [seatState(engine, gs, 0, bits), seatState(engine, gs, 1, bits)];
  const turn = gs.turn || 0;
  for (const inst of (engine.cardInstances || [])) {
    if (!inst || inst.zone !== 'support') continue;
    const side = engine.physicalSide(inst);
    if (side !== 0 && side !== 1) continue;
    const c = inst.counters || {};
    let ctr = 0;
    for (const [k, v] of Object.entries(c)) if (k !== 'currentHp' && typeof v === 'number') ctr += v;
    let buffs = 0;
    if (c.buffs && typeof c.buffs === 'object') for (const v of Object.values(c.buffs)) if (v) buffs++;
    const hp = c.currentHp != null ? c.currentHp : 0;
    seats[side].sup.push([inst.heroIdx ?? 0, inst.zoneSlot ?? 0, idOf(inst.name), num(hp), statusMask(inst.statuses, bits),
      (inst.faceDown ? 1 : 0) + ((inst.controller ?? inst.owner) !== side ? 2 : 0) + ((inst.turnPlayed || 0) === turn ? 4 : 0),
      Math.max(0, Math.min(40, turn - (inst.turnPlayed || 0))), num(ctr), buffs]);
  }
  for (const s of seats) s.sup.sort(byTuple);
  return { trig, turn, phase: gs.currentPhase || 0, active: gs.activePlayer === 1 ? 1 : 0, seats, ev: ev || [null, null], extra: [] };
}

// ── Zustand ⇄ Bytes ──────────────────────────────────────────────────
function writeList(w, list, width) {
  w.uv(list.length);
  for (const t of list) for (let i = 0; i < width; i++) w.sv(t[i]);
}
function readList(r, width) {
  const n = r.uv(), out = [];
  for (let k = 0; k < n; k++) { const t = []; for (let i = 0; i < width; i++) t.push(r.sv()); out.push(t); }
  return out;
}

/** Zustand → Bytes. Das erste Byte ist `trig` und gehört NICHT zum Vergleichsteil (siehe `bodyOf`). */
function writeState(S) {
  const w = new Writer();
  w.u8(S.trig);
  w.uv(S.turn); w.u8(S.phase); w.u8(S.active);
  w.u8((S.ev[0] != null ? 1 : 0) + (S.ev[1] != null ? 2 : 0));
  if (S.ev[0] != null) w.sv(S.ev[0]);
  if (S.ev[1] != null) w.sv(S.ev[1]);
  for (const s of S.seats) {
    for (const k of SEAT_SCALARS) w.sv(s.sc[k]);
    writeList(w, s.heroes, HERO_FIELDS.length);
    writeList(w, s.abil, ABIL_FIELDS.length);
    writeList(w, s.sup, SUP_FIELDS.length);
    writeList(w, s.sur, SUR_FIELDS.length);
    w.uv(s.area.length); for (const id of s.area) w.uv(id);
    w.uv(s.perm.length); for (const id of s.perm) w.uv(id);
    for (const pile of [s.disc, s.del, s.hand]) { w.uv(pile.length); for (const [id, n] of pile) { w.uv(id); w.uv(n); } }
  }
  w.uv(S.extra.length);
  for (const e of S.extra) { w.u8(e.type); w.uv(e.bytes.length); w.raw(e.bytes); }
  return Buffer.from(w.bytes());
}
/** Teil der Bytes ohne `trig` und ohne die Bewertungswerte: gleicher Teil = gleiche Stellung (zum Weglassen von Wiederholungen). */
const bodyOf = (buf) => buf.subarray(1);

function readState(buf) {
  const r = new Reader(buf);
  const S = { trig: r.u8(), turn: r.uv(), phase: r.u8(), active: r.u8(), seats: [], ev: [null, null], extra: [] };
  const evFlags = r.u8();
  if (evFlags & 1) S.ev[0] = r.sv();
  if (evFlags & 2) S.ev[1] = r.sv();
  for (let si = 0; si < 2; si++) {
    const sc = {};
    for (const k of SEAT_SCALARS) sc[k] = r.sv();
    const s = { sc, heroes: readList(r, HERO_FIELDS.length), abil: readList(r, ABIL_FIELDS.length), sup: readList(r, SUP_FIELDS.length), sur: readList(r, SUR_FIELDS.length) };
    s.area = Array.from({ length: r.uv() }, () => r.uv());
    s.perm = Array.from({ length: r.uv() }, () => r.uv());
    for (const key of ['disc', 'del', 'hand']) s[key] = Array.from({ length: r.uv() }, () => [r.uv(), r.uv()]);
    S.seats.push(s);
  }
  const nExtra = r.uv();
  for (let i = 0; i < nExtra; i++) { const type = r.u8(); const len = r.uv(); S.extra.push({ type, bytes: Buffer.from(r.raw(len)) }); }
  return S;
}

/**
 * Ehrliche Sicht eines Sitzes: eigene Karten vollständig, vom Gegner nur Öffentliches. Die Gegnerhand fehlt (nur ihre Größe in
 * `sc.hand`), verdeckte Gegner-Karten (Surprises, verdeckte Support-Karten) tragen die Kartennummer 0.
 */
function honestView(S, seat) {
  const mine = S.seats[seat], theirs = S.seats[1 - seat];
  const hide = (s) => ({
    ...s,
    sup: s.sup.map(t => (t[5] & 1) ? [t[0], t[1], 0, ...t.slice(3)] : t),
    sur: s.sur.map(t => [t[0], t[1], 0]),
    hand: [],
  });
  return {
    turn: S.turn, phase: S.phase, trig: S.trig, myTurn: S.active === seat,
    ev: S.ev[seat], self: mine, opp: hide(theirs),
  };
}

// ── Spielblöcke ──────────────────────────────────────────────────────
/** Sammelt die Zustände einer Partie. `capture` wird aus dem Recorder-Hook gerufen. */
class ValueLog {
  constructor(engine) { this.engine = engine; this.states = []; this.last = null; this.dropped = 0; this.ms = 0; }

  /** Eine Stellung festhalten. Nie das Spiel stören: jeder Fehler wird geschluckt. `ms` summiert die dafür verbrauchte Zeit (Mehrkosten-Messung). */
  capture(trig) {
    const t0 = process.hrtime.bigint();
    try { this._capture(trig); } finally { this.ms += Number(process.hrtime.bigint() - t0) / 1e6; }
  }
  _capture(trig) {
    try {
      const e = this.engine, gs = e.gs;
      if (!gs || gs.result || e._inMctsSim || (gs._spellResolutionDepth || 0) > 0) return;
      if (this.states.length >= MAX_STATES_PER_GAME) { this.dropped++; return; }
      const ev = [quietEval(e, 0), quietEval(e, 1)];
      const S = extractState(e, trig, ev);
      if (!S) return;
      const buf = writeState(S);
      const body = bodyOf(buf);
      // Gleiche Stellung wie zuvor (etwa Zugbeginn direkt nach einer Aktion ohne Wirkung): nicht noch einmal schreiben.
      if (this.last && this.last.equals(body)) return;
      this.last = Buffer.from(body);
      this.states.push(buf);
    } catch { /* Beobachter darf nie stören */ }
  }

  /** Alle Zustände der Partie als ein Block (oder null, wenn nichts anfiel). */
  pack(gameIdx, winnerIdx, pinnedIdx) {
    if (!this.states.length) return null;
    const w = new Writer(1 << 15);
    for (const s of this.states) { w.uv(s.length); w.raw(s); }
    return packBlock(gameIdx, this.states.length, winnerIdx, pinnedIdx, Buffer.from(w.bytes()));
  }
}

/** Bewertung des handgeschriebenen Evaluators, ohne den Zufallsstrom des Spiels anzurühren (sonst änderte der Log das Spiel). */
function quietEval(engine, seat) {
  if (typeof engine._cpuEvaluateState !== 'function') return null;
  const rnd = Math.random;
  Math.random = () => 0.5;
  try { const v = engine._cpuEvaluateState(seat); return Number.isFinite(v) ? Math.round(v) : null; }
  catch { return null; }
  finally { Math.random = rnd; }
}

function packBlock(gameIdx, nStates, winnerIdx, pinnedIdx, rawBuf) {
  const z = zlib.deflateSync(rawBuf, { level: 6 });
  const h = Buffer.alloc(HEADER_BYTES);
  h.writeUInt32LE(MAGIC, 0);
  h[4] = FORMAT_VERSION;
  h[5] = winnerIdx === 0 ? 1 : winnerIdx === 1 ? 2 : 0;
  h[6] = pinnedIdx === 1 ? 1 : 0;
  h.writeUInt32LE(gameIdx >>> 0, 8);
  h.writeUInt32LE(nStates >>> 0, 12);
  h.writeUInt32LE(rawBuf.length >>> 0, 16);
  h.writeUInt32LE(z.length >>> 0, 20);
  return Buffer.concat([h, z]);
}

function parseHeader(h) {
  if (h.length < HEADER_BYTES || h.readUInt32LE(0) !== MAGIC) return null;
  return { version: h[4], winner: h[5] === 1 ? 0 : h[5] === 2 ? 1 : -1, pinned: h[6], gameIdx: h.readUInt32LE(8),
    nStates: h.readUInt32LE(12), rawLen: h.readUInt32LE(16), zLen: h.readUInt32LE(20) };
}

/** Alle gültigen Blöcke einer Datei, ohne sie zu entpacken: [{gameIdx, pos, len, …Kopf}]. Hört am ersten kaputten/abgeschnittenen auf. */
function scanFile(file) {
  const out = [];
  let fd;
  try { fd = fs.openSync(file, 'r'); } catch { return { blocks: out, goodBytes: 0, totalBytes: 0 }; }
  try {
    const total = fs.fstatSync(fd).size;
    let pos = 0;
    const head = Buffer.alloc(HEADER_BYTES);
    while (pos + HEADER_BYTES <= total) {
      fs.readSync(fd, head, 0, HEADER_BYTES, pos);
      const h = parseHeader(head);
      if (!h || h.version > FORMAT_VERSION) break;
      const len = HEADER_BYTES + h.zLen;
      if (pos + len > total) break;
      out.push({ ...h, pos, len });
      pos += len;
    }
    return { blocks: out, goodBytes: pos, totalBytes: total };
  } finally { fs.closeSync(fd); }
}

function readBlockBytes(file, blk) {
  const fd = fs.openSync(file, 'r');
  try { const b = Buffer.alloc(blk.len); fs.readSync(fd, b, 0, blk.len, blk.pos); return b; } finally { fs.closeSync(fd); }
}

/** Einen Block entpacken → { gameIdx, winner, pinned, states: [Zustand, …] }. */
function readBlock(buf) {
  const h = parseHeader(buf);
  if (!h) throw new Error('kein Zustandsblock');
  const raw = zlib.inflateSync(buf.subarray(HEADER_BYTES, HEADER_BYTES + h.zLen));
  const r = new Reader(raw), states = [];
  for (let i = 0; i < h.nStates; i++) { const n = r.uv(); states.push(readState(Buffer.from(r.raw(n)))); }
  return { gameIdx: h.gameIdx, winner: h.winner, pinned: h.pinned, version: h.version, states };
}

/** Hängt einen Block an die Datei (nach `repairFile` sicher). */
function appendBlock(file, blockBuf) { fs.appendFileSync(file, blockBuf); }

/** Schneidet einen abgeschnittenen letzten Block ab (Absturz mitten im Schreiben). Liefert die Zahl der abgeschnittenen Bytes. */
function repairFile(file) {
  const { goodBytes, totalBytes } = scanFile(file);
  if (totalBytes > goodBytes) fs.truncateSync(file, goodBytes);
  return totalBytes - goodBytes;
}

/**
 * Führt Zustandsdateien zusammen (Haupt- und Worker-Dateien): je gameIdx der erste Block, nach gameIdx sortiert, atomar in `outFile`.
 * `keep` (Set von gameIdx) beschränkt auf Spiele, die die jsonl wirklich enthält. Liefert { games, dropped }.
 */
function mergeFiles(outFile, files, keep) {
  const pick = new Map();
  for (const f of files) {
    const { blocks } = scanFile(f);
    for (const b of blocks) {
      if (keep && !keep.has(b.gameIdx)) continue;
      if (!pick.has(b.gameIdx)) pick.set(b.gameIdx, { file: f, blk: b });
    }
  }
  const tmp = outFile + '.merge.tmp';
  const fd = fs.openSync(tmp, 'w');
  try {
    for (const k of [...pick.keys()].sort((a, b) => a - b)) {
      const { file, blk } = pick.get(k);
      fs.writeSync(fd, readBlockBytes(file, blk));
    }
  } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, outFile);
  return { games: pick.size };
}

function enabled() { return process.env.PP_VALUE_NET === 'log'; }
function statesPath(jsonlPath) { return jsonlPath + '.states'; }   // neben die jsonl; Worker-Dateien: `<out>.w<k>.states`

module.exports = {
  FORMAT_VERSION, HEADER_BYTES, SEAT_SCALARS, LOCK_KEYS, HERO_FIELDS, ABIL_FIELDS, SUP_FIELDS, SUR_FIELDS,
  loadVocab, idOf, nameOf, unknownNames,
  Writer, Reader, extractState, writeState, readState, bodyOf, honestView,
  ValueLog, quietEval, packBlock, scanFile, readBlock, readBlockBytes, appendBlock, repairFile, mergeFiles,
  enabled, statesPath,
};
