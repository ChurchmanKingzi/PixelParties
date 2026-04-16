// ═══════════════════════════════════════════
//  CARD EFFECT: "Earth-Shattering Hammer, Relic of Deri"
//  Artifact (Equipment, Cost 10)
//
//  ① Equipped Hero gains +10 ATK.
//  ② When equipped to "Layn, Defender of Deri",
//    marks her as ascension-ready for
//    "Layn, Master of Deri's Relic".
//    Cleared when the last copy is unequipped.
//  ③ Whenever the equipped Hero hits exactly
//    1 Hero with an Attack, the player may
//    choose a card in one of that Hero's
//    Support Zones and send it to the discard
//    pile. All protection systems (Gate Shield,
//    Monia, immovable) apply via actionDestroyCard.
// ═══════════════════════════════════════════

const CARD_NAME     = 'Earth-Shattering Hammer, Relic of Deri';
const ATK_BONUS     = 10;
const BASE_LAYN     = 'Layn, Defender of Deri';
const ASCEND_TARGET = 'Layn, Master of Deri\'s Relic';

/** Set ascension flags on Layn's hero object. */
function enableAscension(hero) {
  hero.ascensionReady  = true;
  hero.ascensionTarget = ASCEND_TARGET;
}

/** Clear ascension flags if no other Hammer remains on this hero. */
function maybeDisableAscension(engine, pi, heroIdx, excludeInstId) {
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (!hero || hero.name !== BASE_LAYN) return;

  const otherHammer = engine.cardInstances.some(c =>
    c.id !== excludeInstId &&
    c.name === CARD_NAME &&
    c.owner === pi &&
    c.zone === 'support' &&
    c.heroIdx === heroIdx,
  );

  if (!otherHammer) {
    delete hero.ascensionReady;
    delete hero.ascensionTarget;
  }
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    // ── Equip: grant ATK + enable ascension if on Layn ──────────────────

    onPlay: (ctx) => {
      ctx.grantAtk(ATK_BONUS);
      const hero = ctx.attachedHero;
      if (hero?.name === BASE_LAYN) enableAscension(hero);
    },

    onGameStart: (ctx) => {
      if ((ctx.card.counters.atkGranted || 0) > 0) return;
      ctx.grantAtk(ATK_BONUS);
      const hero = ctx.attachedHero;
      if (hero?.name === BASE_LAYN) enableAscension(hero);
    },

    // ── Unequip: revoke ATK + clear ascension if last Hammer ─────────────

    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromOwner !== ctx.cardOwner || ctx.fromHeroIdx !== ctx.card.heroIdx || ctx.fromZoneSlot !== ctx.card.zoneSlot) return;
      ctx.revokeAtk();
      maybeDisableAscension(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx, ctx.card.id);
    },

    // ── After an Attack resolves: offer to destroy a support zone card ────

    afterSpellResolved: async (ctx) => {
      if (!ctx.spellCardData || ctx.spellCardData.cardType !== 'Attack') return;
      if (ctx.casterIdx !== ctx.cardOwner || ctx.heroIdx !== ctx.cardHeroIdx) return;

      // Exactly 1 Hero target (not a creature)
      const targets = ctx.damageTargets || [];
      if (targets.length !== 1 || targets[0].type !== 'hero') return;

      const engine    = ctx._engine;
      const gs        = engine.gs;
      const pi        = ctx.cardOwner;
      const tgt       = targets[0];
      const tgtOwner  = tgt.owner;
      const tgtHeroIdx = tgt.heroIdx;

      // Build list of cards in the target hero's support zones
      const supportTargets = [];
      const supportZones = gs.players[tgtOwner]?.supportZones?.[tgtHeroIdx] || [];
      for (let si = 0; si < supportZones.length; si++) {
        const slot = supportZones[si] || [];
        if (slot.length === 0) continue;
        const inst = engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === si,
        );
        if (!inst) continue;
        supportTargets.push({
          id: `equip-${tgtOwner}-${tgtHeroIdx}-${si}`,
          type: 'equip',
          owner: tgtOwner,
          heroIdx: tgtHeroIdx,
          slotIdx: si,
          cardName: slot[0],
          cardInstance: inst,
        });
      }

      if (supportTargets.length === 0) return;

      // Prompt: optionally choose a card to destroy
      const selectedIds = await engine.promptEffectTarget(pi, supportTargets, {
        title: CARD_NAME,
        description: `Choose a card in ${gs.players[tgtOwner]?.heroes?.[tgtHeroIdx]?.name}'s Support Zone to send to the discard pile.`,
        confirmLabel: '🔨 Destroy!',
        confirmClass: 'btn-danger',
        cancellable: true,
        maxTotal: 1,
        minRequired: 1,
      });

      if (!selectedIds || selectedIds.length === 0) return;

      const chosen = supportTargets.find(t => t.id === selectedIds[0]);
      if (!chosen?.cardInstance) return;

      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion',
        owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: chosen.slotIdx,
      });
      await engine._delay(400);

      await engine.actionDestroyCard(
        { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx },
        chosen.cardInstance,
      );

      engine.log('hammer_destroy', {
        player: gs.players[pi]?.username,
        destroyed: chosen.cardName,
        targetHero: gs.players[tgtOwner]?.heroes?.[tgtHeroIdx]?.name,
      });
      engine.sync();
    },
  },
};
