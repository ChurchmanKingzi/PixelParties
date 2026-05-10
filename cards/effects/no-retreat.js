// ═══════════════════════════════════════════
//  CARD EFFECT: "No Retreat!"
//  Spell (Reaction, Lv1, Decay Magic)
//
//  Play immediately when your opponent activates
//  a card or effect that includes shuffling cards
//  from their hand, discard pile, or side of the
//  board back into the deck. Negate that card or
//  effect.
//
//  Detection: every card whose effect literally
//  recycles cards back into the deck declares
//  `shufflesIntoDeck: true` on its script. The
//  initial chain link is the activator (Spell /
//  Attack / Hero Effect / Ability), so we check
//  its script's flag. A new "shuffles back"
//  effect added to the codebase just needs the
//  flag for No Retreat! to start countering it.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'No Retreat!';

module.exports = {
  isReaction: true,
  // Reaction-only — never proactively playable.
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length === 0) return false;
    const initial = chainCtx.chain.find(l => l.isInitialCard);
    if (!initial) return false;
    // "When your opponent activates ..." — only opp-initiated effects.
    if (initial.owner === pi) return false;
    const script = loadCardEffect(initial.cardName);
    return !!script?.shufflesIntoDeck;
  },

  resolve: async (engine, pi, _selectedIds, _validTargets, chain) => {
    const initial = chain.find(l => l.isInitialCard);
    if (!initial) return;
    const initialIdx = chain.indexOf(initial);
    if (initialIdx < 0) return;
    engine.negateChainLink(chain, initialIdx);
    engine.log('no_retreat_negate', {
      player: engine.gs.players[pi]?.username,
      negated: initial.cardName,
    });
    engine.sync();
  },
};
