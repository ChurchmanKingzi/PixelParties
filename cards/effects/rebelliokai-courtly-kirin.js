// ═══════════════════════════════════════════
//  CARD EFFECT: "Rebelliokai Courtly Kirin"
//  Creature / Reaction (Summoning Magic Lv1) — 50 HP
//  Archetype: Rebelliokai. BANNED.
//
//  Self-deletes when sent to discard from
//  outside hand or board.
//
//  Reaction trigger: when the opponent activates
//  the active effect of one of their Heroes,
//  Kirin's controller may immediately summon
//  Kirin from hand as an additional Action by
//  discarding a different "Rebelliokai" Creature
//  from hand. If they do, the opponent's hero
//  effect is negated.
//
//  Wiring:
//    • `isReaction: true` — slots Kirin into the
//      standard chain-reaction window, which the
//      engine opens for every card activation
//      (including hero effects, which the server
//      routes through `executeCardWithChain`
//      with `cardType: 'Hero'`).
//    • `reactionCondition` filters the window to:
//        – the initial chain link is an opp hero
//          effect (cardType=='Hero', owner!=pi)
//        – the controller has at least one
//          Rebelliokai Creature in hand OTHER
//          than Kirin (the "different" cost)
//        – at least one free support slot exists
//          to host the Kirin summon
//    • `skipPostResolveDiscard: true` — engine-
//      side opt-out so the chain resolution
//      doesn't push Kirin to discard after its
//      resolve. Kirin lands on the board via
//      `summonCreatureWithHooks` inside resolve;
//      pushing it to discard on top would
//      duplicate.
//    • Negation: resolve sets the initial chain
//      link's `negated = true` flag, which the
//      chain resolution then honours by skipping
//      the link's resolve and playing the
//      negation visual.
// ═══════════════════════════════════════════

const {
  isRebelliokaiCreature,
  DISCARD_SOURCE_TAG,
} = require('./_rebelliokai-shared');

const CARD_NAME = 'Rebelliokai Courtly Kirin';

/**
 * Find unique Rebelliokai Creature names in `pi`'s hand other than
 * Kirin (the "different" cost-eligible pool). Returns an array of
 * { name, count } sorted alphabetically.
 */
function _eligibleCostCards(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const counts = {};
  for (const cn of (ps.hand || [])) {
    if (cn === CARD_NAME) continue;
    if (!isRebelliokaiCreature(cn, engine)) continue;
    counts[cn] = (counts[cn] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Is this Hero in a state where it can NORMAL-SUMMON a Creature right
 * now? Mirrors the engine-wide gate the standard hand-play path
 * applies — alive + not Frozen / Stunned / Negated / Bound. Spell-
 * school / level requirements are checked separately via
 * `engine.heroMeetsLevelReq`. Identical to Tengu's `_heroCanSummon`.
 */
function _heroCanSummon(hero) {
  if (!hero?.name || hero.hp <= 0) return false;
  const s = hero.statuses || {};
  if (s.frozen || s.stunned || s.negated || s.bound) return false;
  return true;
}

/**
 * First free support slot on a Hero who can legally HOST Kirin —
 * alive, not CC'd, AND satisfies Kirin's Summoning Magic Lv1
 * requirement via `engine.heroMeetsLevelReq`. Without the level /
 * status checks, Kirin would summon onto ANY Hero (dead, frozen,
 * negated, or just lacking Summoning Magic), bypassing the same
 * eligibility rules a hand-played Creature would face.
 */
function _findFreeSupportSlot(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return null;
  const cardDB = engine._getCardDB();
  const cd = cardDB[CARD_NAME];
  if (!cd) return null;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!_heroCanSummon(h)) continue;
    if (!engine.heroMeetsLevelReq(pi, hi, cd)) continue;
    const zones = ps.supportZones?.[hi] || [[], [], []];
    for (let zi = 0; zi < 3; zi++) {
      if ((zones[zi] || []).length === 0) {
        return { heroIdx: hi, slotIdx: zi };
      }
    }
  }
  return null;
}

module.exports = {
  selfDeleteOnExternalDiscard: true,
  // Kirin is a Reaction Creature — `isReaction` opens the chain-
  // reaction window for it, and the engine's hand-eligibility scan
  // (validateActionPlay) blocks proactive plays for Reaction-subtype
  // cards. The Reaction-subtype gate doesn't need a script-level
  // opt-out; we just don't define `proactivePlay`.
  isReaction: true,
  // Engine opt-out so the chain resolution doesn't push Kirin to
  // discard after its resolve — Kirin summons itself onto the board
  // inside resolve, and a parallel discard push would duplicate it.
  skipPostResolveDiscard: true,
  // While in hand, Kirin's reactionCondition is consulted by the
  // chain window — the engine reads activeIn at hook-firing time
  // for any reactive listener.
  activeIn: ['hand'],

  cpuMeta: {
    // Hard counter to opp hero-effect plays — closest analog is a
    // chain-negation reaction Spell (Anti Magic Shield, etc.) plus
    // a body on the board. Big swing piece.
    onDeathBenefit: 0,
    // Generic Rebelliokai aggregate-scorer hook — per-card valuation
    // when this card sits in hand (counted by `rebelScoreFor`). Kirin
    // is the only Rebelliokai with reserve-value; others omit this
    // field and contribute 0.
    rebelliokaiHandReserveValue: 15,
  },

  /**
   * Reaction window gate.
   *
   *   chainCtx.chain[0] is the initial activated card (the opp's
   *   hero effect we want to negate). Subsequent reactions chain
   *   on top — Kirin is allowed to add as long as the INITIAL link
   *   is still the opp hero effect. (If a previous reaction already
   *   negated it, the engine still lets Kirin chain — Kirin's
   *   "negate" is a no-op for an already-negated link, and the
   *   trigger is "when opp activates", not "when opp's effect is
   *   currently still active".)
   */
  reactionCondition(gs, pi, engine, chainCtx) {
    if (!chainCtx?.chain || chainCtx.chain.length === 0) return false;
    const initial = chainCtx.chain[0];
    if (!initial) return false;
    // Initial activator must be an opp hero effect.
    if (initial.cardType !== 'Hero') return false;
    if (initial.owner === pi) return false;
    // Kirin's controller must have a Rebelliokai Creature OTHER
    // than Kirin in hand to pay the discard cost.
    if (_eligibleCostCards(engine, pi).length === 0) return false;
    // And a free support slot for Kirin's body.
    if (!_findFreeSupportSlot(engine, pi)) return false;
    return true;
  },

  /**
   * Resolve sequence (chain runs LIFO — Kirin resolves before the
   * initial opp hero effect):
   *
   *   1. Pick the Rebelliokai cost from hand. One card → auto.
   *      Two+ → mandatory gallery (cancellable: false; Kirin was
   *      already committed at the chain window).
   *   2. Discard the chosen cost via `actionDiscardHandCard` with
   *      the standard Rebelliokai source tag — Kind Kitsune's
   *      onDiscard listener picks this up if she happens to be
   *      the cost.
   *   3. Find a free support slot and `summonCreatureWithHooks`
   *      for Kirin. Listeners that fire on Kirin's onPlay /
   *      onCardEnterZone behave as a normal summon would.
   *   4. Mark the initial chain link as negated. The engine's
   *      chain resolution then skips its resolve and plays the
   *      negation visual instead of the hero-effect resolve.
   *
   * Failure-mode: if for any reason the discard or the summon
   * can't complete (race condition during the chain — extremely
   * rare with our reactionCondition gate), Kirin's resolve falls
   * through and the engine treats this as a no-op success. The
   * `skipPostResolveDiscard` flag means Kirin would be lost —
   * push Kirin to discard manually as a defensive cleanup so the
   * card doesn't vanish from the game.
   */
  async resolve(engine, pi, _selectedIds, _validTargets, chain /*, myIdx */) {
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    // Defensive cleanup helper — if anything below fails, push Kirin
    // to discard so the cardName isn't permanently lost from any pile.
    const fallbackDiscard = () => {
      if (!ps.discardPile) ps.discardPile = [];
      ps.discardPile.push(CARD_NAME);
    };

    const eligible = _eligibleCostCards(engine, pi);
    if (eligible.length === 0) {
      // Hand changed mid-chain (rare). Bail.
      fallbackDiscard();
      return false;
    }

    let costName;
    if (eligible.length === 1) {
      costName = eligible[0].name;
    } else {
      const picked = await engine.promptGeneric(pi, {
        type:        'cardGallery',
        cards:       eligible.map(e => ({ name: e.name, source: 'hand', count: e.count })),
        title:       CARD_NAME,
        description: 'Discard a different "Rebelliokai" Creature from your hand to summon Courtly Kirin and negate the opponent\'s effect.',
        confirmLabel: '🦄 Pay & Negate!',
        cancellable: false,
      });
      if (!picked || !picked.cardName) {
        // Cancellable: false should make this unreachable, but the
        // prompt API allows graceful failure modes (timeout etc.).
        fallbackDiscard();
        return false;
      }
      costName = picked.cardName;
    }

    // Pay the cost — discard the chosen Rebelliokai with the standard
    // archetype source tag so Kind Kitsune's hook + Backup Bakus's
    // recur trigger fire correctly off this discard.
    const discarded = await engine.actionDiscardHandCard(pi, costName, null, {
      source: DISCARD_SOURCE_TAG,
    });
    if (!discarded) {
      fallbackDiscard();
      return false;
    }

    // Find a free support slot for Kirin's body.
    const dest = _findFreeSupportSlot(engine, pi);
    if (!dest) {
      // No slot left — cost was paid but Kirin can't land. Failsafe
      // discard for Kirin so it doesn't vanish.
      fallbackDiscard();
      return false;
    }

    engine._broadcastEvent('card_reveal', {
      cardName:  CARD_NAME,
      playerIdx: pi,
    });
    await engine._delay(600);

    // Summon Kirin via the canonical helper — onPlay /
    // onCardEnterZone fire normally so any "when summoned" hooks
    // chain properly.
    const summonResult = await engine.summonCreatureWithHooks(
      CARD_NAME, pi, dest.heroIdx, dest.slotIdx,
      { source: `${CARD_NAME} reaction` },
    );
    if (!summonResult) {
      fallbackDiscard();
      return false;
    }

    // Negate the initial chain link (the opp hero effect that
    // triggered Kirin). The chain resolution will detect the
    // `negated` flag on its next iteration and skip the resolve.
    const initial = chain && chain[0];
    if (initial && initial.cardType === 'Hero' && initial.owner !== pi) {
      initial.negated = true;
    }

    engine.log('rebelliokai_courtly_kirin', {
      player:    ps.username,
      paid:      costName,
      negated:   initial?.cardName || null,
      heroIdx:   dest.heroIdx,
      slotIdx:   dest.slotIdx,
    });
    engine.sync();
    return true;
  },
};
