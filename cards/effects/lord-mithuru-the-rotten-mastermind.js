'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Lord Mithuru, the Rotten Mastermind"  (v1307, neuer Text)
//  Hero — 400 HP, 50 ATK — Decay Magic / Stealth
//
//  "This Hero may perform Double Spells as if their levels were reduced
//   by 2."
//
//  `reduceCardLevel` nur, wenn MITHURU SELBST der Wirker ist (`heroIdx`
//  = Wirker, `inst.heroIdx` = sein Platz). Lebend und nicht negiert.
//  Wirkt auch auf Zuschlaege obendrauf (Iceage +1, Ellie +1): die
//  Engine zieht die Senkung von der erhoehten Stufe ab.
// ═══════════════════════════════════════════
const { istDoppelSpell } = require('./_double-shared');
const { istHeldenTraeger } = require('./_gained-effects-shared');

module.exports = {
  activeIn: ['hero'],
  reduceCardLevel(cardData, engine, ownerIdx, inst, heroIdx) {
    if (!istDoppelSpell(cardData)) return 0;
    // Traeger: eigene Helden-Instanz ODER gewonnener Effekt (Pseudonia & Co.).
    if (!istHeldenTraeger(inst) || heroIdx == null || heroIdx !== inst.heroIdx) return 0;
    const hero = engine.gs.players[inst.owner]?.heroes?.[inst.heroIdx];   // Styx 28.9.: Heldeninstanz = Brettseite
    if (!hero?.name || hero.hp <= 0 || hero.statuses?.negated) return 0;
    return 2;
  },
};
