// ═══════════════════════════════════════════
//  CARD EFFECT: "Crimson Web"
//  Spell (Decay Magic Lv3, Surprise)
//
//  "Activate this Surprise when the user is chosen by an Attack or
//   Spell. Negate that Attack/Spell. Then, attach this card to the
//   attacker, if possible. While this card is attached to a Hero,
//   that Hero cannot act and its Abilities are negated. This counts
//   as a negative status effect. You may at any time discard a card
//   to send this card attached to a Hero you control to the discard
//   pile."
//
//  Mechanics
//  ─────────
//   • Trigger: host hero is chosen by an Attack OR Spell (Creature
//     effects do NOT trigger). Source must be an opponent Hero AND the
//     attacker must have a free Support Zone for the attach. If the
//     attacker has no free Support Zone, the Surprise fizzles (goes
//     to discard via normal Surprise cleanup; no lock is applied).
//
//   • Effect: the Surprise card PHYSICALLY MOVES from its owner's
//     Surprise Zone to the attacker's free Support Zone — the same
//     inst is re-anchored, not duplicated. Apply the dedicated
//     `webbed` status to the attacker. `webbed` is cleansable like
//     Stunned but never auto-expires (no `duration`/`permanent: true`
//     opt-in needed — addHeroStatus defaults to permanent when no
//     duration is given for a permanent-default status, and `webbed`
//     ticks neither at turn end nor on any other clock).
//
//   • Coupling: when the host Hero's `webbed` status is removed for
//     ANY reason (cleanse, owner-untangle, …), the attached Crimson
//     Web card is moved to the ORIGINAL OWNER's discard pile.
//
//   • Untangle action: the locked Hero's controller may click the
//     Crimson Web in their Support Zone during their Main Phase. A
//     dialogue asks "Discard 1 card to untangle the Crimson Web?".
//     On confirm, they discard 1 card and the Crimson Web is
//     removed — the card lands in its original owner's discard
//     pile, and the host hero's `webbed` status lifts. Wired via the
//     engine's `equipEffect` path with `bypassHostStatusFilter:
//     true` so the locked Hero's Webbed silence doesn't block the
//     untangle activation (Crimson Web IS the very thing silencing
//     the Hero; without the bypass the lock would be self-locking).
// ═══════════════════════════════════════════

const CARD_NAME = 'Crimson Web';

/** Find a free Support Zone slot index on the given Hero, or -1. */
function findFreeSupportSlot(ps, heroIdx) {
  const zones = ps.supportZones?.[heroIdx] || [[], [], []];
  for (let si = 0; si < 3; si++) {
    if ((zones[si] || []).length === 0) return si;
  }
  return -1;
}

/**
 * Detach Crimson Web from its currently-locked Hero. Removes the
 * `webbed` status, splices the card out of the locked player's
 * Support Zone, and routes the card to its ORIGINAL OWNER's discard
 * pile via a zone-anchored flight animation.
 *
 * Reentrancy-safe: the `_crimsonWebDetaching` flag on the inst
 * prevents the `onStatusRemoved` listener from re-firing this
 * function in response to its own removeHeroStatus call.
 */
async function detachCrimsonWeb(engine, inst, reason) {
  if (!inst || inst.zone !== 'support') return;
  const lockedOwner = inst.counters?._crimsonWebLockedOwner;
  const lockedHeroIdx = inst.counters?._crimsonWebLockedHeroIdx;
  if (lockedOwner == null || lockedHeroIdx == null) return;

  inst.counters = inst.counters || {};
  inst.counters._crimsonWebDetaching = true;

  try {
    // Lift the webbed status first. The script's own onStatusRemoved
    // would otherwise loop back here; the _crimsonWebDetaching flag
    // short-circuits that.
    const lockedPs = engine.gs.players[lockedOwner];
    if (lockedPs?.heroes?.[lockedHeroIdx]?.statuses?.webbed) {
      await engine.removeHeroStatus(lockedOwner, lockedHeroIdx, 'webbed');
    }

    // Send the card to its ORIGINAL OWNER's discard pile. The owner
    // is preserved on inst.owner from the attach step; controller
    // points at the locked player so the card renders on their side
    // until detached.
    const sourceOwner = inst.owner;
    engine._broadcastEvent('play_pile_transfer', {
      owner: sourceOwner, cardName: CARD_NAME,
      fromOwner: lockedOwner, toOwner: sourceOwner,
      from: 'support', to: 'discard',
      fromHeroIdx: lockedHeroIdx, fromSlotIdx: inst.zoneSlot,
    });

    // Splice the card name out of the locked hero's Support Zone.
    const lockedSz = lockedPs?.supportZones?.[lockedHeroIdx];
    if (lockedSz) {
      const slot = lockedSz[inst.zoneSlot] || [];
      const idx = slot.indexOf(CARD_NAME);
      if (idx >= 0) slot.splice(idx, 1);
    }

    // Route to original owner's discard pile.
    engine.gs.players[sourceOwner].discardPile.push(CARD_NAME);
    engine._untrackCard(inst.id);

    engine.log('crimson_web_detached', {
      target: lockedPs?.username,
      hero: lockedPs?.heroes?.[lockedHeroIdx]?.name,
      reason,
    });
    engine.sync();
  } catch (err) {
    console.error('[Crimson Web] detach failed:', err.message);
    delete inst.counters._crimsonWebDetaching;
  }
}

module.exports = {
  isSurprise: true,
  activeIn: ['support'],

  canTelekinesisActivate: false,

  // Skip the engine's default post-resolution discard. The
  // onSurpriseActivate hook below splices the inst out of the
  // Surprise Zone and re-anchors it on the attacker's Support Zone
  // ITSELF — the engine must NOT then also try to splice + discard.
  staysFaceUpOnActivation: true,

  // The "discard 1 to untangle" action must remain clickable while
  // the host Hero is Webbed by this very card — bypass the engine's
  // standard frozen/stunned/webbed gate on equipEffect activation
  // (only Crimson Web opts in; Frozen / Stunned / Webbed still
  // silence every other equip's activation).
  bypassHostStatusFilter: true,
  equipEffect: true,

  /**
   * Trigger: host hero is chosen by an Attack or Spell. Source must
   * be an opp Hero with a free Support Zone (the attach needs
   * somewhere to land — no free slot, no trigger).
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, sourceInfo, engine) => {
    if (!sourceInfo || sourceInfo.owner == null || sourceInfo.owner < 0) return false;
    if (sourceInfo.owner === ownerIdx) return false; // opp source only
    if (sourceInfo.heroIdx == null || sourceInfo.heroIdx < 0) return false;
    const attacker = gs.players[sourceInfo.owner]?.heroes?.[sourceInfo.heroIdx];
    if (!attacker || attacker.hp <= 0) return false;
    // Source must be a Spell or Attack CARD. Demon's Gate-style
    // creature-caster annotation preserves the source name in cardDB
    // so we still read the actual cardType.
    const cardDB = engine._getCardDB();
    const srcName = sourceInfo.cardName || sourceInfo.cardInstance?.name;
    const srcData = srcName ? cardDB[srcName] : null;
    if (!srcData) return false;
    if (srcData.cardType !== 'Spell' && srcData.cardType !== 'Attack') return false;
    // Free Support Zone on the attacker for the attach.
    if (findFreeSupportSlot(gs.players[sourceInfo.owner], sourceInfo.heroIdx) < 0) return false;
    return true;
  },

  /**
   * Activate: move the Surprise inst from its owner's Surprise Zone
   * to the attacker's free Support Zone, apply `webbed` to the
   * attacker hero, and negate the triggering Attack/Spell. With
   * `staysFaceUpOnActivation: true` the engine skips its own
   * post-resolution cleanup, so the splice + re-anchor done here is
   * the authoritative motion. If somehow no free slot is available
   * at resolve time (rare race after surpriseTrigger passed), fall
   * back to a normal discard-and-skip — return null so the engine's
   * default cleanup would have run, but staysFaceUp is already set,
   * so we instead manually discard here.
   */
  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const ownerIdx = ctx.cardOwner;
    const ownerHi = ctx.cardHeroIdx;
    const attackerOwner = sourceInfo.owner;
    const attackerHi = sourceInfo.heroIdx;

    const attackerPs = gs.players[attackerOwner];
    const attackerHero = attackerPs?.heroes?.[attackerHi];
    if (!attackerHero || attackerHero.hp <= 0) return null;

    const freeSlot = findFreeSupportSlot(attackerPs, attackerHi);
    const ownerPs = gs.players[ownerIdx];
    const inst = ctx.card;

    if (freeSlot < 0 || !inst) {
      // No room to attach — Surprise fizzles. Manually splice from
      // the owner's Surprise Zone and discard (mirrors the engine's
      // default cleanup, which `staysFaceUpOnActivation: true`
      // suppresses).
      const sz = ownerPs?.surpriseZones?.[ownerHi];
      if (sz) {
        const idx = sz.indexOf(CARD_NAME);
        if (idx >= 0) sz.splice(idx, 1);
      }
      ownerPs?.discardPile?.push(CARD_NAME);
      if (inst) engine._untrackCard(inst.id);
      engine.log('crimson_web_fizzle', {
        reason: 'no_free_slot_on_attacker',
        player: ownerPs?.username,
      });
      engine.sync();
      return null;
    }

    // Web visual on the attacker before the card lands.
    engine._broadcastEvent('play_zone_animation', {
      type: 'crimson_web', owner: attackerOwner,
      heroIdx: attackerHi, zoneSlot: -1,
    });
    await engine._delay(500);

    // ── Move the Surprise inst from Surprise Zone → attacker's Support Zone ──
    // Splice the card name from the owner's Surprise Zone.
    const sz = ownerPs.surpriseZones?.[ownerHi];
    if (sz) {
      const idx = sz.indexOf(CARD_NAME);
      if (idx >= 0) sz.splice(idx, 1);
    }
    // Push the card name into the attacker's free Support Zone slot.
    if (!attackerPs.supportZones[attackerHi]) attackerPs.supportZones[attackerHi] = [[], [], []];
    attackerPs.supportZones[attackerHi][freeSlot] = [CARD_NAME];

    // Re-anchor the same inst — controller flips to the attacker
    // (so the card renders on their side); owner stays the original
    // caster (so detach routes the card to THEIR discard pile).
    inst.zone = 'support';
    inst.heroIdx = attackerHi;
    inst.zoneSlot = freeSlot;
    inst.controller = attackerOwner;
    inst.faceDown = false;
    inst.counters = inst.counters || {};
    inst.counters._crimsonWebLockedOwner = attackerOwner;
    inst.counters._crimsonWebLockedHeroIdx = attackerHi;

    // Animate the card's flight from Surprise Zone → Support Zone.
    engine._broadcastEvent('play_pile_transfer', {
      owner: ownerIdx, cardName: CARD_NAME,
      fromOwner: ownerIdx, toOwner: attackerOwner,
      from: 'surprise', to: 'support',
      fromHeroIdx: ownerHi,
      toHeroIdx: attackerHi, toSlotIdx: freeSlot,
    });

    // ── Apply the dedicated `webbed` status (permanent) ──
    // `webbed` doesn't auto-tick — no duration, no expiresAtTurn. It
    // persists until cleansed or until the untangle action fires.
    await engine.addHeroStatus(attackerOwner, attackerHi, 'webbed', {
      permanent: true,
      appliedBy: ownerIdx,
    });

    engine.log('crimson_web_attached', {
      caster: gs.players[ownerIdx]?.username,
      victim: attackerPs.username,
      victimHero: attackerHero.name,
    });
    engine.sync();
    await engine._delay(300);

    // Negate the triggering Attack/Spell entirely.
    return { effectNegated: true };
  },

  /**
   * "Click on it for a dialogue asking 'Discard 1 card to untangle
   * the Crimson Web?'". Routed through the engine's equipEffect
   * activation path. The locked Hero's controller is the activator
   * (the inst.controller); `bypassHostStatusFilter: true` ensures
   * the Hero's own Webbed silence doesn't block this click.
   */
  async onEquipEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    const activatorPi = inst.controller ?? inst.owner;
    const ps = gs.players[activatorPi];
    if (!ps) return false;

    const confirmed = await engine.promptGeneric(activatorPi, {
      type: 'confirm',
      title: CARD_NAME,
      message: `Discard 1 card to untangle the ${CARD_NAME}?`,
      showCard: CARD_NAME,
      confirmLabel: '🕸️ Untangle!',
      cancelLabel: 'No',
      cancellable: true,
    });
    if (!confirmed) return false;

    // Pay the discard cost. If the activator's hand is empty,
    // they can't pay — return false (HOPT not consumed).
    if ((ps.hand || []).length === 0) return false;
    await engine.actionPromptForceDiscard(activatorPi, 1, {
      title: CARD_NAME, source: CARD_NAME, selfInflicted: true,
    });

    await detachCrimsonWeb(engine, inst, 'self_freed');
    return true;
  },

  hooks: {
    /**
     * When the locked hero's `webbed` status is removed (cleanse,
     * lift, …), tear the attached Crimson Web off and send it to
     * its original owner's discard pile.
     *
     * Two hook-fire sites publish ON_STATUS_REMOVED:
     *   • `removeHeroStatus` sets BOTH `ctx.status` and an alias
     *     `ctx.statusName` (legacy).
     *   • `cleanseHeroStatuses` (Beer / Juice / Cure / Coffee / Tea
     *     / Waitress / future cleansers) sets ONLY `ctx.status`.
     * `status` is the canonical field per the comment in
     * `removeHeroStatus`; read it and fall back to `statusName` so
     * either firing path triggers the detach.
     */
    onStatusRemoved: async (ctx) => {
      const removedStatus = ctx.status || ctx.statusName;
      if (removedStatus !== 'webbed') return;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      if (inst.counters?._crimsonWebDetaching) return;
      const lockedOwner = inst.counters?._crimsonWebLockedOwner;
      const lockedHeroIdx = inst.counters?._crimsonWebLockedHeroIdx;
      if (lockedOwner == null || lockedHeroIdx == null) return;
      // Hero owner is on the hook context as `heroOwner` (set by both
      // `removeHeroStatus` and `cleanseHeroStatuses`); the hero
      // object itself doesn't carry an `.owner` field. Also verify
      // the hero idx matches — defensive against another hero on
      // the same side losing webbed somehow.
      if (ctx.heroOwner !== lockedOwner) return;
      if (ctx.heroIdx !== lockedHeroIdx) return;
      await detachCrimsonWeb(ctx._engine, inst, 'webbed_removed');
    },

    /**
     * Defensive: if Crimson Web is removed from the Support Zone via
     * some other path (destroy / steal / area purge), lift the
     * locked hero's webbed status so the silence doesn't outlive the
     * attachment.
     */
    onCardLeaveZone: async (ctx) => {
      const inst = ctx.card;
      if (!inst) return;
      if (ctx.fromZone !== 'support') return;
      const lockedOwner = inst.counters?._crimsonWebLockedOwner;
      const lockedHeroIdx = inst.counters?._crimsonWebLockedHeroIdx;
      if (lockedOwner == null || lockedHeroIdx == null) return;
      if (inst.counters?._crimsonWebDetaching) return;
      const engine = ctx._engine;
      const ps = engine.gs.players[lockedOwner];
      if (ps?.heroes?.[lockedHeroIdx]?.statuses?.webbed) {
        inst.counters._crimsonWebDetaching = true;
        try {
          await engine.removeHeroStatus(lockedOwner, lockedHeroIdx, 'webbed');
        } finally {
          delete inst.counters._crimsonWebDetaching;
        }
      }
    },
  },
};
