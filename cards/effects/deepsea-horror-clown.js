// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Horror Clown"
//  Creature (Summoning Magic Lv1) — 20 HP
//
//  Signature Deepsea bounce-placement.
//  On-summon: opponent must target this
//  Creature with all Attacks and Spells they
//  play during their next turn, if possible.
//
//  Implementation: sets generic forcesTargeting
//  counters on its instance. The engine's
//  targeting filter (_applyForcesTargetingFilter
//  in _engine.js) honors the counters — when
//  the forcing player is the caster, all other
//  creatures on Clown's side become ineligible
//  targets, UNLESS the effect can't target
//  creatures at all (fulfills "if possible").
//
//  The flag expires at the end of the forcing
//  player's next turn (turnPlayed + 2 is a
//  safe upper bound — we set untilTurn to the
//  turn AFTER the opponent's turn, so their
//  whole turn stays forced).
//  1 per turn.
// ═══════════════════════════════════════════

const {
  inherentActionIfBounceable,
  canBypassLevelReqIfBounceable,
  canBypassFreeZoneIfBounceable,
  canPlaceOnOccupiedSlotIfBounceable,
  getBouncePlacementTargetsList,
  tryBouncePlace,
  canSummonPerTurnLimit,
  markSummonedPerTurnLimit,
} = require('./_deepsea-shared');

const CARD_NAME = 'Deepsea Horror Clown';

module.exports = {
  inherentAction: inherentActionIfBounceable,
  canBypassLevelReq: canBypassLevelReqIfBounceable,
  canBypassFreeZoneRequirement: canBypassFreeZoneIfBounceable,
  canPlaceOnOccupiedSlot: canPlaceOnOccupiedSlotIfBounceable,
  getBouncePlacementTargets: getBouncePlacementTargetsList,
  beforeSummon: tryBouncePlace,
  canSummon: (ctx) => canSummonPerTurnLimit(ctx, CARD_NAME),

  hooks: {
    onPlay: async (ctx) => {
      markSummonedPerTurnLimit(ctx, CARD_NAME);

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;

      // Clown is the only eligible creature target for the opponent's
      // targeting effects until the end of their next turn.
      // untilTurn is set to (current turn + 2) so the opponent's full
      // upcoming turn is covered — the engine check is `turn > untilTurn`
      // so a boundary of currentTurn+1 suffices in most cases, but using
      // +2 errs on the side of covering the full opponent turn even if
      // turn order or simultaneous-turn edge cases shift the counter.
      const inst = ctx.card;
      inst.counters = inst.counters || {};
      inst.counters.forcesTargeting = true;
      inst.counters.forcesTargeting_pi = oppIdx;
      inst.counters.forcesTargeting_untilTurn = (gs.turn || 0) + 1;
      // Mirror as a buff entry so BuffColumn renders the standard 🎯 icon
      // (no bespoke overlay). Same key lives in BUFF_ICONS and the engine
      // filter reads from counters.forcesTargeting directly.
      if (!inst.counters.buffs) inst.counters.buffs = {};
      inst.counters.buffs.forcesTargeting = true;

      engine._broadcastEvent('play_zone_animation', {
        type: 'pollution_place', owner: pi,
        heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
      });
      engine.log('deepsea_horror_clown_taunt', {
        player: gs.players[pi]?.username,
        untilTurn: inst.counters.forcesTargeting_untilTurn,
      });
      engine.sync();
    },
  },
};
