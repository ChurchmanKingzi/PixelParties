// ═══════════════════════════════════════════
//  CARD EFFECT: "Saint Nicolas"
//  Hero — 450 HP, 40 ATK
//  Starting abilities: Adventurousness, Adventurousness
//
//  Two interlocking effects:
//
//  1. POTION REDIRECT (board-wide aura) — while
//     Saint Nicolas is in play AND active (alive,
//     not Frozen/Stunned/Negated), every Potion
//     EITHER player resolves is added to the
//     user's OPPONENT's hand instead of being
//     deleted. Listens on `afterPotionUsed` and
//     flips `placed: true` to suppress the
//     engine's default delete.
//
//  2. ACTION TAX — to perform an Action with
//     Saint Nicolas, the player must mark a
//     Potion to give to their opponent. Three-
//     phase commit through the engine:
//
//       a. `canPerformAction` (sync gate): refuses
//          any action when no Potion is in hand,
//          so the UI greys out hand plays and
//          ability activations under this Hero.
//          See `engine.canHeroPerformAction`.
//
//       b. `payHeroActionCost` (async, pre-action):
//          prompts the player to pick a Potion.
//          Cancelling refuses the action entirely.
//          On pick, the chosen instance gets a
//          `_stNicolasEscrowed` counter and the
//          slot index is exposed via
//          `ps._stNicolasEscrowedHandIdx` so the
//          client can paint a marker. The Potion
//          stays in the player's hand at this
//          point — no transfer yet.
//
//       c. `commitHeroActionCost` (action succeeds)
//          OR `refundHeroActionCost` (action
//          cancels / is negated): the engine
//          calls the appropriate one from
//          doPlaySpell / doPlayCreature /
//          doActivateAbility after the action's
//          outcome is known. Commit transfers the
//          escrowed Potion to opp's hand
//          (concurrent with the action's
//          animations); refund just clears the
//          escrow marker, leaving the Potion in
//          hand.
//
//  Tactical loop: opp uses a Potion → my Saint
//  Nicolas's aura redirects it to my hand → I
//  spend it as the action-tax on my next Saint
//  Nicolas Action → opp gets it back → opp uses
//  it again, perpetuating the cycle.
// ═══════════════════════════════════════════

const CARD_NAME = 'Saint Nicolas';

/**
 * Hand indices of Potion-type cards in `ps`'s hand. Used by both the
 * `canPerformAction` gate (zero-length → block Actions) and the
 * pay-cost picker (one entry → auto-mark, multiple → prompt).
 */
function _potionIndicesInHand(ps, cardDB) {
  const out = [];
  for (let i = 0; i < (ps.hand || []).length; i++) {
    const cd = cardDB[ps.hand[i]];
    if (cd?.cardType === 'Potion') out.push(i);
  }
  return out;
}

/**
 * Hero active check — Saint Nicolas only enforces its rules while it
 * can actually act. Frozen / Stunned / Negated / dead Hero short-
 * circuits both the aura and the action tax.
 */
function _heroActive(engine, inst) {
  const hero = engine.gs?.players?.[inst.owner]?.heroes?.[inst.heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  const s = hero.statuses || {};
  if (s.frozen || s.stunned || s.negated) return false;
  return true;
}

/**
 * Resolve the cardInstance for the currently escrowed Potion. Robust
 * to hand reshuffling between pay and commit: looks up by `instId`
 * first, then falls back to the stored cardName + handIdx.
 */
function _findEscrowedInst(engine, ps) {
  const esc = ps?._stNicolasEscrow;
  if (!esc) return null;
  if (esc.instId) {
    const byId = engine.cardInstances.find(c => c.id === esc.instId);
    if (byId && byId.zone === 'hand') return byId;
  }
  if (esc.cardName) {
    const byName = engine.cardInstances.find(c =>
      c.zone === 'hand' && c.owner === esc.ownerPi && c.name === esc.cardName,
    );
    if (byName) return byName;
  }
  return null;
}

function _clearEscrow(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return;
  const inst = _findEscrowedInst(engine, ps);
  if (inst?.counters) delete inst.counters._stNicolasEscrowed;
  delete ps._stNicolasEscrow;
}

module.exports = {
  activeIn: ['hero'],

  /**
   * Gate hand plays. Spell / Attack / Creature plays under Saint
   * Nicolas require ≥1 Potion in hand. Abilities are free-attach
   * (no Action consumed on the play itself). Artifacts / Potions /
   * Hero cards fall through.
   *
   * If Saint Nicolas is currently silenced (negated/frozen/stunned)
   * his rule doesn't project — the player acts normally without the
   * Potion requirement, same as if he weren't on the board.
   */
  canPlayCard(gs, pi, hi, cd, engine) {
    if (!cd) return true;
    const t = cd.cardType;
    if (t !== 'Spell' && t !== 'Attack' && t !== 'Creature') return true;
    const hero = gs.players[pi]?.heroes?.[hi];
    if (!hero) return true;
    const s = hero.statuses || {};
    if (s.frozen || s.stunned || s.negated) return true;
    const ps = gs.players[pi];
    if (!ps) return true;
    const db = engine._getCardDB();
    return _potionIndicesInHand(ps, db).length > 0;
  },

  /**
   * Generic Action gate (consulted by `engine.canHeroPerformAction`).
   * Refuses every action-slot-consuming play / activation when no
   * Potion is in hand — the player literally cannot pay the tax.
   * Silenced (negated/frozen/stunned) Saint Nicolas exempts the
   * rule, matching `canPlayCard` above.
   */
  canPerformAction(gs, pi, hi, engine) {
    const hero = gs.players[pi]?.heroes?.[hi];
    if (!hero) return true;
    const s = hero.statuses || {};
    if (s.frozen || s.stunned || s.negated) return true;
    const ps = gs.players[pi];
    if (!ps) return true;
    const db = engine._getCardDB();
    return _potionIndicesInHand(ps, db).length > 0;
  },

  /**
   * Phase a — pre-action cost prompt. Fires from doPlaySpell /
   * doPlayCreature / doActivateAbility BEFORE the action begins
   * resolving. Player picks a Potion to commit; the pick is escrowed
   * (marked in hand) but not yet transferred.
   *
   * Returns false on player cancel → engine refuses the action.
   * Returns true on commit → engine resolves the action, then calls
   * commitHeroActionCost (success) or refundHeroActionCost (failure).
   */
  async payHeroActionCost(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (!_heroActive(engine, ctx.card)) return true; // inactive — skip cost
    const ps = engine.gs.players[pi];
    if (!ps) return true;
    const cardDB = engine._getCardDB();
    const indices = _potionIndicesInHand(ps, cardDB);
    if (indices.length === 0) return false; // shouldn't reach here past canPerformAction

    // Stale escrow from a prior cancelled action — wipe it before
    // opening the picker. Defensive: the engine's finally-blocks
    // already handle this, but a crash in those finally blocks
    // could leak a marker forward.
    if (ps._stNicolasEscrow) _clearEscrow(engine, pi);

    let chosenIdx;
    if (indices.length === 1) {
      chosenIdx = indices[0];
    } else {
      const result = await engine.promptGeneric(pi, {
        type: 'pickHandCard',
        title: CARD_NAME,
        description: 'Choose a Potion to give to your opponent. Your Action will resolve once you confirm.',
        eligibleIndices: indices,
        // Stronger visual cue than the standard purple-dashed picker
        // outline — Saint Nicolas's pick is mandatory and ties the
        // action's success to it, so the eligible Potions glow and
        // pulse to draw the eye. Client reads the flag in app-board.
        highlightStyle: 'urgent',
        cancellable: true,
        cancelLabel: 'Cancel Action',
      });
      if (!result || result.cancelled || result.handIndex == null) return false;
      chosenIdx = result.handIndex;
    }

    // Stamp the escrow. Inst id makes the marker robust to hand
    // reshuffling between pay and commit (a sibling card discarding,
    // a draw filling the gap, etc.). Name + handIdx are fallbacks for
    // the rare case where the inst gets untracked mid-flight.
    const cardName = ps.hand[chosenIdx];
    const inst = engine.cardInstances.find(c =>
      c.zone === 'hand' && c.owner === pi && c.name === cardName,
    );
    if (!inst) return false;
    if (!inst.counters) inst.counters = {};
    inst.counters._stNicolasEscrowed = true;
    ps._stNicolasEscrow = {
      instId: inst.id,
      cardName,
      handIdx: chosenIdx,
      ownerPi: pi,
    };
    engine.sync();
    return true;
  },

  /**
   * Phase c-success — action resolved. Transfer the escrowed Potion
   * to opp's hand. The transfer's pile-flight animation runs while
   * the action's downstream hooks / animations are still finishing,
   * so the visual reads as "Potion changes hands as the action
   * resolves" (concurrent, not strictly atomic).
   */
  async commitHeroActionCost(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps?._stNicolasEscrow) return;

    const esc = ps._stNicolasEscrow;
    const inst = _findEscrowedInst(engine, ps);
    if (inst?.counters) delete inst.counters._stNicolasEscrowed;

    // Find the current hand index by name (may have shifted if a
    // sibling card resolved before this commit fires).
    let handIdx = ps.hand.indexOf(esc.cardName);
    // If multiple copies, prefer the inst's tracked position via the
    // rank-by-name walk the splice interceptor maintains. Fallback to
    // the first occurrence above.
    if (inst && handIdx >= 0) {
      let rank = 0, seen = 0;
      for (const c of engine.cardInstances) {
        if (c.zone !== 'hand') continue;
        if (c.owner !== pi) continue;
        if (c.name !== esc.cardName) continue;
        if (c.id === inst.id) { rank = seen; break; }
        seen++;
      }
      // Walk hand for the Nth occurrence
      let count = 0;
      for (let i = 0; i < ps.hand.length; i++) {
        if (ps.hand[i] === esc.cardName) {
          if (count === rank) { handIdx = i; break; }
          count++;
        }
      }
    }

    delete ps._stNicolasEscrow;
    if (handIdx < 0) {
      engine.sync();
      return;
    }
    await engine.actionTransferCardToOppHand(pi, handIdx, { source: CARD_NAME });
    engine.log('saint_nicolas_tax_paid', {
      player: ps.username, potion: esc.cardName,
    });
  },

  /**
   * Phase c-fail — action cancelled / negated. Clear the escrow so
   * the marked Potion stays in hand unaffected.
   */
  async refundHeroActionCost(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    _clearEscrow(engine, pi);
    engine.sync();
  },

  hooks: {
    /**
     * Board-wide Potion redirect. Whenever ANY player resolves a
     * Potion, route it to the user's opponent's hand instead of the
     * deleted pile. Sets `ctx.placed = true` to suppress the engine's
     * default delete. A ctx flag (`_stNicolasHandled`) dedupes across
     * multiple Saint Nicolases on the board.
     */
    afterPotionUsed: async (ctx) => {
      if (ctx.placed) return;
      if (ctx._stNicolasHandled) return;
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || !_heroActive(engine, inst)) return;

      const userPi = ctx.potionOwner;
      if (userPi == null || userPi < 0) return;
      const tgtPi = userPi === 0 ? 1 : 0;
      const tgtPs = engine.gs.players[tgtPi];
      if (!tgtPs) return;
      if (tgtPs.handLocked) return;

      const handIdx = tgtPs.hand.length;
      tgtPs.hand.push(ctx.potionName);
      try { engine._autoRevealOnEnterHand?.(tgtPi, handIdx, ctx.potionName); } catch {}
      try {
        const fresh = engine._trackCard?.(ctx.potionName, tgtPi, 'hand');
        if (fresh) fresh.originalOwner = userPi;
      } catch {}

      try {
        engine._broadcastEvent('play_pile_transfer', {
          fromOwner: userPi, toOwner: tgtPi,
          cardName: ctx.potionName,
          from: 'hand', to: 'hand',
          fromHandIdx: ctx.fromHandIndex,
          toHandIdx: handIdx,
        });
      } catch {}

      if (typeof ctx.setFlag === 'function') {
        ctx.setFlag('placed', true);
        ctx.setFlag('_stNicolasHandled', true);
      } else {
        ctx.placed = true;
        ctx._stNicolasHandled = true;
      }

      engine.log('saint_nicolas_potion_redirect', {
        potion: ctx.potionName,
        from: engine.gs.players[userPi]?.username,
        to: tgtPs.username,
      });
    },
  },
};
