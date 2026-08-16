// ═══════════════════════════════════════════
//  CARD EFFECT: "Teppes, the Deepsea Vampire"
//  Hero (400 HP, 40 ATK, Necromancy + Necromancy)
//
//  Up to 5 times per turn, when 1 or more cards
//  are added from your Heroes' Support Zones to
//  your hand, draw 1 card. Auto-fires with no
//  dialogue so bounce-heavy Deepsea turns stay
//  uninterrupted.
//
//  Listens to the custom hook
//  `onCardsReturnedToHand` (fired from
//  _deepsea-shared.returnSupportCreatureToHand
//  and Shu'Chaku's artifact bounce) and draws
//  once per event.
// ═══════════════════════════════════════════

const CARD_NAME = 'Teppes, the Deepsea Vampire';
const MAX_DRAWS_PER_TURN = 5;
const { usesLeft, spendUse } = require('./_charges');
const USE_KEY = 'teppesDraw';

module.exports = {
  // Ladungsanzeige am Heldenportrait (Als Vorgabe 16.8.).
  chargesPerTurn: MAX_DRAWS_PER_TURN,
  chargeKey: USE_KEY,
  // H1-Vertrag (Vergleichsanalyse): solange dieser Held lebt, sind
  // Bounce-Platzierungen Wert-Aktionen — Teppes zieht bei Deepsea-Returns nach.
  // Konsumiert von pickCreatureZoneSlot (_cpu.js).
  cpuValuesBounces: true,


  // Zündungs-Mulligan der Deepsea-Linie (Begründung in _deepsea-shared).
  // SM-Ausbau-Floor gegen Lern-Drift (Begründung in _deepsea-shared).
  cpuAbilityPriorFloor(abilityName, targetLevel) {
    const { deepseaAbilityPriorFloor } = require('./_deepsea-shared');
    return deepseaAbilityPriorFloor(abilityName, targetLevel);
  },

  cpuMulliganAdvice(engine, pi, hand) {
    const { deepseaIgnitionMulliganAdvice } = require('./_deepsea-shared');
    return deepseaIgnitionMulliganAdvice(engine, pi, hand);
  },
  activeIn: ['hero'],

  // CPU threat assessment (draw supporter). Up to 5 draws/turn triggered by
  // creature bounces. We don't track per-turn bounce history here; use a
  // flat estimate of 2 triggered draws per turn in a typical Deepsea build.
  supportYield() {
    return { drawsPerTurn: 2 };
  },

  hooks: {
    onCardsReturnedToHand: async (ctx) => {
      if (ctx.ownerIdx !== ctx.cardOriginalOwner) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOriginalOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      // Bis zu 5 je Zug — gemeinsamer Rundenzaehler (v421). Vorher
      // lag der Zaehler flach am Helden und wurde in `_engine.js`
      // beim Rundenbeginn fuer BEIDE Seiten genullt; das war zwar
      // richtig, aber eine Ruecksetzung an einer ganz anderen Stelle
      // als die Zaehlung. Der Stempel erledigt es jetzt hier.
      if (!spendUse(hero, gs, { key: USE_KEY, max: MAX_DRAWS_PER_TURN })) return;

      await engine.actionDrawCards(pi, 1);
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: pi, heroIdx, zoneSlot: -1,
      });
      engine.log('teppes_draw', {
        player: gs.players[pi]?.username,
        drawsThisTurn: MAX_DRAWS_PER_TURN - usesLeft(hero, gs, { key: USE_KEY, max: MAX_DRAWS_PER_TURN }),
      });
      engine.sync();
    },
  },
};
