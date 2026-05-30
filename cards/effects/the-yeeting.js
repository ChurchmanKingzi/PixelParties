// ═══════════════════════════════════════════
//  CARD EFFECT: "The Yeeting"
//  Artifact (Normal, Cost 6) — HOPT
//
//  Uses targeting flow: hero selection is the
//  targeting step. Card gallery for the board
//  card happens inside resolve. Cancel on card
//  gallery returns { aborted: true } to re-enter
//  hero selection. Cancel on hero selection
//  (cancel_potion) keeps card in hand.
// ═══════════════════════════════════════════

module.exports = {
  isTargetingArtifact: true,
  deferBroadcast: true,

  // ── CPU prompt routing (fast heuristic, NO nested MCTS) ───────────
  // Previous implementation routed both prompts through nested MCTS
  // (`mctsPickFromOptions`), which spun several full rest-of-turn
  // rollouts per option per prompt — long enough to time out the live
  // CPU turn (15+ min freezes observed). Replaced with a fast scoring
  // heuristic:
  //
  //   • Yeeter pick: highest current HP own Hero that survives the
  //     150 self-damage (HP ≥ 151). If none would survive, pick the
  //     highest HP anyway (rare; better than abstaining).
  //
  //   • Destroy pick: per-type value table. Areas use cost×10 (×0.25
  //     when opp has Cooldin alive — he tutors Areas cheaply, so
  //     denial is much less valuable). Abilities use level×100 but
  //     are EXCLUDED entirely when another living enemy Hero has the
  //     same Ability at equal-or-higher level (redundant). Creatures
  //     prefer `_cpuStats.damageLastTurn` (true performance signal)
  //     and fall back to HP+ATK*2 when no track record exists. Other
  //     types use cost-scaled fallbacks. Cancellable prompt declines
  //     when no positive-value target exists.
  cpuResponse(engine, kind, payload) {
    if (kind !== 'target') return undefined;
    const { validTargets } = payload || {};
    if (!Array.isArray(validTargets) || validTargets.length === 0) return undefined;

    const cpuIdx = engine._cpuPlayerIdx;
    if (cpuIdx < 0) return undefined;

    const hasNonHero = validTargets.some(t => t.type && t.type !== 'hero');

    // ── Prompt 1: yeeter pick (own Hero takes 150 self-damage) ───────
    if (!hasNonHero) {
      const heroOpts = validTargets.filter(t =>
        t.type === 'hero' && t.owner === cpuIdx,
      );
      if (heroOpts.length === 0) return undefined;
      if (heroOpts.length === 1) return [heroOpts[0].id];

      const ps = engine.gs.players[cpuIdx];
      const survivors = heroOpts.filter(t => (ps.heroes?.[t.heroIdx]?.hp || 0) > 150);
      const pool = survivors.length > 0 ? survivors : heroOpts;
      let bestHp = -1, picked = null;
      for (const t of pool) {
        const hp = ps.heroes?.[t.heroIdx]?.hp || 0;
        if (hp > bestHp) { bestHp = hp; picked = t; }
      }
      return picked ? [picked.id] : undefined;
    }

    // ── Prompt 2: destroy pick (most valuable enemy card) ────────────
    const viable = validTargets.filter(t => {
      if (t.owner === cpuIdx) return false;
      if (t._cardInstance?.counters?.immovable) return false;
      return true;
    });
    if (viable.length === 0) return undefined;

    let bestScore = -Infinity, pickedId = null;
    for (const t of viable) {
      const score = _scoreEnemyCard(engine, t);
      if (score > bestScore) { bestScore = score; pickedId = t.id; }
    }
    // Nothing scored positively → decline the cancellable prompt rather
    // than waste the 150 self-damage destroying a worthless card.
    if (pickedId == null || bestScore <= 0) return undefined;
    return [pickedId];
  },

  canActivate(gs, pi) {
    const hoptKey = `the-yeeting:${pi}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    return _hasNonHeroCards(gs);
  },

  getValidTargets(gs, pi) {
    const ps = gs.players[pi];
    const targets = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      targets.push({ id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: h.name });
    }
    return targets;
  },

  targetingConfig: {
    description: 'Choose which Hero to Yeet! (Takes 150 damage)',
    confirmLabel: '💪 This one!',
    confirmClass: 'btn-warning',
    cancellable: true,
    maxTotal: 1,
  },

  validateSelection(selectedIds) {
    return selectedIds.length === 1;
  },

  animationType: 'none',

  resolve: async (engine, pi, selectedIds) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    // HOPT claim
    if (!engine.claimHOPT('the-yeeting', pi)) return { cancelled: true };

    // Parse selected hero
    const match = (selectedIds[0] || '').match(/^hero-(\d+)-(\d+)$/);
    if (!match) return { cancelled: true };
    const heroIdx = parseInt(match[2]);
    const hero = ps.heroes[heroIdx];
    if (!hero?.name || hero.hp <= 0) return { cancelled: true };

    // ── Select non-Hero card from board (click-to-target) ──
    const boardTargets = _collectBoardTargets(gs, engine);
    if (boardTargets.length === 0) return { cancelled: true };

    const cardPick = await engine.promptEffectTarget(pi, boardTargets, {
      title: 'The Yeeting — Choose Target',
      description: `${hero.name} will yeet into it! Choose a card to destroy.`,
      confirmLabel: '💥 YEET!',
      confirmClass: 'btn-danger',
      cancellable: true,
      exclusiveTypes: true,
      maxPerType: { hero: 1, equip: 1, ability: 1, perm: 1, area: 1, surprise: 1, coolnessStackTop: 1 },
    });

    if (!cardPick || cardPick.length === 0) {
      // Cancelled — go back to hero selection
      return { aborted: true };
    }

    // Find the card instance
    const sel = boardTargets.find(t => t.id === cardPick[0]);
    if (!sel) return { aborted: true };

    const targetInst = sel._cardInstance;
    if (!targetInst) return { aborted: true };

    if (targetInst.counters?.immovable) {
      engine.log('yeet_blocked', { card: sel.cardName, reason: 'immovable' });
      return { aborted: true };
    }

    // ── Ram animation ──
    const tgtOwner = targetInst.owner;
    const tgtHeroIdx = targetInst.heroIdx;
    const tgtZoneSlot = targetInst.zoneSlot;
    const tgtZoneType = targetInst.zone; // 'support', 'ability', 'permanent', etc.

    const ramEvent = {
      sourceOwner: pi, sourceHeroIdx: heroIdx,
      targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx >= 0 ? tgtHeroIdx : 0,
      cardName: hero.name, duration: 1200,
    };
    if (tgtZoneType === 'ability') {
      ramEvent.targetZoneType = 'ability';
      ramEvent.targetZoneSlot = tgtZoneSlot;
    } else if (tgtZoneType === 'permanent') {
      ramEvent.targetZoneType = 'permanent';
      ramEvent.targetPermId = targetInst.counters?.permId || targetInst.id;
    } else if (tgtZoneType === 'area') {
      // Area zones are owner-scoped only (no heroIdx / zoneSlot), so the
      // frontend selector keys on `[data-area-zone][data-area-owner]` —
      // see play_ram_animation handler.
      ramEvent.targetZoneType = 'area';
    } else if (tgtZoneSlot >= 0) {
      ramEvent.targetZoneSlot = tgtZoneSlot;
    }
    engine._broadcastEvent('play_ram_animation', ramEvent);
    await engine._delay(300);

    // 💥 Explosion on impact
    const explEvent = { type: 'explosion', owner: tgtOwner };
    if (tgtZoneType === 'ability') {
      explEvent.heroIdx = tgtHeroIdx;
      explEvent.zoneSlot = tgtZoneSlot;
      explEvent.zoneType = 'ability';
    } else if (tgtZoneType === 'permanent') {
      explEvent.heroIdx = 0;
      explEvent.zoneSlot = -1;
      explEvent.zoneType = 'permanent';
      explEvent.permId = targetInst.counters?.permId || targetInst.id;
    } else if (tgtZoneType === 'area') {
      explEvent.heroIdx = -1;
      explEvent.zoneSlot = -1;
      explEvent.zoneType = 'area';
    } else if (tgtHeroIdx >= 0) {
      explEvent.heroIdx = tgtHeroIdx;
      explEvent.zoneSlot = tgtZoneSlot >= 0 ? tgtZoneSlot : -1;
    }
    engine._broadcastEvent('play_zone_animation', explEvent);
    await engine._delay(200);

    // ── Deal 150 artifact damage to the Hero ──
    const dmgSource = { name: 'The Yeeting', owner: pi, heroIdx };
    await engine.actionDealDamage(dmgSource, hero, 150, 'artifact');
    engine.sync();
    await engine._delay(400);

    // ── Destroy the selected card ──
    if (sel.type === 'coolnessStackTop') {
      await engine.actionPopCoolnessStackTo(targetInst.owner, 'discard', { source: 'The Yeeting' });
    } else {
      // Area protection window — Wowhalla and any future Area card
      // with `onAreaTargetedByOpponent` gets a chance to negate.
      if (sel.type === 'area') {
        const negated = await engine.tryAreaProtection(targetInst, dmgSource, pi);
        if (negated) {
          engine.log('yeet_negated_by_area', { card: sel.cardName });
          engine.sync();
          return true;
        }
      }
      // Zone-anchored board→discard flight. Without this the client's
      // diff-based fly-out resolves the source by CARD NAME and always
      // animates from the LEFT-MOST same-named card (wrong slot when
      // duplicates exist). Fired BEFORE the destroy (source slot still
      // rendered); the frontend's pending-bucket suppresses the
      // duplicate name-keyed diff animation. Area has its own engine
      // area→discard broadcast; Coolness-Stack tops fly via
      // actionPopCoolnessStackTo; Permanents aren't name-captured — so
      // scope to support / ability / surprise only. See
      // cards/effects/CARD_API.md "Removing a board card to a pile".
      const _tz = targetInst.zone;
      if (_tz === 'support' || _tz === 'ability' || _tz === 'surprise') {
        engine._broadcastEvent('play_pile_transfer', {
          owner: targetInst.owner,
          cardName: targetInst.name,
          from: _tz, to: 'discard',
          fromHeroIdx: targetInst.heroIdx,
          fromSlotIdx: targetInst.zoneSlot,
        });
      }
      await engine.actionDestroyCard(dmgSource, targetInst);
    }

    engine.log('the_yeeting', {
      player: ps.username, hero: hero.name,
      destroyed: sel.cardName, zone: targetInst.zone,
    });
    engine.sync();
    return true;
  },
};

// ── HELPERS ──

const COOLDIN_NAME = 'Cooldin, King of Coolness';

/**
 * Per-type value score for an enemy board card. Used by the Yeeting
 * heuristic to pick the highest-value destroy target. Returns a
 * non-negative number; 0 means "don't bother" (the cancellable prompt
 * declines if nothing scores positive).
 *
 * Type weights are calibrated against the existing eval scale (1 hp
 * damage ≈ 1 score unit) so future destroy effects (Dark Gear et al.)
 * can reuse the same numbers without divergence.
 */
function _scoreEnemyCard(engine, target) {
  const inst = target._cardInstance;
  if (!inst) return 0;
  const cardDB = engine._getCardDB();
  const cd = cardDB[inst.name];
  if (!cd) return 0;
  const gs = engine.gs;
  const oppIdx = inst.owner;
  const opp = gs.players[oppIdx];
  if (!opp) return 0;
  const cost = cd.cost || 0;

  // Areas — high value normally; gutted to 0.25× when opp has Cooldin
  // alive (he tutors Areas for ~free, so removal is easily replaced).
  if (target.type === 'area') {
    const cooldinAlive = (opp.heroes || []).some(h =>
      h?.name === COOLDIN_NAME && h.hp > 0);
    const base = Math.max(60, cost * 10);
    return cooldinAlive ? base * 0.25 : base;
  }

  // Surprises — face-down, unknown contents. Treat as flat moderate
  // value: typical Surprises cause 200–400 swing (Booby Trap = 100 +
  // burn-all, Bear Trap = bind, etc.). 200 is a conservative midpoint.
  if (target.type === 'equip' && inst.zone === 'surprise') return 200;

  // Abilities — REDUNDANCY GATE: if another living enemy Hero already
  // has the same Ability at equal-or-higher level, removing this copy
  // is wasted (the team's effective level is unchanged). Skip entirely.
  if (target.type === 'ability') {
    const heroIdx = inst.heroIdx;
    const slotIdx = inst.zoneSlot;
    const slot = opp.abilityZones?.[heroIdx]?.[slotIdx] || [];
    const level = slot.length;
    if (level <= 0) return 0;
    const abilityName = inst.name;
    for (let h = 0; h < (opp.heroes || []).length; h++) {
      if (h === heroIdx) continue;
      const otherHero = opp.heroes[h];
      if (!otherHero?.name || otherHero.hp <= 0) continue;
      const otherZones = opp.abilityZones?.[h] || [];
      for (const otherSlot of otherZones) {
        if ((otherSlot || [])[0] !== abilityName) continue;
        if ((otherSlot.length || 0) >= level) return 0; // redundant copy
      }
    }
    return level * 100;
  }

  // Support-zone cards: Creatures vs. Equipment.
  if (target.type === 'equip' && inst.zone === 'support') {
    const isCreature = cd.cardType === 'Creature'
      || (cd.cardType === 'Artifact' && (cd.subtype || '').toLowerCase().split('/').some(t => t.trim() === 'creature'));
    if (isCreature) {
      // Prefer the real damage-dealt ledger from the CPU stats system
      // (creature instance counters, updated by recordDamageDealt).
      const stats = inst.counters?._cpuStats;
      const dmgLast = stats?.damageLastTurn || 0;
      if (dmgLast > 0) return 100 + dmgLast;
      // No track record yet — use HP+ATK as a static threat proxy.
      const hp = inst.hp ?? cd.hp ?? 0;
      const atk = inst.atk ?? cd.atk ?? 0;
      return 30 + hp + atk * 2;
    }
    // Equipment — cost is the best static proxy ("opp paid N gold to
    // get this benefit, denying it is ≈ N gold of tempo"). The +30
    // baseline keeps cost-0 equips from scoring zero.
    return 30 + cost * 5;
  }

  // Permanents — global persistent effects, generally meaningful.
  if (target.type === 'perm') return 50 + cost * 5;

  // Coolness-stack top — small but non-zero.
  if (target.type === 'coolnessStackTop') return 20;

  // Fallback: cost proxy.
  return cost || 10;
}

function _hasNonHeroCards(gs) {
  for (let p = 0; p < 2; p++) {
    const ps = gs.players[p];
    for (let hi = 0; hi < 3; hi++) {
      for (let si = 0; si < (ps.supportZones?.[hi] || []).length; si++) {
        if (((ps.supportZones[hi] || [])[si] || []).length > 0) return true;
      }
    }
    for (let hi = 0; hi < 3; hi++) {
      for (let si = 0; si < (ps.abilityZones?.[hi] || []).length; si++) {
        if (((ps.abilityZones[hi] || [])[si] || []).length > 0) return true;
      }
    }
    if ((ps.permanents || []).length > 0) return true;
    for (let hi = 0; hi < 3; hi++) {
      if ((ps.surpriseZones?.[hi] || []).length > 0) return true;
    }
  }
  if (gs.areaZones) {
    for (let p = 0; p < 2; p++) {
      if ((gs.areaZones[p] || []).length > 0) return true;
    }
  }
  return false;
}

function _collectBoardTargets(gs, engine) {
  const targets = [];
  const seen = new Set();

  for (const inst of engine.cardInstances) {
    if (inst.zone === 'hand' || inst.zone === 'discard' || inst.zone === 'deleted' || inst.zone === 'hero' || inst.zone === 'deck') continue;
    if (inst.counters?.immovable) continue;
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);

    if (inst.zone === 'support') {
      targets.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'ability') {
      // Only target the top card of each ability stack
      const slot = gs.players[inst.owner]?.abilityZones?.[inst.heroIdx]?.[inst.zoneSlot] || [];
      if (slot.length > 0 && slot[slot.length - 1] !== inst.name) continue;
      targets.push({
        id: `ability-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'ability', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'permanent') {
      targets.push({
        id: `perm-${inst.owner}-${inst.counters?.permId || inst.id}`,
        type: 'perm', owner: inst.owner, heroIdx: -1,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'area') {
      // Area zones count as non-Hero board cards — anything that can
      // target a Permanent should also be able to target an Area. The
      // BoardZone displays the top entry of areaZones[owner], so
      // filter to just that entry.
      const areaArr = gs.areaZones?.[inst.owner] || [];
      if (areaArr.length > 0 && areaArr[areaArr.length - 1] !== inst.name) continue;
      targets.push({
        id: `area-${inst.owner}`,
        type: 'area', owner: inst.owner, heroIdx: -1,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'surprise') {
      // Surprise zones use ability-like IDs for click targeting
      targets.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-surprise`,
        type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'coolnessStack') {
      // Only the TOP of each player's Coolness Stack is targetable.
      const stack = gs.players[inst.owner]?.coolnessStack || [];
      if (stack.length === 0 || stack[stack.length - 1] !== inst.name) continue;
      targets.push({
        id: `coolness-${inst.owner}`,
        type: 'coolnessStackTop', owner: inst.owner, heroIdx: -1,
        cardName: inst.name, _cardInstance: inst,
      });
    }
  }

  return targets;
}
