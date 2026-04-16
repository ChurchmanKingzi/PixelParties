// ═══════════════════════════════════════════
//  CARD EFFECT: "Steam Dwarf Miner"
//  Creature (Summoning Magic Lv1, archetype
//  "Steam Dwarfs") — 50 HP.
//
//  ① STEAM ENGINE passive (shared): once per
//    turn, when you discard 1+ cards, gain +50
//    current & max HP.
//  ② At the end of each of your turns, draw 1
//    card for every 100 max HP this Creature has.
// ═══════════════════════════════════════════

const { attachSteamEngine } = require('./_steam-dwarf-shared');

module.exports = attachSteamEngine({
  activeIn: ['support'],

  hooks: {
    /**
     * End of the controller's turn: draw floor(maxHp / 100) cards.
     * Skips on the turn the Miner was summoned (summoning sickness
     * style) — otherwise a 50 HP turn-zero summon still draws 0, but
     * for higher-HP revives we guard just in case.
     */
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      const pi = ctx.cardOwner;

      // Only fire on my turn end
      if (ctx.activePlayer !== pi) return;

      // Dead or stale instance?
      if (!inst || inst.zone !== 'support') return;
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;

      // Negated creatures do nothing
      if (inst.counters?.negated) return;

      const cd = engine._getCardDB()[inst.name];
      const maxHp = inst.counters?.maxHp ?? cd?.hp ?? 0;
      const count = Math.floor(maxHp / 100);
      if (count <= 0) return;

      // Thematic puff before drawing
      engine._broadcastEvent('play_zone_animation', {
        type: 'steam_puff',
        owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
      });
      await engine._delay(200);

      const drawn = await ctx.drawCards(pi, count);

      engine.log('steam_miner_draw', {
        player: gs.players[pi]?.username,
        maxHp, drew: drawn?.length || count,
      });
      engine.sync();
    },
  },
});
