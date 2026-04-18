// ═══════════════════════════════════════════
//  CARD EFFECT: "Null Zone"
//  Spell (Magic Arts Lv1, Normal)
//  Pollution archetype.
//
//  Place 2 Pollution Tokens into your free Support
//  Zones to use this Spell.
//  Until the end of your next turn:
//    • All Creatures on the board gain the "Nulled"
//      status — their effects are negated while the
//      status is active.
//    • All Heroes gain the "Nulled" status — they
//      can still use Attacks, Creatures, and
//      Abilities, but NOT Spells.
//  "Nulled" is a cleansable negative status: Juice,
//  Tea, Coffee, and anything else in the status-
//  cleanse family strip it via the shared negative-
//  statuses registry.
//
//  Inherent additional Action: playable from hand
//  during the Main Phases as well as the Action
//  Phase, and never consumes the turn's Action —
//  same pattern as Spontaneous Reappearance.
// ═══════════════════════════════════════════

const { placePollutionTokens, countFreeZones } = require('./_pollution-shared');
const { hasCardType, isCreatureNegated } = require('./_hooks');

module.exports = {
  placesPollutionTokens: true,
  // Free action in both phases — no action cost, no phase advance.
  inherentAction: true,

  spellPlayCondition(gs, pi) {
    return countFreeZones(gs, pi) >= 2;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const cardDB = engine._getCardDB();

      // ── Pay cost ──
      await placePollutionTokens(engine, pi, 2, 'Null Zone', { promptCtx: ctx });

      // ── Apply effects ──
      // Expiry: "end of your next turn" = START of the controller's turn
      // AFTER their next one (turn T + 2).
      const expiresAtTurn = gs.turn + 2;
      const expiresForPlayer = pi;

      // Apply the Nulled status to every Creature on the board. We use
      // actionNegateCreature with statusKey='nulled' so the counter
      // surfaces as the "Nulled" cleansable status rather than the
      // default "Negated" (which is reserved for Dark Gear et al.).
      // Every targeted creature also gets the purple cosmic spiral.
      let creaturesNulled = 0;
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if (inst.faceDown) continue;
        const cd = cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        if (isCreatureNegated(inst)) continue; // Already negated/nulled — skip
        engine._broadcastEvent('play_zone_animation', {
          type: 'null_zone_spiral',
          owner: inst.controller ?? inst.owner,
          heroIdx: inst.heroIdx,
          zoneSlot: inst.zoneSlot,
        });
        await engine.actionNegateCreature(inst, 'Null Zone', {
          expiresAtTurn,
          expiresForPlayer,
          statusKey: 'nulled',
        });
        creaturesNulled++;
      }

      // Apply the Nulled status to every alive Hero on both sides.
      // The status itself carries expiresAtTurn/expiresForPlayer, and
      // _processBuffExpiry now also expires hero statuses with those
      // fields, so no extra bookkeeping is needed. Each affected hero
      // also gets the purple cosmic spiral.
      let heroesNulled = 0;
      for (let playerIdx = 0; playerIdx < gs.players.length; playerIdx++) {
        const ps = gs.players[playerIdx];
        if (!ps) continue;
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          const hero = ps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          if (hero.statuses?.nulled) continue; // Already nulled
          engine._broadcastEvent('play_zone_animation', {
            type: 'null_zone_spiral', owner: playerIdx, heroIdx: hi, zoneSlot: -1,
          });
          await engine.addHeroStatus(playerIdx, hi, 'nulled', {
            appliedBy: pi,
            expiresAtTurn,
            expiresForPlayer,
          });
          heroesNulled++;
        }
      }
      // Breather so the client has time to render the full swarm of spirals
      await engine._delay(900);

      engine.log('null_zone', {
        player: gs.players[pi].username,
        creaturesNulled, heroesNulled,
        expiresTurn: expiresAtTurn,
      });
      engine.sync();
    },
  },
};
