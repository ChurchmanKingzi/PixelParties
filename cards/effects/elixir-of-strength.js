// ═══════════════════════════════════════════
//  CARD EFFECT: "Elixir of Strength"
//  Potion — Choose a Hero you control. The next
//  time that Hero hits exactly 1 target with an
//  Attack, that Attack's damage is increased by
//  100 and cannot be reduced or negated.
//
//  The "fire on first attack damage" behaviour
//  itself lives in engine
//  `_applyEmpoweredStrikeIfApplicable`, called
//  from BEFORE_DAMAGE (hero-damage path) and the
//  per-entry pass in processCreatureDamageBatch
//  (creature-damage path). The buff has no
//  expiry — it persists across turns until
//  consumed.
// ═══════════════════════════════════════════

module.exports = {
  isPotion: true,

  canActivate(gs, pi) {
    return (gs.players[pi]?.heroes || []).some(h => h?.name && h.hp > 0 && !h.buffs?.empowered_strike);
  },

  getValidTargets(gs, pi) {
    const targets = [];
    const ps = gs.players[pi];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      // Don't double-apply — a hero already empowered isn't a valid target.
      if (hero.buffs?.empowered_strike) continue;
      targets.push({
        id: `hero-${pi}-${hi}`,
        type: 'hero',
        owner: pi,
        heroIdx: hi,
        cardName: hero.name,
      });
    }
    return targets;
  },

  targetingConfig: {
    title: 'Elixir of Strength',
    description: "Choose one of your Heroes. Their next single-target Attack deals +100 damage that can't be reduced or negated.",
    confirmLabel: '💪 Drink!',
    confirmClass: 'btn-warning',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
  },

  validateSelection(selectedIds) {
    return selectedIds && selectedIds.length === 1;
  },

  animationType: 'empowered_strike_apply',

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return;
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target || target.type !== 'hero') return;

    const gs = engine.gs;
    const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero?.name || hero.hp <= 0) return;

    // No expiry — buff persists across turns until consumed by the
    // engine's BEFORE_DAMAGE rider.
    await engine.actionAddBuff(hero, target.owner, target.heroIdx, 'empowered_strike', {
      source: 'Elixir of Strength',
      addAnim: 'empowered_strike_apply',
    });

    engine.log('elixir_of_strength', {
      player: gs.players[pi]?.username,
      hero: hero.name,
    });
    engine.sync();
  },
};
