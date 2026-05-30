// ═══════════════════════════════════════════
//  CARD EFFECT: "Diamond Spider"
//  Creature (Summoning Magic Lv1, Normal) — 100 HP
//
//  "You may send 2 Surprises you control to the discard pile to summon
//   this Creature as an additional Action. Once per turn, when a
//   player activates a Surprise, draw 2 cards."
//
//  Mechanics
//  ─────────
//   • Summon-cost path via the shared `makeSurpriseCostSummon(2)`
//     mixin (same Big Gwen Guard pattern as Crimson Skull / Box).
//   • Hard once per turn: any Surprise activation (either side) →
//     Diamond Spider's controller draws 2. HOPT is per-instance so
//     two Diamond Spiders trigger twice per turn (per the card text —
//     "Once per turn" naturally reads per-instance).
// ═══════════════════════════════════════════

const { makeSurpriseCostSummon } = require('./_spider-shared');

const CARD_NAME = 'Diamond Spider';
const SURPRISE_COST = 2;
const DRAW_COUNT = 2;

module.exports = {
  activeIn: ['support'],

  ...makeSurpriseCostSummon(SURPRISE_COST, CARD_NAME),

  hooks: {
    onSurpriseActivated: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      // Hard once per turn (per Diamond Spider instance).
      if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
      const hoptKey = `diamond_spider_draw:${inst.id}`;
      if (engine.gs.hoptUsed[hoptKey] === engine.gs.turn) return;
      // Diamond Spider must still be alive (defensive — runHooks already
      // filters out face-down / KO'd / negated instances, but the
      // currentHp guard catches edge cases on snapshot resumption).
      const cardDB = engine._getCardDB();
      const hp = inst.counters?.currentHp ?? cardDB[CARD_NAME]?.hp ?? 0;
      if (hp <= 0) return;

      engine.gs.hoptUsed[hoptKey] = engine.gs.turn;

      const owner = inst.controller ?? inst.owner;

      // Diamond flash + sparkles on Diamond Spider's slot — a
      // staggered triple-emit (mirroring the ability-activated burst
      // pattern) so the trigger reads as a punchy crystalline flash.
      // Uses sequential `engine._delay` (not setTimeout) so the entire
      // burst stays inside the fast-mode window during MCTS rollouts.
      // setTimeout callbacks fire as macrotasks after the rollout has
      // restored — past that point `_fastMode` is false again and the
      // broadcast leaks to live clients with stale slot coordinates,
      // causing phantom diamond sparkles in random / empty zones.
      const flashEvent = () => engine._broadcastEvent('play_zone_animation', {
        type: 'diamond_sparkle',
        owner: inst.owner,
        heroIdx: inst.heroIdx,
        zoneSlot: inst.zoneSlot,
      });
      flashEvent();
      await engine._delay(200);
      flashEvent();
      await engine._delay(200);
      flashEvent();
      await engine._delay(50);

      const drawn = await engine.actionDrawCards(owner, DRAW_COUNT, {
        source: CARD_NAME,
      });
      engine.log('diamond_spider_draw', {
        player: engine.gs.players[owner]?.username,
        surprise: ctx.surpriseCardName,
        drawn: drawn?.length || 0,
      });
      engine.sync();
    },
  },
};
