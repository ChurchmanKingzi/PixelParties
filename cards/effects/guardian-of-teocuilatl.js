// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian of Teocuilatl"
//  Creature (Summoning Magic Lv1, 100 HP)   Archetype: Doom Clock
//
//  "You may sacrifice a Creature you control that was not summoned this
//   turn to summon this Creature as an additional Action. When an Area
//   would be affected by a card or effect, you may sacrifice this
//   Creature from your hand or side of the board to negate all effects
//   that card or effect would have on that Area."
//
//  ── Part 1: summon-by-sacrifice as additional Action ──
//  The Archer pattern: `inherentAction` is a function gated on an
//  eligible tribute (a Creature NOT summoned this turn, OR a hand
//  substitute like Chosen Sacrifice). While that holds, the engine
//  routes the summon as a free additional Action and `beforeSummon`
//  charges the sacrifice. Cancelling the sacrifice aborts the alt
//  summon (card returns to hand, the Action slot is kept) — the
//  consistent creature-summon behaviour (Archer / Baby Spider).
//
//  ── Part 2: Area protection ──
//  Listens on the engine's `onAreaWouldBeAffected` window (fired before
//  removeArea / removeAllAreas). When one of the CONTROLLER's own Areas
//  would be affected, offer to sacrifice this Guardian — from hand OR
//  the board — to negate the effect on that Area (`ctx.cancel()` aborts
//  the removal). A second Guardian sees the already-cancelled event and
//  stays its hand.
// ═══════════════════════════════════════════

const CARD_NAME = 'Guardian of Teocuilatl';

/** Does `pi` have a tribute for the alt-summon cost — a board Creature
 *  not summoned this turn, or a hand substitute (Chosen Sacrifice)?
 *
 *  Routed through `_collectSacrificeCandidates` (the same collector the
 *  payment path's `resolveSacrificeCost` uses) rather than checking the
 *  board list and `_getHandSacrificeSubstitutes` separately. That kept
 *  the gate and the payment in sync when the substitute rule gained its
 *  "a board Creature must exist" precondition — otherwise this gate
 *  would offer the summon with an empty board and the picker would then
 *  come up empty. */
function hasTribute(engine, pi) {
  const turn = engine.gs.turn;
  return engine._collectSacrificeCandidates(pi, {
    filter: c => c.inst.turnPlayed !== turn,
  }).length > 0;
}

// ── Full-board sacrifice-summon (Suspicious Monster pattern) ──
// When every Support Zone is full, the only way to summon Guardian via
// its alt path is to sacrifice a board Creature INTO its own slot — the
// sacrifice frees exactly the slot Guardian then lands in. (A hand
// substitute like Chosen Sacrifice can't help here: it never frees a
// board slot.) These helpers mirror Suspicious Monster's drop-on-
// occupied framework so the card stays draggable / clickable onto a
// full Hero whose Creature is a legal tribute.

/** Can `heroIdx` legally host Guardian right now (alive + meets its
 *  level/school requirement)? The freed slot is the sacrificed
 *  Creature's, so that Creature's Hero is the host. */
function heroCanSummon(engine, pi, heroIdx) {
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  const cd = engine._getCardDB()[CARD_NAME];
  return engine.heroMeetsLevelReq(pi, heroIdx, cd);
}

/** The sacrificeable (not-summoned-this-turn) board Creature occupying a
 *  slot whose Hero can host Guardian, or null. */
function findOccupant(engine, pi, heroIdx, slotIdx) {
  const gs = engine.gs;
  const slot = (gs.players[pi]?.supportZones?.[heroIdx] || [])[slotIdx] || [];
  if (slot.length === 0) return null;
  if (!heroCanSummon(engine, pi, heroIdx)) return null;
  const inst = engine.cardInstances.find(c =>
    c.zone === 'support' && (c.controller ?? c.owner) === pi
    && c.heroIdx === heroIdx && c.zoneSlot === slotIdx && !c.faceDown);
  if (!inst) return null;
  if ((inst.turnPlayed || 0) >= (gs.turn || 0)) return null; // summoned this turn
  // Engine helper drops Cardinal Beasts / immovables / "cannot be sacrificed".
  if (!engine.getSacrificableCreatures(pi).some(c => c.inst.id === inst.id)) return null;
  return inst;
}

/** All occupied slots holding a sacrificeable Creature whose Hero can
 *  host Guardian. */
function sacrificeableSlots(engine, pi) {
  const turn = engine.gs.turn;
  return engine.getSacrificableCreatures(pi)
    .filter(c => c.inst.zone === 'support' && c.inst.turnPlayed !== turn
      && heroCanSummon(engine, pi, c.inst.heroIdx))
    .map(c => ({ heroIdx: c.inst.heroIdx, slotIdx: c.inst.zoneSlot, cardName: c.cardName, inst: c.inst }));
}

/** Full-board sacrifice-summon: sacrifice the occupant of the dropped
 *  slot and install Guardian into that same (now-freed) slot. Returns
 *  true on success (placement consumed — server skips its own placement),
 *  false to abort. The hand removal is done here BY NAME and the
 *  hand→board flight is emitted manually, because the server's pinned
 *  `_resolvingCard` is unreliable on the click-to-place route (it's unset
 *  there, so the server's commitHandRemoval no-ops and leaves the played
 *  copy in hand). */
async function sacrificeSummonIntoSlot(engine, pi, req) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const occ = findOccupant(engine, pi, req.heroIdx, req.slotIdx);
  if (!occ) return false;
  const { heroIdx, slotIdx } = req;
  const occName = occ.name;

  // (1) Knife visual + ON_CREATURE_SACRIFICED while the tribute is still
  //     in its slot (feeds Temple / Ruin Mourner / Corpse Cannibal). The
  //     per-turn tally + `_sacrificedTurn` stamp are applied centrally in
  //     runHooks — mirrors engine.resolveSacrificeCost.
  engine._broadcastEvent('play_zone_animation', {
    type: 'knife_sacrifice', owner: pi, heroIdx, zoneSlot: slotIdx,
  });
  await engine._delay(450);
  await engine.runHooks('onCreatureSacrificed', {
    creature: occ, cardName: occName, owner: occ.owner,
    heroIdx, zoneSlot: slotIdx,
    source: { name: CARD_NAME, owner: pi, heroIdx },
    _skipReactionCheck: true,
  });

  // (2) Hand→board flight for Guardian — emitted BEFORE the hand splice so
  //     the client still renders the source card at `fromHandIdx`.
  //     `_forceOwnerAnim` makes the OWNER see it too: the click/bounce
  //     route has no drag gesture to ride on, so this is the only flight
  //     cue. This is the same event the server's normal summon uses
  //     (`hand_to_board_fly`), NOT a pile-transfer — the latter rendered a
  //     stray card from mid-hand (looked like a duplicate).
  const fromHandIdx = ps.hand.indexOf(CARD_NAME);
  engine._broadcastEvent('hand_to_board_fly', {
    ownerIdx: pi, cardName: CARD_NAME,
    handIndex: fromHandIdx >= 0 ? fromHandIdx : 0,
    zoneType: 'support', heroIdx, slotIdx, _forceOwnerAnim: true,
  });

  // (3) Atomic swap: remove the occupant's name, place Guardian's name +
  //     a fresh instance into the SAME slot before the post-destroy hooks
  //     fire, so a resummon-into-the-freed-slot reaction (Corpse Cannibal)
  //     finds the slot taken and skips it.
  const slotArr = ps.supportZones?.[heroIdx]?.[slotIdx];
  if (Array.isArray(slotArr)) {
    const idx = slotArr.indexOf(occName);
    if (idx >= 0) slotArr.splice(idx, 1);
  }
  if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
  ps.supportZones[heroIdx][slotIdx] = [CARD_NAME];
  const newInst = engine._trackCard(CARD_NAME, pi, 'support', heroIdx, slotIdx);
  newInst.counters = newInst.counters || {};
  newInst.counters.isPlacement = 1;
  newInst.turnPlayed = gs.turn || 0;

  // (4) Remove Guardian from hand BY NAME (path-independent — all copies
  //     are identical). Clear `_resolvingCard` so the server's
  //     commitHandRemoval is a no-op, and set `_placementConsumedByCard`
  //     so the server skips its own placement.
  if (fromHandIdx >= 0) {
    ps.hand.splice(fromHandIdx, 1);
    if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
  }
  ps._resolvingCard = null;
  ps._placementConsumedByCard = CARD_NAME;

  // (5) Summon glow, then sync (after the flight was emitted, so the
  //     client still had the source card when the flight fired).
  engine._broadcastEvent('summon_effect', {
    owner: pi, heroIdx, zoneSlot: slotIdx, cardName: CARD_NAME,
  });
  engine.log('teocuilatl_sacrifice_summon', {
    player: ps.username, sacrificed: occName, heroIdx, slotIdx,
  });
  engine.sync();

  // (6) Route the sacrificed occupant to discard + fire ON_CREATURE_DEATH
  //     (sacrifice is a sub-type of dying). Slot already taken by Guardian.
  occ.zone = 'discard'; occ.heroIdx = -1; occ.zoneSlot = -1;
  if (!ps.discardPile) ps.discardPile = [];
  ps.discardPile.push(occName);
  await engine.runHooks('onCardLeaveZone', {
    card: occ, leavingCard: occ, fromZone: 'support',
    fromOwner: pi, fromHeroIdx: heroIdx, fromZoneSlot: slotIdx,
    toZone: 'discard', _skipReactionCheck: true,
  });
  await engine.runHooks('onCreatureDeath', {
    creature: {
      name: occName, owner: occ.owner, originalOwner: occ.originalOwner,
      heroIdx: slotIdx, zoneSlot: slotIdx, instId: occ.id,
    },
    source: { name: CARD_NAME, owner: pi, heroIdx },
    _skipReactionCheck: true,
  });
  engine._untrackCard(occ.id);

  // (7) Guardian's own on-summon lifecycle.
  const hostHero = gs.players[pi]?.heroes?.[heroIdx];
  const onDeadHero = !hostHero?.name || hostHero.hp <= 0;
  await engine.runHooks('onPlay', {
    _onlyCard: newInst, playedCard: newInst, cardName: CARD_NAME,
    zone: 'support', heroIdx, zoneSlot: slotIdx,
    _skipReactionCheck: true, _bypassDeadHeroFilter: onDeadHero,
  });
  await engine.runHooks('onCardEnterZone', {
    enteringCard: newInst, toZone: 'support', toHeroIdx: heroIdx,
    _skipReactionCheck: true, _bypassDeadHeroFilter: onDeadHero,
  });
  engine.sync();
  return true; // placement consumed
}

/** Sacrifice a specific Guardian instance (hand or board): fire the
 *  sacrifice signal + per-turn tally/stamp, then route it to discard. */
async function sacrificeSelf(engine, inst, pi) {
  const ps = engine.gs.players[pi];
  // Per-turn tally + `_sacrificedTurn` stamp are applied centrally in
  // `runHooks(onCreatureSacrificed)` — don't do them here (double-count).
  await engine.runHooks('onCreatureSacrificed', {
    creature: inst, cardName: inst.name, owner: inst.owner,
    heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
    source: { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx ?? -1 },
    _skipReactionCheck: true,
  });
  if (inst.zone === 'hand') {
    const hi = (ps?.hand || []).indexOf(inst.name);
    engine._broadcastEvent('play_pile_transfer', {
      owner: inst.owner, cardName: inst.name,
      from: 'hand', to: 'discard', fromHandIdx: hi >= 0 ? hi : 0,
    });
    if (hi >= 0) ps.hand.splice(hi, 1);
    ps.discardPile.push(inst.name);
    inst.zone = 'discard'; inst.heroIdx = -1; inst.zoneSlot = -1;
    engine._untrackCard(inst.id);
  } else {
    await engine.actionDestroyCard(
      { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx }, inst,
    );
  }
}

module.exports = {
  activeIn: ['hand', 'support'],

  // Part 1 — alt summon available while a tribute exists.
  inherentAction(gs, pi, heroIdx, engine) {
    return hasTribute(engine, pi);
  },

  // ── Full-board sacrifice-summon hooks (Suspicious Monster pattern) ──
  // Playable on a full-zoned Hero while THAT Hero owns a sacrificeable
  // Creature — the destination slot is the sacrificed Creature's own, so
  // the sacrifice frees exactly the room Guardian needs.
  canBypassFreeZoneRequirement(gs, pi, heroIdx, cardData, engine) {
    return sacrificeableSlots(engine, pi).some(s => s.heroIdx === heroIdx);
  },
  // Legal drop onto an occupied slot iff its occupant is sacrificeable.
  canPlaceOnOccupiedSlot(gs, pi, heroIdx, slotIdx, engine) {
    return !!findOccupant(engine, pi, heroIdx, slotIdx);
  },
  // Client highlight for the draggable drop targets.
  getBouncePlacementTargets(gs, pi, engine) {
    return sacrificeableSlots(engine, pi).map(s => ({ heroIdx: s.heroIdx, slotIdx: s.slotIdx }));
  },

  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];

    // Drop onto an occupied slot → full-board sacrifice-summon: sacrifice
    // that slot's Creature and install Guardian into the freed slot. This
    // is the additional-Action mode and the ONLY way to summon Guardian
    // while every Support Zone is full. The helper handles placement, hand
    // removal, and the flight; returning its result (true) tells the
    // server the placement is already consumed.
    if (ps?._requestedBouncePlaceSlot) {
      const req = ps._requestedBouncePlaceSlot;
      delete ps._requestedBouncePlaceSlot;
      return await sacrificeSummonIntoSlot(engine, pi, req);
    }
    // A free-slot drop is handled by the normal placement path below — the
    // intent flag is consumed so it can't leak into a later play.
    if (ps?._requestedNormalSummonSlot) delete ps._requestedNormalSummonSlot;

    // Standard (non-inherent) summon — no cost (effect placements etc.).
    if (!ctx.isInherentAction) return true;

    // Free-slot additional-Action summon: pick any tribute (a board
    // Creature not summoned this turn, OR a hand substitute like Chosen
    // Sacrifice); the engine then places Guardian into the chosen slot.
    const turn = engine.gs.turn;
    const paid = await engine.resolveSacrificeCost(ctx, {
      minCount: 1,
      maxCount: 1,
      title: `${CARD_NAME} — Sacrifice`,
      description: 'Sacrifice 1 of your Creatures (not summoned this turn) to summon Guardian of Teocuilatl as an additional Action.',
      confirmLabel: '🗡️ Sacrifice!',
      confirmClass: 'btn-danger',
      cancellable: true,
      filter: (c) => c.inst.turnPlayed !== turn,
    });
    // Cancel → abort the alt summon: card returns to hand, Action kept.
    return !!paid;
  },

  // ── CPU: Confirm-Prompts pauschal bejahen (Barker-Bugklasse) ──────
  // onAreaWouldBeAffected-Confirm (Gegner-Aktion, plan-los).
  // Ohne Intercept declined der Brain-Default cancellable Confirms in
  // plan-losen Kontexten und der Effekt verpufft still. Der generic-
  // Dispatch lädt dieses Skript nur für Prompts mit dem eigenen
  // Kartentitel — Pauschal-Confirm ist damit korrekt gescopet.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {
    // Part 2 — protect the controller's Areas.
    onAreaWouldBeAffected: async (ctx) => {
      if (ctx.cancelled) return; // already negated by another Guardian
      const engine = ctx._engine;
      const pi = ctx.cardController ?? ctx.cardOwner;
      // Only protect YOUR OWN Areas.
      if (ctx.affectedOwner !== pi) return;

      const ok = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${ctx.source || 'An effect'} would affect your "${ctx.areaName}" Area. Sacrifice ${CARD_NAME} to negate it?`,
        showCard: CARD_NAME,
        confirmLabel: '🛡️ Sacrifice & Protect!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!ok) return;
      // Re-check it hasn't been protected during the prompt.
      if (ctx.cancelled) return;

      await sacrificeSelf(engine, ctx.card, pi);
      ctx.cancel(); // negate the effect on the Area
      engine.log('teocuilatl_protect', {
        player: engine.gs.players[pi]?.username, area: ctx.areaName, from: ctx.source,
      });
      engine.sync();
    },
  },

  cpuMeta: {
    onDeathBenefit: 6,
  },
};
