// ═══════════════════════════════════════════
//  CARD EFFECT: "Magic Amber"
//  Artifact (Normal, Cost 2)
//
//  Your opponent chooses a card from their hand
//  and discards it.
//  You may discard a card from your hand to keep
//  this card in your hand. Once per turn.
// ═══════════════════════════════════════════

const { canPlayMagicGem, maybeKeepGemInHand } = require('./_magic-gem-shared');

const CARD_NAME = 'Magic Amber';

module.exports = {
  // CPU: alwaysCommit — Sofort-Handdisruption (Gegner discardet) — der Immediate-Score gewichtet Gegner-Handverlust nicht, das Gate lehnte 100% ab.
  // planArtifactPlay filtert Bezahlbarkeit bereits; entspricht der
  // dokumentierten Artifact-Politik "played as soon as affordable".
  cpuMeta: { alwaysCommit: true },
  activeIn: ['hand'],

  canActivate(gs, pi) {
    if (!canPlayMagicGem(gs, pi, CARD_NAME)) return false;
    // Even with an empty opp hand, Amber's keep-in-hand recycle is still
    // valuable, so don't gate on opp hand size — the discard step just
    // fizzles harmlessly via actionPromptForceDiscard's empty-hand guard.
    return true;
  },

  resolve: async (engine, pi) => {
    const oi = pi === 0 ? 1 : 0;

    // Main effect: opponent picks a card from THEIR hand to discard.
    await engine.actionPromptForceDiscard(oi, 1, {
      title: CARD_NAME,
      source: CARD_NAME,
      description: 'Your opponent played Magic Amber. Choose a card to discard.',
    });

    return await maybeKeepGemInHand(engine, pi, CARD_NAME);
  },
};
