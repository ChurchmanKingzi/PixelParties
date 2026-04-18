// ═══════════════════════════════════════════
//  CARD EFFECT: "Pollution Spewer"
//  Artifact (subtype: Creature) — Cost 10, 50 HP
//  Pollution archetype.
//
//  Placed into the free Support Zone of a Hero you
//  control, functioning as a Creature for targeting
//  and damage purposes.
//
//  Once per turn (HOPT, per-instance), when a
//  Pollution Token is removed from YOUR side of
//  the board, you MAY choose a target and deal 80
//  damage to it. This is optional — the player
//  can decline without using up the HOPT.
//
//  Reacts to the custom 'onPollutionTokenRemoved'
//  hook fired by _pollution-shared's
//  removePollutionTokens() + the Pollution Token's
//  own onCardLeaveZone.
// ═══════════════════════════════════════════

const CARD_NAME = 'Pollution Spewer';

module.exports = {
  // This card lives in the Support Zone but is NOT an equip (it doesn't
  // grant stat bonuses). It functions structurally as a Creature, and its
  // cardType: 'Artifact'/subtype: 'Creature' marks it as a hybrid. The
  // hand limit & immunity systems read cardType; the targeting system
  // looks at cardType for "Creature" — and since this card has subtype
  // 'Creature', hasCardType() will pick it up (it walks subtype too).
  activeIn: ['support'],

  hooks: {
    /**
     * Reactive ability: when a Pollution Token is removed from our side,
     * prompt the controller to deal 80 damage to a target.
     *
     * HOPT is tracked per-instance (multiple Spewers → multiple triggers
     * per turn, but each individual Spewer is once-per-turn). Uses the
     * standard `hoptUsed` flag so that Divine Gift of Balance's reset
     * behaves correctly.
     */
    onPollutionTokenRemoved: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const ownerIdx = ctx.ownerIdx;

      // Only react when a token was removed from OUR side.
      if (ownerIdx !== ctx.cardOwner) return;

      // Per-instance HOPT — use the card instance's unique id so two
      // Spewers on the same side each get their own once-per-turn.
      const hoptKey = `pollution_spewer:${ctx.card.id}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) return;

      // Controller may decline — make the prompt cancellable. If declined,
      // we DON'T mark HOPT as used (the player keeps their reaction for a
      // later token removal this turn).
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'artifact',
        baseDamage: 80,
        title: 'Pollution Spewer',
        description: 'A Pollution Token was removed! Deal 80 damage to a target, or decline to save this reaction.',
        confirmLabel: '💨 80 Damage!',
        confirmClass: 'btn-danger',
        cancellable: true,
      });

      if (!target) return; // Declined — HOPT preserved

      // Mark HOPT
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[hoptKey] = gs.turn;

      const tgtSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: target.owner,
        heroIdx: target.heroIdx, zoneSlot: tgtSlot,
      });
      await engine._delay(400);

      // Deal 80 damage. Type 'artifact' is the canonical tag for
      // artifact-sourced damage.
      if (target.type === 'hero') {
        const h = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (h && h.hp > 0) {
          await ctx.dealDamage(h, 80, 'artifact');
        }
      } else if (target.type === 'equip' && target.cardInstance) {
        await engine.processCreatureDamageBatch([{
          inst: target.cardInstance,
          amount: 80,
          type: 'artifact',
          source: { name: CARD_NAME, owner: ctx.cardOwner, heroIdx: ctx.cardHeroIdx },
          sourceOwner: ctx.cardOwner,
          canBeNegated: true,
          isStatusDamage: false,
          animType: null,
        }]);
      }

      engine.log('pollution_spewer_damage', {
        player: gs.players[ctx.cardOwner]?.username,
        target: target.cardName, damage: 80,
      });
      engine.sync();
    },
  },
};
