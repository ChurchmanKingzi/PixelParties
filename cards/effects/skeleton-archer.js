// ═══════════════════════════════════════════
//  CARD EFFECT: "Skeleton Archer"
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  You may once per turn choose a target and deal 50 damage to it OR
//  choose a face-down Surprise and send it to the discard pile.
//
//  Single combined picker — every eligible Hero, Creature, and
//  face-down Surprise (either side) lights up at once. Whichever the
//  player clicks dictates which branch resolves:
//    • Hero / Creature  → 50 damage.
//    • Face-down Surprise → destroyed (sent to discard).
//
//  Animation: arrow projectile from Archer's slot to the target slot
//  (works for support / hero / surprise zones via the projectile
//  handler's `targetZoneType` field). The impact's "strike" flash
//  fires AFTER the projectile lands; damage / destroy happen ONLY
//  after the impact, so the visual reads as the arrow causing the
//  effect.
// ═══════════════════════════════════════════

const CARD_NAME = 'Skeleton Archer';
const DAMAGE = 50;

/**
 * Build the unified target list for Archer's activation. Mixes hero,
 * creature, and face-down-surprise targets so the player picks any of
 * them in a single click. The `_kind` field on each target tells
 * `onCreatureEffect` which branch to run after selection.
 *
 * Important: face-down Surprise IDs use the `surprise-{owner}-{hi}`
 * pattern that the client's surprise-zone render checks against
 * `validTargetIds` — using `equip-...-surprise` would NOT be
 * clickable (the surprise zone isn't a `.potion-target-...` cell
 * keyed to that id).
 */
function collectArcherTargets(engine) {
  const gs = engine.gs;
  const targets = [];

  // Heroes — every living hero, both sides.
  for (let pi = 0; pi < (gs.players || []).length; pi++) {
    const ps = gs.players[pi];
    if (!ps) continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      targets.push({
        id: `hero-${pi}-${hi}`,
        type: 'hero',
        owner: pi, heroIdx: hi,
        cardName: hero.name,
        _kind: 'damage',
      });
    }
  }

  // Creatures (face-up support-zone instances) and face-down surprises.
  for (const inst of engine.cardInstances) {
    if (inst.counters?.immovable) continue;
    if (inst.zone === 'support' && !inst.faceDown) {
      targets.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip',
        owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, _cardInstance: inst,
        _kind: 'damage',
      });
    } else if (inst.zone === 'surprise' && inst.faceDown) {
      targets.push({
        id: `surprise-${inst.owner}-${inst.heroIdx}`,
        type: 'surprise',
        owner: inst.owner, heroIdx: inst.heroIdx,
        cardName: inst.name, _cardInstance: inst,
        zoneType: 'surprise',
        _kind: 'surprise',
      });
    }
  }

  return targets;
}

/**
 * Fire the arrow projectile from Archer's slot to the target zone,
 * wait for the projectile to land, then play the impact strike.
 * Returns once the visual is at the "impact landed" frame so the
 * caller can immediately apply damage / destroy.
 */
async function flyArrow(engine, srcOwner, srcHeroIdx, srcZoneSlot, target) {
  // Resolve the target's zone descriptor for the projectile + impact.
  let targetZoneType, impactSlot;
  if (target.type === 'hero') {
    targetZoneType = undefined; // hero zone (default)
    impactSlot = -1;
  } else if (target._kind === 'surprise') {
    targetZoneType = 'surprise';
    impactSlot = -1;
  } else {
    targetZoneType = undefined; // support zone (default)
    impactSlot = target.slotIdx;
  }

  engine._broadcastEvent('play_projectile_animation', {
    sourceOwner: srcOwner,
    sourceHeroIdx: srcHeroIdx,
    sourceZoneSlot: srcZoneSlot,
    targetOwner: target.owner,
    targetHeroIdx: target.heroIdx,
    targetZoneSlot: targetZoneType ? undefined : (target._kind === 'surprise' ? undefined : impactSlot),
    targetZoneType, // 'surprise' or undefined
    // Inline SVG arrow shape (filled fletching, filled shaft, filled
    // arrowhead) — rendered by the client's projectile renderer when
    // `projectileShape === 'arrow'`, with the static `--projAngle`
    // rotation applied so the arrowhead leads throughout the flight.
    // No flame trail — arrows don't burn.
    projectileShape: 'arrow',
    noTrail: true,
    duration: 450,
  });
  await engine._delay(400);

  // Sparkles + blood impact on whichever zone was hit. The
  // `arrow_impact` zone-animation type is rendered by ANIM_REGISTRY
  // (sparkles spray + small blood droplet splatter).
  engine._broadcastEvent('play_zone_animation', {
    type: 'arrow_impact',
    owner: target.owner,
    heroIdx: target.heroIdx,
    zoneSlot: target._kind === 'surprise' ? -1 : impactSlot,
    ...(target._kind === 'surprise' ? { zoneType: 'surprise' } : {}),
  });
  await engine._delay(220);
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  requiresTarget: true,

  canActivateCreatureEffect(ctx) {
    return collectArcherTargets(ctx._engine).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const sourceOwner = ctx.cardHeroOwner;
    const sourceZoneSlot = ctx.card.zoneSlot;

    const targets = collectArcherTargets(engine);
    if (targets.length === 0) return false;

    const picked = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: `Pick a target: deal ${DAMAGE} damage to a Hero / Creature, or destroy a face-down Surprise.`,
      confirmLabel: '🏹 Shoot!',
      confirmClass: 'btn-danger',
      cancellable: true,
      exclusiveTypes: true,
      maxPerType: { hero: 1, equip: 1, surprise: 1 },
    });
    if (!picked || picked.length === 0) return false;

    const sel = targets.find(t => t.id === picked[0]);
    if (!sel) return false;

    const sourceCoord = { name: CARD_NAME, owner: pi, heroIdx };

    // Arrow + impact ALWAYS runs first; effects resolve only after
    // the projectile visibly hits.
    await flyArrow(engine, sourceOwner, heroIdx, sourceZoneSlot, sel);

    if (sel._kind === 'surprise') {
      const inst = sel._cardInstance;
      if (!inst) return false;
      await engine.actionDestroyCard(sourceCoord, inst);
      engine.log('skeleton_archer_surprise', {
        player: gs.players[pi]?.username,
        destroyed: sel.cardName,
      });
      engine.sync();
      return true;
    }

    // Damage branch — hero or creature target.
    if (sel.type === 'hero') {
      const hero = gs.players[sel.owner]?.heroes?.[sel.heroIdx];
      if (hero && hero.hp > 0) await ctx.dealDamage(hero, DAMAGE, 'creature');
    } else {
      const inst = sel._cardInstance || engine.cardInstances.find(c =>
        c.zone === 'support' && c.owner === sel.owner
        && c.heroIdx === sel.heroIdx && c.zoneSlot === sel.slotIdx,
      );
      if (inst) {
        await engine.actionDealCreatureDamage(
          sourceCoord, inst, DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
    }
    engine.log('skeleton_archer_damage', {
      player: gs.players[pi]?.username,
      target: sel.cardName,
      damage: DAMAGE,
    });
    engine.sync();
    return true;
  },
};
