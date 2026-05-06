// ═══════════════════════════════════════════
//  CARD EFFECT: "Magic Ruby"
//  Artifact (Normal, Cost 10)
//
//  Choose a Hero your opponent controls and Stun
//  it for 1 turn.
//  You may discard a card from your hand to keep
//  this card in your hand. Once per turn.
// ═══════════════════════════════════════════

const { canPlayMagicGem, maybeKeepGemInHand } = require('./_magic-gem-shared');

const CARD_NAME = 'Magic Ruby';
const STUN_DURATION = 1;

module.exports = {
  isTargetingArtifact: true,
  activeIn: ['hand'],

  canActivate(gs, pi) {
    if (!canPlayMagicGem(gs, pi, CARD_NAME)) return false;
    // Need at least one alive opponent hero. Existing immunities are
    // checked by the standard status-application gate at apply time.
    const oi = pi === 0 ? 1 : 0;
    const ops = gs.players[oi];
    return (ops?.heroes || []).some(h => h?.name && h.hp > 0);
  },

  getValidTargets(gs, pi) {
    const oi = pi === 0 ? 1 : 0;
    const ops = gs.players[oi];
    const out = [];
    for (let hi = 0; hi < (ops?.heroes || []).length; hi++) {
      const h = ops.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      out.push({ id: `hero-${oi}-${hi}`, type: 'hero', owner: oi, heroIdx: hi, cardName: h.name });
    }
    return out;
  },

  targetingConfig: {
    description: 'Choose an opponent Hero to Stun for 1 turn.',
    confirmLabel: '💫 Stun!',
    confirmClass: 'btn-warning',
    cancellable: true,
    maxTotal: 1,
    appliesStatus: 'stunned',
  },

  validateSelection(selectedIds) { return selectedIds.length === 1; },

  resolve: async (engine, pi, selectedIds) => {
    const id = (selectedIds || [])[0] || '';
    const m = id.match(/^hero-(\d+)-(\d+)$/);
    if (!m) return { keepInHand: false };
    const tpi = parseInt(m[1]);
    const hi = parseInt(m[2]);
    if (tpi === pi) return { keepInHand: false }; // must be opponent

    await engine.addHeroStatus(tpi, hi, 'stunned', {
      duration: STUN_DURATION,
      appliedBy: pi,
    });

    return await maybeKeepGemInHand(engine, pi, CARD_NAME);
  },
};
