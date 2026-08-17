// ═══════════════════════════════════════════
//  CARD EFFECT: "Spider Dance"
//  Spell (Magic Arts Lv1, Normal)
//
//  "Search your deck for up to as many different Surprises as you
//   control 'Spider' Creatures, reveal them and add them to your hand.
//   You may then immediately summon a 'Spider' Creature as an
//   additional Action."
//
//  Mechanics
//  ─────────
//   • Count Spider Creatures the caster controls — that's the picker
//     cap N. If N = 0, the cast still resolves but performs no
//     search; the bonus summon path likewise needs a Spider Creature
//     in hand to actually fire.
//   • Build the deck's unique Surprise pool — each Surprise card name
//     once, with the count badge showing copies available. Player
//     picks 0..N different names (must be unique — "different
//     Surprises" per card text).
//   • Move each picked Surprise from deck → hand via
//     `actionAddCardFromDeckToHand` so the engine's standard tutor
//     pipeline fires `ON_CARD_ADDED_TO_HAND` and the shuffle/reveal
//     bookkeeping is consistent.
//   • Bonus summon: an immediate hero-locked action on the casting
//     Hero, restricted to Spider Creatures in hand. Reuses
//     `ctx.performImmediateAction` with the new `cardNameFilter`
//     option so the picker only highlights Spider Creatures.
// ═══════════════════════════════════════════

const { isPileCreature, hasCardType } = require('./_hooks');
const {
  countSpiderCreaturesControlled,
  isSpiderCreature,
} = require('./_spider-shared');

const CARD_NAME = 'Spider Dance';

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) return;
      const hero = ps.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // ── Step 1: Surprise deck-search (up to N different names) ──
      const N = countSpiderCreaturesControlled(engine, pi);
      const cardDB = engine._getCardDB();
      // Unique Surprise names + per-name counts in the deck.
      const surpriseCounts = new Map();
      for (const name of (ps.mainDeck || [])) {
        const cd = cardDB[name];
        if (!cd) continue;
        if ((cd.subtype || '').toLowerCase() !== 'surprise') continue;
        surpriseCounts.set(name, (surpriseCounts.get(name) || 0) + 1);
      }
      const surpriseGallery = [...surpriseCounts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'deck', count }));

      if (N > 0 && surpriseGallery.length > 0) {
        const cap = Math.min(N, surpriseGallery.length);
        const pickResult = await engine.promptGeneric(pi, {
          type: 'cardGalleryMulti',
          cards: surpriseGallery,
          title: CARD_NAME,
          description: `Search your deck for up to ${cap} different Surprises to reveal and add to your hand.`,
          selectCount: cap,
          minSelect: 0,
          cancellable: true,
          confirmLabel: '🕸️ Search!',
        });

        if (pickResult && !pickResult.cancelled
            && Array.isArray(pickResult.selectedCards)
            && pickResult.selectedCards.length > 0) {
          // `cardGalleryMulti` returns `selectedCards` as an array of
          // card-name STRINGS (see app-board.jsx ~13393 — the picker
          // builds the response with `cards[i]?.name`). Earlier
          // versions of this code treated entries as objects and
          // silently dropped every pick.
          const namesPicked = pickResult.selectedCards
            .filter(n => typeof n === 'string' && surpriseCounts.has(n));
          for (const name of namesPicked) {
            await engine.actionAddCardFromDeckToHand(pi, name, {
              source: CARD_NAME,
              reveal: true,
              shuffle: false, // shuffle once after the batch, below
            });
          }
          engine.shuffleDeck(pi, 'main');
          engine.log('spider_dance_search', {
            player: ps.username, cap, taken: namesPicked,
          });
          engine.sync();
        }
      } else {
        engine.log('spider_dance_no_search', {
          player: ps.username,
          reason: N <= 0 ? 'no_spiders' : 'no_surprises_in_deck',
        });
      }

      // ── Step 2: Immediate bonus Spider Creature summon ──
      // Any of the player's living Heroes that can legally summon a
      // Spider Creature may take the bonus Action — Spider Dance's
      // text doesn't lock the summon to the casting Hero. Uses the
      // any-hero variant of performImmediateAction so the client
      // renders the standard hero-picker when multiple heroes
      // qualify, and auto-summons when only one does.
      const hasSpiderInHand = (ps.hand || []).some(n => {
        const cd = cardDB[n];
        return cd && isPileCreature(cd) && isSpiderCreature(n, engine);
      });
      if (hasSpiderInHand) {
        await ctx.performImmediateActionAnyHero({
          title: CARD_NAME,
          description: `You may immediately summon a Spider Creature from your hand with any Hero.`,
          allowedCardTypes: ['Creature'],
          cardNameFilter: (name) => isSpiderCreature(name, engine),
          skipAbilities: true,
          // The bonus summon is optional per card text ("You MAY then
          // immediately summon …") — surface the Cancel/Skip control.
          cancellable: true,
        });
      }
    },
  },
};
