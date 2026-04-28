// ═══════════════════════════════════════════
//  CARD EFFECT: "Jenny, the Class Fairy"
//  Hero — 300 HP, 30 ATK
//  Starting abilities: Friendship, Magic Arts
//
//  Hero Effect (HOPT, Main Phase):
//  Pick any number of Ability slots from Heroes
//  the controller PERMANENTLY controls (own +
//  not charmed). For each picked slot with 2+
//  copies stacked, the controller chooses how
//  many copies to recall (1..stack). Each
//  recalled copy returns to hand and grants 1
//  draw. After resolving, the controller's hand
//  is locked for the rest of the turn — no more
//  draws or deck-tutoring (`ps.handLocked = true`).
//
//  Implementation
//  ──────────────
//  • Stage 1 — slot picker via `promptEffectTarget`
//    with `type: 'ability'` targets, one per
//    occupied own ability slot. Multi-select via
//    maxPerType / maxTotal set high; minRequired: 0
//    lets the player back out.
//  • Stage 2 — per-slot count picker (only for
//    stacks of size ≥ 2). Single-copy slots auto-
//    recall their lone copy. Lv2/Lv3 stacks fire a
//    `promptGeneric` optionPicker offering 1..N.
//    `cancellable: false` because the slot was
//    already committed in stage 1; the player can
//    still pick "1" to bounce a single copy.
//  • For each picked slot with chosen count K:
//      – Pop the top K copies off
//        ps.abilityZones[hi][si] (LIFO; doesn't
//        matter mathematically since stacked
//        copies are interchangeable).
//      – Untrack the K ability insts that were
//        most recently added at that slot, so
//        cardInstances stays coherent.
//      – Push K copies of the ability name into
//        ps.hand and track each as a new hand
//        inst — same shape any other recover-to-
//        hand path uses.
//  • Draw N cards via `actionDrawCards` (which
//    already gates on `handLocked`, so order
//    matters: draw FIRST, then lock).
//  • `ps.handLocked = true` blocks all draws
//    and `actionAddCardFromDeckToHand` calls
//    for the rest of the turn (cleared on the
//    standard turn-start cleanup pass).
// ═══════════════════════════════════════════

const CARD_NAME = 'Jenny, the Class Fairy';

/** Live own (non-charmed) heroes. "Permanently control" excludes charmed. */
function permanentlyControlledHeroIndices(ps) {
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (h.charmedBy != null) continue;
    out.push(hi);
  }
  return out;
}

/** Build the per-slot target list for the picker. */
function buildAbilityTargets(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const heroIdxs = permanentlyControlledHeroIndices(ps);
  const targets = [];
  for (const hi of heroIdxs) {
    const abZones = ps.abilityZones?.[hi] || [];
    for (let si = 0; si < abZones.length; si++) {
      const slot = abZones[si] || [];
      if (slot.length === 0) continue;
      const baseName = slot[0];
      targets.push({
        id: `ability-${pi}-${hi}-${si}`,
        type: 'ability',
        owner: pi,
        heroIdx: hi,
        slotIdx: si,
        cardName: baseName,
        // Stash for the resolve loop — count of copies in this slot.
        _jennyStackSize: slot.length,
      });
    }
  }
  return targets;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi     = ctx.cardOwner;
    const ps     = engine.gs.players[pi];
    if (!ps) return false;
    // No legal recall target → effect can't fire.
    return buildAbilityTargets(engine, pi).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps      = gs.players[pi];
    const jenny   = ps?.heroes?.[heroIdx];
    if (!ps || !jenny?.name || jenny.hp <= 0) return false;

    const targets = buildAbilityTargets(engine, pi);
    if (targets.length === 0) return false;

    // ── Multi-pick prompt ─────────────────────────────────────────
    // Player clicks any number of own ability slots. minRequired: 0
    // lets the player back out without burning the HOPT (cancellable),
    // while picking ≥ 1 commits the recall + the post-effect lock.
    const selectedIds = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: 'Click any number of your own Ability slots to recall copies to your hand. You will choose how many copies per stack next. Each recalled copy = 1 card draw. Your hand will be LOCKED for the rest of the turn.',
      confirmLabel: '🧚 Recall!',
      confirmClass: 'btn-info',
      cancellable: true,
      exclusiveTypes: false,
      maxPerType: { ability: targets.length },
      maxTotal: targets.length,
      minRequired: 0,
    });
    if (!selectedIds || selectedIds.length === 0) return false;

    // ── Stage 2: per-slot count picker for stacks of size ≥ 2 ─────
    // Singles auto-resolve to count 1. The picker is non-cancellable
    // because the slot was already committed in stage 1; the player
    // can pick the minimum (1) to back off a single copy.
    const slotPlans = [];
    for (const sid of selectedIds) {
      const t = targets.find(x => x.id === sid);
      if (!t) continue;
      const slot = ps.abilityZones?.[t.heroIdx]?.[t.slotIdx] || [];
      if (slot.length === 0) continue;
      const stackSize = slot.length;
      let count = stackSize;
      if (stackSize > 1) {
        const heroName = ps.heroes?.[t.heroIdx]?.name || `Hero ${t.heroIdx + 1}`;
        const options = [];
        for (let n = 1; n <= stackSize; n++) {
          options.push({
            id: String(n), label: `${n} cop${n === 1 ? 'y' : 'ies'}`,
            description: `Recall ${n} of ${stackSize} ${t.cardName} from ${heroName}.`,
            color: '#44aaff',
          });
        }
        const result = await engine.promptGeneric(pi, {
          type: 'optionPicker',
          title: CARD_NAME,
          description: `${t.cardName} on ${heroName} — choose how many copies to recall.`,
          options, cancellable: false,
        });
        const parsed = parseInt(result?.optionId, 10);
        if (Number.isInteger(parsed) && parsed >= 1 && parsed <= stackSize) count = parsed;
        else count = 1; // Defensive default if the picker dismissed unexpectedly.
      }
      slotPlans.push({ heroIdx: t.heroIdx, slotIdx: t.slotIdx, ability: t.cardName, count });
    }

    // ── Recall picked stacks back to hand ─────────────────────────
    let totalRecalled = 0;
    const recallLog = [];
    for (const plan of slotPlans) {
      const slot = ps.abilityZones?.[plan.heroIdx]?.[plan.slotIdx] || [];
      if (slot.length === 0) continue; // Defensive — slot might've been cleared mid-prompt.
      const k = Math.min(plan.count, slot.length);
      if (k <= 0) continue;
      // Pop the top K names (LIFO). Stacked copies are interchangeable.
      const recallNames = slot.splice(slot.length - k, k);
      // Untrack the K most-recent ability insts at this slot before
      // mutating cardInstances (keeps the inst pool coherent).
      const slotInsts = engine.cardInstances
        .filter(c => c.zone === 'ability' && c.owner === pi
                     && c.heroIdx === plan.heroIdx && c.zoneSlot === plan.slotIdx)
        .slice(-k);
      for (const inst of slotInsts) engine._untrackCard(inst.id);
      // If the entire stack was recalled, normalize the slot to [].
      if (slot.length === 0) ps.abilityZones[plan.heroIdx][plan.slotIdx] = [];
      // Push each copy into hand and track a fresh hand inst per copy.
      for (const name of recallNames) {
        ps.hand.push(name);
        engine._trackCard(name, pi, 'hand');
        totalRecalled++;
      }
      recallLog.push({ heroIdx: plan.heroIdx, slotIdx: plan.slotIdx, ability: plan.ability, count: recallNames.length });
    }

    if (totalRecalled === 0) return false;

    engine.log('jenny_recall', {
      player: ps.username, total: totalRecalled, slots: recallLog,
    });
    engine.sync();
    await engine._delay(300);

    // ── Draw equal count BEFORE locking (the lock would gate the draw). ──
    // actionDrawCards animates one-by-one with the engine's standard
    // staggered delay; honors deck-emptiness and any other draw-batch
    // hooks. Skips if `ps.handLocked` is already set (it isn't here
    // since we haven't stamped yet).
    if (totalRecalled > 0) {
      await engine.actionDrawCards(pi, totalRecalled);
    }

    // ── Hand lock for the rest of the turn ────────────────────────
    // The standard turn-start cleanup (engine._engine.js: `ps.handLocked
    // = false`) clears this on the next turn boundary. Until then, all
    // draws (`actionDrawCards`) and tutors (`actionAddCardFromDeck
    // ToHand`) gate on `if (ps.handLocked) return [...]` and silently
    // no-op. Matches the user's spec exactly: "You cannot draw or add
    // cards from your deck to your hand for the rest of the turn".
    ps.handLocked = true;
    engine.log('hand_locked', { player: ps.username, by: CARD_NAME });
    engine.sync();
    return true;
  },
};
