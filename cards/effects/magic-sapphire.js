// ═══════════════════════════════════════════
//  CARD EFFECT: "Magic Sapphire"
//  Artifact (Normal, Cost 10)
//
//  Choose a Spell from your discard pile and add
//  it to your hand.
//  You may discard a card from your hand to keep
//  this card in your hand. Once per turn.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { canPlayMagicGem, maybeKeepGemInHand } = require('./_magic-gem-shared');
const { getCardDB: _getCardDB } = require('./_card-db');

const CARD_NAME = 'Magic Sapphire';

/** Build a deduplicated gallery of Spells in this player's discard pile. */
function _buildSpellGallery(gs, pi, cardDB) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const seen = new Set();
  const counts = {};
  for (const name of (ps.discardPile || [])) {
    const cd = cardDB[name];
    if (!cd || !hasCardType(cd, 'Spell')) continue;
    counts[name] = (counts[name] || 0) + 1;
    seen.add(name);
  }
  return [...seen]
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ name, source: 'discard', count: counts[name] }));
}

module.exports = {
  activeIn: ['hand'],

  canActivate(gs, pi) {
    if (!canPlayMagicGem(gs, pi, CARD_NAME)) return false;
    const ps = gs.players[pi];
    if (!ps?.discardPile?.length) return false;
    // At least one Spell in own discard. canActivate has no engine
    // handle, so we read cards.json directly (cached at module level).
    const dbCache = _getCardDB();
    return ps.discardPile.some(n => {
      const cd = dbCache[n];
      return cd && hasCardType(cd, 'Spell');
    });
  },

  resolve: async (engine, pi) => {
    const cardDB = engine._getCardDB();
    const gallery = _buildSpellGallery(engine.gs, pi, cardDB);
    if (gallery.length === 0) {
      // No Spells in discard — silent fizzle on the main effect, but
      // still offer the keep-in-hand choice (the play happened).
      return await maybeKeepGemInHand(engine, pi, CARD_NAME);
    }

    const picked = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: 'Choose a Spell to recover from your discard pile.',
      cancellable: true,
    });

    if (picked && !picked.cancelled && picked.cardName) {
      const ps = engine.gs.players[pi];
      const idx = ps.discardPile.indexOf(picked.cardName);
      if (idx >= 0) {
        ps.discardPile.splice(idx, 1);
        ps.hand.push(picked.cardName);
        engine._broadcastEvent('card_reveal', { cardName: picked.cardName, playerIdx: pi });
        await engine.runHooks('onCardAddedFromDiscardToHand', {
          playerIdx: pi, cardName: picked.cardName,
          addedCardName: picked.cardName,
          _skipReactionCheck: true,
        });
        engine.log('magic_sapphire_recover', { player: ps.username, card: picked.cardName });
        engine.sync();
      }
    }

    return await maybeKeepGemInHand(engine, pi, CARD_NAME);
  },
};
