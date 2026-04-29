// ═══════════════════════════════════════════
//  SHARED: Deepsea archetype helpers
//
//  The Deepsea archetype's signature mechanic
//  is "Bounce-Place": instead of summoning
//  normally (Action + Summoning Magic +
//  casting-hero slot), the player may bounce
//  an own Deepsea Creature that was not
//  summoned this turn back to their hand and
//  "Place" the new Deepsea Creature into the
//  bounced one's Support Zone. The placement
//  path:
//    • costs no Action (→ inherentAction)
//    • bypasses Summoning Magic level reqs
//      (→ canBypassLevelReq engine hook)
//    • may land in ANY Hero's zone, including
//      a dead Hero's zone (→ placement uses
//      the bounced slot directly, ignoring
//      the player's original slot pick)
//    • still fires on-summon effects
//      (→ placeCreature runs onPlay +
//      onCardEnterZone)
//    • still counts toward the card's
//      "1 per turn" summon limit
//
//  When a Deepsea Creature is placed this way,
//  its `onPlay` hook reads ctx._bouncedFrom to
//  see which Creature was bounced (Jack O'
//  Lantern needs the bounced level; Monstrosity
//  copies the bounced Creature's on-summon).
//
//  The bounce step ALSO fires a custom
//  engine-wide hook `onCardsReturnedToHand` so
//  passive listeners (Teppes, Siphem, future
//  cards) can react without each card having
//  to filter onCardLeaveZone → hand.
//
//  Deepsea-specific "archetype override" for
//  Deepsea Spores: when active this turn, the
//  isDeepseaCreature() predicate treats ALL
//  Creatures as Deepsea — so any Creature on
//  the player's side becomes a legal bounce
//  target, and every Creature in hand becomes
//  a Deepsea for summon purposes.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const DEEPSEA_ARCHETYPE = 'Deepsea';

// ─── Archetype predicate ────────────────────

/**
 * Is this card a Deepsea Creature?
 *
 * Primary rule: the card's `archetype` in cards.json equals "Deepsea".
 *
 * Overrides:
 *   • Deepsea Spores, while active this turn, treats EVERY Creature on the
 *     board (and by extension in hand) as Deepsea.
 *   • Infected Squirrel's own text reads "This Creature on the board also
 *     counts as a Deepsea Creature" — we hard-code the exception here so
 *     any Deepsea effect that reads archetype via this helper picks it up.
 *
 * The `inst` argument is optional and only relevant for on-board checks
 * (e.g. Spores override only applies to Creatures currently on the board).
 */
function isDeepseaCreature(cardName, engine, inst = null) {
  if (!cardName || !engine) return false;
  const cardDB = engine._getCardDB();
  const cd = cardDB[cardName];
  if (!cd) return false;
  if (cd.cardType !== 'Creature') return false;

  // Direct archetype match.
  if (cd.archetype === DEEPSEA_ARCHETYPE) return true;

  // Infected Squirrel always counts as Deepsea (per its own text).
  if (cardName === 'Infected Squirrel') return true;

  // Deepsea Spores override — "For the rest of the turn, all Creatures on
  // the board are treated as Deepsea Creatures." Applies to Creatures
  // currently on the board. If we're checking an `inst` and Spores is
  // active this turn, the instance qualifies as long as it's actually
  // on the board (support zone).
  const sporesTurn = engine.gs?._deepseaSporesActiveTurn;
  if (sporesTurn != null && sporesTurn === engine.gs.turn) {
    // Spell text is "on the board" — restrict to support-zone creatures.
    if (inst && inst.zone === 'support') return true;
  }

  return false;
}

/**
 * Activate Deepsea Spores' archetype override for this turn. Cleared at
 * turn start automatically (we check `sporesTurn === currentTurn`).
 *
 * Also fires the client-side signature animation: a full-board particle
 * rain (teal, blue, dark-blue, red, dark-red spores) + per-creature
 * ominous red glow with algae/anemone growth.
 */
function activateDeepseaSpores(engine) {
  engine.gs._deepseaSporesActiveTurn = engine.gs.turn;

  // Full-board overlay animation — client listens on this single event
  // and handles the particle rain plus spawns per-creature effects.
  const affectedCreatures = [];
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    const cd = cardDB[inst.name];
    if (!cd || cd.cardType !== 'Creature') continue;
    affectedCreatures.push({
      owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
    });
  }
  engine._broadcastEvent('deepsea_spores_activated', {
    creatures: affectedCreatures,
  });
}

// ─── Enumerate bounceable own creatures ─────

/**
 * Find all Deepsea Creatures on `playerIdx`'s side of the board that were
 * NOT summoned this turn. These are the legal bounce targets.
 *
 * Each returned entry: { inst, heroIdx, slotIdx, cardName }
 *
 * @param {object} engine
 * @param {number} playerIdx
 * @param {object} [opts]
 * @param {string} [opts.excludeInstId] - Skip this instance (self-exclude when
 *   deciding if the card being placed qualifies as a bounce target).
 */
function getBounceableDeepseaCreatures(engine, playerIdx, opts = {}) {
  const gs = engine.gs;
  const ps = gs.players[playerIdx];
  if (!ps) return [];
  const turn = gs.turn || 0;
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    for (let si = 0; si < 3; si++) {
      const slot = (ps.supportZones[hi] || [])[si] || [];
      if (slot.length === 0) continue;
      const inst = engine.cardInstances.find(c =>
        (c.owner === playerIdx || c.controller === playerIdx) &&
        c.zone === 'support' &&
        c.heroIdx === hi &&
        c.zoneSlot === si
      );
      if (!inst) continue;
      if (opts.excludeInstId && inst.id === opts.excludeInstId) continue;
      if (!isDeepseaCreature(inst.name, engine, inst)) continue;
      // "Not summoned this turn" — strictly less than current turn.
      // Infected Squirrel is the explicit exception: its card text lets
      // it be bounced for a Deepsea Creature's effect on the same turn
      // it was summoned, at the cost of locking the player out of
      // further summons (applied in tryBouncePlace).
      if (inst.name !== 'Infected Squirrel' && (inst.turnPlayed || 0) >= turn) continue;
      out.push({ inst, heroIdx: hi, slotIdx: si, cardName: inst.name });
    }
  }
  return out;
}

/**
 * Convenience: does the player have any bounceable Deepsea Creature?
 * Drives both inherentAction and canBypassLevelReq on Deepsea Creatures.
 */
function hasBounceableDeepsea(gs, playerIdx) {
  // Reconstruct an engine-shaped context. The two predicates consult
  // gs.players + engine.cardInstances, so we need engine reference.
  // Callers invoke this from predicates given a `gs` + helpers from engine.
  // We take `engine` as an optional extra-arg path; for inherentAction
  // signatures (gs, pi, heroIdx, engine) the engine is passed.
  const engine = arguments[3] || arguments[2]; // tolerant to call shape
  // Fallback: look up engine from gs-embedded reference if available.
  const eng = engine && typeof engine === 'object' && engine.cardInstances
    ? engine
    : null;
  if (!eng) return false;
  return getBounceableDeepseaCreatures(eng, playerIdx).length > 0;
}

// ─── Return a Support-Zone Creature to its owner's hand ───

/**
 * Remove a Creature CardInstance from its Support Zone and push its name
 * back to the owner's hand. Fires onCardLeaveZone and the custom hook
 * `onCardsReturnedToHand`. The instance is untracked because the hand
 * holds card NAMES, not instances — the next time the card is played or
 * placed, a fresh instance is created.
 *
 * @returns {Promise<{ returned: boolean }>}
 */
async function returnSupportCreatureToHand(engine, inst, sourceName) {
  if (!inst || inst.zone !== 'support') return { returned: false };
  const gs = engine.gs;
  const ownerIdx = inst.owner; // Hand-return ALWAYS goes to original owner.
  const ps = gs.players[ownerIdx];
  if (!ps) return { returned: false };

  const heroIdx = inst.heroIdx;
  const slotIdx = inst.zoneSlot;
  const cardName = inst.name;

  // Bounce animation plays FIRST, even on Cardinal-immune targets —
  // visual feedback that the bounce attempted to hit. The actual
  // board-state change is gated below.
  engine._broadcastEvent('play_zone_animation', {
    type: 'deep_sea_bubbles', owner: ownerIdx, heroIdx, zoneSlot: slotIdx,
  });

  // Cardinal Beast immunity is the engine's absolute "this card cannot
  // be affected by anything" shield — already honoured for damage,
  // destroy, move, buff add/remove, and status application. Bouncing
  // a creature to hand is a board-state change of the same severity,
  // so the shield applies here too. Golden Wings also sets this flag.
  // We play the bounce animation above first (so the player sees the
  // attempt hit and fizzle), then bail BEFORE the actual pile-transfer
  // animation and state mutation. Name-based fallback matches the
  // engine's damage-path check — if a Beast's onPlay missed stamping
  // the counter (rare but possible), the name catches it.
  const CARDINAL_BEAST_NAMES = new Set([
    'Cardinal Beast Baihu', 'Cardinal Beast Qinglong',
    'Cardinal Beast Xuanwu', 'Cardinal Beast Zhuque',
  ]);
  if (inst.counters?._cardinalImmune || CARDINAL_BEAST_NAMES.has(inst.name)) {
    engine.log('cardinal_immune_block', {
      card: inst.name, by: sourceName, action: 'return_to_hand',
    });
    return { returned: false };
  }

  // Pile-transfer animation needs the SOURCE slot coordinates (to anchor
  // the flying card on the creature's current Support Zone) and the
  // DESTINATION index (the hand slot it's about to occupy — end of hand
  // after the push below). Client queries DOM via these locators.
  const toHandIdx = (ps.hand || []).length;
  engine._broadcastEvent('play_pile_transfer', {
    owner: ownerIdx, cardName, from: 'support', to: 'hand',
    fromHeroIdx: heroIdx, fromSlotIdx: slotIdx,
    toHandIdx,
  });

  // Remove name from support slot.
  const slotArr = ps.supportZones?.[heroIdx]?.[slotIdx];
  if (Array.isArray(slotArr)) {
    const idx = slotArr.indexOf(cardName);
    if (idx >= 0) slotArr.splice(idx, 1);
  }

  // Add to hand.
  if (!ps.hand) ps.hand = [];
  ps.hand.push(cardName);

  engine.log('deepsea_return_to_hand', {
    player: ps.username, card: cardName, by: sourceName,
    heroIdx, slotIdx,
  });

  // Fire the standard leave-zone hook so listeners (Slime Rancher,
  // creature-count watchers, etc.) see it.
  await engine.runHooks('onCardLeaveZone', {
    card: inst, fromZone: 'support',
    fromOwner: ownerIdx, fromHeroIdx: heroIdx, fromZoneSlot: slotIdx,
    toZone: 'hand', toOwner: ownerIdx,
    _skipReactionCheck: true,
  });

  // Custom hook fired specifically for "cards returned to hand from board"
  // events. Teppes draws a card per firing (up to 5/turn); Siphem adds a
  // Deepsea Counter. The hook is ANY string — engine accepts whatever we
  // fire via runHooks, so no engine edit is required.
  await engine.runHooks('onCardsReturnedToHand', {
    ownerIdx, returnedCards: [cardName], returnedInsts: [inst],
    by: sourceName, _skipReactionCheck: true,
  });

  // Untrack the instance — hand uses names only.
  engine._untrackCard(inst.id);

  engine.sync();
  await engine._delay(250);
  return { returned: true };
}

/**
 * Fire onCardsReturnedToHand with a batch of returned instances. Used by
 * Shu'Chaku to signal "N artifacts returned at once" so Teppes / Siphem
 * can tally once per event. Not strictly required for the individual
 * returns inside returnSupportCreatureToHand (which fires its own hook
 * per creature).
 */
async function fireReturnBatchHook(engine, ownerIdx, returnedCards, returnedInsts, sourceName) {
  if (!returnedCards || returnedCards.length === 0) return;
  await engine.runHooks('onCardsReturnedToHand', {
    ownerIdx,
    returnedCards: [...returnedCards],
    returnedInsts: [...(returnedInsts || [])],
    by: sourceName,
    _skipReactionCheck: true,
  });
}

// ─── The signature bounce-place flow ────────

/**
 * Called from every Deepsea Creature's `beforeSummon` hook.
 *
 * Decision tree:
 *   • No bounceable Deepsea → return true (normal summon proceeds).
 *   • 1+ bounceable Deepsea → prompt the player to pick one (or cancel).
 *     On cancel: return false with no consumption → server puts card back
 *     in hand (no Action charged because inherentAction was true).
 *     On pick: bounce the chosen Creature to hand, place this Creature
 *     into the bounced slot, mark ps._placementConsumedByCard so the
 *     server's creature-play path skips summonCreature, return false.
 *
 * Important: we stash the bounced Creature's data on
 * `ctx.card.counters._bouncedFromName` / `_bouncedFromLevel` so the
 * card's own onPlay can read it (Jack O' Lantern draws N cards where
 * N is the bounced level; Monstrosity copies the bounced Creature's
 * on-summon effect).
 *
 * @returns {Promise<boolean>} true = proceed with normal summon; false = consumed or cancelled
 */
async function tryBouncePlace(ctx) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const ps = gs.players[pi];
  const cardName = ctx.cardName;

  // Monstrosity is copying THIS card's "on-summon effect". `tryBouncePlace`
  // is a placement mechanism, not a copyable effect — there's no second
  // physical creature being summoned, so prompting for another bounce
  // target is nonsensical. No-op.
  if (ctx._monstrosityCopy) return true;

  // Shapeshift / Deepsea Castle swap context: the caller is already
  // handling the bounce-out and placement. Skip bounce-place entirely
  // so the player isn't prompted to pick ANOTHER Creature to bounce on
  // top of the swap's own bounced target. Returning true lets the
  // swap's atomicSwap proceed to place this Creature directly.
  if (ctx._isSwap) return true;

  // Player explicitly dropped this Creature into an EMPTY Support Zone
  // (server set `_requestedNormalSummonSlot` in doPlayCreature). They
  // are spending the Action to summon normally, not bounce-swap. Clear
  // the flag and let placeCreature run without prompting for a bounce
  // target. If the bounce-place flag is ALSO set somehow, prefer
  // normal-summon — the empty-slot intent is clearer.
  if (ps._requestedNormalSummonSlot) {
    delete ps._requestedNormalSummonSlot;
    return true;
  }

  const bounceable = getBounceableDeepseaCreatures(engine, pi);
  if (bounceable.length === 0) {
    // No bounce target — normal summon is the only path. The
    // inherentAction / canBypassLevelReq helpers also return false
    // when there's no bounceable, so this path means the player is
    // paying the Action + Summoning Magic normally.
    return true;
  }

  // Did the player already drop the hand card directly onto a specific
  // occupied Deepsea slot? The server sets ps._requestedBouncePlaceSlot
  // when the drag target is an occupied bounceable slot. In that case we
  // skip the zone-pick prompt entirely and place into that slot.
  let chosen = null;
  if (ps._requestedBouncePlaceSlot) {
    const req = ps._requestedBouncePlaceSlot;
    delete ps._requestedBouncePlaceSlot;
    chosen = bounceable.find(b => b.heroIdx === req.heroIdx && b.slotIdx === req.slotIdx) || null;
    // If the request no longer matches (creature moved / bounced), fall
    // back to the prompt path below.
  }

  if (!chosen) {
    // Build zone-pick options (one per bounceable Creature).
    const zones = bounceable.map(b => {
      const hero = ps.heroes[b.heroIdx];
      return {
        heroIdx: b.heroIdx,
        slotIdx: b.slotIdx,
        label: `${hero?.name || 'Hero'} — ${b.cardName} (Slot ${b.slotIdx + 1})`,
      };
    });

    const picked = await ctx.promptZonePick(zones, {
      title: cardName,
      description: `Bounce a Deepsea Creature to place ${cardName} into its Support Zone?`,
      confirmLabel: '🌊 Bounce & Place',
      cancellable: true,
    });

    if (!picked) {
      // Player cancelled — card goes back to hand (server does that because
      // we return false and don't set _placementConsumedByCard).
      return false;
    }

    chosen = bounceable.find(b => b.heroIdx === picked.heroIdx && b.slotIdx === picked.slotIdx);
    if (!chosen) return false;
  }

  // Capture the bounced Creature's identity BEFORE returning it — some
  // on-summon effects need the bounced data (Jack O' Lantern, Monstrosity).
  const bouncedName = chosen.cardName;
  const bouncedInst = chosen.inst;
  const bouncedHeroIdx = chosen.heroIdx;
  const bouncedSlotIdx = chosen.slotIdx;
  const cardDB = engine._getCardDB();
  const bouncedLevel = cardDB[bouncedName]?.level || 0;

  // Infected Squirrel clause: its card text permits same-turn bouncing
  // in exchange for summon-locking the player for the rest of the
  // turn. Flag the lock now (applied AFTER placement completes so the
  // incoming Deepsea Creature itself isn't blocked by the very lock
  // its bounce-place caused). The flag is consumed by the standard
  // ps.summonLocked gate in the server's creature-play handler.
  const lockSummonsAfter =
    bouncedName === 'Infected Squirrel' &&
    (bouncedInst.turnPlayed || 0) >= (gs.turn || 0);

  // ════════════════════════════════════════════
  //  ATOMIC STATE MUTATION:
  //  The swap looks instant to the player — the new Creature appears
  //  in the Support Zone and disappears from the hand at the same
  //  moment, while the old Creature simultaneously enters the hand
  //  (animating in from the vacated slot). To achieve that, we do ALL
  //  state changes BEFORE the first engine.sync() and broadcast the
  //  pile-transfer animation in the same batch. Hooks fire after the
  //  sync so their side-effects (Teppes draw, Siphem counter, Blood
  //  Moon retrigger) ship in a second sync once the visual swap has
  //  already landed on-screen.
  // ════════════════════════════════════════════

  // (A) Remove bounced Creature's name from the support slot.
  const slotArr = ps.supportZones?.[bouncedHeroIdx]?.[bouncedSlotIdx];
  if (Array.isArray(slotArr)) {
    const idx = slotArr.indexOf(bouncedName);
    if (idx >= 0) slotArr.splice(idx, 1);
  }

  // (B) Place the new Creature's NAME into the same slot AND track a
  //     fresh CardInstance for it so engine.sync() ships both changes
  //     in one broadcast. Directly mutate state (rather than calling
  //     placeCreature) so we control ordering vs. hand updates.
  if (!ps.supportZones[bouncedHeroIdx]) ps.supportZones[bouncedHeroIdx] = [[], [], []];
  ps.supportZones[bouncedHeroIdx][bouncedSlotIdx] = [cardName];
  const newInst = engine._trackCard(cardName, pi, 'support', bouncedHeroIdx, bouncedSlotIdx);
  newInst.counters = newInst.counters || {};
  newInst.counters.isPlacement = 1;
  newInst.turnPlayed = gs.turn || 0;
  newInst.counters._bouncedFromName = bouncedName;
  newInst.counters._bouncedFromLevel = bouncedLevel;

  // (C) Splice the new card from the player's hand immediately. The
  //     server's creature-play handler marked it via `_resolvingCard`
  //     BEFORE beforeSummon ran, so we find the exact copy that was
  //     being played and remove it. That keeps the hand count in sync
  //     and increments the standard scTracking counter the server's
  //     commitHandRemoval would otherwise increment. Clearing
  //     _resolvingCard makes commitHandRemoval a no-op downstream.
  //     Capture the hand index BEFORE splicing — used as the source
  //     coordinate for the hand→support pile-transfer animation so the
  //     inbound flying card originates where the card sat in hand.
  let newCardFromHandIdx = -1;
  if (ps._resolvingCard) {
    const { name, nth } = ps._resolvingCard;
    let seen = 0, handRemoveIdx = -1;
    for (let i = 0; i < ps.hand.length; i++) {
      if (ps.hand[i] === name) { seen++; if (seen === nth) { handRemoveIdx = i; break; } }
    }
    if (handRemoveIdx >= 0) {
      newCardFromHandIdx = handRemoveIdx;
      ps.hand.splice(handRemoveIdx, 1);
      if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
    }
    ps._resolvingCard = null;
  }

  // (D) Push the bounced Creature's NAME onto the hand.
  if (!ps.hand) ps.hand = [];
  const toHandIdx = ps.hand.length;
  ps.hand.push(bouncedName);

  // (E) Broadcast BOTH pile-transfer animations BEFORE the first sync
  //     so the client sees the "flying cards" events and the new state
  //     (support updated + hand updated) in one frame. The two cards
  //     visually CROSS — bounced creature flies support→hand at the
  //     same moment the new creature flies hand→support. The landing
  //     hand slot is hidden via `bounceReturnHidden`; the landing
  //     support slot is hidden via `bounceOutgoingHidden`. A
  //     lightweight `deep_sea_bubbles` glow fires on the vacated slot.
  engine._broadcastEvent('play_pile_transfer', {
    owner: pi, cardName: bouncedName, from: 'support', to: 'hand',
    fromHeroIdx: bouncedHeroIdx, fromSlotIdx: bouncedSlotIdx,
    toHandIdx,
  });
  engine._broadcastEvent('play_pile_transfer', {
    owner: pi, cardName, from: 'hand', to: 'support',
    fromHandIdx: newCardFromHandIdx,
    toHeroIdx: bouncedHeroIdx, toSlotIdx: bouncedSlotIdx,
  });
  engine._broadcastEvent('play_zone_animation', {
    type: 'deep_sea_bubbles', owner: pi, heroIdx: bouncedHeroIdx, zoneSlot: bouncedSlotIdx,
  });
  engine._broadcastEvent('summon_effect', {
    owner: pi, heroIdx: bouncedHeroIdx, zoneSlot: bouncedSlotIdx, cardName,
  });

  // (F) Signal the server before sync so state sent to clients
  //     reflects the atomic swap.
  ps._placementConsumedByCard = cardName;

  engine.log('placement', {
    card: cardName, by: `${cardName} (Bounce-Place)`, from: 'external',
    heroIdx: bouncedHeroIdx, zoneSlot: bouncedSlotIdx,
  });
  engine.log('deepsea_return_to_hand', {
    player: ps.username, card: bouncedName, by: `${cardName} (Bounce-Place)`,
    heroIdx: bouncedHeroIdx, slotIdx: bouncedSlotIdx,
  });

  // (G) Single sync — every state change lands on the client in one
  //     frame. Sequence after this point is hook invocations that may
  //     mutate state further; each hook's own engine.sync() (or ours
  //     at the end) ships those follow-ups.
  engine.sync();

  // ════════════════════════════════════════════
  //  POST-SYNC HOOKS:
  //  Update the bounced instance's zone metadata so onCardLeaveZone
  //  listeners see it as "now in hand" rather than "still in support",
  //  then untrack it (hand uses names, not CardInstances).
  // ════════════════════════════════════════════
  bouncedInst.zone = 'hand';
  bouncedInst.heroIdx = -1;
  bouncedInst.zoneSlot = -1;
  await engine.runHooks('onCardLeaveZone', {
    card: bouncedInst, fromZone: 'support',
    fromOwner: pi, fromHeroIdx: bouncedHeroIdx, fromZoneSlot: bouncedSlotIdx,
    toZone: 'hand', toOwner: pi,
    _skipReactionCheck: true,
  });
  await engine.runHooks('onCardsReturnedToHand', {
    ownerIdx: pi, returnedCards: [bouncedName], returnedInsts: [bouncedInst],
    by: `${cardName} (Bounce-Place)`, _skipReactionCheck: true,
  });
  engine._untrackCard(bouncedInst.id);

  // New Creature's on-summon hooks fire now. Delayed until after the
  // visual swap so animations / damage numbers from the on-summon
  // effect render on top of an already-placed creature. The
  // `_bypassDeadHeroFilter` flag is required when the bounce-place
  // landed in a DEAD Hero's zone — runHooks normally filters out
  // listeners attached to dead heroes (`c.heroIdx`'s hero.hp <= 0),
  // which would swallow the new Creature's own onPlay. Deepsea swap
  // explicitly supports placing into dead-hero zones, so the on-summon
  // effect MUST still fire.
  const bouncedHero = gs.players[pi]?.heroes?.[bouncedHeroIdx];
  const landedOnDeadHero = !bouncedHero?.name || bouncedHero.hp <= 0;
  await engine.runHooks('onPlay', {
    _onlyCard: newInst, playedCard: newInst, cardName,
    zone: 'support', heroIdx: bouncedHeroIdx, zoneSlot: bouncedSlotIdx,
    _skipReactionCheck: true,
    _bypassDeadHeroFilter: landedOnDeadHero,
  });
  await engine.runHooks('onCardEnterZone', {
    enteringCard: newInst, toZone: 'support', toHeroIdx: bouncedHeroIdx,
    _skipReactionCheck: true,
    _bypassDeadHeroFilter: landedOnDeadHero,
  });

  // Apply Infected Squirrel's summon-lock penalty AFTER the replacement
  // has fully landed. Set on the player so every subsequent creature
  // play/placement this turn fizzles via the standard `ps.summonLocked`
  // check. Reset automatically at turn-start like other per-turn flags.
  if (lockSummonsAfter) {
    ps.summonLocked = true;
    engine.log('infected_squirrel_lock', {
      player: ps.username, by: cardName, bouncedFrom: bouncedName,
    });
  }

  engine.sync();
  return false;
}

// ─── Deepsea Counters (Siphem) ──────────────

/** Add N Deepsea Counters to a hero (stored directly on the hero object). */
function addDeepseaCounters(hero, n = 1) {
  if (!hero) return;
  hero.deepseaCounters = (hero.deepseaCounters || 0) + n;
}

/** Clear all Deepsea Counters on a hero (used at end of Siphem's turn). */
function clearDeepseaCounters(hero) {
  if (!hero) return;
  delete hero.deepseaCounters;
}

// ─── Inherent / level-bypass drivers ────────
//
// These two helpers are re-exported so each Deepsea Creature module can
// use them as its `inherentAction` and `canBypassLevelReq` values without
// having to duplicate the "is there a bounceable?" check.

function inherentActionIfBounceable(gs, pi, heroIdx, engine, opts) {
  // Deepsea's "free Action" clause is the BOUNCE-PLACE path: replace one
  // of your own bounceable Deepsea Creatures. Plain summons to an empty
  // Support Zone still cost an Action even when the player happens to
  // also have a bounceable Creature on the board. `opts.zoneSlot` is the
  // drop target; an empty slot here means the player is doing a normal
  // summon, not a bounce-place — so this is NOT inherent.
  if (opts && opts.zoneSlot != null) {
    const slot = (gs.players?.[pi]?.supportZones?.[heroIdx] || [])[opts.zoneSlot] || [];
    if (slot.length === 0) return false;
  }
  return getBounceableDeepseaCreatures(engine, pi).length > 0;
}

function canBypassLevelReqIfBounceable(gs, pi, heroIdx, cardData, engine) {
  return getBounceableDeepseaCreatures(engine, pi).length > 0;
}

/**
 * Free-zone bypass: a Deepsea Creature should be listed as playable on
 * ANY of your own Heroes whenever at least one bounceable Deepsea exists,
 * even if every Support Zone on that Hero is occupied (because the place-
 * ment slot is dictated by the bounced Creature, not by the Hero chosen
 * in the drag). Consulted from engine.getHeroPlayableCards.
 */
function canBypassFreeZoneIfBounceable(gs, pi, heroIdx, cardData, engine) {
  return getBounceableDeepseaCreatures(engine, pi).length > 0;
}

/**
 * Direct drop gate: when the drag target is an occupied Support slot,
 * the server consults this predicate to decide whether the drop is a
 * legal "swap onto this Creature" gesture. A slot qualifies iff the
 * current occupant IS a bounceable Deepsea Creature for this player.
 */
function canPlaceOnOccupiedSlotIfBounceable(gs, pi, heroIdx, slotIdx, engine) {
  if (!engine) return false;
  const slot = (gs.players[pi]?.supportZones?.[heroIdx] || [])[slotIdx] || [];
  if (slot.length === 0) return false;
  const inst = engine.cardInstances.find(c =>
    c.zone === 'support' &&
    (c.owner === pi || c.controller === pi) &&
    c.heroIdx === heroIdx &&
    c.zoneSlot === slotIdx
  );
  if (!inst) return false;
  if (!isDeepseaCreature(inst.name, engine, inst)) return false;
  // "Not summoned this turn" — matches getBounceableDeepseaCreatures.
  // Infected Squirrel is the explicit exception: its card text lets it
  // be bounced on the same turn it was summoned (at the cost of
  // locking further summons, applied in tryBouncePlace).
  if (inst.name !== 'Infected Squirrel' && (inst.turnPlayed || 0) >= (gs.turn || 0)) return false;
  return true;
}

/**
 * Client highlight data: return the list of occupied Support slots on
 * the player's side that qualify as direct bounce-place drop targets.
 * The server serializes this into gameState.bouncePlacementTargets per
 * hand card so the client can light up the Bats-slot (or whichever)
 * when the player starts dragging a Deepsea Creature.
 */
function getBouncePlacementTargetsList(gs, pi, engine) {
  if (!engine) return [];
  return getBounceableDeepseaCreatures(engine, pi)
    .map(c => ({ heroIdx: c.heroIdx, slotIdx: c.slotIdx }));
}

// ─── Per-turn summon limit ──────────────────
//
// Every Deepsea Creature text ends with "You can only summon 1 X per turn."
// Track per-player which names were placed/summoned this turn via a Set on
// the player state. The helper below plugs into both `canSummon` (pre-play
// gate) and is called from `onPlay` to mark a successful summon.

function canSummonPerTurnLimit(ctx, cardName) {
  const ps = ctx._engine?.gs?.players?.[ctx.cardOwner];
  if (!ps) return true;
  const set = ps._deepseaPerTurnSummoned;
  return !(set && set.has(cardName));
}

function markSummonedPerTurnLimit(ctx, cardName) {
  const ps = ctx._engine?.gs?.players?.[ctx.cardOwner];
  if (!ps) return;
  if (!ps._deepseaPerTurnSummoned) ps._deepseaPerTurnSummoned = new Set();
  ps._deepseaPerTurnSummoned.add(cardName);
}

/** Clear the per-turn summon set — called from a generic onTurnStart hook. */
function resetPerTurnSummons(ps) {
  if (ps && ps._deepseaPerTurnSummoned) ps._deepseaPerTurnSummoned.clear();
}

// ─── On-summon dispatch helper ──────────────
//
// Most Deepsea Creatures have "may" on-summon effects — the controller
// chooses whether to activate. We funnel that "do you want to activate X?"
// prompt through one helper so the UI language stays consistent. Returns
// true when the controller confirms; false/null on cancel.

async function promptOptionalOnSummon(ctx, title, message) {
  return !!(await ctx.promptConfirmEffect({ title, message }));
}

// ─── Generic creature atomic swap ────────────
//
// Castle and Shapeshift both implement a two-step swap — pick an own
// Creature on the board, pick a different-named Creature in hand with
// level ≤ bounced creature's level, then perform the bounce + place in
// one atomic state mutation so the client shows the two cards crossing
// mid-flight. Factored out of deepsea-castle.js so future cards can
// reuse the exact animation + hook sequence.

/** All own Creatures in support zones (any archetype, any turn-played). */
function ownSupportCreatures(engine, pi) {
  const { hasCardType } = require('./_hooks');
  const cardDB = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.faceDown) continue;
    const cd = cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push(inst);
  }
  return out;
}

/**
 * Different-named Creatures in hand with level ≤ maxLevel. Also filters out
 * Creatures whose `canSummon` gate rejects the current state — this is what
 * prevents Shapeshift / Castle from letting a tribute-summon Creature
 * (Dragon Pilot, Dark Deepsea God, etc.) appear as a swap target when the
 * player couldn't actually pay its cost.
 */
function eligibleSwapReplacements(engine, pi, excludeName, maxLevel) {
  const { hasCardType } = require('./_hooks');
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const seen = new Set();
  const out = [];
  for (const n of (ps.hand || [])) {
    if (seen.has(n)) continue;
    if (n === excludeName) continue;
    const cd = cardDB[n];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if ((cd.level || 0) > maxLevel) continue;
    // canSummon gate — e.g. Dragon Pilot / DDG's sacrifice-or-tribute
    // requirement. isCreatureSummonable returns true when no script
    // defines canSummon, so plain Creatures pass through untouched.
    if (typeof engine.isCreatureSummonable === 'function'
        && !engine.isCreatureSummonable(n, pi)) continue;
    seen.add(n);
    out.push({ name: n, source: 'hand', cost: cd.level || 0 });
  }
  return out;
}

/**
 * Atomic creature swap. Mirrors the Deepsea bounce-place gesture:
 * bounced creature flies support → hand, new creature flies hand →
 * support in a single engine.sync() so the cards visually cross.
 *
 * The caller has already validated the pick; this function doesn't
 * re-check level / name gates.
 *
 * @returns {Promise<{newInst:object, bouncedLevel:number}|null>}
 */
async function atomicSwap(engine, pi, bouncedInst, newCardName, sourceName) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return null;
  // Player-wide summon lock blocks ANY path that adds a new Creature to
  // the board, including atomic swaps from Castle / Shapeshift /
  // bounce-place. The caller's canActivate / spellPlayCondition should
  // already reject under lock; this is a defense-in-depth catch.
  if (ps.summonLocked) {
    engine.log('swap_blocked', {
      card: newCardName, by: sourceName || 'Swap', reason: 'summonLocked',
    });
    return null;
  }
  const cardDB = engine._getCardDB();
  const bouncedName = bouncedInst.name;
  const bouncedLevel = cardDB[bouncedName]?.level || 0;
  const bouncedHeroIdx = bouncedInst.heroIdx;
  const bouncedSlotIdx = bouncedInst.zoneSlot;

  // Pre-placement gate: run the incoming Creature's `beforeSummon` hook
  // so sacrifice / tribute costs (Dragon Pilot, Dark Deepsea God, etc.)
  // are paid BEFORE the swap commits. Returning false aborts the swap —
  // either the player cancelled the cost prompt, or the card placed
  // itself and took over the summon (DDG sets _placementConsumedByCard
  // and returns false; we don't want to double-place on top of that).
  //
  // The `_isSwap` flag is read by `tryBouncePlace` (the Deepsea
  // creatures' beforeSummon) so it skips its own bounce-place prompt —
  // the swap's bounce-out is already happening via the caller.
  if (typeof engine._runBeforeSummon === 'function') {
    const ok = await engine._runBeforeSummon(newCardName, pi, bouncedHeroIdx, { _isSwap: true });
    if (!ok) {
      engine.log('swap_blocked', {
        card: newCardName, by: sourceName || 'Swap', reason: 'beforeSummon',
      });
      return null;
    }
  }

  // (A) Remove bounced creature name from its support slot.
  const slotArr = ps.supportZones?.[bouncedHeroIdx]?.[bouncedSlotIdx];
  if (Array.isArray(slotArr)) {
    const idx = slotArr.indexOf(bouncedName);
    if (idx >= 0) slotArr.splice(idx, 1);
  }

  // (B) Place new creature name + track a fresh instance.
  if (!ps.supportZones[bouncedHeroIdx]) ps.supportZones[bouncedHeroIdx] = [[], [], []];
  ps.supportZones[bouncedHeroIdx][bouncedSlotIdx] = [newCardName];
  const newInst = engine._trackCard(newCardName, pi, 'support', bouncedHeroIdx, bouncedSlotIdx);
  newInst.counters = newInst.counters || {};
  newInst.counters.isPlacement = 1;
  newInst.turnPlayed = gs.turn || 0;

  // (C) Splice the replacement from hand. Capture its hand index
  //     BEFORE splicing so the hand→support flying-card animation
  //     anchors at the card's original hand slot.
  const newCardFromHandIdx = (ps.hand || []).indexOf(newCardName);
  if (newCardFromHandIdx >= 0) ps.hand.splice(newCardFromHandIdx, 1);

  // (D) Push the bounced creature to hand.
  if (!ps.hand) ps.hand = [];
  const toHandIdx = ps.hand.length;
  ps.hand.push(bouncedName);

  // (E) Broadcast BOTH pile-transfers so the two creatures visually
  //     cross mid-flight — bounced support→hand, new hand→support.
  engine._broadcastEvent('play_pile_transfer', {
    owner: pi, cardName: bouncedName, from: 'support', to: 'hand',
    fromHeroIdx: bouncedHeroIdx, fromSlotIdx: bouncedSlotIdx,
    toHandIdx,
  });
  engine._broadcastEvent('play_pile_transfer', {
    owner: pi, cardName: newCardName, from: 'hand', to: 'support',
    fromHandIdx: newCardFromHandIdx,
    toHeroIdx: bouncedHeroIdx, toSlotIdx: bouncedSlotIdx,
  });
  engine._broadcastEvent('play_zone_animation', {
    type: 'deep_sea_bubbles', owner: pi, heroIdx: bouncedHeroIdx, zoneSlot: bouncedSlotIdx,
  });
  engine._broadcastEvent('summon_effect', {
    owner: pi, heroIdx: bouncedHeroIdx, zoneSlot: bouncedSlotIdx, cardName: newCardName,
  });

  engine.log('placement', {
    card: newCardName, by: sourceName, from: 'hand',
    heroIdx: bouncedHeroIdx, zoneSlot: bouncedSlotIdx,
  });
  engine.log('deepsea_return_to_hand', {
    player: ps.username, card: bouncedName, by: sourceName,
    heroIdx: bouncedHeroIdx, slotIdx: bouncedSlotIdx,
  });

  // (F) Single sync — client sees the atomic swap in one frame.
  engine.sync();

  // (G) Post-sync hooks. Update the bounced inst's zone fields so
  // onCardLeaveZone listeners see it as "now in hand".
  bouncedInst.zone = 'hand';
  bouncedInst.heroIdx = -1;
  bouncedInst.zoneSlot = -1;
  await engine.runHooks('onCardLeaveZone', {
    card: bouncedInst, fromZone: 'support',
    fromOwner: pi, fromHeroIdx: bouncedHeroIdx, fromZoneSlot: bouncedSlotIdx,
    toZone: 'hand', toOwner: pi,
    _skipReactionCheck: true,
  });
  await engine.runHooks('onCardsReturnedToHand', {
    ownerIdx: pi, returnedCards: [bouncedName], returnedInsts: [bouncedInst],
    by: sourceName, _skipReactionCheck: true,
  });
  engine._untrackCard(bouncedInst.id);

  // Bypass the runHooks dead-hero filter when the swap landed in a dead
  // Hero's zone (same rationale as tryBouncePlace above) — Deepsea swap
  // explicitly supports dead-hero destinations and the new Creature's
  // on-summon must still fire.
  const bouncedHero2 = gs.players[pi]?.heroes?.[bouncedHeroIdx];
  const landedOnDeadHero2 = !bouncedHero2?.name || bouncedHero2.hp <= 0;
  await engine.runHooks('onPlay', {
    _onlyCard: newInst, playedCard: newInst, cardName: newCardName,
    zone: 'support', heroIdx: bouncedHeroIdx, zoneSlot: bouncedSlotIdx,
    _skipReactionCheck: true,
    _bypassDeadHeroFilter: landedOnDeadHero2,
  });
  await engine.runHooks('onCardEnterZone', {
    enteringCard: newInst, toZone: 'support', toHeroIdx: bouncedHeroIdx,
    _skipReactionCheck: true,
    _bypassDeadHeroFilter: landedOnDeadHero2,
  });
  engine.sync();
  return { newInst, bouncedLevel };
}

// ─── Exported Blood Moon under the Sea re-trigger ───────
//
// Blood Moon equipment re-fires the on-summon of creatures placed in OTHER
// support zones of its equipped hero, once per turn. The equipment exports
// this helper so the triggering creature calls in. Shared here so any
// future equipment with "re-trigger on-summon" semantics can reuse it.

async function reTriggerOnSummon(engine, enteringInst) {
  if (!enteringInst) return;
  const cardDB = engine._getCardDB();
  const cd = cardDB[enteringInst.name];
  if (!cd) return;
  const { loadCardEffect } = require('./_loader');
  const script = loadCardEffect(enteringInst.name);
  if (!script?.hooks?.onPlay) return;
  // Build a fresh hookCtx limited to this instance so only its own onPlay
  // fires (other listening cards don't re-trigger).
  await engine.runHooks('onPlay', {
    _onlyCard: enteringInst, playedCard: enteringInst,
    cardName: enteringInst.name, zone: enteringInst.zone,
    heroIdx: enteringInst.heroIdx, zoneSlot: enteringInst.zoneSlot,
    _skipReactionCheck: true,
    _isBloodMoonRetrigger: true,
  });
}

module.exports = {
  DEEPSEA_ARCHETYPE,
  isDeepseaCreature,
  activateDeepseaSpores,
  getBounceableDeepseaCreatures,
  hasBounceableDeepsea,
  returnSupportCreatureToHand,
  fireReturnBatchHook,
  tryBouncePlace,
  addDeepseaCounters,
  clearDeepseaCounters,
  inherentActionIfBounceable,
  canBypassLevelReqIfBounceable,
  canBypassFreeZoneIfBounceable,
  canPlaceOnOccupiedSlotIfBounceable,
  getBouncePlacementTargetsList,
  canSummonPerTurnLimit,
  markSummonedPerTurnLimit,
  ownSupportCreatures,
  eligibleSwapReplacements,
  atomicSwap,
  resetPerTurnSummons,
  promptOptionalOnSummon,
  reTriggerOnSummon,
};
