// ═══════════════════════════════════════════
//  CARD EFFECT: "Shard of Chaos"
//  Artifact (Normal, Cost 4)
//
//  Delete 1-3 cards from hand, then retrieve
//  the same number of cards of the same types
//  from the discard pile. Shard is deleted.
//
//  Attack/Spell/Creature count as one type
//  ("Action"). Ability, Artifact, Potion, Hero
//  are separate types.
// ═══════════════════════════════════════════

const ACTION_TYPES = new Set(['Attack', 'Spell', 'Creature']);

function normalizeType(cardType) {
  return ACTION_TYPES.has(cardType) ? 'Action' : cardType;
}

let _cardDB = null;
function getCardDB() {
  if (!_cardDB) {
    const cards = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', 'cards.json'), 'utf-8'));
    _cardDB = {};
    cards.forEach(c => { _cardDB[c.name] = c; });
  }
  return _cardDB;
}

module.exports = {
  deferBroadcast: true,
  deleteOnUse: true,

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    // Need 2+ cards in hand (Shard + at least 1 other)
    if ((ps.hand || []).length < 2) return false;
    // At least 1 hand card (not Shard) whose normalized type exists in discard
    const discardTypes = new Set();
    for (const cn of (ps.discardPile || [])) {
      const cd = getCardDB()[cn];
      if (cd) discardTypes.add(normalizeType(cd.cardType));
    }
    if (discardTypes.size === 0) return false;
    for (let i = 0; i < ps.hand.length; i++) {
      const cn = ps.hand[i];
      if (cn === 'Shard of Chaos') continue;
      const cd = getCardDB()[cn];
      if (cd && discardTypes.has(normalizeType(cd.cardType))) return true;
    }
    return false;
  },

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    const cardDB = getCardDB();

    // ── Build discard type counts ──
    const discardTypeCounts = {};
    for (const cn of (ps.discardPile || [])) {
      const cd = cardDB[cn];
      if (!cd) continue;
      const nt = normalizeType(cd.cardType);
      discardTypeCounts[nt] = (discardTypeCounts[nt] || 0) + 1;
    }

    // ── Build eligible hand indices (ALL cards whose type exists in discard) ──
    const resolveHi = ps._resolvingCard ? ps.hand.findIndex((c, i) => {
      if (c !== ps._resolvingCard.name) return false;
      const nth = ps.hand.slice(0, i + 1).filter(x => x === c).length;
      return nth === ps._resolvingCard.nth;
    }) : -1;

    const eligibleIndices = [];
    const cardTypes = {}; // handIndex → normalizedType
    for (let i = 0; i < ps.hand.length; i++) {
      if (i === resolveHi) continue; // Skip Shard itself
      const cn = ps.hand[i];
      const cd = cardDB[cn];
      if (!cd) continue;
      const nt = normalizeType(cd.cardType);
      if ((discardTypeCounts[nt] || 0) > 0) {
        eligibleIndices.push(i);
        cardTypes[i] = nt;
      }
    }

    if (eligibleIndices.length === 0) return { cancelled: true };

    // ── Step 1: Hand Pick prompt ──
    const maxSelect = Math.min(3, eligibleIndices.length);
    const pickResult = await engine.promptGeneric(pi, {
      type: 'handPick',
      eligibleIndices,
      cardTypes,
      typeLimits: discardTypeCounts,
      minSelect: 1,
      maxSelect,
      title: 'Shard of Chaos',
      description: `Select up to ${maxSelect} card(s) to delete. You'll retrieve the same types from your discard pile.`,
      confirmLabel: '🌀 Bring Chaos!',
    });

    if (!pickResult || pickResult.cancelled || !pickResult.selectedCards || pickResult.selectedCards.length === 0) {
      return { cancelled: true };
    }

    // ── Delete selected hand cards ──
    const selectedCards = pickResult.selectedCards;
    const typeNeeds = {}; // normalized type → count needed
    const deletedNames = [];

    // Sort indices descending to splice safely
    const sortedIndices = selectedCards.map(s => s.handIndex).sort((a, b) => b - a);
    for (const idx of sortedIndices) {
      const cn = ps.hand[idx];
      if (!cn) continue;
      const cd = cardDB[cn];
      if (!cd) continue;
      const nt = normalizeType(cd.cardType);
      typeNeeds[nt] = (typeNeeds[nt] || 0) + 1;
      deletedNames.push(cn);
      ps.hand.splice(idx, 1);
      ps.deletedPile.push(cn);
    }

    engine.log('shard_delete', { player: ps.username, deleted: deletedNames });
    engine.sync();

    // ── Chaos screen animation ──
    engine._broadcastEvent('play_chaos_screen', {});
    await engine._delay(400);

    // ── Step 2: Retrieve from discard — one prompt per type ──
    const retrievedCards = [];
    const typeEntries = Object.entries(typeNeeds).sort((a, b) => b[1] - a[1]);

    for (const [normType, count] of typeEntries) {
      // Filter discard pile for this type
      const available = [];
      const seen = {};
      for (const cn of (ps.discardPile || [])) {
        const cd = cardDB[cn];
        if (!cd) continue;
        if (normalizeType(cd.cardType) !== normType) continue;
        const key = cn;
        seen[key] = (seen[key] || 0) + 1;
        available.push({ name: cn, count: 1, source: 'discard', displayLabel: `${cn} (${cd.cardType})` });
      }

      // Deduplicate for gallery display
      const deduped = [];
      const dedupSeen = {};
      for (const item of available) {
        if (!dedupSeen[item.name]) {
          dedupSeen[item.name] = { ...item, count: 1 };
          deduped.push(dedupSeen[item.name]);
        } else {
          dedupSeen[item.name].count++;
        }
      }

      const actualCount = Math.min(count, available.length);
      if (actualCount <= 0) continue;

      const typeLabel = normType === 'Action' ? 'Attack/Spell/Creature' : normType;
      const galleryResult = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: deduped,
        title: `Shard of Chaos — Retrieve ${typeLabel}`,
        description: `Choose ${actualCount} ${typeLabel} card(s) from your discard pile.`,
        selectCount: actualCount,
        cancellable: false,
      });

      if (galleryResult && galleryResult.cardName) {
        retrievedCards.push(galleryResult.cardName);
      }
      if (galleryResult && galleryResult.selectedCards) {
        for (const cn of galleryResult.selectedCards) retrievedCards.push(cn);
      }
    }

    // ── Add retrieved cards to hand + stream to opponent ──
    const oi = pi === 0 ? 1 : 0;
    const oppSid = gs.players[oi]?.socketId;

    for (const cn of retrievedCards) {
      // Remove from discard pile
      const discIdx = ps.discardPile.indexOf(cn);
      if (discIdx >= 0) ps.discardPile.splice(discIdx, 1);
      // Add to hand
      ps.hand.push(cn);
      // Stream to opponent
      if (oppSid && engine.io) {
        engine.io.to(oppSid).emit('card_reveal', { cardName: cn });
      }
      // Brief stagger between reveals
      await engine._delay(300);
    }

    engine.log('shard_retrieve', { player: ps.username, retrieved: retrievedCards });
    engine.sync();

    // Face-up display for 5 seconds is handled by card_reveal on the client

    return true;
  },
};
