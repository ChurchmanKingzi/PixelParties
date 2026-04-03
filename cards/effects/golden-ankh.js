// ═══════════════════════════════════════════
//  CARD EFFECT: "Golden Ankh"
//  Artifact (Normal, 10 Gold) — Choose a
//  defeated Hero you control and revive it
//  with min(100, maxHP) HP. At end of turn,
//  that Hero is defeated again — this cannot
//  be negated by any protection effect.
//
//  Uses the generic actionReviveHero with
//  forceKillAtTurnEnd flag. The engine's
//  _processForceKills handles the un-negatable
//  end-of-turn death.
// ═══════════════════════════════════════════

module.exports = {
  isTargetingArtifact: true,

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    // Must have at least one dead hero
    return (ps.heroes || []).some(h => h?.name && h.hp <= 0);
  },

  getValidTargets(gs, pi) {
    const ps = gs.players[pi];
    const targets = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name) continue;
      if (hero.hp > 0) continue;
      targets.push({
        id: `hero-${pi}-${hi}`, type: 'hero', owner: pi,
        heroIdx: hi, cardName: hero.name,
      });
    }
    return targets;
  },

  targetingConfig: {
    description: 'Choose a defeated Hero to revive until end of turn.',
    confirmLabel: '𓋹 Revive!',
    confirmClass: 'btn-success',
    cancellable: true,
    greenSelect: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
  },

  validateSelection: (selectedIds) => selectedIds && selectedIds.length === 1,

  animationType: 'golden_ankh_revival',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return false;

    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target || target.type !== 'hero') return false;

    const hero = engine.gs.players[pi]?.heroes?.[target.heroIdx];
    if (!hero?.name) return false;
    if (hero.hp > 0) return false;

    // Revive with min(100, maxHP), auto-kill at end of turn
    await engine.actionReviveHero(pi, target.heroIdx, 100, {
      forceKillAtTurnEnd: true,
      animationType: 'golden_ankh_revival',
      source: 'Golden Ankh',
    });

    return true;
  },
};
