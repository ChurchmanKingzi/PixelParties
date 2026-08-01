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

  // CPU evaluation hint. Reviving a hero only for the current turn
  // (forceKillAtTurnEnd) looks free at the immediate post-play state
  // because the hero is alive again, but the End-Phase forceKill
  // wipes that out before the opponent's turn. Telling the gate to
  // simulate the rest of the turn makes the eval correctly see the
  // hero dead again — so the gate only commits if the revived hero
  // actually generated value during their forced-life (cards drawn,
  // damage dealt, abilities/effects used). Matches the user spec
  // "only revive if there's a use this turn".
  // `reviveCard` + `reviveTemporary`: Opt-in für die situative Such-/
  // Handwert-Bewertung in _cpu.js (reviveCardSituation): ohne toten
  // eigenen Helden harter Malus statt gelerntem Statikwert; mit totem
  // Helden, aber ohne Nutzen in DIESER Runde (cpuShouldPlay-Probe
  // unten) ebenfalls Malus — der Revive hält ja nur bis Rundenende.
  cpuMeta: { evaluateThroughTurnEnd: true, reviveCard: true, reviveTemporary: true },

  /**
   * Pre-plan heuristic — keep the CPU from spending 10 gold + a hand
   * card to revive a Hero who has nothing to do that turn. Without
   * this guard, `evaluateThroughTurnEnd` alone is insufficient: the
   * MCTS rollout can still find tiny positional bumps that beat the
   * +30 gate threshold even though nothing useful is achievable.
   *
   * Returns true iff at least one dead Hero on the player's side
   * would, IF revived, have a meaningful play this turn — a card
   * in hand they could cast, an active Hero effect, or an activate-
   * able Ability / Creature already attached to them.
   *
   * Implementation samples the live engine helpers
   * (`getHeroPlayableCards`, `getActiveHeroEffects`, `getActivatable-
   * Abilities`, `getActivatableCreatures`) with the dead Hero's HP
   * temporarily set positive — they all gate on hp > 0 internally.
   * The mutation is fully reverted in `finally` so the heuristic is
   * side-effect-free.
   */
  cpuShouldPlay(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return false;
    const heroes = ps.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) {
      const hero = heroes[hi];
      if (!hero?.name || hero.hp > 0) continue;

      const savedHp = hero.hp;
      hero.hp = 100;
      let useful = false;
      try {
        const playable = engine.getHeroPlayableCards?.(pi);
        if (playable?.own?.[hi]?.length > 0) { useful = true; }
        if (!useful) {
          const heroEffects = engine.getActiveHeroEffects?.(pi);
          if (Array.isArray(heroEffects) && heroEffects.some(e => e.heroIdx === hi)) useful = true;
        }
        if (!useful) {
          const abilities = engine.getActivatableAbilities?.(pi);
          if (Array.isArray(abilities) && abilities.some(a => a.heroIdx === hi)) useful = true;
        }
        if (!useful) {
          const creatures = engine.getActivatableCreatures?.(pi);
          if (Array.isArray(creatures) && creatures.some(c => c.heroIdx === hi)) useful = true;
        }
      } finally {
        hero.hp = savedHp;
      }
      if (useful) return true;
    }
    return false;
  },

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
