// ═══════════════════════════════════════════
//  CARD EFFECT: "Tengu Windstorm"
//  Spell (Decay Magic Lv0, Normal). BANNED.
//  Archetype: Rebelliokai
//
//  Effect:
//    Delete 1 "Rebelliokai Terror Tengu" from
//    your discard pile to play this card. Choose
//    any card on the board that is not a Hero and
//    place it on top or bottom its controller's
//    deck. If this is the first Action you perform
//    this turn, this counts as an additional
//    Action.
//
//  House clarifications (per user spec):
//    • Cost (delete Terror Tengu) is paid AFTER
//      the player picks the bounce target, BEFORE
//      the bounce itself resolves. The chain-
//      reaction window is the player's last
//      cancellation point — once a target is
//      locked in, the cost is mandatory. If the
//      Spell is negated mid-chain or there are no
//      legal targets, no cost is paid.
//
//  Wiring:
//    • `spellPlayCondition` gates on a Terror Tengu
//      sitting in the controller's discard pile.
//    • Cost lives inside `onPlay` (no
//      `payActivationCost`); paid via
//      `payRebelliokaiCost` AFTER the target is
//      confirmed and BEFORE the top/bottom prompt
//      and bounce. The placement prompt is not
//      cancellable — by then the player is fully
//      committed.
//    • Board target collection mirrors The Yeeting's
//      `_collectBoardTargets` — picks every non-Hero
//      inst across both players' support / ability /
//      surprise / permanent / area zones, skips
//      immovable ones, and de-dupes ability stacks
//      to the topmost card. This is the canonical
//      "any card on the board that is not a Hero"
//      target set.
//    • `optionPicker` for the top-vs-bottom choice.
//      Top = `mainDeck.unshift(name)` (next card
//      drawn), bottom = `mainDeck.push(name)`. We
//      do NOT shuffle — the rule explicitly says
//      "top or bottom", which only matters if deck
//      order is preserved.
//    • Bounce-to-deck never fires onCreatureDeath
//      (we route through `actionMoveCard`-style
//      manual splice, not `actionDestroyCard`).
//      `onCardLeaveZone` still fires so listeners
//      that track "left support" / "left area"
//      (Big Gwen, Tempeste, etc.) update their
//      state — bouncing IS leaving the zone, just
//      not dying.
//    • Action-refund rider: scans `engine.actionLog`
//      for any prior `spell_played` /
//      `creature_summoned` / `card_played` /
//      `immediate_action` entry from this player on
//      the current turn (mirrors Fire Bolts'
//      first-DM-spell scan, broadened to all action
//      types). If none found, this Tengu Windstorm
//      cast IS the first action of the turn — the
//      refund (`gs._spellFreeAction = true`) makes
//      it count as an additional Action. The
//      `actionLog` scan correctly catches additional
//      / inherent / free-action plays from earlier
//      phases, which the `_actionsPlayedThisPhase`
//      counter doesn't.
//    • `inherentAction(gs, pi, heroIdx, engine)` —
//      the Main-Phase self-provider. When no Action
//      (including additionals / inherents / free
//      plays) has resolved this turn AND the current
//      phase is Main 1 / Main 2, the engine treats
//      the cast as an inherent additional Action (no
//      Action-slot consumed, no provider needed).
//      Action-Phase plays go through the normal
//      Action-slot path; the same refund above
//      handles "first Action of the turn" semantics
//      symmetrically for that phase.
// ═══════════════════════════════════════════

const { payRebelliokaiCost } = require('./_rebelliokai-shared');

const CARD_NAME = 'Tengu Windstorm';
const COST_NAME = 'Rebelliokai Terror Tengu';

/**
 * Collect every non-Hero board card across both players. Mirrors
 * `the-yeeting.js`'s `_collectBoardTargets` so the target list is
 * consistent with other "any card on the board" effects (Yeeting,
 * Cosmic Malfunction, etc.). Skips immovable cards and dedupes
 * ability stacks to their top entry.
 */
function _collectBoardTargets(gs, engine) {
  const targets = [];
  const seen = new Set();
  for (const inst of engine.cardInstances) {
    if (inst.zone === 'hand' || inst.zone === 'discard'
        || inst.zone === 'deleted' || inst.zone === 'hero'
        || inst.zone === 'deck') continue;
    if (inst.counters?.immovable) continue;
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);

    if (inst.zone === 'support') {
      targets.push({
        id:       `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type:     'equip',
        owner:    inst.owner,
        heroIdx:  inst.heroIdx,
        slotIdx:  inst.zoneSlot,
        cardName: inst.name,
        _cardInstance: inst,
      });
    } else if (inst.zone === 'ability') {
      // Only target the top card of each ability stack — same rule as
      // The Yeeting (deeper-stack abilities can't be picked because
      // their slot's visible card is the top one).
      const slot = gs.players[inst.owner]?.abilityZones?.[inst.heroIdx]?.[inst.zoneSlot] || [];
      if (slot.length > 0 && slot[slot.length - 1] !== inst.name) continue;
      targets.push({
        id:       `ability-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type:     'ability',
        owner:    inst.owner,
        heroIdx:  inst.heroIdx,
        slotIdx:  inst.zoneSlot,
        cardName: inst.name,
        _cardInstance: inst,
      });
    } else if (inst.zone === 'permanent') {
      targets.push({
        id:       `perm-${inst.owner}-${inst.counters?.permId || inst.id}`,
        type:     'perm',
        owner:    inst.owner,
        heroIdx:  -1,
        cardName: inst.name,
        _cardInstance: inst,
      });
    } else if (inst.zone === 'area') {
      const areaArr = gs.areaZones?.[inst.owner] || [];
      if (areaArr.length > 0 && areaArr[areaArr.length - 1] !== inst.name) continue;
      targets.push({
        id:       `area-${inst.owner}`,
        type:     'area',
        owner:    inst.owner,
        heroIdx:  -1,
        cardName: inst.name,
        _cardInstance: inst,
      });
    } else if (inst.zone === 'surprise') {
      targets.push({
        id:       `equip-${inst.owner}-${inst.heroIdx}-surprise`,
        type:     'equip',
        owner:    inst.owner,
        heroIdx:  inst.heroIdx,
        cardName: inst.name,
        _cardInstance: inst,
      });
    }
  }
  return targets;
}

/**
 * Move a non-Hero board card to the controller's deck (top or bottom).
 * Does NOT fire onCreatureDeath — bouncing is not death. Fires
 * onCardLeaveZone so per-card "I left the support zone" listeners
 * (Big Gwen and similar) still reset their state.
 *
 * Why not route through `actionMoveCard`? Because that helper has no
 * `to: deck` branch — it would either drop the card or treat it as a
 * move-to-discard. Manual splice + push is simpler and preserves the
 * deck top/bottom semantics the rule depends on.
 */
async function _bounceToDeck(engine, inst, position /* 'top' | 'bottom' */, sourceName) {
  const gs = engine.gs;
  // ORIGINAL owner — not the current controller. A charmed/stolen
  // card must return to the player who originally owned it (Charme
  // Lv3 / Deepsea Succubus / similar control-flip effects mutate
  // `inst.owner` to the new controller, but `inst.originalOwner`
  // never changes). The death pipeline already routes returning
  // cards back to `originalOwner`'s pile via the same convention.
  const owner = inst.originalOwner != null ? inst.originalOwner : inst.owner;
  const ownerPs = gs.players[owner];
  if (!ownerPs) return false;
  const fromZone = inst.zone;
  const fromHeroIdx = inst.heroIdx;
  const fromZoneSlot = inst.zoneSlot;

  // Visual flight from the source zone to the deck. Uses the standard
  // play_pile_transfer envelope (now with `to: 'deck'` mapping to the
  // owner's deck rect — see app-board.jsx `elementFor` switch).
  // `flightStyle: 'windstorm'` swaps in the chaotic keyframe: 1200 ms
  // of multi-waypoint zigzag with swinging rotation, finishing with
  // multiple full spins as the card is swept into the deck. Cyan/white
  // glow replaces the standard violet to read as wind sheen.
  //
  // The locator extras (`fromHeroIdx` / `fromSlotIdx` / `fromPermId`)
  // depend on the source zone — `elementFor`'s ability/surprise/perm
  // branches each need a different combination, so we collect them
  // here based on `fromZone`. Without these, `elementFor` returns null
  // for ability / surprise / permanent sources and the whole anim
  // bails at the `if (!srcEl || !tgtEl) return;` guard.
  // Flight needs to differentiate visual source (where the card
  // physically sits — the CURRENT controller's zone) from the
  // destination (the ORIGINAL owner's deck). For non-charmed cards
  // these are the same; for a charmed/stolen card they differ —
  // without the split, the deck flight would try to land on the
  // wrong side.
  const flightPayload = {
    fromOwner:   inst.owner,
    toOwner:     owner,
    cardName:    inst.name,
    from:        fromZone,
    to:          'deck',
    flightStyle: 'windstorm',
  };
  if (fromZone === 'support' || fromZone === 'ability') {
    flightPayload.fromHeroIdx = fromHeroIdx;
    flightPayload.fromSlotIdx = fromZoneSlot;
  } else if (fromZone === 'surprise') {
    flightPayload.fromHeroIdx = fromHeroIdx;
  } else if (fromZone === 'permanent') {
    flightPayload.fromPermId = inst.counters?.permId || inst.id;
  }
  // Areas use the area-zone selector keyed only on owner — no extras
  // needed (matches the area branch in elementFor).
  engine._broadcastEvent('play_pile_transfer', flightPayload);

  // Suppress the support-zone HP-diff floater (the client interprets
  // "creature disappeared from slot" as lethal damage by default — same
  // signal `actionMoveCard` fires for non-death support→hand bounces).
  if (fromZone === 'support') {
    // Suppress on the CURRENT-controller side — that's where the
    // creature physically sits (the source zone of the flight),
    // independent of which deck it routes back to.
    engine._broadcastEvent('creature_zone_move', {
      owner: inst.owner, heroIdx: fromHeroIdx, zoneSlot: fromZoneSlot,
    });
  }

  await engine.runHooks('onCardLeaveZone', {
    card: inst, leavingCard: inst,
    fromZone, fromHeroIdx,
    fromZoneSlot: fromZoneSlot ?? -1,
    // `fromOwner` is the side the card LEAVES — that's where it
    // physically sits, i.e. the current controller. Listeners that
    // gate on "did MY zone lose a card?" key off this side.
    fromOwner: inst.owner,
    toOwner: owner,
    toZone: 'deck',
    _skipReactionCheck: true,
  });

  // Remove from origin zone. Mirrors `actionMoveCard`'s state step but
  // routes the destination to the deck rather than discard / hand.
  engine._removeCardFromState(inst);
  engine._untrackCard(inst.id);

  if (!ownerPs.mainDeck) ownerPs.mainDeck = [];
  if (position === 'top') {
    ownerPs.mainDeck.unshift(inst.name);
  } else {
    ownerPs.mainDeck.push(inst.name);
  }

  engine.log('tengu_windstorm_bounce', {
    player:   ownerPs.username,
    card:     inst.name,
    from:     fromZone,
    position,
    by:       sourceName,
  });
  // Hold long enough for the windstorm animation (1200 ms client-side)
  // to finish before the next phase advances. The sync below ticks the
  // deck count up; clamping the wait roughly to anim length keeps the
  // visual order coherent (card mid-flight → deck count increments → done).
  await engine._delay(1200);
  engine.sync();
  return true;
}

/**
 * True when this player has not had any Action play resolved yet this
 * turn — including additional / inherent / free-action plays. Scans
 * the engine's actionLog for entries whose type is one of the always-
 * an-Action play categories (`spell_played` / `creature_summoned` /
 * `card_played` / `immediate_action`) PLUS effect-activation entries
 * (`ability_activated` / `creature_effect_activated` /
 * `hero_effect_activated`) that were tagged with `actionCost: true`
 * by the server. The discriminator matters because the same log type
 * is shared by free and action-cost paths (e.g. Inventing logs
 * `ability_activated` as a free activation; Adventurousness logs the
 * same type but with `actionCost: true`). Without it, Inventing /
 * Cooldin / Magenta etc. would falsely mark "an Action was used"
 * even though no Action slot was spent. Conversely, missing
 * action-cost log types here is what let Champion's effect not count
 * as an Action — fixed by including them with the discriminator.
 *
 * Must be called BEFORE any promptGeneric fires — the pending-play-
 * log for THIS Tengu Windstorm cast hasn't been written yet at top-
 * of-onPlay, so the scan correctly excludes the current play.
 */
function isFirstActionThisTurn(engine, playerIdx) {
  // Always-an-Action types — playing a card from hand of these
  // categories ALWAYS consumes the Action resource (or an additional-
  // action provider, which is still "performing an Action").
  const ALWAYS_ACTION_TYPES = new Set([
    'spell_played', 'creature_summoned', 'card_played', 'immediate_action',
  ]);
  // Effect-activation types where the same log key is shared between
  // free and action-cost paths — only the `actionCost: true` variant
  // counts as a slot-consuming Action.
  const ACTION_COST_GATED_TYPES = new Set([
    'ability_activated',
    'creature_effect_activated',
    'hero_effect_activated',
  ]);
  const currentTurn = engine.gs.turn;
  const playerName = engine.gs.players[playerIdx]?.username;
  for (const entry of engine.actionLog) {
    if (entry.turn !== currentTurn) continue;
    if (entry.player !== playerName) continue;
    if (ALWAYS_ACTION_TYPES.has(entry.type)) return false;
    if (ACTION_COST_GATED_TYPES.has(entry.type) && entry.actionCost === true) return false;
  }
  return true;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  /**
   * Dynamic `inherentAction` — Main Phase plays self-provide as an
   * additional Action when no Action (incl. additionals / inherents /
   * free) has been performed this turn yet. Mirrors Fire Bolts' DM3
   * self-provider pattern: the engine queries `inherentAction` during
   * play-eligibility checks, so returning true in Main Phase lets
   * the card be cast outside the Action Phase without a separate
   * additional-action provider.
   *
   * Action-Phase plays return false here — they take the normal
   * Action-slot path, with the `_spellFreeAction` rider in onPlay
   * refunding the slot when this is the player's first action.
   */
  inherentAction(gs, playerIdx, heroIdx, engine) {
    const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
    if (!isMainPhase) return false;
    if (engine) return isFirstActionThisTurn(engine, playerIdx);
    // Fallback: assume eligible when engine isn't supplied (rare —
    // the play-eligibility path always passes the engine through).
    return true;
  },

  spellPlayCondition(gs, pi /*, engine */) {
    const ps = gs.players[pi];
    return (ps?.discardPile || []).indexOf(COST_NAME) >= 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

      // Snap "first Action this turn" BEFORE any prompt fires (otherwise
      // the pending-play-log for this Spell flushes on the first prompt
      // and the actionLog scan would see Tengu Windstorm itself).
      // Uses the broader cross-turn scan instead of
      // `_actionsPlayedThisPhase` so that prior Main-Phase additional
      // / inherent plays correctly disqualify the refund.
      const isFirstAction = isFirstActionThisTurn(engine, pi);

      // ── Step 1: pick the bounce target (commitment point) ──
      // Cancellable here — if the player backs out before confirming,
      // the cost has not yet been paid and Terror Tengu stays in
      // discard.
      const boardTargets = _collectBoardTargets(gs, engine);
      if (boardTargets.length === 0) {
        // Nothing to bounce. The Spell has not committed yet (no target
        // selected, so the cost path was never reached) — refund the
        // Action via _spellCancelled so the cost ALSO stays unpaid.
        gs._spellCancelled = true;
        engine.log('tengu_windstorm_fizzle', {
          player: ps.username, reason: 'no_targets',
        });
        return;
      }

      const cardPick = await engine.promptEffectTarget(pi, boardTargets, {
        title:        CARD_NAME,
        description:  'Choose any card on the board that is not a Hero.',
        confirmLabel: '🌪️ Banish to deck!',
        confirmClass: 'btn-info',
        cancellable:  true,
        exclusiveTypes: true,
        maxPerType:   { hero: 1, equip: 1, ability: 1, perm: 1, area: 1, surprise: 1 },
      });

      if (!cardPick || cardPick.length === 0) {
        // Cancelled BEFORE cost is paid — refund the Action and leave
        // Terror Tengu in the discard pile.
        gs._spellCancelled = true;
        return;
      }

      const sel = boardTargets.find(t => t.id === cardPick[0]);
      const targetInst = sel?._cardInstance;
      if (!targetInst) {
        gs._spellCancelled = true;
        return;
      }

      // Re-validate the inst is still on-board (a parallel reaction
      // could have cleared it during the prompt — defensive bail).
      if (targetInst.zone === 'hand' || targetInst.zone === 'discard'
          || targetInst.zone === 'deleted' || targetInst.zone === 'hero'
          || targetInst.zone === 'deck') {
        gs._spellCancelled = true;
        return;
      }
      if (targetInst.counters?.immovable) {
        // Immovable target — refund (no cost paid yet).
        gs._spellCancelled = true;
        engine.log('tengu_windstorm_blocked', {
          card: targetInst.name, reason: 'immovable',
        });
        return;
      }

      // ── Step 2: pay the cost (commits the player) ──
      // Now that a valid target is locked in, delete Terror Tengu from
      // discard. Defensive re-check guards against a parallel reaction
      // having moved Tengu during the target prompt.
      if ((ps.discardPile || []).indexOf(COST_NAME) < 0) {
        gs._spellCancelled = true;
        return;
      }
      await payRebelliokaiCost(engine, pi, COST_NAME, { source: CARD_NAME });

      // ── Step 3: top or bottom of original owner's deck ──
      // `inst.originalOwner` survives charm/steal flips; `inst.owner`
      // gets reflowed to the current controller. The card goes back
      // to whoever originally owned it.
      const tgtOwner = targetInst.originalOwner != null ? targetInst.originalOwner : targetInst.owner;
      const tgtName  = targetInst.name;
      const ownerLabel = tgtOwner === pi ? 'your' : "the opponent's";
      const placement = await engine.promptGeneric(pi, {
        type:        'optionPicker',
        title:       CARD_NAME,
        description: `Place ${tgtName} on top or bottom of ${ownerLabel} deck?`,
        options: [
          { id: 'top',    label: '⬆️ Top of deck',    description: 'Will be the next card drawn.' },
          { id: 'bottom', label: '⬇️ Bottom of deck', description: 'Goes to the very bottom.' },
        ],
        cancellable: false,
      });
      const position = (placement?.optionId === 'bottom') ? 'bottom' : 'top';

      // ── Step 4: bounce ──
      await _bounceToDeck(engine, targetInst, position, CARD_NAME);

      engine.log('tengu_windstorm', {
        player:    ps.username,
        target:    tgtName,
        owner:     gs.players[tgtOwner]?.username || tgtOwner,
        position,
        firstAction: isFirstAction,
      });

      // ── Step 5: action-refund rider ──
      if (isFirstAction) {
        gs._spellFreeAction = true;
      }
      engine.sync();
    },
  },
};
