// ═══════════════════════════════════════════
//  CARD EFFECT: "Mystery Box"
//  Artifact (Normal, Cost 0) — BANNED
//
//  This card has no effect when played.
//  The first time every turn a "Mystery Box"
//  is sent to the discard pile OR deleted
//  from your DECK, draw 2 cards.
//
//  "From your deck" = milled, not discarded
//  from hand. Triggers on onMill (deleteMode
//  false or true) when playerIdx === owner.
//
//  HOPT shared across all copies (keyed by
//  name + player). Active from any zone so
//  the hook fires regardless of where this
//  particular copy currently resides.
// ═══════════════════════════════════════════

const CARD_NAME = 'Mystery Box';

module.exports = {
  // Must be active in multiple zones because the triggering
  // card (the milled copy) is in the deck, not this instance.
  // activeIn broadly so the hook registers for the player.
  activeIn: ['hand', 'deck', 'discard', 'deleted', 'support', 'ability'],
  neverPlayable: true, // 'No effect when played' — never usable from hand directly

  cpuMeta: {
    /**
     * Declarative bonus for "this card has a beneficial onMill hook".
     * Mill-target pickers (Cute Nerd Magenta's deck-mill response,
     * Deepsea Skeleton's multi-pick, any future "choose what to mill"
     * effect) read this to credit the card's post-mill payoff at
     * selection time — the eval-delta that mill scorers run does not
     * fire `onMill` itself, so a generic eval state would otherwise
     * see "Mystery Box in discard" the same as any neverPlayable
     * 0-cost Artifact and pick arbitrarily between Box and Glass of
     * Marbles (whose `onDiscard` requires `_fromHand`, NOT a deck
     * mill — so Marbles' draw-2 wouldn't actually fire either way).
     *
     * Value: 50 ≈ 2 × the engine's default unknown-card hand value
     * (~25 per card from `estimateHandCardValueFor`'s baseline),
     * matching Box's "draw 2 cards" payoff. Function form lets the
     * card self-gate on its shared HOPT — once the per-turn trigger
     * has fired, milling another Box is a no-op and the bonus
     * collapses to 0 so the picker doesn't double-reward.
     */
    onMillBenefit(engine, pi) {
      const hoptKey = `mystery-box:${pi}`;
      if (engine?.gs?.hoptUsed?.[hoptKey] === engine.gs.turn) return 0;
      return 50;
    },
  },

  hooks: {
    onMill: async (ctx) => {
      // Must be the owner's own deck being milled
      if (ctx.playerIdx !== ctx.cardOwner) return;

      // Must include a Mystery Box among the milled cards
      const milledBoxes = (ctx.milledCards || []).filter(cn => cn === CARD_NAME);
      if (milledBoxes.length === 0) return;

      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;

      // HOPT shared across all copies (first trigger per turn wins)
      const hoptKey = `mystery-box:${pi}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) return;
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[hoptKey] = gs.turn;

      engine.log('mystery_box', { player: gs.players[pi]?.username, trigger: 'mill' });
      await engine.actionDrawCards(pi, 2);
      engine.sync();
    },
  },
};
