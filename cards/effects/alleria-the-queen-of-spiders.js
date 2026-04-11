// ═══════════════════════════════════════════
//  CARD EFFECT: "Alleria, the Queen of Spiders"
//  Hero — Two effects:
//  1) When a Surprise in this Hero's Surprise
//     Zone activates, draw 1 card.
//  2) Soft once per turn: redirect an opponent's
//     single-target Attack/Spell/Creature effect
//     to a Hero with a Surprise. Redirected damage
//     cannot be reduced except by Surprises.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,
  heroRedirect: true,

  /**
   * Can this Alleria redirect the incoming effect?
   * Conditions:
   *  - Exactly 1 target on Alleria's side was selected
   *  - At least 1 OTHER hero (not the target) has a Surprise in its Surprise Zone
   *  - Soft HOPT not yet consumed this turn
   */
  canHeroRedirect(gs, ownerIdx, heroIdx, selected, validTargets, config, engine) {
    // HOPT check
    const hoptKey = `alleria_redirect:${ownerIdx}:${heroIdx}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;

    // Only redirect hero targets on our own side
    if (selected.type !== 'hero' || selected.owner !== ownerIdx) return false;

    // Check for at least 1 OTHER hero with a Surprise in its Surprise Zone
    const ps = gs.players[ownerIdx];
    if (!ps) return false;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (hi === selected.heroIdx) continue; // Skip the original target
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      const surprises = (ps.surpriseZones || [])[hi] || [];
      if (surprises.length > 0) return true;
    }
    return false;
  },

  /**
   * Execute the redirect: prompt player to choose a hero with a Surprise.
   * Returns { redirectTo } or null if cancelled.
   */
  async onHeroRedirect(engine, ownerIdx, heroIdx, selected, validTargets, config, sourceCard) {
    const gs = engine.gs;
    const ps = gs.players[ownerIdx];

    // Build list of eligible redirect targets (own heroes with Surprises, not original target)
    const eligible = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (hi === selected.heroIdx) continue;
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      const surprises = (ps.surpriseZones || [])[hi] || [];
      if (surprises.length > 0) {
        eligible.push({
          id: `hero-${ownerIdx}-${hi}`,
          type: 'hero',
          owner: ownerIdx,
          heroIdx: hi,
          cardName: hero.name,
        });
      }
    }

    if (eligible.length === 0) return null;

    // If only one option, auto-select
    let redirectTarget;
    if (eligible.length === 1) {
      redirectTarget = eligible[0];
    } else {
      // Prompt player to pick which hero to redirect to
      const result = await engine.promptGeneric(ownerIdx, {
        type: 'cardGallery',
        cards: eligible.map(t => ({ name: t.cardName, source: 'hero', heroIdx: t.heroIdx })),
        title: 'Alleria — Redirect Target',
        description: 'Choose a Hero with a Surprise to redirect the effect to:',
        cancellable: true,
      });

      if (!result || result.cancelled) return null;
      redirectTarget = eligible.find(t => t.cardName === result.cardName) || eligible[0];
    }

    // Claim HOPT
    if (!gs.hoptUsed) gs.hoptUsed = {};
    const hoptKey = `alleria_redirect:${ownerIdx}:${heroIdx}`;
    gs.hoptUsed[hoptKey] = gs.turn;

    // Spider animation: thread from original target to new target
    const srcOwnerLabel = selected.owner;
    const tgtOwnerLabel = redirectTarget.owner;
    engine._broadcastEvent('alleria_spider_redirect', {
      srcOwner: srcOwnerLabel,
      srcHeroIdx: selected.heroIdx,
      tgtOwner: tgtOwnerLabel,
      tgtHeroIdx: redirectTarget.heroIdx,
      alleriaOwner: ownerIdx,
      alleriaHeroIdx: heroIdx,
    });
    await engine._delay(1000);

    // Mark the redirected damage as only reducible by Surprises
    // This flag is checked by the engine's BEFORE_DAMAGE hook handlers
    gs._redirectedOnlyReducibleBySurprise = true;

    // Sparkle on Alleria
    engine._broadcastEvent('play_zone_animation', {
      type: 'gold_sparkle',
      owner: ownerIdx, heroIdx, zoneSlot: -1,
    });

    return { redirectTo: redirectTarget };
  },

  hooks: {
    /**
     * When a Surprise in Alleria's Surprise Zone activates, draw 1 card.
     */
    onSurpriseActivated: async (ctx) => {
      if (ctx.surpriseOwner !== ctx.cardOriginalOwner) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      // Alleria must be alive and not incapacitated
      const hero = ctx.attachedHero;
      if (!hero || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      const engine = ctx._engine;
      const pi = ctx.cardOriginalOwner;

      await engine.actionDrawCards(pi, 1);

      // Sparkle animation on Alleria
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle',
        owner: ctx.cardHeroOwner, heroIdx: ctx.cardHeroIdx, zoneSlot: -1,
      });

      engine.log('alleria_surprise_draw', {
        player: engine.gs.players[pi]?.username,
        surprise: ctx.surpriseCardName,
      });
      engine.sync();
    },
  },
};
