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
 *  not summoned this turn, or a hand substitute (Chosen Sacrifice)?
 *
 *  Routed through `_collectSacrificeCandidates` (the same collector the
 *  payment path's `resolveSacrificeCost` uses) rather than checking the
 *  board list and `_getHandSacrificeSubstitutes` separately. That kept
 *  the gate and the payment in sync when the substitute rule gained its
 *  "a board Creature must exist" precondition — otherwise this gate
 *  would offer the summon with an empty board and the picker would then
 *  come up empty. */
// ── Sacrifice-Summon: geteiltes Modul ────────────────────────────
// Das Suspicious-Monster-Muster (Drop auf einen BELEGTEN Slot; das
// Opfer raeumt genau den Platz, in den Guardian faellt) liegt jetzt in
// `_teocuilatl-shared.js` und wird von Archer und Warrior of
// Teocuilatl mitbenutzt. Die Funktionen nehmen den Kartennamen als
// letztes Argument; die duennen Huellen hier halten die Aufrufstellen
// unten unveraendert.
const T = require('./_teocuilatl-shared');

const hasTribute          = (engine, pi) => T.hasTribute(engine, pi);
const heroCanSummon       = (engine, pi, hi) => T.heroCanSummon(engine, pi, hi, CARD_NAME);
const findOccupant        = (engine, pi, hi, si) => T.findOccupant(engine, pi, hi, si, CARD_NAME);
const sacrificeableSlots  = (engine, pi) => T.sacrificeableSlots(engine, pi, CARD_NAME);
const sacrificeSummonIntoSlot = (engine, pi, req) => T.sacrificeSummonIntoSlot(engine, pi, req, CARD_NAME);

module.exports = {
  activeIn: ['hand', 'support'],

  // Part 1 — alt summon available while a tribute exists.
  inherentAction(gs, pi, heroIdx, engine) {
    return hasTribute(engine, pi);
  },

  // ── Full-board sacrifice-summon hooks (Suspicious Monster pattern) ──
  // Playable on a full-zoned Hero while THAT Hero owns a sacrificeable
  // Creature — the destination slot is the sacrificed Creature's own, so
  // the sacrifice frees exactly the room Guardian needs.
  canBypassFreeZoneRequirement(gs, pi, heroIdx, cardData, engine) {
    return sacrificeableSlots(engine, pi).some(s => s.heroIdx === heroIdx);
  },
  // Legal drop onto an occupied slot iff its occupant is sacrificeable.
  canPlaceOnOccupiedSlot(gs, pi, heroIdx, slotIdx, engine) {
    return !!findOccupant(engine, pi, heroIdx, slotIdx);
  },
  // Client highlight for the draggable drop targets.
  getBouncePlacementTargets(gs, pi, engine) {
    return sacrificeableSlots(engine, pi).map(s => ({ heroIdx: s.heroIdx, slotIdx: s.slotIdx }));
  },

  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];

    // Drop onto an occupied slot → full-board sacrifice-summon: sacrifice
    // that slot's Creature and install Guardian into the freed slot. This
    // is the additional-Action mode and the ONLY way to summon Guardian
    // while every Support Zone is full. The helper handles placement, hand
    // removal, and the flight; returning its result (true) tells the
    // server the placement is already consumed.
    if (ps?._requestedBouncePlaceSlot) {
      const req = ps._requestedBouncePlaceSlot;
      delete ps._requestedBouncePlaceSlot;
      return await sacrificeSummonIntoSlot(engine, pi, req);
    }
    // A free-slot drop is handled by the normal placement path below — the
    // intent flag is consumed so it can't leak into a later play.
    if (ps?._requestedNormalSummonSlot) delete ps._requestedNormalSummonSlot;

    // Standard (non-inherent) summon — no cost (effect placements etc.).
    if (!ctx.isInherentAction) return true;

    // Free-slot additional-Action summon: pick any tribute (a board
    // Creature not summoned this turn, OR a hand substitute like Chosen
    // Sacrifice); the engine then places Guardian into the chosen slot.
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

  // ── CPU: Confirm-Prompts pauschal bejahen (Barker-Bugklasse) ──────
  // onAreaWouldBeAffected-Confirm (Gegner-Aktion, plan-los).
  // Ohne Intercept declined der Brain-Default cancellable Confirms in
  // plan-losen Kontexten und der Effekt verpufft still. Der generic-
  // Dispatch lädt dieses Skript nur für Prompts mit dem eigenen
  // Kartentitel — Pauschal-Confirm ist damit korrekt gescopet.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
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

      await T.sacrificeSelf(engine, ctx.card, pi);
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
