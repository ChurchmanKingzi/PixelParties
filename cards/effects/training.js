// ═══════════════════════════════════════════
//  CARD EFFECT: "Training"
//  Ability — Free activation during Main Phase
//  (no action cost). Effect varies by level:
//
//  Lv1: Attach 1 Ability from hand to this Hero
//       (does NOT consume the hero's per-turn
//       ability attachment).
//
//  Lv2: Option A — Attach up to 2 Abilities
//       from hand (same rules as Lv1).
//       Option B — Discard 1 card from hand,
//       then search deck for an Ability and
//       attach it to this Hero. This DOES
//       consume the hero's per-turn attachment.
//
//  Lv3: Option A — Attach up to 3 Abilities
//       from hand (same rules as Lv1).
//       Option B — Search deck for an Ability
//       and attach it to this Hero. NO discard
//       cost, does NOT consume per-turn attachment.
//
//  HOPT: Once ANY copy of Training resolves,
//  ALL copies are exhausted for the rest of the
//  turn (handled by the generic free-activation
//  system using ability-name-based HOPT keys).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const { loadCardEffect } = require('./_loader');

// ─── HELPERS ─────────────────────────────

/**
 * Get ability card names in hand that can be attached to a specific hero.
 * @returns {string[]} deduplicated list of eligible ability names
 */
function getEligibleHandAbilities(engine, playerIdx, heroIdx) {
  const ps = engine.gs.players[playerIdx];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const seen = new Set();
  const result = [];
  for (const cardName of (ps.hand || [])) {
    if (seen.has(cardName)) continue;
    const cd = cardDB[cardName];
    if (!cd || !hasCardType(cd, 'Ability')) continue;
    if (!engine.canAttachAbilityToHero(playerIdx, cardName, heroIdx)) continue;
    seen.add(cardName);
    result.push(cardName);
  }
  return result;
}

/**
 * Get ability card names in deck that can be attached to a specific hero.
 * @returns {{ name, source, count }[]} gallery-ready entries
 */
function getEligibleDeckAbilities(engine, playerIdx, heroIdx) {
  const ps = engine.gs.players[playerIdx];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const countMap = {};
  for (const cardName of (ps.mainDeck || [])) {
    const cd = cardDB[cardName];
    if (!cd || !hasCardType(cd, 'Ability')) continue;
    if (!engine.canAttachAbilityToHero(playerIdx, cardName, heroIdx)) continue;
    countMap[cardName] = (countMap[cardName] || 0) + 1;
  }
  return Object.entries(countMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, source: 'deck', count }));
}

/**
 * Run the "attach abilities from hand" flow (Option A).
 * Prompts the player to drag abilities onto the hero up to maxAttach times.
 * @param {number} trainingZoneIdx - Training's own zone slot (for activation flash)
 * @returns {number} how many abilities were attached (0 = fully cancelled)
 */
async function doHandAttach(engine, playerIdx, heroIdx, maxAttach, trainingZoneIdx) {
  let attached = 0;

  for (let i = 0; i < maxAttach; i++) {
    // Recalculate eligible each iteration (hand changes after each attach)
    const eligible = getEligibleHandAbilities(engine, playerIdx, heroIdx);
    if (eligible.length === 0) break;

    const heroName = engine.gs.players[playerIdx]?.heroes?.[heroIdx]?.name || 'Hero';
    const result = await engine.promptGeneric(playerIdx, {
      type: 'abilityAttach',
      heroIdx,
      eligibleCards: eligible,
      title: 'Training',
      description: maxAttach === 1
        ? `Attach an Ability to ${heroName}.`
        : `Attach an Ability to ${heroName} (${attached + 1}/${maxAttach}).`,
      cancellable: true,
      canFinish: attached > 0, // "Done" button after first successful attach
    });

    // Player cancelled or clicked "Done"
    if (!result || result.cancelled) break;
    if (result.finished) break;

    // Validate and attach
    const cardName = result.cardName;
    if (!cardName) break;

    // Keep cards dimmed during attachment (prevent brief un-dim flash)
    engine.gs.effectPrompt = {
      type: 'abilityAttach', ownerIdx: playerIdx, eligibleCards: [],
      heroIdx, title: 'Training', description: '', cancellable: false, canFinish: false,
    };

    const attachResult = await engine.attachAbilityFromHand(playerIdx, cardName, heroIdx, {
      skipAbilityGivenCheck: true, // Training attachments are always "extra"
      targetZoneSlot: result.zoneSlot, // Respect the player's chosen zone (important for Performance)
    });

    if (attachResult.success) {
      attached++;

      // First attachment = Training resolved → flash Training's own zone
      if (attached === 1) {
        engine._broadcastEvent('ability_activated', {
          owner: playerIdx, heroIdx, zoneIdx: trainingZoneIdx, abilityName: 'Training',
        });
        await engine._delay(400);
      }

      // Flash the TARGET ability zone where the new ability landed
      engine._broadcastEvent('ability_activated', {
        owner: playerIdx, heroIdx, zoneIdx: attachResult.zoneSlot, abilityName: cardName,
      });
      engine.sync();
      await engine._delay(300);
    }
  }

  // Clear placeholder prompt
  engine.gs.effectPrompt = null;
  engine.sync();

  return attached;
}

/**
 * Run the "search deck for ability" flow (Option B).
 * At level 2: costs 1 discard + consumes abilityGivenThisTurn.
 * At level 3: free + does NOT consume abilityGivenThisTurn.
 * @param {number} trainingZoneIdx - Training's own zone slot (for activation flash)
 * @returns {boolean} true if resolved (ability attached)
 */
async function doDeckSearch(engine, playerIdx, heroIdx, level, trainingZoneIdx) {
  const ps = engine.gs.players[playerIdx];
  if (!ps) return false;
  const heroName = ps.heroes?.[heroIdx]?.name || 'Hero';

  // Level 2: require a discard first (cancellable)
  if (level === 2) {
    if ((ps.hand || []).length === 0) return false;

    const discardResult = await engine.promptGeneric(playerIdx, {
      type: 'forceDiscardCancellable',
      title: 'Training — Discard Cost',
      description: `Discard 1 card to search your deck for an Ability for ${heroName}.`,
      cancellable: true,
    });

    if (!discardResult || discardResult.cancelled) return false;

    // Execute the discard
    const { cardName: discardName, handIndex } = discardResult;
    if (discardName === undefined || handIndex === undefined) return false;
    if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== discardName) return false;

    ps.hand.splice(handIndex, 1);
    ps.discardPile.push(discardName);
    engine.log('discard', { player: ps.username, card: discardName, by: 'Training' });
    await engine.runHooks('onDiscard', { playerIdx, cardName: discardName, _skipReactionCheck: true });

    // Lv2: Training resolves when discard cost is paid → flash Training zone now
    engine._broadcastEvent('ability_activated', {
      owner: playerIdx, heroIdx, zoneIdx: trainingZoneIdx, abilityName: 'Training',
    });
    engine.sync();
    await engine._delay(400);
  }

  // Show deck gallery picker (filtered for attachable abilities)
  const galleryCards = getEligibleDeckAbilities(engine, playerIdx, heroIdx);
  if (galleryCards.length === 0) {
    // Fizzle — no eligible abilities in deck
    // If level 2, the discard already happened (cost was paid, but effect fizzles)
    return false;
  }

  const picked = await engine.promptGeneric(playerIdx, {
    type: 'cardGallery',
    cards: galleryCards,
    title: 'Training',
    description: `Choose an Ability to attach to ${heroName}.`,
    cancellable: false, // Already committed (discard paid at Lv2, or free at Lv3)
  });

  if (!picked || !picked.cardName) return false;

  // Verify the card is in the deck
  const deckIdx = ps.mainDeck.indexOf(picked.cardName);
  if (deckIdx < 0) return false;

  // Remove from deck
  ps.mainDeck.splice(deckIdx, 1);

  // Attach to hero's ability zone
  const abZones = ps.abilityZones[heroIdx] || [[], [], []];
  ps.abilityZones[heroIdx] = abZones;
  const cardName = picked.cardName;
  const script = loadCardEffect(cardName);
  let targetZone = -1;

  if (script?.customPlacement) {
    for (let z = 0; z < 3; z++) {
      if (script.customPlacement.canPlace(abZones[z] || [])) { targetZone = z; break; }
    }
  } else {
    // Stack onto existing or find free zone
    for (let z = 0; z < 3; z++) {
      if ((abZones[z] || []).length > 0 && abZones[z][0] === cardName && abZones[z].length < 3) {
        targetZone = z; break;
      }
    }
    if (targetZone < 0) {
      for (let z = 0; z < 3; z++) {
        if ((abZones[z] || []).length === 0) { targetZone = z; break; }
      }
    }
  }

  if (targetZone < 0) return false; // No valid zone — shouldn't happen if canAttach was checked

  if (!abZones[targetZone]) abZones[targetZone] = [];
  abZones[targetZone].push(cardName);

  // Level 2 consumes abilityGivenThisTurn; Level 3 does not
  if (level === 2) {
    ps.abilityGivenThisTurn[heroIdx] = true;
  }

  // Track card instance and fire hooks
  const inst = engine._trackCard(cardName, playerIdx, 'ability', heroIdx, targetZone);
  engine._broadcastEvent('deck_search_add', { cardName, playerIdx });
  engine.log('deck_search', { player: ps.username, card: cardName, by: 'Training' });

  await engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'ability', heroIdx, _skipReactionCheck: true });
  await engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'ability', toHeroIdx: heroIdx, _skipReactionCheck: true });

  // Lv3: Training resolves when attachment happens → flash Training zone now
  if (level === 3) {
    engine._broadcastEvent('ability_activated', {
      owner: playerIdx, heroIdx, zoneIdx: trainingZoneIdx, abilityName: 'Training',
    });
  }

  // Flash the target ability zone immediately (no gap between placement and flash)
  engine._broadcastEvent('ability_activated', {
    owner: playerIdx, heroIdx, zoneIdx: targetZone, abilityName: cardName,
  });
  engine.sync();
  await engine._delay(1200);

  return true;
}

// ─── CARD MODULE ─────────────────────────

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,

  // Gerrymander redirect — pick `hand` so opp consumes a hand card
  // for the attach, shrinking their hand. The deck-search path
  // expands their options instead, which is generally better for
  // them long-term.
  cpuGerrymanderResponse(/* engine, gerryOwnerPi, promptData */) {
    return { optionId: 'hand' };
  },

  /**
   * Check if this specific Training instance can be activated right now.
   * Called by the engine's getFreeActivatableAbilities (after HOPT check).
   */
  canFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;

    const hasHandAbilities = getEligibleHandAbilities(engine, pi, heroIdx).length > 0;
    const hasDeckAbilities = getEligibleDeckAbilities(engine, pi, heroIdx).length > 0;
    const ps = ctx.players[pi];
    const hasCardsInHand = (ps.hand || []).length > 0;

    switch (level) {
      case 1:
        // Need eligible abilities in hand
        return hasHandAbilities;
      case 2:
        // Option A: eligible hand abilities, OR
        // Option B: eligible deck abilities AND cards in hand to discard
        //   Option B costs the hero's per-turn attachment, so it must be unspent.
        return hasHandAbilities || (hasDeckAbilities && hasCardsInHand && !(ps.abilityGivenThisTurn || [])[heroIdx]);
      case 3:
        // Option A: eligible hand abilities, OR
        // Option B: eligible deck abilities (no discard, no abilityGiven cost)
        return hasHandAbilities || hasDeckAbilities;
      default:
        return hasHandAbilities;
    }
  },

  /**
   * Execute the Training effect. Called when the player clicks the ability.
   * Returns true if the effect resolved (HOPT should be claimed),
   * false if cancelled (HOPT not claimed).
   */
  async onFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const trainingZoneIdx = ctx.card.zoneSlot; // Training's own ability zone slot
    const ps = ctx.players[pi];
    const heroName = ps.heroes?.[heroIdx]?.name || 'Hero';

    // ── Level 1 ──
    if (level === 1) {
      const attached = await doHandAttach(engine, pi, heroIdx, 1, trainingZoneIdx);
      return attached > 0;
    }

    // ── Levels 2 & 3 ──
    const maxHandAttach = level === 2 ? 2 : 3;
    const hasHandAbilities = getEligibleHandAbilities(engine, pi, heroIdx).length > 0;
    const hasDeckAbilities = getEligibleDeckAbilities(engine, pi, heroIdx).length > 0;
    const hasCardsInHand = (ps.hand || []).length > 0;
    const abilityGivenBlocked = (ps.abilityGivenThisTurn || [])[heroIdx];
    const canOptionA = hasHandAbilities;
    const canOptionB = level === 3
      ? hasDeckAbilities
      : (hasDeckAbilities && hasCardsInHand && !abilityGivenBlocked);

    // If only one option is available, auto-select
    if (canOptionA && !canOptionB) {
      const attached = await doHandAttach(engine, pi, heroIdx, maxHandAttach, trainingZoneIdx);
      return attached > 0;
    }
    if (!canOptionA && canOptionB) {
      const resolved = await doDeckSearch(engine, pi, heroIdx, level, trainingZoneIdx);
      return resolved;
    }
    if (!canOptionA && !canOptionB) return false; // Shouldn't happen (canFreeActivate guards this)

    // Both options available — let the player choose
    const optionA = {
      id: 'hand',
      label: `Attach from Hand (up to ${maxHandAttach})`,
      description: `Drag up to ${maxHandAttach} Abilities from your hand onto ${heroName}.`,
      color: '#7fffaa',
    };
    const optionB = level === 3
      ? {
          id: 'deck',
          label: 'Search Deck',
          description: `Attach 1 Ability from your deck to ${heroName}. No cost.`,
          color: 'var(--accent)',
        }
      : {
          id: 'deck',
          label: 'Search Deck (costs 1 Discard)',
          description: `Discard 1 card, then attach 1 Ability from your deck to ${heroName}.`,
          color: 'var(--accent)',
        };

    const choice = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      title: `Training Lv.${level} — ${heroName}`,
      description: 'Choose an effect:',
      options: [optionA, optionB],
      cancellable: true,
      gerrymanderEligible: true, // Hand attach vs Deck search are distinct effects.
    });

    if (!choice || choice.cancelled) return false;

    if (choice.optionId === 'hand') {
      const attached = await doHandAttach(engine, pi, heroIdx, maxHandAttach, trainingZoneIdx);
      return attached > 0;
    }
    if (choice.optionId === 'deck') {
      const resolved = await doDeckSearch(engine, pi, heroIdx, level, trainingZoneIdx);
      return resolved;
    }

    return false;
  },
};
