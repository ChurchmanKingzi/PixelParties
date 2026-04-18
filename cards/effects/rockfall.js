// ═══════════════════════════════════════════
//  CARD EFFECT: "Rockfall"
//  Spell (Destruction Magic Lv2, Normal)
//
//  Choose a target and deal 200 damage to it.
//  This damage cannot be reduced or negated.
//
//  True-damage routed through the generic
//  engine.actionDealTrueDamage helper (also used
//  by Acid Vial) — bypasses Cloudy, Shielded,
//  Gate Shield, Guardian, buff multipliers, etc.
//  while still setting the `_damagedOnTurn`
//  tracking flag that Medusa's Curse reads.
//
//  Animation: giant boulder falls from above
//  and crashes on the target (boulder_fall).
// ═══════════════════════════════════════════

const CARD_NAME = 'Rockfall';
const DAMAGE    = 200;

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps      = gs.players[pi];
      const hero    = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: DAMAGE,
        title: CARD_NAME,
        description: `Deal ${DAMAGE} damage to any target. Cannot be reduced or negated.`,
        confirmLabel: `🪨 Rockfall! (${DAMAGE})`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) return;

      const tgtOwner   = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtSlot    = target.type === 'hero' ? -1 : target.slotIdx;

      // Boulder falls and crashes on the target
      engine._broadcastEvent('boulder_fall', {
        owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtSlot,
      });
      await engine._delay(550); // Let the boulder reach the target before damage numbers

      if (target.type === 'hero') {
        const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await ctx.dealTrueDamage(tgtHero, DAMAGE, 'destruction_spell');
        }
      } else if (target.cardInstance) {
        await ctx.dealTrueDamage(target.cardInstance, DAMAGE, 'destruction_spell');
      }

      engine.log('rockfall', { player: ps.username, target: target.cardName, damage: DAMAGE });
      engine.sync();
    },
  },
};
