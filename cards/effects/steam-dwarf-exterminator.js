// ═══════════════════════════════════════════
//  CARD EFFECT: "Steam Dwarf Exterminator"
//  Creature (Summoning Magic Lv1, archetype
//  "Steam Dwarfs") — 50 HP.
//
//  ① STEAM ENGINE passive (shared): once per
//    turn, when you discard 1+ cards, gain +50
//    current & max HP.
//  ② Once per turn: deal damage equal to this
//    Creature's current HP (capped at 200) to any
//    target. Doused in flamethrower fire.
// ═══════════════════════════════════════════

const { attachSteamEngine } = require('./_steam-dwarf-shared');

const CARD_NAME = 'Steam Dwarf Exterminator';
const DAMAGE_CAP = 200;

module.exports = attachSteamEngine({
  creatureEffect: true,

  /**
   * Activation gate: creature must exist with current HP > 0. The
   * engine already handles summoning sickness and HOPT per instance,
   * so we only need the positive-HP check here.
   */
  canActivateCreatureEffect(ctx) {
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    if (inst.counters?.negated || inst.counters?.nulled) return false;
    const cd = ctx._engine._getCardDB()[inst.name];
    const curHp = inst.counters?.currentHp ?? cd?.hp ?? 0;
    return curHp > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;

    const cd = engine._getCardDB()[inst.name];
    const curHp = inst.counters?.currentHp ?? cd?.hp ?? 0;
    const damage = Math.min(DAMAGE_CAP, Math.max(0, curHp));
    if (damage <= 0) return false;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      title: CARD_NAME,
      description: `Spray a target with flames for ${damage} damage (equal to this Creature's current HP, max ${DAMAGE_CAP}).`,
      confirmLabel: `🔥 Flamethrower! (${damage})`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    const tgtOwner = target.owner;
    const tgtHeroIdx = target.heroIdx;
    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;

    // Flamethrower douse — spray of flame on the target
    engine._broadcastEvent('play_zone_animation', {
      type: 'flamethrower_douse',
      owner: tgtOwner,
      heroIdx: tgtHeroIdx,
      zoneSlot: tgtZoneSlot,
    });
    await engine._delay(650);

    if (target.type === 'hero') {
      const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
      if (tgtHero && tgtHero.hp > 0) {
        await ctx.dealDamage(tgtHero, damage, 'creature');
      }
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx },
        target.cardInstance, damage, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('steam_exterminator_damage', {
      player: gs.players[pi]?.username,
      target: target.cardName, damage,
    });
    engine.sync();
    return true;
  },
});
