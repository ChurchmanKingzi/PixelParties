// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian of Teocuilatl"
//  Creature (Summoning Magic Lv1, 100 HP)   Archetype: Doom Clock
//
//  "You may sacrifice a Creature you control that was not summoned this
//   turn to summon this Creature as an additional Action. When an Area
//   would be affected by a card or effect, you may sacrifice this
//   Creature from your hand or side of the board to negate all effects
//   that card or effect would have on that Area."
//
//  ── Part 1: summon-by-sacrifice as additional Action ──
//  The Archer pattern: `inherentAction` is a function gated on an
//  eligible tribute (a Creature NOT summoned this turn, OR a hand
//  substitute like Chosen Sacrifice). While that holds, the engine
//  routes the summon as a free additional Action and `beforeSummon`
//  charges the sacrifice. Cancelling the sacrifice aborts the alt
//  summon (card returns to hand, the Action slot is kept) — the
//  consistent creature-summon behaviour (Archer / Baby Spider).
//
//  ── Part 2: Area protection ──
//  Listens on the engine's `onAreaWouldBeAffected` window (fired before
//  removeArea / removeAllAreas). When one of the CONTROLLER's own Areas
//  would be affected, offer to sacrifice this Guardian — from hand OR
//  the board — to negate the effect on that Area (`ctx.cancel()` aborts
//  the removal). A second Guardian sees the already-cancelled event and
//  stays its hand.
// ═══════════════════════════════════════════

const CARD_NAME = 'Guardian of Teocuilatl';

/** Does `pi` have a tribute for the alt-summon cost — a board Creature
 *  not summoned this turn, or a hand substitute (Chosen Sacrifice)? */
function hasTribute(engine, pi) {
  const turn = engine.gs.turn;
  if (engine.getSacrificableCreatures(pi).some(c => c.inst.turnPlayed !== turn)) return true;
  return (engine._getHandSacrificeSubstitutes?.(pi) || []).length > 0;
}

/** Sacrifice a specific Guardian instance (hand or board): fire the
 *  sacrifice signal + per-turn tally/stamp, then route it to discard. */
async function sacrificeSelf(engine, inst, pi) {
  const ps = engine.gs.players[pi];
  if (ps) ps._creaturesSacrificedThisTurn = (ps._creaturesSacrificedThisTurn || 0) + 1;
  if (!inst.counters) inst.counters = {};
  inst.counters._sacrificedTurn = engine.gs.turn;
  await engine.runHooks('onCreatureSacrificed', {
    creature: inst, cardName: inst.name, owner: inst.owner,
    heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
    source: { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx ?? -1 },
    _skipReactionCheck: true,
  });
  if (inst.zone === 'hand') {
    const hi = (ps?.hand || []).indexOf(inst.name);
    engine._broadcastEvent('play_pile_transfer', {
      owner: inst.owner, cardName: inst.name,
      from: 'hand', to: 'discard', fromHandIdx: hi >= 0 ? hi : 0,
    });
    if (hi >= 0) ps.hand.splice(hi, 1);
    ps.discardPile.push(inst.name);
    inst.zone = 'discard'; inst.heroIdx = -1; inst.zoneSlot = -1;
    engine._untrackCard(inst.id);
  } else {
    await engine.actionDestroyCard(
      { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx }, inst,
    );
  }
}

module.exports = {
  activeIn: ['hand', 'support'],

  // Part 1 — alt summon available while a tribute exists.
  inherentAction(gs, pi, heroIdx, engine) {
    return hasTribute(engine, pi);
  },

  async beforeSummon(ctx) {
    // Standard (non-inherent) summon — no cost.
    if (!ctx.isInherentAction) return true;
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const turn = engine.gs.turn;
    const paid = await engine.resolveSacrificeCost(ctx, {
      minCount: 1,
      maxCount: 1,
      title: `${CARD_NAME} — Sacrifice`,
      description: 'Sacrifice 1 of your Creatures (not summoned this turn) to summon Guardian of Teocuilatl as an additional Action.',
      confirmLabel: '🗡️ Sacrifice!',
      confirmClass: 'btn-danger',
      cancellable: true,
      filter: (c) => c.inst.turnPlayed !== turn,
    });
    // Cancel → abort the alt summon: card returns to hand, Action kept.
    return !!paid;
  },

  hooks: {
    // Part 2 — protect the controller's Areas.
    onAreaWouldBeAffected: async (ctx) => {
      if (ctx.cancelled) return; // already negated by another Guardian
      const engine = ctx._engine;
      const pi = ctx.cardController ?? ctx.cardOwner;
      // Only protect YOUR OWN Areas.
      if (ctx.affectedOwner !== pi) return;

      const ok = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${ctx.source || 'An effect'} would affect your "${ctx.areaName}" Area. Sacrifice ${CARD_NAME} to negate it?`,
        showCard: CARD_NAME,
        confirmLabel: '🛡️ Sacrifice & Protect!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!ok) return;
      // Re-check it hasn't been protected during the prompt.
      if (ctx.cancelled) return;

      await sacrificeSelf(engine, ctx.card, pi);
      ctx.cancel(); // negate the effect on the Area
      engine.log('teocuilatl_protect', {
        player: engine.gs.players[pi]?.username, area: ctx.areaName, from: ctx.source,
      });
      engine.sync();
    },
  },

  cpuMeta: {
    onDeathBenefit: 6,
  },
};
