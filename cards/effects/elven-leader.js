// ═══════════════════════════════════════════
//  CARD EFFECT: "Elven Leader"
//  Creature (Summoning Magic Lv2) — 50 HP
//
//  HOPT creature effect: choose a target and deal
//  50 damage. Then repeat as many times as you
//  control Creatures OTHER than Leader itself.
//
//  Repeat semantics:
//    - Base: 1 damage instance (the first target).
//    - Extra repeats: current count of other
//      Creatures you control, re-evaluated at the
//      START of the effect. Creatures dying during
//      the cascade do NOT change the planned
//      repeat count — that would let Leader kill
//      its own retinue and shrink the cascade
//      mid-fire, which nobody wants.
//    - Each iteration re-prompts for a fresh
//      target. Cancelling a prompt ends the
//      cascade; if the player simply has no legal
//      targets left, the loop also ends.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Elven Leader';
const DAMAGE    = 50;

/**
 * Count Creatures (any archetype) that `ownerIdx` controls in support
 * zones, excluding a specific instance (Leader itself). Face-down and
 * Token/Creature cards are all counted — the card text doesn't
 * discriminate.
 */
function countOtherCreatures(engine, ownerIdx, exceptInstId) {
  const cardDB = engine._getCardDB();
  let n = 0;
  for (const inst of engine.cardInstances) {
    if (inst.id === exceptInstId) continue;
    if (inst.controller !== ownerIdx) continue;
    if (inst.zone !== 'support') continue;
    const cd = cardDB[inst.name];
    if (!cd) continue;
    if (!hasCardType(cd, 'Creature')) continue;
    n++;
  }
  return n;
}

module.exports = {
  activeIn: ['support'],

  creatureEffect: true,

  canActivateCreatureEffect() { return true; },

  async onCreatureEffect(ctx) {
    const engine      = ctx._engine;
    const gs          = engine.gs;
    const pi          = ctx.cardOwner;
    const heroIdx     = ctx.cardHeroIdx;
    const sourceOwner = ctx.cardHeroOwner;

    // Snapshot the cascade count NOW — 1 base hit plus current other
    // creatures. If Leader kills one of its own mid-cascade, the
    // planned total is unchanged.
    const otherCreatures = countOtherCreatures(engine, pi, ctx.card.id);
    const totalHits      = 1 + otherCreatures;

    engine.log('elven_leader_start', {
      player: gs.players[pi]?.username,
      planned_hits: totalHits,
      other_creatures: otherCreatures,
    });

    let hitsDealt = 0;
    for (let i = 0; i < totalHits; i++) {
      const remaining = totalHits - i;
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'creature',
        title: CARD_NAME,
        description: remaining === 1
          ? `Deal ${DAMAGE} damage to any target. (Last hit)`
          : `Deal ${DAMAGE} damage to any target. (${remaining} hits remaining)`,
        confirmLabel: `⚔ ${DAMAGE} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      // No legal targets OR player cancelled → end cascade early
      if (!target) break;

      const tgtOwner    = target.owner;
      const tgtHeroIdx  = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;
      const impactSlot  = target.type === 'hero' ? -1 : target.slotIdx;

      // Blade-strike projectile from Leader's slot to the target
      engine._broadcastEvent('play_projectile_animation', {
        sourceOwner, sourceHeroIdx: heroIdx, sourceZoneSlot: ctx.card.zoneSlot,
        targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
        emoji: '⚔',
        emojiStyle: { fontSize: 30 },
        duration: 450,
      });
      await engine._delay(380);

      // Impact flash
      engine._broadcastEvent('play_zone_animation', {
        type: 'strike', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
      });
      await engine._delay(180);

      if (target.type === 'hero') {
        const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (tgtHero && tgtHero.hp > 0) await ctx.dealDamage(tgtHero, DAMAGE, 'creature');
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx },
          target.cardInstance, DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
      hitsDealt++;

      // Small pause between consecutive hits keeps the animation readable
      if (i < totalHits - 1) await engine._delay(150);
    }

    engine.log('elven_leader_done', {
      player: gs.players[pi]?.username,
      hits_dealt: hitsDealt,
      hits_planned: totalHits,
    });

    engine.sync();
    return hitsDealt > 0;
  },
};
