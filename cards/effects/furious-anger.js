'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: „Furious Anger"
//  Spell · Reaction · Magic Arts + Support Magic Lv1 · PP SOD   (v1336)
//  (Doppelschule alphabetisch, Als Regel 11.8.: Magic Arts zuerst.)
//
//  „Immediately play this card when a Surprise or Creature you control
//   is sent to the discard pile by an opponent's card or effect (but not
//   by taking damage). Choose any level 2 or lower Spell the user can
//   use from your hand and immediately have the user use that Spell as
//   an additional Action."
//
//  ── FENSTER (neu in v1336) ────────────────────────────────────────
//  `isBoardSentToDiscardReaction` — die Engine oeffnet es in
//  `_fireBoardSentToDiscard`, also genau dort, wo ein EFFEKT eine Karte
//  vom Brett in die Ablage schickt (Zerstoeren, Besiegen ohne Schaden,
//  Entfernen von Surprises). Schadenstode laufen dort nie durch — „but
//  not by taking damage" erfuellt sich von selbst. Tokens gehen in den
//  Loeschstapel, nicht in die Ablage, und loesen nichts aus.
//
//  ── BEDINGUNGEN ───────────────────────────────────────────────────
//  • die Karte kam aus einer Surprise Zone (jede Karte dort IST eine
//    Surprise) oder war eine Creature in einer Support Zone;
//  • der Verursacher ist der GEGNER (unbekannter Verursacher → nein);
//  • WIRKER („the user") ist nur ein Held, der danach auch einen Spell
//    Level ≤ 2 aus der Hand wirken kann (`reactionCasterAllowed`) —
//    sonst waere die Karte ein Leerlauf und wird nicht angeboten.
//
//  ── WIRKUNG ───────────────────────────────────────────────────────
//  Wutausbruch am Wirker (`furious_anger`, neue Animation mit Klang —
//  Kartenbild: das Manga-Wutzeichen mit „!!", das Feuer ist Stimmung),
//  dann `performImmediateAction` mit Filter „Spell, Level ≤ 2" — als
//  Zusatzaktion, genau dieser Held. Die Wahl darf abgebrochen werden
//  (dann verpufft Furious Anger; sie ist gespielt).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Furious Anger';
const MAX_LEVEL = 2;

/** Spell mit Level ≤ 2 (wirksames Level fuer diesen Spieler)? */
function passenderSpell(engine, pi, name) {
  if (!name || name === CARD_NAME) return false;
  const cd = engine._getCardDB()[name];
  if (!cd || !hasCardType(cd, 'Spell')) return false;
  const lvl = engine.effectiveCardLevel?.(cd, pi) ?? cd.level ?? 0;
  return (lvl ?? 0) <= MAX_LEVEL;
}

/** Kann dieser Held danach einen passenden Spell aus der Hand wirken? */
function folgeSpells(engine, pi, heroIdx) {
  const cardDB = engine._getCardDB();
  return engine.getHeroEligibleActionCards(pi, heroIdx)
    .filter(n => cardDB[n]?.cardType === 'Spell' && passenderSpell(engine, pi, n));
}

module.exports = {
  activeIn: ['hand'],
  // KEIN `isReaction` — sonst meldet sie sich im generischen Kettenfenster.
  isBoardSentToDiscardReaction: true,

  // ★★ ENTKOPPELTE BILDER (CARD_API).
  spellVisual: { impact: { type: 'furious_anger' }, impactMs: 500 },

  boardSentToDiscardCondition(gs, pi, engine, info) {
    if (!info || info.ownerIdx !== pi) return false;
    if (info.sourceOwner == null || info.sourceOwner === pi) return false;
    if (info.fromZone === 'surprise') return true;
    if (info.fromZone !== 'support') return false;
    return !!info.cardData && hasCardType(info.cardData, 'Creature');
  },

  /** Nur Wirker, die danach auch wirklich einen Spell ≤ 2 wirken koennen. */
  reactionCasterAllowed(gs, pi, heroIdx, engine) {
    return folgeSpells(engine, pi, heroIdx).length > 0;
  },

  async boardSentToDiscardResolve(engine, pi, info, { casterIdx } = {}) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const held = ps?.heroes?.[casterIdx];
    if (!held?.name || held.hp <= 0) return;

    engine._broadcastEvent('play_zone_animation', {
      type: 'furious_anger', owner: pi, heroIdx: casterIdx, zoneSlot: -1,
      duration: 1350,   // v1341: ohne Angabe schneidet der Client nach 1000 ms ab
    });
    await engine._delay(650);

    const erg = await engine.performImmediateAction(pi, casterIdx, {
      title: CARD_NAME,
      description: `${held.name} is furious! Use a level ${MAX_LEVEL} or lower Spell from your hand as an additional Action.`,
      allowedCardTypes: ['Spell'],
      cardNameFilter: (name) => passenderSpell(engine, pi, name),
      skipAbilities: true,
      skipHeroEffects: true,
      cancellable: true,
    });
    engine.log('furious_anger', {
      player: ps.username, hero: held.name, lost: info.cardName,
      spell: erg?.played ? (erg.cardName || null) : null,
    });
    engine.sync();
  },

  // CPU: immer spielen — der Folge-Spell ist gratis.
  cpuResponse(engine, kind, payload) {
    if (payload?.type === 'confirm' && payload?.title === CARD_NAME) return { confirmed: true };
    return undefined;
  },
};
