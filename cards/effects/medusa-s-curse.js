// ═══════════════════════════════════════════
//  CARD EFFECT: "Medusa's Curse"
//  Spell (Decay Magic Lv2, Normal)
//  Pollution archetype.
//
//  Place 2 Pollution Tokens into your free Support
//  Zones to use this Spell. Stun for 1 turn every
//  target your opponent controls that has NOT taken
//  damage yet this turn. Targets Stunned by this
//  effect take 0 damage (via the 'medusa_petrified'
//  buff — damageMultiplier: 0).
// ═══════════════════════════════════════════

const { placePollutionTokens, countFreeZones } = require('./_pollution-shared');
const { hasCardType } = require('./_hooks');

module.exports = {
  placesPollutionTokens: true,

  // Cost gate: need 2 free Support Zones.
  spellPlayCondition(gs, pi) {
    return countFreeZones(gs, pi) >= 2;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;
      const opp = gs.players[oppIdx];
      const cardDB = engine._getCardDB();

      if (!opp) {
        gs._spellCancelled = true;
        return;
      }

      // Collect eligible targets: opponent's Heroes and Creatures that have
      // NOT taken damage this turn. Check _damagedOnTurn !== current turn.
      const currentTurn = gs.turn;
      const heroTargets = []; // [{ owner, heroIdx, hero }]
      const creatureTargets = []; // CardInstance[]

      for (let hi = 0; hi < (opp.heroes || []).length; hi++) {
        const hero = opp.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero._damagedOnTurn === currentTurn) continue;
        if (hero.statuses?.stunned) continue; // Already stunned — no-op
        heroTargets.push({ owner: oppIdx, heroIdx: hi, hero });
      }
      for (const inst of engine.cardInstances) {
        if (inst.owner !== oppIdx) continue;
        if (inst.zone !== 'support') continue;
        if (inst.faceDown) continue;
        const cd = cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        if (inst.counters?._damagedOnTurn === currentTurn) continue;
        if (inst.counters?.stunned) continue;
        if (!engine.canApplyCreatureStatus(inst, 'stunned')) continue;
        creatureTargets.push(inst);
      }

      const totalTargets = heroTargets.length + creatureTargets.length;
      if (totalTargets === 0) {
        engine.log('medusas_curse_fizzle', {
          player: gs.players[pi].username,
          reason: 'no_undamaged_targets',
        });
      }

      // ── Pay cost ──
      // The spell is always consumed — Pollution placement is a cost per the
      // card text ("Place 2 Pollution Tokens... to use this Spell"), so we
      // pay it even if the filter produced 0 eligible targets.
      await placePollutionTokens(engine, pi, 2, "Medusa's Curse", { promptCtx: ctx });

      if (totalTargets === 0) return;

      // ── Animation: petrify on every affected target ──
      for (const ht of heroTargets) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'petrify', owner: ht.owner, heroIdx: ht.heroIdx, zoneSlot: -1,
        });
      }
      for (const inst of creatureTargets) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'petrify', owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
        });
      }
      await engine._delay(900);

      // ── Apply stun + petrified buff ──
      // _processBuffExpiry expires a buff when `currentTurn === expiresAtTurn
      // && activePlayer === expiresForPlayer`. Since Medusa's Curse is cast
      // on the caster's own turn (gs.activePlayer === pi), the caster's NEXT
      // turn is two half-turns away (opponent's turn, then back to caster).
      // Using gs.turn + 2 matches Divine Gift of the Guardian's pattern and
      // ensures the damage-immunity buff ends exactly when the stun does.
      const expiresAtTurn = gs.turn + 2;
      const expiresForPlayer = pi;

      for (const ht of heroTargets) {
        await engine.addHeroStatus(ht.owner, ht.heroIdx, 'stunned', {
          appliedBy: pi,
          expiresAtTurn,
          expiresForPlayer,
        });
        // Parallel damage-block buff (damageMultiplier: 0 comes from BUFF_EFFECTS).
        await engine.actionAddBuff(ht.hero, ht.owner, ht.heroIdx, 'medusa_petrified', {
          expiresAtTurn,
          expiresForPlayer,
        });
      }

      for (const inst of creatureTargets) {
        inst.counters.stunned = 1;
        inst.counters.stunnedAppliedBy = pi;
        // Route through actionAddCreatureBuff so damageMultiplier is pulled
        // from BUFF_EFFECTS (the old inline write skipped this, leaving the
        // buff with no multiplier — which is why creature damage-immunity
        // wasn't actually landing). clearCountersOnExpire clears the stun
        // counter in lockstep with the buff since creature stun has no
        // independent end-of-turn tick.
        await engine.actionAddCreatureBuff(inst, 'medusa_petrified', {
          expiresAtTurn,
          expiresForPlayer,
          clearCountersOnExpire: ['stunned', 'stunnedAppliedBy'],
          source: "Medusa's Curse",
        });
        engine.log('stun_applied', { target: inst.name, by: "Medusa's Curse" });
      }

      engine.log('medusas_curse', {
        player: gs.players[pi].username,
        heroesAffected: heroTargets.length,
        creaturesAffected: creatureTargets.length,
      });
      engine.sync();
    },
  },
};
