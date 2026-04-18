// ═══════════════════════════════════════════
//  CARD EFFECT: "Critical Strike"
//  Attack (Fighting Lv3, Normal) — BANNED in
//  standard format; still resolves if played.
//
//  Deal damage equal to TWICE the attacking
//  hero's current ATK stat to a chosen target.
//  Uses the signature `critical_slash` animation
//  — a huge cross-cut slash, glint, shockwave,
//  gold-red "CRITICAL!" text, and a spark fan.
// ═══════════════════════════════════════════

const CARD_NAME = 'Critical Strike';
const ATK_MULT = 2;

module.exports = {
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
      const damage = atk * ATK_MULT;

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: damage,
        title: CARD_NAME,
        description: `Deal ${damage} damage (${ATK_MULT}× current ATK) to a target.`,
        confirmLabel: `💢 CRITICAL! (${damage})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => !(t.type === 'hero' && t.owner === pi && t.heroIdx === heroIdx),
      });
      if (!target) return;

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;
      const impactSlot = target.type === 'hero' ? -1 : target.slotIdx;

      // Very fast ram — the cut is the hero-moment, not the approach.
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: ctx.cardHeroOwner, sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
        cardName: hero.name, duration: 420,
      });
      await engine._delay(60);

      // Signature cross-cut animation.
      engine._broadcastEvent('play_zone_animation', {
        type: 'critical_slash', owner: tgtOwner,
        heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
      });
      await engine._delay(200);

      const attackSource = { name: CARD_NAME, owner: pi, heroIdx, controller: pi };
      if (target.type === 'hero') {
        const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await engine.actionDealDamage(attackSource, tgtHero, damage, 'attack');
        }
      } else if (target.type === 'equip' || target.cardInstance) {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            attackSource, inst, damage, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }
      await engine._delay(350);

      engine.log('critical_strike', {
        player: ps.username, hero: hero.name,
        target: target.cardName, damage,
      });
      engine.sync();
    },
  },
};
