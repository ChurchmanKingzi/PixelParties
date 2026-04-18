// ═══════════════════════════════════════════
//  CARD EFFECT: "Siphem, the Deepsea Demon"
//  Hero (400 HP, 100 ATK, Decay Magic + Leadership)
//
//  Passives + activated:
//   • Whenever you return 1+ cards from your
//     side of the board to your hand, place 1
//     Deepsea Counter on this Hero.
//   • Once per turn, remove any number of
//     Deepsea Counters to choose a target and
//     deal 50 × N damage to it.
//
//  Counter storage: hero.deepseaCounters (int).
//  UI renders a badge next to the hero when > 0.
//  Counters persist across turns — there is no
//  automatic end-of-turn wipe.
// ═══════════════════════════════════════════

const { addDeepseaCounters } = require('./_deepsea-shared');

const CARD_NAME = 'Siphem, the Deepsea Demon';

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  // Counter-gated activation.
  canActivateHeroEffect(ctx) {
    const hero = ctx.attachedHero;
    return !!(hero && (hero.deepseaCounters || 0) > 0);
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    const count = hero.deepseaCounters || 0;
    if (count <= 0) return false;

    // Prompt: how many counters?
    const options = [];
    for (let n = 1; n <= count; n++) {
      options.push({ id: `n-${n}`, label: `Remove ${n} Counter${n > 1 ? 's' : ''} — ${50 * n} damage` });
    }
    const optRes = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      title: CARD_NAME,
      description: `You have ${count} Deepsea Counter${count > 1 ? 's' : ''}. Remove how many?`,
      options,
      cancellable: true,
    });
    if (!optRes || optRes.cancelled || !optRes.optionId) return false;
    const match = optRes.optionId.match(/^n-(\d+)$/);
    if (!match) return false;
    const n = parseInt(match[1]);
    if (n <= 0 || n > count) return false;
    const damage = 50 * n;

    const target = await ctx.promptDamageTarget({
      side: 'any', types: ['hero', 'creature'],
      damageType: 'creature',
      title: CARD_NAME,
      description: `Deal ${damage} damage to a target.`,
      confirmLabel: `☠️ ${damage} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    hero.deepseaCounters = count - n;
    if (hero.deepseaCounters <= 0) delete hero.deepseaCounters;

    // Orbital laser strike — red beam lances down from the top of the
    // screen onto the chosen target, flashes on impact, then damage
    // resolves. Delay matches the beam's charge (~260ms) + travel
    // (~520ms) + impact flash (~580ms) so damage numbers land on the
    // post-impact frame.
    engine._broadcastEvent('play_zone_animation', {
      type: 'orbital_laser_red', owner: target.owner,
      heroIdx: target.heroIdx, zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
    });
    await engine._delay(900);

    if (target.type === 'hero') {
      const tHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (tHero?.name && tHero.hp > 0) {
        await ctx.dealDamage(tHero, damage, 'creature');
      }
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        ctx.card, target.cardInstance, damage, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }
    engine.log('siphem_damage', {
      player: gs.players[pi]?.username, countersRemoved: n, damage,
    });
    engine.sync();
    return true;
  },

  hooks: {
    // Add a counter whenever OUR cards return to hand.
    onCardsReturnedToHand: async (ctx) => {
      if (ctx.ownerIdx !== ctx.cardOriginalOwner) return;
      const engine = ctx._engine;
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;
      addDeepseaCounters(hero, 1);
      engine._broadcastEvent('play_zone_animation', {
        type: 'pollution_place', owner: ctx.cardOriginalOwner,
        heroIdx: ctx.cardHeroIdx, zoneSlot: -1,
      });
      engine.log('siphem_counter_add', {
        player: engine.gs.players[ctx.cardOriginalOwner]?.username,
        counters: hero.deepseaCounters,
      });
      engine.sync();
    },

  },
};
