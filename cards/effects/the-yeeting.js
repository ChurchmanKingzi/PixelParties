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
      maxPerType: { hero: 1, equip: 1, ability: 1, perm: 1, area: 1, surprise: 1 },
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
    await engine.actionDestroyCard(dmgSource, targetInst);

    engine.log('the_yeeting', {
      player: ps.username, hero: hero.name,
      destroyed: sel.cardName, zone: targetInst.zone,
    });
    engine.sync();
    return true;
  },
};

// ── HELPERS ──

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
    }
  }

  return targets;
}
