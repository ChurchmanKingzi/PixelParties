// ═══════════════════════════════════════════
//  CARD EFFECT: "Rain Viola"
//  Artifact / Equipment (Cost 4)
//
//  „When this Artifact equipped to a Hero you control is sent to the
//   discard pile, search your deck for any Attack or Spell, reveal it
//   and add it to your hand. You can only activate this effect of
//   "Rain Viola" once per turn."
//
//  Ausloeser wie bei den Geschwistern (`_orchestra-shared`). Suche per
//  Galerie ueber alle Attacks/Spells im Deck, dann
//  `actionAddCardFromDeckToHand` mit `reveal: true` (Flug, Reveal fuer
//  den Gegner, Mischen). Kein passender Treffer im Deck → der Effekt
//  verpufft, das Einmal-pro-Zug ist trotzdem verbraucht (er hat
//  gefeuert).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { instrumentDiscardTrigger } = require('./_orchestra-shared');

const CARD_NAME = 'Rain Viola';

module.exports = {
  isEquip: true,
  activeIn: ['support'],
  bypassDeadHeroFilter: true,

  hooks: {
    onCardLeaveZone: async (ctx) => {
      const fired = instrumentDiscardTrigger(ctx, CARD_NAME, 'rain-viola');
      if (!fired) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const { pi } = fired;
      const ps = gs.players[pi];
      const db = engine._getCardDB();
      const counts = new Map();
      for (const n of (ps?.mainDeck || [])) {
        const cd = db[n];
        if (cd && (hasCardType(cd, 'Attack') || hasCardType(cd, 'Spell'))) counts.set(n, (counts.get(n) || 0) + 1);
      }
      if (counts.size === 0) {
        engine.log('rain_viola', { player: ps?.username, found: null });
        return;
      }
      const cards = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, source: 'deck', count }));
      const picked = await engine.promptGeneric(pi, {
        type: 'cardGallery', cards, title: CARD_NAME,
        description: 'Search your deck for an Attack or Spell — reveal it and add it to your hand.',
        confirmLabel: '🎻 Take it!', confirmClass: 'btn-success', cancellable: false,
      });
      if (!picked || !picked.cardName) return;
      await engine.actionAddCardFromDeckToHand(pi, picked.cardName, { source: CARD_NAME, reveal: true, shuffle: true,
        // v734: „any Attack or Spell".
        searchSpec: { label: 'Attack or Spell', filter: (cd) => hasCardType(cd, 'Attack') || hasCardType(cd, 'Spell') } });
      engine.log('rain_viola', { player: ps?.username, found: picked.cardName });
      engine.sync();
    },
  },
};
