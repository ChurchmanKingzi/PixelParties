// ═══════════════════════════════════════════
//  CARD EFFECT: "Staff of Uncontrollable Destruction"
//  Artifact (Normal, Cost 0)
//
//  Discard your entire hand and draw the same
//  number of cards +1. You cannot draw cards or
//  move any cards out of your discard pile for
//  the rest of the turn.
//
//  Sequencing matters:
//    1. Discard the rest of the hand (each card
//       routes through actionDiscardHandCard so
//       onDiscard listeners — Rebelliokai's
//       Tanuki self-recur, Kind Kitsune draw,
//       etc. — fire correctly).
//    2. Draw count + 1 BEFORE locking the hand,
//       otherwise actionDrawCards' handLocked
//       short-circuit ate our own draw.
//    3. Set `handLocked` (engine helper short-
//       circuits future draws) and
//       `_discardLockedTurn = gs.turn` (engine
//       helpers actionRecycleCards /
//       addCardFromDiscardToHand /
//       actionPlaceCreature{source: 'discard'}
//       check this and bail).
//
//  The staff card itself stays in hand during
//  resolve — the server's post-resolve splice
//  (server.js doUseArtifactEffect) routes it to
//  discard cleanly. Discarding it inside resolve
//  too would double-discard.
// ═══════════════════════════════════════════

const CARD_NAME = 'Staff of Uncontrollable Destruction';

module.exports = {
  isPotion: false,
  // Hand-lock greys-out: with no +1 draw landing, the player has paid
  // their entire hand for nothing. Tagging opts into the standard 🚫
  // overlay (see Staff of the Teleporter for the full rationale).
  blockedByHandLock: true,

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    if (ps.handLocked) return false; // Lock prevents the +1 draw — fizzles silently.
    return true;
  },

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    // Find the resolving copy of the staff so we don't include it in the
    // "rest of hand" we discard. _resolvingCard.nth is the 1-based index
    // of which copy is currently mid-resolution (mirrors the same
    // accounting server.js's getResolvingHandIndex performs).
    const resolvingNth = ps._resolvingCard?.nth || 1;
    let nameCount = 0, staffIdx = -1;
    for (let i = 0; i < ps.hand.length; i++) {
      if (ps.hand[i] === CARD_NAME) {
        nameCount++;
        if (nameCount === resolvingNth) { staffIdx = i; break; }
      }
    }

    // Snapshot the names to discard. We capture the names list BEFORE
    // dispatching any actionDiscardHandCard call — onDiscard listeners
    // can mutate the hand (re-routing, draw replacements, etc.) so
    // iterating live indices would skip / double-discard cards.
    const toDiscardNames = [];
    for (let i = 0; i < ps.hand.length; i++) {
      if (i === staffIdx) continue;
      toDiscardNames.push(ps.hand[i]);
    }
    const count = toDiscardNames.length;

    for (const cardName of toDiscardNames) {
      await engine.actionDiscardHandCard(pi, cardName, -1, { source: CARD_NAME });
    }

    const drawCount = count + 1;
    if (drawCount > 0) {
      await engine.actionDrawCards(pi, drawCount, { source: CARD_NAME });
    }

    // Apply the rest-of-turn locks. Order: AFTER the draw so this
    // staff's own +1 lands; BEFORE engine.sync() so the next render
    // reflects the lock state.
    ps.handLocked = true;
    ps._discardLockedTurn = gs.turn;

    engine.log('staff_of_uncontrollable_destruction', {
      player: ps.username, discarded: count, drawn: drawCount,
    });
    engine.sync();
    return true;
  },
};
