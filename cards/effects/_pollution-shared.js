// ═══════════════════════════════════════════
//  SHARED: Pollution archetype helpers
//
//  Every Pollution-archetype card (and a few
//  outsiders) needs some combination of:
//    • counting free Support Zones (for capping
//      multi-target effects and for placement)
//    • enumerating free Support Zones (for the
//      zone-pick UI when placing tokens)
//    • placing N Pollution Tokens with a full
//      zone-pick loop + onPlay/onCardEnterZone
//      hooks + hand-limit recheck
//    • enumerating / removing Pollution Tokens
//      already on a player's side of the board
//
//  All of this logic used to live inline in
//  pyroblast.js. It now lives here and pyroblast
//  consumes it. New Pollution cards build on top
//  of these primitives — NO duplication.
//
//  When a token is removed from the board (by
//  any path — spell effect, destruction, card
//  leaving zone), we fire a custom hook named
//  'onPollutionTokenRemoved' so downstream cards
//  like Pollution Spewer can react generically.
// ═══════════════════════════════════════════

const POLLUTION_TOKEN = 'Pollution Token';

/**
 * Count the free Support Zones for a player.
 * A zone is "free" if its sub-array is empty (no card occupying it).
 * Only counts zones belonging to alive heroes.
 * @param {object} gs - Game state
 * @param {number} playerIdx
 * @returns {number}
 */
function countFreeZones(gs, playerIdx) {
  const ps = gs.players[playerIdx];
  if (!ps) return 0;
  let count = 0;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    for (let si = 0; si < 3; si++) {
      const slot = (ps.supportZones[hi] || [])[si] || [];
      if (slot.length === 0) count++;
    }
  }
  return count;
}

/**
 * Quick boolean — does this player have at least one free Support Zone?
 * Use in spellPlayCondition to pre-validate token-placing spells.
 */
function hasFreeZone(gs, playerIdx) {
  return countFreeZones(gs, playerIdx) > 0;
}

/**
 * Enumerate all free Support Zone descriptors for a player.
 * Returned in row-major order (hero 0 slot 0, hero 0 slot 1, …, hero 1 slot 0, …).
 * Used by promptZonePick to render the zone-picker UI.
 *
 * @param {object} gs - Game state
 * @param {number} playerIdx
 * @returns {Array<{ heroIdx: number, slotIdx: number, label: string }>}
 */
function getFreeZones(gs, playerIdx) {
  const ps = gs.players[playerIdx];
  if (!ps) return [];
  const zones = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    for (let si = 0; si < 3; si++) {
      const slot = (ps.supportZones[hi] || [])[si] || [];
      if (slot.length === 0) {
        zones.push({ heroIdx: hi, slotIdx: si, label: `${hero.name} — Slot ${si + 1}` });
      }
    }
  }
  return zones;
}

/**
 * Place N Pollution Tokens into the specified player's free Support Zones.
 *
 * Flow:
 *   1. For each token to place, compute the current free zones (the list
 *      shrinks as tokens are placed).
 *   2. If only one free zone remains, auto-place there.
 *      Otherwise, prompt the player to pick.
 *   3. Summon the Pollution Token via engine.summonCreatureWithHooks()
 *      which handles tracking + onPlay + onCardEnterZone for us.
 *   4. Record the turn the token was placed (so Victorica / similar cards
 *      can filter tokens placed "this turn" vs "earlier").
 *   5. Log 'pollution_placed' for each token and sync + delay between placements.
 *   6. After the loop, run _checkReactiveHandLimits so the owner immediately
 *      faces any forced deletions from newly-tightened hand caps.
 *
 * If the player runs out of free zones mid-placement, the loop stops early —
 * the caller gets an accurate `placed` count and can log fizzle details.
 *
 * @param {object} engine - Engine reference (ctx._engine)
 * @param {number} playerIdx - Who owns the tokens (usually the spell caster)
 * @param {number} count - How many tokens to attempt to place
 * @param {string} sourceName - Source card name for logging (e.g. 'Pyroblast')
 * @param {object} [opts]
 * @param {object} [opts.promptCtx] - ctx for prompting (pass the ctx from the
 *   firing card; required for promptZonePick to route correctly)
 * @returns {Promise<{ placed: number, insts: CardInstance[] }>}
 */
async function placePollutionTokens(engine, playerIdx, count, sourceName, opts = {}) {
  const gs = engine.gs;
  const ps = gs.players[playerIdx];
  const placed = [];

  if (!ps || count <= 0) return { placed: 0, insts: [] };

  const promptCtx = opts.promptCtx;

  // If the player will have to fill every free zone anyway (count meets or
  // exceeds the starting number of free zones), skip the zone-pick UI and
  // auto-place each token in the first available slot. No choice would be
  // meaningful — placement order is the only degree of freedom, and forcing
  // N manual picks just to fill every slot is pure busywork.
  const initialFreeCount = getFreeZones(gs, playerIdx).length;
  const autoFillAll = count >= initialFreeCount;

  for (let t = 0; t < count; t++) {
    const freeZones = getFreeZones(gs, playerIdx);
    if (freeZones.length === 0) break;

    let chosenZone;
    if (autoFillAll || freeZones.length === 1) {
      chosenZone = freeZones[0];
    } else if (promptCtx?.promptZonePick) {
      const picked = await promptCtx.promptZonePick(freeZones, {
        title: `${sourceName} — Pollution`,
        description: `Place Pollution Token ${t + 1}/${count} into a free Support Zone.`,
        cancellable: false,
      });
      chosenZone = (picked && freeZones.find(z => z.heroIdx === picked.heroIdx && z.slotIdx === picked.slotIdx)) || freeZones[0];
    } else {
      // No prompt context — fall back to first free zone. This path is for
      // non-interactive callers (e.g. Area card auto-placements). Callers
      // that want player choice MUST pass opts.promptCtx.
      chosenZone = freeZones[0];
    }

    // Manual placement — we deliberately DO NOT route through
    // safePlaceInSupport / summonCreatureWithHooks because those paths
    // treat cardType === 'Token' as a summon and increment
    // ps._creaturesSummonedThisTurn. Pollution Tokens are placements,
    // NOT summoned Creatures, and must not touch summon bookkeeping.
    const hi = chosenZone.heroIdx;
    const si = chosenZone.slotIdx;
    if (!ps.supportZones[hi]) ps.supportZones[hi] = [[], [], []];
    if (!ps.supportZones[hi][si]) ps.supportZones[hi][si] = [];
    ps.supportZones[hi][si] = [POLLUTION_TOKEN];

    const inst = engine._trackCard(POLLUTION_TOKEN, playerIdx, 'support', hi, si);

    // Record the turn this token was placed. Used by Victorica (and any future
    // card that needs to distinguish "fresh" vs "old" tokens).
    inst.counters.placedOnTurn = gs.turn;

    // Shadowy gooey dark-magic visual on the newly placed token — sells that
    // this is a bad thing to have on your board. Broadcast before onPlay so
    // the animation is running as the token becomes active.
    engine._broadcastEvent('play_zone_animation', {
      type: 'pollution_place', owner: playerIdx, heroIdx: hi, zoneSlot: si,
    });

    // Fire the standard entry-side hooks so the Pollution Token's own onPlay
    // (setting handLimitReduction) and any listening cards see the placement.
    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst,
      cardName: POLLUTION_TOKEN, zone: 'support', heroIdx: hi, zoneSlot: si,
      _skipReactionCheck: true,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'support', toHeroIdx: hi,
      _skipReactionCheck: true,
    });

    placed.push(inst);

    engine.log('pollution_placed', {
      player: ps.username,
      heroIdx: hi,
      zoneSlot: si,
      by: sourceName,
    });
    engine.sync();
    await engine._delay(300);
  }

  // After all placements, enforce the new tighter hand cap on the owner.
  if (placed.length > 0 && typeof engine._checkReactiveHandLimits === 'function') {
    await engine._checkReactiveHandLimits(playerIdx);
  }

  return { placed: placed.length, insts: placed };
}

/**
 * Enumerate all Pollution Tokens currently on a player's side of the board.
 * Returns CardInstance objects so callers can inspect counters (e.g. filter
 * by placedOnTurn for Victorica).
 *
 * @param {object} engine - Engine reference
 * @param {number} playerIdx
 * @returns {CardInstance[]}
 */
function getPollutionTokens(engine, playerIdx) {
  return engine.cardInstances.filter(inst =>
    inst.name === POLLUTION_TOKEN &&
    inst.owner === playerIdx &&
    inst.zone === 'support' &&
    !inst.faceDown
  );
}

/**
 * Count Pollution Tokens on a player's side of the board.
 */
function countPollutionTokens(engine, playerIdx) {
  return getPollutionTokens(engine, playerIdx).length;
}

/** Every Pollution Token on the board, both sides, flat array. */
function getAllPollutionTokens(engine) {
  return engine.cardInstances.filter(inst =>
    inst.name === POLLUTION_TOKEN &&
    inst.zone === 'support' &&
    !inst.faceDown
  );
}

/** Count Pollution Tokens across both players' sides. */
function countAllPollutionTokens(engine) {
  return getAllPollutionTokens(engine).length;
}

/**
 * Remove N Pollution Tokens from a player's side.
 *
 * Behaviour:
 *   • If the player has fewer tokens than requested, all tokens are removed
 *     and the actual count is returned.
 *   • If `opts.promptCtx` is supplied and the player has more tokens than
 *     requested, they're prompted to pick which ones via promptZonePick.
 *     Without a prompt context, tokens are removed in instance order
 *     (oldest first).
 *   • `opts.filter(inst) → bool` can restrict the pool (e.g. Victorica:
 *     only tokens placed before this turn).
 *   • Each removed token fires the standard onCardLeaveZone hook plus a
 *     custom 'onPollutionTokenRemoved' hook so reactive cards like
 *     Pollution Spewer can respond.
 *
 * @param {object} engine - Engine reference
 * @param {number} playerIdx - Whose tokens to remove
 * @param {number} count - How many to remove (will cap at actual available)
 * @param {string} sourceName - Source card name for logging
 * @param {object} [opts]
 * @param {object} [opts.promptCtx] - ctx for prompting the owner
 * @param {function} [opts.filter] - (inst) → bool to restrict removable tokens
 * @returns {Promise<{ removed: number, insts: CardInstance[] }>}
 */
async function removePollutionTokens(engine, playerIdx, count, sourceName, opts = {}) {
  const gs = engine.gs;
  const ps = gs.players[playerIdx];
  if (!ps || count <= 0) return { removed: 0, insts: [] };

  let pool = getPollutionTokens(engine, playerIdx);
  if (opts.filter) pool = pool.filter(opts.filter);
  if (pool.length === 0) return { removed: 0, insts: [] };

  const toRemoveCount = Math.min(count, pool.length);
  let removalList;

  if (toRemoveCount >= pool.length) {
    // Removing all of them — no choice needed
    removalList = pool.slice();
  } else if (opts.promptCtx?.promptZonePick) {
    // Prompt the owner to pick which tokens to remove.
    // Zone-pick returns { heroIdx, slotIdx } but we may need multiple —
    // so we loop one at a time, narrowing the pool each pick.
    removalList = [];
    const remaining = pool.slice();
    for (let i = 0; i < toRemoveCount; i++) {
      const zones = remaining.map(inst => {
        const hero = ps.heroes?.[inst.heroIdx];
        return {
          heroIdx: inst.heroIdx,
          slotIdx: inst.zoneSlot,
          label: `${hero?.name || 'Hero'} — Slot ${inst.zoneSlot + 1}`,
        };
      });
      const picked = await opts.promptCtx.promptZonePick(zones, {
        title: `${sourceName} — Remove Pollution`,
        description: `Pick Pollution Token ${i + 1}/${toRemoveCount} to remove.`,
        cancellable: false,
      });
      const pickedInstIdx = picked
        ? remaining.findIndex(inst => inst.heroIdx === picked.heroIdx && inst.zoneSlot === picked.slotIdx)
        : 0;
      const chosen = remaining[Math.max(0, pickedInstIdx)];
      removalList.push(chosen);
      remaining.splice(remaining.indexOf(chosen), 1);
    }
  } else {
    // Non-interactive: take oldest-first (matches CardInstance creation order).
    removalList = pool.slice(0, toRemoveCount);
  }

  // Actually remove each token from the board.
  for (const inst of removalList) {
    await _removeTokenInstance(engine, inst, sourceName);
  }

  return { removed: removalList.length, insts: removalList };
}

/**
 * Internal: strip a Pollution Token instance from the board and fire hooks.
 * Consolidates the removal logic so Sun Beam / Goldify / Mana Beacon /
 * Victorica / Pollution Piranha all go through exactly one path.
 *
 * NOT exported — callers should use removePollutionTokens() which handles
 * counts, filtering, and prompting. This function is a private implementation
 * detail of that.
 */
async function _removeTokenInstance(engine, inst, sourceName) {
  if (!inst) return;
  const gs = engine.gs;
  const ps = gs.players[inst.owner];
  if (!ps) return;

  const heroIdx = inst.heroIdx;
  const zoneSlot = inst.zoneSlot;

  // Evaporation VFX — play BEFORE the state mutation so the animation
  // has a concrete slot to anchor onto. The frontend handler pulls the
  // slot's rect when the event arrives.
  engine._broadcastEvent('play_zone_animation', {
    type: 'pollution_evaporate',
    owner: inst.owner, heroIdx, zoneSlot,
  });

  // Pull from the board-state array
  const slotArr = ps.supportZones?.[heroIdx]?.[zoneSlot];
  if (Array.isArray(slotArr)) {
    const nameIdx = slotArr.indexOf(POLLUTION_TOKEN);
    if (nameIdx >= 0) slotArr.splice(nameIdx, 1);
  }

  // Pollution Tokens are removed from the game entirely — they do NOT go
  // to the Deleted pile, the discard pile, or anywhere else. Untrack the
  // instance so nothing else sees it (hooks, counters, etc.).
  engine._untrackCard(inst.id);

  engine.log('pollution_removed', {
    player: ps.username,
    heroIdx,
    zoneSlot,
    by: sourceName,
  });

  // Standard card-leaves-zone hook (so any generic listener fires).
  await engine.runHooks('onCardLeaveZone', {
    card: inst,
    fromZone: 'support',
    fromOwner: inst.owner,
    fromHeroIdx: heroIdx,
    fromZoneSlot: zoneSlot,
    _skipReactionCheck: true,
  });

  // Custom Pollution-specific hook — lets Pollution Spewer (and future cards)
  // react to token removal without having to filter every onCardLeaveZone.
  await engine.runHooks('onPollutionTokenRemoved', {
    removedInst: inst,
    ownerIdx: inst.owner,
    heroIdx,
    zoneSlot,
    by: sourceName,
    _skipReactionCheck: true,
  });

  engine.sync();
  await engine._delay(200);
}

module.exports = {
  POLLUTION_TOKEN,
  countFreeZones,
  hasFreeZone,
  getFreeZones,
  placePollutionTokens,
  getPollutionTokens,
  countPollutionTokens,
  getAllPollutionTokens,
  countAllPollutionTokens,
  removePollutionTokens,
};
