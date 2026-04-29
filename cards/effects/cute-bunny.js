// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Bunny"
//  Creature (Summoning Magic Lv 0, 20 HP — Cute archetype)
//
//  Two effects, both triggered by a "2+ cards
//  leaving the controller's hand at the same
//  time" event:
//
//  1. HAND-SUMMON (while Bunny is in HAND) —
//     when 2+ cards leave the controller's hand
//     in a single batch, Bunny may immediately
//     summon herself from hand as an additional
//     Action.
//
//  2. DRAW-ON-BATCH (while Bunny is in SUPPORT)
//     — same trigger condition, BUT only when
//     the batch was driven "through an effect":
//     draw 1 card. The engine's
//     `onForcedDiscardBatchEnd` hook is fired
//     ONLY by `actionPromptForceDiscard` (which
//     covers all card-driven cost / effect
//     discards) and NOT by `enforceHandLimit`
//     (which is the rule-driven hand cleanup),
//     so the "through an effect" qualifier maps
//     cleanly to "this hook fired".
//
//  Wiring notes:
//    • Engine carries the per-batch and per-
//      player discard count via `ctx.count` and
//      `ctx.countByPlayer` on `onForcedDiscardBatchEnd`
//      (added to actionPromptForceDiscard).
//    • Bunny listens active-in `['hand', 'support']`
//      and dispatches by `ctx.card.zone`.
//    • Multiple Bunnies in hand each prompt to
//      summon; multiple Bunnies in support each
//      draw 1. Per-card effect — no global cap.
//    • If Bunny was one of the discarded cards
//      (now in discard, not hand), her hand
//      listener is no longer active, so she
//      doesn't try to summon from a discard
//      she's already in.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cute Bunny';
const BATCH_THRESHOLD = 2;

// ─── HELPERS ─────────────────────────────

/**
 * Heroes that can host a fresh Cute Bunny summon RIGHT NOW. Same
 * shape as the helper in cute-dog.js — alive, not Frozen / Stunned,
 * has a free Support slot, meets the Lv0 Summoning Magic requirement
 * (which every Hero trivially passes), controller not summon-locked.
 */
function getHostHeroes(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  if (ps.summonLocked) return [];
  const cardDB = engine._getCardDB();
  const cd = cardDB[CARD_NAME];
  if (!cd) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.frozen || h.statuses?.stunned) continue;
    const supZones = ps.supportZones?.[hi] || [];
    if (!supZones.some(slot => (slot || []).length === 0)) continue;
    if (!engine.heroMeetsLevelReq(pi, hi, cd)) continue;
    out.push(hi);
  }
  return out;
}

// ─── CARD MODULE ─────────────────────────

module.exports = {
  // 'hand' — listens for the batch-end hook to offer the hand-summon.
  // 'support' — same hook fires the draw-1 effect once Bunny is on field.
  activeIn: ['hand', 'support'],

  hooks: {
    onForcedDiscardBatchEnd: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;

      // Only react when MY hand contributed ≥ BATCH_THRESHOLD cards
      // to this batch. Use the per-player count when available so
      // nested batches across players don't false-trigger.
      const myCount = (ctx.countByPlayer && typeof ctx.countByPlayer[pi] === 'number')
        ? ctx.countByPlayer[pi]
        : (ctx.playerIdx === pi ? (ctx.count || 0) : 0);
      if (myCount < BATCH_THRESHOLD) return;

      const zone = ctx.card?.zone;

      // ── Effect 2: while in support, draw 1 ───────────────────────
      // No cancel option — passive draw. The "through an effect"
      // qualifier is satisfied by the hook's existence (engine
      // doesn't fire it for hand-limit cleanups).
      if (zone === 'support') {
        await ctx.drawCards(pi, 1);
        engine.log('cute_bunny_draw', { player: ps.username, batchCount: myCount });
        engine.sync();
        return;
      }

      // ── Effect 1: while in hand, may summon from hand ────────────
      if (zone !== 'hand') return;

      // Bunny must still be in our hand (i.e., we weren't one of the
      // discarded cards). The activeIn filter usually catches this —
      // a discarded Bunny's instance has zone='discard' and wouldn't
      // pass the listener filter — but defend against race conditions.
      if (!(ps.hand || []).includes(CARD_NAME)) return;

      const hosts = getHostHeroes(engine, pi);
      if (hosts.length === 0) return;

      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Summon ${CARD_NAME} from your hand as an additional Action?`,
        confirmLabel: '🐰 Summon!',
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true, // True "you may" — opt-in summon.
      });
      if (!confirmed) return;

      // Pick destination zone
      const zones = [];
      for (const hi of hosts) {
        const sup = ps.supportZones?.[hi] || [];
        for (let s = 0; s < 3; s++) {
          if ((sup[s] || []).length === 0) {
            zones.push({ heroIdx: hi, slotIdx: s, label: `${ps.heroes[hi].name} — Support ${s + 1}` });
          }
        }
      }
      if (zones.length === 0) return;

      let chosen;
      if (zones.length === 1) {
        chosen = zones[0];
      } else {
        const picked = await engine.promptGeneric(pi, {
          type: 'zonePick',
          zones,
          title: CARD_NAME,
          description: `Choose a Support Zone to summon ${CARD_NAME} into.`,
          cancellable: true,
        });
        if (!picked || picked.cancelled) return;
        chosen = zones.find(z => z.heroIdx === picked.heroIdx && z.slotIdx === picked.slotIdx) || zones[0];
      }

      // Pop one Bunny copy from hand & untrack the listener instance
      // so we don't leave an orphan in the hand zone after summoning
      // a fresh tracked instance into support.
      const handIdx = ps.hand.indexOf(CARD_NAME);
      if (handIdx < 0) return;
      ps.hand.splice(handIdx, 1);

      const oldInst = ctx.card;
      if (oldInst && oldInst.zone === 'hand') {
        engine._untrackCard(oldInst.id);
      }

      await engine.summonCreatureWithHooks(
        CARD_NAME, pi, chosen.heroIdx, chosen.slotIdx,
        { source: CARD_NAME }
      );

      engine.log('cute_bunny_hand_summon', {
        player: ps.username, heroIdx: chosen.heroIdx, batchCount: myCount,
      });
      engine.sync();
    },
  },
};
