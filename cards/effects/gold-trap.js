// ═══════════════════════════════════════════
//  CARD EFFECT: "Gold Trap"
//  Spell (Decay Magic Lv1, Surprise)
//
//  Activate this Surprise when your opponent would gain Gold
//  through an effect. You gain that Gold instead. Then, you may
//  choose any Creature on the board and add it to your hand.
//
//  Wiring:
//    • Engine integration via `surpriseResourceGainTrigger: true`.
//      `actionGainGold` opens a surprise window AFTER its own
//      `ON_RESOURCE_GAIN` hook chain — so Golden Vermin's "swap
//      gold for a draw" and Wealth / Treasure Huntress' boosts
//      have already settled. The amount redirected is the
//      post-hook amount, matching the card text "you gain that
//      Gold instead."
//    • Trigger gate: fires only when the gainer is the opponent
//      and the post-hook amount is > 0. The engine's surprise
//      scanner runs from the opp's side, so `triggerInfo.activatorIdx
//      !== ownerIdx` is the natural opp-only gate.
//    • Redirect contract: `onSurpriseActivate` returns
//      `{ redirected: true }`. `actionGainGold` checks that flag
//      and aborts the original gain, so the opp loses out and
//      the trapper's own `actionGainGold(pi, amount)` (called
//      from inside the activation) is the only gain that lands.
//      The recursive `actionGainGold` is safe — `_inSurpriseResolution`
//      is true during the activation, which short-circuits
//      `_checkSurpriseOnResourceGain` on the way back in.
//    • The trapper's own Golden Vermin (if any) WILL still see
//      the recursive gain through `ON_RESOURCE_GAIN`, so a
//      trapper holding Vermin can immediately swap the trapped
//      gold for a card draw. That's intentional and follows the
//      card text literally — "You gain that Gold" routes through
//      the standard gain pipeline, hooks included.
//
//    • Optional creature bounce: a follow-up `promptEffectTarget`
//      offers every Creature on the board (`engine.getCreatureTargets`
//      already iterates every Support Zone regardless of host-
//      Hero state, so the empty-Hero Quetzahuitl scenario works
//      here too). Immovable and face-down Creatures are filtered
//      out. Cancelling the prompt is allowed — the bounce is
//      explicitly "you may" in the rules text.
//    • Bounce mechanics: the chosen Creature's CardInstance is
//      untracked and its name is pushed into the TRAPPER's hand
//      (not the original owner's). Standard `actionMoveCard`
//      doesn't fit here — it routes hand bounces to the inst's
//      owner — so the move is done manually: fire onCardLeaveZone
//      (with `_onlyCard` so unrelated copies of Toughness etc.
//      don't misfire), splice from supportZones, untrack, then
//      `actionAddCardToHand(trapperIdx, name)` for the hand-add.
// ═══════════════════════════════════════════

const CARD_NAME = 'Gold Trap';

module.exports = {
  isSurprise: true,
  surpriseResourceGainTrigger: true,

  /**
   * Trigger gate. The engine scans Surprises on the OPPONENT's side
   * (the side opposite to whoever is gaining Gold), so `ownerIdx` is
   * the trapper and `triggerInfo.activatorIdx` is the gainer. Fire
   * only when the activator is the opp and at least 1 Gold is on
   * the table.
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, triggerInfo, engine) => {
    if (!triggerInfo) return false;
    if (triggerInfo.activatorIdx === ownerIdx) return false;
    return (triggerInfo.amount || 0) > 0;
  },

  /**
   * Resolve the trap: redirect the Gold gain to the trapper, then
   * optionally bounce one Creature to the trapper's hand. Return
   * `{ redirected: true }` so `actionGainGold` aborts the original
   * gain.
   */
  onSurpriseActivate: async (ctx, triggerInfo) => {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const amount = triggerInfo.amount;

    // ── 1. Redirect the Gold ──
    // Recursive `actionGainGold` is safe: `_inSurpriseResolution`
    // is true through the entire activation, so the inner call's
    // `_checkSurpriseOnResourceGain` bails immediately and no
    // infinite loop is possible.
    if (amount > 0) {
      await engine.actionGainGold(pi, amount);
    }

    // ── 2. Optional Creature bounce ──
    const targets = [];
    for (let p = 0; p < 2; p++) {
      for (const t of engine.getCreatureTargets(p)) {
        const inst = t.cardInstance;
        if (!inst) continue;
        if (inst.faceDown) continue;
        if (inst.counters?.immovable) continue;
        targets.push(t);
      }
    }

    if (targets.length > 0) {
      const picked = await engine.promptEffectTarget(pi, targets, {
        title: CARD_NAME,
        description: 'You may add 1 Creature on the board to your hand.',
        confirmLabel: '🪙 Take Creature!',
        confirmClass: 'btn-info',
        cancellable: true,
        exclusiveTypes: true,
        maxPerType: { equip: 1 },
      });
      if (picked && picked.length > 0) {
        const target = targets.find(t => t.id === picked[0]);
        if (target?.cardInstance) {
          const tCtrl = target.cardInstance.controller ?? target.cardInstance.owner;
          await engine._triggerGateCheck(tCtrl, CARD_NAME);
          if (engine._isGateShielded(tCtrl)) {
            engine.log('gold_trap_bounce_blocked', {
              card: target.cardInstance.name, reason: 'Defending the Gate',
            });
          } else {
            await _bounceCreatureToHand(engine, target.cardInstance, pi);
          }
        }
      }
    }

    engine.log('gold_trap_redirect', {
      player: engine.gs.players[pi]?.username,
      from: engine.gs.players[triggerInfo.activatorIdx]?.username,
      amount,
    });
    engine.sync();

    return { redirected: true };
  },
};

/**
 * Move a Creature instance from its support zone into a (possibly
 * different) player's hand. The standard `actionMoveCard` routes
 * support→hand transfers to the inst's OWNER hand, which is wrong for
 * Gold Trap — the rules text says the Creature goes to the TRAPPER's
 * hand regardless of who controlled it on the board. So we wire the
 * leave-zone hook, splice the zone array, untrack the inst, broadcast
 * the visual move, and then add the card name to the trapper's hand
 * via `actionAddCardToHand`.
 */
async function _bounceCreatureToHand(engine, inst, trapperIdx) {
  const fromOwner   = inst.owner;
  const fromHeroIdx = inst.heroIdx;
  const fromSlot    = inst.zoneSlot;
  const cardName    = inst.name;

  // Fire onCardLeaveZone BEFORE the splice — Toughness / Fighting
  // and similar ability-side bonuses revoke their grants in
  // onCardLeaveZone while the inst is still in its slot. `_onlyCard`
  // keeps unrelated sibling copies elsewhere on the board from
  // misfiring on this single removal.
  await engine.runHooks('onCardLeaveZone', {
    _onlyCard: inst,
    card: inst, leavingCard: inst,
    fromZone: 'support', fromOwner, fromHeroIdx,
    fromZoneSlot: fromSlot, toZone: 'hand',
    _skipReactionCheck: true,
  });

  // Visual flight — fire BEFORE the state mutation so the client's
  // pile-transfer handler can capture the source rect, hide the
  // source slot via `bounceOutgoingHidden`, and pre-suppress the
  // receiver's hand-count auto-animation (which would otherwise
  // overlay a spurious deck→hand draw flight on top of our move).
  // Cross-player flight: `fromOwner` is the creature's original
  // owner; `toOwner` is the trapper.
  //
  // `toHandIdx` is the trapper's current hand length — that's the
  // index the card will occupy once `actionAddCardToHand` pushes
  // it. The client's `elementFor('hand', …)` projects a synthetic
  // rect at the eventual slot position (see app-board.jsx ~19731)
  // so the flight lands ON the new slot rather than at the hand
  // container's anchor.
  const toHandIdx = (engine.gs.players[trapperIdx]?.hand?.length) ?? 0;
  engine._broadcastEvent('play_pile_transfer', {
    cardName,
    from:        'support',
    to:          'hand',
    fromOwner,
    toOwner:     trapperIdx,
    fromHeroIdx,
    fromSlotIdx: fromSlot,
    toHandIdx,
  });
  // Floater-suppression on the source slot — keeps the client's
  // damage-floater detector from misreading the disappearance as
  // a lethal hit. Independent of `play_pile_transfer`'s visibility
  // hiding; both signals are needed.
  engine._broadcastEvent('creature_zone_move', {
    owner: fromOwner, heroIdx: fromHeroIdx, zoneSlot: fromSlot,
  });

  // Splice from the support zone array
  const supSlot = engine.gs.players[fromOwner]?.supportZones?.[fromHeroIdx]?.[fromSlot];
  if (supSlot) {
    const idx = supSlot.indexOf(cardName);
    if (idx >= 0) supSlot.splice(idx, 1);
  }

  // Untrack the inst — board state is gone; if the trapper plays the
  // card back from hand it'll be tracked as a fresh instance.
  engine._untrackCard(inst.id);

  // Land in the trapper's hand (this calls engine.sync(), pushing the
  // new state to clients — the pile-transfer flight is already in
  // motion and lands as React commits the new hand entry).
  engine.actionAddCardToHand(trapperIdx, cardName, CARD_NAME);
}
