// ═══════════════════════════════════════════
//  CARD EFFECT: "Resuscitation Potion"
//  Potion — Choose one of your defeated Heroes
//  and revive it with 50 HP. That Hero's max HP
//  become 50 and cannot be increased in any way.
//  Hard once per GAME. Deleted after use.
//
//  Targeting: only own dead heroes (hp <= 0).
//  Grayed out if no dead heroes exist.
// ═══════════════════════════════════════════

module.exports = {
  isPotion: true,
  isTargetingArtifact: true, // Uses the targeting flow

  canActivate(gs, pi) {
    // HOPT: once per GAME (use a persistent key)
    const hoptKey = `resuscitation-potion:${pi}`;
    if (gs.hoptUsed?.[hoptKey] === -1) return false; // -1 = permanently used
    // Must have at least one dead hero
    const ps = gs.players[pi];
    return (ps.heroes || []).some(h => h?.name && h.hp <= 0);
  },

  getValidTargets(gs, pi) {
    const ps = gs.players[pi];
    const targets = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name) continue;
      if (hero.hp > 0) continue; // Only dead heroes
      targets.push({
        id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: hero.name,
      });
    }
    return targets;
  },

  targetingConfig: {
    description: 'Choose a defeated Hero to revive with 50 HP.',
    confirmLabel: '✨ Revive!',
    confirmClass: 'btn-success',
    cancellable: true,
    greenSelect: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
  },

  validateSelection: (selectedIds) => selectedIds && selectedIds.length === 1,

  animationType: 'holy_revival',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return false;

    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target || target.type !== 'hero') return false;

    const ps = engine.gs.players[pi];
    const hero = ps.heroes?.[target.heroIdx];
    if (!hero?.name) return false;
    if (hero.hp > 0) return false; // Safety: hero must actually be dead

    // Claim once-per-game
    if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
    engine.gs.hoptUsed[`resuscitation-potion:${pi}`] = -1; // -1 = permanent

    // Revive with 50 HP, cap max HP at 50
    await engine.actionReviveHero(pi, target.heroIdx, 50, {
      maxHpCap: 50,
      source: 'Resuscitation Potion',
    });

    return true;
  },
};
