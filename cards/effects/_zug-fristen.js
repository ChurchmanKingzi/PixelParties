'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  W68a — „NUR ECHTE ZÜGE ZÄHLEN"  (Al, Spieldesigner, 23.10.2026)
//
//  Ein ÜBERSPRUNGENER Zug (Guardian Beast Zhu, Hand of Death: `ps._skipNextTurn`) ist kein Zug: er hat keinen Beginn und kein Ende, beendet keine Frist
//  und bringt keinen Zähler vorwärts. Fristen („until the end of your opponent's next turn", „until the beginning of your next turn", „for N turns",
//  „At the end of your next turn …"), Auftragsfristen und Zugende-Auslöser laufen bis zum Ende des nächsten TATSÄCHLICH gespielten betreffenden Zuges.
//
//  ── Das Modell (EINE Stelle) ───────────────────────────────────────────────
//  1. `_switchTurnInner({ uebersprungen: true })` (der formale Durchlauf eines übersprungenen Zuges) führt KEIN Zugende aus: kein ON_TURN_END, keine
//     Zugende-Aufträge (Hand of Death, Illusionen), kein Zugende-Surprise-Fenster, keinen Ablauf von Zusatzaktionen/Zugende-Löschungen/geliehenen
//     Identitäten, kein `itemLocked`-Abräumen. Statusdauern (`processStatusExpiry('END')`), Zugbeginn-Hooks (`startTurn`) liefen im Skip nie.
//  2. Fristen, die als ZUGNUMMER abgelegt sind (`expiresAtTurn`/`expiresForPlayer`, `_identityExpiresTurn`, `drawLockedUntilTurn` …), werden beim
//     Skip um 2 Zugnummern verschoben (der Gegenzug dazwischen), WENN der von ihnen gezählte Zug der übersprungene ist: `fristenNachSkip`.
//  3. Welchen Zug eine Frist zählt, steht in der Frist selbst:
//       • Standard („ENDE"): die Frist endet mit dem Ende des Zuges `expiresAtTurn − 1` (fällig zu Beginn des Zuges `expiresAtTurn` von `expiresForPlayer`,
//         der unmittelbar auf jenes Ende folgt) — „until the end of your opponent's next turn", „… of your next turn", „for 1 turn", „this turn".
//       • `fristBeginn: true`: die Frist endet zu BEGINN des Zuges `expiresAtTurn` von `expiresForPlayer` — „until the beginning of your next turn".
//     Gezählt wird also Zug `c` (ENDE: `expiresAtTurn − 1`; BEGINN: `expiresAtTurn`); der Besitzer von `c` folgt aus der strikten Zugfolge
//     (`zugBesitzer`). Ist `c` ≥ dem übersprungenen Zug und gehört `c` dem Spieler des übersprungenen Zuges, rückt die Frist um 2 weiter.
//     Fristen, deren gezählter Zug schon vorbei ist („this turn" des Gegners: `c` = der gerade beendete eigene Zug), bleiben liegen und werden vom
//     Skip-Eingang (`_processBuffExpiry`) wie bisher fällig gemacht — der Buff stünde sonst für immer.
//  4. Zähler, die als Hook (ON_TURN_START/ON_TURN_END, Spielerauftrag mit `>`/`>=`-Vergleich) laufen, brauchen nichts: der Skip führt diese Hooks nicht aus.
//
//  Neue Karten mit Zugnummern-Fristen: `fristBeginn: true` setzen, wenn der Text „until the beginning/start of your next turn" lautet; sonst nichts.
//  Eigene Zugnummern-Speicher (nicht `expiresAtTurn`) tragen sich unten in `fristenNachSkip` ein (Prüfung: `scripts/check-zugfristen.js`).
// ═══════════════════════════════════════════════════════════════════════════

/** Besitzer der Zugnummer `n` (strenger Wechsel ab dem laufenden Zug; Zwei-Spieler-Spiel). */
function zugBesitzer(engine, n) {
  const gs = engine.gs;
  return ((n - gs.turn) % 2 === 0) ? gs.activePlayer : engine.opponentOf(gs.activePlayer);
}

/** War der Zug mit der Nummer `n` ein tatsächlich gespielter Zug? (Übersprungene Zugnummern stehen in `gs._uebersprungeneZuege`.) */
function istEchterZug(engine, n) {
  const l = engine.gs?._uebersprungeneZuege;
  return !(Array.isArray(l) && l.some(e => e.turn === n));
}

/**
 * Beim Skip des Zuges `Ts` von Spieler `S` (laufend: gs.turn === Ts, gs.activePlayer === S): alle Zugnummern-Fristen verschieben, die einen Zug von S
 * zählen, der nicht mehr stattfindet. Gibt die Zahl der verschobenen Einträge zurück.
 */
function fristenNachSkip(engine, S, Ts) {
  const gs = engine.gs;
  if (!gs || gs.skillTest || engine.playerCount() !== 2) return 0;   // Skill Test zählt Runden (`roundTurn`), nicht Spielerzüge
  let n = 0;
  const betrifft = (c) => typeof c === 'number' && c >= Ts && zugBesitzer(engine, c) === S;
  /** Frist-Datensatz { expiresAtTurn, expiresForPlayer, fristBeginn }. */
  const stempel = (e) => {
    if (!e || typeof e !== 'object' || typeof e.expiresAtTurn !== 'number' || typeof e.expiresForPlayer !== 'number') return;
    if (betrifft(e.fristBeginn ? e.expiresAtTurn : e.expiresAtTurn - 1)) { e.expiresAtTurn += 2; n++; }
  };
  /** Einzelne Zugnummer `obj[key]`, die selbst den gezählten Zug nennt (Ende dieses Zuges bzw. Beginn dieses Zuges). */
  const wert = (obj, key) => {
    if (!obj || typeof obj[key] !== 'number') return;
    if (betrifft(obj[key])) { obj[key] += 2; n++; }
  };

  for (let pi = 0; pi < gs.players.length; pi++) {
    const ps = gs.players[pi];
    if (!ps) continue;
    for (const hero of (ps.heroes || [])) {
      if (!hero) continue;
      for (const b of Object.values(hero.buffs || {})) stempel(b);
      for (const s of Object.values(hero.statuses || {})) { stempel(s); if (s && typeof s === 'object') stempel(s._fremd); }
      // Nasty Prank (24.10.): jeder gesperrte Name trägt seine eigene Frist (`statuses.pranked.names[Name]`, ENDE des nächsten gegnerischen Zuges).
      for (const e of Object.values(hero.statuses?.pranked?.names || {})) stempel(e);
      for (const g of (hero._tempAtkGrants || [])) stempel(g);
      // Perfect Disguise: „cannot be chosen by your opponent during their next turn" (Ablauf ereignisgebunden zu Beginn des nächsten eigenen Zuges des Wirkers,
      // `processStatusExpiry('START')`: dort bleibt der Schutz, wenn der Gegnerzug davor übersprungen war). Wird der EIGENE Zug übersprungen, läuft dieser Beginn
      // nie: der Schutz endet jetzt, sofern der gezählte Gegnerzug davor ein echter war.
      if (S === pi && hero.statuses?.untargetable?.gegnerZug && istEchterZug(engine, Ts - 1)) { delete hero.statuses.untargetable; n++; }
      // Spott-Stempel am Helden (Puzzle-Editor): wie an der Kreatur.
      forcesTargeting(hero);
      // Zielregeln einer Karte, die nicht mehr auf dem Brett liegt (Stealthy Pursuit: „until the end of your next turn"; Dive Down: dieser Zug).
      for (const b of (hero._targetBlockers || [])) wert(b, 'untilTurn');
    }
    // MOE Shield: „you cannot draw cards until the end of your next turn" — `drawLockedUntilTurn` = Zug, an dessen ENDE die Sperre fällt.
    wert(ps, 'drawLockedUntilTurn');
    // Perilous Journey: „During your next turn, you may Ascend …" — Fenster = GENAU dieser Zug.
    for (const g of Object.values(ps._handAscensionGrants || {})) wert(g, 'turn');
  }
  for (const f of (gs._amzFenster || [])) stempel(f);   // Anti Magic Zone: Fenster neu beschworener Helden (gleiche Frist wie der Status)

  /** Spott einer Kreatur/eines Helden: `forcesTargeting_untilTurn` = letzter Zug, in dem er gilt (Hardy Slime: bis zum BEGINN des nächsten eigenen Zuges). */
  function forcesTargeting(obj) {
    if (!obj || typeof obj.forcesTargeting_untilTurn !== 'number') return;
    const c = obj.forcesTargeting_fristBeginn ? obj.forcesTargeting_untilTurn + 1 : obj.forcesTargeting_untilTurn;
    if (betrifft(c)) { obj.forcesTargeting_untilTurn += 2; n++; }
  }

  for (const inst of engine.cardInstances) {
    const c = inst?.counters;
    if (!c) continue;
    for (const b of Object.values(c.buffs || {})) stempel(b);
    forcesTargeting(c);
    if (c.softUntargetable_gegnerZug && c.softUntargetable_by_opponent && inst.owner === S && istEchterZug(engine, Ts - 1)) {   // Perfect Disguise (Kreatur), s. oben
      delete c.softUntargetable_by_opponent; delete c.softUntargetable_by_opponent_pi; delete c.softUntargetable_gegnerZug; n++;
    }
    // Geliehene Identitäten (Throne Robber, Open Invitation, ???, the Shapeshifter, Future Tech): `_identityExpiresTurn` = Zug, an dessen ENDE sie enden.
    wert(c, '_identityExpiresTurn');
    // Anti Magic Zone: Fenster an der Ablage-Instanz (Kreaturen, die später auf das Brett kommen).
    if (typeof c._amzExpiresAtTurn === 'number' && typeof c._amzExpiresForPlayer === 'number') {
      const s = { expiresAtTurn: c._amzExpiresAtTurn, expiresForPlayer: c._amzExpiresForPlayer };
      stempel(s);
      c._amzExpiresAtTurn = s.expiresAtTurn;
    }
    // Resilient Monkee: „Any damage … until the start of your next turn is negated" — gilt, solange gs.turn < Stempel (= Beginn des Zuges `Stempel`).
    wert(c, '_monkeeShieldUntilTurn');
  }

  // Barrier of Undying: „At the end of its owner's next turn … delete it" — Auftrag mit Zugnummer.
  for (const e of (gs._zugendeLoeschungen || [])) if (e && e.instId != null) wert(e, 'amZug');

  return n;
}

// ═══════════════════════════════════════════════════════════════════════════
//  W69a — „NUR ECHTE ZÜGE ZÄHLEN" auch bei ORDNUNGS- und FOLGE-ZÄHLERN  (Al, 23.10.2026)
//
//  a) Ordnungszähler „your Nth turn" (Cheat Chair „before the end of your third turn", Willy „your first/second turn"): „Nein, sie sollen nur 'echte'
//     eigene Züge zählen!" — der dritte Zug ist der dritte TATSÄCHLICH gespielte eigene Zug.
//  b) „2 consecutive turns" / „every other turn" (Thicket, Jump in the River, Blade of the Frostbringer, Hammer Throw): „Und auch das soll 'echte'
//     eigene Züge zählen!" — ein übersprungener Zug hebt die Sperre nicht auf und verschiebt den Takt nicht.
//
//  Ein Zähler/eine Sperre rechnet NIE selbst mit Zugnummern („turn − 2", „turn % 2", „zugIndexVon"), sondern fragt diese Hilfen (alle für Zwei-Spieler-Partien;
//  strenger Wechsel, der Startspieler hat die ungeraden Nummern — wie `zugBesitzer`). Übersprungene Zugnummern stehen in `gs._uebersprungeneZuege`; zusätzlich
//  gilt der NÄCHSTE eigene Zug eines Spielers mit ausstehender Skip-Marke (`_skipNextTurn`) schon jetzt als ausgefallen (Cheat Chair im Zug davor).
//  Skill Test und Partien mit mehr als zwei Sitzen: Rückfall auf die alte Rechnung ohne Skip-Wissen (dort gibt es keinen Skip).
//
//    echteEigeneZuegeBis(pi, turn = gs.turn, ab = 1)   Anzahl der echten Züge von pi mit Nummer ab..turn (der laufende, echte Zug zählt mit)
//    echterEigenerZugIndex(pi, turn = gs.turn, ab = 1) „Der wievielte echte eigene Zug ist `turn`?" (1 = der erste); null, wenn `turn` kein echter Zug von pi ist
//    echterEigenerZugNr(pi, k, ab = 1)                 Zugnummer des k-ten echten eigenen Zuges von pi (für „before the end of your k-th turn": gs.turn ≤ Nr)
//    vorigerEchterEigenerZug(pi, turn = gs.turn)       Nummer des letzten echten Zuges von pi VOR `turn` (null, wenn es keinen gab)
//    istFolgezug(pi, letzteNr, turn = gs.turn)         „Folgezug": zwischen `letzteNr` (Zugnummer der letzten Verwendung) und `turn` liegt KEIN echter Zug von pi.
//                                                      Zählende Spieler `pi` ist der, dessen Züge die Karte meint (Thicket: der Wirker; Jump in the River/Blade:
//                                                      der Zugspieler; Hammer Throw: der Betroffene).
// ═══════════════════════════════════════════════════════════════════════════

/** Zwei-Spieler-Partie mit strengem Wechsel? (Skill Test zählt Runden, nicht Spielerzüge.) */
function zweiSpieler(engine) {
  const gs = engine.gs;
  return !!gs && !gs.skillTest && engine.playerCount() === 2;
}

/** Fällt der Zug `n` aus (übersprungen oder ausstehend übersprungen)? Gilt nur für Zugnummern ≥ 1. */
function zugFaelltAus(engine, n) {
  const gs = engine.gs;
  if (!istEchterZug(engine, n)) return true;
  if (n > gs.turn) {
    // Ausstehende Skip-Marke: trifft den ersten Zug des Besitzers nach dem laufenden.
    const o = zugBesitzer(engine, n);
    if (gs.players[o]?._skipNextTurn) {
      const erster = zugBesitzer(engine, gs.turn + 1) === o ? gs.turn + 1 : gs.turn + 2;
      return n === erster;
    }
  }
  return false;
}

/** Aufsteigende Liste der echten Zugnummern von `pi` im Bereich ab..bis (strenger Wechsel). */
function echteZuegeVon(engine, pi, bis, ab = 1) {
  const l = [];
  const start = Math.max(1, ab);
  // erste Nummer ≥ start, die pi gehört
  let n = start;
  if (zugBesitzer(engine, n) !== pi) n++;
  for (; n <= bis; n += 2) if (!zugFaelltAus(engine, n)) l.push(n);
  return l;
}

function echteEigeneZuegeBis(engine, pi, turn, ab = 1) {
  const t = turn ?? engine.gs.turn ?? 1;
  if (!zweiSpieler(engine)) return Math.floor((t - ab) / Math.max(1, engine.playerCount())) + 1;
  return echteZuegeVon(engine, pi, t, ab).length;
}

function echterEigenerZugIndex(engine, pi, turn, ab = 1) {
  const t = turn ?? engine.gs.turn ?? 1;
  if (!zweiSpieler(engine)) return Math.floor((t - ab) / Math.max(1, engine.playerCount())) + 1;
  if (t < ab || zugBesitzer(engine, t) !== pi || zugFaelltAus(engine, t)) return null;
  return echteZuegeVon(engine, pi, t, ab).length;
}

function echterEigenerZugNr(engine, pi, k, ab = 1) {
  if (!zweiSpieler(engine)) {   // alte Rechnung (ohne Skip-Wissen)
    const gs = engine.gs, t = gs.turn || 1;
    const starter = (t % 2 === 1) ? gs.activePlayer : engine.opponentOf(gs.activePlayer);
    return starter === pi ? 2 * k - 1 : 2 * k;
  }
  let n = Math.max(1, ab);
  if (zugBesitzer(engine, n) !== pi) n++;
  for (let gefunden = 0; n < 100000; n += 2) {
    if (zugFaelltAus(engine, n)) continue;
    if (++gefunden >= k) return n;
  }
  return Infinity;
}

function vorigerEchterEigenerZug(engine, pi, turn) {
  const t = turn ?? engine.gs.turn ?? 1;
  if (!zweiSpieler(engine)) return engine.letzterEigenerZug(pi);
  const l = echteZuegeVon(engine, pi, t - 1);
  return l.length ? l[l.length - 1] : null;
}

function istFolgezug(engine, pi, letzteNr, turn) {
  if (letzteNr == null || !Number.isFinite(letzteNr)) return false;
  const t = turn ?? engine.gs.turn ?? 1;
  const vor = vorigerEchterEigenerZug(engine, pi, t);
  return letzteNr >= (vor ?? 0);
}

module.exports = {
  zugBesitzer, istEchterZug, fristenNachSkip,
  zugFaelltAus, echteEigeneZuegeBis, echterEigenerZugIndex, echterEigenerZugNr, vorigerEchterEigenerZug, istFolgezug,
};
