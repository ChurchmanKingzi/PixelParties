// ═══════════════════════════════════════════
//  CARD EFFECT: "Muscle Training"
//  Attack (Fighting Lv0, Normal)
//
//  Play condition (beyond spell school):
//  - At least 1 "Fighting" in the caster's deck
//  - Caster can receive Fighting (free ability
//    zone OR Fighting slot below Lv3)
//
//  Effect:
//  Search deck for a copy of Fighting and attach
//  it to the casting hero. Does NOT consume the
//  hero's per-turn ability attachment.
//
//  Inherent Action condition:
//  If the hero has at least 1 Equipment Artifact
//  in its Support Zones AND this specific hero has
//  not used an Attack yet this turn → card is an
//  inherent additional Action (free during Main
//  Phase, doesn't end Action Phase).
//
//  Animation: dumbbell pumps up and down twice.
// ═══════════════════════════════════════════

// ─── HELPERS ─────────────────────────────

/**
 * Check if a specific hero can receive Fighting
 * (has a free ability zone OR an existing Fighting slot < Lv3).
 */
function heroCanAcceptFighting(ps, heroIdx) {
  const abZones = ps.abilityZones[heroIdx] || [];
  for (let z = 0; z < 3; z++) {
    const slot = abZones[z] || [];
    if (slot.length === 0) return true;
    if (slot[0] === 'Fighting' && slot.length < 3) return true;
  }
  return false;
}

/**
 * Check if a hero has at least 1 Equipment Artifact in its Support Zones.
 */
function heroHasEquipment(ps, heroIdx, cardDB) {
  for (let si = 0; si < (ps.supportZones[heroIdx] || []).length; si++) {
    const slot = (ps.supportZones[heroIdx] || [])[si] || [];
    if (slot.length === 0) continue;
    const cd = cardDB[slot[0]];
    if (cd && (cd.subtype || '').toLowerCase() === 'equipment') return true;
  }
  return false;
}

// ─── MODULE EXPORTS ──────────────────────

module.exports = {
  /**
   * Global play condition:
   * - At least 1 "Fighting" in the deck
   * - At least one alive hero can accept Fighting
   *   (free ability zone or existing Fighting < Lv3)
   */
  spellPlayCondition(gs, pi) {
    const ps = gs.players[pi];
    if (!(ps.mainDeck || []).includes('Fighting')) return false;

    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;

      if (heroCanAcceptFighting(ps, hi)) return true;
    }
    return false;
  },

  /**
   * Inherent Action:
   * Free play (Main Phase without additional action,
   * Action Phase without ending it) when:
   * 1. Hero has at least 1 Equipment Artifact
   * 2. THIS specific hero has not used an Attack yet this turn
   */
  inherentAction(gs, pi, heroIdx, engine) {
    const ps = gs.players[pi];
    if ((ps.heroesAttackedThisTurn || []).includes(heroIdx)) return false;

    const cardDB = engine._getCardDB();
    return heroHasEquipment(ps, heroIdx, cardDB);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // ── Validate per-hero conditions ──
      if (!heroCanAcceptFighting(ps, heroIdx)) {
        gs._spellCancelled = true;
        return;
      }

      const deckIdx = (ps.mainDeck || []).indexOf('Fighting');
      if (deckIdx < 0) {
        gs._spellCancelled = true;
        return;
      }

      // ── Play dumbbell pump animation ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'dumbbell_pump', owner: pi, heroIdx, zoneSlot: -1,
      });
      await engine._delay(1600);

      // ── Remove Fighting from deck ──
      ps.mainDeck.splice(deckIdx, 1);

      // ── Find target ability zone ──
      const abZones = ps.abilityZones[heroIdx] || [[], [], []];
      ps.abilityZones[heroIdx] = abZones;
      let targetZone = -1;

      // Prefer stacking onto existing Fighting slot (< Lv3)
      for (let z = 0; z < 3; z++) {
        const slot = abZones[z] || [];
        if (slot.length > 0 && slot[0] === 'Fighting' && slot.length < 3) {
          targetZone = z;
          break;
        }
      }
      // Otherwise use a free zone
      if (targetZone < 0) {
        for (let z = 0; z < 3; z++) {
          if ((abZones[z] || []).length === 0) {
            targetZone = z;
            break;
          }
        }
      }

      if (targetZone < 0) return; // Shouldn't happen (spellPlayCondition guards this)

      // ── Attach Fighting ──
      if (!abZones[targetZone]) abZones[targetZone] = [];
      abZones[targetZone].push('Fighting');

      // Does NOT consume abilityGivenThisTurn (additional attachment)

      // ── Track card instance + fire hooks ──
      const inst = engine._trackCard('Fighting', pi, 'ability', heroIdx, targetZone);
      engine._broadcastEvent('deck_search_add', { cardName: 'Fighting', playerIdx: pi });
      engine.log('deck_search', { player: ps.username, card: 'Fighting', by: 'Muscle Training' });

      // Fire Fighting's onPlay hook (grants ATK bonus)
      await engine.runHooks('onPlay', {
        _onlyCard: inst, playedCard: inst, cardName: 'Fighting',
        zone: 'ability', heroIdx, _skipReactionCheck: true,
      });

      // Fire zone enter hook (triggers Creativity, etc.)
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'ability', toHeroIdx: heroIdx,
        _skipReactionCheck: true,
      });

      // Flash the target ability zone
      engine._broadcastEvent('ability_activated', {
        owner: pi, heroIdx, zoneIdx: targetZone, abilityName: 'Fighting',
      });

      engine.log('muscle_training', {
        player: ps.username, hero: hero.name,
        fightingLevel: abZones[targetZone].length,
      });

      engine.sync();
    },
  },
};
