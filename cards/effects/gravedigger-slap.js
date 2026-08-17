// ═══════════════════════════════════════════
//  CARD EFFECT: "Gravedigger Slap"
//  Attack (Normal, Lv2, Fighting) — BANNED
//
//  Choose a target and deal damage equal to
//  40 × (number of Creatures with DIFFERENT
//  NAMES in your own discard pile) to it.
//  Single-target only — explicitly cannot hit
//  more than 1 target even under multi-target
//  boosters.
//
//  Implementation:
//   • `requiresTarget: true` — Blinded gating.
//   • `onPlay` builds the distinct-name count
//     via the same `hasCardType('Creature')`
//     filter the rest of the codebase uses, then
//     runs the standard `promptDamageTarget`
//     single-pick. `damageType: 'attack'` so
//     Phalanx Pike / attack-blockers gate
//     normally and the Surprise window opens
//     via the standard `actionDealDamage` path.
// ═══════════════════════════════════════════

const { isPileCreature, hasCardType } = require('./_hooks');

const CARD_NAME = 'Gravedigger Slap';
const PER_CREATURE_DAMAGE = 40;

/**
 * Count DISTINCT Creature card names in `ps`'s own discard pile.
 * Duplicates fold into one tick — the card text says "Creatures
 * with different names in your discard pile", so a pile of
 * [Skeleton, Skeleton, Goblin] counts as 2, not 3.
 */
function countCreaturesInOwnDiscard(engine, ps) {
  if (!ps?.discardPile) return 0;
  const cardDB = engine._getCardDB();
  const seen = new Set();
  for (const cn of ps.discardPile) {
    if (seen.has(cn)) continue;
    const cd = cardDB[cn];
    if (cd && isPileCreature(cd)) seen.add(cn);
  }
  return seen.size;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js.

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const count = countCreaturesInOwnDiscard(engine, ps);
      const damage = PER_CREATURE_DAMAGE * count;

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: damage,
        title: CARD_NAME,
        description: damage > 0
          ? `Deal ${damage} damage (${PER_CREATURE_DAMAGE} × ${count} different-named Creature${count === 1 ? '' : 's'} in your discard pile) to a target.`
          : `Your discard pile has no Creatures — this Attack would deal 0 damage. Pick a target anyway?`,
        confirmLabel: `⚰️ Slap! (${damage})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => !(t.type === 'hero' && t.owner === pi && t.heroIdx === heroIdx),
      });

      if (!target) return;

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const impactSlot = target.type === 'hero' ? -1 : (target.slotIdx ?? -1);

      // Pre-resolution hook (Doq's guess, future "when this Hero
      // attacks" effects) fires AFTER target pick but BEFORE the
      // animation + damage. Listeners may mutate the about-to-deal
      // damage.
      const attackSource = { name: CARD_NAME, owner: pi, heroIdx, controller: pi };
      const finalDmg = await engine._fireAttackDeclare(attackSource, target, damage);

      engine._broadcastEvent('play_zone_animation', {
        type: 'red_cut', owner: tgtOwner,
        heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
      });
      await engine._delay(250);

      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          await engine.actionDealDamage(attackSource, targetHero, finalDmg, 'attack');
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support'
          && c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx,
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            attackSource, inst, finalDmg, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }

      engine.log('gravedigger_slap', {
        player: ps.username, hero: hero.name,
        target: target.cardName, damage: finalDmg, creaturesInDiscard: count,
      });
      engine.sync();
    },
  },
};
