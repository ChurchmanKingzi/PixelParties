// ═══════════════════════════════════════════
//  CARD EFFECT: "Boomerang"
//  Artifact (Normal, Cost 3)
//
//  Choose an Artifact from your discard pile and
//  add it to your hand. You cannot play any
//  Artifacts for the rest of this turn.
//
//  Wiring:
//    • Routes through `doUseArtifactEffect`
//      (Normal Artifact, no equip, no creature).
//      `isTargetingArtifact: true` keeps the card
//      out of the creature/equipment paths even
//      though the targeting itself is handled
//      inside `resolve` via a `cardGallery`
//      prompt — Alchemic Journal's pattern.
//    • Recovery uses the central
//      `engine.addCardFromDiscardToHand` helper
//      so `onCardAddedFromDiscardToHand` fires —
//      Bamboo Staff strikes off a recovered
//      Artifact, Bamboo Shield offers its
//      reveal-for-discount prompt, and any future
//      "I came back from the graveyard"
//      reactives plug in for free.
//    • Gallery filters to Artifacts only — every
//      cardType containing "Artifact" qualifies
//      (Equipment, Reaction, Normal, Surprise,
//      Artifact-Creature hybrids).
//    • The "no Artifacts for the rest of this
//      turn" lockout is encoded as
//      `ps._artifactLockTurn = gs.turn` — a
//      self-expiring stamp the turn-rollover
//      naturally invalidates (no per-turn
//      cleanup needed). Enforced in three
//      gates: server's `doPlayArtifact` and
//      `doUseArtifactEffect`, and the engine's
//      `_checkPreDamageHandReactions` /
//      chain-reaction window for Artifact-type
//      reactions.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Boomerang';

// Module-cached card-DB lookup so canActivate (which only gets gs / pi)
// can still read cardType info. Same pattern Shard of Chaos uses.
let _cardDB = null;
function getCardDB() {
  if (!_cardDB) {
    const cards = JSON.parse(
      require('fs').readFileSync(
        require('path').join(__dirname, '..', '..', 'data', 'cards.json'),
        'utf-8',
      ),
    );
    _cardDB = {};
    for (const c of cards) _cardDB[c.name] = c;
  }
  return _cardDB;
}

/** Does this player's discard pile contain at least one Artifact? */
function hasArtifactInDiscard(ps) {
  if (!ps) return false;
  const dp = ps.discardPile || [];
  if (dp.length === 0) return false;
  const db = getCardDB();
  for (const name of dp) {
    const cd = db[name];
    if (cd && hasCardType(cd, 'Artifact')) return true;
  }
  return false;
}

/** Distinct Artifact names in the player's discard pile, with counts. */
function artifactsInOwnDiscard(ps) {
  if (!ps) return [];
  const db = getCardDB();
  const counts = new Map();
  for (const name of (ps.discardPile || [])) {
    const cd = db[name];
    if (!cd || !hasCardType(cd, 'Artifact')) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, source: 'discard', count }));
}

module.exports = {
  isTargetingArtifact: true,
  deferBroadcast: true,

  /**
   * Activatable iff the player's discard pile contains at least one
   * Artifact and the lockout isn't already in effect (covers the
   * "two Boomerangs in hand, played one" case — the second one just
   * dims). The cost / itemLocked / hand-lock gates run earlier in
   * the server handler.
   */
  canActivate(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    if (ps._artifactLockTurn === gs.turn) return false;
    return hasArtifactInDiscard(ps);
  },

  async resolve(engine, pi /*, selectedIds, validTargets */) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };
    if (ps._artifactLockTurn === gs.turn) return { cancelled: true };

    const galleryCards = artifactsInOwnDiscard(ps);
    if (galleryCards.length === 0) return { cancelled: true };

    const picked = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: CARD_NAME,
      description: 'Choose an Artifact from your discard pile to add to your hand.',
      cancellable: true,
    });
    if (!picked || picked.cancelled || !picked.cardName) return { cancelled: true };
    const chosenName = picked.cardName;

    // Defensive re-check — gallery → confirm interleavings could in
    // theory let another effect drain the discard pile of this name
    // between gallery build and pick (none currently does, but keep
    // the gate symmetric with the rest of the discard-tutor pattern).
    if (!(ps.discardPile || []).includes(chosenName)) return { cancelled: true };

    // Universal helper: splice + push + fires
    // ON_CARD_ADDED_FROM_DISCARD_TO_HAND so Bamboo Staff's free-attack
    // chain and Bamboo Shield's reveal-for-discount prompt both
    // trigger naturally off this recovery.
    const inst = await engine.addCardFromDiscardToHand(pi, chosenName, pi, {
      source: CARD_NAME,
    });
    if (!inst) return { cancelled: true };

    engine._broadcastEvent('deck_search_add', { cardName: chosenName, playerIdx: pi });

    // Lockout: self-expiring — `ps._artifactLockTurn` holds the turn
    // number it was set on, so a turn rollover invalidates it
    // automatically. Checked in doPlayArtifact /
    // doUseArtifactEffect / chain reaction window /
    // pre-damage hand reaction window.
    ps._artifactLockTurn = gs.turn;

    engine.log('boomerang_recover', {
      player: ps.username, card: chosenName,
    });
    engine.sync();
    return true;
  },
};
