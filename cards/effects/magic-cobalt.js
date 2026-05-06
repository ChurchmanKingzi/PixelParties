// ═══════════════════════════════════════════
//  CARD EFFECT: "Magic Cobalt"
//  Artifact (Normal, Cost 1)
//
//  Choose a Hero you control and heal its HP by 50.
//  You may discard a card from your hand to keep
//  this card in your hand. Once per turn.
// ═══════════════════════════════════════════

const { canPlayMagicGem, maybeKeepGemInHand } = require('./_magic-gem-shared');

const CARD_NAME = 'Magic Cobalt';
const HEAL_AMOUNT = 50;

function _getInjuredOwnHeroes(gs, pi) {
  const ps = gs.players[pi];
  const out = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if ((h.hp || 0) >= (h.maxHp || 0)) continue; // already full
    out.push(hi);
  }
  return out;
}

module.exports = {
  isTargetingArtifact: true,
  activeIn: ['hand'],

  canActivate(gs, pi) {
    if (!canPlayMagicGem(gs, pi, CARD_NAME)) return false;
    // At least one of your own heroes must be alive — the heal target
    // doesn't have to be injured (overheal-style cards are valid in
    // this game), but a fully dead board has no legal target.
    const ps = gs.players[pi];
    return (ps?.heroes || []).some(h => h?.name && h.hp > 0);
  },

  getValidTargets(gs, pi) {
    const ps = gs.players[pi];
    const out = [];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      out.push({ id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: h.name });
    }
    return out;
  },

  targetingConfig: {
    description: `Choose one of your Heroes to heal for ${HEAL_AMOUNT} HP.`,
    confirmLabel: `💧 Heal ${HEAL_AMOUNT}`,
    confirmClass: 'btn-success',
    cancellable: true,
    maxTotal: 1,
  },

  validateSelection(selectedIds) { return selectedIds.length === 1; },

  resolve: async (engine, pi, selectedIds) => {
    const id = (selectedIds || [])[0] || '';
    const m = id.match(/^hero-(\d+)-(\d+)$/);
    if (!m) return { keepInHand: false };
    const tpi = parseInt(m[1]);
    const hi = parseInt(m[2]);
    if (tpi !== pi) return { keepInHand: false };

    const hero = engine.gs.players[pi]?.heroes?.[hi];
    if (!hero?.name || hero.hp <= 0) return { keepInHand: false };

    // Heal sparkle on the target hero — same animation Cure / Charme /
    // Ballad Harpyformer / Deepsea Succubus use for any "this card heals
    // a hero" moment. Plays on top of the standard artifact-resolved
    // explosion so the player gets clear visual confirmation that the
    // heal landed on THIS hero, not just that Cobalt resolved.
    engine._broadcastEvent('play_zone_animation', {
      type: 'heal_sparkle', owner: pi, heroIdx: hi, zoneSlot: -1,
    });

    const cobaltSource = { name: CARD_NAME, owner: pi };
    await engine.actionHealHero(cobaltSource, hero, HEAL_AMOUNT);

    return await maybeKeepGemInHand(engine, pi, CARD_NAME);
  },
};
