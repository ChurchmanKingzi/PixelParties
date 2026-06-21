// ═══════════════════════════════════════════
//  CARD EFFECT: "Chaorc Corpse Cannibal"
//  Creature (Summoning Magic Lv1, 50 HP)
//
//  "You may immediately summon this Creature from your hand as an
//   additional Action when you sacrifice a Creature you control, but
//   if you do, you must summon it into the same Support Zone that
//   Creature occupied. Once per turn, when you sacrifice a Creature,
//   you may draw 1 card."
//
//  Timing note — `onCreatureSacrificed` fires BEFORE the tribute is
//  destroyed, so the tribute's slot is still occupied at that moment.
//  The "summon into the same Support Zone" clause therefore reacts on
//  the POST-destroy `onCreatureDeath` (slot already freed), recognising
//  the sacrifice via the engine's `inst.counters._sacrificedTurn`
//  stamp (set in `resolveSacrificeCost`). The draw clause has no slot
//  dependency, so it rides the normal `onCreatureSacrificed` window
//  while this card is on the board.
// ═══════════════════════════════════════════

const { isOwnSacrifice } = require('./_chaorcs-shared');

const CARD_NAME = 'Chaorc Corpse Cannibal';

module.exports = {
  activeIn: ['hand', 'support'],

  hooks: {
    // ── Draw clause — board copy, once per turn per instance. ──
    onCreatureSacrificed: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardController ?? ctx.cardOwner;
      if (!isOwnSacrifice(ctx, pi)) return;

      if (!engine.claimHOPT(`corpse_cannibal_draw:${ctx.card.id}`, pi)) return;

      const ps = gs.players[pi];
      const ok = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: 'Draw 1 card?',
        showCard: CARD_NAME,
        confirmLabel: '🃏 Draw!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!ok) {
        // Refund the HOPT — declining keeps it usable on a later
        // sacrifice this turn.
        if (gs.hoptUsed) delete gs.hoptUsed[`corpse_cannibal_draw:${ctx.card.id}:${pi}`];
        return;
      }
      await engine.actionDrawCards(pi, 1);
      engine.log('corpse_cannibal_draw', { player: ps.username });
      engine.sync();
    },

    // ── Same-slot resummon — hand copy, reacts after the destroy. ──
    onCreatureDeath: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardController ?? ctx.cardOwner;
      const death = ctx.creature;
      if (!death?.instId) return;

      // Was this death a SACRIFICE of one of MY Creatures this turn?
      const inst = engine.cardInstances.find(c => c.id === death.instId);
      if (!inst) return;
      if (inst.counters?._sacrificedTurn !== gs.turn) return;
      if ((inst.controller ?? inst.owner) !== pi) return;

      const ps = gs.players[pi];
      if (!ps || !(ps.hand || []).includes(CARD_NAME)) return;

      // The freed slot must be available AND its Hero must actually be
      // able to summon Corpse Cannibal — the SAME gate as a normal summon
      // (alive, not Frozen/Stunned, meets Summoning Magic Lv1, has the
      // free slot). A Hero with too little Summoning Magic shouldn't host
      // it just because a slot opened up under them — and it's specifically
      // THIS slot's Hero that matters, not some other Hero who could
      // summon it. `_canHeroActivateSurprise` is the same full-gate helper
      // Rider Warg's reaction-summon uses.
      const heroIdx = death.heroIdx;
      const slot = death.zoneSlot;
      if (heroIdx == null || slot == null || slot < 0) return;
      if (((ps.supportZones?.[heroIdx] || [])[slot] || []).length !== 0) return;
      if (!engine._canHeroActivateSurprise(pi, heroIdx, CARD_NAME)) return;

      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Summon ${CARD_NAME} from your hand as an additional Action into the sacrificed Creature's Support Zone?`,
        showCard: CARD_NAME,
        confirmLabel: '🍖 Summon!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) return;

      // Re-validate post-prompt (board can shift across the await).
      if (!(ps.hand || []).includes(CARD_NAME)) return;
      if (((ps.supportZones?.[heroIdx] || [])[slot] || []).length !== 0) return;
      if (!engine._canHeroActivateSurprise(pi, heroIdx, CARD_NAME)) return;

      // ── Hand→board summon flight + landing shine. ──
      // Broadcast the flight BEFORE mutating state: the client captures
      // the flying card's source rect at its hand slot (still present)
      // and the destination Support slot, and hides the landing slot for
      // ~700ms so the Creature only "appears" once the flight lands
      // (same path the Deepsea bounce-place swap uses).
      const handIdx = ps.hand.indexOf(CARD_NAME);
      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName: CARD_NAME, from: 'hand', to: 'support',
        fromHandIdx: handIdx, toHeroIdx: heroIdx, toSlotIdx: slot,
      });

      ps.hand.splice(handIdx, 1);
      // Untrack the listener's own hand instance so summoning a fresh
      // tracked instance below doesn't leave an orphan in the hand zone
      // (Cute Bunny pattern).
      if (ctx.card?.zone === 'hand') engine._untrackCard(ctx.card.id);

      // summonCreatureWithHooks places the card and emits the
      // `summon_effect` shine/particles on the destination slot.
      const res = await engine.summonCreatureWithHooks(
        CARD_NAME, pi, heroIdx, slot, { source: CARD_NAME },
      );
      if (!res?.inst) {
        ps.hand.push(CARD_NAME); // placement fizzled — refund
        return;
      }
      engine.log('corpse_cannibal_resummon', {
        player: ps.username, slot: { heroIdx, slot }, replaced: death.name,
      });
      engine.sync();
    },
  },

  cpuMeta: {
    onDeathBenefit: 6,
    // Profits from your sacrifices — draws a card once per turn when you
    // sacrifice your own Creature — so the CPU should value sacrifices
    // happening more highly while it's on the board.
    chainSource: {
      isArmed: (engine, inst) =>
        engine.gs.hoptUsed?.[`corpse_cannibal_draw:${inst.id}:${inst.controller ?? inst.owner}`] !== engine.gs.turn,
      triggersOn: (engine, tributeInst, sourceInst) =>
        tributeInst.id !== sourceInst.id
        && (tributeInst.controller ?? tributeInst.owner) === (sourceInst.controller ?? sourceInst.owner),
      valuePerTrigger: 15,
    },
  },
};
