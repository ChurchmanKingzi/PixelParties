// ═══════════════════════════════════════════
//  CARD EFFECT: "Icy Dragonegg"
//  Creature (Normal, Lv0, 1 HP, Destruction Magic + Summoning Magic)
//  Archetype: Drago
//
//  "If you control no Creatures, summoning this counts as an additional
//   Action. When this Creature is defeated during your turn, you may
//   choose any target on the board and Freeze it for 1 turn."
//
//  ★ v1267 (Als Ruling 22.9.): „during your turn\" ist neu — nur ein Tod
//  in der EIGENEN Runde loest aus (etwa per Sacrifice); toetet der Gegner
//  das Ei in seiner Runde, geschieht nichts.
//
//  Beide Saetze legt `_dragonegg-shared.js` aus — dieselbe Stelle wie
//  fuer Flaming Dragonegg. Hier steht nur, was dieses Ei ausmacht: der
//  Status (Freeze fuer 1 Runde) und seine Bilder.
// ═══════════════════════════════════════════

const { eiInherentAction, eiTodesEffekt, eiCpuResponse } = require('./_dragonegg-shared');

const CARD_NAME = 'Icy Dragonegg';

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  spellVisual: {
    impact: { type: 'ice_encase' }, impactMs: 260,
  },

  activeIn: ['support'],

  inherentAction: eiInherentAction,
  cpuResponse: eiCpuResponse,

  hooks: {
    onCreatureDeath: (ctx) => eiTodesEffekt(ctx, CARD_NAME, 'frozen'),
  },
};
