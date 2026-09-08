// ═══════════════════════════════════════════
//  CARD EFFECT: "Bloom, the Maniacal Botanist"
//  Hero — 400 HP / 40 ATK — Biomancy, Inventing
//
//  „Before a Hero with a \"Paraseed\" Creature in its Support Zones
//   takes Poison damage, increase that Poison's damage by 50 times
//   the number of \"Paraseed\" Creatures in its Support Zones.\"
//
//  Bauform
//  ───────
//  Die Aura haengt an `beforeDamage` mit `type === 'poison'` und
//  NICHT an `modifyPoisonDamage`: dieser Hook kennt nur den
//  betroffenen SPIELER, nicht den betroffenen Helden — der Text
//  rechnet aber pro Held ab („its Support Zones\").
//
//  Sie gilt fuer JEDEN Helden auf dem Brett, auch fuer die des
//  Gegners und fuer Bloom selbst: der Text sagt „a Hero\", nicht „a
//  Hero you control\". Genau darauf baut der Aufstieg — Bloom stirbt
//  am eigenen verstaerkten Gift.
// ═══════════════════════════════════════════

const { countParaseedsOnHero } = require('./_paraseed-shared');

const CARD_NAME = 'Bloom, the Maniacal Botanist';
const PRO_PARASEED = 50;   // v718 Balance (Al 4.9.): war 30

module.exports = {
  activeIn: ['hero'],

  cpuMeta: {
    // Reines Passiv ohne Aktivierung — der Wert steckt im Gift.
    dealsDamage: true,
  },

  hooks: {
    beforeDamage: async (ctx) => {
      if (ctx.type !== 'poison') return;
      const engine = ctx._engine;
      const ziel = ctx.target;
      if (!ziel || ziel.hp === undefined) return;   // Creatures haben kein hp-Feld

      // Bloom muss leben, um zu wirken — ein gefallener Held wirkt nicht.
      const selbst = engine.gs.players[ctx.cardHeroOwner]?.heroes?.[ctx.cardHeroIdx];
      if (!selbst?.name || selbst.hp <= 0) return;

      // Welcher Held nimmt gerade Schaden?
      let owner = -1, heroIdx = -1;
      for (let pi = 0; pi < (engine.gs.players || []).length && heroIdx < 0; pi++) {
        const hi = (engine.gs.players[pi]?.heroes || []).indexOf(ziel);
        if (hi >= 0) { owner = pi; heroIdx = hi; }
      }
      if (heroIdx < 0) return;

      const anzahl = countParaseedsOnHero(engine, owner, heroIdx);
      if (anzahl <= 0) return;

      ctx.modifyAmount(PRO_PARASEED * anzahl);
    },
  },
};
