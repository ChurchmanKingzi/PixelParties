'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: „Cheat Chair"
//  Artifact · Reaction · Cost 0 · PP MBS1   (v1340, Kosten 0 seit v1341)
//
//  „Play this card immediately when your last Hero is defeated by an
//   opponent's card or effect before the end of your third turn. Revive
//   that Hero and heal its HP completely. Additionally, any damage that
//   Hero would take for the rest of the turn becomes 0."
//
//  ── FENSTER (neu in v1340) ────────────────────────────────────────
//  `isHeroDefeatedReaction` — die Engine oeffnet es im Besiegen-Ablauf
//  NACH Aufraeumen, Extra Life und Surprise-Rettung, aber VOR der
//  Spielende-Pruefung. Artefakt: kein Wirker noetig (es lebt ja auch
//  keiner mehr); Kosten 0.
//
//  ── BEDINGUNGEN ───────────────────────────────────────────────────
//  • „your last Hero" — nach diesem Tod lebt kein Held mehr, den der
//    Spieler dauerhaft kontrolliert (`info.letzterHeld`).
//  • „by an opponent's card or effect" — Verursacher ist der Gegner.
//  • „before the end of your third turn" — gs.turn ≤ Nummer des dritten
//    EIGENEN Zuges (`engine.zugIndexVon(pi, 3)`): im eigenen dritten
//    Zug noch ja, im Gegnerzug danach nicht mehr.
//
//  ── WIRKUNG ───────────────────────────────────────────────────────
//  • Wiederbelebung mit vollen HP (`actionReviveHero`, max HP) — mit der
//    goldenen Aura als Auftritt (`super_aura`, Als Vorgabe 24.9.: „wie
//    bei einem Super-Saiyajin").
//  • „any damage … for the rest of the turn becomes 0": eigener Status
//    `cheat_chair_guard` mit eigenem Abzeichen (v1341, Als Vorgabe) —
//    `blocksDamage` (derselbe Schadenspfad wie Storm Pianos
//    `damage_proof`) und `endsAtTurnEnd`: er endet am Ende GENAU dieses
//    Zuges, egal wessen Zug es ist.
//    Wie bei Storm Piano gilt er fuer normalen Schaden; Schaden, der
//    „cannot be reduced or negated" ist (True Damage), trifft weiter —
//    anders als bei Carris steht die Ausnahme hier nicht im Text.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cheat Chair';
const LETZTER_ZUG = 3;

module.exports = {
  activeIn: ['hand'],
  // KEIN `isReaction` — sonst meldet sie sich im generischen Kettenfenster.
  isHeroDefeatedReaction: true,

  heroDefeatedCondition(gs, pi, engine, info) {
    if (!info?.letzterHeld) return false;
    if (info.sourceOwner == null || info.sourceOwner === pi) return false;
    return (gs.turn || 1) <= engine.zugIndexVon(pi, LETZTER_ZUG);
  },

  async heroDefeatedResolve(engine, pi, info) {
    const gs = engine.gs;
    const held = gs.players[pi]?.heroes?.[info.heroIdx];
    if (!held?.name || held !== info.hero || held.hp > 0) return false;

    const maxHp = held.maxHp || 400;
    const ok = await engine.actionReviveHero(pi, info.heroIdx, maxHp, {
      // v1341: `animDuration` — ohne Angabe lebt eine Zonen-Animation im
      // Client nur 1000 ms; die Aura braucht 2,2 s.
      source: CARD_NAME, animationType: 'super_aura', animDuration: 2200, animDelay: 1500,
    });
    if (!ok || held.hp <= 0) return false;

    await engine.addHeroStatus(pi, info.heroIdx, 'cheat_chair_guard', {
      armedTurn: gs.turn, source: CARD_NAME, appliedBy: pi,
    });
    engine.log('cheat_chair', { player: gs.players[pi]?.username, hero: held.name, hp: held.hp });
    engine.sync();
    return true;
  },

  // CPU: immer — es geht ums Spiel.
  cpuResponse(engine, kind, payload) {
    if (payload?.type === 'confirm' && payload?.title === CARD_NAME) return { confirmed: true };
    return undefined;
  },
};
