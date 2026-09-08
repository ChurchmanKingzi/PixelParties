// ═══════════════════════════════════════════
//  CARD EFFECT: "Creative Puppet Brammi"
//  Token (Normal) — Puppets, PP MSIN
//
//  "… You may once per turn search your deck for
//  a card, reveal it, and add it to your hand.
//  No other Token in the corresponding Hero's
//  Support Zones can use its active effect for
//  the rest of the turn afterwards. If the
//  corresponding Hero's name is "Tri Ad, the
//  Puppet Mistress", immediately replace this
//  Token with a "Clever Puppet Saras" Token."
//
//  Umsetzung (v704): Galerie ueber das ganze
//  Deck (Angry-Cheese-Muster), Zugang ueber den
//  kanonischen Tutor `actionAddCardFromDeckToHand`
//  (Reveal, Hook onCardAddedToHand, Flug). Der
//  Tausch liegt im Shared-Modul.
// ═══════════════════════════════════════════

const {
  PUPPET_TOKEN_BASE, PUPPET_TOKEN_HOOKS, BRAMMI, canUsePuppetActive, lockPuppetActives,
} = require('./_puppets-shared');

const CARD_NAME = BRAMMI;

module.exports = {
  ...PUPPET_TOKEN_BASE,
  hooks: { ...PUPPET_TOKEN_HOOKS },

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
    const countMap = {};
    for (const n of (ps.mainDeck || [])) countMap[n] = (countMap[n] || 0) + 1;
    const galleryCards = Object.entries(countMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));
    if (galleryCards.length === 0) return false;
    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: CARD_NAME,
      description: 'Search your deck for a card — it is revealed and added to your hand.',
      cancellable: true,
    });
    if (!result?.cardName) return false;
    if ((ps.mainDeck || []).indexOf(result.cardName) < 0) return false;
    await engine.actionAddCardFromDeckToHand(pi, result.cardName, { source: CARD_NAME, reveal: true });
    engine.shuffleDeck(pi, 'main');
    lockPuppetActives(engine, pi, inst.heroIdx, inst.id);
    engine.sync();
    return true;
  },
};
