// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of Equality"
//  Spell (Support Magic Lv1, Normal)
//
//  Once per game (shared "Divine Gift" key).
//  Choose a defeated Hero you control that has no
//  Spell School Abilities attached to it AND any
//  target on the board. Halve the second target's
//  HP (rounded up), then revive your defeated Hero
//  with current and max HP equal to the HP the
//  second target has left.
//
//  HP halving is a direct manipulation (no damage
//  event fires), so Smug Coin / Anti-Magic etc.
//  do not react. The post-halve HP becomes the
//  authoritative anchor for the revive.
// ═══════════════════════════════════════════

const SPELL_SCHOOLS = new Set([
  'Destruction Magic', 'Support Magic', 'Magic Arts',
  'Decay Magic', 'Summoning Magic',
]);

function heroHasSpellSchoolAbility(ps, heroIdx) {
  const abZones = ps?.abilityZones?.[heroIdx] || [];
  for (const slot of abZones) {
    if (!slot || slot.length === 0) continue;
    if (SPELL_SCHOOLS.has(slot[0])) return true;
  }
  return false;
}

function getDeadOwnedTargetsNoSchool(gs, pi) {
  const ps = gs.players[pi];
  const targets = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name) continue;
    if (hero.hp > 0) continue;
    if (hero._originalOwner !== undefined && hero._originalOwner !== pi) continue;
    if (heroHasSpellSchoolAbility(ps, hi)) continue;
    targets.push({
      id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi,
      cardName: hero.name,
    });
  }
  return targets;
}

function buildAnyTargetList(engine) {
  const gs = engine.gs;
  const targets = [];
  for (let p = 0; p < (gs.players || []).length; p++) {
    const ps = gs.players[p];
    if (!ps) continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (h?.name && h.hp > 0) {
        targets.push({
          id: `hero-${p}-${hi}`, type: 'hero', owner: p, heroIdx: hi, cardName: h.name,
        });
      }
      for (let z = 0; z < 3; z++) {
        const slot = ps.supportZones?.[hi]?.[z] || [];
        if (slot.length === 0) continue;
        const inst = engine.cardInstances.find(c =>
          c.owner === p && c.zone === 'support' &&
          c.heroIdx === hi && c.zoneSlot === z
        );
        if (!inst) continue;
        targets.push({
          id: `equip-${p}-${hi}-${z}`, type: 'equip', owner: p,
          heroIdx: hi, slotIdx: z, cardName: slot[0], cardInstance: inst,
        });
      }
    }
  }
  return targets;
}

module.exports = {
  oncePerGame: true,
  oncePerGameKey: 'divineGift',

  spellPlayCondition(gs, pi, engine) {
    if (getDeadOwnedTargetsNoSchool(gs, pi).length === 0) return false;
    return buildAnyTargetList(engine).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Step 1: pick own dead hero with no Spell School abilities.
      const reviveTargets = getDeadOwnedTargetsNoSchool(gs, pi);
      if (reviveTargets.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      const revivePick = await engine.promptEffectTarget(pi, reviveTargets, {
        title: 'Divine Gift of Equality',
        description: 'Choose a defeated Hero you control with no Spell School Abilities to revive.',
        confirmLabel: '⚖️ Revive!',
        confirmClass: 'btn-success',
        cancellable: true,
        greenSelect: true,
        exclusiveTypes: true,
        maxPerType: { hero: 1 },
        maxTotal: 1,
      });
      if (!revivePick || revivePick.length === 0) {
        gs._spellCancelled = true;
        return;
      }
      const reviveT = reviveTargets.find(t => t.id === revivePick[0]);
      if (!reviveT) { gs._spellCancelled = true; return; }

      // Step 2: pick second target (any target on the board).
      const allTargets = buildAnyTargetList(engine);
      if (allTargets.length === 0) {
        gs._spellCancelled = true;
        return;
      }
      const secondPick = await engine.promptEffectTarget(pi, allTargets, {
        title: 'Divine Gift of Equality',
        description: 'Choose any target on the board. Its HP will be halved (rounded up), and your Hero revives with the leftover HP.',
        confirmLabel: '⚖️ Halve!',
        confirmClass: 'btn-info',
        cancellable: false,
        exclusiveTypes: true,
        maxPerType: { hero: 1, equip: 1 },
        maxTotal: 1,
      });
      if (!secondPick || secondPick.length === 0) {
        // Cost not yet committed (no resources spent). Refund.
        gs._spellCancelled = true;
        return;
      }
      const secondT = allTargets.find(t => t.id === secondPick[0]);
      if (!secondT) { gs._spellCancelled = true; return; }

      // Compute halved HP for the second target.
      let leftover = 0;
      const cardDB = engine._getCardDB();
      if (secondT.type === 'hero') {
        const tgtHero = gs.players[secondT.owner]?.heroes?.[secondT.heroIdx];
        if (!tgtHero || tgtHero.hp <= 0) { gs._spellCancelled = true; return; }
        // Resistance gate. The halving is a non-damage HP mutation
        // (it's not routed through actionDealDamage), so neither the
        // damage path nor `actionHealHero`'s `beforeHeroEffect` gate
        // would catch it. Fire the hook explicitly; on cancel, no
        // leftover → no revive (the cost is still consumed, matching
        // every other "Resistance absorbed your effect" outcome).
        const halveCtx = {
          playerIdx: secondT.owner, heroIdx: secondT.heroIdx, hero: tgtHero,
          effectType: 'halve', cancelled: false, _skipReactionCheck: true,
        };
        await engine.runHooks('beforeHeroEffect', halveCtx);
        if (halveCtx.cancelled) {
          engine.log('divine_gift_equality_blocked', { target: tgtHero.name, reason: 'resistance' });
          engine.sync();
          return;
        }
        leftover = Math.ceil(tgtHero.hp / 2);
        engine._broadcastEvent('play_zone_animation', {
          type: 'gold_sparkle', owner: secondT.owner, heroIdx: secondT.heroIdx, zoneSlot: -1,
        });
        await engine._delay(500);
        tgtHero.hp = leftover;
      } else {
        const inst = secondT.cardInstance || engine.cardInstances.find(c =>
          c.owner === secondT.owner && c.zone === 'support' &&
          c.heroIdx === secondT.heroIdx && c.zoneSlot === secondT.slotIdx
        );
        if (!inst) { gs._spellCancelled = true; return; }
        const cd = cardDB[inst.name];
        const baseHp = inst.counters.maxHp ?? cd?.hp ?? 0;
        const currentHp = inst.counters.currentHp ?? baseHp;
        if (currentHp <= 0) { gs._spellCancelled = true; return; }
        leftover = Math.ceil(currentHp / 2);
        engine._broadcastEvent('play_zone_animation', {
          type: 'gold_sparkle', owner: secondT.owner, heroIdx: secondT.heroIdx, zoneSlot: secondT.slotIdx,
        });
        await engine._delay(500);
        inst.counters.currentHp = leftover;
      }

      engine.log('divine_gift_equality_halve', {
        target: secondT.cardName, leftover,
      });
      engine.sync();

      // Revive the chosen dead hero with current = max = leftover.
      // `maxHpCap: leftover` sets `hero.maxHpCapped = leftover`, locking
      // future increases to that ceiling — matches the Resuscitation /
      // Death pattern. The revive HP is also leftover.
      if (leftover > 0) {
        await engine.actionReviveHero(pi, reviveT.heroIdx, leftover, {
          maxHpCap: leftover,
          source: 'Divine Gift of Equality',
        });
      } else {
        // Edge case: target had 1 HP halved-up still 1, leftover = 1. Should never be 0 in practice.
        engine.log('divine_gift_equality_no_revive', { reason: 'leftover is 0' });
      }

      engine.log('divine_gift_equality', {
        player: ps.username,
        revived: reviveT.cardName,
        target: secondT.cardName,
        leftover,
      });
      engine.sync();
    },
  },
};
