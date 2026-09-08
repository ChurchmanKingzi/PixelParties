// ═══════════════════════════════════════════
//  CARD EFFECT: "Clever Puppet Saras"
//  Token (Normal) — Puppets, PP MSIN
//
//  "… You may once per turn draw 4 cards, then
//  discard 1. No other Token in the corresponding
//  Hero's Support Zones can use its active
//  effect for the rest of the turn afterwards.
//  If the corresponding Hero's name is "Tri
//  Fecta, the Puppet Master", immediately
//  replace this Token with a "Creative Puppet
//  Brammi" Token."
//
//  Umsetzung (v704): `actionDrawCards(4)`, dann
//  Pflicht-Abwurf ueber das forceDiscard-Prompt
//  (Cute-Annoyance-Mini-Muster). Zieht das Deck
//  weniger als 4 her, wird gezogen, was da ist.
// ═══════════════════════════════════════════

const {
  PUPPET_TOKEN_BASE, PUPPET_TOKEN_HOOKS, puppetGlow, SARAS, canUsePuppetActive, lockPuppetActives,
} = require('./_puppets-shared');

const CARD_NAME = SARAS;

module.exports = {
  ...PUPPET_TOKEN_BASE,
  hooks: { ...PUPPET_TOKEN_HOOKS },

  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData?.type === 'forceDiscard') {
      const idx = promptData.eligibleIndices?.[0];
      return idx != null ? { handIndex: idx } : null;
    }
    return null;
  },

  canActivateCreatureEffect(ctx) {
    if (!canUsePuppetActive(ctx)) return false;
    const ps = ctx._engine.gs.players[ctx.cardOwner];
    return (ps?.mainDeck || []).length > 0;
  },

  onCreatureEffect: async (ctx) => {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    const inst = ctx.card;
    puppetGlow(engine, pi, inst);   // v707: ohne Wartezeit
    await engine.actionDrawCards(pi, 4, { source: CARD_NAME });
    engine.sync();
    if ((ps.hand || []).length > 0) {
      const pick = await engine.promptGeneric(pi, {
        type: 'forceDiscard',
        title: CARD_NAME,
        description: 'Discard 1 card.',
        instruction: 'Click a card in your hand to discard it.',
        eligibleIndices: ps.hand.map((_, i) => i),
        cancellable: false,
      });
      if (pick && pick.handIndex != null) {
        await engine.actionDiscardHandCard(pi, pick.cardName || ps.hand[pick.handIndex], pick.handIndex, { source: CARD_NAME, _noGlow: true });
      }
    }
    lockPuppetActives(engine, pi, inst.heroIdx, inst.id);
    engine.sync();
    return true;
  },
};
