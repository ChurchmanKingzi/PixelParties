'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "REVENGE!!!"  (W77a)
//  Attack (Reaction, Lv2, Fighting)
//
//  „Play this card immediately when your second target is defeated by an opponent's card or effect during your opponent's turn. Immediately end your opponent's turn."
//
//  ── FENSTER: `isTargetsDefeatedReaction` (neu, 25.10.) ──────────────────
//  Hand-Fenster am Ende jedes Sterbe-Vorgangs (`engine._liefereNiederlagen` → `_checkTargetsDefeatedHandReactions`): ein Flächenschlag ist EIN Vorgang, Helden und Kreaturen zusammen.
//  Die Engine führt je Spieler und Zug den Zähler der verlorenen ZIELE (`ps._zieleBesiegt`; Helden, Kreaturen und Tokens, gleich durch wen sie fielen) und liefert im `info` den Stand
//  vor und nach dem Vorgang (`info.zaehler[pi] = { vorher, nachher, opfer }`).
//  • „your SECOND target": der Zähler überschreitet in diesem Vorgang die 2 — `vorher ≤ 1` und `nachher ≥ 2`. Fällt das zweite Ziel zeitgleich mit weiteren (Flächenschlag: erstes + zweites,
//    zweites + drittes + viertes …), gilt es trotzdem; ein späteres (drittes, viertes …) Ziel allein öffnet das Fenster NIE.
//  • „by an opponent's card or effect": mindestens ein Opfer dieses Vorgangs fiel durch eine Karte/einen Effekt eines GEGNERS (nicht durch eigene Effekte, Statusschaden ohne Quelle usw.).
//  • „during your opponent's turn": der Zug gehört nicht dem Reagierenden.
//
//  ── WIRKUNG ─────────────────────────────────────────────────────────────
//  „Immediately end your opponent's turn": derselbe Weg wie Doom Prophecy/Terror (`gs._terrorForceEndTurn`): der Server wartet, bis Prompts, Effekte und die LAUFENDE KETTE zu Ende sind (alles, was
//  schon läuft, löst also noch vollständig auf), und fährt dann die End Phase des Gegners. Blackstache (`_blackstacheBlocksTurnEnd`) und Verwandte schützen den Gegner wie bei Flashbang.
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  `revenge_rage` (Client, Pixelart, ~2 s) auf dem wirkenden Helden: rote Dither-Blitze über den ganzen Bildschirm, Wutlinien, Flammen, 💢-Zeichen, „!!!", dazu `play_screen_shake` (heavy).
// ═══════════════════════════════════════════

const CARD_NAME = 'REVENGE!!!';
const RAGE_MS = 1900;

function ausGegnerHand(engine, e, pi) {
  const q = e?.source;
  const so = q?.controller ?? q?.owner;
  return Number.isInteger(so) && so >= 0 && so !== pi && !!engine.gs.players[so];
}

module.exports = {
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  isTargetsDefeatedReaction: true,

  targetsDefeatedCondition(gs, pi, engine, info) {
    const z = info?.zaehler?.[pi];
    if (!z) return false;
    if (gs.activePlayer === pi || !Number.isInteger(gs.activePlayer)) return false;       // nur im Zug des Gegners
    if (!(z.vorher <= 1 && z.nachher >= 2)) return false;                                  // genau der Vorgang, der das ZWEITE Ziel enthält
    return z.opfer.some(e => ausGegnerHand(engine, e, pi));
  },

  async targetsDefeatedResolve(engine, pi, info, { casterIdx, casterSeite }) {
    const gs = engine.gs;
    const opp = gs.activePlayer;
    if (!Number.isInteger(opp) || opp === pi) return;
    // Der Wutausbruch auf dem wirkenden Helden (Brettseite des Helden, nicht zwingend `pi`).
    const seite = casterSeite ?? pi;
    engine._broadcastEvent('play_zone_animation', { type: 'revenge_rage', owner: seite, heroIdx: casterIdx, zoneSlot: -1, duration: RAGE_MS });
    engine._broadcastEvent('play_screen_shake', { intensity: 'heavy' });
    await engine._delay(RAGE_MS);
    if (engine._blackstacheBlocksTurnEnd(opp, { name: CARD_NAME, owner: pi })) {
      engine.log('revenge_blocked', { player: gs.players[pi]?.username, target: gs.players[opp]?.username, reason: 'blackstache' });
      return;
    }
    gs._terrorForceEndTurn = opp;
    gs._terrorForceEndSource = { name: CARD_NAME, owner: pi };
    engine.log('revenge_end_turn', { player: gs.players[pi]?.username, target: gs.players[opp]?.username });
    engine.sync();
  },

  /** CPU: die Rache wird immer genommen. */
  cpuMeta: { reactionHeuristic: () => true },
};
