// ═══════════════════════════════════════════
//  CARD EFFECT: "Hardy Slime"
//  Creature (Summoning Magic Lv0, Slimes) — 30 HP.
//
//  When you summon this Creature, your opponent
//  has to choose it with all Attacks and Spells
//  they use until your next turn, if possible.
//  You can only activate this effect once per
//  turn. At the beginning of each of your turns,
//  you may increase this Creature's level on
//  your side of the board by 1.
//
//  Wiring: stamps the engine's generic
//  forcesTargeting counters on its instance —
//  same mechanism Deepsea Horror Clown uses,
//  honored by `_applyForcesTargetingFilter` in
//  the engine. The taunt expires at the end of
//  the opponent's next turn (`untilTurn = turn
//  + 1` is enough; the engine check is
//  `gs.turn > untilTurn`).
//
//  Hard once-per-turn so a re-summoned Hardy
//  via Reincarnation / Necromancy etc. can't
//  re-stamp the taunt the same turn.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;

      const inst = ctx.card;
      inst.counters = inst.counters || {};
      inst.counters.forcesTargeting = true;
      inst.counters.forcesTargeting_pi = oppIdx;
      inst.counters.forcesTargeting_untilTurn = (gs.turn || 0) + 1;
      // Mirror as a buff entry so BuffColumn renders the standard 🎯
      // taunt icon (no bespoke overlay needed).
      if (!inst.counters.buffs) inst.counters.buffs = {};
      inst.counters.buffs.forcesTargeting = true;

      engine._broadcastEvent('play_zone_animation', {
        type: 'pollution_place', owner: pi,
        heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
      });
      engine.log('hardy_slime_taunt', {
        player: gs.players[pi]?.username,
        untilTurn: inst.counters.forcesTargeting_untilTurn,
      });
      engine.sync();
    },

    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      await ctx.changeLevel(1);
    },
  },
};
