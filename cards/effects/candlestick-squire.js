// ═══════════════════════════════════════════
//  CARD EFFECT: "Candlestick Squire"
//  Creature (Summoning Magic Lv 1, 30 HP, Banned)
//
//  Two effects:
//
//  1. ALTERNATIVE SUMMON — at play time, IF a
//     Burned target exists on either side of the
//     board, the card opts into the engine's
//     "inherent additional Action" path (no main
//     action consumed). On that path, `beforeSummon`
//     prompts for a Burned target, plays a flame
//     animation on it, and removes its Burn. With
//     no Burned targets in play, the card falls
//     back to the standard summon path (Lv 1
//     Summoning Magic, costs the main action,
//     no cleanse).
//
//  2. HOPT DRAW — once per turn, draw cards equal
//     to the count of Burned targets currently
//     on the board, capped at 4.
//
//  Wiring notes:
//    • `inherentAction` returns true iff at
//      least one Burned target exists. The engine
//      stamps `ctx.isInherentAction` accordingly
//      so `beforeSummon` knows which path to
//      take.
//    • Cleanse animation: existing `flame_strike`
//      flash on the target's slot — reads as the
//      flame flaring up briefly before being
//      snuffed out by the cleanse.
//    • `cleanseHeroStatuses` / `cleanseCreatureStatuses`
//      handle status removal centrally and skip
//      unhealable statuses on their own.
//    • The HOPT count is re-checked at activation
//      time so a Burned target dying mid-turn
//      doesn't leave a stale cap.
// ═══════════════════════════════════════════

const CARD_NAME = 'Candlestick Squire';
const HOPT_DRAW_CAP = 4;
const ANIM_HOLD_MS  = 500;

// ─── HELPERS ─────────────────────────────

function countBurnedTargets(engine) {
  let n = 0;
  for (const ps of (engine.gs.players || [])) {
    if (!ps) continue;
    for (const h of (ps.heroes || [])) {
      if (h?.name && h.hp > 0 && h.statuses?.burned) n++;
    }
  }
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (inst.counters?.burned) n++;
  }
  return n;
}

function buildBurnedTargets(engine) {
  const targets = [];
  for (let pi = 0; pi < (engine.gs.players?.length || 0); pi++) {
    const ps = engine.gs.players[pi];
    if (!ps) continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (!h.statuses?.burned) continue;
      targets.push({
        id: `hero-${pi}-${hi}`, type: 'hero',
        owner: pi, heroIdx: hi, cardName: h.name,
      });
    }
  }
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (!inst.counters?.burned) continue;
    targets.push({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip',
      owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
    });
  }
  return targets;
}

// ─── CARD MODULE ─────────────────────────

module.exports = {
  activeIn: ['support'],

  // Inherent additional Action whenever a Burned target is on the
  // board — engine stamps `ctx.isInherentAction = true` on the summon
  // path and `beforeSummon` charges the cleanse cost.
  inherentAction(gs, pi, heroIdx, engine) {
    return countBurnedTargets(engine) > 0;
  },

  // Custom host pick — same flag Waitress uses. The client reads this
  // from `gameState.customHostPickCards` and skips the generic
  // `spellHeroPick` panel on click-play; `beforeSummon` runs the
  // richer zonePick host picker (with eligible Heroes' free Support
  // Zones AND the Heroes themselves clickable, like the normal
  // summoning UX). Drag-drop bypasses the picker entirely via
  // `ctx.viaDragDrop`.
  usesCustomHostPick: true,

  /**
   * Pre-placement cost. Only fires the cleanse on the inherent path —
   * a normal Lv1-Summoning-Magic main-action summon proceeds without
   * paying anything. Returning false aborts the summon (engine's
   * summonCreatureWithHooks + the server's play_creature handler both
   * respect this — the card returns to hand and the action slot stays
   * unspent).
   *
   * Two independent picks happen here:
   *
   *   1. HOST zone — which Support Zone of which own Hero summons
   *      Squire. Three sub-paths (mirrors Waitress):
   *        • Drag-drop — `ctx.viaDragDrop` is true, the engine's
   *          drop hero/slot is taken as-is. No prompt.
   *        • Single eligible zone — auto-pick.
   *        • Multiple eligible zones — `zonePick` prompt, with each
   *          eligible Hero AND each free Support Zone clickable on
   *          the board.
   *
   *   2. CLEANSE target — which Burned target gets healed. Spans both
   *      sides of the board (any Burned hero / face-up creature).
   *
   * If the chosen host/slot differs from the engine's pre-pinned
   * drop slot, we manually place Squire via `actionPlaceCreature`
   * and stamp `ps._placementConsumedByCard` so the server's default
   * placement is skipped — same path Waitress uses.
   */
  async beforeSummon(ctx) {
    if (!ctx.isInherentAction) return true; // standard summon path
    const engine = ctx._engine;
    const pi     = ctx.cardOwner;
    const ps     = engine.gs.players[pi];
    if (!ps) return false;

    // ── Step 1: pick the HOST Hero + slot ───────────────────────
    // Eligible hosts: alive own Heroes that aren't Frozen / Stunned
    // / Bound, who MEET Squire's school/level requirements (Lv 1
    // Summoning Magic), and who have at least one free Support Zone
    // slot. Mirrors `getHeroPlayableCards`'s normal-summon gate.
    const cardDB = engine._getCardDB();
    const cd     = cardDB[CARD_NAME];
    const hostZones = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (h.statuses?.frozen || h.statuses?.stunned || h.statuses?.bound) continue;
      if (cd && !engine.heroMeetsLevelReq(pi, hi, cd)) continue;
      const sup = ps.supportZones?.[hi] || [[], [], []];
      for (let z = 0; z < 3; z++) {
        if ((sup[z] || []).length === 0) {
          hostZones.push({
            heroIdx: hi, slotIdx: z,
            label: `${h.name} — Support ${z + 1}`,
          });
        }
      }
    }
    if (hostZones.length === 0) return false; // no valid host

    let hostHeroIdx, hostFreeSlot;
    if (ctx.viaDragDrop) {
      // Drag-drop pinned the host: use the dropped hero/slot.
      hostHeroIdx  = ctx.cardHeroIdx;
      hostFreeSlot = ps._requestedNormalSummonSlot?.slotIdx;
      const stillFree = hostFreeSlot != null
        && hostZones.some(z => z.heroIdx === hostHeroIdx && z.slotIdx === hostFreeSlot);
      if (!stillFree) {
        const fallback = hostZones.find(z => z.heroIdx === hostHeroIdx);
        if (!fallback) return false;
        hostFreeSlot = fallback.slotIdx;
      }
    } else if (hostZones.length === 1) {
      hostHeroIdx  = hostZones[0].heroIdx;
      hostFreeSlot = hostZones[0].slotIdx;
    } else {
      const picked = await engine.promptGeneric(pi, {
        type: 'zonePick',
        zones: hostZones,
        title: CARD_NAME,
        description: 'Choose which Support Zone summons Candlestick Squire (independent of the Burned target).',
        previewCardName: CARD_NAME,
        cancellable: true,
      });
      if (!picked || picked.cancelled) return false;
      const chosen = hostZones.find(z => z.heroIdx === picked.heroIdx && z.slotIdx === picked.slotIdx);
      if (!chosen) return false;
      hostHeroIdx  = chosen.heroIdx;
      hostFreeSlot = chosen.slotIdx;
    }

    // ── Step 2: pick the BURNED target to cleanse ───────────────
    const targets = buildBurnedTargets(engine);
    if (targets.length === 0) return false; // race — burn went away

    const picked = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: 'Heal a Burned target from its Burn to summon Candlestick Squire.',
      confirmLabel: '🔥 Heal Burn!',
      confirmClass: 'btn-success',
      cancellable: true,
      greenSelect: true,
      exclusiveTypes: true,
      maxPerType: { hero: 1, equip: 1 },
    });
    if (!picked || picked.length === 0) return false; // player cancelled

    const target = targets.find(t => t.id === picked[0]);
    if (!target) return false;

    // ── Step 3: cleanse + animate ───────────────────────────────
    // Burning animation on the target — fire flares up before the
    // cleanse extinguishes it.
    const slot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      type: 'flame_strike',
      owner: target.owner, heroIdx: target.heroIdx, zoneSlot: slot,
    });
    await engine._delay(ANIM_HOLD_MS);

    // Remove Burn (the only status this card cleanses, per text).
    if (target.type === 'hero') {
      const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero) {
        engine.cleanseHeroStatuses(hero, target.owner, target.heroIdx, ['burned'], CARD_NAME);
      }
    } else if (target.cardInstance) {
      engine.cleanseCreatureStatuses(target.cardInstance, ['burned'], CARD_NAME);
    }

    // ── Step 4: redirect placement if host/slot differs from drop ──
    const drop = ps._requestedNormalSummonSlot;
    const sameAsDrop = drop
      && hostHeroIdx === ctx.cardHeroIdx
      && hostFreeSlot === drop.slotIdx;
    if (!sameAsDrop) {
      await engine.actionPlaceCreature(CARD_NAME, pi, hostHeroIdx, hostFreeSlot, {
        source: 'external', sourceName: CARD_NAME, fireHooks: true,
      });
      ps._placementConsumedByCard = CARD_NAME;
    }

    engine.log('candlestick_squire_cleanse', {
      player: ps.username,
      host: ps.heroes?.[hostHeroIdx]?.name,
      target: target.cardName,
    });
    engine.sync();
    return true;
  },

  // ── HOPT: draw N cards, N = Burned targets on board (cap 4) ──
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    return countBurnedTargets(ctx._engine) > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const n = Math.min(HOPT_DRAW_CAP, countBurnedTargets(engine));
    if (n <= 0) return false;
    await ctx.drawCards(ctx.cardOwner, n);
    engine.log('candlestick_squire_draw', {
      player: engine.gs.players[ctx.cardOwner]?.username,
      drawn: n, burnedCount: countBurnedTargets(engine),
    });
    engine.sync();
    return true;
  },
};
