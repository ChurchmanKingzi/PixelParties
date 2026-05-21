// ═══════════════════════════════════════════
//  CARD EFFECT: "Anti-Magnet"
//  Artifact (Reaction, Cost 2)
//
//  EFFECT:
//   "Play this card immediately when a target you
//    control is chosen by an Attack, Spell or
//    Creature effect while you control other
//    possible targets. The Attack/Spell/effect is
//    redirected to a different target of your
//    opponent's choice."
//
//  ── Same trigger plumbing as Challenge / Martyry
//  Anti-Magnet is an `isTargetRedirect` card. The
//  engine's `_checkTargetRedirect` (single-target
//  picker path) scans the targeted player's hand
//  for redirect cards after a target is chosen by
//  an Attack, Spell OR Creature effect, offers the
//  activation confirm, runs `onRedirect`, then
//  consumes the card hand→discard and reveals it.
//  So — exactly like Challenge/Martyry — this
//  script does NOT consume / reveal the card; the
//  engine does. It also handles only single-target
//  picks (the established redirect-system scope;
//  Challenge/Martyry share the same limitation).
//
//  ── Differences from Challenge / Martyry ──
//   • Artifact, Cost 2: the redirect system does
//     NOT auto-deduct gold (Challenge/Martyry are
//     free Spell/Attack reactions). `canRedirect`
//     gates on affordability (gold ≥ 2, not gold-
//     locked); `onRedirect` pays it via
//     `actionSpendGold` only once a new target is
//     locked in. If the spend fails (a goldLock
//     race) we return null → no redirect, the card
//     is NOT consumed (engine: `if
//     (!result?.redirectTo) continue;`).
//   • Redirects ALL THREE source kinds (Attack,
//     Spell, Creature effect) — the resolution
//     wording "Attack/Spell/effect" matches
//     Challenge's "That Attack, Spell or effect is
//     redirected".
//   • New target is "of your opponent's choice":
//     the OPPONENT (the source's controller) picks
//     the replacement, among ANY other valid
//     target of the original effect (either side),
//     excluding the originally-chosen one.
//   • Usable only "while you control other possible
//     targets" — implemented as: there must be ≥1
//     OTHER valid target of the original effect. If
//     the chosen target was the effect's ONLY valid
//     target, Anti-Magnet cannot be used.
//
//  ── Reaction-only (never proactive) ──
//  cards.json subtype is "Reaction" and this script
//  exports NEITHER `proactivePlay` NOR `isReaction`
//  (same contract as Storm Ring, also an Artifact
//  Reaction), so `validateActionPlay` refuses every
//  attempt to click it in hand and the reaction-
//  CHAIN collector skips it. It acts ONLY through
//  the target-redirect hub above.
// ═══════════════════════════════════════════

const CARD_NAME = 'Anti-Magnet';
const GOLD_COST = 2;

/**
 * Other valid targets of the original effect — ANY target except the
 * one that was originally chosen (dedup by id). This is the pool the
 * opponent picks the redirect from, and its non-emptiness is also the
 * "while you control other possible targets" usability gate.
 */
function getOtherValidTargets(selected, validTargets) {
  if (!Array.isArray(validTargets)) return [];
  return validTargets.filter(t => t && t.id !== selected.id);
}

module.exports = {
  // Marks this as a target-redirect card for the engine's redirect
  // scanner (`_checkTargetRedirect`).
  isTargetRedirect: true,

  /**
   * Can Anti-Magnet redirect this targeting event?
   * @param {object} gs
   * @param {number} pi   - Owner of the chosen target (Anti-Magnet's controller)
   * @param {object} selected
   * @param {Array}  validTargets
   * @param {object} config
   * @param {object} engine
   */
  canRedirect(gs, pi, selected, validTargets, config, engine) {
    // Must be a target the Anti-Magnet player controls.
    if (selected.owner !== pi) return false;

    // Cost 2 — must be able to pay (and not gold-locked, e.g. Golden Arrow).
    const ps = gs.players[pi];
    if (!ps || ps.goldLocked || (ps.gold || 0) < GOLD_COST) return false;

    // "while you control other possible targets" → there must be at
    // least one OTHER valid target of the original effect. If the chosen
    // target was the effect's only valid target, Anti-Magnet is unusable.
    return getOtherValidTargets(selected, validTargets).length > 0;
  },

  /**
   * Execute the redirect: opponent picks the new target among all the
   * original effect's other valid targets; pay the 2 gold; chain UI.
   * @returns {{ redirectTo: object }|null}
   */
  onRedirect: async (engine, pi, selected, validTargets, config, sourceCard) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const eligible = getOtherValidTargets(selected, validTargets);
    if (eligible.length === 0) return null;

    // The opponent (the source's controller) chooses the new target.
    const oppIdx = sourceCard?.controller ?? sourceCard?.owner ?? (pi === 0 ? 1 : 0);

    // ── Opponent picks the replacement target ──
    let redirectTarget;
    if (eligible.length === 1) {
      redirectTarget = eligible[0]; // Only one option — auto.
    } else {
      // Stream Anti-Magnet's card image to the opponent (the player
      // about to choose) + spectators as a `card_reveal` overlay BEFORE
      // the pick dialogue, so it's obvious what just happened. The
      // engine's own redirect-card reveal only fires AFTER onRedirect
      // returns — too late for the chooser. Mirrors the Jump in the
      // River reveal pattern.
      const oppSid = gs.players[oppIdx]?.socketId;
      if (oppSid) engine.io.to(oppSid).emit('card_reveal', { cardName: CARD_NAME });
      if (engine.room?.spectators) {
        for (const spec of engine.room.spectators) {
          if (spec.socketId) engine.io.to(spec.socketId).emit('card_reveal', { cardName: CARD_NAME });
        }
      }
      await engine._delay(100);

      const picked = await engine.promptEffectTarget(oppIdx, eligible, {
        title: CARD_NAME,
        description: `Choose where ${sourceCard?.name || 'the effect'} is redirected.`,
        confirmLabel: '🧲 Redirect!',
        confirmClass: 'btn-danger',
        cancellable: false, // Mandatory — "of your opponent's choice".
        exclusiveTypes: true,
        maxPerType: { hero: 1, equip: 1 },
        maxTotal: 1,
        minRequired: 1,
      });
      const id = Array.isArray(picked) ? picked[0] : null;
      redirectTarget = eligible.find(t => t.id === id) || eligible[0];
    }
    if (!redirectTarget) return null;

    // ── Pay the 2 gold (only now that a target is locked in) ──
    const paid = await engine.actionSpendGold(pi, GOLD_COST);
    if (!paid) return null; // goldLock race — no redirect, card not consumed.

    // ── Chain visualization (mirrors Challenge / Martyry) ──
    const attackerName = config.title || sourceCard?.name || 'Effect';
    const srcOwner = sourceCard?.controller ?? sourceCard?.owner ?? oppIdx;
    const srcIsCreature = sourceCard?.zone === 'support';
    const srcCardType = srcIsCreature
      ? 'Creature'
      : (config.damageType === 'attack' ? 'Attack' : 'Spell');
    const chain = [
      {
        id: 'redirect-source',
        cardName: attackerName,
        owner: srcOwner,
        cardType: srcCardType,
        isInitialCard: true,
        negated: false,
        chainClosed: false,
      },
      {
        id: 'redirect-anti-magnet',
        cardName: CARD_NAME,
        owner: pi,
        cardType: 'Artifact',
        isInitialCard: false,
        negated: false,
        chainClosed: false,
      },
    ];
    engine._broadcastChainUpdate(chain);
    await engine._delay(800);
    engine._broadcastEvent('reaction_chain_resolving_start', { chain });
    await engine._delay(400);
    engine._broadcastEvent('reaction_chain_link_resolving', { index: 1, cardName: CARD_NAME });
    await engine._delay(600);
    engine._broadcastEvent('reaction_chain_done', {});

    // ── Repel animation on the original + the new target ──
    engine._broadcastEvent('play_zone_animation', {
      type: 'anger_mark', owner: selected.owner, heroIdx: selected.heroIdx,
      zoneSlot: selected.type === 'hero' ? -1 : (selected.slotIdx ?? -1),
    });
    engine._broadcastEvent('play_zone_animation', {
      type: 'anger_mark', owner: redirectTarget.owner, heroIdx: redirectTarget.heroIdx,
      zoneSlot: redirectTarget.type === 'hero' ? -1 : (redirectTarget.slotIdx ?? -1),
    });
    await engine._delay(600);

    engine.log('anti_magnet', {
      player: ps.username,
      originalTarget: selected.cardName,
      newTarget: redirectTarget.cardName,
      attacker: attackerName,
    });
    engine.sync();

    return { redirectTo: redirectTarget };
  },
};
