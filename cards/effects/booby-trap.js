// ═══════════════════════════════════════════
//  CARD EFFECT: "Booby Trap"
//  Spell (Surprise) — Destruction Magic Lv1
//
//  Activate when the host Hero is hit by an
//  Attack, Spell, or Creature effect.
//  Deal 100 damage to the attacker.
//  If this kills the attacker, the entire
//  triggering effect is negated.
//
//  When the attacker is a Creature, damage
//  hits the Creature (not its host Hero).
// ═══════════════════════════════════════════

// Shared source→creature resolution (same helper Fireshield uses) so
// the "hit the attacking Creature, not its host Hero" routing has a
// single source of truth and never diverges between retaliation cards.
const { resolveSourceCreature, isCreatureSource } = require('./_hooks');

module.exports = {
  isSurprise: true,

  /**
   * Trigger condition: fires whenever the host hero is targeted
   * by any Attack, Spell, or Creature effect.
   * Must have a valid source (hero casting a spell/attack, or a creature).
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, sourceInfo, engine) => {
    if (sourceInfo.owner < 0 || sourceInfo.heroIdx < 0) return false;

    if (isCreatureSource(engine, sourceInfo)) {
      // Creature source — only if the creature is still alive on board.
      return !!resolveSourceCreature(engine, sourceInfo);
    }

    // Hero source (spell/attack) — check hero is alive
    const attacker = gs.players[sourceInfo.owner]?.heroes?.[sourceInfo.heroIdx];
    return attacker && attacker.hp > 0;
  },

  /**
   * On activation: big explosion on the attacker, deal 100 damage.
   * If creature: damage the creature. If hero: damage the hero.
   * If the attacker dies, return { effectNegated: true }.
   */
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const gs = engine.gs;

    if (sourceInfo.telekinesis) {
      // ── Telekinesis mode: pick any target to deal 100 damage to ──
      // promptDamageTarget only SELECTS a target — it does not deal damage.
      // The caller must dispatch to actionDealDamage / actionDealCreatureDamage
      // itself (see cannon-tower.js for the canonical pattern).
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: 100,
        title: 'Booby Trap',
        description: 'Deal 100 damage to any target.',
        confirmLabel: '💥 100 Damage!',
        confirmClass: 'btn-danger',
        cancellable: false,
        noSpellCancel: true,
      });
      if (!target) return null;

      const tSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: target.owner,
        heroIdx: target.heroIdx, zoneSlot: tSlot,
      });
      await engine._delay(600);

      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await ctx.dealDamage(tgtHero, 100, 'destruction_spell');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: 'Booby Trap', owner: ctx.cardOwner, heroIdx: ctx.cardHeroIdx },
          target.cardInstance, 100, 'destruction_spell',
          { sourceOwner: ctx.cardOwner, canBeNegated: true }
        );
      }
      engine.sync();
      await engine._delay(400);
      return null; // No effect negation in telekinesis mode (no source to negate)
    }

    // Shared resolution (same helper Fireshield uses): the LIVE
    // attacking Creature instance, or null for a Hero (Spell/Attack)
    // source. Using the live inst (not the possibly-stale
    // sourceInfo.cardInstance) also drops the old manual snapshot
    // handling.
    const srcInst = resolveSourceCreature(engine, sourceInfo);

    if (isCreatureSource(engine, sourceInfo)) {
      // ── Creature source: deal 100 damage to the creature ──
      // Attacker creature already gone (resolved null) → nothing to
      // hit, no negation (mirrors the prior creatureHp <= 0 guard).
      if (!srcInst) return null;

      // Explosion animation on the creature's support zone slot
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: srcInst.owner,
        heroIdx: srcInst.heroIdx, zoneSlot: srcInst.zoneSlot,
      });
      await engine._delay(600);

      // Deal 100 damage to the creature
      await engine.actionDealCreatureDamage(
        { name: 'Booby Trap', owner: ctx.cardOwner, heroIdx: ctx.cardHeroIdx },
        srcInst, 100, 'destruction_spell',
        { sourceOwner: ctx.cardOwner, canBeNegated: true }
      );
      engine.sync();
      await engine._delay(400);

      // If the creature was killed, negate the entire effect
      if ((srcInst.counters?.currentHp ?? 0) <= 0) {
        engine.log('surprise_negate', {
          card: 'Booby Trap', killed: srcInst.name,
          player: gs.players[ctx.cardOwner]?.username,
        });
        return { effectNegated: true };
      }
    } else {
      // ── Hero source (spell/attack): deal 100 damage to the hero ──
      const attackerOwner = sourceInfo.owner;
      const attackerHeroIdx = sourceInfo.heroIdx;
      const attacker = gs.players[attackerOwner]?.heroes?.[attackerHeroIdx];
      if (!attacker || attacker.hp <= 0) return null;

      // Explosion animation on the attacker hero
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: attackerOwner,
        heroIdx: attackerHeroIdx, zoneSlot: -1,
      });
      await engine._delay(600);

      // Deal 100 damage to the attacker hero
      await ctx.dealDamage(attacker, 100, 'destruction_spell');
      engine.sync();
      await engine._delay(400);

      // If the attacker was killed, negate the entire effect
      if (attacker.hp <= 0) {
        engine.log('surprise_negate', {
          card: 'Booby Trap', killed: attacker.name,
          player: gs.players[ctx.cardOwner]?.username,
        });
        return { effectNegated: true };
      }
    }

    return null;
  },
};
