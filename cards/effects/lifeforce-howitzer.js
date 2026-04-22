// ═══════════════════════════════════════════
//  CARD EFFECT: "Lifeforce Howitzer"
//  Artifact (Equipment, Cost 8)
//
//  Equip to own Hero. 1 per Hero max.
//  When the equipped Hero is healed (actual HP
//  gained), player may deal that amount (cap 200)
//  as Artifact damage to any opponent target.
//  Once per turn per Howitzer (resets if moved).
//
//  Animation: thick green laser beam from hero
//  to target.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],

  /**
   * Block equip if the target hero already has a Lifeforce Howitzer.
   * Called by the play_artifact handler before placement.
   */
  canEquipToHero(gs, playerIdx, heroIdx, engine) {
    const ps = gs.players[playerIdx];
    const supportZones = ps.supportZones[heroIdx] || [];
    for (let si = 0; si < supportZones.length; si++) {
      if ((supportZones[si] || []).includes('Lifeforce Howitzer')) return false;
    }
    return true;
  },

  hooks: {
    /**
     * When any hero is healed, check if it's THIS Howitzer's hero.
     * If so, prompt to deal damage equal to HP healed (cap 200).
     */
    afterHeal: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const card = ctx.card;

      // Only trigger for the hero this Howitzer is equipped to
      if (ctx.targetOwner !== ctx.cardOriginalOwner || ctx.targetHeroIdx !== card.heroIdx) return;

      // Once per turn check
      if (card.counters.howitzerFiredThisTurn) return;

      const pi = ctx.cardOwner; // Effective controller
      const heroIdx = card.heroIdx;
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;
      const ps = gs.players[pi];

      const healedAmount = ctx.healedAmount || 0;
      if (healedAmount <= 0) return;

      const damage = Math.min(healedAmount, 200);
      const oi = pi === 0 ? 1 : 0;

      // Prompt player to choose enemy target (cancellable)
      const target = await ctx.promptDamageTarget({
        side: 'enemy',
        types: ['hero', 'creature'],
        damageType: 'artifact',
        baseDamage: damage,
        title: 'Lifeforce Howitzer',
        description: `${hero.name} was healed for ${healedAmount} HP! Deal ${damage} damage to an opponent's target?`,
        confirmLabel: `💥 Fire! (${damage})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        noSpellCancel: true,
      });

      if (!target) return; // Cancelled

      // Mark as fired this turn
      card.counters.howitzerFiredThisTurn = true;

      // Play green laser beam animation
      const targetZoneSlot = target.type === 'equip' ? target.slotIdx : -1;
      engine._broadcastEvent('play_beam_animation', {
        sourceOwner: ctx.cardOriginalOwner,
        sourceHeroIdx: heroIdx,
        targetOwner: target.owner,
        targetHeroIdx: target.heroIdx,
        targetZoneSlot,
        color: '#44ff88',
        duration: 1500,
      });
      await engine._delay(400);

      // Deal damage
      const dmgSource = { name: 'Lifeforce Howitzer', owner: ctx.cardOriginalOwner, heroIdx };
      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await engine.actionDealDamage(dmgSource, tgtHero, damage, 'artifact');
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' &&
          c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            dmgSource, inst, damage, 'artifact',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }

      engine.log('howitzer_fired', {
        player: ps.username, hero: hero.name,
        target: target.cardName, damage,
      });
      engine.sync();
    },

    /**
     * Reset fired flag at turn start.
     */
    onTurnStart: async (ctx) => {
      ctx.card.counters.howitzerFiredThisTurn = false;
    },

    /**
     * When Howitzer leaves its zone (moved, bounced, destroyed),
     * reset the fired flag so it can fire again if re-equipped.
     */
    onCardLeaveZone: async (ctx) => {
      if (ctx.card?.name === 'Lifeforce Howitzer') {
        ctx.card.counters.howitzerFiredThisTurn = false;
      }
    },
  },
};
