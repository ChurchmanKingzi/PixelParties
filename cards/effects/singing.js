// ═══════════════════════════════════════════
//  CARD EFFECT: "Singing"
//  Ability — Free activation (Main Phase only)
//
//  Lv1 / Lv2 / Lv3: Once per turn, choose a
//  level X-or-lower Creature your OPPONENT
//  controls and use its active effect as if you
//  controlled it.
//
//  Cute Starlet Megu passive: when this Singing
//  is attached to a Megu Hero, the picker also
//  offers the player's OWN Creatures (same level
//  cap) — selecting one runs that Creature's
//  active effect an "additional time" (the
//  Creature's own HOPT is not consumed and may
//  even already be spent this turn). Standard
//  act-restriction filters (summoning sickness,
//  negation, freeze, stun, face-down) still
//  apply: Singing cannot make a Creature act
//  that couldn't act on its own.
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

      // Borrower-side activation precondition. The probe runs against
      // a borrow-shim of the real instance — `owner`/`controller` flipped
      // to the BORROWER, position fields anchored to the real creature.
      // This makes hand-content gates (Country Harpyformer's "needs
      // Adventurousness in hand", any future "needs X in hand" creature)
      // read the SINGING USER's hand, not the original owner's, matching
      // the wording "use its active effect as if you controlled it" —
      // including the resource pool the effect demands. The actual
      // execution further down also runs against the same shim, so the
      // probe and the run agree on what's playable.
      let canActivate = true;
      if (script.canActivateCreatureEffect) {
        try {
          const probeShim  = _makeBorrowInst(inst, pi);
          const probeCtx   = engine._createContext(probeShim, { event: 'singingBorrowProbe' });
          canActivate = !!script.canActivateCreatureEffect(probeCtx);
        } catch { canActivate = false; }
      }
      if (!canActivate) continue;

      results.push({ inst, script, hostName: host.name, level: cd.level, isOwn: false });
    }
  }
  return results;
}

// Cute Starlet Megu's passive: this Hero's Singing may also be used on
// the player's OWN Creatures, activating their effect an "additional
// time." Same act-restriction filter as the opponent path (summoning
// sickness, negation, freeze, stun, face-down) — Megu cannot make a
// Creature act that couldn't act on its own. The owner-side HOPT-used
// check is intentionally omitted: "additional" means the Creature can
// have already used its own activation this turn and Singing still
// triggers an extra resolution. Singing itself is still HOPT.
function _getOwnSingableCreatures(engine, gs, pi, level) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const results = [];

  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const host = ps.heroes[hi];
    if (!host?.name) continue;
    for (let zi = 0; zi < (ps.supportZones?.[hi] || []).length; zi++) {
      const slot = (ps.supportZones[hi] || [])[zi] || [];
      if (slot.length === 0) continue;

      const inst = engine.cardInstances.find(c =>
        c.zone === 'support' && c.owner === pi && c.heroIdx === hi && c.zoneSlot === zi
      );
      if (!inst || inst.faceDown) continue;
      if ((inst.controller ?? inst.owner) !== pi) continue; // skip stolen-away

      const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      if (typeof cd.level !== 'number' || cd.level > level) continue;

      const effectName = inst.counters?._effectOverride || inst.name;
      const script = loadCardEffect(effectName);
      if (!script?.creatureEffect || typeof script.onCreatureEffect !== 'function') continue;

      const c = inst.counters || {};
      if (c.negated || c.nulled || c.frozen || c.stunned) continue;
      if (inst.turnPlayed === (gs.turn || 0)) continue;

      let canActivate = true;
      if (script.canActivateCreatureEffect) {
        try {
          const probeCtx = engine._createContext(inst, { event: 'meguSingingProbe' });
          canActivate = !!script.canActivateCreatureEffect(probeCtx);
        } catch { canActivate = false; }
      }
      if (!canActivate) continue;

      results.push({ inst, script, hostName: host.name, level: cd.level, isOwn: true });
    }
  }
  return results;
}

function _isMeguHosted(gs, pi, heroIdx) {
  return gs.players[pi]?.heroes?.[heroIdx]?.name === 'Cute Starlet Megu';
}

function _getAllSingableCreatures(engine, gs, pi, heroIdx, level) {
  const opponents = _getBorrowableCreatures(engine, gs, pi, level);
  if (!_isMeguHosted(gs, pi, heroIdx)) return opponents;
  return opponents.concat(_getOwnSingableCreatures(engine, gs, pi, level));
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

    return _getAllSingableCreatures(engine, gs, pi, ctx.cardHeroIdx, level).length > 0;
  },

  async onFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs     = engine.gs;
    const pi     = ctx.cardOwner;
    const hero   = gs.players[pi]?.heroes?.[ctx.cardHeroIdx];
    if (!hero?.name) return false;

    const isMegu     = _isMeguHosted(gs, pi, ctx.cardHeroIdx);
    const candidates = _getAllSingableCreatures(engine, gs, pi, ctx.cardHeroIdx, level);
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
        description: isMegu
          ? "Click any eligible Creature to use its active effect (your own Creatures activate an additional time)."
          : "Click an opponent's Creature to use its effect as your own.",
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

    engine.log(picked.isOwn ? 'singing_megu_own' : 'singing_borrow', {
      player: gs.players[pi].username, hero: hero.name,
      borrowed: realInst.name, level: picked.level,
      from: picked.hostName,
    });

    // ── Visual feedback for the opponent ──────────────────────────
    // The player has now COMMITTED to the borrow (clicked a creature
    // in the picker, no further cancel path). Push the prompt-stashed
    // Singing reveal out to the opponent immediately, then stream the
    // BORROWED creature's card so it's obvious which effect is about
    // to run, and pulse the borrowed creature's support slot so the
    // opponent's eye lands on the actual source on the board (not on
    // the borrower's Singing slot).
    //   • `_firePendingCardReveal` drains the existing queue (reveals
    //     Singing). Idempotent — fine to call even if nothing's queued.
    //   • Then queue the borrowed creature's reveal so the borrowed
    //     effect's first confirmed prompt (or the post-resolve fire
    //     below) can pop the card image.
    //   • `summon_effect` re-uses the existing yellow-glow flash the
    //     client renders on a support slot — same visual the engine
    //     already plays when a creature is summoned, repurposed here
    //     to mean "this creature is the source of an effect".
    engine._firePendingCardReveal();
    gs._pendingCardReveal = { cardName: realInst.name, ownerIdx: pi };
    gs._pendingPlayLog = {
      type: 'singing_borrowed_creature_activated',
      data: {
        player: gs.players[pi].username,
        card: realInst.name,
        hero: picked.hostName,
      },
    };
    engine._broadcastEvent('summon_effect', {
      owner: realInst.owner,
      heroIdx: realInst.heroIdx,
      zoneSlot: realInst.zoneSlot,
      cardName: realInst.name,
    });
    await engine._delay(200);

    // ── Run the effect ─────────────────────────────────────────────
    // Megu's own-creature path runs against the REAL instance — the
    // creature already belongs to us, so context fields (cardOwner,
    // cardController, cardHeroIdx) resolve correctly on first principles
    // and the effect's own counter mutations land on the live card
    // (Cute Hydra heads, etc.). The standard `creature-effect:${id}`
    // HOPT key is left untouched: "additional time" means Singing's
    // resolution does not consume the Creature's own once-per-turn
    // activation — Singing itself is still HOPT for the Singing slot.
    //
    // Opponent path uses the borrow-shim: ownership flipped to the
    // borrower so cardOwner-driven reads route to OUR side, while
    // animation fields stay anchored to the opponent's board. The
    // real creature is untouched — no HOPT-claim on its instance, no
    // zone shuffle.
    let result;
    if (picked.isOwn) {
      const realCtx = engine._createContext(realInst, {});
      try {
        result = await script.onCreatureEffect(realCtx);
      } catch (err) {
        console.error(`[Singing/Megu] own onCreatureEffect threw for ${realInst.name}:`, err.message);
        result = false;
      }
    } else {
      const fakeInst = _makeBorrowInst(realInst, pi);
      const fakeCtx  = engine._createContext(fakeInst, {});
      try {
        result = await script.onCreatureEffect(fakeCtx);
      } catch (err) {
        console.error(`[Singing] borrowed onCreatureEffect threw for ${realInst.name}:`, err.message);
        result = false;
      }
    }

    engine.sync();
    // Final flush: if the borrowed effect didn't raise any prompts
    // (passive / trigger-only effects), the queued borrowed-creature
    // card_reveal would otherwise stay pending until something else
    // pops the queue. Drain it now so the opponent reliably sees the
    // borrowed creature regardless of the effect's prompt shape.
    // Idempotent — no-op if already fired by a prompt resolution.
    engine._firePendingCardReveal();
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
