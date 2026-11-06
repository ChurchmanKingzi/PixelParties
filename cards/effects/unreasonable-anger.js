'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Unreasonable Anger"  (W75a)
//  Spell (Reaction, Lv1, Destruction Magic + Support Magic)
//
//  „Play this Spell immediately when a Hero that can use this Spell is hit by an opponent's Attack, Spell or Creature effect. Until the end of your next turn, any damage the
//   user deals to single targets is increased by 100."
//
//  Bauform: Schwester von Test Flight (Reaktions-SPELL, der getroffene Held IST der Wirker) — Fenster `isPostTargetReaction` („is hit" = nach der Zielwahl, Einzelziel UND Fläche),
//  Wirker über `reactionCasterAllowed`. Unterschiede: nur die Quelle des GEGNERS, die Quelle darf eine Attack-/Spell-KARTE oder ein Creature-Effekt sein (auch ein als Attack/Spell
//  geltender Heldeneffekt), und es gibt keinen Schutz — der Treffer läuft normal durch, der Wirker bekommt den Buff `unreasonable_anger`.
//
//  ── DER BUFF ────────────────────────────────────────────────────────────
//  „any damage the user deals to single targets is increased by 100": Engine `_applyAngerBonusIfApplicable` (Heldenschaden und Kreaturen-Batch, Schwester von Elixir of Strength und
//  Frog Race Boat): jeder DIREKTE Schaden des Helden (Attack, Spell, Effekt) an genau einem Ziel +100; nicht Statusticks, nicht der Schaden einer Creature in seinen Zonen, nicht
//  ein Flächenschlag mit 2+ Zielen. Der Buff bleibt für die ganze Frist (kein Verbrauch).
//  „until the end of your next turn": läuft zu Beginn des ersten gegnerischen Zuges NACH dem nächsten eigenen Zug aus (Disruption-Ray-Auslegung). Gespielt im Zug des Gegners (der
//  Normalfall — der Gegner trifft den Helden): nächster eigener Zug = T+1, Ablauf zu Beginn von T+2; gespielt im eigenen Zug: T+2, Ablauf T+3.
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  `play_zone_animation` `unreasonable_steam` (Client: ANIM_REGISTRY, Pixelart): Dampf steigt cartoonhaft aus dem Helden auf (Wut).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Unreasonable Anger';
const ANIM_MS = 1300;

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

    // „until the end of your next turn" — siehe Kopf: Ablauf zu Beginn des gegnerischen Zuges nach dem nächsten eigenen.
    const opp = engine.opponentOf(pi);
    const expiresAtTurn = gs.activePlayer === pi ? gs.turn + 3 : gs.turn + 2;
    await engine.actionAddBuff(hero, seite, hi, 'unreasonable_anger', {
      sourceOwner: pi, source: CARD_NAME, expiresAtTurn, expiresForPlayer: opp,
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
