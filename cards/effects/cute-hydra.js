// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Hydra"
//  Creature (Decay Magic + Summoning Magic Lv 5,
//  150 HP — Cute archetype, currently BANNED).
//
//  Four effects:
//
//  1. DELETE-RESCUE — "if would be deleted from
//     anywhere": implemented through the engine's
//     universal `beforeDelete(ctx)` callback.
//     The engine fires it from EVERY delete path
//     (mill-to-deleted, forced-discard with
//     deleteMode, hand-limit with deleteMode,
//     actionMoveCard to deleted) BEFORE the
//     destination push, giving Hydra a single
//     interception point regardless of where the
//     card lived. On rescue, Hydra summons a
//     fresh copy to the chosen Support Zone and
//     sets `ctx.rescued = true` so the engine
//     skips the actual deletion.
//
//  2. HEAD COUNTERS ON SUMMON — when summoned,
//     the player discards 2+ cards by clicking
//     them directly in their hand: each click
//     immediately commits a discard. After the
//     first 2 mandatory discards, a "Done"
//     button appears so the player can stop. The
//     last card auto-ends the prompt. Hydra
//     gains 1 Head Counter per discarded card.
//
//  HARD GATE — Hydra's `canSummon` REFUSES to
//  let the engine surface her as playable when
//  the controller has fewer than 2 OTHER cards
//  in hand (counting non-Hydra hand cards), since
//  she demands 2+ discards on entry. With Hydra
//  herself in hand, that means hand size ≥ 3
//  before the summon path is even offered.
//  Tutored summons (Hydra not in hand at decision
//  time) require hand size ≥ 2.
//
//  3. HOPT MULTI-TARGET DAMAGE — once per turn,
//     pick up to `headCounter` different targets
//     (heroes or creatures, any side) and deal
//     100 damage to each.
//
//  4. DEFEAT → DELETE — when Hydra dies, route
//     her from discard pile to deleted pile.
//     Listener fires AFTER the death moves her
//     into discardPile, so we splice and re-push.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cute Hydra';
const RESCUE_HAND_THRESHOLD = 3;
const SUMMON_DISCARD_MIN = 2;
const HOPT_DAMAGE = 100;

// ─── HELPERS ─────────────────────────────

/**
 * Heroes that can host a fresh Cute Hydra summon RIGHT NOW. Standard
 * gate plus the spell-school / Lv5 level requirement (handled
 * generically via `engine.heroMeetsLevelReq`).
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
    const sup = ps.supportZones?.[hi] || [];
    if (!sup.some(slot => (slot || []).length === 0)) continue;
    if (!engine.heroMeetsLevelReq(pi, hi, cd)) continue;
    out.push(hi);
  }
  return out;
}

// ─── CARD MODULE ─────────────────────────

module.exports = {
  // 'support' — HOPT effect, counter storage, defeat-redirect listener.
  // The delete-rescue (#1) does NOT go through `activeIn` filtering —
  // the engine calls `beforeDelete(ctx)` as a top-level script export
  // for any card name about to hit a deletedPile, regardless of
  // whether that card has a tracked instance anywhere.
  activeIn: ['support'],

  // ── CPU prompt overrides ──────────────────────────────────────────
  // Three Hydra-titled prompts route through here:
  //   • `confirm` "🐉 Summon!" (delete-rescue) — engine default would
  //     decline cancellable confirms, so override to confirm. Cost is
  //     the standard hand-discards fired via `onPlay` after the
  //     summon, which the brain answers (least-bad pick) below.
  //   • `forceDiscard` (mandatory iterations 1, 2 of the head-counter
  //     loop) — defer to default (least-bad scoring).
  //   • `forceDiscardCancellable` (iterations 3+) — STOP when current
  //     Head Counter count already saturates the viable enemy target
  //     pool. Each Head Counter past `viableTargets` is wasted (the
  //     HOPT caps at "different targets" = headCounter), so the brain
  //     should click "Done" instead of burning more hand cards. Below
  //     that cap, defer to default — the per-card value scorer still
  //     auto-protects too-precious singletons.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    const type = promptData?.type;

    // Delete-rescue confirm — always summon. Default declines.
    if (type === 'confirm' && /Summon/i.test(promptData.confirmLabel || '')) {
      return { confirmed: true };
    }

    // Mandatory click-to-discard: pick least-bad (default handler).
    if (type === 'forceDiscard') return undefined;

    // Cancellable click-to-discard (post-min): pick "Done" once the
    // Head Counter count saturates viable enemy targets; otherwise
    // defer to default so the brain keeps loading Hydra against
    // bigger boards while the cards being discarded are cheap.
    if (type === 'forceDiscardCancellable') {
      const cpuIdx = engine._cpuPlayerIdx;
      const oppIdx = cpuIdx === 0 ? 1 : 0;
      const opp = engine.gs.players[oppIdx];
      if (!opp) return undefined;

      let viableTargets = 0;
      for (const h of (opp.heroes || [])) {
        if (h?.name && h.hp > 0) viableTargets++;
      }
      for (let hi = 0; hi < (opp.heroes || []).length; hi++) {
        for (let z = 0; z < 3; z++) {
          const slot = opp.supportZones?.[hi]?.[z] || [];
          if (slot.length > 0) viableTargets++;
        }
      }

      const currentHeads = promptData.currentDiscardCount || 0;
      // The ABOUT-TO-BE-discarded card would push the Head count to
      // `currentHeads + 1`. If `currentHeads` already meets / exceeds
      // viableTargets, that next discard buys nothing — click Done.
      if (currentHeads >= viableTargets) return { cancelled: true };
      return undefined; // let the default least-bad picker continue
    }

    return undefined;
  },

  // ── HARD SUMMON GATE ───────────────────────────────────────────
  // Hydra demands 2+ discards on entry. If the controller can't
  // afford that — i.e. the would-be hand AFTER Hydra leaves wouldn't
  // contain at least 2 cards — refuse the summon outright. The engine
  // checks this before surfacing Hydra as a playable Creature:
  //   • From-hand path: needs hand ≥ 3 (2 others + Hydra herself).
  //   • Tutor / placement path: needs hand ≥ 2 (Hydra isn't in hand).
  canSummon(ctx) {
    const ps = ctx._engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    const hand = ps.hand || [];
    // If Hydra is in hand, she'll leave on summon — the discardable
    // pool is hand minus 1. If she's elsewhere (deck-tutor, etc.),
    // hand is the discardable pool as-is.
    const hydraInHand = hand.includes(CARD_NAME);
    const discardablePool = hydraInHand ? hand.length - 1 : hand.length;
    return discardablePool >= SUMMON_DISCARD_MIN;
  },

  // ── 1. DELETE-RESCUE (universal) ───────────────────────────────
  // Engine entrypoint: `engine._tryBeforeDelete(...)`. Fires from
  // every delete path between source-zone removal and the deletedPile
  // push. By this point the card is already out of its old zone (or
  // has had its support-zone slot cleared), so a successful rescue
  // just needs to summon a fresh copy and untrack the orphan.
  async beforeDelete(ctx) {
    const engine = ctx._engine;
    const pi     = ctx.cardOwner;
    const ps     = engine.gs.players[pi];
    if (!ps) return;

    // Two preconditions on the controller side: 3+ cards in hand AND
    // at least one Hero who can host a fresh Lv5 Cute Hydra summon
    // RIGHT NOW (alive, not Frozen/Stunned, free Support slot, meets
    // school + level requirements; controller not summon-locked).
    if ((ps.hand || []).length < RESCUE_HAND_THRESHOLD) return;
    const hosts = getHostHeroes(engine, pi);
    if (hosts.length === 0) return;

    const confirmed = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      message: `${CARD_NAME} would be deleted from ${ctx.fromZone || 'play'}! Summon her as an additional Action instead?`,
      confirmLabel: '🐉 Summon!',
      cancelLabel: 'No',
      cancellable: true,
    });
    if (!confirmed) return; // ctx.rescued stays false → deletion proceeds

    // Pick destination Support Zone.
    const zones = [];
    for (const hi of hosts) {
      const sup = ps.supportZones?.[hi] || [];
      for (let s = 0; s < 3; s++) {
        if ((sup[s] || []).length === 0) {
          zones.push({ heroIdx: hi, slotIdx: s, label: `${ps.heroes[hi].name} — Support ${s + 1}` });
        }
      }
    }
    if (zones.length === 0) return; // unreachable (host check passed) but safe

    let chosen;
    if (zones.length === 1) {
      chosen = zones[0];
    } else {
      const picked = await engine.promptGeneric(pi, {
        type: 'zonePick',
        zones,
        title: CARD_NAME,
        description: `Choose a Support Zone to summon ${CARD_NAME} into.`,
        cancellable: false,
      });
      chosen = zones.find(z => z.heroIdx === picked?.heroIdx && z.slotIdx === picked?.slotIdx) || zones[0];
    }

    // Untrack the orphaned source instance (if any). For hand-deletes
    // this is the in-hand instance; for board-moves it's the support
    // instance; for deck-mills it's null.
    if (ctx.fromInstance) {
      engine._untrackCard(ctx.fromInstance.id);
    }

    // Summon a fresh Hydra. summonCreatureWithHooks → onPlay → effect
    // #2 (head counter setup with a fresh discard prompt).
    await engine.summonCreatureWithHooks(
      CARD_NAME, pi, chosen.heroIdx, chosen.slotIdx,
      { source: CARD_NAME }
    );

    // Stamp the rescue flag — engine reads this to skip the actual
    // pile push.
    ctx.rescued = true;

    engine.log('cute_hydra_delete_rescue', {
      player: ps.username, heroIdx: chosen.heroIdx,
      fromZone: ctx.fromZone, source: ctx.source,
    });
    engine.sync();
  },

  // ── 2. HEAD COUNTERS ON SUMMON ──────────────────────────────────
  hooks: {
    onPlay: async (ctx) => {
      const inst = ctx.card;
      if (!inst || ctx.playedCard?.id !== inst.id) return;
      if (inst.zone !== 'support') return;

      const engine = ctx._engine;
      const pi     = ctx.cardOwner;
      const ps     = engine.gs.players[pi];
      if (!ps) return;

      if (!inst.counters) inst.counters = {};

      // Click-to-discard loop. Each iteration shows a forceDiscard
      // (mandatory) or forceDiscardCancellable (post-minimum) prompt
      // pinned to the player's hand UI; the player clicks a card and
      // it's spliced + pushed to discard immediately. After
      // SUMMON_DISCARD_MIN discards, the prompt switches to a "Done"
      // button so the player can stop voluntarily. The loop also
      // exits automatically when the hand empties out.
      //
      // canSummon already guarantees the discardable pool is ≥ 2 at
      // summon-decision time, so the mandatory phase can always be
      // satisfied (modulo bizarre mid-resolution hand mutations,
      // which we still tolerate gracefully via the empty-hand check).
      let discarded = 0;
      while ((ps.hand || []).length > 0) {
        const remaining = SUMMON_DISCARD_MIN - discarded;
        const isMandatory = discarded < SUMMON_DISCARD_MIN;

        const result = await engine.promptGeneric(pi, {
          type: isMandatory ? 'forceDiscard' : 'forceDiscardCancellable',
          title: CARD_NAME,
          description: isMandatory
            ? `Discard ${remaining} more card${remaining > 1 ? 's' : ''}. Each becomes a Head Counter on ${CARD_NAME}. (So far: ${discarded}.)`
            : `Click another hand card to add a Head Counter, or click "Done" to stop. (Head Counters: ${discarded}.)`,
          instruction: 'Click a card in your hand to discard it.',
          cancellable: !isMandatory,
          cancelLabel: 'Done',
          // Surface the running discard count so the CPU's `cpuResponse`
          // can decide whether further discards add useful Head Counters
          // — see this script's `cpuResponse` below.
          currentDiscardCount: discarded,
        });

        // Voluntary stop after the minimum is met.
        if (result?.cancelled) break;

        // Defensive: malformed response or stale hand index — bail out.
        if (!result || result.cardName == null) break;

        // Commit via the engine helper — splices, pushes, MOVES the
        // tracked inst's zone marker to 'discard' (load-bearing for
        // discard-summon listeners like Cute Familiar that gate on
        // `c.isActiveIn('discard')`), then fires onDiscard with the
        // inst attached to the hook context.
        const ok = await engine.actionDiscardHandCard(
          pi, result.cardName, result.handIndex,
          { source: CARD_NAME }
        );
        if (!ok) break;
        discarded++;
        engine.sync();
      }

      if (discarded > 0) {
        inst.counters.headCounter = (inst.counters.headCounter || 0) + discarded;
        engine.log('cute_hydra_head_counters', {
          player: ps.username, gained: discarded,
          total: inst.counters.headCounter,
        });
      } else {
        engine.log('cute_hydra_summon_no_counters', {
          player: ps.username, reason: 'no_discards',
        });
      }
      engine.sync();
    },

    // ── 4. DEFEAT → DELETE ──
    // Engine routes a dead Creature to its original owner's discardPile
    // BEFORE firing onCreatureDeath. Re-route by splicing the just-
    // pushed name from discardPile and pushing into deletedPile.
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.instId !== ctx.card.id) return;

      const engine = ctx._engine;
      const ownerPs = engine.gs.players[death.originalOwner ?? death.owner];
      if (!ownerPs) return;

      const dIdx = (ownerPs.discardPile || []).lastIndexOf(CARD_NAME);
      if (dIdx < 0) return; // Already routed elsewhere.
      ownerPs.discardPile.splice(dIdx, 1);
      ownerPs.deletedPile.push(CARD_NAME);

      engine.log('cute_hydra_self_delete', {
        player: ownerPs.username,
      });
      engine.sync();
    },
  },

  // ── 3. HOPT MULTI-TARGET DAMAGE ────────────────────────────────
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const inst = ctx.card;
    return !!(inst?.counters?.headCounter && inst.counters.headCounter > 0);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const inst   = ctx.card;
    const pi     = ctx.cardOwner;
    if (!inst) return false;

    const heads = inst.counters?.headCounter || 0;
    if (heads <= 0) return false;

    const selected = await ctx.promptMultiTarget({
      side: 'any',
      types: ['hero', 'creature'],
      min: 1,
      max: heads,
      title: CARD_NAME,
      description: `Choose up to ${heads} different target${heads > 1 ? 's' : ''}. Deal ${HOPT_DAMAGE} damage to each.`,
      confirmLabel: `🐲 Strike! (${HOPT_DAMAGE} ×N)`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!Array.isArray(selected) || selected.length === 0) return false;

    const dmgSource = { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx };

    // Hit each chosen target. Animation per target so multi-strike
    // plays clearly. Damage type 'creature' (general creature-effect
    // damage — not destruction, not status). Cute Hydra spits viscous
    // purple goo onto each target via the dedicated `hydra_goo`
    // animation (see ANIM_REGISTRY in app-board.jsx / app.jsx).
    for (const target of selected) {
      const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'hydra_goo',
        owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
      });
      await engine._delay(200);

      if (target.type === 'hero') {
        const h = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (h && h.hp > 0) {
          await engine.actionDealDamage(dmgSource, h, HOPT_DAMAGE, 'creature');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          dmgSource, target.cardInstance, HOPT_DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
    }

    engine.log('cute_hydra_strike', {
      player: engine.gs.players[pi]?.username,
      targets: selected.map(t => t.cardName),
      damagePerTarget: HOPT_DAMAGE,
      headCounters: heads,
    });
    engine.sync();
    return true;
  },

  cpuMeta: {
    // Death routes to deletedPile (no recursion bait for opponents),
    // but the rescue-from-delete clause makes deletion costly.
    onDeathBenefit: 0,
  },
};
