// ═══════════════════════════════════════════
//  CARD EFFECT: "Wall Breaker General Ralzish"
//  Hero — 350 HP / 100 ATK (Fighting + Summoning Magic)
//
//  "Once per turn, if there are exactly 2 Creatures in this Hero's
//   Support Zones, you may choose any card on the board that is not a
//   Hero and send it to the discard pile. You cannot choose a
//   Creature that was summoned since the end of your last turn with
//   this effect."
//
//  ── Wiring ──────────────────────────────────────────────────────
//  Free activatable Hero Effect (no "spend your Action" wording →
//  NOT `heroEffectActionCost`). "Once per turn" is enforced
//  automatically by the engine's hero-effect HOPT (the server stamps
//  `gs.hoptUsed[hero-effect:<name>:<pi>:<heroIdx>]` only when
//  `onHeroEffect` resolves non-false — so cancelling preserves the
//  use for later in the turn).
//
//  Target scope = the canonical "any non-Hero card on the board"
//  scope used by The Yeeting / Coolness Overcharge (Creatures,
//  Equip Artifacts, Abilities, Permanents, Areas, face-down
//  Surprises, and the top of either Coolness Stack), MINUS any
//  Creature summoned "since the end of your last turn".
//
//  ── "summoned since the end of your last turn" ──────────────────
//  At the END of the controller's turn we stamp
//  `ps._ralzishLastTurnEndTick = gs.turn`. A Creature is protected
//  from THIS effect iff its `turnPlayed` is greater than that tick
//  (i.e. it was summoned during the opponent's turn that followed,
//  or during the controller's current turn). Cards that aren't
//  summoned Creatures (Equips / Abilities / Areas / Surprises /
//  Stack tops) are never restricted by this clause. Fallback when no
//  turn of the controller has ended yet (their very first turn):
//  `gs.turn - 2`, matching the strict-alternation turn arithmetic
//  used elsewhere (Necromancy, Lethe).
//
//  `bypassStatusFilter: true` keeps ONLY the onTurnEnd bookkeeping
//  accurate while Ralzish is Frozen / Stunned / Negated — it grants
//  no power (a negated Ralzish still can't activate the effect; the
//  server gates that), it just keeps the recency window correct.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Wall Breaker General Ralzish';

/**
 * gs.turn threshold: a support-zone Creature whose `turnPlayed` is
 * strictly greater than this was "summoned since the end of your
 * last turn" and can't be chosen by Ralzish's effect.
 */
function recencyThreshold(ps, gs) {
  const tick = ps?._ralzishLastTurnEndTick;
  return (typeof tick === 'number') ? tick : ((gs.turn || 0) - 2);
}

/** Count actual Creatures (not Equip Artifacts) in a Hero's Support Zones. */
function creaturesInSupport(engine, ownerIdx, heroIdx) {
  const cardDB = engine._getCardDB();
  let n = 0;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.owner !== ownerIdx || inst.heroIdx !== heroIdx) continue;
    if (inst.faceDown) continue;
    if (inst.counters?.treatAsEquip) continue; // Equip Artifact, not a Creature
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (cd && hasCardType(cd, 'Creature')) n++;
  }
  return n;
}

/**
 * Canonical "any non-Hero card on the board" target list (mirrors
 * The Yeeting / Coolness Overcharge), with Ralzish's extra filter:
 * skip Creatures summoned since the end of the controller's last
 * turn, and skip immovable cards.
 */
function collectTargets(engine, controllerIdx) {
  const gs = engine.gs;
  const cardDB = engine._getCardDB();
  const threshold = recencyThreshold(gs.players[controllerIdx], gs);
  const targets = [];
  const seen = new Set();

  for (const inst of engine.cardInstances) {
    if (inst.zone === 'hand' || inst.zone === 'discard' || inst.zone === 'deleted'
        || inst.zone === 'hero' || inst.zone === 'deck') continue;
    if (inst.counters?.immovable) continue;
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);

    if (inst.zone === 'support') {
      // "You cannot choose a Creature that was summoned since the end
      // of your last turn." Only applies to actual Creatures — Equip
      // Artifacts in a Support Zone are always choosable.
      const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
      const isCreature = !inst.counters?.treatAsEquip && cd && hasCardType(cd, 'Creature');
      if (isCreature && (inst.turnPlayed || 0) > threshold) continue;
      targets.push({ id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip',
        owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, _cardInstance: inst });
    } else if (inst.zone === 'ability') {
      const slot = gs.players[inst.owner]?.abilityZones?.[inst.heroIdx]?.[inst.zoneSlot] || [];
      if (slot.length > 0 && slot[slot.length - 1] !== inst.name) continue;
      targets.push({ id: `ability-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'ability',
        owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, _cardInstance: inst });
    } else if (inst.zone === 'permanent') {
      targets.push({ id: `perm-${inst.owner}-${inst.counters?.permId || inst.id}`, type: 'perm',
        owner: inst.owner, heroIdx: -1, cardName: inst.name, _cardInstance: inst });
    } else if (inst.zone === 'area') {
      const areaArr = gs.areaZones?.[inst.owner] || [];
      if (areaArr.length > 0 && areaArr[areaArr.length - 1] !== inst.name) continue;
      targets.push({ id: `area-${inst.owner}`, type: 'area',
        owner: inst.owner, heroIdx: -1, cardName: inst.name, _cardInstance: inst });
    } else if (inst.zone === 'surprise') {
      targets.push({ id: `equip-${inst.owner}-${inst.heroIdx}-surprise`, type: 'equip',
        owner: inst.owner, heroIdx: inst.heroIdx, cardName: inst.name, _cardInstance: inst });
    } else if (inst.zone === 'coolnessStack') {
      const stack = gs.players[inst.owner]?.coolnessStack || [];
      if (stack.length === 0 || stack[stack.length - 1] !== inst.name) continue;
      targets.push({ id: `coolness-${inst.owner}`, type: 'coolnessStackTop',
        owner: inst.owner, heroIdx: -1, cardName: inst.name, _cardInstance: inst });
    }
  }
  return targets;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,
  // Keep ONLY the onTurnEnd recency bookkeeping firing through
  // Frozen / Stunned / Negated — no power granted (the server still
  // blocks activating the effect while CC'd).
  bypassStatusFilter: true,

  // ── CPU / MCTS state valuation ───────────────────────────────────
  // Ralzish's "send any non-Hero board card to the discard pile" is
  // gated on EXACTLY 2 Creatures in his Support Zones. We make the
  // MCTS evaluator treat that board STATE as enormously desirable —
  // close to the value of killing an enemy Hero (the evaluator's
  // discrete hero-kill swing is ±500) — and grade the off-peak
  // counts so the score strictly climbs as Ralzish approaches 2.
  //
  // This is intentionally a pure `evaluateState` term (read generically
  // by the engine's per-instance `cpuMeta.cpuInstBonus` loop — no card
  // name hard-coded in the CPU brain, no action heuristic). MCTS then
  // discovers the behaviour on its own: when it expands a "summon a
  // Creature" move, the child state where the Creature landed in
  // Ralzish's Support Zone (0→1, 1→2) scores higher than landing it
  // elsewhere, so the search prefers it; and 2→3 scores far LOWER than
  // 2 (Ralzish loses the effect), so MCTS protects the exact-2 state
  // and won't over-summon onto him. The bonus is scoped to Ralzish's
  // OWN Support Zone count (`inst.heroIdx`), so summoning onto a
  // different Hero never perturbs it — the CPU stays free to develop
  // the rest of its board normally.
  //
  // Symmetry is automatic: the eval subtracts this for an opponent's
  // Ralzish, so the CPU also values denying / breaking the opponent's
  // exact-2 state.
  cpuMeta: {
    cpuInstBonus(engine, inst, ownerIdx) {
      // Only the live Ralzish Hero instance contributes.
      if (!inst || inst.zone !== 'hero') return 0;
      const hero = engine.gs.players?.[ownerIdx]?.heroes?.[inst.heroIdx];
      if (!hero?.name || hero.hp <= 0) return 0;

      const n = creaturesInSupport(engine, ownerIdx, inst.heroIdx);
      // Peak at exactly 2 (effect online) ≈ a hero kill. Graded so the
      // MCTS gradient points monotonically toward 2 from below, and
      // drops off a cliff past it so over-summoning is self-punishing.
      switch (n) {
        case 2:  return 450;   // effect ONLINE — almost a hero kill
        case 1:  return 150;   // one summon away — strong pull to finish
        case 3:  return 50;    // overshot: effect OFFLINE, far below 2
        default: return 0;     // 0, or 4+ (badly overshot)
      }
    },
  },

  /**
   * Gate: exactly 2 Creatures in Ralzish's Support Zones AND at least
   * one legal (non-Hero, non-recent-Creature) board target exists.
   * "Once per turn" is handled by the hero-effect HOPT upstream.
   */
  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hero = ctx.attachedHero;
    if (!hero?.name || hero.hp <= 0) return false;
    if (creaturesInSupport(engine, pi, heroIdx) !== 2) return false;
    return collectTargets(engine, pi).length > 0;
  },

  /**
   * Pick any non-Hero card on the board (minus recently-summoned
   * Creatures) and send it to the discard pile. Returns false on a
   * no-pick cancel so the once-per-turn isn't burned.
   */
  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;

    // Re-verify the activation condition (state can shift between the
    // availability check and resolution).
    if (creaturesInSupport(engine, pi, heroIdx) !== 2) return false;

    const targets = collectTargets(engine, pi);
    if (targets.length === 0) return false;

    const pick = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: 'Send any non-Hero card on the board to the discard pile. (Creatures summoned since the end of your last turn cannot be chosen.)',
      confirmLabel: '🧱 Break!',
      confirmClass: 'btn-danger',
      cancellable: true,
      exclusiveTypes: true,
      maxPerType: { equip: 1, ability: 1, perm: 1, area: 1, surprise: 1, coolnessStackTop: 1 },
    });
    if (!pick || pick.length === 0) return false; // cancelled — keep HOPT

    const sel = targets.find(t => t.id === pick[0]);
    if (!sel) return false;
    const targetInst = sel._cardInstance;

    if (targetInst?.counters?.immovable) {
      engine.log('ralzish_blocked', { card: sel.cardName, reason: 'immovable' });
      return false;
    }

    // ── Ram + explosion: Ralzish (the Wall Breaker) charges the
    //    target's zone, then it shatters. Mirrors Coolness Overcharge.
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (hero?.name && hero.hp > 0) {
      const isStack = sel.type === 'coolnessStackTop';
      const ramTarget = isStack
        ? { owner: sel.owner, heroIdx: -1, zoneSlot: -1, zoneType: 'coolnessStack' }
        : { owner: targetInst.owner, heroIdx: targetInst.heroIdx, zoneSlot: targetInst.zoneSlot, zoneType: targetInst.zone };

      const ramEvent = {
        sourceOwner: pi, sourceHeroIdx: heroIdx,
        targetOwner: ramTarget.owner,
        targetHeroIdx: ramTarget.heroIdx >= 0 ? ramTarget.heroIdx : 0,
        cardName: hero.name, duration: 1200,
      };
      if (ramTarget.zoneType === 'ability') {
        ramEvent.targetZoneType = 'ability';
        ramEvent.targetZoneSlot = ramTarget.zoneSlot;
      } else if (ramTarget.zoneType === 'permanent') {
        ramEvent.targetZoneType = 'permanent';
        ramEvent.targetPermId = targetInst.counters?.permId || targetInst.id;
      } else if (ramTarget.zoneType === 'area') {
        ramEvent.targetZoneType = 'area';
      } else if (ramTarget.zoneType === 'coolnessStack') {
        ramEvent.targetZoneType = 'coolnessStack';
      } else if (ramTarget.zoneSlot >= 0) {
        ramEvent.targetZoneSlot = ramTarget.zoneSlot;
      }
      engine._broadcastEvent('play_ram_animation', ramEvent);
      await engine._delay(300);

      const explEvent = { type: 'explosion', owner: ramTarget.owner };
      if (ramTarget.zoneType === 'ability') {
        explEvent.heroIdx = ramTarget.heroIdx;
        explEvent.zoneSlot = ramTarget.zoneSlot;
        explEvent.zoneType = 'ability';
      } else if (ramTarget.zoneType === 'permanent') {
        explEvent.heroIdx = 0;
        explEvent.zoneSlot = -1;
        explEvent.zoneType = 'permanent';
        explEvent.permId = targetInst.counters?.permId || targetInst.id;
      } else if (ramTarget.zoneType === 'area') {
        explEvent.heroIdx = -1;
        explEvent.zoneSlot = -1;
        explEvent.zoneType = 'area';
      } else if (ramTarget.zoneType === 'coolnessStack') {
        explEvent.heroIdx = -1;
        explEvent.zoneSlot = -1;
        explEvent.zoneType = 'coolnessStack';
      } else if (ramTarget.heroIdx >= 0) {
        explEvent.heroIdx = ramTarget.heroIdx;
        explEvent.zoneSlot = ramTarget.zoneSlot >= 0 ? ramTarget.zoneSlot : -1;
      }
      engine._broadcastEvent('play_zone_animation', explEvent);
      await engine._delay(200);
    }

    const source = { name: CARD_NAME, owner: pi, heroIdx };
    if (sel.type === 'coolnessStackTop') {
      await engine.actionPopCoolnessStackTo(sel.owner, 'discard', { source: CARD_NAME });
    } else if (targetInst) {
      if (sel.type === 'area') {
        // Area protection window (Wowhalla etc.) — same as The Yeeting.
        const negated = await engine.tryAreaProtection(targetInst, source, pi);
        if (negated) {
          engine.log('ralzish_negated_by_area', { card: sel.cardName });
          engine.sync();
          return true; // committed — claim the once-per-turn
        }
      }
      // Zone-anchored board→discard flight. Without this, the
      // client's diff-based fly-out detector resolves the source by
      // CARD NAME and always animates from the LEFT-MOST same-named
      // card on the board (wrong slot when duplicates exist). Emitting
      // an explicit `play_pile_transfer` keyed to this instance's
      // exact zone makes the flight start at the real card, and the
      // frontend's pending-bucket suppresses the duplicate name-keyed
      // diff animation. Fired BEFORE the destroy so the source slot is
      // still rendered. Area has its own engine-level area→discard
      // broadcast; Coolness-Stack tops fly via actionPopCoolnessStackTo;
      // Permanents aren't name-captured by the diff detector — so this
      // is scoped to support / ability / surprise zones only.
      const tz = targetInst.zone;
      if (tz === 'support' || tz === 'ability' || tz === 'surprise') {
        engine._broadcastEvent('play_pile_transfer', {
          owner: targetInst.owner,
          cardName: targetInst.name,
          from: tz, to: 'discard',
          fromHeroIdx: targetInst.heroIdx,
          fromSlotIdx: targetInst.zoneSlot,
        });
      }
      await engine.actionDestroyCard(source, targetInst);
    }

    engine.log('ralzish_wall_break', {
      player: gs.players[pi]?.username,
      destroyed: sel.cardName, zone: sel.type,
    });
    engine.sync();
    return true;
  },

  hooks: {
    /**
     * Controller's turn end: stamp the recency tick. Creatures
     * summoned AFTER this (opponent's turn, then the controller's
     * next turn) are off-limits to the effect until the window
     * rolls over again.
     */
    onTurnEnd: async (ctx) => {
      const controller = ctx.cardController ?? ctx.cardOwner;
      if (ctx.activePlayer !== controller) return;
      const ps = ctx._engine.gs.players[controller];
      if (ps) ps._ralzishLastTurnEndTick = ctx._engine.gs.turn;
    },
  },
};
