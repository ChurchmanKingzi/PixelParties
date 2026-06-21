// ═══════════════════════════════════════════
//  CARD EFFECT: "Suspicious Monster"
//  Creature (Summoning Magic Lv1, 50 HP)
//
//  "You may sacrifice a Creature you control that was not summoned this
//   turn to summon this Creature as an additional Action into the same
//   Support Zone. You may once per turn choose a target and deal 100
//   damage to it."
//
//  ── Part 1: sacrifice-summon into the same slot (drop-on-occupied) ──
//  Mirrors the Deepsea bounce-place framework, but the occupant is
//  SACRIFICED instead of bounced. Dropping Suspicious Monster onto an
//  occupied Support slot whose Creature was NOT summoned this turn makes
//  it the additional-Action mode: that Creature is sacrificed and
//  Suspicious Monster takes its exact slot. Dropping onto an EMPTY slot
//  is a normal Action summon (no sacrifice). The placement is atomic —
//  Suspicious Monster occupies the slot BEFORE the sacrifice's post-
//  destroy hooks fire, so a resummon-into-the-freed-slot reaction
//  (Corpse Cannibal) finds the slot taken and skips it.
//
//  ── Part 2: once per turn, 100 damage to any target. ──
// ═══════════════════════════════════════════

const CARD_NAME = 'Suspicious Monster';

/** Can `heroIdx` legally summon Suspicious Monster right now? (Alive +
 *  meets its level/school requirement.) The sacrifice-summon places this
 *  Creature into the SACRIFICED Creature's slot, so the host is THAT
 *  slot's Hero — only sacrifices sitting on Heroes able to summon
 *  Suspicious Monster are offered as targets (highlight / drop / picker),
 *  matching the normal-summon level gate. */
function heroCanSummon(engine, pi, heroIdx) {
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  const cd = engine._getCardDB()[CARD_NAME];
  return engine.heroMeetsLevelReq(pi, heroIdx, cd);
}

/** The sacrificeable Creature (not summoned this turn) occupying a slot,
 *  or null. Also requires the slot's Hero to be able to summon Suspicious
 *  Monster (it becomes the host). */
function findOccupant(engine, pi, heroIdx, slotIdx) {
  const gs = engine.gs;
  const slot = (gs.players[pi]?.supportZones?.[heroIdx] || [])[slotIdx] || [];
  if (slot.length === 0) return null;
  // Host Hero (this slot's Hero) must itself be able to summon this card.
  if (!heroCanSummon(engine, pi, heroIdx)) return null;
  const inst = engine.cardInstances.find(c =>
    c.zone === 'support' && (c.controller ?? c.owner) === pi
    && c.heroIdx === heroIdx && c.zoneSlot === slotIdx && !c.faceDown);
  if (!inst) return null;
  if ((inst.turnPlayed || 0) >= (gs.turn || 0)) return null; // summoned this turn
  // Engine helper drops Cardinal Beasts / immovables / "cannot be sacrificed".
  if (!engine.getSacrificableCreatures(pi).some(c => c.inst.id === inst.id)) return null;
  return inst;
}

/** All occupied slots with a sacrificeable (not-summoned-this-turn)
 *  Creature whose Hero can host (summon) Suspicious Monster. */
function sacrificeableSlots(engine, pi) {
  const turn = engine.gs.turn;
  return engine.getSacrificableCreatures(pi)
    .filter(c => c.inst.zone === 'support' && c.inst.turnPlayed !== turn
      && heroCanSummon(engine, pi, c.inst.heroIdx))
    .map(c => ({ heroIdx: c.inst.heroIdx, slotIdx: c.inst.zoneSlot, cardName: c.cardName, inst: c.inst }));
}

module.exports = {
  creatureEffect: true,
  requiresTarget: true, // Part 2 picks a damage target (Blinded gating).

  // ── Part 1 play-mode helpers (Deepsea-style, but sacrifice) ──
  // Additional-Action mode iff dropping onto a sacrificeable occupied
  // slot; a free-slot drop is a normal Action summon.
  inherentAction(gs, pi, heroIdx, engine, opts) {
    if (opts && opts.zoneSlot != null) {
      return !!findOccupant(engine, pi, heroIdx, opts.zoneSlot);
    }
    return sacrificeableSlots(engine, pi).length > 0;
  },
  // Playable on a full-zoned Hero only while THAT Hero owns a
  // sacrificeable Creature (the destination slot is the sacrificed
  // Creature's, so the host is this same Hero) — and `sacrificeableSlots`
  // already excludes Heroes that can't summon Suspicious Monster.
  canBypassFreeZoneRequirement(gs, pi, heroIdx, cardData, engine) {
    return sacrificeableSlots(engine, pi).some(s => s.heroIdx === heroIdx);
  },
  // Legal drop onto an occupied slot iff its occupant is sacrificeable.
  canPlaceOnOccupiedSlot(gs, pi, heroIdx, slotIdx, engine) {
    return !!findOccupant(engine, pi, heroIdx, slotIdx);
  },
  // Client highlight for the draggable drop targets.
  getBouncePlacementTargets(gs, pi, engine) {
    return sacrificeableSlots(engine, pi).map(s => ({ heroIdx: s.heroIdx, slotIdx: s.slotIdx }));
  },

  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];

    // Free-slot drop → normal Action summon (no sacrifice); let the
    // engine place it.
    if (ps._requestedNormalSummonSlot) {
      delete ps._requestedNormalSummonSlot;
      return true;
    }

    // Resolve the target occupied slot — the drop slot if provided,
    // otherwise prompt.
    let target = null;
    if (ps._requestedBouncePlaceSlot) {
      const req = ps._requestedBouncePlaceSlot;
      delete ps._requestedBouncePlaceSlot;
      const occ = findOccupant(engine, pi, req.heroIdx, req.slotIdx);
      if (occ) target = { heroIdx: req.heroIdx, slotIdx: req.slotIdx, inst: occ };
    }
    if (!target) {
      const slots = sacrificeableSlots(engine, pi);
      if (slots.length === 0) return false; // nothing to sacrifice → abort
      const zones = slots.map(s => ({
        heroIdx: s.heroIdx, slotIdx: s.slotIdx,
        label: `${ps.heroes[s.heroIdx]?.name || 'Hero'} — ${s.cardName} (Slot ${s.slotIdx + 1})`,
      }));
      const picked = await ctx.promptZonePick(zones, {
        title: CARD_NAME,
        description: `Sacrifice a Creature (not summoned this turn) to summon ${CARD_NAME} into its Support Zone?`,
        confirmLabel: '🗡️ Sacrifice & Summon',
        cancellable: true,
      });
      if (!picked) return false; // cancel → abort (card back to hand, Action kept)
      const occ = findOccupant(engine, pi, picked.heroIdx, picked.slotIdx);
      if (!occ) return false;
      target = { heroIdx: picked.heroIdx, slotIdx: picked.slotIdx, inst: occ };
    }

    const { heroIdx, slotIdx, inst: occ } = target;
    const occName = occ.name;

    // (1) Fire ON_CREATURE_SACRIFICED while the occupant is still in its
    //     slot — feeds Temple / Ruin Mourner / Corpse Cannibal / etc. +
    //     the per-turn tally and the `_sacrificedTurn` stamp.
    ps._creaturesSacrificedThisTurn = (ps._creaturesSacrificedThisTurn || 0) + 1;
    if (!occ.counters) occ.counters = {};
    occ.counters._sacrificedTurn = gs.turn;
    engine._broadcastEvent('play_zone_animation', {
      type: 'knife_sacrifice', owner: pi, heroIdx, zoneSlot: slotIdx,
    });
    await engine.runHooks('onCreatureSacrificed', {
      creature: occ, cardName: occName, owner: occ.owner,
      heroIdx, zoneSlot: slotIdx,
      source: { name: CARD_NAME, owner: pi, heroIdx },
      _skipReactionCheck: true,
    });

    // (2) Atomic swap: remove the occupant's name, place Suspicious
    //     Monster's name + a fresh instance into the SAME slot.
    const slotArr = ps.supportZones?.[heroIdx]?.[slotIdx];
    if (Array.isArray(slotArr)) {
      const idx = slotArr.indexOf(occName);
      if (idx >= 0) slotArr.splice(idx, 1);
    }
    if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
    ps.supportZones[heroIdx][slotIdx] = [CARD_NAME];
    const newInst = engine._trackCard(CARD_NAME, pi, 'support', heroIdx, slotIdx);
    newInst.counters = newInst.counters || {};
    newInst.counters.isPlacement = 1;
    newInst.turnPlayed = gs.turn || 0;

    // (3) Splice Suspicious Monster from hand (server pinned the copy via
    //     `_resolvingCard`); clearing it makes the server's commitHandRemoval
    //     a no-op, and `_placementConsumedByCard` skips its placement.
    let fromHandIdx = -1;
    if (ps._resolvingCard) {
      const { name, nth } = ps._resolvingCard;
      let seen = 0;
      for (let i = 0; i < ps.hand.length; i++) {
        if (ps.hand[i] === name) { seen++; if (seen === nth) { fromHandIdx = i; break; } }
      }
      if (fromHandIdx >= 0) {
        ps.hand.splice(fromHandIdx, 1);
        if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
      }
      ps._resolvingCard = null;
    }

    // (4) Hand→support flight + summon glow.
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: CARD_NAME, from: 'hand', to: 'support',
      fromHandIdx, toHeroIdx: heroIdx, toSlotIdx: slotIdx,
    });
    engine._broadcastEvent('summon_effect', {
      owner: pi, heroIdx, zoneSlot: slotIdx, cardName: CARD_NAME,
    });
    ps._placementConsumedByCard = CARD_NAME;
    engine.log('suspicious_monster_sacrifice_summon', {
      player: ps.username, sacrificed: occName, heroIdx, slotIdx,
    });
    engine.sync();

    // (5) Route the sacrificed occupant to discard + fire ON_CREATURE_DEATH
    //     (sacrifice is a sub-type of dying). The slot is already taken by
    //     Suspicious Monster, so a resummon-into-the-freed-slot reaction
    //     (Corpse Cannibal) correctly finds it occupied and skips.
    occ.zone = 'discard'; occ.heroIdx = -1; occ.zoneSlot = -1;
    if (!ps.discardPile) ps.discardPile = [];
    ps.discardPile.push(occName);
    await engine.runHooks('onCardLeaveZone', {
      card: occ, leavingCard: occ, fromZone: 'support',
      fromOwner: pi, fromHeroIdx: heroIdx, fromZoneSlot: slotIdx,
      toZone: 'discard', _skipReactionCheck: true,
    });
    await engine.runHooks('onCreatureDeath', {
      creature: {
        name: occName, owner: occ.owner, originalOwner: occ.originalOwner,
        heroIdx: slotIdx, zoneSlot: slotIdx, instId: occ.id,
      },
      source: { name: CARD_NAME, owner: pi, heroIdx },
      _skipReactionCheck: true,
    });
    engine._untrackCard(occ.id);

    // (6) Suspicious Monster's own on-summon lifecycle.
    const hostHero = gs.players[pi]?.heroes?.[heroIdx];
    const onDeadHero = !hostHero?.name || hostHero.hp <= 0;
    await engine.runHooks('onPlay', {
      _onlyCard: newInst, playedCard: newInst, cardName: CARD_NAME,
      zone: 'support', heroIdx, zoneSlot: slotIdx,
      _skipReactionCheck: true, _bypassDeadHeroFilter: onDeadHero,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: newInst, toZone: 'support', toHeroIdx: heroIdx,
      _skipReactionCheck: true, _bypassDeadHeroFilter: onDeadHero,
    });
    engine.sync();

    return true; // placement consumed — server skips its own placement.
  },

  // ── Part 2: once per turn, 100 damage to any target. ──
  canActivateCreatureEffect() { return true; },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      baseDamage: 100,
      title: CARD_NAME,
      description: 'Deal 100 damage to a target.',
      confirmLabel: '👹 100 Damage!',
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    const slot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: slot ?? -1,
    });
    await engine._delay(400);

    const source = { name: CARD_NAME, owner: pi, heroIdx };
    if (target.type === 'hero') {
      const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (tgtHero && tgtHero.hp > 0) await engine.actionDealDamage(source, tgtHero, 100, 'creature');
    } else if (target.cardInstance) {
      const live = engine.cardInstances.find(c => c.id === target.cardInstance.id);
      if (live && live.zone === 'support') {
        await engine.actionDealCreatureDamage(source, live, 100, 'creature', { sourceOwner: pi, canBeNegated: true });
      }
    }
    engine.log('suspicious_monster_strike', { player: gs.players[pi]?.username, target: target.cardName || target.type });
    engine.sync();
    return true;
  },

  cpuMeta: {
    onDeathBenefit: 6,
  },
};
