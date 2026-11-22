'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Unreasonable Anger"  (W75a)
//  Spell (Reaction, Lv1, Destruction Magic + Support Magic)
//
//  „Play this Spell immediately when a Hero that can use this Spell is hit by an opponent's Attack, Spell or Creature effect. The next damage the user deals to a single target during
//   your next turn is increased by 100."  (Text geändert 10.11.; vorher: „Until the end of your next turn, any damage the user deals to single targets is increased by 100.")
//
//  Bauform: Schwester von Test Flight (Reaktions-SPELL, der getroffene Held IST der Wirker) — Fenster `isPostTargetReaction` („is hit" = nach der Zielwahl, Einzelziel UND Fläche),
//  Wirker über `reactionCasterAllowed`. Unterschiede: nur die Quelle des GEGNERS, die Quelle darf eine Attack-/Spell-KARTE oder ein Creature-Effekt sein (auch ein als Attack/Spell
//  geltender Heldeneffekt), und es gibt keinen Schutz — der Treffer läuft normal durch, der Wirker bekommt den Buff `unreasonable_anger`.
//
//  ── DER BUFF (EINE Instanz, nur im nächsten eigenen Zug) ───────────────
//  „The next damage the user deals to a single target during your next turn is increased by 100": Engine `_applyAngerBonusIfApplicable` (Heldenschaden und Kreaturen-Batch, Schwester von
//  Elixir of Strength und Frog Race Boat): der NÄCHSTE direkte Schaden des Helden (Attack, Spell, Effekt) an genau einem Ziel +100; nicht Statusticks, nicht der Schaden einer Creature in
//  seinen Zonen; ein Flächenschlag mit 2+ Zielen bekommt den Bonus nicht und verbraucht ihn auch nicht („to a single target"). Der Buff trägt `fenster: [{ runde, bonus }]`: `runde` = die Zug-
//  nummer des nächsten eigenen Zuges — Schaden davor (z. B. als Reaktion im Gegnerzug) bekommt nichts —, und der erste passende Treffer VERBRAUCHT den Eintrag (ein Bonus für eine Instanz).
//  Mehrere Kopien für denselben Zug summieren sich auf diesen einen nächsten Schaden (+100 je Kopie); Einträge für verschiedene Züge laufen getrennt.
//  „your next turn": gespielt im Zug des Gegners (der Normalfall — der Gegner trifft den Helden): nächster eigener Zug = T+1; gespielt im eigenen Zug: T+2. Unbenutzt läuft der Buff zu Beginn
//  des ersten gegnerischen Zuges NACH diesem Zug aus (Disruption-Ray-Auslegung): T+2 bzw. T+3.
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  `play_zone_animation` `unreasonable_steam` (Client: ANIM_REGISTRY, Pixelart): Dampf steigt cartoonhaft aus dem Helden auf (Wut).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Unreasonable Anger';
const ANIM_MS = 1300;
const BONUS = 100;   // = ANGER_BONUS der Engine (+100 je Kopie)

/** Zählt die Quelle als „Attack, Spell or Creature effect"? (Attack-/Spell-/Creature-Karte, Creature-Effekt, als Attack/Spell geltender Heldeneffekt.) */
function quelleZaehlt(engine, sourceCard, damageType) {
  if (!sourceCard) return false;
  if (damageType === 'creature') return true;
  if (engine._stempelStufe?.(sourceCard, damageType) != null) return true;   // „zählt als Attack/Spell" (Alice, Clash of Champions …)
  const cd = sourceCard.name ? engine._getCardDB()[sourceCard.name] : null;
  if (cd && (hasCardType(cd, 'Attack') || hasCardType(cd, 'Spell') || hasCardType(cd, 'Creature'))) return true;
  return engine._heldenEffektStufe?.(sourceCard.name, damageType, sourceCard) != null;
}

/** Quelle gehört dem GEGNER des Spielers `pi`? */
function quelleIstGegner(sourceCard, pi) {
  const so = sourceCard?.controller ?? sourceCard?.owner;
  return typeof so === 'number' && so >= 0 && so !== pi;
}

/** Darf der getroffene Held `hi` (Brettseite `seite`) die Karte wirken? */
function heldPasst(engine, pi, hi, seite = pi) {
  const hero = engine.gs.players[seite]?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0) return false;
  return seite === pi
    ? engine._canHeroActivateSurprise(pi, hi, CARD_NAME, { spellInHand: true })
    : engine._canHeroActivateSurprise(seite, hi, CARD_NAME, { spellInHand: true, reaktor: pi });
}

module.exports = {
  // Reaction-Karte: nie aktiv aus der Hand spielbar.
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  isPostTargetReaction: true,

  postTargetCondition(gs, pi, engine, targetedHeroes, sourceCard, opts) {
    if (!quelleIstGegner(sourceCard, pi) || !quelleZaehlt(engine, sourceCard, opts?.damageType)) return false;
    return (targetedHeroes || []).some(t => t.type === 'hero' && engine.zielSeite(t) === pi && heldPasst(engine, pi, t.heroIdx, t.owner));
  },

  /** Wirker: nur ein GETROFFENER eigener Held, der die Karte wirken kann. */
  reactionCasterAllowed(gs, pi, heroIdx, engine, info, seite = pi) {
    if (!info?.postTarget) return false;
    if (!quelleIstGegner(info.sourceCard, pi) || !quelleZaehlt(engine, info.sourceCard, info.damageType)) return false;
    const getroffen = (info.targetedHeroes || []).some(t => t.owner === seite && t.type === 'hero' && t.heroIdx === heroIdx && engine.zielSeite(t) === pi);
    return getroffen && heldPasst(engine, pi, heroIdx, seite);
  },

  async postTargetResolve(engine, pi, targetedHeroes, sourceCard, opts) {
    const gs = engine.gs;
    const hi = opts?.casterIdx;
    if (!Number.isInteger(hi)) return {};
    const seite = opts?.casterSeite ?? pi;
    const hero = gs.players[seite]?.heroes?.[hi];
    if (!hero?.name || hero.hp <= 0) return {};

    engine._broadcastEvent('play_zone_animation', { type: 'unreasonable_steam', owner: seite, heroIdx: hi, zoneSlot: -1, duration: ANIM_MS });
    await engine._delay(ANIM_MS * 0.45);

    // „your next turn" — siehe Kopf: die Zugnummer des nächsten eigenen Zuges ist das Zeitfenster des Bonus; unbenutzt läuft der Buff zu Beginn des gegnerischen Zuges danach aus.
    const opp = engine.opponentOf(pi);
    const runde = gs.activePlayer === pi ? gs.turn + 2 : gs.turn + 1;
    // Schon vorgemerkte, noch nicht verbrauchte Einträge bleiben (neuere Kopie für denselben Zug: +100 auf denselben nächsten Schaden; anderer Zug: eigener Eintrag).
    const alt = hero.buffs?.unreasonable_anger;
    const fenster = (Array.isArray(alt?.fenster) ? alt.fenster : []).filter(f => f && f.runde >= gs.turn).map(f => ({ ...f }));
    const gleich = fenster.find(f => f.runde === runde);
    if (gleich) gleich.bonus = (Number(gleich.bonus) || BONUS) + BONUS; else fenster.push({ runde, bonus: BONUS });
    const expiresAtTurn = Math.max(...fenster.map(f => f.runde)) + 1;
    await engine.actionAddBuff(hero, seite, hi, 'unreasonable_anger', {
      sourceOwner: pi, source: CARD_NAME, fenster, expiresAtTurn, expiresForPlayer: opp,
    });
    engine.log('unreasonable_anger', { player: gs.players[pi]?.username, hero: hero.name, trigger: sourceCard?.name || 'an effect' });
    engine.sync();
    return {};
  },

  /** CPU: nimmt jede Gelegenheit (die Karte kostet nur die Reaktion; mehr Schaden ist immer gut). */
  cpuMeta: {
    reactionHeuristic: () => true,
  },
};
