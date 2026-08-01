// ═══════════════════════════════════════════
//  CARD EFFECT: "Blood Moon under the Sea"
//  Artifact (Equipment, Cost 6)
//
//  Whenever a Creature is returned from one of
//  the equipped Hero's Support Zones to your
//  hand, deal 50 damage to any target on the
//  board. One trigger per returned Creature
//  (no once-per-turn gate).
//
//  Wiring: listens on `onCardsReturnedToHand`,
//  the same hook Siphem (the Deepsea Demon) uses.
//  Filters:
//    • Hand-return ownership: ctx.ownerIdx must
//      match this Artifact's controller — "your
//      hand" in card text.
//    • Origin hero: uses ctx.fromHeroIdxs (added
//      to the hook by _deepsea-shared.js) to
//      restrict to creatures that left the
//      equipped Hero's Support Zones specifically.
//    • Card type: only Creatures count (matches
//      the literal text; rules out Artifact-only
//      batch returns from Shu'Chaku).
//
//  The damage prompt is gated `cancellable: true`
//  as a safety net — if every legal target has
//  evaporated mid-resolution (rare), the player
//  can dismiss the prompt without softlock.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Blood Moon under the Sea';

module.exports = {
  isEquip: true,
  activeIn: ['support'],

  hooks: {
    onCardsReturnedToHand: async (ctx) => {
      const engine = ctx._engine;
      const selfInst = ctx.card;

      // "to your hand" — only fires when the returned cards land in
      // the Blood Moon controller's hand.
      if (ctx.ownerIdx !== selfInst.owner) return;

      const returnedInsts = ctx.returnedInsts || [];
      if (returnedInsts.length === 0) return;
      const fromHeroIdxs = ctx.fromHeroIdxs || [];

      const cardDB = engine._getCardDB();

      // Count matching returns: a Creature whose origin hero equals
      // this Blood Moon's equipped hero. Fallback to inst.heroIdx
      // covers any caller that doesn't pass fromHeroIdxs (legacy /
      // future paths where inst coords are still intact at fire time).
      let matches = 0;
      for (let i = 0; i < returnedInsts.length; i++) {
        const inst = returnedInsts[i];
        if (!inst) continue;
        const fromHi = (fromHeroIdxs[i] !== undefined && fromHeroIdxs[i] >= 0)
          ? fromHeroIdxs[i]
          : inst.heroIdx;
        if (fromHi !== selfInst.heroIdx) continue;
        const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        matches++;
      }
      if (matches === 0) return;

      // One damage prompt per matching return — sequential, so the
      // player can pick different targets across a multi-return batch.
      for (let m = 0; m < matches; m++) {
        const target = await ctx.promptDamageTarget({
          side: 'any', types: ['hero', 'creature'],
          damageType: 'creature',
          baseDamage: 50,
          title: CARD_NAME,
          description: 'Deal 50 damage to a target.',
          confirmLabel: '🌑 50 Damage!',
          confirmClass: 'btn-danger',
          cancellable: true,
        });
        if (!target) continue;

        engine._broadcastEvent('play_zone_animation', {
          type: 'blood_moon_pulse',
          owner: selfInst.owner, heroIdx: selfInst.heroIdx, zoneSlot: selfInst.zoneSlot,
        });
        engine._broadcastEvent('play_zone_animation', {
          type: 'orbital_laser_red', owner: target.owner,
          heroIdx: target.heroIdx,
          zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
        });
        await engine._delay(900);

        if (target.type === 'hero') {
          const tHero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
          if (tHero?.name && tHero.hp > 0) {
            await ctx.dealDamage(tHero, 50, 'creature');
          }
        } else if (target.cardInstance) {
          await engine.actionDealCreatureDamage(
            selfInst, target.cardInstance, 50, 'creature',
            { sourceOwner: selfInst.owner, canBeNegated: true },
          );
        }
        engine.log('blood_moon_damage', {
          source: CARD_NAME, target: target.cardName, damage: 50,
        });
      }
      engine.sync();
    },
  },
};
