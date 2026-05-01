// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian Beast Ma" (Horse)
//  Creature (Summoning Magic Lv0, 60 HP).
//  Archetype: Guardian Beasts.
//
//  EFFECT (once/turn): send up to the top 3
//    cards from BOTH decks to the discard pile.
//    The player picks how many (1-3); same
//    number applies to both sides.
//
//  No delete cost — Ma is the "fuel up" beast
//  whose cost is "running through your own deck",
//  which becomes a real risk in a long game.
// ═══════════════════════════════════════════

const {
  canSummonGuardianBeast,
  inherentActionForFirstSummon,
} = require('./_guardian-beasts-shared');

const CARD_NAME = 'Guardian Beast Ma';
const MAX_MILL = 3;

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: canSummonGuardianBeast,
  inherentAction: (gs, pi) => inherentActionForFirstSummon(gs, pi),

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const myDeck = engine.gs.players[ctx.cardOwner]?.mainDeck?.length || 0;
    const oppDeck = engine.gs.players[ctx.cardOwner === 0 ? 1 : 0]?.mainDeck?.length || 0;
    return (myDeck + oppDeck) > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const oi = pi === 0 ? 1 : 0;
    const myDeckLen = engine.gs.players[pi]?.mainDeck?.length || 0;
    const oppDeckLen = engine.gs.players[oi]?.mainDeck?.length || 0;
    const cap = Math.min(MAX_MILL, Math.max(myDeckLen, oppDeckLen));
    if (cap <= 0) return false;

    // Amount picker — dropdown variant (mirrors Siphem). The list can
    // get long when both decks are deep; one row-button per choice
    // eats vertical space, while a dropdown keeps the prompt compact.
    const opts = [];
    for (let n = 1; n <= cap; n++) {
      opts.push({ id: `n-${n}`, label: `Mill ${n} from each deck` });
    }
    const choice = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      renderAs: 'dropdown',
      title: CARD_NAME,
      description: `Send up to ${cap} cards from the top of each player's deck to their discard pile.`,
      confirmLabel: 'Confirm',
      options: opts,
      cancellable: true,
    });
    if (!choice || choice.cancelled || !choice.optionId) return false;
    const match = (choice.optionId || '').match(/^n-(\d+)$/);
    if (!match) return false;
    const n = parseInt(match[1], 10);
    if (!Number.isFinite(n) || n <= 0 || n > cap) return false;

    // Mill from both decks. `actionMillCards` already fires onMill hooks
    // and respects first-turn protection on the receiving side.
    const milledMine = await engine.actionMillCards(pi, n, {
      source: CARD_NAME, selfInflicted: true,
    });
    const milledOpp = await engine.actionMillCards(oi, n, { source: CARD_NAME });
    engine.log('guardian_beast_ma_mill', {
      player: engine.gs.players[pi]?.username,
      milledSelf: milledMine.length,
      milledOpp: milledOpp.length,
    });
    engine.sync();
    return true;
  },
};
