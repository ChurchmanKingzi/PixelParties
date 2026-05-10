// ═══════════════════════════════════════════
//  CARD EFFECT: "Gravedigger Slap"
//  Attack (Normal, Lv2, Fighting) — BANNED
//
//  Choose a target and deal damage equal to
//  40 × (number of Creatures in your own discard
//  pile) to it. Single-target only — explicitly
//  cannot hit more than 1 target even under
//  multi-target boosters.
//
//  Implementation:
//   • `requiresTarget: true` — Blinded gating.
//   • `onPlay` builds the count via the same
//     `hasCardType('Creature')` filter the rest
//     of the codebase uses, then runs the
//     standard `promptDamageTarget` single-pick.
//     `damageType: 'attack'` so Phalanx Pike /
//     attack-blockers gate normally and the
//     Surprise window opens via the standard
//     `actionDealDamage` path.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Gravedigger Slap';
const PER_CREATURE_DAMAGE = 40;

function countCreaturesInOwnDiscard(engine, ps) {
  if (!ps?.discardPile) return 0;
  const cardDB = engine._getCardDB();
  let n = 0;
  for (const cn of ps.discardPile) {
    const cd = cardDB[cn];
    if (cd && hasCardType(cd, 'Creature')) n++;
  }
  return n;
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
          ? `Deal ${damage} damage (${PER_CREATURE_DAMAGE} × ${count} Creatures in your discard pile) to a target.`
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

      engine._broadcastEvent('play_zone_animation', {
        type: 'red_cut', owner: tgtOwner,
        heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
      });
      await engine._delay(250);

      const attackSource = { name: CARD_NAME, owner: pi, heroIdx, controller: pi };
      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          await engine.actionDealDamage(attackSource, targetHero, damage, 'attack');
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support'
          && c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx,
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            attackSource, inst, damage, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }

      engine.log('gravedigger_slap', {
        player: ps.username, hero: hero.name,
        target: target.cardName, damage, creaturesInDiscard: count,
      });
      engine.sync();
    },
  },
};
