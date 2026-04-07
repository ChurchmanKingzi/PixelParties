// ═══════════════════════════════════════════
//  CARD EFFECT: "Acid Vial"
//  Potion — Deal 150 unreducible, unredirectable,
//  unnegatable damage to any target (Hero or
//  Creature). Breaks through all protection
//  EXCEPT turn-1 protection.
//  Damage type: 'other'.
//  Hard once per turn.
//  Animation: red acid splash on target.
// ═══════════════════════════════════════════

const { HOOKS, hasCardType } = require('./_hooks');

module.exports = {
  isPotion: true,

  canActivate(gs, playerIdx) {
    // Hard once per turn
    const hoptKey = `acid-vial:${playerIdx}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    // At least one targetable hero must exist (not turn-1 protected)
    for (let pi = 0; pi < 2; pi++) {
      if (gs.firstTurnProtectedPlayer === pi) continue;
      for (const hero of (gs.players[pi]?.heroes || [])) {
        if (hero?.name && hero.hp > 0) return true;
      }
    }
    return false;
  },

  getValidTargets(gs, playerIdx, engine) {
    const targets = [];
    const cardDB = engine ? engine._getCardDB() : {};
    for (let pi = 0; pi < 2; pi++) {
      const ps = gs.players[pi];

      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        targets.push({
          id: `hero-${pi}-${hi}`,
          type: 'hero',
          owner: pi,
          heroIdx: hi,
          cardName: hero.name,
        });
      }

      // Creatures in support zones
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        if (!ps.heroes[hi]?.name || ps.heroes[hi].hp <= 0) continue;
        for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
          const slot = (ps.supportZones[hi] || [])[si] || [];
          if (slot.length === 0) continue;
          const cd = cardDB[slot[0]];
          if (!cd || cd.cardType !== 'Creature') continue;
          targets.push({
            id: `equip-${pi}-${hi}-${si}`,
            type: 'equip',
            owner: pi,
            heroIdx: hi,
            slotIdx: si,
            cardName: slot[0],
          });
        }
      }
    }
    return targets;
  },

  targetingConfig: {
    title: 'Acid Vial',
    description: 'Deal 150 unreducible damage to any target. Bypasses all protection.',
    confirmLabel: '🧪 Splash! (150)',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1, equip: 1 },
  },

  validateSelection(selectedIds, validTargets) {
    return selectedIds && selectedIds.length === 1;
  },

  animationType: 'acid_splash',

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return;
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return;

    const gs = engine.gs;
    const DAMAGE = 150;

    // Claim HOPT
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[`acid-vial:${pi}`] = gs.turn;

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!hero || hero.hp <= 0) return;

      // Turn-1 protection is the ONLY thing that blocks this
      if (gs.firstTurnProtectedPlayer === target.owner) {
        engine.log('damage_blocked', { target: hero.name, reason: 'shielded' });
        return;
      }

      // Apply damage directly — bypasses charmed, submerged, immortal, shielded, damage reduction
      const hpBefore = hero.hp;
      hero.hp = Math.max(0, hero.hp - DAMAGE);
      const dealt = hpBefore - hero.hp;

      engine.log('damage', { source: 'Acid Vial', target: engine._heroLabel(hero), amount: dealt, damageType: 'other' });

      // Fire afterDamage hooks (Shield of Life/Death may trigger)
      await engine.runHooks(HOOKS.AFTER_DAMAGE, {
        source: { name: 'Acid Vial', owner: pi, heroIdx: -1 },
        target: hero, amount: dealt, type: 'other', sourceHeroIdx: -1,
        _skipReactionCheck: true,
      });

      // SC tracking
      if (dealt > 0 && gs._scTracking && pi >= 0 && pi < 2) {
        const t = gs._scTracking[pi];
        if (dealt > t.maxDamageInstance) t.maxDamageInstance = dealt;
      }

      // Check for hero KO
      if (hero.hp <= 0) {
        hero.diedOnTurn = gs.turn;
        await engine.runHooks(HOOKS.ON_HERO_KO, { hero, source: { name: 'Acid Vial' }, _bypassDeadHeroFilter: true });
        if (hero.hp <= 0 && !hero._koProcessed) {
          hero._koProcessed = true;
          await engine.handleHeroDeathCleanup(hero);
          await engine.checkAllHeroesDead();
        }
      }

    } else if (target.type === 'equip') {
      // Creature damage — route through batch system so Monia can react (but can't negate)
      const inst = engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support' &&
        c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
      );
      if (!inst) return;

      await engine.processCreatureDamageBatch([{
        inst,
        amount: DAMAGE,
        type: 'other',
        source: { name: 'Acid Vial', owner: pi, heroIdx: -1 },
        canBeNegated: false,
      }]);
    }

    engine.sync();
  },
};
