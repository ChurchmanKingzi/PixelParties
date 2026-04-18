// ═══════════════════════════════════════════
//  CARD EFFECT: "Golden Wings"
//  Spell (Summoning Magic Lv2, Reaction)
//  Pollution archetype.
//
//  Place 1 Pollution Token into your free Support
//  Zone, then pick one of YOUR Creatures and grant
//  it the "Golden Wings" buff — full immunity to
//  opponent effects for the rest of the current
//  turn (cleared at start of the next half-turn,
//  regardless of whose turn it was applied on).
//
//  Playable two ways:
//
//    1. As a Post-Target Reaction — fires ONLY
//       after an opponent's card has picked its
//       targets AND at least one of those targets
//       is one of this player's Creatures. The
//       chained reaction then lets the player
//       shield exactly one of the hit Creatures,
//       blanking damage / destroy / status that
//       the incoming effect would have applied to
//       it. Does NOT trigger on things like a
//       Spell being played from hand or a Creature
//       being summoned — the engine's generic
//       reaction chain fires on those, but Golden
//       Wings uses the narrower post-target hook
//       (_checkPostTargetHandReactions) so only
//       "my Creature was just chosen as a target"
//       events qualify.
//
//    2. Proactively on the user's own turn — plays
//       from hand like a normal Spell, costs no
//       Action (inherentAction: true, matching the
//       general rule that Reaction Spells never
//       spend the turn's Action). Any own Creature
//       is a valid target; the buff applies
//       preemptively.
//
//  Immunity: sets `_cardinalImmune` (engine's
//  generic absolute-creature-shield: blocks damage,
//  destroy, move, buff add/remove, AND — with the
//  canApplyCreatureStatus update — status effects)
//  plus `untargetable_by_opponent` so opponent
//  targeting UIs skip this creature on future
//  plays. Both counters are cleared on buff expiry
//  via `clearCountersOnExpire`; the buff's
//  `expiresForceClear: true` lets the expiry path
//  bypass _cardinalImmune's own guard against
//  actionRemoveCreatureBuff — without that bypass
//  the protection would be self-perpetuating.
// ═══════════════════════════════════════════

const { placePollutionTokens, hasFreeZone } = require('./_pollution-shared');
const { hasCardType } = require('./_hooks');

/** Shared precondition: caster has a Creature, a free zone, and a castable hero. */
function hasValidContext(gs, pi, engine) {
  if (!engine) return true; // Permissive fallback when engine isn't supplied.
  if (!hasFreeZone(gs, pi)) return false;

  const cardDB = engine._getCardDB();
  const ps = gs.players[pi];
  if (!ps) return false;

  let hasOwnCreature = false;
  for (const inst of engine.cardInstances) {
    if (inst.owner !== pi) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const cd = cardDB[inst.name];
    if (cd && hasCardType(cd, 'Creature')) { hasOwnCreature = true; break; }
  }
  if (!hasOwnCreature) return false;

  const cardData = cardDB['Golden Wings'];
  if (!cardData) return false;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
    if (engine.heroMeetsLevelReq(pi, hi, cardData)) return true;
  }
  return false;
}

/** Clickable target list of the caster's own Creatures. */
function getOwnCreatureTargets(engine, pi) {
  const cardDB = engine._getCardDB();
  const targets = [];
  for (const inst of engine.cardInstances) {
    if (inst.owner !== pi) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const cd = cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    targets.push({
      id: `equip-${pi}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip', owner: pi, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
    });
  }
  return targets;
}

/** Apply the Golden Wings buff + immunity flags to a specific creature instance. */
async function applyBuff(engine, pi, inst, promptCtxShim) {
  const gs = engine.gs;
  const ps = gs.players[pi];

  // Cost: 1 Pollution Token.
  await placePollutionTokens(engine, pi, 1, 'Golden Wings', { promptCtx: promptCtxShim });

  // Shield animation on the protected creature.
  engine._broadcastEvent('play_zone_animation', {
    type: 'golden_wings', owner: inst.owner,
    heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
  });
  await engine._delay(1100);

  // Order matters: add buff FIRST (while _cardinalImmune is still unset so
  // actionAddCreatureBuff's own guard doesn't reject it), then set the
  // immunity counters. On expiry, clearCountersOnExpire strips both
  // flags together, and expiresForceClear lets the expiry path bypass
  // _cardinalImmune's guard in actionRemoveCreatureBuff.
  await engine.actionAddCreatureBuff(inst, 'golden_wings', {
    expiresAtTurn: gs.turn + 1,
    expiresForPlayer: 1 - gs.activePlayer, // end of current half-turn, whichever side we're on
    expiresForceClear: true,
    source: 'Golden Wings',
    clearCountersOnExpire: ['_cardinalImmune', 'untargetable_by_opponent', 'untargetable_by_opponent_pi'],
  });
  inst.counters._cardinalImmune = true;
  inst.counters.untargetable_by_opponent = 1;
  inst.counters.untargetable_by_opponent_pi = 1 - pi;

  engine.log('golden_wings', { player: ps.username, creature: inst.name });
  engine.sync();
}

/**
 * Prompt the caster to click one of their Creatures, then apply the buff.
 * Used for the proactive play path (all own creatures eligible).
 */
async function promptAndApply(engine, pi, promptCtxShim) {
  const gs = engine.gs;
  const targets = getOwnCreatureTargets(engine, pi);
  if (targets.length === 0) {
    engine.log('golden_wings_fizzle', { player: gs.players[pi].username, reason: 'no_creature' });
    return false;
  }

  const selectedIds = await engine.promptEffectTarget(pi, targets, {
    title: 'Golden Wings',
    description: 'Click one of your Creatures to grant it Golden Wings — full immunity to opponent effects for the rest of this turn.',
    confirmLabel: '🪽 Shield!',
    confirmClass: 'btn-success',
    cancellable: true,
    maxTotal: 1,
  });
  if (!selectedIds || selectedIds.length === 0) return false;

  const chosen = targets.find(t => t.id === selectedIds[0]);
  if (!chosen?.cardInstance) return false;

  await applyBuff(engine, pi, chosen.cardInstance, promptCtxShim);
  return true;
}

module.exports = {
  // Narrow reaction trigger: only fires after an opponent's card has picked
  // its targets AND at least one of our Creatures is in that target list.
  // (The engine's generic reaction chain window — isReaction + reactionCondition
  // — would let this fire on "opponent played a card from hand" events, which
  // is too broad. We intentionally only hook into _checkPostTargetHandReactions.)
  isPostTargetReaction: true,
  proactivePlay: true,
  inherentAction: true,

  // Gray out in hand when the caster couldn't meaningfully resolve it.
  spellPlayCondition(gs, pi, engine) {
    return hasValidContext(gs, pi, engine);
  },

  /**
   * Post-target reaction gate. Receives the list of targets the opponent's
   * card just picked (same shape promptDamageTarget / promptMultiTarget /
   * the AoE helper produce: { type, owner, heroIdx, slotIdx?, cardName, ... }).
   *
   * Fires only if:
   *   • The source card belongs to the opponent.
   *   • At least one target is a Creature the reacting player owns.
   *   • The reactor has the resources to cast (free zone + castable hero).
   */
  postTargetCondition(gs, pi, engine, targetedHeroes, sourceCard) {
    if (!sourceCard) return false;
    const srcOwner = sourceCard.controller ?? sourceCard.owner ?? -1;
    if (srcOwner === pi) return false;

    const hasOurHitCreature = (targetedHeroes || []).some(t =>
      (t.type === 'equip' || t.type === 'creature') && t.owner === pi
    );
    if (!hasOurHitCreature) return false;

    return hasValidContext(gs, pi, engine);
  },

  /**
   * Post-target reaction resolve. Restricts the creature pick to the caster's
   * OWN Creatures that are in the incoming-effect's target list — per the
   * card's design, Golden Wings protects one of the Creatures actually being
   * hit. A single creature is auto-selected; multiple prompt a pick.
   */
  async postTargetResolve(engine, pi, targetedHeroes /* , sourceCard */) {
    const ourHitIds = new Set(
      (targetedHeroes || [])
        .filter(t => (t.type === 'equip' || t.type === 'creature') && t.owner === pi)
        .map(t => `equip-${t.owner}-${t.heroIdx}-${t.slotIdx}`)
    );
    const candidates = getOwnCreatureTargets(engine, pi).filter(t => ourHitIds.has(t.id));
    if (candidates.length === 0) return null;

    const promptCtxShim = {
      promptZonePick: (zs, cfg) => engine.promptGeneric(pi, {
        type: 'zonePick', zones: zs,
        title: cfg?.title || 'Golden Wings',
        description: cfg?.description || 'Select a zone.',
        cancellable: cfg?.cancellable !== false,
      }),
    };

    let chosen;
    if (candidates.length === 1) {
      chosen = candidates[0];
    } else {
      const selectedIds = await engine.promptEffectTarget(pi, candidates, {
        title: 'Golden Wings',
        description: 'Click one of your Creatures being targeted to shield it.',
        confirmLabel: '🪽 Shield!',
        confirmClass: 'btn-success',
        cancellable: false,
        maxTotal: 1,
      });
      if (!selectedIds || selectedIds.length === 0) return null;
      chosen = candidates.find(t => t.id === selectedIds[0]) || candidates[0];
    }

    if (!chosen?.cardInstance) return null;
    await applyBuff(engine, pi, chosen.cardInstance, promptCtxShim);
    // Returning null (not { effectNegated: true }) — Golden Wings does NOT
    // negate the source effect; the buff just blanks any impact on the
    // shielded creature specifically.
    return null;
  },

  hooks: {
    // Proactive play path — no Action cost (inherentAction above). Any own
    // Creature is a valid pick; the ctx already wires promptZonePick for
    // placePollutionTokens.
    onPlay: async (ctx) => {
      const ok = await promptAndApply(ctx._engine, ctx.cardOwner, ctx);
      if (!ok) ctx.gameState._spellCancelled = true;
    },
  },
};
