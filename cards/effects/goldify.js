// ═══════════════════════════════════════════
//  CARD EFFECT: "Goldify"
//  Spell (Decay Magic Lv1, Normal)
//  Pollution archetype.
//
//  Place 1 Pollution Token into your free Support
//  Zone to use this Spell. Choose a Creature and
//  defeat it. Gain 5 × (its level) Gold.
//
//  If the defeated Creature is level 1 or lower,
//  this counts as an additional Action.
//
//  Main-Phase play:
//    Because "level ≤ 1 → additional Action" is a
//    conditional inherent-action grant, Goldify is
//    self-playable in Main Phases BUT ONLY when at
//    least one level-1-or-lower Creature exists on
//    the board. In that mode, target selection is
//    restricted to level-1-or-lower Creatures — the
//    player cannot silently spend the inherent grant
//    on a level-2+ target and retroactively claim
//    free-action status.
//
//    If a DIFFERENT additional-action source
//    (Divine Gift, etc.) is what allows Goldify to
//    be cast in Main Phase, no target restriction
//    applies — that's the other effect's grant, not
//    Goldify's. The server already picks inherent
//    first when both are available, so detecting
//    "is this an inherent cast?" is equivalent to
//    asking "does the inherent-action condition
//    currently hold?".
// ═══════════════════════════════════════════

const { placePollutionTokens, hasFreeZone } = require('./_pollution-shared');
const { hasCardType } = require('./_hooks');

// Walk the board for any Creature whose level is ≤ 1. Used both by
// inherentAction (Main-Phase eligibility) and onPlay (target filtering).
function hasLowLevelCreatureTarget(gs, engine) {
  if (!engine) return false;
  const cardDB = engine._getCardDB();
  for (const ps of gs.players) {
    if (!ps) continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      for (let si = 0; si < 3; si++) {
        const slot = ps.supportZones?.[hi]?.[si] || [];
        if (slot.length === 0) continue;
        const cd = cardDB[slot[0]];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        if ((cd.level || 0) <= 1) return true;
      }
    }
  }
  return false;
}

module.exports = {
  placesPollutionTokens: true,

  // Cannot be cast without at least one free Support Zone for the token,
  // and at least one Creature on the board to target.
  spellPlayCondition(gs, pi) {
    if (!hasFreeZone(gs, pi)) return false;
    // Pre-check: any Creature on the board? If there isn't, the effect
    // can't resolve even after paying the token cost.
    for (const ps of gs.players) {
      if (!ps) continue;
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        for (let si = 0; si < 3; si++) {
          const slot = ps.supportZones?.[hi]?.[si] || [];
          if (slot.length > 0) return true;
        }
      }
    }
    return false;
  },

  // Goldify's conditional "+additional Action on lv ≤ 1" is modeled as a
  // Main-Phase-only inherent action: playable without consuming an additional
  // action, but only when a low-level Creature exists to spend it on.
  inherentAction(gs, pi, heroIdx, engine) {
    const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
    if (!isMainPhase) return false;
    return hasLowLevelCreatureTarget(gs, engine);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const cardDB = engine._getCardDB();

      // When the cast is inherent (Main Phase + low-level Creature on board),
      // restrict targeting to level-1-or-lower Creatures. This is ONLY the
      // inherent path — if the spell is running in Action Phase or under a
      // different additional-action source, any Creature is a legal target.
      const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
      const restrictToLowLevel = isMainPhase && hasLowLevelCreatureTarget(gs, engine);

      // ── Target selection: any Creature on the board ──
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['creature'],
        title: 'Goldify',
        description: restrictToLowLevel
          ? 'Place 1 Pollution Token, then defeat a level-1-or-lower Creature to gain gold equal to 5 × its level.'
          : 'Place 1 Pollution Token, then defeat a Creature to gain gold equal to 5 × its level. Level 1 or lower → additional Action.',
        confirmLabel: '🪙 Goldify!',
        confirmClass: 'btn-success',
        cancellable: true,
        condition: (t) => {
          // Only Creatures count (not equips/abilities)
          if (t.type !== 'equip' && t.type !== 'creature') return false;
          const inst = t.cardInstance;
          if (!inst) return false;
          const cd = cardDB[inst.name];
          if (!cd || !hasCardType(cd, 'Creature')) return false;
          if (restrictToLowLevel && (cd.level || 0) > 1) return false;
          return true;
        },
      });

      if (!target) {
        gs._spellCancelled = true;
        return;
      }

      const inst = target.cardInstance || engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support' &&
        c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
      );
      if (!inst) {
        gs._spellCancelled = true;
        return;
      }

      const creatureCd = cardDB[inst.name];
      const creatureLevel = creatureCd?.level || 0;
      const goldGain = 5 * creatureLevel;

      // ── Pay cost: place 1 Pollution Token FIRST (per card text ordering) ──
      await placePollutionTokens(engine, pi, 1, 'Goldify', { promptCtx: ctx });

      // ── Transmutation animation on the target ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'goldify_transmute', owner: target.owner,
        heroIdx: target.heroIdx, zoneSlot: target.slotIdx ?? -1,
      });
      await engine._delay(1000); // Full transmute animation duration

      // ── Defeat the Creature (routes via destroyCard → discard) ──
      await engine.actionDestroyCard(ctx.card, inst);
      engine.sync();
      await engine._delay(300);

      // ── Gold gain ──
      if (goldGain > 0) {
        await engine.actionGainGold(pi, goldGain);
      }

      // ── "Level 1 or lower → additional Action" rider ──
      if (creatureLevel <= 1) {
        gs._spellFreeAction = true;
      }

      engine.log('goldify', {
        player: gs.players[pi].username,
        creature: inst.name, level: creatureLevel,
        gold: goldGain,
        additionalAction: creatureLevel <= 1,
      });

      engine.sync();
    },
  },
};
