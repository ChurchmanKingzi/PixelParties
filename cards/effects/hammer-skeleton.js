// ═══════════════════════════════════════════
//  CARD EFFECT: "Hammer Skeleton"
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  You may once per turn choose a Spell attached to a Hero or an Area
//  in play and send it to the discard pile.
//
//  Targets:
//    • Attachment-subtype Spells living in any Hero's Support Zone
//      (either side).
//    • Area-zone cards (subtype: 'Area'), either side.
//
//  Resolution: actionDestroyCard, which routes the card through the
//  ON_CREATURE_DEATH / onCardLeaveZone pipeline → discard pile (NOT
//  the deleted pile, since the text says "send to the discard pile").
// ═══════════════════════════════════════════

const CARD_NAME = 'Hammer Skeleton';

/**
 * Walks both sides for valid Hammer Skeleton targets:
 *   • Attachment-subtype Spells (zone='support').
 *   • Area-subtype Spells in `gs.areaZones` (zone='area').
 * Skips immovable instances and ability-zone cards (those aren't
 * Spells and the rules text restricts to Spells + Areas).
 */
function collectTargets(engine) {
  const gs = engine.gs;
  const cardDB = engine._getCardDB();
  const targets = [];
  for (const inst of engine.cardInstances) {
    if (inst.counters?.immovable) continue;
    const cd = cardDB[inst.name];
    if (!cd) continue;
    if (cd.cardType !== 'Spell') continue;
    const sub = (cd.subtype || '').toLowerCase();
    if (inst.zone === 'support' && sub === 'attachment') {
      targets.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip',
        owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'area' && sub === 'area') {
      const arr = gs.areaZones?.[inst.owner] || [];
      // Multiple Area instances stack visually onto the top entry —
      // mirror The Yeeting / Antonia's "top of area only" filter so
      // we don't surface two pickable copies of the same area.
      if (arr.length > 0 && arr[arr.length - 1] !== inst.name) continue;
      targets.push({
        id: `area-${inst.owner}`,
        type: 'area', owner: inst.owner, heroIdx: -1,
        cardName: inst.name, _cardInstance: inst,
      });
    }
  }
  return targets;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  requiresTarget: true,

  canActivateCreatureEffect(ctx) {
    return collectTargets(ctx._engine).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const targets = collectTargets(engine);
    if (targets.length === 0) return false;

    const picked = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: 'Pick a Spell attached to a Hero or an Area in play. Send it to the discard pile.',
      confirmLabel: '🔨 Smash!',
      confirmClass: 'btn-danger',
      cancellable: true,
      exclusiveTypes: true,
      maxPerType: { equip: 1, area: 1 },
    });
    if (!picked || picked.length === 0) return false;
    const sel = targets.find(t => t.id === picked[0]);
    if (!sel?._cardInstance) return false;

    // Reuse Magic Hammer's existing animation — same hammer-strike
    // visual the player already associates with smashing things. The
    // play_zone_animation handler resolves the target by zoneType:
    // 'support' (default for an equip target) → support slot at
    // (owner, heroIdx, zoneSlot); 'area' → the player's Area zone.
    //
    // For area targets we override `h` to a smaller value than the
    // actual zone rect (the rect is the same `--zone-h` as a hero
    // zone, but the magic_hammer effect's drop offset assumes the
    // hammer hits the TOP edge of the target — which visually
    // floats above an area card sitting alone in mid-board). A
    // smaller `h` reduces `marginTop = -h/2 - hammerH`, so the
    // hammer lands further down — overlapping the upper portion of
    // the area card instead of hovering above it. The override is
    // forwarded by `play_zone_animation` → `playAnimation` via
    // `...rest`, which spreads after the DOM-rect defaults so it
    // wins.
    if (sel.type === 'area') {
      engine._broadcastEvent('play_zone_animation', {
        type: 'magic_hammer',
        owner: sel.owner,
        heroIdx: -1, zoneSlot: -1,
        zoneType: 'area',
        h: 40,
      });
    } else {
      engine._broadcastEvent('play_zone_animation', {
        type: 'magic_hammer',
        owner: sel.owner,
        heroIdx: sel.heroIdx,
        zoneSlot: sel.slotIdx,
      });
    }
    // Match Magic Hammer's timing — the strike lands ~900ms in.
    await engine._delay(900);

    // Area protection window — Wowhalla & any future Area protector
    // gets a chance to negate before the destroy lands.
    if (sel.type === 'area') {
      const negated = await engine.tryAreaProtection(
        sel._cardInstance,
        { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx },
        pi,
      );
      if (negated) {
        engine.log('hammer_skeleton_negated_by_area', { card: sel.cardName });
        engine.sync();
        return true;
      }
    }

    await engine.actionDestroyCard(
      { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx },
      sel._cardInstance,
    );
    engine.log('hammer_skeleton', {
      player: engine.gs.players[pi]?.username,
      destroyed: sel.cardName,
      zone: sel._cardInstance.zone,
    });
    engine.sync();
    return true;
  },
};
