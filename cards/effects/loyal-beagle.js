// ═══════════════════════════════════════════
//  CARD EFFECT: "Loyal Beagle"
//  Creature (Summoning Magic Lv1) — 50 HP
//  Archetype: Loyals
//
//  When you summon this Creature: Gain Gold equal
//  to twice the number of "Loyal" Creatures you
//  control.
//
//  Beagle counts itself (it's a Loyal that just
//  entered the support zone), so a fresh solo
//  Beagle pays 2 Gold; landing Beagle next to two
//  other Loyals already on the board pays 6.
//  Pre-existing turns of stockpiled Loyals scale
//  the trigger linearly.
// ═══════════════════════════════════════════

const { countLoyalCreatures } = require('./_loyal-shared');

const CARD_NAME       = 'Loyal Beagle';
const GOLD_PER_LOYAL  = 2;

module.exports = {
  activeIn: ['support'],

  hooks: {
    /**
     * Fire the gold-gain when THIS Beagle lands in a Support Zone.
     * `playedCard` / `_onlyCard` filtering is handled by the engine's
     * `runHooks` call from `summonCreatureWithHooks`, so we still
     * defensively verify the entering instance matches us — that
     * avoids spurious double-fires if some future code path replays
     * onPlay against multiple listeners.
     */
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      if (ctx.playedCard?.id && ctx.playedCard.id !== ctx.card.id) return;

      const engine = ctx._engine;
      const pi     = ctx.cardOriginalOwner;
      const ps     = engine.gs.players[pi];
      if (!ps) return;

      const loyalCount = countLoyalCreatures(engine, pi);
      const goldGain   = GOLD_PER_LOYAL * loyalCount;
      if (goldGain <= 0) return;

      // Gold-shower sparkle on Beagle's slot — same anim Beagle's
      // earlier activated version used, so the sound + particles are
      // already in the FX registry.
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle',
        owner: ctx.cardOriginalOwner,
        heroIdx: ctx.cardHeroIdx,
        zoneSlot: ctx.card.zoneSlot,
      });
      await engine._delay(250);

      await engine.actionGainGold(pi, goldGain);
      engine.log('loyal_beagle_gold', {
        player: ps.username, loyalCount, gold: goldGain,
      });
      engine.sync();
    },
  },
};
