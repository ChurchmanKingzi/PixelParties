'use strict';
// ════════════════════════════════════════════════════════════════
//  GEGNER-INDEX — EINE Stelle für „wer ist der Gegner von pi?"
//
//  Bisher stand überall `pi === 0 ? 1 : 0` (≈ 500 Stellen). Das trägt
//  nur bis zwei Spieler. Der Skill Test (bis 8 Spieler) braucht eine
//  zentrale Auflösung; deshalb laufen alle Gegner-Fragen über diese
//  drei reinen Funktionen des Spielzustands `gs`:
//
//    opponentOfGs(gs, pi)   der EINE Gegner (z. B. Ziel von „target opponent")
//    opponentsOfGs(gs, pi)  ALLE Gegner (z. B. „each opponent")
//    playerCountGs(gs)      Anzahl der Spieler (statt der Literale 2 / [0, 1])
//
//  NORMALSPIEL (`gs.skillTest` falsch): bit-identisch zum alten Idiom,
//  es wird nicht einmal `gs.players.length` gelesen. Genau das sichert
//  der Regressionslauf `scripts/regress/compare.sh`.
//
//  SKILL TEST (`gs.skillTest` gesetzt): der Gegner ist der Fokus des
//  Spielers (`gs.stFocus[pi]`), sonst der nächste Spieler (zyklisch),
//  der noch im Spiel ist (mindestens ein lebender Held).
//
//  Aufrufformen (erste passende nehmen):
//    in GameEngine-Methoden       this.opponentOf(pi)
//    in Kartenskripten            engine.opponentOf(pi)   (ctx._engine.opponentOf)
//    nur der Spielzustand da      opponentOfGs(gs, pi)    (require('./_opp'))
//  Nie wieder `pi === 0 ? 1 : 0` schreiben — scripts/check-n-player.js
//  schlägt sonst an.
// ════════════════════════════════════════════════════════════════

/** Lebt der Spieler noch? (mindestens ein benannter Held mit hp > 0) */
function imSpiel(ps) {
  return !!ps && (ps.heroes || []).some(h => h?.name && h.hp > 0);
}

/**
 * Der Gegner von `pi`. Normalspiel: exakt `pi === 0 ? 1 : 0`.
 * `gs` darf fehlen (kaputter/leerer Zustand) — dann gilt ebenfalls das
 * Zwei-Spieler-Verhalten, wie beim alten Idiom, das `gs` nie las.
 */
function opponentOfGs(gs, pi) {
  if (!gs || !gs.skillTest) return pi === 0 ? 1 : 0;
  const n = gs.players.length;
  if (!Number.isInteger(pi)) return 0;
  const fokus = gs.stFocus?.[pi];
  if (Number.isInteger(fokus) && fokus >= 0 && fokus < n && fokus !== pi) return fokus;
  for (let k = 1; k < n; k++) {
    const i = (pi + k) % n;
    if (imSpiel(gs.players[i])) return i;
  }
  return (pi + 1) % n;
}

/**
 * ALLE Gegner von `pi`. Normalspiel: `[pi === 0 ? 1 : 0]`,
 * Skill Test: jeder Index außer `pi`, aufsteigend.
 */
function opponentsOfGs(gs, pi) {
  if (!gs || !gs.skillTest) return [pi === 0 ? 1 : 0];
  const out = [];
  for (let i = 0; i < gs.players.length; i++) if (i !== pi) out.push(i);
  return out;
}

/**
 * Anzahl der Spieler. Fehlt `gs.players` (kaputter Zustand), gilt 2 —
 * so liefen die alten Schleifen `i < 2` auch ohne Spielzustand.
 */
function playerCountGs(gs) {
  return Array.isArray(gs?.players) ? gs.players.length : 2;
}

/**
 * Ein Ereignis an die Gegner von `pi` senden (Kartenenthüllung, Flug-Animation …).
 * Normalspiel: nur der EINE Gegner — exakt das alte `io.to(oppSid).emit(...)`.
 * Skill Test: alle anderen Sitze (jeder soll die Karte sehen).
 */
function emitToOpponentsGs(gs, io, pi, event, payload) {
  for (const oi of (gs && gs.skillTest) ? opponentsOfGs(gs, pi) : [opponentOfGs(gs, pi)]) {
    const sid = gs.players[oi]?.socketId;
    if (sid) io.to(sid).emit(event, payload);
  }
}

module.exports = { opponentOfGs, opponentsOfGs, playerCountGs, emitToOpponentsGs };
