// ═══════════════════════════════════════════
//  CARD EFFECT: "Guard Duty"
//  Spell (Support Magic Lv1, Normal)
//  Archetype: Guardian Beasts.
//
//  Shuffle your entire discard pile back into
//  your deck. Your opponent MAY then shuffle
//  their entire discard pile back into their
//  deck (their choice — they confirm via prompt).
//  Counts as an additional Action.
//
//  ONCE PER GAME — gated via `gs._guardDutyUsed[pi]`
//  set on resolution. The hand-play `canPlay` gate
//  short-circuits when the flag is set so the card
//  greys out cleanly.
// ═══════════════════════════════════════════

const ONCE_PER_GAME_KEY = '_guardDutyUsed';
const CARD_NAME = 'Guard Duty';

module.exports = {
  inherentAction: true, // Free additional Action — no main-action cost.
  // Shuffles discard pile back into deck — flagged for "No Retreat!"
  // detection.
  shufflesFromHandOrDiscardIntoDeck: true,

  spellPlayCondition(gs, pi) {
    return !gs[ONCE_PER_GAME_KEY]?.[pi];
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const ps = gs.players[pi];
      const ops = gs.players[oi];
      if (!ps) return;

      // Stamp the per-game flag immediately on resolution. Even if the
      // shuffles fizzle (empty discard piles, or the opponent declines),
      // the card has been "used" — once-per-game.
      if (!gs[ONCE_PER_GAME_KEY]) gs[ONCE_PER_GAME_KEY] = {};
      gs[ONCE_PER_GAME_KEY][pi] = true;

      // Step 1: caster's discard → caster's main deck, then shuffle.
      const myDp = ps.discardPile || [];
      if (myDp.length > 0) {
        const moved = myDp.length;
        ps.mainDeck.push(...myDp);
        ps.discardPile = [];
        engine.shuffleDeck(pi, 'main');
        engine.log('guard_duty_shuffle_self', { player: ps.username, moved });
        // Hatusbals Bonus: diese Karte geht an `actionRecycleCards`
        // vorbei (sie schiebt die GANZE Ablage in einem Rutsch), meldet
        // ihren Effekt also selbst.
        await engine.noteShuffledBack(pi, moved, CARD_NAME);
      }

      // Step 2: prompt opponent (yes/no). Fizzle silently if opp's
      // discard is empty — no choice to offer.
      if (ops?.discardPile?.length > 0) {
        const choice = await engine.promptGeneric(oi, {
          type: 'optionPicker',
          title: CARD_NAME,
          description: `${ps.username} played Guard Duty — you may shuffle your entire discard pile back into your deck. Accept?`,
          options: [
            { id: 'yes', label: '🔁 Yes, shuffle my discard back' },
            { id: 'no', label: 'No, keep my discard' },
          ],
          cancellable: false,
        });
        if (choice?.optionId === 'yes') {
          const moved = ops.discardPile.length;
          ops.mainDeck.push(...ops.discardPile);
          ops.discardPile = [];
          engine.shuffleDeck(oi, 'main');
          engine.log('guard_duty_shuffle_opp', { player: ops.username, moved });
        }
      }

      engine.sync();
    },
  },
};
