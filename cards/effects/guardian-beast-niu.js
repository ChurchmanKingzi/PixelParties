// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian Beast Niu" (Ox)
//  Creature (Summoning Magic Lv0, 60 HP).
//  Archetype: Guardian Beasts.
//
//  EFFECT (once/turn): delete up to 5 cards from
//    the discard piles → choose one of YOUR
//    Heroes. That Hero gains a "Niu-Enhanced"
//    buff carrying +50 damage per card deleted.
//    The buff is consumed by the Hero's next
//    Attack damage event (engine handles this
//    in `actionDealDamage` / `processCreatureDamage
//    Batch`) and otherwise expires at the start
//    of the opponent's next turn (= functional
//    "end of this turn"). Multiple Niu activations
//    on the same Hero stack: the buff's
//    `totalDamage` and `stacks` accumulate.
//
//  Niu does NOT need to remain on the board —
//  the buff lives on the chosen Hero, not on
//  Niu's instance, so Niu dying mid-turn doesn't
//  cancel the bonus.
//
//  Stacking semantics: the same buff key
//  (`niu_enhanced`) is reused; we read the existing
//  buff's totalDamage/stacks and merge before
//  re-applying. `actionAddBuff` overwrites the
//  whole entry, so the merge has to happen here.
// ═══════════════════════════════════════════

const {
  canSummonGuardianBeast,
  inherentActionForFirstSummon,
  promptAndDeleteFromBothDiscards,
  rangeValidCounts,
} = require('./_guardian-beasts-shared');

const CARD_NAME = 'Guardian Beast Niu';
const MAX_DELETE = 5;
const DAMAGE_PER_CARD = 50;
const BUFF_NAME = 'niu_enhanced';

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: canSummonGuardianBeast,
  inherentAction: (gs, pi) => inherentActionForFirstSummon(gs, pi),

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const total = (engine.gs.players[0]?.discardPile?.length || 0)
      + (engine.gs.players[1]?.discardPile?.length || 0);
    if (total < 1) return false;
    // Need at least one alive own Hero to receive the buff.
    const ps = engine.gs.players[pi];
    return (ps?.heroes || []).some(h => h?.name && h.hp > 0);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;
    const total = (gs.players[0]?.discardPile?.length || 0)
      + (gs.players[1]?.discardPile?.length || 0);
    const cap = Math.min(MAX_DELETE, total);
    if (cap <= 0) return false;

    // Step 1 — pick which of your alive Heroes gets the buff.
    const heroTargets = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      heroTargets.push({
        id: `hero-${pi}-${hi}`, type: 'hero',
        owner: pi, heroIdx: hi, cardName: h.name,
      });
    }
    if (heroTargets.length === 0) return false;
    let buffHeroIdx;
    if (heroTargets.length === 1) {
      buffHeroIdx = heroTargets[0].heroIdx;
    } else {
      const pickIds = await engine.promptEffectTarget(pi, heroTargets, {
        title: CARD_NAME,
        description: `Choose which of your Heroes receives the Niu-Enhanced buff (+${DAMAGE_PER_CARD} per deleted card on its next Attack).`,
        confirmLabel: '🐃 Enhance',
        confirmClass: 'btn-info',
        cancellable: true,
        maxTotal: 1, minSelect: 1,
        exclusiveTypes: false,
      });
      if (!pickIds || pickIds.length === 0) return false;
      const picked = heroTargets.find(t => t.id === pickIds[0]);
      if (!picked) return false;
      buffHeroIdx = picked.heroIdx;
    }
    const buffHero = ps.heroes[buffHeroIdx];
    if (!buffHero) return false;

    // Step 2 — pay the cost. Click 1-cap cards directly in the gallery.
    const deleted = await promptAndDeleteFromBothDiscards(ctx, {
      validCounts: rangeValidCounts(cap),
      title: CARD_NAME,
      description: `Pick 1-${cap} cards from the discard piles to delete. ${buffHero.name} will gain +${DAMAGE_PER_CARD} damage per deleted card on its next Attack.`,
      sourceName: CARD_NAME,
      cancellable: true,
    });
    if (!deleted || deleted.length === 0) return false;
    const earned = deleted.length * DAMAGE_PER_CARD;

    // Step 3 — apply the buff. Stacking: read existing data and merge
    // before calling actionAddBuff (which overwrites the whole entry).
    const existing = buffHero.buffs?.[BUFF_NAME];
    const newTotal = (existing?.totalDamage || 0) + earned;
    const newStacks = (existing?.stacks || 0) + 1;
    // Expire at the START of the opponent's next turn (= functional
    // "end of THIS turn" — buff doesn't survive into a fresh own turn).
    const oi = pi === 0 ? 1 : 0;
    await engine.actionAddBuff(buffHero, pi, buffHeroIdx, BUFF_NAME, {
      totalDamage: newTotal,
      stacks: newStacks,
      perCardBonus: DAMAGE_PER_CARD,
      source: CARD_NAME,
      expiresAtTurn: gs.turn + 1,
      expiresForPlayer: oi,
      addAnim: 'niu_powerup',
    });

    engine.log('guardian_beast_niu_buff', {
      player: ps.username, hero: buffHero.name,
      deleted: deleted.length, addedBonus: earned,
      totalBonus: newTotal, stacks: newStacks,
    });
    engine.sync();
    return true;
  },
};
