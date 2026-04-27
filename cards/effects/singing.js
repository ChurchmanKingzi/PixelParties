// ═══════════════════════════════════════════
//  CARD EFFECT: "Singing"
//  Ability — Free activation (Main Phase only)
//
//  Lv1 / Lv2 / Lv3: Once per turn, choose a
//  level X-or-lower Creature your OPPONENT
//  controls and use its active effect as if you
//  controlled it.
//
//  Direct parallel to Charme Lv1 (which borrows
//  an opponent's ABILITY) — same fake-context
//  trick: a shim instance owned by the borrower
//  is handed to the borrowed creature's
//  `onCreatureEffect`, so every "your hand /
//  your discard / your hero / your support"
//  reference inside the effect resolves to the
//  borrower's side. The original creature stays
//  physically on its owner's side and is NOT
//  HOPT-claimed (matches Charme's "use" without
//  spending the opponent's slot — the opponent
//  could in theory still activate it on their
//  turn, but in practice the effect was just
//  resolved this round and there's no value
//  left to extract).
//
//  Filter chain (must all hold for a Creature
//  to be borrowable):
//    • Opponent controls it (`controller ?? owner === oi`).
//    • Face-up (no face-down surprise).
//    • Card-DB level ≤ activation level.
//    • Has `creatureEffect: true` and an
//      `onCreatureEffect` function.
//    • Not silenced by negated / nulled /
//      frozen / stunned counters (mirrors the
//      engine's own "creature effects suppressed"
//      gate at _engine.js:1081).
//    • Not summoning-sick (just-summoned
//      creatures can't HOPT, so they can't be
//      borrowed either).
//    • Borrowed creature's own HOPT not yet
//      claimed for the turn — borrowing a
//      creature that the opponent already
//      activated this turn would double-dip
//      and is explicitly disallowed.
//    • `canActivateCreatureEffect(fakeCtx)` —
//      re-evaluated against the borrower as
//      controller. If the borrower can't
//      satisfy the precondition (e.g. needs
//      something in *their* discard), the
//      creature is dimmed in the picker.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { hasCardType }    = require('./_hooks');

const CARD_NAME = 'Singing';

let _borrowSeq = 0;
function _makeBorrowInst(realInst, borrowerIdx) {
  // The shim instance flips OWNERSHIP fields to the borrower (so
  // `ctx.cardOwner`, `ctx.cardController` resolve to us — making
  // every "your hand / your discard / your hero" reference inside
  // the borrowed effect route to OUR side, matching the card text
  // "use its active effect as if you controlled it") but anchors
  // EVERY position field to the REAL creature's location on the
  // opponent's side. That makes `play_zone_animation` events fired
  // off `ctx.cardHeroOwner` / `ctx.cardHeroIdx` / `ctx.card.zoneSlot`
  // emanate from the BORROWED CREATURE itself — not from the
  // Singing user's hero.
  //
  // `zone: 'borrow'` (a synthetic value) deliberately steers the
  // engine's `_createContext` charm-block away from misidentifying
  // a charmed-borrower-side hero as the resolved host. The block
  // only fires for `'support' | 'ability' | 'hero'` zones, so a
  // synthetic zone leaves `effectiveHeroOwner = inst.heroOwner = oi`
  // (the creature's actual owner) for animation purposes.
  //
  // `counters` is shallow-copied from the real creature so reads
  // like Cute Hydra's `headCounter`, Phoenix's revive flags, etc.
  // see the real values. Mutations on the shim never reach the
  // original creature — borrowed effects don't permanently alter
  // the opponent's instance.
  return {
    id: `singing-borrow-${Date.now()}-${++_borrowSeq}`,
    name: realInst.name,
    owner: borrowerIdx,
    controller: borrowerIdx,
    heroOwner: realInst.owner,
    zone: 'borrow',
    heroIdx: realInst.heroIdx,
    zoneSlot: realInst.zoneSlot,
    counters: { ...(realInst.counters || {}) },
    faceDown: false,
    turnPlayed: -1,
    getHook: () => null,
    isActiveIn: () => true,
  };
}

/**
 * All opponent creatures that pass the borrow filter for the given
 * activation level. Returns objects shaped for the option picker.
 */
function _getBorrowableCreatures(engine, gs, pi, level) {
  const oi = pi === 0 ? 1 : 0;
  const ops = gs.players[oi];
  if (!ops) return [];
  const cardDB = engine._getCardDB();
  const results = [];

  for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
    const host = ops.heroes[hi];
    if (!host?.name) continue;
    for (let zi = 0; zi < (ops.supportZones?.[hi] || []).length; zi++) {
      const slot = (ops.supportZones[hi] || [])[zi] || [];
      if (slot.length === 0) continue;

      const inst = engine.cardInstances.find(c =>
        c.zone === 'support' && c.owner === oi && c.heroIdx === hi && c.zoneSlot === zi
      );
      if (!inst || inst.faceDown) continue;
      if ((inst.controller ?? inst.owner) !== oi) continue; // skip charmed-back / stolen-back

      const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      if (typeof cd.level !== 'number' || cd.level > level) continue;

      const effectName = inst.counters?._effectOverride || inst.name;
      const script = loadCardEffect(effectName);
      if (!script?.creatureEffect || typeof script.onCreatureEffect !== 'function') continue;

      // Effects-suppressed gate (same predicate the engine uses).
      const c = inst.counters || {};
      if (c.negated || c.nulled || c.frozen || c.stunned) continue;

      // Summoning sickness — same rule the standard HOPT path enforces.
      if (inst.turnPlayed === (gs.turn || 0)) continue;

      // Original owner already HOPT'd this creature — no double-dip.
      const hoptKey = `creature-effect:${inst.id}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) continue;

      // Owner-side activation precondition. The borrowed script's
      // `canActivateCreatureEffect` is re-evaluated against the REAL
      // instance — i.e. with `cardOwner` = the creature's actual
      // owner and `cardHeroIdx` = the host hero on the opponent's
      // side. That's the gate the user wanted: "checks THEIR OWNER
      // for those conditions, NOT the Singing user." Cosmic Skeleton
      // (host needs a Spell School Ability) and similar host-condition
      // creatures correctly read the OPPONENT'S host hero here. The
      // controller swap to the borrower happens later, only when the
      // effect actually RUNS — see `onFreeActivate` below.
      let canActivate = true;
      if (script.canActivateCreatureEffect) {
        try {
          const probeCtx = engine._createContext(inst, { event: 'singingBorrowProbe' });
          canActivate = !!script.canActivateCreatureEffect(probeCtx);
        } catch { canActivate = false; }
      }
      if (!canActivate) continue;

      results.push({ inst, script, hostName: host.name, level: cd.level });
    }
  }
  return results;
}

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,
  // Singing only fires during a Main Phase. Borrowing a creature's
  // active effect during the Action Phase would conflate with main
  // actions and break the action-economy bookkeeping (and the user
  // explicitly chose Main-Phase-only).
  actionPhaseEligible: false,

  canFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs     = engine.gs;
    const pi     = ctx.cardOwner;

    const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
    if (!isMainPhase) return false;

    const hero = gs.players[pi]?.heroes?.[ctx.cardHeroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    return _getBorrowableCreatures(engine, gs, pi, level).length > 0;
  },

  async onFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs     = engine.gs;
    const pi     = ctx.cardOwner;
    const hero   = gs.players[pi]?.heroes?.[ctx.cardHeroIdx];
    if (!hero?.name) return false;

    const candidates = _getBorrowableCreatures(engine, gs, pi, level);
    if (candidates.length === 0) return false;

    // ── Direct click: highlight eligible opponent Creatures, click
    // one to commit. `promptEffectTarget` with `autoConfirm: true`
    // skips the Confirm-button step — the first click that fills the
    // single-target slot dispatches `confirm_potion` automatically.
    //
    // The pending card-reveal + play-log slots are STASHED across
    // the click-pick so its auto-confirm doesn't burn them.
    // (`_firePendingCardReveal` runs from every confirmed prompt
    // resolution — without the stash, the player picking a creature
    // would already reveal Singing to the opponent before the
    // borrowed effect gets a chance to cancel.) After the pick, we
    // put them back so the borrowed effect's first confirmed prompt
    // OR the server's end-of-resolve path can fire them — both of
    // which only run when the borrow actually resolves. On full
    // cancellation the server sees `resolved === false` and clears
    // them as part of its standard free-activate rollback (HOPT
    // released, no animation on Singing, no opponent reveal).
    const targets = candidates.map(c => ({
      id: `equip-${c.inst.owner}-${c.inst.heroIdx}-${c.inst.zoneSlot}`,
      type: 'equip',
      owner: c.inst.owner,
      heroIdx: c.inst.heroIdx,
      slotIdx: c.inst.zoneSlot,
      cardName: c.inst.name,
      cardInstance: c.inst,
    }));

    const stashedReveal = gs._pendingCardReveal;
    const stashedLog    = gs._pendingPlayLog;
    gs._pendingCardReveal = null;
    gs._pendingPlayLog    = null;

    let selectedIds;
    try {
      selectedIds = await engine.promptEffectTarget(pi, targets, {
        title: `${hero.name} — Singing Lv${level}`,
        description: "Click an opponent's Creature to use its effect as your own.",
        confirmLabel: 'Confirm',
        cancellable: true,
        maxPerType: { equip: 1 },
        maxTotal: 1,
        minRequired: 1,
        autoConfirm: true,
      });
    } finally {
      gs._pendingCardReveal = stashedReveal;
      gs._pendingPlayLog    = stashedLog;
    }

    if (!selectedIds || selectedIds.length === 0) return false;
    const targetId = selectedIds[0];
    const picked = candidates.find(c =>
      `equip-${c.inst.owner}-${c.inst.heroIdx}-${c.inst.zoneSlot}` === targetId
    );
    if (!picked) return false;

    const { inst: realInst, script } = picked;

    // Defensive re-check — the original creature might have been
    // killed / negated / surprised face-down by something fired in
    // the prompt window (rare but cheap to verify).
    const stillThere = engine.cardInstances.find(c => c.id === realInst.id);
    if (!stillThere || stillThere.zone !== 'support' || stillThere.faceDown) return false;
    const c = stillThere.counters || {};
    if (c.negated || c.nulled || c.frozen || c.stunned) return false;

    engine.log('singing_borrow', {
      player: gs.players[pi].username, hero: hero.name,
      borrowed: realInst.name, level: picked.level,
      from: picked.hostName,
    });

    // ── Run the borrowed effect with the borrower as controller ────
    // The shim instance owned by `pi` but anchored to the REAL
    // creature's position makes every cardOwner-driven read inside
    // the effect (ctx.cardOwner, ctx.attachedHero target side, draw
    // targets, prompt routing, HOPT-key derivations off
    // `ctx.cardOwner`, …) resolve to the BORROWER's side, while
    // animations sourced off `ctx.cardHeroOwner` / `ctx.cardHeroIdx` /
    // `ctx.card.zoneSlot` emanate from the BORROWED CREATURE itself
    // (opponent's board). The real creature is untouched — no
    // HOPT-claim on its instance, no zone shuffle.
    const fakeInst = _makeBorrowInst(realInst, pi);
    const fakeCtx  = engine._createContext(fakeInst, {});
    let result;
    try {
      result = await script.onCreatureEffect(fakeCtx);
    } catch (err) {
      console.error(`[Singing] borrowed onCreatureEffect threw for ${realInst.name}:`, err.message);
      result = false;
    }

    engine.sync();
    // Propagate the borrowed effect's cancel return: when the creature
    // effect returns `false` (player backed out of an internal prompt),
    // Singing's outer wrapper must also return `false` so the server's
    // free-activate handler rolls back — HOPT released, pending
    // card-reveal cleared (opponent doesn't see Singing), no
    // `ability_activated` flash on Singing's slot. Anything truthy /
    // undefined / void counts as "Singing committed" — matches the
    // server's `resolved !== false` convention.
    return result !== false;
  },
};
