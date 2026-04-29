// ═══════════════════════════════════════════
//  CARD EFFECT: "Bomblebee Cluster"
//  Spell (Summoning Magic Lv2, Reaction)
//
//  Play this card immediately when you summon a
//  "Bomblebee" Creature. Summon up to 2
//  "Bomblebee" Creatures with different names
//  from your hand with the same Hero as
//  additional Actions. You cannot summon
//  Creatures for the rest of the turn afterwards.
//
//  Implementation
//  ──────────────
//  Triggers on ANY summon path (hand play, revive,
//  illusion, effect-summon) via the engine's
//  `_checkPostSummonHandReactions` helper, which
//  fires from `runHooks('onCardEnterZone')` for
//  every Creature entering a support zone — see
//  the corresponding ENG_NOTES comment in
//  _engine.js. The standard chain reaction window
//  doesn't fire on revives / effect-summons since
//  those don't go through `executeCardWithChain`,
//  so this dedicated post-summon window is the
//  only path that catches all summon types.
//
//  "Different names" — the two re-summons must each
//  have a name that differs both from the trigger
//  Bomblebee AND from the other re-summon. The
//  picker omits names already used.
//
//  "Same Hero" — the two re-summons land on the
//  trigger Bomblebee's host hero. If that hero has
//  no free zones left after the trigger, the
//  re-summons fizzle one at a time as zones fill.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { BOMBLEBEE_NAMES } = require('./_bomblebee-shared');

const CARD_NAME      = 'Bomblebee Cluster';
const ANIM_TYPE      = 'bomblebee_cluster';
const MAX_RESUMMONS  = 2;

function bomblebeeNamesInHand(ps, excludeNames) {
  const seen = new Set();
  const out = [];
  for (const cn of (ps.hand || [])) {
    if (seen.has(cn)) continue;
    if (!BOMBLEBEE_NAMES.has(cn)) continue;
    if (excludeNames.has(cn)) continue;
    seen.add(cn);
    out.push(cn);
  }
  return out;
}

function findFreeSupportSlot(ps, heroIdx) {
  const zones = (ps.supportZones || [])[heroIdx] || [];
  for (let z = 0; z < 3; z++) {
    if ((zones[z] || []).length === 0) return z;
  }
  return -1;
}

module.exports = {
  // Custom flag — handled by _checkPostSummonHandReactions in the engine.
  // Not `isReaction`, since the standard chain reaction window only fires
  // on hand-play summons (via executeCardWithChain) and would miss
  // revives / illusions / effect-summons. The custom helper covers
  // everything that fires `onCardEnterZone` for a Creature.
  isPostSummonHandReaction: true,

  // Filters which summons trigger the activation prompt: only Bomblebees
  // summoned by the holder of this card. The summoning-pi is checked by
  // the engine helper before this callback runs (it scans the summoning
  // player's hand), so we only need to gate on "is this a Bomblebee?".
  postSummonReactionCondition(gs, summoningPi, engine, summonedInst) {
    if (!summonedInst) return false;
    return BOMBLEBEE_NAMES.has(summonedInst.name);
  },

  async postSummonReactionResolve(engine, pi, triggerInst) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps || !triggerInst) return;

    const hostHeroIdx = triggerInst.heroIdx;
    const host = ps.heroes?.[hostHeroIdx];
    if (!host?.name || host.hp <= 0) {
      // Host hero died between the summon firing and this reaction
      // resolving — nothing to do, but still apply the summon-lock
      // because text says "afterwards" unconditionally.
      ps.summonLocked = true;
      engine.log('bomblebee_cluster_no_host', { player: ps.username });
      engine.sync();
      return;
    }

    // "Different names" tracker — start by excluding the trigger's name.
    const usedNames = new Set([triggerInst.name]);

    // Cluster animation on the host hero's row — three cascading bursts.
    engine._broadcastEvent('play_zone_animation', {
      type: ANIM_TYPE, owner: pi, heroIdx: hostHeroIdx, zoneSlot: -1,
    });
    await engine._delay(400);

    let summoned = 0;
    for (let i = 0; i < MAX_RESUMMONS; i++) {
      const candidates = bomblebeeNamesInHand(ps, usedNames);
      if (candidates.length === 0) break;

      const slot = findFreeSupportSlot(ps, hostHeroIdx);
      if (slot < 0) {
        engine.log('bomblebee_cluster_no_slot', {
          player: ps.username, hero: host.name, summoned,
        });
        break;
      }

      // Build the picker as `cardGallery` so the player sees the actual
      // Bomblebee art for each option. Cancellable — if the player
      // doesn't pick, we stop the loop and apply summon-lock.
      const galleryCards = candidates.map(name => ({ name, source: 'hand' }));
      const result = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: galleryCards,
        title: CARD_NAME,
        description: `Pick a Bomblebee to summon onto ${host.name} (${i + 1}/${MAX_RESUMMONS}).`,
        cancellable: true,
      });
      if (!result || result.cancelled || !result.cardName) break;
      if (!candidates.includes(result.cardName)) break;

      const chosenName = result.cardName;
      const handIdx = ps.hand.indexOf(chosenName);
      if (handIdx < 0) break;

      // Remove from hand, then summon via summonCreatureWithHooks so the
      // chosen Bomblebee gets its onPlay / onCardEnterZone hooks. The
      // host's `summonLocked` flag isn't set yet (we apply it after the
      // loop), so the engine doesn't reject these summons.
      ps.hand.splice(handIdx, 1);
      if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
      ps._creaturesSummonedThisTurn = (ps._creaturesSummonedThisTurn || 0) + 1;

      engine._broadcastEvent('card_reveal', { cardName: chosenName, playerIdx: pi });

      const summonRes = await engine.summonCreatureWithHooks(
        chosenName, pi, hostHeroIdx, slot,
        {
          // Skip the post-summon reaction window for these re-summons —
          // the engine helper already guards reentrancy, but this is an
          // extra belt-and-suspenders to keep recursion impossible.
          hookExtras: { _skipPostSummonReaction: true, _isClusterSummon: true },
        },
      );
      if (!summonRes) {
        // Fizzle (zone occupied / beforeSummon refused) — discard the
        // ripped card so we don't lose it silently.
        ps.discardPile.push(chosenName);
        engine.log('bomblebee_cluster_fizzle', {
          player: ps.username, card: chosenName,
        });
        break;
      }

      usedNames.add(chosenName);
      summoned++;
      engine.sync();
      await engine._delay(250);
    }

    // "You cannot summon Creatures for the rest of the turn afterwards."
    // Applied unconditionally per text — even if 0 Bomblebees got
    // re-summoned (no different-named candidates / no free slots).
    ps.summonLocked = true;

    engine.log('bomblebee_cluster_resolve', {
      player: ps.username, summoned, hero: host.name,
    });
    engine.sync();
  },
};
