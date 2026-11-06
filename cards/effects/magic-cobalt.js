// COST-DISCARD-CHANNEL: n/a in dieser Datei — die Kosten („eine Karte
//   abwerfen, um das Juwel zu behalten") sitzen im geteilten Helfer
//   `_magic-gem-shared.js`, der den Kanal fuer alle sieben Gems
//   bedient (v1041).
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

module.exports = {
  isTargetingArtifact: true,
  activeIn: ['hand'],

  // W16e (F02-08): „a Hero you control" = Kontrolle (`heroesControlledBy`: eigene Spalte ohne abgegebene + uebernommene), IDs = Brettseite.
  canActivate(gs, pi, engine) {
    if (!canPlayMagicGem(gs, pi, CARD_NAME)) return false;
    // At least one of your own heroes must be alive — the heal target
    // doesn't have to be injured (overheal-style cards are valid in
    // this game), but a fully dead board has no legal target.
    if (engine?.heroesControlledBy) return engine.heroesControlledBy(pi).some(({ hero: h }) => h?.name && h.hp > 0);
    const ps = gs.players[pi];
    return (ps?.heroes || []).some(h => h?.name && h.hp > 0);
  },

  getValidTargets(gs, pi, engine) {
    const out = [];
    const helden = engine?.heroesControlledBy
      ? engine.heroesControlledBy(pi)
      : (gs.players[pi]?.heroes || []).map((hero, heroIdx) => ({ physOwner: pi, heroIdx, hero }));
    for (const { physOwner, heroIdx: hi, hero: h } of helden) {
      if (!h?.name || h.hp <= 0) continue;
      out.push({ id: `hero-${physOwner}-${hi}`, type: 'hero', owner: physOwner, heroIdx: hi, cardName: h.name });
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

    const hero = engine.gs.players[tpi]?.heroes?.[hi];
    if (!hero?.name || hero.hp <= 0) return { keepInHand: false };
    if (engine.heroSideOf(tpi, hero) !== pi) return { keepInHand: false };   // W16e: nur ein Held, den ICH kontrolliere

    // Heal sparkle on the target hero — same animation Cure / Charme /
    // Ballad Harpyformer / Deepsea Succubus use for any "this card heals
    // a hero" moment. Plays on top of the standard artifact-resolved
    // explosion so the player gets clear visual confirmation that the
    // heal landed on THIS hero, not just that Cobalt resolved.
    engine._broadcastEvent('play_zone_animation', {
      type: 'heal_sparkle', owner: tpi, heroIdx: hi, zoneSlot: -1,
    });

    const cobaltSource = { name: CARD_NAME, owner: pi };
    await engine.actionHealHero(cobaltSource, hero, HEAL_AMOUNT);

    return await maybeKeepGemInHand(engine, pi, CARD_NAME);
  },
};
