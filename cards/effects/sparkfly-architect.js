// ═══════════════════════════════════════════
//  CARD EFFECT: "Sparkfly Architect"
//  Creature (Summoning Magic, Lv 0, Sparkfly) — 20 HP
//
//  • On summon: optionally search your deck for any "Sparkfly" card
//    or "Hive's Crown" and add it to your hand (revealed to opponent).
//  • When sacrificed to summon Sparkfly Queen (i.e. via Hive's Crown),
//    the Queen gains a once-per-turn ability:
//        "Draw cards until you have the same number of cards in your
//         hand as your opponent."
//    The gift wiring is stamped by Hive's Crown's resolve via
//    `_sparkfly-shared.grantInheritedAbility`. This file only owns the
//    on-summon tutor.
// ═══════════════════════════════════════════

const { HIVE_CROWN_NAME } = require('./_sparkfly-shared');

const CARD_NAME = 'Sparkfly Architect';

module.exports = {
  activeIn: ['support'],
  blockedByHandLock: true,

  /**
   * CPU pick for the tutor gallery: prefer Hive's Crown when a Queen
   * is reachable AND a sacrificable Sparkfly creature is on the board
   * (or about to be — Architect itself counts since it's just been
   * summoned). Otherwise prefer Sparkfly Worker (board steal) > Sparkfly
   * Attendant (Queen aura) > Sparkfly Queen (only useful if Hive's Crown
   * is in hand). Ranking is best-effort — falls back to gallery[0].
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'cardGallery') return undefined;
    if (promptData.title !== CARD_NAME) return undefined;
    const cards = promptData.cards || [];
    if (cards.length === 0) return undefined;

    const cpuIdx = engine._cpuPlayerIdx;
    const ps = engine.gs.players?.[cpuIdx];
    const handHasQueen = (ps?.hand || []).includes('Sparkfly Queen');
    const handHasCrown = (ps?.hand || []).includes(HIVE_CROWN_NAME);

    // Look for a non-Queen Sparkfly already on board (would be the
    // sac target for Hive's Crown).
    let hasSacBoardTarget = false;
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support') continue;
      if ((inst.controller ?? inst.owner) !== cpuIdx) continue;
      if (inst.name === 'Sparkfly Architect'
          || inst.name === 'Sparkfly Attendant'
          || inst.name === 'Sparkfly Worker') {
        hasSacBoardTarget = true;
        break;
      }
    }

    const order = [];
    if (handHasQueen && hasSacBoardTarget) {
      order.push(HIVE_CROWN_NAME, 'Sparkfly Worker', 'Sparkfly Attendant', 'Sparkfly Queen');
    } else if (handHasCrown && hasSacBoardTarget) {
      // Crown already in hand — go for a Queen (deck-pull path) if not in hand,
      // else the most utility creature.
      if (!handHasQueen) order.push('Sparkfly Queen');
      order.push('Sparkfly Worker', 'Sparkfly Attendant', HIVE_CROWN_NAME);
    } else {
      // No sac target yet — get a Queen and a non-Queen Sparkfly first.
      order.push('Sparkfly Worker', 'Sparkfly Attendant', 'Sparkfly Queen', HIVE_CROWN_NAME);
    }

    for (const name of order) {
      const match = cards.find(c => c.name === name);
      if (match) return { cardName: name, source: match.source || 'deck' };
    }
    return { cardName: cards[0].name, source: cards[0].source || 'deck' };
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

      // Hand-lock = silent no-op. The base summon still resolves; we
      // just can't add a card. Keeps parity with other draw-only effects.
      if (ps.handLocked) return;

      const cardDB = engine._getCardDB();
      const seen = new Set();
      const gallery = [];
      for (const name of (ps.mainDeck || [])) {
        if (seen.has(name)) continue;
        const cd = cardDB[name];
        if (!cd) continue;
        const isSparkfly = cd.archetype === 'Sparkfly';
        const isHiveCrown = name === HIVE_CROWN_NAME;
        if (!isSparkfly && !isHiveCrown) continue;
        seen.add(name);
        gallery.push({ name, source: 'deck' });
      }

      if (gallery.length === 0) return;

      gallery.sort((a, b) => a.name.localeCompare(b.name));

      const picked = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: CARD_NAME,
        description: 'Search your deck for a "Sparkfly" card or "Hive\'s Crown" and add it to your hand.',
        cancellable: true,
      });
      if (!picked || picked.cancelled || !picked.cardName) return;

      const chosenName = picked.cardName;
      if (!gallery.some(g => g.name === chosenName)) return;

      await engine.searchDeckForNamedCard(pi, chosenName, CARD_NAME);
    },
  },
};
