// ═══════════════════════════════════════════
//  CARD EFFECT: "Firewall"
//  Spell (Surprise) — Destruction Magic Lv3
//
//  Activate when the host Hero is hit by an Attack,
//  Spell, or Creature effect. Deal 100 damage to
//  the Attacker AND apply a permanent Burn (rest
//  of the game).
//
//  When the attacker is a Creature, both the
//  damage and the Burn hit the Creature, not its
//  host Hero. When the attacker is a Hero, both
//  hit that Hero.
//
//  Unlike Booby Trap, Firewall does NOT cancel
//  the triggering Attack/Spell/Creature effect
//  even if its retaliation kills the attacker —
//  the original effect still resolves on the host
//  Hero. (Booby Trap returns `{ effectNegated:
//  true }` on a kill; Firewall always returns
//  `null`.)
//
//  Animation: tall wall of flames erupting from the
//  ground around the host Hero (the surprise's owner)
//  before the impact resolves on the attacker.
// ═══════════════════════════════════════════

const CARD_NAME = 'Firewall';
const DAMAGE    = 100;

module.exports = {
  isSurprise: true,

  surpriseTrigger: (gs, ownerIdx, heroIdx, sourceInfo, engine) => {
    if (sourceInfo.owner < 0 || sourceInfo.heroIdx < 0) return false;

    const srcInst = sourceInfo.cardInstance;
    if (srcInst?.zone === 'support') {
      // Creature attacker — alive?
      const cd = engine._getCardDB()[srcInst.name];
      const hp = srcInst.counters?.currentHp ?? cd?.hp ?? 1;
      return hp > 0;
    }
    // Hero attacker — alive?
    const attacker = gs.players[sourceInfo.owner]?.heroes?.[sourceInfo.heroIdx];
    return attacker && attacker.hp > 0;
  },

  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const gs     = engine.gs;
    const cardDB = engine._getCardDB();

    // ── Wall-of-flames animation on the host Hero who set up the Surprise ──
    engine._broadcastEvent('play_zone_animation', {
      type: 'firewall', owner: ctx.cardOwner,
      heroIdx: ctx.cardHeroIdx, zoneSlot: -1,
    });
    await engine._delay(800);

    // ── Telekinesis branch (player picks any target) ──
    if (sourceInfo.telekinesis) {
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: DAMAGE,
        title: CARD_NAME,
        description: `Deal ${DAMAGE} damage to any target and Burn it.`,
        confirmLabel: `🔥 ${DAMAGE} + Burn!`,
        confirmClass: 'btn-danger',
        cancellable: false,
        noSpellCancel: true,
      });
      if (!target) return null;

      const tSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'flame_strike', owner: target.owner,
        heroIdx: target.heroIdx, zoneSlot: tSlot,
      });
      await engine._delay(400);

      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await ctx.dealDamage(tgtHero, DAMAGE, 'destruction_spell');
          if (tgtHero.hp > 0) {
            await engine.addHeroStatus(target.owner, target.heroIdx, 'burned', {
              permanent: true, appliedBy: ctx.cardOwner, _skipReactionCheck: true,
            });
          }
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: ctx.cardOwner, heroIdx: ctx.cardHeroIdx },
          target.cardInstance, DAMAGE, 'destruction_spell',
          { sourceOwner: ctx.cardOwner, canBeNegated: true }
        );
        if ((target.cardInstance.counters?.currentHp ?? 1) > 0
            && engine.canApplyCreatureStatus(target.cardInstance, 'burned')) {
          target.cardInstance.counters.burned = true;
          engine.log('creature_burned', {
            card: target.cardInstance.name, owner: target.cardInstance.owner, by: CARD_NAME,
          });
        }
      }
      engine.sync();
      await engine._delay(300);
      return null; // No effect negation in telekinesis mode.
    }

    const srcInst = sourceInfo.cardInstance;
    const isCreatureSource = srcInst?.zone === 'support';

    if (isCreatureSource) {
      // ── Creature attacker ──
      const creatureCd = cardDB[srcInst.name];
      const creatureMaxHp = creatureCd?.hp || 0;
      const creatureHp = srcInst.counters?.currentHp ?? creatureMaxHp;
      if (creatureHp <= 0) return null;

      engine._broadcastEvent('play_zone_animation', {
        type: 'flame_strike', owner: srcInst.owner,
        heroIdx: srcInst.heroIdx, zoneSlot: srcInst.zoneSlot,
      });
      await engine._delay(400);

      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: ctx.cardOwner, heroIdx: ctx.cardHeroIdx },
        srcInst, DAMAGE, 'destruction_spell',
        { sourceOwner: ctx.cardOwner, canBeNegated: true }
      );

      // Burn the creature if it survived
      if ((srcInst.counters?.currentHp ?? 0) > 0
          && engine.canApplyCreatureStatus(srcInst, 'burned')) {
        srcInst.counters.burned = true;
        engine.log('creature_burned', {
          card: srcInst.name, owner: srcInst.owner, by: CARD_NAME,
        });
      }
      engine.sync();
      await engine._delay(300);
      // Per card text: even if the retaliation killed the creature, the
      // triggering effect still resolves. No `effectNegated` return.
    } else {
      // ── Hero attacker (spell / attack) ──
      const attackerOwner = sourceInfo.owner;
      const attackerHeroIdx = sourceInfo.heroIdx;
      const attacker = gs.players[attackerOwner]?.heroes?.[attackerHeroIdx];
      if (!attacker || attacker.hp <= 0) return null;

      engine._broadcastEvent('play_zone_animation', {
        type: 'flame_strike', owner: attackerOwner,
        heroIdx: attackerHeroIdx, zoneSlot: -1,
      });
      await engine._delay(400);

      await ctx.dealDamage(attacker, DAMAGE, 'destruction_spell');

      // Burn if still alive
      if (attacker.hp > 0) {
        await engine.addHeroStatus(attackerOwner, attackerHeroIdx, 'burned', {
          permanent: true, appliedBy: ctx.cardOwner, _skipReactionCheck: true,
        });
      }

      engine.sync();
      await engine._delay(300);
      // Per card text: the triggering Attack/Spell still resolves on
      // the host Hero, even if Firewall's recoil killed the attacker.
    }

    return null;
  },
};
