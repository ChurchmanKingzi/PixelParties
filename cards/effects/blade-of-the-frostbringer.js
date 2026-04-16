// ═══════════════════════════════════════════
//  CARD EFFECT: "Blade of the Frostbringer"
//  Artifact (Equipment, Cost 5)
//
//  ① Equipped Hero gains +10 ATK.
//  ② If the equipped Hero hits exactly 1 target
//    with an Attack, that target is Frozen for
//    1 turn.
//  ③ A target cannot be Frozen in 2 consecutive
//    turns by this effect. This is handled
//    automatically by the existing thaw-immune
//    system: when a target thaws at END phase,
//    it receives a 1-turn Immune buff that
//    blocks re-freezing.
//
//  Uses afterSpellResolved (fires for both Spells
//  and Attacks) with spellCardData.cardType check
//  to restrict to Attack cards only.
//  spellCardData.cardType = card category from
//  cards.json ('Attack', 'Spell', …) — capitalized.
//  This is distinct from ctx.type in damage hooks,
//  which is the lowercase damage type tag.
// ═══════════════════════════════════════════

const ATK_BONUS = 10;
const CARD_NAME = 'Blade of the Frostbringer';

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: (ctx) => {
      ctx.grantAtk(ATK_BONUS);
    },

    onGameStart: (ctx) => {
      if ((ctx.card.counters.atkGranted || 0) > 0) return;
      ctx.grantAtk(ATK_BONUS);
    },

    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromOwner !== ctx.cardOwner || ctx.fromHeroIdx !== ctx.card.heroIdx || ctx.fromZoneSlot !== ctx.card.zoneSlot) return;
      ctx.revokeAtk();
    },

    /**
     * After an Attack fully resolves, freeze the target if exactly 1 was hit.
     *
     * ctx.spellCardData.cardType = card category ('Attack'/'Spell'/…) from cards.json.
     * ctx.damageTargets           = unique targets logged during this play.
     * ctx.heroIdx / ctx.casterIdx = who cast.
     */
    afterSpellResolved: async (ctx) => {
      // Only Attack cards
      if (!ctx.spellCardData || ctx.spellCardData.cardType !== 'Attack') return;

      // Must be cast by the hero this sword is equipped to
      if (ctx.casterIdx !== ctx.cardOwner) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;

      // Exactly 1 damage target
      const targets = ctx.damageTargets || [];
      if (targets.length !== 1) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const tgt = targets[0];

      if (tgt.type === 'hero') {
        const tgtHero = gs.players[tgt.owner]?.heroes?.[tgt.heroIdx];
        if (!tgtHero?.name || tgtHero.hp <= 0) return;
        // Immune buff (granted after thaw) blocks re-freeze automatically
        if (tgtHero.statuses?.immune || tgtHero.statuses?.freeze_immune) return;

        engine._broadcastEvent('play_zone_animation', {
          type: 'freeze', owner: tgt.owner, heroIdx: tgt.heroIdx, zoneSlot: -1,
        });
        await engine._delay(300);

        await engine.addHeroStatus(tgt.owner, tgt.heroIdx, 'frozen', {
          appliedBy: pi,
        });
        engine.log('frostbringer_freeze', { target: tgtHero.name, by: CARD_NAME });

      } else if (tgt.type === 'equip' && tgt.cardInstance) {
        const inst = tgt.cardInstance
          || engine.cardInstances.find(c =>
            c.owner === tgt.owner && c.zone === 'support' &&
            c.heroIdx === tgt.heroIdx && c.zoneSlot === tgt.slotIdx
          );
        if (!inst || inst.zone !== 'support') return;
        if (inst.counters.frozen) return;
        if (!engine.canApplyCreatureStatus(inst, 'frozen')) return;

        engine._broadcastEvent('play_zone_animation', {
          type: 'freeze', owner: tgt.owner, heroIdx: tgt.heroIdx, zoneSlot: tgt.slotIdx,
        });
        await engine._delay(300);

        inst.counters.frozen = 1;
        engine.log('frostbringer_freeze', { target: inst.name, by: CARD_NAME });
      }

      engine.sync();
    },
  },
};
