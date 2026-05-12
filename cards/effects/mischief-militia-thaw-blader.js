// ═══════════════════════════════════════════
//  CARD EFFECT: "Mischief Militia - Thaw Blader"
//  Creature — Summoning Magic Lv1, 50 HP
//
//  Once per turn (PER INSTANCE — engine's default
//  `creatureEffect` HOPT key is `creature-effect:
//  ${inst.id}`, so two Thaw Bladers each get their
//  own activation), choose a Frozen target on the
//  board and deal 200 damage to it. If you do,
//  heal it from its Freeze (cleanse only Frozen —
//  other negative statuses stay).
//
//  Haste — Thaw Blader can use this effect the
//  turn it was summoned. We set `inst.counters.
//  _hasHaste = true` in `onPlay`; the engine's
//  summoning-sickness gate (`turnPlayed === turn
//  && !counters._hasHaste`) lets the activation
//  through while keeping `inst.turnPlayed`
//  accurate so Alice / Hive's Crown / Bomblebee
//  filters still see the Creature as fresh.
// ═══════════════════════════════════════════

const CARD_NAME = 'Mischief Militia - Thaw Blader';
const DAMAGE = 200;

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,

  cpuMeta: {
    onDeathBenefit: 0,
  },

  hooks: {
    onPlay: async (ctx) => {
      const inst = ctx.card;
      if (!inst || ctx.playedCard?.id !== inst.id) return;
      if (inst.zone !== 'support') return;
      // Grant Haste on summon — keep turnPlayed accurate (Alice etc.
      // still read "summoned this turn").
      inst.counters._hasHaste = true;
    },
  },

  canActivateCreatureEffect(ctx) {
    // Need at least one Frozen target on the board.
    const engine = ctx._engine;
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      if (inst.counters?.frozen) return true;
    }
    for (let pi = 0; pi < 2; pi++) {
      const ps = engine.gs.players[pi];
      if (!ps) continue;
      for (const hero of (ps.heroes || [])) {
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.statuses?.frozen) return true;
      }
    }
    return false;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const sourceOwner = ctx.cardHeroOwner;

    // Build picker: every Frozen target (hero or creature, either side).
    const candidates = [];
    for (let pIdx = 0; pIdx < 2; pIdx++) {
      const ps = gs.players[pIdx];
      if (!ps) continue;
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (!hero.statuses?.frozen) continue;
        candidates.push({
          id: `hero-${pIdx}-${hi}`,
          type: 'hero',
          owner: pIdx,
          heroIdx: hi,
          cardName: hero.name,
        });
      }
    }
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      if (!inst.counters?.frozen) continue;
      candidates.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip',
        owner: inst.owner,
        heroIdx: inst.heroIdx,
        slotIdx: inst.zoneSlot,
        cardName: inst.name,
        cardInstance: inst,
      });
    }
    if (candidates.length === 0) return false;

    const picked = await engine.promptEffectTarget(pi, candidates, {
      title: CARD_NAME,
      description: `Choose a Frozen target. Deal ${DAMAGE} damage to it and free it from Freeze.`,
      confirmLabel: `🗡️ ${DAMAGE} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
      maxTotal: 1,
    });
    if (!picked || picked.length === 0) return false;

    const target = candidates.find(t => t.id === picked[0]);
    if (!target) return false;

    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;

    // Flame slash — diagonal sword slash wreathed in fire and heat,
    // landing directly on the target. The sword IS the slash visual,
    // so no separate projectile precedes it.
    engine._broadcastEvent('play_zone_animation', {
      type: 'flame_slash', owner: target.owner,
      heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
    });
    await engine._delay(450);

    // Deal damage. The cleanse runs AFTER so a lethal hit doesn't bother
    // cleansing a corpse, but a survivor visibly thaws.
    if (target.type === 'hero') {
      const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (tgtHero && tgtHero.hp > 0) {
        await ctx.dealDamage(tgtHero, DAMAGE, 'creature');
        if (tgtHero.hp > 0 && tgtHero.statuses?.frozen) {
          engine.cleanseHeroStatuses(tgtHero, target.owner, target.heroIdx, ['frozen'], CARD_NAME);
        }
      }
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx },
        target.cardInstance, DAMAGE, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
      const stillAlive = engine.cardInstances.find(c => c.id === target.cardInstance.id && c.zone === 'support');
      if (stillAlive && stillAlive.counters?.frozen) {
        engine.cleanseCreatureStatuses(stillAlive, ['frozen'], CARD_NAME);
      }
    }

    engine.log('thaw_blader', {
      player: gs.players[pi]?.username,
      target: target.cardName,
      damage: DAMAGE,
    });
    engine.sync();
    return true;
  },
};
