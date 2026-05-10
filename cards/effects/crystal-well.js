// ═══════════════════════════════════════════
//  CARD EFFECT: "Crystal Well"
//  Spell (Area, Lv3, Magic Arts) — Crystals
//
//  This card's level in your hand is reduced by
//  the number of revealed cards in your hand.
//  Both players may once per turn add a card
//  from their hand that is originally owned by
//  them to their opponent's hand to draw a card.
//
//  Implementation:
//   • `reduceCardLevel` (engine-queried) returns
//     the count of revealed hand cards on the
//     OWNING side. Engine clamps `Math.max(0,
//     rawLevel - reduction)`, so a hand with 3+
//     revealed cards plays Crystal Well at Lv0.
//   • `areaEffect: true` + per-activator HOPT
//     (engine handles this naturally — the HOPT
//     key includes the activator's `pi`, so
//     each player gets their own once-per-turn
//     window on their respective turns).
//   • `onAreaEffect`: prompts the activator to
//     pick one of THEIR hand cards (filtered to
//     `inst.originalOwner === pi`), routes
//     through `actionTransferCardToOppHand`, and
//     draws 1.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Crystal Well';

/**
 * Count revealed hand cards on `ownerIdx`'s side. A card is "revealed"
 * if either:
 *   • Its slot is in `_permanentlyRevealedHandIndices` (Bamboo Shield,
 *     auto-reveal Crystals, etc.).
 *   • Its slot is in `_revealedHandIndices` (Luna Kiai's per-turn
 *     reveal).
 *   • Its tracked instance carries `_permanentlyRevealed` /
 *     `_revealedThisTurn` directly (handles cards revealed via
 *     instance counters before the splice interceptor maps them).
 *
 * The two index maps are guaranteed-in-sync with the hand array via
 * the engine's splice interceptor, so we just merge their key sets
 * and count uniques per slot.
 */
function countRevealedHandCards(engine, ownerIdx) {
  const ps = engine.gs.players[ownerIdx];
  if (!ps) return 0;
  const handLen = (ps.hand || []).length;
  if (handLen === 0) return 0;
  const revealed = new Set();
  const perm = ps._permanentlyRevealedHandIndices || {};
  const tmp  = ps._revealedHandIndices || {};
  for (const k of Object.keys(perm)) {
    const idx = +k;
    if (idx >= 0 && idx < handLen) revealed.add(idx);
  }
  for (const k of Object.keys(tmp)) {
    const idx = +k;
    if (idx >= 0 && idx < handLen) revealed.add(idx);
  }
  // Per-instance flags as a fallback for instances revealed before the
  // index map was populated.
  let trackingRank = {};
  for (const inst of (engine.cardInstances || [])) {
    if (inst.owner !== ownerIdx) continue;
    if (inst.zone !== 'hand') continue;
    const rank = trackingRank[inst.name] || 0;
    trackingRank[inst.name] = rank + 1;
    if (inst.counters?._permanentlyRevealed || inst.counters?._revealedThisTurn) {
      // Find the matching hand slot — Kth instance of name X ↔ Kth
      // hand position of name X.
      let seen = 0;
      for (let i = 0; i < handLen; i++) {
        if (ps.hand[i] !== inst.name) continue;
        if (seen === rank) {
          revealed.add(i);
          break;
        }
        seen++;
      }
    }
  }
  return revealed.size;
}

module.exports = {
  // Spell-Area cards live in the area zone; the engine's hand-active
  // listeners scan `activeIn` for 'hand' to read `reduceCardLevel`.
  // Listing both 'hand' and 'area' makes the level-reduction hook
  // fire from hand AND the per-turn area effect work after placement.
  activeIn: ['hand', 'area'],

  /**
   * In-hand level reduction: -1 per revealed card in the controller's
   * hand. Only reduces THIS Crystal Well's level (filter by name) so
   * other cards in the same hand aren't accidentally rebated.
   */
  reduceCardLevel(cardData, engine, ownerIdx) {
    if (cardData?.name !== CARD_NAME) return 0;
    return countRevealedHandCards(engine, ownerIdx);
  },

  hooks: {
    /**
     * Self-cast onPlay path — place the card into the controller's
     * Area Zone instead of letting it fall through to discard.
     * Mirrors the Graveyard of Limited Power pattern: gate on
     * `cardZone === 'hand'` + `playedCard.id === card.id` so the
     * hook only fires for the original cast (not for downstream
     * onPlay listener fan-out).
     */
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },
  },

  // ── Area effect — both players may use once per turn on their own turn
  areaEffect: true,

  /**
   * Activatable iff the activator has a card in hand they originally
   * owned, AND the opponent's hand isn't locked (transfer would
   * fizzle). Standard HOPT-per-activator gate is handled by the
   * engine; we just pre-check the legal targets.
   */
  canActivateAreaEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx._activator ?? ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    const oi = pi === 0 ? 1 : 0;
    const ops = engine.gs.players[oi];
    if (!ops || ops.handLocked) return false;
    if (ps.handLocked) return false;
    return _hasOriginallyOwnedHandCard(engine, pi);
  },

  async onAreaEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx._activator ?? ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    const eligibleIndices = [];
    for (let i = 0; i < (ps.hand || []).length; i++) {
      if (_isOriginallyOwnedHandSlot(engine, pi, i)) eligibleIndices.push(i);
    }
    if (eligibleIndices.length === 0) return false;

    const result = await engine.promptGeneric(pi, {
      type: 'pickHandCard',
      title: CARD_NAME,
      description: 'Choose one of your originally-owned cards to give to your opponent. You then draw 1 card.',
      eligibleIndices,
      cancellable: true,
    });
    if (!result || result.cancelled || result.handIndex == null) return false;

    const ok = await engine.actionTransferCardToOppHand(pi, result.handIndex, {
      source: CARD_NAME,
    });
    if (!ok) return false;

    await engine.actionDrawCards(pi, 1);
    engine.log('crystal_well_use', {
      player: ps.username, transferred: result.cardName,
    });
    engine.sync();
    return true;
  },
};

// ─── helpers ─────────────────────────────────────

function _hasOriginallyOwnedHandCard(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  for (let i = 0; i < (ps.hand || []).length; i++) {
    if (_isOriginallyOwnedHandSlot(engine, pi, i)) return true;
  }
  return false;
}

/**
 * "Originally owned by them" — walks tracked instances at the given
 * hand slot and checks `inst.originalOwner === pi`. If no inst is
 * found (foreign card slipped in via a race), defaults to TRUE so
 * the player isn't silently locked out of their own hand. Most cards
 * have a canonical inst.
 */
function _isOriginallyOwnedHandSlot(engine, pi, handIdx) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  const cardName = ps.hand?.[handIdx];
  if (!cardName) return false;
  // Walk instances and pick the Nth match by name (FIFO mapping the
  // splice interceptor maintains).
  let rank = 0;
  for (let i = 0; i < handIdx; i++) {
    if (ps.hand[i] === cardName) rank++;
  }
  let seen = 0;
  for (const inst of (engine.cardInstances || [])) {
    if (inst.owner !== pi) continue;
    if (inst.zone !== 'hand') continue;
    if (inst.name !== cardName) continue;
    if (seen === rank) {
      const orig = inst.originalOwner ?? pi;
      return orig === pi;
    }
    seen++;
  }
  return true; // No matching inst found — default to allowing the pick.
}
