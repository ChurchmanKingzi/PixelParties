// ═══════════════════════════════════════════
//  CARD EFFECT: "Elixir of Strength"
//  Potion — Choose a Hero you control. The next
//  time that Hero hits exactly 1 target with an
//  Attack, that Attack's damage is increased by
//  150 and cannot be reduced or negated.
//  (W49a, Al 22.10.2026: 150 statt 100; die Zahl lebt in der
//  Engine-Konstante `EMPOWERED_STRIKE_BONUS`.)
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

  // W28a (Al, 21.10.2026: „'you control' = aktuelle Kontrolle, nicht Besitzer"): „a Hero you control" = `getControlledHeroTargets` (ein abgegebener eigener Held
  // faellt heraus, ein uebernommener Gegnerheld zaehlt; ID/`owner` = Brettseite).
  canActivate(gs, pi, engine) {
    if (!engine) return (gs.players[pi]?.heroes || []).some(h => h?.name && h.hp > 0 && !h.buffs?.empowered_strike);
    return engine.getControlledHeroTargets(pi).some(t => !gs.players[t.owner]?.heroes?.[t.heroIdx]?.buffs?.empowered_strike);
  },

  getValidTargets(gs, pi, engine) {
    // Don't double-apply — a hero already empowered isn't a valid target.
    return engine.getControlledHeroTargets(pi).filter(t => !gs.players[t.owner]?.heroes?.[t.heroIdx]?.buffs?.empowered_strike);
  },

  targetingConfig: {
    title: 'Elixir of Strength',
    description: "Choose one of your Heroes. Their next single-target Attack deals +150 damage that can't be reduced or negated.",
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
      sourceOwner: pi,   // v1067: Quelle ist Pflicht (siehe _affected-shared)
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
