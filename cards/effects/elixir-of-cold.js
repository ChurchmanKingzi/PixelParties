// ═══════════════════════════════════════════
//  CARD EFFECT: "Elixir of Cold"
//  Potion — Choose a Hero you control. Any target
//  hit by that Hero's Attacks and Spells THIS
//  TURN is Frozen for 1 turn.
//
//  The "freeze on hit" behaviour itself lives in
//  engine `_applyColdStrikeFreezeIfApplicable`,
//  fired from both the hero-damage and creature-
//  damage paths. This script just applies the
//  visible `cold_strike` buff to the chosen hero
//  with end-of-turn expiry.
// ═══════════════════════════════════════════

module.exports = {
  isPotion: true,

  canActivate(gs, pi) {
    return (gs.players[pi]?.heroes || []).some(h => h?.name && h.hp > 0);
  },

  getValidTargets(gs, pi) {
    const targets = [];
    const ps = gs.players[pi];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
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
    title: 'Elixir of Cold',
    description: "Choose one of your Heroes. Their Attacks and Spells will Freeze each target they hit for 1 turn (rest of this turn).",
    confirmLabel: '❄️ Drink!',
    confirmClass: 'btn-info',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
  },

  validateSelection(selectedIds) {
    return selectedIds && selectedIds.length === 1;
  },

  animationType: 'cold_strike_apply',

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return;
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target || target.type !== 'hero') return;

    const gs = engine.gs;
    const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero?.name || hero.hp <= 0) return;

    // Buff expires at the START of opp's next turn — i.e. the moment
    // the caster's current turn ends. Cloud Pillow uses gs.turn+2 for
    // "caster's next turn"; we want one tick earlier.
    const oi = pi === 0 ? 1 : 0;
    await engine.actionAddBuff(hero, target.owner, target.heroIdx, 'cold_strike', {
      expiresAtTurn: gs.turn + 1,
      expiresForPlayer: oi,
      source: 'Elixir of Cold',
      addAnim: 'cold_strike_apply',
    });

    engine.log('elixir_of_cold', {
      player: gs.players[pi]?.username,
      hero: hero.name,
    });
    engine.sync();
  },
};
