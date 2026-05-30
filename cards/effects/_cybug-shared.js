// ═══════════════════════════════════════════
//  SHARED HELPER: Cybug archetype
//
//  The "Cybug" Surprises (Cybug CENTIPEDE, Cybug BEE, …) all share
//  the same two operations:
//    1. PAY: delete 1 named "fuel" card (Wheels / Magnetic Glove)
//       from the controller's hand OR deck (preferring hand, then
//       deck, with a small shuffle after a deck-delete).
//    2. RECOVER on death: pull a single copy of that same fuel card
//       from the controller's discard pile back into their hand.
//
//  Both ops emit zone-anchored `play_pile_transfer` flights so the
//  client's diff animator picks the correct rect (the project's
//  "Removing a chosen board card to a pile" rule, extended to
//  hand→deleted and discard→hand pile flights).
//
//  Centralizing here means a future Cybug Surprise just imports
//  `deleteCybugFuel` + `recoverCybugFuel` rather than re-duplicating
//  the hand/deck preference order or the animation broadcast.
// ═══════════════════════════════════════════

const { ZONES } = require('./_hooks');

/**
 * Delete 1 copy of `fuelCardName` from `pi`'s hand or deck (hand
 * preferred). Used as the activation cost for Cybug Surprises.
 *
 * Returns true when a copy was found + deleted, false when the
 * controller had no copy in either zone (caller should refuse the
 * activation — the `surpriseBefore*Trigger` already checks for
 * availability, so this only fires defensively in race conditions).
 *
 * Animations:
 *   • hand → deleted: zone-anchored flight with `fromHandIdx`.
 *   • deck → deleted: generic pile flight (deck rect is owner-
 *     scoped, no slot disambiguation needed). Deck is shuffled
 *     after the splice — the opp shouldn't be able to infer the
 *     post-search ordering.
 */
async function deleteCybugFuel(engine, pi, fuelCardName) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;

  // Try hand first.
  const handIdx = (ps.hand || []).indexOf(fuelCardName);
  if (handIdx >= 0) {
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: fuelCardName,
      from: 'hand', to: 'deleted',
      fromHandIdx: handIdx,
    });
    ps.hand.splice(handIdx, 1);
    // Untrack the hand inst so its tracked id doesn't leak into a
    // future state read. Find any matching hand inst for `pi` —
    // engine guarantees one inst per hand slot, so the first match
    // is the just-spliced one (the engine's splice interceptor
    // syncs inst order with hand-array order).
    const inst = engine.cardInstances.find(c =>
      c.owner === pi && c.zone === ZONES.HAND && c.name === fuelCardName
    );
    if (inst) engine._untrackCard(inst.id);
    if (!ps.deletedPile) ps.deletedPile = [];
    ps.deletedPile.push(fuelCardName);
    engine.log('cybug_fuel_delete', {
      player: ps.username, card: fuelCardName, from: 'hand',
    });
    engine.sync();
    await engine._delay(300);
    return true;
  }

  // Fall back to deck.
  const deckIdx = (ps.mainDeck || []).indexOf(fuelCardName);
  if (deckIdx >= 0) {
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: fuelCardName,
      from: 'deck', to: 'deleted',
    });
    ps.mainDeck.splice(deckIdx, 1);
    if (!ps.deletedPile) ps.deletedPile = [];
    ps.deletedPile.push(fuelCardName);
    engine.log('cybug_fuel_delete', {
      player: ps.username, card: fuelCardName, from: 'deck',
    });
    engine.shuffleDeck(pi, 'main');
    engine.sync();
    await engine._delay(300);
    return true;
  }

  return false;
}

/**
 * Pull 1 copy of `fuelCardName` from `pi`'s discard pile into their
 * hand. Used by Cybug Surprises' on-death recovery clause.
 *
 * Silent no-op when the discard pile has no matching copy (the
 * fuel card was deleted earlier in the chain, or never made it
 * to discard) — no false-positive logs or broken animations.
 *
 * Honours hand-lock: if the controller can't be tutored, returns
 * false so callers can decide whether to log it. The Cybug
 * Surprises don't currently observe the failure (the recovery is
 * a "best effort" rider — losing it to a hand lock is the price
 * of being locked).
 */
async function recoverCybugFuel(engine, pi, fuelCardName, sourceName) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  if (ps.handLocked) return false;
  const idx = (ps.discardPile || []).indexOf(fuelCardName);
  if (idx < 0) return false;

  // BOTH `toHandIdx` AND `finalHandSize` are required for the
  // client's hand-landing projection. The renderer falls back to the
  // hand container's centre when `toHandIdx` is missing — the card
  // would visually land at the middle of the row instead of at its
  // actual new slot. Card pushes to the end of hand, so the landing
  // index is `ps.hand.length` BEFORE the push.
  const toHandIdx = (ps.hand?.length || 0);
  engine._broadcastEvent('play_pile_transfer', {
    owner: pi, cardName: fuelCardName,
    from: 'discard', to: 'hand',
    toHandIdx,
    finalHandSize: toHandIdx + 1,
  });
  ps.discardPile.splice(idx, 1);
  if (!ps.hand) ps.hand = [];
  ps.hand.push(fuelCardName);
  engine._trackCard(fuelCardName, pi, ZONES.HAND);
  engine.log('cybug_recover', {
    player: ps.username, card: fuelCardName, by: sourceName,
  });
  engine.sync();
  return true;
}

/**
 * Does player `pi` have at least one copy of `fuelCardName` in hand
 * or deck? Used by the `surpriseBefore*Trigger` gates so a Cybug
 * Surprise with no payable cost doesn't even prompt.
 */
function hasCybugFuel(gs, pi, fuelCardName) {
  const ps = gs.players[pi];
  if (!ps) return false;
  if ((ps.hand || []).includes(fuelCardName)) return true;
  if ((ps.mainDeck || []).includes(fuelCardName)) return true;
  return false;
}

module.exports = {
  deleteCybugFuel,
  recoverCybugFuel,
  hasCybugFuel,
};
