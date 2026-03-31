// ═══════════════════════════════════════════
//  CARD EFFECT: "Snow Cannon"
//  Artifact (Normal) — Choose a target Hero
//  or Creature that isn't Immune. Freeze it
//  until the end of its owner's next turn.
//  Goes to discard after resolving.
// ═══════════════════════════════════════════

module.exports = {
  isTargetingArtifact: true,
  animationType: null, // No destruction animation — just freezes

  canActivate(gs, playerIdx) {
    return this.getValidTargets(gs, playerIdx).length > 0;
  },

  getValidTargets(gs, playerIdx) {
    const targets = [];
    const oppIdx = playerIdx === 0 ? 1 : 0;
    const ps = gs.players[oppIdx];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.immune) continue;
      if (hero.statuses?.frozen) continue;
      targets.push({
        id: `hero-${oppIdx}-${hi}`,
        type: 'hero',
        owner: oppIdx,
        heroIdx: hi,
        cardName: hero.name,
      });
    }
    return targets;
  },

  targetingConfig: {
    description: 'Select a Hero to Freeze.',
    confirmLabel: 'Freeze!',
    confirmClass: 'btn-info',
    exclusiveTypes: false,
    maxPerType: { hero: 1 },
  },

  validateSelection(selected, validTargets) {
    if (!selected || selected.length !== 1) return false;
    const validIds = new Set(validTargets.map(t => t.id));
    return selected.every(id => validIds.has(id));
  },

  async resolve(engine, playerIdx, selectedIds, validTargets) {
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return;
    await engine.addHeroStatus(target.owner, target.heroIdx, 'frozen', { appliedBy: playerIdx });
    engine.log('freeze', { target: target.cardName, by: 'Snow Cannon' });
  },
};
