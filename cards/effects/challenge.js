// ═══════════════════════════════════════════
//  CARD EFFECT: "Challenge"
//  Attack (Fighting Lv1, Reaction)
//
//  Cannot be played proactively. Activates via
//  the target redirect system — fires when a
//  target the player controls is chosen by a
//  single-target Attack, Spell, or Creature
//  effect.
//
//  The player selects one of their eligible
//  Heroes (Fighting Lv1, also a valid target
//  for the effect) to become the new target.
//  The entire effect resolves against the
//  Challenge user instead.
//
//  Runs through the chain visualization system.
//
//  Cards/effects with cannotBeRedirected: true
//  are immune to this card.
// ═══════════════════════════════════════════

// ─── HELPERS ─────────────────────────────

/**
 * Check if a hero can use Challenge.
 * Requires: alive, not incapacitated, Fighting Lv1.
 */
function heroCanUseChallenge(ps, heroIdx) {
  const hero = ps.heroes[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return false;

  // Spell school check: needs Fighting Lv1 (Performance on Fighting counts)
  const abZones = ps.abilityZones[heroIdx] || [];
  let fightingCount = 0;
  for (const slot of abZones) {
    if (!slot || slot.length === 0) continue;
    const baseAbility = slot[0];
    for (const abName of slot) {
      if (abName === 'Fighting') fightingCount++;
      else if (abName === 'Performance' && baseAbility === 'Fighting') fightingCount++;
    }
  }
  return fightingCount >= 1;
}

/**
 * Find heroes that can use Challenge AND are valid targets for the effect.
 * Excludes the currently selected target (no point redirecting to same target).
 */
function getEligibleRedirectHeroes(gs, pi, selected, validTargets) {
  const ps = gs.players[pi];
  const eligible = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    if (!heroCanUseChallenge(ps, hi)) continue;

    // Must NOT be the already-selected target
    if (selected.type === 'hero' && selected.owner === pi && selected.heroIdx === hi) continue;

    // Must be a valid target for the original effect
    const isValidTarget = validTargets.some(t =>
      t.type === 'hero' && t.owner === pi && t.heroIdx === hi
    );
    if (!isValidTarget) continue;

    eligible.push(hi);
  }
  return eligible;
}

// ─── MODULE EXPORTS ──────────────────────

module.exports = {
  // Mark as a target redirect card for the engine's redirect scanner
  isTargetRedirect: true,

  /**
   * Prevent normal play — only activates via redirect system.
   */
  spellPlayCondition() {
    return false;
  },

  /**
   * Check if Challenge can activate for this targeting event.
   * @param {object} gs - Game state
   * @param {number} pi - Target owner (player being targeted)
   * @param {object} selected - The selected target
   * @param {Array} validTargets - All valid targets for the effect
   * @param {object} config - Targeting config from promptDamageTarget
   * @param {object} engine - Engine instance
   * @returns {boolean}
   */
  canRedirect(gs, pi, selected, validTargets, config, engine) {
    // Must be targeting something the player controls
    if (selected.owner !== pi) return false;

    // Must have at least one eligible redirect hero
    return getEligibleRedirectHeroes(gs, pi, selected, validTargets).length > 0;
  },

  /**
   * Execute the redirect: hero selection + chain visualization.
   * @returns {{ redirectTo: object }|null}
   */
  onRedirect: async (engine, pi, selected, validTargets, config, sourceCard) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const eligible = getEligibleRedirectHeroes(gs, pi, selected, validTargets);
    if (eligible.length === 0) return null;

    // ── Select Hero to take the hit ──
    let selectedHeroIdx;
    if (eligible.length === 1) {
      selectedHeroIdx = eligible[0];
    } else {
      const heroTargets = eligible.map(hi => ({
        id: `hero-${pi}-${hi}`,
        type: 'hero',
        owner: pi,
        heroIdx: hi,
        cardName: ps.heroes[hi].name,
      }));

      const picked = await engine.promptEffectTarget(pi, heroTargets, {
        title: 'Challenge',
        description: 'Select a Hero to take the Challenge.',
        confirmLabel: '⚔️ Challenge!',
        confirmClass: 'btn-danger',
        cancellable: true,
        exclusiveTypes: true,
        maxPerType: { hero: 1 },
        greenSelect: true,
      });

      if (!picked || picked.length === 0) return null; // Cancelled
      const target = heroTargets.find(t => t.id === picked[0]);
      if (!target) return null;
      selectedHeroIdx = target.heroIdx;
    }

    const challengeHero = ps.heroes[selectedHeroIdx];
    if (!challengeHero?.name) return null;

    // ── Chain visualization ──
    const attackerName = config.title || sourceCard?.name || 'Effect';
    const chain = [
      {
        id: 'redirect-source',
        cardName: attackerName,
        owner: sourceCard?.controller ?? sourceCard?.owner ?? (pi === 0 ? 1 : 0),
        cardType: config.damageType === 'attack' ? 'Attack' : 'Spell',
        isInitialCard: true,
        negated: false,
        chainClosed: false,
      },
      {
        id: 'redirect-challenge',
        cardName: 'Challenge',
        owner: pi,
        cardType: 'Attack',
        isInitialCard: false,
        negated: false,
        chainClosed: false,
      },
    ];
    engine._broadcastChainUpdate(chain);
    await engine._delay(800);

    // Show chain resolving
    engine._broadcastEvent('reaction_chain_resolving_start', { chain });
    await engine._delay(400);
    engine._broadcastEvent('reaction_chain_link_resolving', { index: 1, cardName: 'Challenge' });
    await engine._delay(600);
    engine._broadcastEvent('reaction_chain_done', {});

    // ── Play 💢 on the attacker and the Challenge hero ──
    // If the source is a creature (support zone), show on the creature's slot, not the hero
    const attackerOwner = sourceCard?.controller ?? sourceCard?.owner ?? (pi === 0 ? 1 : 0);
    const attackerHeroIdx = sourceCard?.heroIdx ?? 0;
    const attackerZoneSlot = sourceCard?.zone === 'support' ? (sourceCard?.zoneSlot ?? -1) : -1;
    engine._broadcastEvent('play_zone_animation', {
      type: 'anger_mark', owner: attackerOwner, heroIdx: attackerHeroIdx, zoneSlot: attackerZoneSlot,
    });
    engine._broadcastEvent('play_zone_animation', {
      type: 'anger_mark', owner: pi, heroIdx: selectedHeroIdx, zoneSlot: -1,
    });
    await engine._delay(600);

    // ── Build the redirect target ──
    // Find the matching target in validTargets for the Challenge hero
    const redirectTarget = validTargets.find(t =>
      t.type === 'hero' && t.owner === pi && t.heroIdx === selectedHeroIdx
    );

    if (!redirectTarget) return null;

    engine.log('challenge', {
      player: ps.username,
      challengeHero: challengeHero.name,
      originalTarget: selected.cardName,
      attacker: attackerName,
    });
    engine.sync();

    return { redirectTo: redirectTarget };
  },
};
