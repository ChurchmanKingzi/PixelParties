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

const { heldenSperreKey } = require('./_hero-hopt-shared');   // v1275: Heldensperre pro Spieler (Ruling 22.9.)

/**
 * Umleitungsziele: „any of your Heroes that has a Surprise in its Surprise
 * Zone" — Kontrolle statt Seite (Styx 28.9.): alle Helden, die `ownerIdx`
 * kontrolliert (auch uebernommene der Gegenspalte), Surprise-Zone auf der
 * Brettseite, ohne das urspruengliche Ziel (Seite + Index).
 */
function umleitungsZiele(gs, ownerIdx, selected, engine) {
  const out = [];
  const helden = engine?.heroesControlledBy
    ? engine.heroesControlledBy(ownerIdx)
    : (gs.players[ownerIdx]?.heroes || []).map((hero, heroIdx) => ({ physOwner: ownerIdx, heroIdx, hero }));
  for (const { physOwner, heroIdx: hi, hero } of helden) {
    if (selected.type === 'hero' && selected.owner === physOwner && selected.heroIdx === hi) continue;
    if (!hero?.name || hero.hp <= 0) continue;
    const surprises = (gs.players[physOwner]?.surpriseZones || [])[hi] || [];
    if (surprises.length === 0) continue;
    out.push({ id: `hero-${physOwner}-${hi}`, type: 'hero', owner: physOwner, heroIdx: hi, cardName: hero.name });
  }
  return out;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,
  heroRedirect: true,

  /**
   * CPU behavior: always redirect when possible, pick first valid target.
   */
  cpuResponse(engine, promptType, promptData) {
    if (promptType === 'generic') {
      // Redirect-Confirm: Protection-Lernkanal statt Pauschal-Accept —
      // gelernte Regel (protectionRules) > 50/50-Exploration im
      // Training > Accept-Default live. Features (Schaden/Ziel-HP)
      // kommen als protMeta vom Engine-Redirect-Prompt.
      if (promptData.type === 'confirm') {
        const { protectionDecision } = require('./_deck-profile');
        if (typeof protectionDecision !== 'function') return { confirmed: true }; // Teildeployment-Schutz
        const meta = promptData.protMeta || { d: 0, hp: 1 };
        const pi = typeof meta.pi === 'number' ? meta.pi : engine._cpuPlayerIdx;
        return { confirmed: protectionDecision(engine, pi, promptData.title, meta) };
      }
      // Pick first redirect target from gallery
      if (promptData.type === 'cardGallery') {
        const cards = promptData.cards || [];
        if (cards.length > 0) return { cardName: cards[0].name, source: cards[0].source };
      }
    }
    return undefined; // Fall through to default
  },

  /**
   * Can this Alleria redirect the incoming effect?
   * Conditions:
   *  - Exactly 1 target on Alleria's side was selected
   *  - At least 1 OTHER hero (not the target) has a Surprise in its Surprise Zone
   *  - Soft HOPT not yet consumed this turn
   */
  canHeroRedirect(gs, ownerIdx, heroIdx, selected, validTargets, config, engine, sourceCard) {
    // HOPT check
    const hoptKey = heldenSperreKey('alleria_redirect', ownerIdx);
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    // v637: „for an Attack, Spell or Creature effect" — Helden-, Artefakt-,
    // Potion- und Ability-Effekte werden NICHT umgeleitet (Als Befund:
    // Lockes Turn-Start-Effekt wurde umgeleitet). Ohne bekannte Quelle
    // keine Umleitung.
    const kind = engine?.sourceEffectKind ? engine.sourceEffectKind(sourceCard) : null;
    if (kind !== 'attack' && kind !== 'spell' && kind !== 'creature') return false;

    // Only redirect hero targets on our own side
    // Kontrolle statt Seite (Styx 28.9.).
    if (selected.type !== 'hero' || (engine?.zielSeite ? engine.zielSeite(selected) : selected.owner) !== ownerIdx) return false;

    // Check for at least 1 OTHER hero with a Surprise in its Surprise Zone
    if (!gs.players[ownerIdx]) return false;
    return umleitungsZiele(gs, ownerIdx, selected, engine).length > 0;
  },

  /**
   * Execute the redirect: prompt player to choose a hero with a Surprise.
   * Returns { redirectTo } or null if cancelled.
   */
  async onHeroRedirect(engine, ownerIdx, heroIdx, selected, validTargets, config, sourceCard, physOwner = ownerIdx) {
    const gs = engine.gs;

    // Build list of eligible redirect targets (controlled heroes with Surprises, not original target)
    const eligible = umleitungsZiele(gs, ownerIdx, selected, engine);

    if (eligible.length === 0) return null;

    // If only one option, auto-select
    let redirectTarget;
    if (eligible.length === 1) {
      redirectTarget = eligible[0];
    } else {
      // Prompt player to pick which hero to redirect to
      const result = await engine.promptGeneric(ownerIdx, {
        type: 'cardGallery',
        // `source` = Ziel-ID: der Client schickt sie unveraendert zurueck
        // (gleichnamige Helden beider Seiten bleiben unterscheidbar).
        cards: eligible.map(t => ({ name: t.cardName, source: t.id, heroIdx: t.heroIdx, owner: t.owner })),
        title: 'Alleria, the Queen of Spiders',
        description: 'Choose a Hero with a Surprise to redirect the effect to:',
        cancellable: true,
      });

      if (!result || result.cancelled) return null;
      // Treffer ueber Seite + Index (Ziel-ID in `source`), Name als Rueckfall.
      redirectTarget = eligible.find(t => t.id === result.source)
        || eligible.find(t => t.cardName === result.cardName) || eligible[0];
    }

    // Claim HOPT
    if (!gs.hoptUsed) gs.hoptUsed = {};
    const hoptKey = heldenSperreKey('alleria_redirect', ownerIdx);
    gs.hoptUsed[hoptKey] = gs.turn;

    // Spider animation: thread from original target to new target
    const srcOwnerLabel = selected.owner;
    const tgtOwnerLabel = redirectTarget.owner;
    engine._broadcastEvent('alleria_spider_redirect', {
      srcOwner: srcOwnerLabel,
      srcHeroIdx: selected.heroIdx,
      tgtOwner: tgtOwnerLabel,
      tgtHeroIdx: redirectTarget.heroIdx,
      alleriaOwner: physOwner,   // Brettseite (Styx 28.9.)
      alleriaHeroIdx: heroIdx,
    });
    await engine._delay(1000);

    // Mark the redirected damage as only reducible by Surprises
    // This flag is checked by the engine's BEFORE_DAMAGE hook handlers
    gs._redirectedOnlyReducibleBySurprise = true;

    // Sparkle on Alleria
    engine._broadcastEvent('play_zone_animation', {
      type: 'gold_sparkle',
      owner: physOwner, heroIdx, zoneSlot: -1,
    });

    return { redirectTo: redirectTarget };
  },

  hooks: {
    /**
     * When a Surprise in Alleria's Surprise Zone activates, draw 1 card.
     */
    onSurpriseActivated: async (ctx) => {
      // „this Hero's Surprise Zone": Brettseite + Index (Styx 28.9.).
      if (ctx.surpriseOwner !== (ctx.cardHeroOwner ?? ctx.cardOriginalOwner)) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      // Alleria must be alive and not incapacitated
      const hero = ctx.attachedHero;
      if (!hero || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      const engine = ctx._engine;
      const pi = ctx.cardOwner;   // „draw" = Kontrolleur (Styx 28.9.)

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
