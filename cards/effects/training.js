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
function getEligibleHandAbilities(engine, playerIdx, heroIdx, feld = playerIdx) {
  const ps = engine.gs.players[playerIdx];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const seen = new Set();
  const result = [];
  for (const cardName of (ps.hand || [])) {
    if (seen.has(cardName)) continue;
    const cd = cardDB[cardName];
    if (!cd || !hasCardType(cd, 'Ability')) continue;
    // Styx 28.9.: Held und Zonen auf der Brettseite (`feld`), Hand = `playerIdx`.
    if (!engine.canAttachAbilityToHero(feld, cardName, heroIdx)) continue;
    seen.add(cardName);
    result.push(cardName);
  }
  return result;
}

/**
 * Get ability card names in deck that can be attached to a specific hero.
 * @returns {{ name, source, count }[]} gallery-ready entries
 */
function getEligibleDeckAbilities(engine, playerIdx, heroIdx, feld = playerIdx) {
  const ps = engine.gs.players[playerIdx];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const countMap = {};
  for (const cardName of (ps.mainDeck || [])) {
    const cd = cardDB[cardName];
    if (!cd || !hasCardType(cd, 'Ability')) continue;
    if (!engine.canAttachAbilityToHero(feld, cardName, heroIdx)) continue;
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
async function doHandAttach(engine, playerIdx, heroIdx, maxAttach, trainingZoneIdx, feld = playerIdx) {
  if (feld !== playerIdx) return doHandAttachFremd(engine, playerIdx, heroIdx, maxAttach, trainingZoneIdx, feld);
  let attached = 0;

  for (let i = 0; i < maxAttach; i++) {
    // Recalculate eligible each iteration (hand changes after each attach)
    const eligible = getEligibleHandAbilities(engine, playerIdx, heroIdx);
    if (eligible.length === 0) break;

    const heroName = engine.gs.players[playerIdx]?.heroes?.[heroIdx]?.name || 'Hero';
    const result = await engine.promptGeneric(playerIdx, {
      type: 'abilityAttach',
      ownerIdx: playerIdx, // Used by CPU cpuResponse to look up the prompted player's state.
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
 * Styx 28.9.: Option A fuer einen GELIEHENEN Helden (Brettseite `feld`).
 * Das Zieh-Prompt `abilityAttach` kennt nur eigene Helden — hier waehlt
 * der Spieler die Ability per `handPick`, angelegt wird seitenfremd ueber
 * `attachAbilityFromHand(…, { heroOwner })` (wie `doPlayAbilityFremd`).
 */
async function doHandAttachFremd(engine, playerIdx, heroIdx, maxAttach, trainingZoneIdx, feld) {
  const ps = engine.gs.players[playerIdx];
  const heroName = engine.gs.players[feld]?.heroes?.[heroIdx]?.name || 'Hero';
  let attached = 0;
  for (let i = 0; i < maxAttach; i++) {
    const eligible = getEligibleHandAbilities(engine, playerIdx, heroIdx, feld);
    if (eligible.length === 0) break;
    const indices = (ps.hand || []).map((n, idx) => (eligible.includes(n) ? idx : -1)).filter(idx => idx >= 0);
    const result = await engine.promptGeneric(playerIdx, {
      type: 'handPick', title: 'Training',
      description: maxAttach === 1
        ? `Attach an Ability to ${heroName}.`
        : `Attach an Ability to ${heroName} (${attached + 1}/${maxAttach}).`,
      eligibleIndices: indices, minSelect: 1, maxSelect: 1,
      cancellable: true, confirmLabel: '📚 Attach!', pickIntent: 'use',
    });
    const pick = result && !result.cancelled && Array.isArray(result.selectedCards) ? result.selectedCards[0] : null;
    if (!pick?.cardName || !eligible.includes(pick.cardName)) break;
    const attachResult = await engine.attachAbilityFromHand(playerIdx, pick.cardName, heroIdx, {
      skipAbilityGivenCheck: true, heroOwner: feld,
    });
    if (!attachResult.success) break;
    attached++;
    if (attached === 1) {
      engine._broadcastEvent('ability_activated', {
        owner: feld, heroIdx, zoneIdx: trainingZoneIdx, abilityName: 'Training',
      });
      await engine._delay(400);
    }
    engine._broadcastEvent('ability_activated', {
      owner: feld, heroIdx, zoneIdx: attachResult.zoneSlot, abilityName: pick.cardName,
    });
    engine.sync();
    await engine._delay(300);
  }
  return attached;
}

/**
 * Run the "search deck for ability" flow (Option B).
 * At level 2: costs 1 discard + consumes abilityGivenThisTurn.
 * At level 3: free + does NOT consume abilityGivenThisTurn.
 * @param {number} trainingZoneIdx - Training's own zone slot (for activation flash)
 * @returns {boolean} true if resolved (ability attached)
 */
async function doDeckSearch(engine, playerIdx, heroIdx, level, trainingZoneIdx, feld = playerIdx) {
  const ps = engine.gs.players[playerIdx];
  if (!ps) return false;
  // Styx 28.9.: Deck/Ablage/Hand = `playerIdx`, Held und Zonen = `feld`.
  const hps = engine.gs.players[feld];
  if (!hps) return false;
  const heroName = hps.heroes?.[heroIdx]?.name || 'Hero';

  // Level 2: require a discard first (cancellable)
  if (level === 2) {
    if ((ps.hand || []).length === 0) return false;

    const discardResult = await engine.promptGeneric(playerIdx, {
      type: 'forceDiscardCancellable',
      costFor: 'Training',          // ★ v1041: Kosten-Abwurf-Lernkanal
      costKind: 'tutor',
      title: 'Training — Discard Cost',
      description: `Discard 1 card to search your deck for an Ability for ${heroName}.`,
      cancellable: true,
    });

    if (!discardResult || discardResult.cancelled) return false;

    // Execute the discard
    const { cardName: discardName, handIndex } = discardResult;
    if (discardName === undefined || handIndex === undefined) return false;
    if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== discardName) return false;

    // v1394: Abwurf über die zentrale Funktion.
    if (!(await engine.actionDiscardHandCard(playerIdx, discardName, handIndex, { source: 'Training', _noGlow: true }))) return false;

    // Lv2: Training resolves when discard cost is paid → flash Training zone now
    engine._broadcastEvent('ability_activated', {
      owner: feld, heroIdx, zoneIdx: trainingZoneIdx, abilityName: 'Training',
    });
    engine.sync();
    await engine._delay(400);
  }

  // Show deck gallery picker (filtered for attachable abilities)
  const galleryCards = getEligibleDeckAbilities(engine, playerIdx, heroIdx, feld);
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
  const _taken_deckIdx = await engine.takeFromPile(ps, 'deck', picked.cardName, { source: 'training' });   // v820: Stapel-Schicht
  if (!_taken_deckIdx) return false;

  // Attach to hero's ability zone
  const abZones = hps.abilityZones[heroIdx] || [[], [], []];
  hps.abilityZones[heroIdx] = abZones;
  const cardName = picked.cardName;
  const script = loadCardEffect(cardName);
  void script;
  // v1349: Zonenwahl an EINER Stelle (`engine.abilityZielZone` — auch
  // customPlacement; verwahrte Abilities, Madame Guillotine).
  const targetZone = engine.abilityZielZone(feld, heroIdx, cardName);

  if (targetZone < 0) return false; // No valid zone — shouldn't happen if canAttach was checked

  if (!abZones[targetZone]) abZones[targetZone] = [];
  abZones[targetZone].push(cardName);

  // Level 2 consumes abilityGivenThisTurn; Level 3 does not
  if (level === 2) {
    if (feld === playerIdx) ps.abilityGivenThisTurn[heroIdx] = true;
    else {
      // Geliehener Held: sein Anlegen dieses Zuges ist die Styx-Marke.
      const h = hps.heroes?.[heroIdx];
      if (h) h._abilityZug = engine.gs.turn;
    }
  }

  // Track card instance and fire hooks
  const inst = engine._trackCard(cardName, feld, 'ability', heroIdx, targetZone);
  if (feld !== playerIdx) inst.originalOwner = playerIdx;   // Karte aus meinem Deck
  engine._broadcastEvent('deck_search_add', { cardName, playerIdx });
  engine.log('deck_search', { player: ps.username, card: cardName, by: 'Training' });

  await engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'ability', heroIdx, _skipReactionCheck: true });
  await engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'ability', toHeroIdx: heroIdx, _skipReactionCheck: true });

  // Lv3: Training resolves when attachment happens → flash Training zone now
  if (level === 3) {
    engine._broadcastEvent('ability_activated', {
      owner: feld, heroIdx, zoneIdx: trainingZoneIdx, abilityName: 'Training',
    });
  }

  // Flash the target ability zone immediately (no gap between placement and flash)
  engine._broadcastEvent('ability_activated', {
    owner: feld, heroIdx, zoneIdx: targetZone, abilityName: cardName,
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

  // ── CPU prompt response for the custom `abilityAttach` prompt ──
  // Without this, the engine default returns null for cancellable
  // prompts of unknown type — the CPU silently dropped every Training
  // activation at the first attach step. Pick by the same tier
  // priority the main attachAbilities flow uses: stack onto an
  // existing copy first (T1), then attach a brand-new ability nobody
  // has yet (T2), then spread to a fresh hero (T3). Within each tier
  // pick alphabetically for determinism. Returns `{ finished: true }`
  // once we've already attached at least once and no eligible
  // candidate beats the current floor (can also short-circuit when
  // the eligible list is empty).
  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic') return undefined;
    const promptData = payload;
    if (!promptData || promptData.type !== 'abilityAttach') return undefined;

    const eligible = promptData.eligibleCards || [];
    if (eligible.length === 0) {
      return promptData.canFinish ? { finished: true } : null;
    }

    const pi = promptData.ownerIdx;
    const heroIdx = promptData.heroIdx;
    const ps = engine.gs.players[pi];
    if (!ps) return null;

    const livingHeroes = (ps.heroes || []).map((h, i) => ({ h, i }))
      .filter(({ h }) => h?.name && h.hp > 0);

    const heroHasName = (hi, name) => {
      const zones = ps.abilityZones?.[hi] || [];
      for (const z of zones) {
        if ((z || [])[0] === name) return true;
      }
      return false;
    };
    const someoneLivingHasName = (name) => livingHeroes.some(({ i }) => heroHasName(i, name));
    const targetHeroHasName = (name) => heroHasName(heroIdx, name);

    const tier1 = []; // stack onto target hero
    const tier2 = []; // new — no living hero has it yet
    const tier3 = []; // spread — others have it
    for (const name of eligible) {
      if (targetHeroHasName(name)) tier1.push(name);
      else if (!someoneLivingHasName(name)) tier2.push(name);
      else tier3.push(name);
    }

    const sorted = (arr) => arr.slice().sort((a, b) => a.localeCompare(b));
    const pick = (sorted(tier1)[0]) || (sorted(tier2)[0]) || (sorted(tier3)[0]);
    if (!pick) return promptData.canFinish ? { finished: true } : null;

    return { cardName: pick };
  },

  /**
   * Check if this specific Training instance can be activated right now.
   * Called by the engine's getFreeActivatableAbilities (after HOPT check).
   */
  canFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const feld = ctx.cardHeroOwner ?? pi;   // Styx 28.9.: „this Hero" = Brettseite

    const hasHandAbilities = getEligibleHandAbilities(engine, pi, heroIdx, feld).length > 0;
    const hasDeckAbilities = getEligibleDeckAbilities(engine, pi, heroIdx, feld).length > 0;
    const ps = ctx.players[pi];
    const hasCardsInHand = (ps.hand || []).length > 0;
    const anlegenVerbraucht = feld === pi
      ? !!(ps.abilityGivenThisTurn || [])[heroIdx]
      : !engine.darfFremdAbilityAnlegen(pi, feld, heroIdx);

    switch (level) {
      case 1:
        // Need eligible abilities in hand
        return hasHandAbilities;
      case 2:
        // Option A: eligible hand abilities, OR
        // Option B: eligible deck abilities AND cards in hand to discard
        //   Option B costs the hero's per-turn attachment, so it must be unspent.
        return hasHandAbilities || (hasDeckAbilities && hasCardsInHand && !anlegenVerbraucht);
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
    // Styx 28.9.: Training an einem geliehenen Helden — „your hand/deck" =
    // Kontrolleur `pi`, „this Hero" und seine Zonen = Brettseite `feld`.
    const feld = ctx.cardHeroOwner ?? pi;
    const trainingZoneIdx = ctx.card.zoneSlot; // Training's own ability zone slot
    const ps = ctx.players[pi];
    const heroName = ctx.players[feld]?.heroes?.[heroIdx]?.name || 'Hero';

    // ── Level 1 ──
    if (level === 1) {
      const attached = await doHandAttach(engine, pi, heroIdx, 1, trainingZoneIdx, feld);
      return attached > 0;
    }

    // ── Levels 2 & 3 ──
    const maxHandAttach = level === 2 ? 2 : 3;
    const hasHandAbilities = getEligibleHandAbilities(engine, pi, heroIdx, feld).length > 0;
    const hasDeckAbilities = getEligibleDeckAbilities(engine, pi, heroIdx, feld).length > 0;
    const hasCardsInHand = (ps.hand || []).length > 0;
    const abilityGivenBlocked = feld === pi
      ? (ps.abilityGivenThisTurn || [])[heroIdx]
      : !engine.darfFremdAbilityAnlegen(pi, feld, heroIdx);
    const canOptionA = hasHandAbilities;
    const canOptionB = level === 3
      ? hasDeckAbilities
      : (hasDeckAbilities && hasCardsInHand && !abilityGivenBlocked);

    // If only one option is available, auto-select
    if (canOptionA && !canOptionB) {
      const attached = await doHandAttach(engine, pi, heroIdx, maxHandAttach, trainingZoneIdx, feld);
      return attached > 0;
    }
    if (!canOptionA && canOptionB) {
      const resolved = await doDeckSearch(engine, pi, heroIdx, level, trainingZoneIdx, feld);
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
      const attached = await doHandAttach(engine, pi, heroIdx, maxHandAttach, trainingZoneIdx, feld);
      return attached > 0;
    }
    if (choice.optionId === 'deck') {
      const resolved = await doDeckSearch(engine, pi, heroIdx, level, trainingZoneIdx, feld);
      return resolved;
    }

    return false;
  },
};
