// ═══════════════════════════════════════════
//  CARD EFFECT: "Rocket Fist"
//  Attack (Fighting, Lv1, Normal)   (Banned)
//
//  "Choose a target and deal damage equal to the attacker's Attack
//   stat to it. If this damage defeats the target, add this card back
//   to your hand instead of sending it to your discard pile."
//
//  Wiring:
//   • A plain Attack, rolled manually (rather than via
//     `ctx.executeAttack`) so the custom projectile fires BETWEEN the
//     target pick and the damage. "The attacker" = the casting Hero,
//     so the damage is that Hero's current ATK.
//   • Animation: a fist with a rocket-engine exhaust (`🤜` +
//     `rocket-fist-trail`) launches from the casting Hero and rams
//     into the target — `play_projectile_animation`.
//   • The recursion rider: if the hit defeats the target, set
//     `gs._spellReturnToHand` — the server's doPlaySpell routing then
//     returns Rocket Fist to the caster's hand instead of discard.
//   • A cancelled target pick sets `gs._spellCancelled` so the card
//     goes back to hand with nothing spent.
// ═══════════════════════════════════════════

const CARD_NAME = 'Rocket Fist';

module.exports = {

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero || hero.hp <= 0) { gs._spellCancelled = true; return; }

      const atkPreview = Math.max(0, hero.atk || 0);

      // ── Choose the target ──
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: atkPreview,
        title: CARD_NAME,
        description: "Deal damage equal to the attacker's Attack stat to a target.",
        confirmLabel: `🚀 Rocket Fist! (${atkPreview})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        // The attacking Hero can't rocket-punch itself.
        condition: (t) => !(t.type === 'hero' && t.owner === pi && t.heroIdx === heroIdx),
      });
      // Cancelled (promptDamageTarget already set _spellCancelled).
      if (!target) { gs._spellCancelled = true; return; }

      // Resolve the live target — a reaction window could have moved
      // or killed it.
      let tHero = null, tInst = null;
      if (target.type === 'hero') {
        tHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (!tHero || tHero.hp <= 0) { engine.sync(); return; }
      } else if (target.cardInstance) {
        tInst = engine.cardInstances.find(c => c.id === target.cardInstance.id);
        if (!tInst || tInst.zone !== 'support') { engine.sync(); return; }
      } else {
        engine.sync();
        return;
      }

      // Pre-resolution hook (Doq's guess, future "when this Hero
      // attacks" effects) fires AFTER target pick but BEFORE the
      // projectile + impact + damage. Listeners may mutate the
      // about-to-deal damage.
      const baseDamage = Math.max(0, hero.atk || 0);
      const source = { name: CARD_NAME, owner: pi, heroIdx, controller: pi, usesHeroAtk: true };
      const damage = await engine._fireAttackDeclare(source, target, baseDamage);

      // ── Rocket Fist projectile ──
      // A fist with a rocket-engine exhaust launches from the casting
      // Hero and rams into the target.
      const tgtHeroIdx = tInst ? tInst.heroIdx : target.heroIdx;
      const tgtZoneSlot = tInst ? tInst.zoneSlot : undefined;
      engine._broadcastEvent('play_projectile_animation', {
        sourceOwner: pi, sourceHeroIdx: heroIdx,
        targetOwner: target.owner, targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
        emoji: '🤜',
        trailClass: 'rocket-fist-trail',
        emojiStyle: {
          fontSize: '42px',
          filter: 'drop-shadow(0 0 8px #ffd24a) drop-shadow(0 0 16px #ff7a00)',
        },
        duration: 500,
      });
      await engine._delay(440); // fist reaches the target (~85% of 500ms)

      // Impact at the moment of contact.
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: target.owner,
        heroIdx: tgtHeroIdx, zoneSlot: tInst ? tgtZoneSlot : -1,
      });
      await engine._delay(180);

      // ── Damage, equal to the attacker's Attack stat (post-declare modifications) ──
      let defeated = false;
      if (tHero) {
        await engine.actionDealDamage(source, tHero, damage, 'attack');
        const live = gs.players[target.owner]?.heroes?.[target.heroIdx];
        defeated = !live || live.hp <= 0;
      } else if (tInst) {
        await engine.actionDealCreatureDamage(
          source, tInst, damage, 'attack',
          { sourceOwner: pi, canBeNegated: true },
        );
        const live = engine.cardInstances.find(c => c.id === tInst.id);
        defeated = !live || live.zone !== 'support' || (live.counters?.currentHp ?? 1) <= 0;
      }

      // If this hit defeated the target, Rocket Fist returns to hand
      // instead of the discard pile (server doPlaySpell routing).
      if (defeated) {
        gs._spellReturnToHand = true;
        engine.log('rocket_fist_return', {
          player: gs.players[pi]?.username, target: target.cardName || target.type,
        });
      }
      engine.sync();
    },
  },
};
