// ═══════════════════════════════════════════
//  CARD EFFECT: "Chaorc Rider Warg"
//  Creature (Summoning Magic Lv2, 50 HP, subtype Reaction)
//
//  "Immediately summon this Creature from your hand as an additional
//   Action when a Creature you control is defeated by an opponent's
//   card or effect. That Creature is treated as having been sacrificed.
//   When this Creature is removed from the board in any way, you may
//   discard 1 card to have it treated as having been sacrificed."
//
//  There is no built-in reaction-Creature auto-summon, so this is wired
//  hand-trap style:
//
//   • Part A (hand): `onCreatureDeath` — when one of YOUR Creatures is
//     defeated by the OPPONENT (death source owned by the opponent),
//     you may summon Rider Warg from hand as an additional Action. If
//     you do, the defeated Creature is fed back through the sacrifice
//     window via `treatAsSacrificed`, so every Chaorc payoff fires.
//
//   • Part B (support): `onCardLeaveZone` (self, from support) covers
//     "removed from the board in any way" — death, bounce, delete,
//     etc. You may discard 1 card to treat Rider Warg itself as
//     sacrificed. `treatAsSacrificed` only fires `onCreatureSacrificed`
//     (never re-fires death/leave), so there's no loop.
// ═══════════════════════════════════════════

const { treatAsSacrificed } = require('./_chaorcs-shared');

const CARD_NAME = 'Chaorc Rider Warg';

/**
 * Support-Zone slots under Heroes that can legally SUMMON Rider Warg
 * right now. Rider Warg is summoned like a standard summon from hand, so
 * `_canHeroActivateSurprise` applies the full gate: a living, non-
 * Frozen/Stunned Hero that meets Rider Warg's level/school requirement
 * (Summoning Magic Lv2) and has a free Support Zone.
 */
function summonableZones(engine, pi) {
  const ps = engine.gs.players[pi];
  const out = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    if (!engine._canHeroActivateSurprise(pi, hi, CARD_NAME)) continue;
    for (let zi = 0; zi < 3; zi++) {
      if (((ps.supportZones?.[hi] || [])[zi] || []).length === 0) out.push({ heroIdx: hi, slotIdx: zi });
    }
  }
  return out;
}

module.exports = {
  activeIn: ['hand', 'support'],

  hooks: {
    // ── Part A: react to an ally Creature defeated by the opponent. ──
    onCreatureDeath: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardController ?? ctx.cardOwner;
      const death = ctx.creature;
      if (!death) return;

      // The defeated Creature must be one YOU control...
      if ((death.controller ?? death.owner) !== pi) return;
      // ...and defeated by the OPPONENT's card or effect (not your own
      // sacrifice / self-destruct).
      const srcOwner = ctx.source?.owner ?? ctx.source?.controller;
      if (srcOwner == null || srcOwner === pi) return;

      const ps = gs.players[pi];
      if (!ps || !(ps.hand || []).includes(CARD_NAME)) return;
      let zones = summonableZones(engine, pi);
      if (zones.length === 0) return;

      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${death.name} was defeated! Summon ${CARD_NAME} from your hand as an additional Action? (The defeated Creature is treated as having been sacrificed.)`,
        showCard: CARD_NAME,
        confirmLabel: '🐺 Summon!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) return;

      // Re-validate post-prompt.
      if (!(ps.hand || []).includes(CARD_NAME)) return;
      zones = summonableZones(engine, pi);
      if (zones.length === 0) return;

      let dest = zones[0];
      if (zones.length > 1) {
        const pick = await engine.promptGeneric(pi, {
          type: 'zonePick',
          title: CARD_NAME,
          description: `Summon ${CARD_NAME} into which Support Zone?`,
          zones,
          cancellable: true,
        });
        if (!pick || pick.cancelled) return;
        dest = { heroIdx: pick.heroIdx, slotIdx: pick.slotIdx };
      }

      const handIdx = ps.hand.indexOf(CARD_NAME);
      ps.hand.splice(handIdx, 1);
      const res = await engine.summonCreatureWithHooks(
        CARD_NAME, pi, dest.heroIdx, dest.slotIdx, { source: CARD_NAME },
      );
      if (!res?.inst) { ps.hand.push(CARD_NAME); return; }

      // "That Creature is treated as having been sacrificed." Synthesise
      // a sacrifice event for the (already-dead) Creature so the Chaorc
      // payoffs see it. Pass a creature-shaped object built from the
      // death info — the original instance is mid-untrack.
      await treatAsSacrificed(engine, {
        name: death.name, owner: death.owner ?? pi,
        controller: death.controller ?? death.owner ?? pi,
        heroIdx: death.heroIdx, zoneSlot: death.zoneSlot,
      }, pi, CARD_NAME);

      engine.log('rider_warg_summon', { player: ps.username, defeated: death.name });
      engine.sync();
    },

    // ── Part B: Rider Warg removed from the board in any way. ──
    onCardLeaveZone: async (ctx) => {
      if (ctx.leavingCard?.id !== ctx.card.id) return; // self-only
      if (ctx.fromZone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      // If Rider Warg is leaving BECAUSE it was sacrificed, it ALREADY
      // counts as a sacrifice — the "discard 1 to treat its removal as a
      // sacrifice" rider is pointless. The engine stamps `_sacrificedTurn`
      // (in resolveSacrificeCost / treatAsSacrificed) before the destroy
      // fires onCardLeaveZone, so this reliably catches the case.
      if (ctx.card.counters?._sacrificedTurn === gs.turn) return;
      const pi = ctx.card.controller ?? ctx.card.owner;
      const ps = gs.players[pi];
      if (!ps || (ps.hand || []).length === 0) return; // need a card to discard

      const ok = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Discard 1 card to treat ${CARD_NAME} as having been sacrificed?`,
        showCard: CARD_NAME,
        confirmLabel: '🗡️ Discard & Sacrifice!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!ok) return;
      if ((ps.hand || []).length === 0) return;

      // Force-discard ONE chosen card. `ctx.discardCards` just pops the
      // end of the hand with no chooser — use the proper force-discard
      // prompt. `selfInflicted` since it's the player's own optional
      // cost (also lets it run during the opponent's turn).
      await engine.actionPromptForceDiscard(pi, 1, { source: CARD_NAME, selfInflicted: true });
      await treatAsSacrificed(engine, ctx.card, pi, CARD_NAME);
      engine.log('rider_warg_self_sacrifice', { player: ps.username });
      engine.sync();
    },
  },

  cpuMeta: {
    onDeathBenefit: 8,
  },
};
