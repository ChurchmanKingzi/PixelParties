// ═══════════════════════════════════════════
//  CARD EFFECT: "Slippery Spikeblock"
//  Creature (Summoning Magic Lv0, 1 HP — Slippery)
//
//  At the beginning of each of your turns, slide
//  this Creature into the free Support Zone of an
//  adjacent Hero (if possible).
//
//  When this Creature is moved into a different
//  Hero's Support Zone, deal 80 damage to the
//  OPPONENT'S Hero in the same column as the
//  destination Hero (i.e. opp's heroIdx === this
//  Creature's new heroIdx).
//
//  Lv0 / 1 HP — the value is the slide-damage
//  cadence, not the body. Pairs with Slippery Ice
//  / Skates for free repositioning chips.
// ═══════════════════════════════════════════

const { onSlipperyTurnStart, slipperyOnMoveGate } = require('./_slippery-shared');

const CARD_NAME = 'Slippery Spikeblock';
const HIT_DAMAGE = 80;

module.exports = {
  activeIn: ['support'],

  hooks: {
    onTurnStart: onSlipperyTurnStart,

    onCardEnterZone: async (ctx) => {
      if (!slipperyOnMoveGate(ctx)) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const oppPs = engine.gs.players[oi];
      const myHeroIdx = ctx.card.heroIdx;
      const oppHero = oppPs?.heroes?.[myHeroIdx];
      if (!oppHero?.name || oppHero.hp <= 0) return;

      // Ice-block crash animation on the opp Hero, then 80 damage.
      // Visual sequence is timed so the impact frame lines up with the
      // damage floater (client-side: `ice_block_crash` keyframes peak
      // at ~50% of 600ms).
      engine._broadcastEvent('play_zone_animation', {
        type: 'ice_block_crash', owner: oi, heroIdx: myHeroIdx, zoneSlot: -1,
      });
      await engine._delay(380);

      const source = { name: CARD_NAME, owner: pi, heroIdx: ctx.card.heroIdx };
      await engine.actionDealDamage(source, oppHero, HIT_DAMAGE, 'other');

      const ps = engine.gs.players[pi];
      engine.log('slippery_spikeblock_hit', {
        player: ps?.username, column: myHeroIdx, damage: HIT_DAMAGE,
      });
      engine.sync();
    },
  },
};
