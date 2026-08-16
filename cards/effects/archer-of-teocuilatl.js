// ═══════════════════════════════════════════
//  CARD EFFECT: "Archer of Teocuilatl"
//  Creature (Normal), Lv1, 50 HP, Summoning Magic
//
//  "You may sacrifice a Creature you control that was
//   not summoned this turn to summon this Creature as
//   an additional Action. When this Creature is
//   summoned, gain 4 Gold. Whenever a Doom Counter is
//   placed onto a 'Doom Clock' during your turn, you
//   may choose a target and deal 50 damage to it."
//
//  Als Ruling (5.8.): der Zaehler-Trigger hat
//  BEWUSST KEIN Once-per-turn — mehrere Salven pro
//  Zug sind gewollt. Er loest bei JEDEM Counter aus,
//  auf welche Uhr auch immer.
// ═══════════════════════════════════════════

const T = require('./_teocuilatl-shared');

const CARD_NAME = 'Archer of Teocuilatl';
const GOLD_GAIN = 4;
const DAMAGE = 50;

module.exports = {
  activeIn: ['hand', 'support'],
  requiresTarget: true,

  inherentAction(gs, pi, heroIdx, engine) {
    return T.hasTribute(engine, pi);
  },
  canBypassFreeZoneRequirement(gs, pi, heroIdx, cardData, engine) {
    return T.sacrificeableSlots(engine, pi, CARD_NAME).some(s => s.heroIdx === heroIdx);
  },
  canPlaceOnOccupiedSlot(gs, pi, heroIdx, slotIdx, engine) {
    return !!T.findOccupant(engine, pi, heroIdx, slotIdx, CARD_NAME);
  },
  getBouncePlacementTargets(gs, pi, engine) {
    return T.sacrificeableSlots(engine, pi, CARD_NAME)
      .map(s => ({ heroIdx: s.heroIdx, slotIdx: s.slotIdx }));
  },

  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (ps?._requestedBouncePlaceSlot) {
      const req = ps._requestedBouncePlaceSlot;
      delete ps._requestedBouncePlaceSlot;
      return await T.sacrificeSummonIntoSlot(engine, pi, req, CARD_NAME);
    }
    if (ps?._requestedNormalSummonSlot) delete ps._requestedNormalSummonSlot;
    if (!ctx.isInherentAction) return true;

    const turn = engine.gs.turn;
    const paid = await engine.resolveSacrificeCost(ctx, {
      minCount: 1, maxCount: 1,
      title: `${CARD_NAME} — Sacrifice`,
      description: 'Sacrifice 1 of your Creatures (not summoned this turn) to summon Archer of Teocuilatl as an additional Action.',
      confirmLabel: '🗡️ Sacrifice!',
      confirmClass: 'btn-danger',
      cancellable: true,
      filter: (c) => c.inst.turnPlayed !== turn,
    });
    return !!paid;
  },

  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {
    // Eigene Beschwoerung erkennen: Muster von Sandy Blob — der Hook
    // feuert fuer JEDE Karte, die eine Zone betritt.
    onCardEnterZone: async (ctx) => {
      const entering = ctx.enteringCard;
      if (!entering || entering.id !== ctx.card?.id) return;
      if (ctx.toZone !== 'support') return;
      if (ctx._isMove) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      // Ueber `actionGainGold` statt roh (Fix 16.8., vom Gold-Prueflauf
      // gefunden). „gain 4 Gold" ist ein GEWINN, und genau 4 ist die
      // Schwelle der Monkee-Ausloeser („When you gain 4 or more Gold
      // through an effect" — Nimble/Resilient Monkee). Der rohe Zuschlag
      // war fuer die unsichtbar, ebenso fuer Golden Arrows Gold-Sperre
      // und das Gold-Trap-Ueberraschungsfenster.
      await engine.actionGainGold(pi, GOLD_GAIN);
      engine.log('archer_teocuilatl_gold', {
        player: engine.gs.players[pi]?.username, amount: GOLD_GAIN,
      });
      engine.sync();
    },

    /**
     * Jeder Doom Counter im EIGENEN Zug bietet einen Schuss an.
     * Kein Once-per-turn (Als Ruling) — bewusst so.
     */
    onDoomCounterPlaced: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      // NUR vom BRETT aus. `activeIn` schliesst die Hand mit ein, also
      // feuerte auch eine Handkopie mit — jeder Counter loeste dadurch
      // einen Trigger zu viel aus (Als Befund 5.8.).
      if (ctx.card?.zone !== 'support') return;
      if (engine.gs.activePlayer !== pi) return;      // "during your turn"

      const ziel = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'creature',
        baseDamage: DAMAGE,
        title: CARD_NAME,
        description: `A Doom Counter was placed — deal ${DAMAGE} damage to a target?`,
        confirmLabel: `🏹 ${DAMAGE} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!ziel) return;

      if (ziel.type === 'hero') {
        const held = engine.gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (held && held.hp > 0) await ctx.dealDamage(held, DAMAGE, 'creature');
      } else if (ziel.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx },
          ziel.cardInstance, DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
      engine.sync();
    },
  },
};
