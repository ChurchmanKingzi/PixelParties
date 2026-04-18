// ═══════════════════════════════════════════
//  CARD EFFECT: "Thieving Strike"
//  Attack (Fighting Lv2, Normal)
//
//  Deal damage equal to the attacking hero's
//  current ATK stat to a chosen target. If an
//  opponent-controlled target took ≥1 damage
//  from the hit, the attacker is sent to a
//  blind-pick on the opponent's face-down hand
//  and steals the card they click. The picker
//  is cancellable.
//
//  If the attacking hero has the "Thieving"
//  Ability (any level), the Fighting-Lv2 level
//  requirement is waived (canBypassLevelReq).
//
//  Hand-disruption rules fizzle on Turn 1 — the
//  shared stealCardsFromOpponent helper enforces
//  the first-turn shield and the empty-hand
//  short-circuit, so Thieving Strike itself just
//  calls in.
// ═══════════════════════════════════════════

const CARD_NAME = 'Thieving Strike';

/** True if the given hero has any copy of "Thieving" in its Ability zones. */
function _heroHasThieving(ps, heroIdx) {
  const zones = ps?.abilityZones?.[heroIdx];
  if (!Array.isArray(zones)) return false;
  for (const slot of zones) {
    if (!Array.isArray(slot)) continue;
    for (const ability of slot) {
      if (ability === 'Thieving') return true;
    }
  }
  return false;
}

/** Current controller of a target resolved across steals / charms. */
function _targetControllerIdx(gs, target) {
  if (target.type === 'hero') {
    const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero) return target.owner;
    return hero.charmedBy ?? hero.controlledBy ?? target.owner;
  }
  if (target.cardInstance) {
    return target.cardInstance.controller ?? target.cardInstance.owner;
  }
  return target.owner;
}

function _snapshotHp(gs, target) {
  if (target.type === 'hero') {
    return gs.players[target.owner]?.heroes?.[target.heroIdx]?.hp ?? 0;
  }
  if (target.cardInstance) {
    return target.cardInstance.counters?.currentHp ?? 0;
  }
  return 0;
}

module.exports = {
  /**
   * Level-requirement bypass — the attacker's Thieving Ability makes
   * this Attack behave as Lv0 for the Spell School gate. Any copy of
   * the Thieving Ability qualifies (the ability itself scales in
   * strength per level, but the bypass clause doesn't).
   */
  canBypassLevelReq: (gs, pi, heroIdx) => {
    return _heroHasThieving(gs.players[pi], heroIdx);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const atk = hero.atk || 0;

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: atk,
        title: CARD_NAME,
        description: `Deal ${atk} damage (current ATK) to a target.`,
        confirmLabel: `🗡️ Strike! (${atk})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => !(t.type === 'hero' && t.owner === pi && t.heroIdx === heroIdx),
      });
      if (!target) return;

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;
      const impactSlot = target.type === 'hero' ? -1 : target.slotIdx;

      // Ram + cut — same presentation Quick Attack uses.
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: ctx.cardHeroOwner, sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
        cardName: hero.name, duration: 600,
      });
      await engine._delay(80);
      engine._broadcastEvent('play_zone_animation', {
        type: 'quick_slash', owner: tgtOwner,
        heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
      });
      await engine._delay(100);

      // Snapshot HP pre-damage so we can decide whether the steal fires.
      const prevHp = _snapshotHp(gs, target);
      const wasOppControlled = _targetControllerIdx(gs, target) !== pi;

      const attackSource = { name: CARD_NAME, owner: pi, heroIdx, controller: pi };
      if (target.type === 'hero') {
        const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await engine.actionDealDamage(attackSource, tgtHero, atk, 'attack');
        }
      } else if (target.type === 'equip' || target.cardInstance) {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            attackSource, inst, atk, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }
      await engine._delay(300);

      // Did damage actually land? Hero's `.hp` drops; creature's
      // `.counters.currentHp` drops (or zeroes out on death).
      const postHp = _snapshotHp(gs, target);
      const damageDealt = Math.max(0, prevHp - postHp);

      engine.log('thieving_strike', {
        player: ps.username, hero: hero.name,
        target: target.cardName, damage: damageDealt,
      });

      // Steal gate: opp-controlled target AND ≥1 damage landed. The
      // helper covers the rest (empty hand, first-turn protection,
      // cancellable blind pick).
      if (wasOppControlled && damageDealt > 0) {
        await engine.actionStealFromHand(pi, {
          count: 1,
          title: `${CARD_NAME} — Steal`,
          description: 'Click one face-down card in your opponent\'s hand to steal it, or Cancel.',
          confirmLabel: '🫳 Steal!',
          sourceName: CARD_NAME,
          cancellable: true,
        });
      }

      engine.sync();
    },
  },
};
