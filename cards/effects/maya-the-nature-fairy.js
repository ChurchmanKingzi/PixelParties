// ═══════════════════════════════════════════
//  CARD EFFECT: "Maya, the Nature Fairy"
//  Hero — 350 HP, 40 ATK
//  Starting abilities: Friendship, Summoning Magic
//
//  Whenever a Creature is placed into one of
//  your Heroes' Support Zones, you may choose
//  a target you control and increase its
//  current and max HP by 50.
//
//  Heroes:   ctx.increaseMaxHp (increases both
//            current and max HP by default).
//  Creatures: counters.maxHp and counters.currentHp
//            increased directly (50 each).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const HP_BOOST = 50;

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onCardEnterZone: async (ctx) => {
      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      if (ctx.toZone !== 'support') return;

      // Only trigger for creatures entering this player's own support zones
      const entering = ctx.enteringCard;
      if (!entering || entering.owner !== pi) return;

      const cd = engine.getEffectiveCardData(entering) || engine._getCardDB()[entering.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;

      // Maya must be alive
      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Prompt: choose any friendly target (cancellable — the boost is optional)
      const target = await ctx.promptDamageTarget({
        side: 'my',
        types: ['hero', 'creature'],
        damageType: null,
        title: 'Maya, the Nature Fairy',
        description: `A Creature was summoned! Choose a friendly target to increase its HP by ${HP_BOOST}.`,
        confirmLabel: `🌿 +${HP_BOOST} HP`,
        confirmClass: 'btn-success',
        cancellable: true,
        greenSelect: true,
      });
      if (!target) return;

      engine._broadcastEvent('play_zone_animation', {
        type: 'heart_burst',
        owner: target.owner,
        heroIdx: target.heroIdx,
        zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
      });
      await engine._delay(300);

      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          ctx.increaseMaxHp(tgtHero, HP_BOOST);
          engine.log('maya_boost_hero', {
            player: gs.players[pi].username, target: tgtHero.name, amount: HP_BOOST,
          });
        }
      } else if (target.cardInstance) {
        ctx.increaseMaxHp(target.cardInstance, HP_BOOST);
        engine.log('maya_boost_creature', {
          player: gs.players[pi].username, target: target.cardInstance.name, amount: HP_BOOST,
        });
      }

      engine.sync();
    },
  },
};
