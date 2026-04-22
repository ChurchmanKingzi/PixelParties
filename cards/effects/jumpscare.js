// ═══════════════════════════════════════════
//  CARD EFFECT: "Jumpscare"
//  Spell (Surprise) — Activates when the owner
//  is targeted by an opponent's single/multi-target
//  Attack, Spell, or Creature effect (NOT AoE).
//  After the effect fully resolves, choose any
//  target and Stun it for 2 turns (end of
//  opponent's next turn).
// ═══════════════════════════════════════════

module.exports = {
  isSurprise: true,

  /**
   * Trigger condition: only for non-AoE targeting.
   */
  surpriseTrigger(gs, tOwner, tHeroIdx, sourceInfo, engine) {
    // Don't trigger for AoE effects (Divine Gift of Fire, Flame Avalanche, etc.)
    if (sourceInfo?.cardInstance?._isAoeCheck) return false;
    // Must be an opponent's effect
    if (sourceInfo?.owner === tOwner) return false;
    return true;
  },

  /**
   * On activation: queue a deferred stun effect that fires
   * after the triggering spell/effect fully resolves.
   */
  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;

    // Queue deferred effect — will execute after spell/effect resolution
    if (!gs._deferredSurprises) gs._deferredSurprises = [];
    gs._deferredSurprises.push({
      name: 'Jumpscare',
      ownerIdx: pi,
      execute: async (eng) => {
        // Prompt the owner to choose any target to Stun
        // Create a temporary target picker context
        const allTargets = [];
        for (let pIdx = 0; pIdx < eng.gs.players.length; pIdx++) {
          const ps = eng.gs.players[pIdx];
          if (!ps) continue;
          for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
            const hero = ps.heroes[hi];
            if (!hero?.name || hero.hp <= 0) continue;
            allTargets.push({
              id: `hero-${pIdx}-${hi}`, type: 'hero', owner: pIdx,
              heroIdx: hi, cardName: hero.name,
            });
          }
        }

        if (allTargets.length === 0) return;

        const selectedIds = await eng.promptEffectTarget(pi, allTargets, {
          title: 'Jumpscare',
          description: 'Choose any target to Stun for 2 turns!',
          confirmLabel: '😱 Stun!',
          confirmClass: 'btn-danger',
          cancellable: false,
          maxTotal: 1,
        });

        if (!selectedIds || selectedIds.length === 0) return;
        const picked = allTargets.find(t => t.id === selectedIds[0]);
        if (!picked || picked.type !== 'hero') return;

        const tgtHero = eng.gs.players[picked.owner]?.heroes?.[picked.heroIdx];
        if (!tgtHero || tgtHero.hp <= 0) return;

        // Jack-in-the-box animation
        eng._broadcastEvent('jumpscare_box', {
          owner: picked.owner, heroIdx: picked.heroIdx,
        });
        await eng._delay(700);

        // Apply Stun (respects immunities). Duration 2 = ticks down at the
        // end of each of the target's turns, expiring at the end of their
        // NEXT turn — matches Baihu's "lasts through next turn" pattern.
        await eng.addHeroStatus(picked.owner, picked.heroIdx, 'stunned', { duration: 2 });

        eng.log('jumpscare_stun', {
          player: eng.gs.players[pi]?.username,
          target: tgtHero.name,
        });
        eng.sync();
      },
    });

    // Don't negate the triggering effect
    return { effectNegated: false };
  },
};
