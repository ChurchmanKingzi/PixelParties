'use strict';
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
//  RARITY-IDENTITAET JE KARTENKOPIE (Seltenheits-System)
//
//  Die Engine kennt Karten nur als NAMEN (Strings in Zonen-Arrays) und mutiert sie an hunderten Stellen direkt (Skripte,
//  Handler). Jede PHYSISCHE Kopie soll aber ihre Rarity ueber alle Zonenwechsel behalten (Deck → Hand → Brett → Ablage →
//  Hand …), auch wenn ein Deck mehrere gleichnamige Kopien mit VERSCHIEDENEN Rarities hat.
//
//  Verfahren: IDENTITAETSVERFOLGUNG PER ZUSTANDSVERGLEICH. Je Spieler mit Nicht-Common-Karten im Deck (`ps.rarityLedger`) gibt es
//  einen Schattenzustand `ps.rarityShadow` mit parallelen Arrays (Namen + Rarity) je Zone — auch fuer Deck, Traenke-Deck, Seitendeck.
//  Bei jedem Senden / Zustandswechsel (`reconcile`) wird er gegen die echten Zonen abgeglichen:
//    1. je Zone ein LCS-Abgleich der Namenslisten: unveraenderte Eintraege behalten ihre Rarity,
//    2. entfernte Eintraege wandern (mit Rarity) in den „Schwebe“-Pool (`limbo`), hinzugekommene gleichnamige ziehen daraus
//       (Eintraege desselben Abgleichs in der Reihenfolge, aelteres zuletzt-zuerst; Karten, die zwischen zwei Sends unterwegs sind,
//       etwa ein Zauber in der Aufloesung, bleiben so erhalten),
//    3. Karten, die von einem Spieler zum anderen wechseln (Diebstahl, fremde Area), behalten ihre Rarity ueber den Pool des
//       anderen Spielers (nur Eintraege desselben Abgleichs).
//  Mehrdeutigkeit (gleichnamige Kopien in EINER Zone, z.B. zwei Fireballs in der Hand) loesen HINWEISE auf: `take` wird an den
//  wichtigsten Stellen aufgerufen, an denen die Engine den Index kennt (Hand-Splice, Ablage/Geloescht-Splice/pop/shift, Umsortieren
//  der Hand), BEVOR sie die Karte entfernt; ohne Hinweis gilt: Hand/Ablage/… geben das Ende her, das Deck die Spitze.
//  Das Deck ist verdeckt: dort zaehlt nur, welche Kopien noch drin sind — beim Mischen ist jede Zuordnung gleichwertig.
//
//  Ergebnis: `annotate(ps, pv, areaNames)` liefert `players[i].rarity` in Zonenform (siehe rarities.js), `rarityOf` fragt eine
//  einzelne Karte (Ereignisse/Fluege). Ohne Ledger (alles Common) kostet das nichts.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const LIST_ZONES = [['hand', 'hand'], ['cz', 'creationZone'], ['cs', 'coolnessStack'], ['dp', 'discardPile'], ['xp', 'deletedPile'],
  ['md', 'mainDeck'], ['pd', 'potionDeck'], ['sd', 'sideDeck']];
const DECK_KEYS = new Set(['md', 'pd', 'sd']);
const FRONT_FIRST = new Set(['md', 'pd']);   // Deck: Karten verlassen es an der Spitze (Index 0)
const LIMBO_MAX = 24;

const nm = (x) => (typeof x === 'string' ? x : (x && typeof x.name === 'string' ? x.name : ''));

/** Namenslisten aller Zonen eines Spielers: Map Schluessel → string[] (Reihenfolge = Zuordnungsreihenfolge). */
function liveZones(gs, pi) {
  const ps = gs.players[pi];
  const out = new Map();
  out.set('H', (ps.heroes || []).map(h => nm(h)));
  (ps.abilityZones || []).forEach((hz, h) => (hz || []).forEach((z, s) => out.set('A' + h + '.' + s, (z || []).map(nm))));
  (ps.supportZones || []).forEach((hz, h) => (hz || []).forEach((z, s) => out.set('S' + h + '.' + s, (z || []).map(nm))));
  (ps.surpriseZones || []).forEach((z, s) => out.set('U' + s, (z || []).map(nm)));
  out.set('G', ((gs.areaZones || [])[pi] || []).map(nm));
  for (const [k, f] of LIST_ZONES) {
    if (k === 'md' || k === 'pd' || k === 'sd') continue;
    out.set(k, (ps[f] || []).map(nm));
  }
  out.set('P', (ps.permanents || []).map(nm));
  for (const [k, f] of LIST_ZONES) if (DECK_KEYS.has(k)) out.set(k, (ps[f] || []).map(nm));
  return out;
}

/**
 * LCS-Abgleich zweier Namenslisten: Feld `m` (Laenge a) mit dem Index in b oder -1. `headFirst`: bei gleichnamigen Eintraegen wird
 * zuerst am ANFANG gematcht (also am Ende entfernt) — sonst am Ende (Anfang entfernt, Deck-Spitze).
 */
function align(a, b, tailMatchFirst) {
  const m = new Array(a.length).fill(-1);
  let lo = 0, hiA = a.length, hiB = b.length;
  const trimHead = () => { while (lo < hiA && lo < hiB && a[lo] === b[lo]) { m[lo] = lo; lo++; } };
  const trimTail = () => { while (hiA > lo && hiB > lo && a[hiA - 1] === b[hiB - 1]) { hiA--; hiB--; m[hiA] = hiB; } };
  if (tailMatchFirst) { trimTail(); trimHead(); } else { trimHead(); trimTail(); }
  const n = hiA - lo, k = hiB - lo;
  if (n > 0 && k > 0) {
    const w = k + 1;
    const dp = new Uint16Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = k - 1; j >= 0; j--) {
        dp[i * w + j] = a[lo + i] === b[lo + j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < n && j < k) {
      if (a[lo + i] === b[lo + j]) { m[lo + i] = lo + j; i++; j++; }
      else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) i++;
      else j++;
    }
  }
  return m;
}

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Legt den Schattenzustand eines Spielers aus dem Kopienvorrat an. `info` = rarities.deckZoneInfo (optional). */
function initPlayer(gs, pi) {
  const ps = gs.players[pi];
  const ledger = ps.rarityLedger;
  const info = ps.rarityZones || null;
  const live = liveZones(gs, pi);
  const sh = { z: {}, limbo: [], rd: 0 };
  for (const [key, names] of live) sh.z[key] = { n: names.slice(), r: names.map(() => null) };
  const rest = {};   // Name → Rarities der Kopien, die noch keinem Eintrag gehoeren (absteigend)
  for (const n of Object.keys(ledger || {})) rest[n] = ledger[n].slice();
  const consume = (name, r) => { const l = rest[name]; if (!l) return false; const i = l.indexOf(r); if (i < 0) return false; l.splice(i, 1); return true; };
  const free = new Set();   // Eintraege, die schon eine feste Zuordnung haben (auch Common)
  const set = (key, i, r) => { sh.z[key].r[i] = r || null; free.add(key + '#' + i); };

  // 1. Helden und Startfaehigkeiten: exakt aus dem Deck.
  if (info && Array.isArray(info.heroes)) {
    info.heroes.forEach((h, hi) => {
      if (!h) return;
      const hz = sh.z.H;
      if (hz && h.hero && hz.n[hi] === h.hero) { if (h.hr && consume(h.hero, h.hr)) set('H', hi, h.hr); else set('H', hi, null); }
      const pairs = [];
      if (h.ability1) pairs.push({ n: h.ability1, r: h.r1, used: false });
      if (h.ability2) pairs.push({ n: h.ability2, r: h.r2, used: false });
      for (let s = 0; s < 3; s++) {
        const z = sh.z['A' + hi + '.' + s];
        if (!z) continue;
        z.n.forEach((name, i) => {
          const p = pairs.find(q => !q.used && q.n === name);
          if (!p) return;
          p.used = true;
          if (p.r && consume(name, p.r)) set('A' + hi + '.' + s, i, p.r); else set('A' + hi + '.' + s, i, null);
        });
      }
    });
  }
  // 2. Deck-Zonen: erst die Kopien der eigenen Zone (zufaellige Reihenfolge — das Deck ist gemischt).
  if (info) {
    for (const [key, field] of [['md', 'main'], ['pd', 'potion'], ['sd', 'side']]) {
      const own = info[field];
      const z = sh.z[key];
      if (!own || !z) continue;
      const lists = {};
      for (const n of Object.keys(own)) lists[n] = shuffled(own[n]);
      z.n.forEach((name, i) => {
        const l = lists[name];
        if (!l || !l.length) return;
        const r = l.shift();
        if (consume(name, r)) set(key, i, r);
      });
    }
  }
  // 3. Alles uebrige (Hand/Brett bei spaetem Start, Ueberhang nach Seitendeck-Tausch): aus dem Rest — Decks zufaellig, sonst absteigend.
  for (const key of Object.keys(sh.z)) {
    const z = sh.z[key];
    z.n.forEach((name, i) => {
      if (free.has(key + '#' + i) || !name) return;
      const l = rest[name];
      if (!l || !l.length) return;
      const pick = DECK_KEYS.has(key) ? Math.floor(Math.random() * l.length) : 0;
      z.r[i] = l.splice(pick, 1)[0];
    });
  }
  ps.rarityShadow = sh;
  return sh;
}

function takeLimbo(sh, name) {
  const L = sh.limbo;
  for (let i = 0; i < L.length; i++) if (L[i].n === name && L[i].rd === sh.rd) return L.splice(i, 1)[0];   // gleicher Abgleich: in Reihenfolge
  for (let i = L.length - 1; i >= 0; i--) if (L[i].n === name) return L.splice(i, 1)[0];                    // aelter: zuletzt zuerst
  return null;
}

// Eintraege, die schon da sind, deren Quelle (Entfernen aus der alten Zone) aber noch nicht gesehen wurde — z.B. legt ein Skript die Karte
// in die Ablage, BEVOR es sie aus der Hand nimmt, und dazwischen wird abgeglichen —, tragen '?<Abgleich>' statt einer Rarity, bis eine
// gleichnamige Kopie in den Pool kommt; nach PENDING_MAX Abgleichen ohne Quelle zaehlen sie als Common (z.B. erschaffene Kopien).
const PENDING_MAX = 2;
const isPend = (r) => typeof r === 'string' && r.charCodeAt(0) === 63;   // '?'
const clean = (r) => (r && !isPend(r) ? r : null);

/** Versucht, offene Eintraege aus dem Pool zu bedienen; was bleibt, kommt nach `left`. */
function resolvePending(sh, pi, left) {
  for (const key of Object.keys(sh.z)) {
    const z = sh.z[key];
    for (let j = 0; j < z.r.length; j++) {
      if (!isPend(z.r[j])) continue;
      const e = takeLimbo(sh, z.n[j]);
      if (e) z.r[j] = e.r; else if (left) left.push({ pi, z, j, n: z.n[j] });
    }
  }
}

function reconcilePlayer(gs, pi, unresolved) {
  const ps = gs.players[pi];
  let sh = ps.rarityShadow;
  if (!sh) sh = initPlayer(gs, pi);
  const live = liveZones(gs, pi);
  const adds = [];
  let changed = false;
  const release = (name, r) => { if (name) { sh.limbo.push({ n: name, r: clean(r), rd: sh.rd }); } };
  for (const [key, names] of live) {
    const old = sh.z[key];
    if (!old) {
      sh.z[key] = { n: names.slice(), r: names.map(() => null) };
      names.forEach((n, j) => { if (n) adds.push({ pi, z: sh.z[key], j, n }); });
      if (names.length) changed = true;
      continue;
    }
    // schnell: unveraendert?
    if (old.n.length === names.length) {
      let same = true;
      for (let i = 0; i < names.length; i++) if (old.n[i] !== names[i]) { same = false; break; }
      if (same) continue;
    }
    changed = true;
    const m = align(old.n, names, FRONT_FIRST.has(key));
    const nr = new Array(names.length).fill(null);
    const taken = new Array(names.length).fill(false);
    for (let i = 0; i < old.n.length; i++) {
      if (m[i] >= 0) { nr[m[i]] = old.r[i]; taken[m[i]] = true; }
      else release(old.n[i], old.r[i]);
    }
    const z = { n: names.slice(), r: nr };
    sh.z[key] = z;
    for (let j = 0; j < names.length; j++) if (!taken[j] && names[j]) adds.push({ pi, z, j, n: names[j] });
  }
  for (const key of Object.keys(sh.z)) {
    if (live.has(key)) continue;
    const old = sh.z[key];
    for (let i = 0; i < old.n.length; i++) release(old.n[i], old.r[i]);
    delete sh.z[key];
    changed = true;
  }
  resolvePending(sh, pi, null);   // aeltere offene Eintraege zuerst: ihre Quelle trifft vermutlich gerade ein
  for (const a of adds) {
    const e = takeLimbo(sh, a.n);
    if (e) a.z.r[a.j] = e.r; else { a.z.r[a.j] = '?' + sh.rd; }
  }
  for (const key of Object.keys(sh.z)) {
    const z = sh.z[key];
    for (let j = 0; j < z.r.length; j++) if (isPend(z.r[j])) unresolved.push({ pi, z, j, n: z.n[j] });
  }
  return changed;
}

/**
 * Gleicht den Schattenzustand ALLER Spieler mit Ledger gegen die echten Zonen ab (idempotent, billig wenn nichts geschehen ist).
 * @param {object} gs Spielzustand
 */
function reconcile(gs) {
  if (!gs || !gs.players) return;
  const todo = [];
  gs.players.forEach((ps, pi) => { if (ps && ps.rarityLedger) todo.push(pi); });
  if (!todo.length) return;
  const unresolved = [];
  const changedBy = {};
  for (const pi of todo) changedBy[pi] = reconcilePlayer(gs, pi, unresolved);
  // Karten, die von einem Spieler zum anderen gewechselt sind: nur Eintraege desselben Abgleichs.
  if (unresolved.length && todo.length > 1) {
    for (const a of unresolved) {
      for (const q of todo) {
        if (q === a.pi) continue;
        const sh = gs.players[q].rarityShadow;
        const i = sh.limbo.findIndex(e => e.n === a.n && e.rd === sh.rd);
        if (i >= 0) { a.z.r[a.j] = sh.limbo.splice(i, 1)[0].r; break; }
      }
    }
  }
  for (const pi of todo) {
    const sh = gs.players[pi].rarityShadow;
    // zu lange ohne Quelle → Common
    for (const key of Object.keys(sh.z)) {
      const z = sh.z[key];
      for (let j = 0; j < z.r.length; j++) if (isPend(z.r[j]) && sh.rd - (+z.r[j].slice(1)) >= PENDING_MAX) z.r[j] = null;
    }
    if (changedBy[pi] || sh.limbo.some(e => e.rd === sh.rd)) sh.rd++;
    if (sh.limbo.length > LIMBO_MAX) sh.limbo.splice(0, sh.limbo.length - LIMBO_MAX);
  }
}

/**
 * HINWEIS: die Engine entfernt gleich `count` Karten ab `start` aus Zone `key` (z.B. 'hand', 'dp', 'xp'). Aufrufen VOR dem Entfernen.
 * Die betroffenen Eintraege gehen mit ihrer Rarity in den Schwebe-Pool; ihre naechste Landung ist damit eindeutig.
 */
function take(gs, pi, key, start, count) {
  const ps = gs && gs.players && gs.players[pi];
  if (!ps || !ps.rarityLedger || !(count > 0)) return;
  reconcile(gs);
  const sh = ps.rarityShadow;
  const z = sh && sh.z[key];
  if (!z || start < 0 || start >= z.n.length) return;
  const ns = z.n.splice(start, count);
  const rs = z.r.splice(start, count);
  ns.forEach((n, i) => { if (n) sh.limbo.push({ n, r: clean(rs[i]), rd: sh.rd }); });
  resolvePending(sh, pi, null);
}

/** HINWEIS: die Hand wird umsortiert (`indexMap[neu] = alt`). Vor dem Setzen der neuen Hand aufrufen; die Rarities folgen den Kopien. */
function permute(gs, pi, key, indexMap) {
  const ps = gs && gs.players && gs.players[pi];
  if (!ps || !ps.rarityLedger || !Array.isArray(indexMap)) return;
  reconcile(gs);
  const z = ps.rarityShadow && ps.rarityShadow.z[key];
  if (!z || z.n.length !== indexMap.length) return;
  const n = [], r = [];
  for (let i = 0; i < indexMap.length; i++) { n.push(z.n[indexMap[i]]); r.push(z.r[indexMap[i]]); }
  z.n = n; z.r = r;
}

/** Rarity-Id (nicht Common) der Karte in Zone `key` an Platz `idx`, wenn der Name stimmt, sonst null. */
function at(ps, key, idx, name) {
  const z = ps && ps.rarityShadow && ps.rarityShadow.z[key];
  if (!z || z.n[idx] !== name) return null;
  return clean(z.r[idx]);
}

/**
 * Rarity fuer `players[i].rarity` in Zonenform (heroes, abilityZones, supportZones, surpriseZones, area, hand, creationZone,
 * coolnessStack, discardPile, deletedPile, permanents). `pv` = Spielersicht (nach dem Verbergen); verdeckte Karten ('?') bleiben Common.
 * @returns {object|null} null, wenn keine Karte eine Rarity hat
 */
function annotate(ps, pv, areaNames) {
  if (!ps || !ps.rarityShadow || !pv) return null;
  let any = false;
  const g = (key, idx, name) => {
    if (!name || name === '?') return null;
    const r = at(ps, key, idx, name);
    if (r) any = true;
    return r;
  };
  const flat = (key, arr) => (arr || []).map((n, i) => g(key, i, nm(n)));
  const out = {};
  out.heroes = (pv.heroes || []).map((h, i) => g('H', i, nm(h)));
  out.abilityZones = (pv.abilityZones || []).map((hz, h) => (hz || []).map((z, s) => flat('A' + h + '.' + s, z)));
  out.supportZones = (pv.supportZones || []).map((hz, h) => (hz || []).map((z, s) => flat('S' + h + '.' + s, z)));
  out.surpriseZones = (pv.surpriseZones || []).map((z, s) => flat('U' + s, z));
  out.area = flat('G', areaNames);
  out.hand = flat('hand', pv.hand);
  out.creationZone = flat('cz', pv.creationZone);
  out.coolnessStack = flat('cs', pv.coolnessStack);
  out.discardPile = flat('dp', pv.discardPile);
  out.deletedPile = flat('xp', pv.deletedPile);
  out.permanents = flat('P', pv.permanents);
  return any ? out : null;
}

/**
 * Rarity einer Karte fuer ein Ereignis (Flug, Aufdecken): sucht den Namen in den genannten Zonen des Spielers (zuletzt hinzugekommene
 * zuerst), danach im Schwebe-Pool. `zones` = Zonen-Schluessel in Suchreihenfolge, z.B. ['hand','dp'].
 * @returns {string|null}
 */
function rarityOf(gs, pi, name, zones) {
  const ps = gs && gs.players && gs.players[pi];
  if (!ps || !ps.rarityLedger || !name) return null;
  reconcile(gs);
  const sh = ps.rarityShadow;
  if (!sh) return null;
  for (const key of zones || []) {
    const z = sh.z[key];
    if (!z) continue;
    for (let i = z.n.length - 1; i >= 0; i--) if (z.n[i] === name) return clean(z.r[i]);
  }
  for (let i = sh.limbo.length - 1; i >= 0; i--) if (sh.limbo[i].n === name) return sh.limbo[i].r || null;
  return null;
}

module.exports = { reconcile, take, permute, annotate, at, rarityOf, initPlayer, liveZones, align };
