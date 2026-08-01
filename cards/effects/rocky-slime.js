// ═══════════════════════════════════════════
//  CARD EFFECT: "Rocky Slime"
//  Creature (Summoning Magic Lv0, Slimes) — 30 HP.
//
//  When you summon this Creature, choose any
//  Creature in your hand or on the board and
//  permanently reduce its level by 1. At the
//  beginning of each of your turns, you may
//  increase this Creature's level on your side
//  of the board by 1.
//
//  Single-click picker: builds a `validTargets`
//  list mixing `type: 'hand'` entries (one per
//  eligible Creature in hand, identified by
//  handIndex) and `type: 'equip'` entries (one
//  per Creature currently in any Support Zone).
//  `promptEffectTarget` with `maxTotal: 1` +
//  `autoConfirm: true` shows the standard
//  targeting overlay — the client highlights
//  matching hand cards (via the generic
//  hand-target router in app-board.jsx) and
//  matching board zones at the same time. The
//  player clicks once and the pick commits
//  immediately.
//
//  Reduction routes:
//    • BOARD ('equip') target → engine's
//      `actionChangeLevel(inst, -1)` decrements
//      `inst.counters.level` and broadcasts the
//      number popup. The reduction lives with
//      the instance until it hits the discard
//      pile.
//    • HAND ('hand') target → bumps
//      `ps._handLevelOffsets[handIndex]` by -1.
//      The engine's hand-indexed-field registry
//      handles auto-rebase on splice / reorder
//      and carries the offset onto the new
//      support instance when this specific
//      copy is summoned (see registration in
//      `_engine.js` `_registerBuiltinHandIndexedFields`).
//
//  Hard once-per-turn so Reincarnation /
//  Necromancy re-summons can't re-fire.
// ═══════════════════════════════════════════

const { hasCardType, hasNumericCreatureLevel } = require('./_hooks');

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;
      const cardDB = engine._getCardDB();

      // ── Build the unified target list. ────────────────────────────
      const validTargets = [];

      // Hand entries — one per eligible hand index. Indices stay
      // accurate because the prompt is opened synchronously below.
      // Effective-level check: Lv0 creatures (and any creature already
      // reduced to 0) are skipped — the rules text is "reduce its
      // level by 1" with no clear semantics for Lv0 → Lv-1, and a
      // Lv0 target gives no mechanical benefit anyway. We honour any
      // existing offset in `_handLevelOffsets[i]` so a creature
      // already reduced to Lv0 by a prior Rocky activation also
      // drops out of the picker.
      const handOffsets = ps._handLevelOffsets || {};
      for (let i = 0; i < (ps.hand || []).length; i++) {
        const cn = ps.hand[i];
        const cd = cardDB[cn];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        if (!hasNumericCreatureLevel(cd)) continue;
        const effLevel = (cd.level || 0) + (handOffsets[i] || 0);
        if (effLevel <= 0) continue;
        validTargets.push({
          id: `hand-${pi}-${i}`,
          type: 'hand',
          owner: pi,
          handIndex: i,
          cardName: cn,
        });
      }

      // Board entries — every visible Creature instance on either side.
      // Same Lv0 exclusion: a creature whose effective level (base +
      // counters.level delta) is already 0 isn't a legal target.
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if (inst.faceDown) continue;
        const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        if (!hasNumericCreatureLevel(cd)) continue;
        const effLevel = (cd.level || 0) + (inst.counters?.level || 0);
        if (effLevel <= 0) continue;
        validTargets.push({
          id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip',
          owner: inst.owner,
          heroIdx: inst.heroIdx,
          slotIdx: inst.zoneSlot,
          cardName: inst.name,
          cardInstance: inst,
        });
      }

      if (validTargets.length === 0) return; // No legal targets, fizzle silently.

      const picked = await engine.promptEffectTarget(pi, validTargets, {
        title: 'Rocky Slime',
        description: 'Click a Creature in your hand or on the board to permanently reduce its level by 1.',
        confirmLabel: '🪨 Reduce!',
        confirmClass: 'btn-info',
        cancellable: true,
        maxTotal: 1,
        autoConfirm: true,
      });
      if (!picked || picked.length === 0) return;

      const target = validTargets.find(t => t.id === picked[0]);
      if (!target) return;

      if (target.type === 'hand') {
        // Validate the hand index still holds the expected card name —
        // an async window between prompt and resolve could shift state.
        if (ps.hand[target.handIndex] !== target.cardName) return;
        if (!ps._handLevelOffsets) ps._handLevelOffsets = {};
        ps._handLevelOffsets[target.handIndex] = (ps._handLevelOffsets[target.handIndex] || 0) - 1;

        engine.log('rocky_slime_reduce_hand', {
          player: ps.username, card: target.cardName,
          handIndex: target.handIndex, offset: ps._handLevelOffsets[target.handIndex],
        });
        engine.sync();
        return;
      }

      if (target.type === 'equip') {
        const inst = target.cardInstance;
        if (!inst) return;
        // `actionChangeLevel` broadcasts the standard `level_change`
        // number popup; no separate zone animation needed.
        await engine.actionChangeLevel(inst, -1);
        engine.log('rocky_slime_reduce_board', {
          player: ps.username, target: inst.name,
          owner: inst.owner, newLevel: inst.counters.level || 0,
        });
        engine.sync();
      }
    },

    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      await ctx.changeLevel(1);
    },
  },
};
