'use strict';
// W68a · Hilfsmodul „nur ECHTE Züge zählen" (Skip-Szenarien mit Zeitleiste).
//
// Aufbau einer Zeitleiste: Zug T0 gehört dem Wirker A (`seat`). Der Wirker wirkt seine Karte in T0, danach beendet er den Zug (`t.endTurn()` = echter Zugwechsel mit
// Zugbeginn des nächsten Spielers). Zug T0+i gehört B (`opp`), wenn i ungerade ist, sonst A. Ein Zug kann übersprungen werden (Guardian Beast Zhu / Hand-of-Death-
// Rider: `ps._skipNextTurn`), die Marke wird gesetzt, bevor der Zug davor endet.
//
//   const z = await Skip.lauf(t, seat, { skip: [1], schritte: 5, probe: () => bool })
//   z = { beob: [{ turn, aktiv, an: bool }], skip: [1], echteB: [..], echteA: [..] }  — beobachtet wird jeweils NACH dem Zugwechsel (Zugbeginn des nächsten echten Zuges).
//
// Modell (`soll`): drei Fristarten, gezählt wird immer der nächste TATSÄCHLICH gespielte betreffende Zug:
//   'E'  „until the end of your opponent's next turn" — aktiv, bis der erste echte Gegnerzug (B) nach T0 zu Ende ist
//   'E2' "for 2 turns" auf dem Gegner - aktiv, bis der zweite echte Gegnerzug nach T0 zu Ende ist
//   'N'  „until the end of your next turn"            — aktiv, bis der erste echte eigene Zug (A) nach T0 zu Ende ist
//   'B'  „until the beginning of your next turn"      — aktiv, bis der erste echte eigene Zug (A) nach T0 BEGINNT
//   'ZA' | 'ZB' | 'ZALL'  Zaehler 'at the end of each of your / your opponent's / each turn': Zahl der bis zur Beobachtung TATSAECHLICH beendeten Zuege von A / B / beiden
//   'W'  "During your next turn" - Fenster ist genau der erste echte eigene Zug (A) nach T0
//   'D'  „this turn" / „for the rest of the turn"      — beim ersten Zugwechsel weg (Wirker-Zug T0 endet), egal ob der Gegner übersprungen wird
const H = require('./h.js');

/** Skip-Marken der unmittelbar auf Zug T0 folgenden übersprungenen Züge (1, 2, … lückenlos) setzen — nötig VOR dem Wirken, wenn die Karte den eigenen Zug selbst beendet. */
function vormarken(t, seat, skip) {
  const opp = 1 - seat, s = new Set(skip || []);
  for (let j = 1; s.has(j); j++) t.gs.players[j % 2 === 1 ? opp : seat]._skipNextTurn = true;
}

/**
 * Zeitleiste fahren. `skip`: Liste der Indizes i (Zug T0+i wird übersprungen). `schonBeendet`: die Karte hat den Zug des Wirkers selbst beendet
 * (Open Invitation) — `T0` ist dann die Zugnummer VOR dem Wirken und die Marken für die ersten Züge sind schon gesetzt (`vormarken`).
 */
async function lauf(t, seat, o = {}) {
  const opp = 1 - seat;
  const T0 = o.T0 ?? t.gs.turn;
  const skip = new Set(o.skip || []);
  const beob = [];
  const probe = o.probe;
  const eigner = (i) => (i % 2 === 1 ? opp : seat);
  let i = t.gs.turn - T0;   // Index des laufenden (echten) Zuges
  if (o.schonBeendet) beob.push({ turn: t.gs.turn, aktiv: t.gs.activePlayer, an: probe ? Number(await probe(t, i)) : null });
  const maxSchritte = (o.schritte ?? 5) - (o.schonBeendet ? 1 : 0);
  for (let k = 0; k < maxSchritte; k++) {
    // Marken für die direkt folgenden übersprungenen Züge
    let j = i + 1;
    while (skip.has(j)) { t.gs.players[eigner(j)]._skipNextTurn = true; j++; }
    const turnVorher = t.gs.turn;
    await t.endTurn();
    if (t.gs.result) { beob.push({ turn: t.gs.turn, aktiv: t.gs.activePlayer, an: null, beendet: true }); break; }   // Spielende (z. B. Carris: 3. Time Counter)
    if (t.gs.turn === turnVorher) { beob.push({ turn: t.gs.turn, aktiv: t.gs.activePlayer, an: null, haengt: true }); break; }
    i = t.gs.turn - T0;
    beob.push({ turn: t.gs.turn, aktiv: t.gs.activePlayer, an: probe ? Number(await probe(t, i)) : null });
    if (o.nachBeob) await o.nachBeob(t, i, beob[beob.length - 1]);
  }
  const echt = (pred) => { const l = []; for (let n = 1; n <= 12; n++) if (!skip.has(n) && pred(n)) l.push(n); return l; };
  return { beob, T0, skip: [...skip], echteB: echt(n => n % 2 === 1), echteA: echt(n => n % 2 === 0) };
}

/** Sollwert (0/1 bzw. Zaehlerstand) der Frist `art` zu Beginn des beobachteten Zuges mit Nummer `turn`. */
function soll(art, z, turn) {
  const i = turn - z.T0;
  const fB = z.echteB[0], fA = z.echteA[0];
  if (art === 'E') return Number(i <= fB);
  if (art === 'E2') return Number(i <= z.echteB[1]);   // "for 2 turns" des Gegners: bis zum Ende des ZWEITEN echten Gegnerzuges
  if (art === 'N') return Number(i <= fA);
  if (art === 'B') return Number(i < fA);
  if (art === 'D') return 0;
  if (art === 'W') return Number(i === fA);   // Fenster = GENAU der erste echte eigene Zug (Perilous Journey: "During your next turn")
  // Zaehler "At the end of each of ... turns": Zahl der bis hierher TATSAECHLICH beendeten Zuege (T0 zaehlt mit, es endet vor der ersten Beobachtung)
  const eA = 1 + z.echteA.filter(n => z.T0 + n < turn).length, eB = z.echteB.filter(n => z.T0 + n < turn).length;
  if (art === 'ZA') return eA;
  if (art === 'ZB') return eB;
  if (art === 'ZALL') return eA + eB;
  throw new Error('Fristart ' + art);
}

/** Vergleicht die Beobachtung mit dem Modell; gibt { ok, soll, ist } zurueck. */
function pruefe(art, z) {
  const s = z.beob.map(b => soll(art, z, b.turn));
  const ok = z.beob.every((b, k) => b.beendet || (!b.haengt && b.an === s[k]));
  return { ok, ende: z.beob.some(b => b.beendet), ist: z.beob.map(b => `${b.turn}${b.aktiv === 0 ? 'a' : 'b'}:${b.beendet ? 'ENDE' : b.an}`).join(' '), soll: z.beob.map((b, k) => `${b.turn}:${s[k]}`).join(' ') };
}

/** Standard-Szenarien (Zeitleisten): [Name, skip-Liste]. */
const SZENARIEN = [
  ['ohne Skip (Kontrolle)', []],
  ['Gegnerzug 1 übersprungen', [1]],
  ['Gegnerzug 1 und 3 übersprungen (zweimal)', [1, 3]],
  ['eigener Zug 2 übersprungen', [2]],
  ['eigener Zug 2 und 4 übersprungen (zweimal)', [2, 4]],
  ['Gegnerzug 1 UND eigener Zug 2 übersprungen', [1, 2]],
];

module.exports = { lauf, vormarken, soll, pruefe, SZENARIEN, H };
