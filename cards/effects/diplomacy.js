// ═══════════════════════════════════════════
//  CARD EFFECT: "Diplomacy"
//  Ability — Free activation during Main Phase
//  (no action cost). Hard once per turn (by name).
//
//  Choose an opponent's Creature with level ≤
//  Diplomacy level, pay Gold, and take permanent
//  control of it. The Creature's effects are
//  negated for the rest of the turn (Dark Gear
//  style negation).
//
//  Lv1: max Lv1, costs 20 Gold
//  Lv2: max Lv2, costs 10 Gold
//  Lv3: max Lv3, costs 5 Gold
//
//  Cannot target creatures immune to targeting
//  or immune to being controlled.
//  Animation: white doves from hero to target.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const MAX_LEVEL = [1, 2, 3];   // index 0 = Lv1, etc.
const GOLD_COST = [20, 10, 5]; // index 0 = Lv1, etc.

// ─── HELPERS ─────────────────────────────

/**
 * Get the gold cost for a given Diplomacy level.
 */
function getCost(level) {
  return GOLD_COST[Math.min(level - 1, GOLD_COST.length - 1)];
}

/**
 * Get the max creature level for a given Diplomacy level.
 */
function getMaxCreatureLevel(level) {
  return MAX_LEVEL[Math.min(level - 1, MAX_LEVEL.length - 1)];
}

/**
 * Get all free support zones across ALL of the player's heroes.
 */
function getFreeZones(ps) {
  const zones = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name) continue;
    for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
      const slot = (ps.supportZones[hi] || [])[si] || [];
      if (slot.length === 0) {
        zones.push({ heroIdx: hi, slotIdx: si, label: `${hero.name} — Slot ${si + 1}` });
      }
    }
  }
  return zones;
}

/**
 * Get eligible opponent creatures that can be targeted by Diplomacy.
 * Filters by: level ≤ maxLevel, not targeting_immune, not control_immune.
 */
function getEligibleCreatures(engine, pi, maxCreatureLevel) {
  const oppIdx = pi === 0 ? 1 : 0;
  const cardDB = engine._getCardDB();
  const targets = [];
  for (const inst of engine.cardInstances) {
    if (inst.controller !== oppIdx || inst.zone !== 'support') continue;
    if (engine.isCreatureImmune(inst, 'targeting_immune')) continue;
    if (engine.isCreatureImmune(inst, 'control_immune')) continue;
    const cd = cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if ((cd.level || 0) > maxCreatureLevel) continue;
    targets.push({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip',
      owner: inst.owner,
      heroIdx: inst.heroIdx,
      slotIdx: inst.zoneSlot,
      cardName: inst.name,
      cardInstance: inst,
    });
  }
  return targets;
}

// ─── CARD MODULE ─────────────────────────

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,
  noDefaultFlash: true,

  /**
   * Pre-check: can Diplomacy be activated right now?
   * Requires enough gold, eligible opponent creatures, and a free support zone.
   */
  canFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = ctx.players[pi];
    if (!ps) return false;

    const cost = getCost(level);
    if ((ps.gold || 0) < cost) return false;

    if (getFreeZones(ps).length === 0) return false;

    const maxLv = getMaxCreatureLevel(level);
    return getEligibleCreatures(engine, pi, maxLv).length > 0;
  },

  /**
   * Execute: select opponent creature → select own zone → dove animation →
   * transfer creature → pay gold → negate.
   * Returns false if cancelled (don't claim HOPT).
   */
  async onFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    const oppIdx = pi === 0 ? 1 : 0;

    const cost = getCost(level);
    const maxLv = getMaxCreatureLevel(level);

    // Build eligible targets
    const eligible = getEligibleCreatures(engine, pi, maxLv);
    if (eligible.length === 0) return false;

    // Check free zones
    const freeZones = getFreeZones(ps);
    if (freeZones.length === 0) return false;

    // Step 1: Select an opponent's creature
    const selectedIds = await ctx.promptTarget(eligible, {
      title: 'Diplomacy',
      description: `Choose a Lv ${maxLv} or lower Creature to take control of. (Cost: ${cost} Gold)`,
      confirmLabel: '🕊️ Diplomacy!',
      confirmClass: 'btn-success',
      cancellable: true,
      exclusiveTypes: true,
      maxPerType: { equip: 1 },
    });

    if (!selectedIds || selectedIds.length === 0) return false;
    const target = eligible.find(t => t.id === selectedIds[0]);
    if (!target) return false;

    // Step 2: Select a free support zone
    const currentFreeZones = getFreeZones(ps);
    if (currentFreeZones.length === 0) return false;

    let chosenZone;
    if (currentFreeZones.length === 1) {
      chosenZone = currentFreeZones[0];
    } else {
      const picked = await ctx.promptZonePick(currentFreeZones, {
        title: 'Diplomacy',
        description: `Place ${target.cardName} into a Support Zone.`,
        cancellable: true,
      });
      if (!picked) return false;
      chosenZone = currentFreeZones.find(z => z.heroIdx === picked.heroIdx && z.slotIdx === picked.slotIdx) || currentFreeZones[0];
    }

    // ── Effect resolves ──

    // Final gold check
    if ((ps.gold || 0) < cost) return false;

    // Flash the Diplomacy ability zone
    engine._broadcastEvent('ability_activated', {
      owner: pi, heroIdx, zoneIdx: ctx.card.zoneSlot,
    });

    // Play dove projectiles from Diplomacy hero to target creature (staggered)
    for (let i = 0; i < 3; i++) {
      engine._broadcastEvent('play_projectile_animation', {
        sourceOwner: pi,
        sourceHeroIdx: heroIdx,
        targetOwner: target.owner,
        targetHeroIdx: target.heroIdx,
        targetZoneSlot: target.slotIdx,
        emoji: '🕊️',
        duration: 600,
        emojiStyle: { fontSize: '22px', filter: 'drop-shadow(0 0 6px rgba(255,255,255,.8))' },
      });
      await engine._delay(200);
    }
    await engine._delay(500);

    // Pay gold
    ps.gold -= cost;
    engine.log('gold_spent', { player: ps.username, amount: cost, reason: 'Diplomacy' });
    engine._broadcastEvent('gold_change', { owner: pi, amount: -cost });

    // ── Move creature (same pattern as Dark Gear) ──
    const inst = target.cardInstance || engine.cardInstances.find(c =>
      c.owner === target.owner && c.zone === 'support' &&
      c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
    );
    if (!inst) return false;

    // Remove from opponent's support zone
    const oppPs = gs.players[oppIdx];
    const srcSlot = (oppPs.supportZones[target.heroIdx] || [])[target.slotIdx] || [];
    const srcIdx = srcSlot.indexOf(target.cardName);
    if (srcIdx >= 0) srcSlot.splice(srcIdx, 1);

    engine.sync();

    // Fire leave zone hook
    await engine.runHooks('onCardLeaveZone', {
      _onlyCard: inst, card: inst,
      fromZone: 'support', fromHeroIdx: target.heroIdx,
      _skipReactionCheck: true,
    });

    // Card transfer animation
    engine._broadcastEvent('play_card_transfer', {
      sourceOwner: oppIdx, sourceHeroIdx: target.heroIdx, sourceZoneSlot: target.slotIdx,
      targetOwner: pi, targetHeroIdx: chosenZone.heroIdx, targetZoneSlot: chosenZone.slotIdx,
      cardName: target.cardName, duration: 800,
    });
    await engine._delay(900);

    // Place into player's support zone
    const destHi = chosenZone.heroIdx;
    const destSi = chosenZone.slotIdx;
    if (!ps.supportZones[destHi]) ps.supportZones[destHi] = [[], [], []];
    if (!ps.supportZones[destHi][destSi]) ps.supportZones[destHi][destSi] = [];
    ps.supportZones[destHi][destSi].push(target.cardName);

    // Update card instance — transfer control permanently
    inst.controller = pi;
    inst.zone = 'support';
    inst.heroIdx = destHi;
    inst.zoneSlot = destSi;

    engine.sync();

    // Apply negation until end of turn (same as Dark Gear)
    engine.actionNegateCreature(inst, 'Diplomacy', {
      expiresAtTurn: gs.turn + 1,
      expiresForPlayer: pi === 0 ? 1 : 0,
    });

    engine.log('diplomacy', {
      player: ps.username,
      creature: target.cardName,
      cost,
      fromHero: oppPs.heroes[target.heroIdx]?.name,
      toHero: ps.heroes[destHi]?.name,
    });

    engine.sync();
    return true;
  },
};
