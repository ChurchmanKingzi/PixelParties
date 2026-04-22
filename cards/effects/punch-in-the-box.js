// ═══════════════════════════════════════════
//  CARD EFFECT: "Punch in the Box"
//  Potion (Reaction) — After-damage reaction.
//  When a target you control takes damage from
//  an opponent's card or effect, choose any
//  target the opponent controls and deal half
//  that damage (rounded up) to it.
//
//  Uses the after-damage reaction system
//  (like Fireshield) but lets the player pick
//  any opponent target instead of auto-retaliating.
//
//  Animation: boxing glove hitting from the side.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  isAfterDamageReaction: true,
  isPotion: true,

  // CPU reactive-fire decision. Default would be "fire on every damage"
  // which wastes Punch on small chip damage when a big hit is imminent.
  // Heuristic: if the incoming damage is 100+ (Punch returns 50+), always
  // fire. If smaller AND the opponent still has fresh creatures or an
  // open Action Phase (hero atk available), decline and wait — Punch
  // stays in hand for the next (likely larger) damage instance.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type !== 'confirm') return undefined;
    const msgMatch = /took (\d+) damage/.exec(promptData.message || '');
    const incoming = msgMatch ? parseInt(msgMatch[1], 10) : 0;
    // Fire threshold: 100+ incoming (=> 50+ recoil) is always worth it.
    if (incoming >= 100) return true;
    const gs = engine.gs;
    const pi = engine._cpuPlayerIdx;
    const oppIdx = pi === 0 ? 1 : 0;
    const oppPs = gs?.players?.[oppIdx];
    if (!oppPs) return true; // can't inspect → take the sure recoil
    // Is a larger hit plausibly still coming this turn?
    // (a) Any opp creature on board that hasn't attacked yet?
    const hasFreshCreature = engine.cardInstances?.some(c =>
      c.owner === oppIdx && c.zone === 'support' && !c.faceDown
      && !c.counters?.attackedThisTurn
    );
    // (b) Any opp hero with significant atk that hasn't acted?
    const hasThreateningHero = (oppPs.heroes || []).some(h =>
      h?.name && h.hp > 0
      && !h.statuses?.frozen && !h.statuses?.stunned
      && (h.atk || 0) >= 100
      && !(oppPs.heroesAttackedThisTurn || []).includes(
          (oppPs.heroes || []).indexOf(h)
        )
    );
    // Defer if more damage likely incoming.
    if (hasFreshCreature || hasThreateningHero) return null;
    // Opp has nothing big left — take the small hit while we can.
    return true;
  },

  // Not proactively usable — grayed out in hand via unactivatableArtifacts
  canActivate: () => false,

  /**
   * Triggers on ANY opponent damage to our hero.
   * Source must be an opponent's card/effect (any type).
   */
  afterDamageCondition(gs, pi, engine, target, targetHeroIdx, source, amount, type) {
    // Source must be from the opponent
    const srcOwner = source?.owner ?? source?.controller ?? -1;
    if (srcOwner < 0 || srcOwner === pi) return false;
    // Damage must be > 0 (already guaranteed by the system, but be safe)
    if (amount <= 0) return false;
    return true;
  },

  async afterDamageResolve(engine, pi, target, targetHeroIdx, source, amount, type) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const oppIdx = pi === 0 ? 1 : 0;
    const oppPs = gs.players[oppIdx];
    if (!oppPs) return;

    const recoil = Math.ceil(amount / 2);
    const cardDB = engine._getCardDB();

    // Build valid opponent targets (heroes + creatures)
    const targets = [];

    // Opponent heroes
    for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
      const hero = oppPs.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      targets.push({
        id: `hero-${oppIdx}-${hi}`,
        type: 'hero',
        owner: oppIdx,
        heroIdx: hi,
        cardName: hero.name,
      });
    }

    // Opponent creatures
    for (const inst of engine.cardInstances) {
      if (inst.owner !== oppIdx || inst.zone !== 'support' || inst.faceDown) continue;
      const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      const hp = inst.counters?.currentHp ?? cd.hp ?? 0;
      if (hp <= 0) continue;
      targets.push({
        id: `equip-${oppIdx}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip',
        owner: oppIdx,
        heroIdx: inst.heroIdx,
        slotIdx: inst.zoneSlot,
        cardName: inst.name,
        cardInstance: inst,
      });
    }

    if (targets.length === 0) return;

    // Prompt player to choose target
    const selectedIds = await engine.promptEffectTarget(pi, targets, {
      title: 'Punch in the Box',
      description: `Deal ${recoil} recoil damage (half of ${amount}) to an opponent's target.`,
      confirmLabel: `🥊 Punch! (${recoil})`,
      confirmClass: 'btn-danger',
      cancellable: false,
      maxPerType: { hero: 1, equip: 1 },
    });

    if (!selectedIds || selectedIds.length === 0) return;

    const chosen = targets.find(t => t.id === selectedIds[0]);
    if (!chosen) return;

    // Boxing glove animation on the chosen target
    engine._broadcastEvent('punch_box_animation', {
      targetOwner: chosen.owner,
      targetHeroIdx: chosen.heroIdx,
      targetZoneSlot: chosen.type === 'hero' ? -1 : chosen.slotIdx,
    });
    await engine._delay(800);

    // Deal recoil damage — temporarily clear the after-damage lock so the
    // opponent can chain their own after-damage reactions (e.g. their own Punch)
    engine._inAfterDamageReaction = false;
    if (chosen.type === 'hero') {
      const hero = oppPs.heroes?.[chosen.heroIdx];
      if (hero && hero.hp > 0) {
        await engine.actionDealDamage(
          { name: 'Punch in the Box', owner: pi },
          hero, recoil, 'other'
        );
      }
    } else if (chosen.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: 'Punch in the Box', owner: pi },
        chosen.cardInstance, recoil, 'other',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('punch_recoil', {
      player: ps.username,
      target: chosen.cardName,
      originalDamage: amount,
      recoilDamage: recoil,
    });

    engine.sync();
  },
};
