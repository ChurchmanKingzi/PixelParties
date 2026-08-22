// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Laser Cannon"
//  Artifact (Equipment, Cost 60)
//
//  "This card's Cost is decreased by 20 for every copy of \"Future Tech
//   Laser Cannon\" in your discard pile. Equip this card to a Hero you
//   control. That Hero's Attack stat is increased by 100."
//
//  ── Die teuerste Karte des Archetyps, und die billigste ──
//  60 Gold sind unbezahlbar; mit drei Kopien in der Ablage kostet sie
//  nichts. Das ist der Archetyp in Reinform: erst entsorgen, dann
//  ernten. Und wie ueberall zaehlt sie sich nicht selbst mit (Als
//  Ruling 21.8.) — sie liegt beim Bezahlen ja in der Hand.
//
//  ── Der Preis: neuer Vertrag `selfCostReduction` (v541) ──
//  `dynamicCost` waere das Naheliegende, aber den liest der Server NUR
//  bei REAKTIONEN — fuer ein normales Artefakt lief er ins Leere.
//  Deshalb ein eigener, additiver Vertrag:
//  `selfCostReduction(gs, pi, cardData, engine) → number`.
//  Er wird an DREI Stellen gelesen: in den beiden Kostenrechnungen des
//  Servers und in der Zustandsauslieferung fuer die Anzeige — sonst
//  stuende in der Hand 60, waehrend der Server 20 nimmt, und die
//  Oberflaeche wuerde die Karte faelschlich ausgrauen.
//
//  ── Der Zuschlag: fest, nicht skalierend ──
//  +100 Attack, solange sie ausgeruestet ist. Anders als beim Future
//  Tech Gun (40 je Kopie) haengt der Bonus NICHT an der Ablage — nur
//  der Preis tut das. Nachgerechnet wird trotzdem an denselben Hooks:
//  das Verfahren ist idempotent und deckt Puzzle-Vorbelegungen mit ab.
// ═══════════════════════════════════════════

const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Laser Cannon';
const ATK_BONUS = 100;
const RABATT_JE_KOPIE = 20;

/** Zuschlag setzen/zuruecknehmen. Idempotent — ohne Aenderung ein No-op. */
function zuschlagNachrechnen(ctx) {
  const engine = ctx._engine;
  const inst = ctx.card;
  if (!inst || inst.zone !== 'support') return;

  const owner = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;
  const hero = engine.gs.players[owner]?.heroes?.[heroIdx];
  if (!hero?.name) return;

  if (!inst.counters) inst.counters = {};
  const bisher = inst.counters.atkGranted || 0;
  const delta = ATK_BONUS - bisher;
  if (delta === 0) return;

  engine._applyHeroAtkDelta(hero, owner, heroIdx, delta);
  inst.counters.atkGranted = ATK_BONUS;
  engine.log('ft_laser_cannon_atk', { hero: hero.name, bonus: ATK_BONUS, delta });
  engine.sync();
}

module.exports = {
  activeIn: ['support'],

  /**
   * −20 je Kopie in der Ablage. Der Server deckelt den Endpreis bei 0,
   * hier wird bewusst NICHT gedeckelt: so bleibt die Zahl ehrlich,
   * falls ein anderer Rabatt danebensteht.
   */
  selfCostReduction(gs, pi /*, cardData, engine */) {
    return RABATT_JE_KOPIE * zaehleInAblage(gs, pi, CARD_NAME);
  },

  hooks: {
    onPlay: (ctx) => zuschlagNachrechnen(ctx),
    onGameStart: (ctx) => zuschlagNachrechnen(ctx),
  },
};
