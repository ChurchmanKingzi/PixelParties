// ═══════════════════════════════════════════
//  CARD EFFECT: "Trapping"
//  Ability — Hard once per turn free activation.
//  Search deck for a Surprise with level ≤
//  Trapping level. Place it face-down in a
//  free Surprise Zone (or Bakhm Support Zone).
//  Opponent can see it (knownToOpponent).
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,

  canFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs = engine.gs;
    // Use cardHeroOwner for the hero's physical side (matters when controlled by opponent)
    const pi = ctx.cardHeroOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    if (!ps) return false;
    // Styx 28.9.: „your deck" = Deck des Kontrolleurs (uebernommen: Uebernehmer).
    const aktivierer = ctx.cardController ?? ctx.cardOwner;
    const deckPs = gs.players[aktivierer];
    if (!deckPs) return false;

    // Check for a free placement zone
    const { hasSurpriseZone, hasBakhmSlot } = _getFreePlacementZones(ps, heroIdx, pi, engine);
    if (!hasSurpriseZone && !hasBakhmSlot) return false;

    // Check for 1+ eligible Surprises in deck (effective level —
    // honours hand-active `reduceCardLevel` reducers, e.g. a Whoolmoth
    // in hand reducing every Whoolmoth-named card by 5).
    const cardDB = engine._getCardDB();
    const onlyCreatures = !hasSurpriseZone && hasBakhmSlot;
    for (const cn of (deckPs.mainDeck || [])) {
      const cd = cardDB[cn];
      if (!cd || (cd.subtype || '').toLowerCase() !== 'surprise') continue;
      if (engine.effectiveCardLevel(cd, aktivierer) > level) continue;
      if (onlyCreatures && cd.cardType !== 'Creature') continue;
      return true; // At least one eligible surprise exists
    }
    return false;
  },

  async onFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs = engine.gs;
    // Use cardHeroOwner for the hero's physical side (matters when controlled by opponent)
    const pi = ctx.cardHeroOwner;
    const heroIdx = ctx.cardHeroIdx;
    // Styx 28.9.: der Aktivierende ist der KONTROLLEUR des Helden (Charme,
    // Styx …) — sein Deck, seine Abfragen. `cardOriginalOwner` waere die
    // Brettseite. Gelegt wird in die Zone DIESES Helden (Brettseite `pi`).
    const activator = ctx.cardController ?? ctx.cardOwner;
    const ps = gs.players[pi];
    const deckPs = gs.players[activator];
    if (!ps || !deckPs) return false;

    const cardDB = engine._getCardDB();

    // Determine free zones
    const { hasSurpriseZone, hasBakhmSlot, bakhmFreeSlots } = _getFreePlacementZones(ps, heroIdx, pi, engine);
    if (!hasSurpriseZone && !hasBakhmSlot) return false;

    const onlyCreatures = !hasSurpriseZone && hasBakhmSlot;

    // Build deduplicated gallery of eligible Surprises
    const seen = new Set();
    const galleryCards = [];
    for (const cn of (deckPs.mainDeck || [])) {
      if (seen.has(cn)) continue;
      const cd = cardDB[cn];
      if (!cd || (cd.subtype || '').toLowerCase() !== 'surprise') continue;
      if (engine.effectiveCardLevel(cd, activator) > level) continue;
      if (onlyCreatures && cd.cardType !== 'Creature') continue;
      seen.add(cn);
      galleryCards.push({ name: cn, source: 'deck' });
    }
    galleryCards.sort((a, b) => a.name.localeCompare(b.name));

    if (galleryCards.length === 0) return false;

    // Prompt the activating player to pick a Surprise
    const result = await engine.promptGeneric(activator, {
      type: 'cardGallery',
      cards: galleryCards,
      title: `Trapping (Lv${level})`,
      description: `Choose a Surprise (Lv${level} or lower) from your deck to set face-down.`,
      cancellable: true,
    });

    if (!result || result.cancelled || !result.cardName) return false;
    const chosenName = result.cardName;
    if (!seen.has(chosenName)) return false;

    const chosenData = cardDB[chosenName];
    const isCreature = chosenData?.cardType === 'Creature';

    // Remove from deck
    const _taken_deckIdx = await engine.takeFromPile(deckPs, 'deck', chosenName, { source: 'trapping' });   // v820: Stapel-Schicht
    if (!_taken_deckIdx) return false;

    // Shuffle deck
    engine.shuffleDeck(activator);

    // Reveal the chosen card to opponent (opponent confirms)
    const oppIdx = engine.opponentOf(activator);
    engine._broadcastEvent('card_reveal', { cardName: chosenName });
    engine.sync();
    await engine._delay(500);
    await engine.promptGeneric(oppIdx, {
      type: 'deckSearchReveal',
      cardName: chosenName,
      searcherName: gs.players[activator]?.username || 'Opponent',
      title: 'Trapping',
      cancellable: false,
    });

    // Determine placement zone
    let placementZone = 'surprise'; // default
    let placementSlot = 0;

    if (isCreature && hasBakhmSlot && hasSurpriseZone) {
      // Both options available — let player choose
      const options = [
        { id: 'surprise', label: '🎭 Surprise Zone', description: 'Place face-down in this Hero\'s Surprise Zone.', color: '#aa44ff' },
      ];
      for (const si of bakhmFreeSlots) {
        options.push({ id: `support-${si}`, label: `🛡️ Support Zone ${si + 1}`, description: `Place face-down in Support Zone ${si + 1}.`, color: '#44aaff' });
      }
      const zoneChoice = await engine.promptGeneric(activator, {
        type: 'optionPicker',
        title: 'Trapping — Placement',
        description: `Where should ${chosenName} be placed?`,
        options,
        cancellable: false,
      });
      const picked = zoneChoice?.optionId || 'surprise';
      if (picked.startsWith('support-')) {
        placementZone = 'support';
        placementSlot = parseInt(picked.split('-')[1]);
      }
    } else if (!hasSurpriseZone && hasBakhmSlot) {
      // Only Bakhm slots available
      placementZone = 'support';
      placementSlot = bakhmFreeSlots[0];
    }

    // Place the card
    let inst;
    if (placementZone === 'support') {
      if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
      ps.supportZones[heroIdx][placementSlot] = [chosenName];
      inst = engine._trackCard(chosenName, pi, 'support', heroIdx, placementSlot);
    } else {
      if (!ps.surpriseZones[heroIdx]) ps.surpriseZones[heroIdx] = [];
      ps.surpriseZones[heroIdx] = [chosenName];
      inst = engine._trackCard(chosenName, pi, 'surprise', heroIdx, 0);
    }

    inst.faceDown = true;
    inst.knownToOpponent = true; // Opponent can see it semi-transparently
    // Kartenbesitzer = Aktivierender; die Zone bleibt die Brettseite.
    // Ausloesen scannt die Engine nur fuer die Brettseite
    // (`_getAllSurpriseEntries`) und nur, solange diese den Helden
    // kontrolliert (`_canHeroActivateSurprise`) — waehrend der Uebernahme
    // also fuer niemanden.
    if (activator !== pi) inst.originalOwner = activator;

    engine.log('trapping_set', {
      player: deckPs.username,
      hero: ps.heroes[heroIdx]?.name,
      card: chosenName,
      zone: placementZone,
    });

    // Fire onCardEnterZone hook
    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: placementZone, toHeroIdx: heroIdx,
      _skipReactionCheck: true,
    });

    engine.sync();
    return true;
  },
};

/**
 * Compute free placement zones for a hero.
 * Returns { hasSurpriseZone, hasBakhmSlot, bakhmFreeSlots }
 */
function _getFreePlacementZones(ps, heroIdx, pi, engine) {
  const hero = ps.heroes?.[heroIdx];
  const hasSurpriseZone = hero?.name && hero.hp > 0
    && ((ps.surpriseZones?.[heroIdx] || []).length === 0);

  let hasBakhmSlot = false;
  const bakhmFreeSlots = [];

  if (hero?.name && hero.hp > 0 && !hero.statuses?.frozen && !hero.statuses?.stunned && !hero.statuses?.negated) {
    const heroScript = loadCardEffect(hero.name);
    if (heroScript?.isBakhmHero) {
      for (let si = 0; si < 3; si++) {
        if (((ps.supportZones?.[heroIdx] || [])[si] || []).length === 0) {
          bakhmFreeSlots.push(si);
        }
      }
      hasBakhmSlot = bakhmFreeSlots.length > 0;
    }
  }

  return { hasSurpriseZone, hasBakhmSlot, bakhmFreeSlots };
}
