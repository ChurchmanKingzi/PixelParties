// ═══════════════════════════════════════════
//  CARD EFFECT: "Blood Moon under the Sea"
//  Artifact (Equipment, Cost 6)
//
//  When a Creature is placed into the equipped
//  Hero's OTHER Support Zones, its on-summon
//  effect triggers an additional time. Once
//  per turn.
//
//  "Placed" is read broadly here — every normal
//  Summon fires onPlay, every Deepsea bounce-
//  place fires onPlay, every Monster-in-a-Bottle
//  placement fires onPlay. We listen on
//  onCardEnterZone (support) for any Creature
//  entering a support zone on the equipped
//  Hero's other slots, and re-fire its onPlay.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { reTriggerOnSummon } = require('./_deepsea-shared');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Blood Moon under the Sea';

module.exports = {
  isEquip: true,
  activeIn: ['support'],

  hooks: {
    onCardEnterZone: async (ctx) => {
      const entering = ctx.enteringCard;
      if (!entering) return;
      if (ctx.toZone !== 'support') return;
      if (entering.id === ctx.card.id) return; // Skip self

      // Must be a Creature (not another Artifact / Token).
      const engine = ctx._engine;
      const cardDB = engine._getCardDB();
      const cd = cardDB[entering.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;
      if (cd.cardType === 'Token') return;

      // Must be placed on the equipped hero (same pi + same heroIdx), in
      // a DIFFERENT zoneSlot than the Blood Moon itself.
      const selfInst = ctx.card;
      if (entering.owner !== selfInst.owner) return;
      if (entering.heroIdx !== selfInst.heroIdx) return;
      if (entering.zoneSlot === selfInst.zoneSlot) return;

      // Skip re-triggering the re-trigger itself (avoid infinite loop).
      if (ctx._isBloodMoonRetrigger) return;

      // Hard once per turn, PER PLAYER — two copies of Blood Moon can't
      // both fire in a single turn. Keyed by owner so the gate is shared
      // across every Blood Moon this player controls.
      const gs = engine.gs;
      if (!gs.hoptUsed) gs.hoptUsed = {};
      const hoptKey = `blood_moon_under_the_sea:${selfInst.owner}`;
      if (gs.hoptUsed[hoptKey] === gs.turn) return;

      // Only re-trigger creatures that actually have an on-summon effect
      // — if the entering creature has no onPlay hook there's nothing to
      // re-fire, so Blood Moon shouldn't burn its once-per-turn slot.
      const enteringScript = loadCardEffect(entering.name);
      if (!enteringScript?.hooks?.onPlay) return;

      gs.hoptUsed[hoptKey] = gs.turn;

      // Blood-red moonlight pulse on BOTH the Blood Moon's slot and
      // the triggered creature — establishes the visual link between
      // the equipment and the creature whose effect is about to fire
      // a second time.
      engine._broadcastEvent('play_zone_animation', {
        type: 'blood_moon_pulse',
        owner: selfInst.owner, heroIdx: selfInst.heroIdx, zoneSlot: selfInst.zoneSlot,
      });
      engine._broadcastEvent('play_zone_animation', {
        type: 'blood_moon_pulse',
        owner: entering.owner, heroIdx: entering.heroIdx, zoneSlot: entering.zoneSlot,
      });
      await engine._delay(350);

      engine.log('blood_moon_retrigger', {
        trigger: CARD_NAME, target: entering.name,
      });
      await reTriggerOnSummon(engine, entering);
      engine.sync();
    },
  },
};
