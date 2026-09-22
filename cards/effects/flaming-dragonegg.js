// ═══════════════════════════════════════════
//  CARD EFFECT: "Flaming Dragonegg"
//  Creature (Normal, Lv0, Destruction Magic + Summoning Magic)
//  Archetype: Drago — neu in v1267 (Als Auftrag 22.9.)
//
//  "If you control no Creatures, summoning this counts as an additional
//   Action. When this Creature is defeated during your turn, you may
//   choose any target on the board and Burn it."
//
//  Das Feuer-Gegenstueck zu Icy Dragonegg: gleicher Wortlaut, gleiches
//  Ruling (nur ein Tod in der EIGENEN Runde loest aus), anderer Status.
//  Beide Saetze legt `_dragonegg-shared.js` aus. Burn hat keine Dauer
//  und ignoriert Immune (Vorbild Fiery Slime); schon verbrannte Ziele
//  werden nicht angeboten.
// ═══════════════════════════════════════════

const { eiInherentAction, eiTodesEffekt, eiCpuResponse } = require('./_dragonegg-shared');

const CARD_NAME = 'Flaming Dragonegg';

module.exports = {
  // Entkoppelte Bilder (v1182): laufen auch, wenn die Karte negiert wird.
  spellVisual: {
    impact: { type: 'flame_strike' }, impactMs: 260,
  },

  activeIn: ['support'],

  inherentAction: eiInherentAction,
  cpuResponse: eiCpuResponse,

  hooks: {
    onCreatureDeath: (ctx) => eiTodesEffekt(ctx, CARD_NAME, 'burned'),
  },
};
