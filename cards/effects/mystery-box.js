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
