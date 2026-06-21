// ═══════════════════════════════════════════
//  CARD EFFECT: "Chaorc Pyre Grill Master"
//  Creature (Summoning Magic Lv1, 50 HP)
//
//  "If you have sacrificed more Creatures this turn so far than you
//   have summoned, summoning this Creature counts as an additional
//   Action. You may once per turn sacrifice a Creature you control that
//   was not summoned this turn to permanently increase the Attack stats
//   of all Heroes both players control by 40 OR their current and max
//   HP by 80 each."
//
//   • Free-summon clause → `inherentAction` as a function (the
//     Aggressive Town Guard pattern). It compares the engine's two
//     per-turn tallies; the summon-tally hasn't counted THIS summon yet
//     at the gate, so "more sacrificed than summoned so far" is exactly
//     `_creaturesSacrificedThisTurn > _creaturesSummonedThisTurn`.
//
//   • Active clause → sacrifice (shared Chaorc filter) then a symmetric,
//     permanent global buff the player chooses between.
// ═══════════════════════════════════════════

const { chaorcSacrificeFilter, chaorcFreshSacCandidates } = require('./_chaorcs-shared');

const CARD_NAME = 'Chaorc Pyre Grill Master';

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  // "counts as an additional Action" when ahead on sacrifices.
  inherentAction: (gs, pi) => {
    const ps = gs.players[pi];
    return !!ps && (ps._creaturesSacrificedThisTurn || 0) > (ps._creaturesSummonedThisTurn || 0);
  },

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    return chaorcFreshSacCandidates(engine, ctx.cardOwner, ctx.card.id).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];

    const paid = await engine.resolveSacrificeCost(ctx, {
      minCount: 1,
      maxCount: 1,
      title: `${CARD_NAME} — Sacrifice`,
      description: 'Sacrifice 1 of your Creatures (not summoned this turn) to empower every Hero on the battlefield.',
      confirmLabel: '🔥 Burn on the Pyre!',
      confirmClass: 'btn-danger',
      cancellable: true,
      filter: chaorcSacrificeFilter(engine),
      // The tribute is burned on the stake — engulf it in flames instead
      // of the default knife-plunge. Slightly longer hold so the fire
      // fully reads before the Creature is consumed.
      sacrificeAnimation: 'flame_strike',
      sacrificeAnimationDelay: 650,
    });
    if (!paid) return false;

    const result = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      title: CARD_NAME,
      description: 'Choose a permanent boon for ALL Heroes both players control:',
      options: [
        { id: 'atk', label: '⚔️ +40 Attack to every Hero' },
        { id: 'hp', label: '❤️ +80 current and max HP to every Hero' },
      ],
      cancellable: false,
      gerrymanderEligible: true,
    });
    const mode = result?.optionId || 'atk';

    // Apply to every living Hero on BOTH sides (symmetric by design).
    for (let p = 0; p < 2; p++) {
      const heroes = gs.players[p]?.heroes || [];
      for (let hi = 0; hi < heroes.length; hi++) {
        const hero = heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (mode === 'atk') {
          engine._applyHeroAtkDelta(hero, p, hi, 40);
        } else {
          engine.increaseMaxHp(hero, 80, { alsoHealCurrent: true });
        }
      }
    }

    engine.log('pyre_grill_master', { player: ps.username, mode });
    engine.sync();
    return true;
  },

  cpuMeta: {
    onDeathBenefit: 6,
  },
};
