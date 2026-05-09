// ═══════════════════════════════════════════
//  SPELL: "Coolness Overcharge"
//  Stack must have ≥6 cards.
//  Choose any non-Hero target on the board (using
//  the Yeeting target scope) — including the top
//  of either player's Coolness Stack — and send it
//  to the discard pile. Counts as an additional
//  Action.
// ═══════════════════════════════════════════

const CARD_NAME = 'Coolness Overcharge';
const STACK_THRESHOLD = 6;

module.exports = {
  inherentAction: true,

  spellPlayCondition(gs, pi) {
    return (gs.players[pi]?.coolnessStack?.length || 0) >= STACK_THRESHOLD;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      if (engine.getCoolnessStackSize(pi) < STACK_THRESHOLD) {
        engine.gs._spellCancelled = true;
        return;
      }

      // Build the Yeeting-scope target list (every non-Hero board card,
      // plus the top of either player's Coolness Stack).
      const targets = collectTargets(engine);
      if (targets.length === 0) {
        engine.gs._spellCancelled = true;
        return;
      }

      const pick = await engine.promptEffectTarget(pi, targets, {
        title: CARD_NAME,
        description: 'Send any non-Hero card on the board (or the top of either Coolness Stack) to the discard pile.',
        confirmLabel: '⚡ Overcharge!',
        confirmClass: 'btn-danger',
        cancellable: true,
        exclusiveTypes: true,
        maxPerType: { equip: 1, ability: 1, perm: 1, area: 1, surprise: 1, coolnessStackTop: 1 },
      });
      if (!pick || pick.length === 0) {
        engine.gs._spellCancelled = true;
        return;
      }

      const sel = targets.find(t => t.id === pick[0]);
      if (!sel) { engine.gs._spellCancelled = true; return; }
      const targetInst = sel._cardInstance;

      // Pre-block immovable so we don't play the ram animation for a
      // hit that fizzles. Stack-top picks have no `_cardInstance`
      // (actionPopCoolnessStackTo handles untracking) — those skip
      // this gate.
      if (targetInst?.counters?.immovable) {
        engine.log('coolness_overcharge_blocked', { card: sel.cardName, reason: 'immovable' });
        engine.gs._spellCancelled = true;
        return;
      }

      // ── Ram animation — mirrors The Yeeting ──
      // The casting Hero (ctx.cardHeroIdx for hand-cast spells) rams
      // into the picked card's zone, then an explosion fires on the
      // impact point right before the destroy resolves.
      const hero = engine.gs.players[pi]?.heroes?.[ctx.cardHeroIdx];
      if (hero?.name && hero.hp > 0) {
        const ramTarget = sel.type === 'coolnessStackTop'
          ? { owner: sel.owner, heroIdx: -1, zoneSlot: -1, zoneType: 'coolnessStack' }
          : { owner: targetInst.owner, heroIdx: targetInst.heroIdx, zoneSlot: targetInst.zoneSlot, zoneType: targetInst.zone };

        const ramEvent = {
          sourceOwner: pi, sourceHeroIdx: ctx.cardHeroIdx,
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
          // Coolness Stack pile — owner-scoped only (no heroIdx /
          // zoneSlot). Frontend ram listener uses the same selector
          // shape as Area: `[data-{my,opp}-coolness]`.
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

      if (sel.type === 'coolnessStackTop') {
        await engine.actionPopCoolnessStackTo(sel.owner, 'discard', { source: CARD_NAME });
      } else if (targetInst) {
        if (sel.type === 'area') {
          const negated = await engine.tryAreaProtection(targetInst, { name: CARD_NAME, owner: pi }, pi);
          if (negated) {
            engine.log('coolness_overcharge_negated_by_area', { card: sel.cardName });
            engine.gs._spellFreeAction = true;
            engine.sync();
            return;
          }
        }
        await engine.actionDestroyCard({ name: CARD_NAME, owner: pi }, targetInst);
      }

      engine.gs._spellFreeAction = true;
      engine.sync();
    },
  },
};

function collectTargets(engine) {
  const gs = engine.gs;
  const targets = [];
  const seen = new Set();
  for (const inst of engine.cardInstances) {
    if (inst.zone === 'hand' || inst.zone === 'discard' || inst.zone === 'deleted'
        || inst.zone === 'hero' || inst.zone === 'deck') continue;
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);
    if (inst.zone === 'support') {
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
