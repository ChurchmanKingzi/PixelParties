'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Dream Dust"  (v1368) — Dream Landers
//  Spell (Reaction) — Magic Arts Lv1
//
//  "Play this card immediately when a Creature that has a Hero attached to
//   it is chosen by an opponent's card or effect. Negate that card/effect.
//   If the negated card/effect was your opponent's Action, they may
//   immediately perform an additional Action."
//
//  · Fenster: Post-Target-Hub (`isPostTargetReaction`). Mit
//    `postTargetKreaturWahl` (Engine v1368) sieht die Karte auch Kreaturen,
//    die ueber die allgemeine Zielwahl (`promptEffectTarget`) gewaehlt
//    wurden — Schaden, Zerstoeren, Diebstahl, alles. Die Schadens-Hubs
//    reichten Kreaturziele schon immer durch.
//  · „chosen": volle Flaechenwirkung (`_isAoeCheck`) waehlt niemanden.
//  · „your opponent's Action": die Quelle ist die Attack/der Spell, den
//    der Gegner gerade aus der Hand spielt, und er kostete eine Aktion
//    (keine Reaktion, kein `inherentAction`) — dieselbe Pruefung wie Lunar
//    Eclipse. Dann bekommt er NACH der ganzen Aufloesung eine Ersatz-
//    aktion (`performImmediateActionAnyHero`, ueberspringbar).
// ═══════════════════════════════════════════
const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');
const { istTraegerZiel } = require('./_dream-lander-shared');

const CARD_NAME = 'Dream Dust';

/** War die Quelle eine Aktion des Gegners? */
function warAktion(engine, quelle, gegner) {
  const name = quelle?.name || quelle?.cardName;
  if (!name) return false;
  const gps = engine.gs.players[gegner];
  if (gps?._resolvingCard?.name !== name) return false;   // nicht der gespielte Handzug
  const cd = engine._getCardDB()[name];
  if (!cd || !(hasCardType(cd, 'Attack') || hasCardType(cd, 'Spell') || hasCardType(cd, 'Creature'))) return false;
  if (String(cd.subtype || '').toLowerCase() === 'reaction') return false;
  const sc = loadCardEffect(name);
  const inherent = sc ? (typeof sc.inherentAction === 'function'
    ? sc.inherentAction(engine.gs, gegner, quelle?.heroIdx ?? -1, engine)
    : sc.inherentAction === true) : false;
  return !inherent;
}

module.exports = {
  isPostTargetReaction: true,
  postTargetKreaturWahl: true,
  spellVisual: { impact: { type: 'gold_sparkle' }, impactMs: 260 },

  postTargetCondition(gs, pi, engine, ziele, quelle) {
    const srcOwner = quelle?.controller ?? quelle?.owner ?? -1;
    if (srcOwner < 0 || srcOwner === pi) return false;           // „opponent's card or effect"
    if (quelle?._isAoeCheck || quelle?.cardInstance?._isAoeCheck) return false;   // „chosen"
    return (ziele || []).some(t => istTraegerZiel(engine, t, pi));
  },

  async postTargetResolve(engine, pi, ziele, quelle) {
    const gegner = pi === 0 ? 1 : 0;
    const traegerZiel = (ziele || []).find(t => istTraegerZiel(engine, t, pi));
    if (traegerZiel) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: traegerZiel.owner, heroIdx: traegerZiel.heroIdx, zoneSlot: traegerZiel.slotIdx,
      });
      await engine._delay(450);
    }
    const aktion = warAktion(engine, quelle, gegner);
    engine.log('dream_dust', { player: engine.gs.players[pi]?.username, card: CARD_NAME, negated: quelle?.name || '?' });
    if (aktion) {
      engine.queuePostChainAction(async () => {
        await engine.performImmediateActionAnyHero(gegner, {
          title: CARD_NAME,
          description: 'Your card was negated by Dream Dust. You may immediately perform an additional Action — or skip.',
          cancellable: true,
        });
        engine.sync();
      });
    }
    return { effectNegated: true };
  },

  _test: { warAktion },
};
