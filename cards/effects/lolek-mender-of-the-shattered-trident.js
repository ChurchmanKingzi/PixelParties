// ═══════════════════════════════════════════
//  CARD EFFECT: "Lolek, Mender of the Shattered Trident"
//  Ascended Hero — 700 HP / 130 ATK — Ascension bonus: Fighting 3 — BANNED
//
//  "You must play this Hero from your hand on top of a 'Lolek, the
//   Shard Knight' you control that is equipped with 'Shattered
//   Trident, Treasure of the Deepsea' and 'Diver Helmet'. You may once
//   per turn choose an equippable Artifact from your deck or discard
//   pile and equip it to any Hero you control without paying its Cost."
//
//  Aufstieg: Bedingung in `_lolek-shared.js` (der Basisheld pflegt die
//  Bereitschaft ueber seine Zonen-Hooks); Bonus wie Arthor ueber
//  `performAscensionBonus(['Fighting'])`.
//
//  Heldeneffekt (kein Aktionsverbrauch): Galerie ueber Deck UND Discard
//  (je Name+Quelle ein Eintrag), gratis, Zielplatz frei waehlbar —
//  `_lolek-shared.chooseAndEquip` (→ `equipArtifactToHero`, v628).
//  Aus dem Discard gilt die Discard-out-Sperre (Eye of Ren).
// ═══════════════════════════════════════════

const {
  ASCEND_TARGET, equippableEntries, hasDestination, chooseAndEquip, lolekAscensionMet,
} = require('./_lolek-shared');

const CARD_NAME = ASCEND_TARGET;

function entries(engine, pi) {
  return equippableEntries(engine, pi, ['deck', 'discard'], (name) => hasDestination(engine, pi, name));
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  ascensionCondition(gs, pi, heroIdx, engine) {
    return lolekAscensionMet(engine, pi, heroIdx, null);
  },

  async onAscensionBonus(engine, pi, heroIdx) {
    await engine.performAscensionBonus(pi, heroIdx, ['Fighting']);
  },

  supportYield() {
    return { drawsPerTurn: 1 };
  },

  canActivateHeroEffect(ctx) {
    return entries(ctx._engine, ctx.cardOwner).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ok = await chooseAndEquip(engine, pi, entries(engine, pi), {
      title: CARD_NAME,
      source: CARD_NAME,
      description: 'Choose an equippable Artifact from your deck or discard pile and equip it to any Hero you control — for free.',
      confirmLabel: '🔱 Mend!',
    });
    if (ok) engine.sync();
    return ok;
  },
};
