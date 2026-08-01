// ═══════════════════════════════════════════
//  CARD EFFECT: "Tharxian Horse"
//  Spell (Surprise) — Magic Arts Lv3
//
//  "Activate this Surprise when the user is chosen by an Attack or
//   Spell. Negate the Attack/Spell and inflict 50 damage to the
//   attacker times the number of targets you control. Then, if this
//   damage defeated the attacker, you may immediately choose a
//   Creature from your discard pile and summon it as an additional
//   Action. You can only play 1 "Tharxian Horse" per game."
//
//  Mechanics
//  ─────────
//   • Trigger filters by the source CARD's actual cardType — only
//     Attack or Spell. A Spell cast through a Creature (Demon's Gate,
//     Skeleton Priest) still counts because the played card IS a
//     Spell; a Creature's own active effect does NOT count (cardType
//     'Creature'). Frost Rune fires for Attack+Spell+Creature; this
//     card is stricter.
//   • "Number of targets you control" = living Heroes + face-up
//     Creatures on the controller's side. Tokens / face-down (Bakhm-
//     staged) / dead Heroes excluded. AoE-style "targets" semantics —
//     anything that could be selected as a target by an Attack /
//     Spell counts.
//   • Defeat-then-revive: the discard-revive branch runs the FULL
//     `summonCreatureWithHooks` pipeline — so sacrifice tributes
//     (King Trex), uniqueness gates (Cute Phoenix), per-turn summon
//     caps (Deepsea Primordium), level/school requirements,
//     dead/Frozen/Stunned/Negated host gates, and beforeSummon-
//     dependent costs are ALL respected. Necromancy deliberately
//     bypasses beforeSummon; Tharxian Horse does the opposite.
//   • Once-per-game: `oncePerGame: true` + `oncePerGameKey: 'Tharxian Horse'`.
//     The engine's `getBlockedSpells` grays the hand copy out after
//     the first play; `server.js doPlaySurprise` also enforces it and
//     marks `_oncePerGameUsed` when set.
//   • Telekinesis disallowed (no real triggering effect to negate, no
//     attacker to damage). Same gate Frost Rune / Magic Mirror use.
// ═══════════════════════════════════════════

const { hasCardType, resolveSourceCreature, isCreatureSource } = require('./_hooks');

const CARD_NAME = 'Tharxian Horse';
const DAMAGE_PER_TARGET = 50;

/**
 * Count "targets you control" — living Heroes + face-up Creatures on
 * the controller's side. Bakhm-staged face-down Creatures are
 * excluded (they're staged, not yet on the board as targetable).
 */
function countTargetsYouControl(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return 0;
  let n = 0;
  for (const hero of (ps.heroes || [])) {
    if (hero?.name && hero.hp > 0) n++;
  }
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
    if (!cd) continue;
    if (!hasCardType(cd, 'Creature')) continue;
    n++;
  }
  return n;
}

/**
 * For a given Creature name, find all (Hero, free-slot) destinations
 * the player could legally summon it into RIGHT NOW. Per-Hero gate:
 * living, not Frozen/Stunned/Webbed/Bound/Negated, meets school +
 * level, free Support Zone, canSummon passes. Cards whose summon
 * cost lives in beforeSummon (King Trex, Deepsea bounce-place, …)
 * still surface here — the loose canSummon mode they opt into via
 * `ctx._bypassBeforeSummon !== true` lets them appear in the picker,
 * and the actual cost gets paid inside `summonCreatureWithHooks`.
 */
function eligibleDestinations(engine, pi, creatureName) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const cd = cardDB[creatureName];
  if (!cd) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen
        || hero.statuses?.stunned
        || hero.statuses?.webbed
        || hero.statuses?.bound
        || hero.statuses?.negated) continue;
    if (!engine.heroMeetsLevelReq(pi, hi, cd, { pileSide: 'discard' })) continue;
    if (!engine.isCreatureSummonable(creatureName, pi, hi)) continue;
    const sup = ps.supportZones?.[hi] || [];
    for (let si = 0; si < 3; si++) {
      if (((sup[si] || []).length === 0)) {
        out.push({
          heroIdx: hi, slotIdx: si,
          label: `${hero.name} — Slot ${si + 1}`,
        });
      }
    }
  }
  return out;
}

/** Build the discard-revive gallery, filtered to summonable Creatures. */
function eligibleDiscardCreatures(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const seen = new Set();
  const out = [];
  for (const name of (ps.discardPile || [])) {
    if (seen.has(name)) continue;
    const cd = cardDB[name];
    // Strict cardType === 'Creature' — discard-revive design rule
    // (Necromancy, Forceful Revival, Cardinal Beast Xuanwu all use
    // the same strict filter to exclude Artifact-Creature hybrids).
    if (!cd || cd.cardType !== 'Creature') continue;
    if (eligibleDestinations(engine, pi, name).length === 0) continue;
    seen.add(name);
    out.push({ name, source: 'discard' });
  }
  return out;
}

module.exports = {
  isSurprise: true,
  oncePerGame: true,
  oncePerGameKey: CARD_NAME,

  // No triggering effect under Telekinesis → nothing to negate, no
  // attacker to retaliate against. Frost Rune / Magic Mirror disallow
  // for the same reason.
  canTelekinesisActivate: false,

  /**
   * Trigger: host Hero is chosen by an Attack or Spell. The source
   * CARD must be Attack-typed or Spell-typed in cards.json. Creature
   * effects (cardType 'Creature') are deliberately excluded.
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, sourceInfo, engine) => {
    if (!sourceInfo || sourceInfo.owner == null || sourceInfo.owner < 0) return false;
    const cardDB = engine._getCardDB();
    const cd = sourceInfo.cardName ? cardDB[sourceInfo.cardName] : null;
    if (!cd) return false;
    if (cd.cardType !== 'Attack' && cd.cardType !== 'Spell') return false;
    // Live attacker required — mirrors Booby Trap / Frost Rune.
    if (isCreatureSource(engine, sourceInfo)) {
      return !!resolveSourceCreature(engine, sourceInfo);
    }
    if (sourceInfo.heroIdx == null || sourceInfo.heroIdx < 0) return false;
    const attacker = gs.players[sourceInfo.owner]?.heroes?.[sourceInfo.heroIdx];
    return !!(attacker && attacker.hp > 0);
  },

  /**
   * Activation:
   *   1. Compute damage = 50 × targets-you-control.
   *   2. Apply to the attacker (Hero or live Creature).
   *   3. If the attacker died from THIS damage → offer a discard
   *      revive as an additional Action (full beforeSummon pipeline).
   *   4. Negate the triggering Attack/Spell.
   */
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;

    const targetCount = countTargetsYouControl(engine, pi);
    const damage = DAMAGE_PER_TARGET * Math.max(0, targetCount);

    // ── Trojan Horse charge: large wooden horse rolls OUT of the
    // ── face-up-flipped Surprise Zone and rams into the attacker.
    // The Surprise is already flipped face-up by `_activateSurprise`
    // before this hook runs, so the horse visually emerges from the
    // revealed Tharxian Horse card. The custom event carries source
    // (the activator's Surprise Zone) + target (the attacker's
    // Hero zone OR Creature support slot) coordinates so the
    // client's trajectory renderer can draw the gallop path. Impact
    // animation lands on the attacker AFTER the charge completes.
    const chargePayload = {
      sourceOwner: pi,
      sourceHeroIdx: ctx.cardHeroIdx,
      targetOwner: sourceInfo.owner,
      targetHeroIdx: -1,
      targetZoneSlot: -1,
      duration: 1100,
    };
    if (isCreatureSource(engine, sourceInfo)) {
      const srcInst = resolveSourceCreature(engine, sourceInfo);
      if (srcInst) {
        chargePayload.targetOwner = srcInst.owner;
        chargePayload.targetHeroIdx = srcInst.heroIdx;
        chargePayload.targetZoneSlot = srcInst.zoneSlot;
      }
    } else {
      chargePayload.targetHeroIdx = sourceInfo.heroIdx;
    }
    engine._broadcastEvent('play_tharxian_charge', chargePayload);
    // Hold for the charge to land (1100ms travel + ~150ms impact).
    await engine._delay(1100);

    // ── Damage the attacker ──
    let attackerDefeated = false;
    if (damage > 0) {
      if (isCreatureSource(engine, sourceInfo)) {
        const srcInst = resolveSourceCreature(engine, sourceInfo);
        if (srcInst) {
          const beforeHp = srcInst.counters?.currentHp ?? 0;
          engine._broadcastEvent('play_zone_animation', {
            type: 'explosion', owner: srcInst.owner,
            heroIdx: srcInst.heroIdx, zoneSlot: srcInst.zoneSlot,
          });
          await engine._delay(200);
          await engine.actionDealCreatureDamage(
            { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx },
            srcInst, damage, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
          const afterHp = srcInst.counters?.currentHp ?? 0;
          if (beforeHp > 0 && afterHp <= 0) attackerDefeated = true;
        }
      } else {
        const attacker = gs.players[sourceInfo.owner]?.heroes?.[sourceInfo.heroIdx];
        if (attacker && attacker.hp > 0) {
          const beforeHp = attacker.hp;
          engine._broadcastEvent('play_zone_animation', {
            type: 'explosion', owner: sourceInfo.owner,
            heroIdx: sourceInfo.heroIdx, zoneSlot: -1,
          });
          await engine._delay(200);
          await ctx.dealDamage(attacker, damage, 'attack');
          if (beforeHp > 0 && attacker.hp <= 0) attackerDefeated = true;
        }
      }
    }

    engine.sync();
    await engine._delay(300);

    engine.log('tharxian_horse', {
      player: gs.players[pi]?.username,
      negated: sourceInfo.cardName || '?',
      damage, targetCount,
      attackerDefeated,
    });

    // ── Discard-revive branch ──
    if (attackerDefeated) {
      const eligible = eligibleDiscardCreatures(engine, pi);
      if (eligible.length > 0) {
        const selected = await ctx.promptCardGallery(eligible, {
          title: CARD_NAME,
          description: 'Choose a Creature from your discard pile to summon as an additional Action.',
          cancellable: true,
        });
        if (selected && selected.cardName) {
          await reviveFromDiscard(engine, ctx, pi, selected.cardName);
        }
      }
    }

    // Negate the triggering Attack/Spell — the engine propagates
    // `effectNegated` so the original cast aborts with no targets hit.
    return { effectNegated: true };
  },
};

/**
 * Splice the chosen Creature out of the player's discard pile and run
 * the full summon pipeline (beforeSummon + safePlaceInSupport + onPlay
 * + onCardEnterZone). Restores to discard on a clean failure; honours
 * the `_placementConsumedByCard` self-place signal (DDG, 500
 * Piranhas) so cards that place themselves inside beforeSummon don't
 * get falsely restored.
 */
async function reviveFromDiscard(engine, ctx, pi, chosenName) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return;

  // Pick a (Hero, free-slot) destination. State may have shifted
  // between the gallery pick and now (the prior step had no async
  // gaps that would let opp interact, but a chain reaction or auto-
  // trigger could still mutate the board); recompute against the
  // live state.
  const dests = eligibleDestinations(engine, pi, chosenName);
  if (dests.length === 0) {
    engine.log('tharxian_horse_revive_fizzle', {
      reason: 'no_destination', creature: chosenName,
    });
    return;
  }
  let chosenDest;
  if (dests.length === 1) {
    chosenDest = dests[0];
  } else {
    const picked = await ctx.promptZonePick(dests, {
      title: CARD_NAME,
      description: `Place ${chosenName} into a Support Zone.`,
      cancellable: true,
    });
    if (!picked) {
      engine.log('tharxian_horse_revive_cancelled', { creature: chosenName });
      return;
    }
    chosenDest = dests.find(d =>
      d.heroIdx === picked.heroIdx && d.slotIdx === picked.slotIdx
    ) || dests[0];
  }

  // Pay any beforeSummon cost FIRST so a cancelled / unpayable cost
  // doesn't strand us with a half-spliced discard. Cosmic Depths uses
  // the same explicit ordering for the same reason.
  const hookExtras = { _summonedFromDiscard: true, _summonedBy: CARD_NAME };
  const beforeOk = await engine._runBeforeSummon(chosenName, pi, chosenDest.heroIdx, hookExtras);
  const placementConsumed = ps._placementConsumedByCard === chosenName;
  if (placementConsumed) delete ps._placementConsumedByCard;
  if (!beforeOk && !placementConsumed) {
    engine.log('tharxian_horse_revive_cost_unpaid', { creature: chosenName });
    return;
  }

  // Splice the discard entry + untrack the orphan inst before the
  // engine creates a fresh on-board instance.
  const discardIdx = ps.discardPile.lastIndexOf(chosenName);
  if (discardIdx >= 0) ps.discardPile.splice(discardIdx, 1);
  const discardInst = engine.cardInstances.find(c =>
    c.owner === pi && c.zone === 'discard' && c.name === chosenName
  );
  if (discardInst) engine._untrackCard(discardInst.id);

  let inst = null;
  if (placementConsumed) {
    // Self-placing creature (DDG, 500 Piranhas) — beforeSummon already
    // installed it into a Support Zone. Find the resulting inst so
    // post-summon hooks can target it.
    const matches = engine.cardInstances.filter(c =>
      c.name === chosenName && c.zone === 'support'
      && (c.controller ?? c.owner) === pi
    );
    inst = matches[matches.length - 1] || null;
  } else {
    const summonRes = engine.summonCreature(chosenName, pi, chosenDest.heroIdx, chosenDest.slotIdx, {
      source: CARD_NAME,
    });
    if (!summonRes) {
      // safePlaceInSupport rejected (no free zone after all). Restore
      // the discard entry — the player lost nothing.
      ps.discardPile.push(chosenName);
      engine.log('tharxian_horse_revive_no_slot', { creature: chosenName });
      return;
    }
    inst = summonRes.inst;
  }
  if (!inst) {
    ps.discardPile.push(chosenName);
    return;
  }

  engine._broadcastEvent('summon_effect', {
    owner: pi, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
    cardName: chosenName,
  });

  // Per-turn summon counter (matches Necromancy's note — direct
  // summon paths that skip `summonCreatureWithHooks`'s wrapper need
  // to bump this manually so first-summon-this-turn gates fire).
  ps._creaturesSummonedThisTurn = (ps._creaturesSummonedThisTurn || 0) + 1;

  // onPlay + onCardEnterZone — full hook battery, since the revived
  // Creature is NOT negated. `_summonedFromDiscard` lets archetype
  // triggers (Soul Shards' discard-trigger family) recognize the
  // revival.
  if (!placementConsumed) {
    try {
      await engine.runHooks('onPlay', {
        _onlyCard: inst, playedCard: inst, cardName: chosenName,
        zone: 'support', heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
        ...hookExtras,
      });
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: inst.heroIdx,
        ...hookExtras,
      });
    } catch (err) {
      console.error(`[${CARD_NAME}] revive onPlay/onCardEnterZone error:`, err.message);
    }
  }

  // Tharxian Horse's revive counts as an additional Action.
  await engine.runHooks('onActionUsed', {
    actionType: 'creature', source: CARD_NAME, playerIdx: pi,
    cardName: chosenName, heroIdx: inst.heroIdx,
    _skipReactionCheck: true,
  });
  await engine.runHooks('onAdditionalActionUsed', {
    actionType: 'creature', source: CARD_NAME, playerIdx: pi,
    cardName: chosenName, heroIdx: inst.heroIdx,
    _skipReactionCheck: true,
  });

  engine.log('tharxian_horse_revive', {
    player: gs.players[pi]?.username,
    creature: chosenName,
    heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
  });
  engine.sync();
}
