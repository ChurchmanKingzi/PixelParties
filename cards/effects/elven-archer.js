// ═══════════════════════════════════════════
//  CARD EFFECT: "Elven Archer"
//  Creature (Summoning Magic Lv1) — 50 HP
//
//  Two effects:
//    1) PASSIVE — If you control at least 1 Elven
//       Creature, summoning this Creature counts
//       as an additional Action. Modelled via the
//       engine's `inherentAction` facility: when
//       the player has any Elven on board, playing
//       Archer consumes no hero action and no
//       additional-action slot. No provider pick,
//       no ⚡ icon on any other Elven.
//    2) CREATURE EFFECT (HOPT) — Deal 50 damage to
//       any target.
//
//  Chain semantics fall out naturally: once the
//  first Archer lands, Archer itself is Elven, so
//  the inherentAction gate keeps returning true
//  for any further Archers in hand.
// ═══════════════════════════════════════════

const { hasElvenOnBoard } = require('./_elven-shared');

const CARD_NAME = 'Elven Archer';
const DAMAGE    = 50;

module.exports = {
  activeIn: ['support'],

  // Free-summon gate: true iff the player already controls ≥1 Elven.
  // Archer itself is in hand when this fires, so it doesn't self-count.
  inherentAction: (gs, pi, heroIdx, engine) => hasElvenOnBoard(engine, pi),

  // Active creature effect: deal 50 damage to any target, HOPT enforced
  // by the engine (hoptKey = 'creature-effect:${inst.id}').
  creatureEffect: true,

  canActivateCreatureEffect() { return true; },

  async onCreatureEffect(ctx) {
    const engine      = ctx._engine;
    const gs          = engine.gs;
    const pi          = ctx.cardOwner;
    const heroIdx     = ctx.cardHeroIdx;
    // Source-side animation origin — physical slot of the creature,
    // which diverges from `cardOwner` on temporarily-stolen creatures.
    const sourceOwner = ctx.cardHeroOwner;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      title: CARD_NAME,
      description: `Deal ${DAMAGE} damage to any target.`,
      confirmLabel: `🏹 ${DAMAGE} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    const tgtOwner    = target.owner;
    const tgtHeroIdx  = target.heroIdx;
    const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;
    const impactSlot  = target.type === 'hero' ? -1 : target.slotIdx;

    // Arrow projectile from Archer's slot to the target
    engine._broadcastEvent('play_projectile_animation', {
      sourceOwner, sourceHeroIdx: heroIdx, sourceZoneSlot: ctx.card.zoneSlot,
      targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
      targetZoneSlot: tgtZoneSlot,
      emoji: '🏹',
      emojiStyle: { fontSize: 28 },
      duration: 550,
    });
    await engine._delay(450);

    // Impact flash
    engine._broadcastEvent('play_zone_animation', {
      type: 'strike', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
    });
    await engine._delay(200);

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

    engine.sync();
    return true;
  },
};
