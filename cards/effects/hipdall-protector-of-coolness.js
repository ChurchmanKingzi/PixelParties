// ═══════════════════════════════════════════
//  CREATURE: "Hipdall, Protector of Coolness"
//  When this Creature is the top of your Coolness
//  Stack, you may summon it as an inherent
//  additional Action from there.
//
//  Once per turn, when a card is removed from your
//  Coolness Stack, you may add it to your hand and
//  place the top of your deck on top of your Stack.
// ═══════════════════════════════════════════

const CARD_NAME = 'Hipdall, Protector of Coolness';
const HOPT_KEY  = 'hipdallRecoverThisTurn';

module.exports = {
  activeIn: ['support', 'coolnessStack'],
  summonableFromCoolnessStack: true,

  /**
   * Resolve the inherent-additional summon from the Coolness Stack.
   * The UI hook on the Stack zone routes the player's confirmation
   * here; we pop the inst, drop it into a chosen support slot, and
   * fire the summon hooks.
   */
  async resolveFromCoolnessStack(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (engine.getCoolnessStackTop(pi) !== CARD_NAME) return { aborted: true, reason: 'not_top' };
    return summonFromStack(engine, pi, CARD_NAME);
  },

  hooks: {
    /**
     * Once per turn, when a card leaves OUR Coolness Stack to anywhere
     * EXCEPT board (i.e. discard, hand, delete), we may instead route
     * it to our hand. Then push top of deck onto the Stack.
     *
     * We listen on onCardLeaveZone — the engine fires it every Stack
     * pop. The naive approach (intercept) is too late; the inst has
     * already moved. Instead we offer a post-hoc "claim it" prompt and
     * apply the redirect by removing from the destination pile/hand
     * and pushing to OUR hand.
     */
    onCardLeaveZone: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      if (ctx.fromZone !== 'coolnessStack') return;
      if (ctx.fromOwner !== ctx.cardOwner) return;
      // Don't redirect Hipdall summoning itself off the Stack —
      // ctx.card.id refers to OUR (the listener's) inst; the leaving
      // inst is on ctx.card too in the LEAVE_ZONE shape, so a self-
      // self equality is the no-op signal.
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;
      // Soft once-per-turn (per Hipdall instance) — two Hipdalls
      // each get their own recovery slot. Pre-check the inst's
      // counter; claim only after the player confirms.
      if (ctx.card?.counters?.[HOPT_KEY] === engine.gs.turn) return;

      const cardName = ctx.cardName;
      const toZone = ctx.toZone;
      // Skip if the target is the board (Glorious Rebirth, Modnir,
      // Swellpnir, Hipdall self-summon, Swagdri self-summon) — those
      // landings are deliberate placements.
      if (!toZone || toZone === 'support' || toZone === 'permanent') return;

      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${cardName} is leaving your Coolness Stack. Add it to your hand and replace it with the top of your deck?`,
        showCard: CARD_NAME,
        confirmLabel: '🛡️ Recover',
        confirmClass: 'btn-success',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) return; // No commit, no HOPT claim.
      // Commit — stamp the inst's HOPT counter now.
      if (!ctx.card.counters) ctx.card.counters = {};
      ctx.card.counters[HOPT_KEY] = engine.gs.turn;

      // Pull the card back out of the destination pile/hand if it landed.
      let recovered = false;
      if (toZone === 'discard') {
        const i = ps.discardPile.lastIndexOf(cardName);
        if (i >= 0) { ps.discardPile.splice(i, 1); recovered = true; }
      } else if (toZone === 'deleted') {
        const i = ps.deletedPile.lastIndexOf(cardName);
        if (i >= 0) { ps.deletedPile.splice(i, 1); recovered = true; }
      } else if (toZone === 'hand') {
        // Already in hand — no-op.
        recovered = true;
      }
      if (!recovered) return;

      if (toZone !== 'hand') {
        ps.hand.push(cardName);
        // Move the leaving inst back to hand. ctx.card on a leave-zone
        // hook is the LISTENING inst (Hipdall itself); the leaving
        // inst is exposed differently — we lookup by name+toZone.
        const inst = engine.cardInstances.find(c => c.owner === pi && c.name === cardName && c.zone === toZone);
        if (inst) inst.zone = 'hand';
        else engine._trackCard(cardName, pi, 'hand');
      }
      engine.log('hipdall_recover', { player: ps.username, card: cardName });

      // Push top of deck onto the Stack.
      await engine.actionPushDeckTopToCoolnessStack(pi, { source: CARD_NAME, requireStack: true });
    },
  },
};

// Shared helper: summon a Creature off the top of the Coolness Stack.
// Used by Hipdall, Wildur, Swagdri (and any future top-of-Stack summon).
//
// Picker UX matches the Stack-equip flow: highlight every eligible
// Hero AND every free Support Zone on those Heroes. Clicking the Hero
// auto-selects the leftmost free slot; clicking a specific empty slot
// places there directly. No popup gallery.
//
// Eligibility:
//   • Hero must be alive (hp > 0).
//   • Frozen / Stunned / Mummified Heroes cannot summon.
//   • Negated Heroes can summon ONLY Lv-0 Creatures (matches the
//     general rule for Negated — only Lv-0 cards bypass).
//   • Hero must have at least one free Support Zone.
async function summonFromStack(engine, pi, cardName) {
  const ps = engine.gs.players[pi];
  if (!ps) return { aborted: true, reason: 'no_player' };
  const cardDB = engine._getCardDB();
  const cd = cardDB[cardName];
  const isLv0 = (cd?.level || 0) === 0;

  const targets = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
    if (hero.statuses?.negated && !isLv0) continue;
    if (engine._isHeroMummified?.(pi, hi)) continue;
    const slots = ps.supportZones?.[hi] || [];
    let leftmostFree = -1;
    for (let si = 0; si < slots.length; si++) {
      if (!slots[si] || slots[si].length === 0) {
        if (leftmostFree < 0) leftmostFree = si;
        targets.push({
          id: `equip-${pi}-${hi}-${si}`,
          type: 'equip',
          owner: pi, heroIdx: hi, slotIdx: si,
          cardName: '',
        });
      }
    }
    if (leftmostFree >= 0) {
      targets.push({
        id: `hero-${pi}-${hi}`,
        type: 'hero',
        owner: pi, heroIdx: hi,
        cardName: hero.name,
        _autoSlot: leftmostFree,
      });
    }
  }
  if (targets.length === 0) return { aborted: true, reason: 'no_legal_target' };

  const pick = await engine.promptEffectTarget(pi, targets, {
    title: cardName,
    description: `Summon ${cardName} from the Coolness Stack — pick a Hero (auto-leftmost-free) or a specific empty Support Zone.`,
    confirmLabel: '✨ Summon',
    confirmClass: 'btn-success',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1, equip: 1 },
  });
  if (!pick || pick.length === 0) return { aborted: true, reason: 'cancelled' };
  const sel = targets.find(t => t.id === pick[0]);
  if (!sel) return { aborted: true, reason: 'invalid_pick' };

  const heroIdx = sel.heroIdx;
  const slotIdx = sel.type === 'hero' ? sel._autoSlot : sel.slotIdx;

  // Fly first (Stack still has card), commit after — see Modnir for
  // the timing rationale.
  const popInst = engine.getCoolnessStackTopInst(pi);
  engine._broadcastEvent('attach_hero_fly', {
    ownerIdx: pi, source: 'coolnessStack', cardName,
    destOwner: pi, destHeroIdx: heroIdx, destZoneSlot: slotIdx,
  });
  await engine._delay(620);

  const popped = await engine.actionPopCoolnessStackTo(pi, 'board', { source: cardName });
  if (!popped) return { aborted: true, reason: 'pop_failed' };
  const placed = engine.safePlaceInSupport(cardName, pi, heroIdx, slotIdx);
  if (!placed?.inst) return { aborted: true, reason: 'placement_failed' };
  placed.inst.zone = 'support';

  engine.sync();
  // Distinct cyan-themed Stack-summon animation — the brass/cyan
  // Coolness palette signals "this Creature came from the Stack",
  // visually separate from a normal hand summon.
  engine._broadcastEvent('play_zone_animation', {
    type: 'coolness_summon',
    owner: pi, heroIdx, zoneSlot: placed.actualSlot,
  });

  await engine.runHooks('onCardLeaveZone', {
    card: popInst, cardName,
    fromZone: 'coolnessStack', fromOwner: pi, toZone: 'support',
  });
  await engine.runHooks('onPlay', {
    _onlyCard: placed.inst,
    playedCard: placed.inst, cardName,
    zone: 'support', heroIdx, zoneSlot: placed.actualSlot,
    _skipReactionCheck: true,
  });
  await engine.runHooks('onCardEnterZone', {
    enteringCard: placed.inst, cardName,
    toZone: 'support', toOwner: pi, toHeroIdx: heroIdx,
    fromZone: 'coolnessStack',
  });
  return { played: true, additionalAction: true };
}

module.exports._summonFromStack = summonFromStack;
