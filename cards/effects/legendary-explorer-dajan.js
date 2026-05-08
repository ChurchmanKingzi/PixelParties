// ═══════════════════════════════════════════
//  CARD EFFECT: "Legendary Explorer Dajan"
//  Hero (400 HP, 80 ATK — Adventurousness + Wealth)
//
//  Active — once per turn, spend your Action to
//  search your deck for an Artifact and play it
//  immediately. The full Cost still has to be paid,
//  but it's reduced by 10 (floor 0).
//
//  Wired through the `heroEffect` +
//  `heroEffectActionCost` channel: action-cost
//  bookkeeping (Action Phase main slot OR a Main
//  Phase additional-action provider) is handled by
//  server.js `doActivateHeroEffect`, and the
//  engine's `hero-effect:{name}:{pi}:{heroIdx}`
//  HOPT key (server.js:4503) gives once-per-turn
//  enforcement for free.
//
//  Subtype dispatch:
//    • Equipment       → prompt zone, place into
//      Support Zone, fire onPlay/onCardEnterZone
//      (Treasure Hunter's Backpack pattern).
//    • Targeting       → run getValidTargets, prompt
//      via promptEffectTarget, validate, call the
//      script's resolve() with the selection
//      (mirrors doConfirmPotion at server.js:4955).
//    • Plain Normal    → call resolve() with no
//      targets (mirrors doUseArtifactEffect at
//      server.js:5301).
//
//  Subtypes left out of the eligible pool:
//    • Reaction / Surprise — only legal on the chain
//      / face-down placement paths, never Action
//      Phase activations.
//    • Area              — placement semantics
//      diverge enough that they need their own flow.
//    • Artifact-Creature — handled like Creatures,
//      not Artifacts (gold-cost Creature summon).
//    • neverPlayable     — the script self-declares
//      "no effect when played" (Mystery Box).
//    • manualGoldCost    — cost is computed dynamic-
//      ally inside resolve (Dark Gear scales with
//      target Creature level, etc.); the -10 rebate
//      doesn't compose cleanly with a script-driven
//      gold deduction.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Legendary Explorer Dajan';
const COST_REDUCTION = 10;

/**
 * True iff Dajan can play the artifact directly from deck. See header
 * for the subtype carve-outs.
 */
function _isPlayableArtifact(cd, script) {
  if (!cd || cd.cardType !== 'Artifact') return false;
  if (script?.neverPlayable) return false;
  if (script?.manualGoldCost) return false;
  const sub = (cd.subtype || '').toLowerCase();
  if (sub === 'reaction') return false;
  if (sub === 'surprise') return false;
  if (sub === 'area') return false;
  // Artifact-Creature hybrids (Pollution Spewer pattern) play through
  // the Creature-summon path, not the Artifact path.
  if (sub.split('/').some(t => t.trim() === 'creature')) return false;
  return true;
}

function _countCopies(arr, cardName) {
  let n = 0;
  for (const x of arr) if (x === cardName) n++;
  return n;
}

/**
 * Build the deck gallery the player picks from. Filters out any
 * artifact whose reduced cost (max(0, raw - 10)) the player can't
 * afford right now — there's no point letting them pick a card we'd
 * have to fizzle on cost.
 */
function _buildEligibleGallery(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const gold = ps.gold || 0;
  const seen = new Set();
  const out = [];
  for (const cardName of (ps.mainDeck || [])) {
    if (seen.has(cardName)) continue;
    const cd = cardDB[cardName];
    const script = loadCardEffect(cardName);
    if (!_isPlayableArtifact(cd, script)) continue;
    const reducedCost = Math.max(0, (cd.cost || 0) - COST_REDUCTION);
    if (gold < reducedCost) continue;
    seen.add(cardName);
    out.push({
      name: cardName, source: 'deck', cost: reducedCost,
      count: _countCopies(ps.mainDeck, cardName),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Equipment-Artifact play path. Prompts the player for a destination
 * Hero (free Support Zone in their column), splices from deck into
 * the chosen slot, fires onPlay + onCardEnterZone, wraps the place-
 * ment in executeCardWithChain so reaction Spells (Master's Plan,
 * Anti Magic Shield, etc.) get their pre-resolution window.
 *
 * Returns true on a successful (or chain-negated) play, false if the
 * player cancelled before commitment so the action is refunded.
 */
async function _playEquip(engine, pi, cardName, cd, cost) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;

  // Build destination targets: free zones under each alive Hero.
  const destTargets = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen) continue;
    let firstFree = -1;
    for (let si = 0; si < 3; si++) {
      if (((ps.supportZones[hi] || [])[si] || []).length === 0) {
        if (firstFree === -1) firstFree = si;
        destTargets.push({
          id: `equip-${pi}-${hi}-${si}`, type: 'equip',
          owner: pi, heroIdx: hi, slotIdx: si, cardName: '',
        });
      }
    }
    if (firstFree >= 0) {
      destTargets.push({
        id: `hero-${pi}-${hi}`, type: 'hero',
        owner: pi, heroIdx: hi, cardName: hero.name,
      });
    }
  }
  if (destTargets.length === 0) return false;

  const destIds = await engine.promptEffectTarget(pi, destTargets, {
    title: `${CARD_NAME} — Equip ${cardName}`,
    description: `Select a Support Zone to equip ${cardName} to (Cost ${cost}).`,
    confirmLabel: '🗺️ Equip!',
    confirmClass: 'btn-info',
    cancellable: true,
    greenSelect: true,
    exclusiveTypes: false,
    maxPerType: { hero: 1, equip: 1 },
  });
  if (!destIds || destIds.length === 0) return false;

  const dest = destTargets.find(t => t.id === destIds[0]);
  if (!dest) return false;

  let destHeroIdx = dest.heroIdx;
  let destSlot;
  if (dest.type === 'equip') {
    destSlot = dest.slotIdx;
  } else {
    for (let si = 0; si < 3; si++) {
      if (((ps.supportZones[destHeroIdx] || [])[si] || []).length === 0) {
        destSlot = si; break;
      }
    }
    if (destSlot === undefined) return false;
  }
  if (((ps.supportZones[destHeroIdx] || [])[destSlot] || []).length > 0) return false;

  // Splice from deck right before the placement so a chain negate
  // routes the card to discard from a deck-pulled state.
  const deckIdx = ps.mainDeck.indexOf(cardName);
  if (deckIdx < 0) return false;
  ps.mainDeck.splice(deckIdx, 1);

  let placedInst = null;
  const chainResult = await engine.executeCardWithChain({
    cardName, owner: pi, cardType: 'Artifact', goldCost: cost,
    resolve: async () => {
      if (cost > 0) {
        ps.gold -= cost;
        engine._broadcastEvent('gold_change', { owner: pi, amount: -cost });
      }
      const result = engine.safePlaceInSupport(cardName, pi, destHeroIdx, destSlot);
      if (!result) {
        ps.discardPile.push(cardName);
        engine.log('dajan_equip_fizzle', { card: cardName, reason: 'zone_occupied' });
        return true;
      }
      placedInst = result.inst;
      const actualSlot = result.actualSlot;
      await engine.runHooks('onPlay', {
        _onlyCard: placedInst, playedCard: placedInst, cardName,
        zone: 'support', heroIdx: destHeroIdx, zoneSlot: actualSlot,
      });
      await engine.runHooks('onCardEnterZone', {
        enteringCard: placedInst, toZone: 'support', toHeroIdx: destHeroIdx,
      });
      return true;
    },
  });

  if (chainResult.negated) {
    // Chain-negated → card flows to discard, gold not paid (engine
    // restored). Mirrors doPlayArtifact's negation handling.
    if (!ps.discardPile.includes(cardName)) ps.discardPile.push(cardName);
  }
  return true;
}

/**
 * Common resolve-path for non-equipment Artifacts pulled from deck.
 * Wraps the script's resolve() in executeCardWithChain so reactions
 * fire normally. Pays gold on commit, refunds on `aborted`/`cancelled`
 * resolveResults — same contract doConfirmPotion / doUseArtifactEffect
 * use, so existing artifact scripts behave correctly.
 */
async function _runArtifactResolve(engine, pi, cardName, cost, resolveFn) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;

  const chainResult = await engine.executeCardWithChain({
    cardName, owner: pi, cardType: 'Artifact', goldCost: cost,
    resolve: resolveFn,
  });

  // Aborted (re-enter targeting path) — for Dajan's inline flow we
  // treat it the same as cancelled and refund the action via false
  // return up the stack. Resolve hasn't paid gold yet.
  if (chainResult.resolveResult?.aborted) return null;

  // Cancelled mid-resolve — script signalled "the player backed out".
  // Don't pay gold, keep the card available (return to deck top so the
  // shuffle below re-mixes it with the rest).
  if (chainResult.resolveResult?.cancelled) {
    return { cancelled: true };
  }

  if (cost > 0 && !chainResult.negated) {
    ps.gold -= cost;
    engine._broadcastEvent('gold_change', { owner: pi, amount: -cost });
  }

  if (chainResult.negated) {
    // Negated artifacts go to discard regardless (matching doConfirmPotion).
    ps.discardPile.push(cardName);
  } else {
    const script = loadCardEffect(cardName);
    if (script?.deleteOnUse) ps.deletedPile.push(cardName);
    else ps.discardPile.push(cardName);
  }
  return true;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['hero'],
  heroEffect: true,
  heroEffectActionCost: true,

  // Rough CPU yield — at most one play per turn, average value of a
  // discounted ~20-cost artifact ≈ a single mid-cost Action.
  supportYield() {
    return { drawsPerTurn: 1 };
  },

  canActivateHeroEffect(ctx) {
    return _buildEligibleGallery(ctx._engine, ctx.cardOwner).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    // ── Step 1: pick from deck ──
    const gallery = _buildEligibleGallery(engine, pi);
    if (gallery.length === 0) return false;

    const picked = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: `Choose an Artifact from your deck. Its Cost is reduced by ${COST_REDUCTION} (floor 0).`,
      cancellable: true,
    });
    if (!picked || picked.cancelled || !picked.cardName) return false;

    const chosenName = picked.cardName;
    const cardDB = engine._getCardDB();
    const cd = cardDB[chosenName];
    const script = loadCardEffect(chosenName);
    if (!_isPlayableArtifact(cd, script)) return false;

    const rawCost = cd.cost || 0;
    const cost = Math.max(0, rawCost - COST_REDUCTION);
    if ((ps.gold || 0) < cost) return false;

    // Re-verify deck membership; a mid-prompt mill could have removed it.
    if (!ps.mainDeck.includes(chosenName)) return false;

    // Per-script gating that doUseArtifactEffect normally honours.
    if (script?.canActivate && !script.canActivate(gs, pi, engine)) return false;

    const subLower = (cd.subtype || '').toLowerCase();
    const isEquip = subLower === 'equipment';
    const isTargeting = !!(script?.isTargetingArtifact
      && typeof script.getValidTargets === 'function'
      && script.targetingConfig);

    // ── Step 2: subtype dispatch ──
    let success = false;
    if (isEquip) {
      success = await _playEquip(engine, pi, chosenName, cd, cost);
      if (!success) return false; // Cancelled before commitment.
    } else if (isTargeting) {
      // Build validTargets + run the script's UI prompt inline.
      const validTargets = script.getValidTargets(gs, pi, engine) || [];
      const config = typeof script.targetingConfig === 'function'
        ? script.targetingConfig(gs, pi, cost)
        : { ...script.targetingConfig };
      if (validTargets.length === 0 && !config.alwaysConfirmable) return false;

      const selectedIds = await engine.promptEffectTarget(pi, validTargets, {
        title: config.title || chosenName,
        description: config.description || 'Select a target.',
        confirmLabel: config.confirmLabel || '✨ Activate!',
        confirmClass: config.confirmClass || 'btn-info',
        cancellable: config.cancellable !== false,
        exclusiveTypes: config.exclusiveTypes,
        maxPerType: config.maxPerType,
        maxTotal: config.maxTotal,
        minRequired: config.minRequired,
        alwaysConfirmable: config.alwaysConfirmable,
        greenSelect: config.greenSelect,
      });
      if (!selectedIds) return false;
      if (script.validateSelection
          && !script.validateSelection(selectedIds, validTargets)) return false;

      // Splice from deck before resolution — same ordering as
      // _playEquip, so a chain-negate routes from a deck-pulled state.
      const deckIdx = ps.mainDeck.indexOf(chosenName);
      if (deckIdx < 0) return false;
      ps.mainDeck.splice(deckIdx, 1);

      const result = await _runArtifactResolve(engine, pi, chosenName, cost,
        async () => script.resolve(engine, pi, selectedIds, validTargets));
      if (result === null) {
        // Aborted — return to deck and bail.
        ps.mainDeck.push(chosenName);
        engine.shuffleDeck(pi, 'main');
        return false;
      }
      if (result?.cancelled) {
        ps.mainDeck.push(chosenName);
        engine.shuffleDeck(pi, 'main');
        return false;
      }
      success = true;
    } else {
      // Plain Normal Artifact (no targeting). Many of these don't even
      // expose a `resolve` (they're all-hooks cards) — skip those, the
      // pull-from-deck would fizzle silently.
      if (typeof script?.resolve !== 'function') return false;
      const deckIdx = ps.mainDeck.indexOf(chosenName);
      if (deckIdx < 0) return false;
      ps.mainDeck.splice(deckIdx, 1);

      const result = await _runArtifactResolve(engine, pi, chosenName, cost,
        async () => script.resolve(engine, pi, [], []));
      if (result === null || result?.cancelled) {
        ps.mainDeck.push(chosenName);
        engine.shuffleDeck(pi, 'main');
        return false;
      }
      success = true;
    }

    // ── Step 3: tutor etiquette ──
    // Shuffle the rest of the deck and reveal the searched card to
    // the opponent — every existing deck-tutor in the codebase
    // (Treasure Hunter's Backpack, Stellan, Slime Rancher, …) does
    // this same pair, so opponent-side info parity matches.
    engine.shuffleDeck(pi, 'main');
    engine._broadcastEvent('deck_search_add', { cardName: chosenName, playerIdx: pi });
    const oi = pi === 0 ? 1 : 0;
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: chosenName,
      searcherName: ps.username,
      title: CARD_NAME,
      cancellable: false,
    });

    engine.log('dajan_play_from_deck', {
      player: ps.username, artifact: chosenName,
      rawCost, paid: cost, reduction: COST_REDUCTION,
    });
    engine.sync();
    return success;
  },
};
