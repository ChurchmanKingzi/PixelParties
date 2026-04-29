// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Familiar"
//  Creature (Magic Arts + Summoning Magic Lv 1,
//  50 HP — Cute archetype). Max 1 controlled.
//
//  Four effects:
//
//  1. UNIQUENESS — only one "Cute Familiar"
//     per side (`canSummon` gate, mirrors
//     Cute Phoenix's pattern).
//
//  2. DISCARD-SUMMON — when discarded from hand,
//     may immediately summon as an additional
//     Action. No per-turn cap of its own — the
//     uniqueness rule is the natural limiter.
//
//  3. HOPT ADDITIONAL ACTION — once per turn,
//     pick a Hero you control with at least
//     Charme 2 and grant them an extra Action
//     via the engine's `performImmediateAction`.
//     If the Action is actually taken, that Hero
//     is locked from any further Actions this
//     turn (`hero._actionLockedTurn = gs.turn`,
//     same lock Treasure Hunter's Backpack uses).
//
//  4. END-OF-TURN REVIVE — when defeated, on the
//     turn end of the same turn, place a fresh
//     Cute Familiar from discard into the free
//     Support Zone of any own Hero with at least
//     Charme 2 (if such a Hero + slot exists).
//     Implemented by re-tracking the dying card
//     in the discard zone with a death-turn
//     stamp, and acting on `onTurnEnd` once.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cute Familiar';
const REQUIRED_CHARME = 2;

// ─── HELPERS ─────────────────────────────

/**
 * Count a Hero's effective Charme level — Charme stacks plus any
 * Performance copies stacked on top of a Charme base, mirroring the
 * standard `countAbilityLevel` pattern from necromancy.js.
 */
function countCharme(ps, heroIdx) {
  let count = 0;
  for (const slot of (ps.abilityZones?.[heroIdx] || [])) {
    if (!slot || slot.length === 0) continue;
    const base = slot[0];
    for (const ab of slot) {
      if (ab === 'Charme') count++;
      else if (ab === 'Performance' && base === 'Charme') count++;
    }
  }
  return count;
}

/**
 * List own Heroes that have at least `REQUIRED_CHARME`, are alive,
 * not Frozen / Stunned / Bound, and not already action-locked this
 * turn (so the popup never offers a Hero who can't actually act).
 */
function eligibleCharmeHeroes(engine, pi) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.frozen || h.statuses?.stunned || h.statuses?.bound) continue;
    if (h._actionLockedTurn === gs.turn) continue;
    if (countCharme(ps, hi) < REQUIRED_CHARME) continue;
    out.push(hi);
  }
  return out;
}

/**
 * Heroes that can host a fresh Cute Familiar end-of-turn revive —
 * alive (NO frozen/stun gate, since it's a placement not a play),
 * Charme ≥ 2, and at least one free Support Zone slot.
 */
function eligibleReviveHosts(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (countCharme(ps, hi) < REQUIRED_CHARME) continue;
    const sup = ps.supportZones?.[hi] || [];
    if (!sup.some(slot => (slot || []).length === 0)) continue;
    out.push(hi);
  }
  return out;
}

/**
 * Heroes that could host a fresh Cute Familiar summon RIGHT NOW
 * (discard-summon path). Standard summon gate: alive, not Frozen
 * or Stunned, hero meets level/school req, at least one free
 * Support slot, controller not summon-locked.
 */
function getDiscardSummonHosts(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  if (ps.summonLocked) return [];
  const cardDB = engine._getCardDB();
  const cd = cardDB[CARD_NAME];
  if (!cd) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.frozen || h.statuses?.stunned) continue;
    const sup = ps.supportZones?.[hi] || [];
    if (!sup.some(slot => (slot || []).length === 0)) continue;
    if (!engine.heroMeetsLevelReq(pi, hi, cd)) continue;
    out.push(hi);
  }
  return out;
}

// ─── CARD MODULE ─────────────────────────

module.exports = {
  // 'support' — HOPT effect & dying-self detection.
  // 'discard' — discard-summon trigger AND end-of-turn revive listener
  //             (re-tracked in onCreatureDeath so the dead instance
  //             survives long enough to fire onTurnEnd).
  activeIn: ['support', 'discard'],

  // ── 1. UNIQUENESS ──────────────────────────────────────────────
  canSummon(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    for (const c of engine.cardInstances) {
      if (c.zone !== 'support') continue;
      if (c.name !== CARD_NAME) continue;
      if ((c.controller ?? c.owner) !== pi) continue;
      if (c.id === ctx.card.id) continue;
      return false;
    }
    return true;
  },

  // ── 3. HOPT ADDITIONAL ACTION ──────────────────────────────────
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    return eligibleCharmeHeroes(ctx._engine, ctx.cardOwner).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi     = ctx.cardOwner;
    const ps     = engine.gs.players[pi];
    if (!ps) return false;

    const heroes = eligibleCharmeHeroes(engine, pi);
    if (heroes.length === 0) return false;

    // Pick which Charme-2+ Hero gets the extra Action. Auto-select
    // when only one is eligible.
    let targetHi;
    if (heroes.length === 1) {
      targetHi = heroes[0];
    } else {
      const zones = heroes.map(hi => ({
        heroIdx: hi, slotIdx: -1,
        label: `${ps.heroes[hi].name} (Charme ${countCharme(ps, hi)})`,
      }));
      const picked = await engine.promptGeneric(pi, {
        type: 'zonePick',
        zones,
        title: CARD_NAME,
        description: 'Choose a Charme 2+ Hero to perform an additional Action (that Hero can\'t perform other Actions this turn).',
        cancellable: true,
      });
      if (!picked || picked.cancelled) return false;
      targetHi = typeof picked.heroIdx === 'number' ? picked.heroIdx : heroes[0];
      if (!heroes.includes(targetHi)) targetHi = heroes[0];
    }

    const targetHero = ps.heroes?.[targetHi];
    if (!targetHero?.name || targetHero.hp <= 0) return false;

    // Grant the bonus Action via the canonical helper. Returns
    // { played: false } if the Hero has nothing eligible OR the
    // player cancelled — in either case we DON'T lock the Hero
    // (the "if you do" rider didn't trigger).
    const result = await engine.performImmediateAction(pi, targetHi, {
      title: CARD_NAME,
      description: `${targetHero.name} may perform an additional Action — but cannot perform any other Actions this turn.`,
    });
    if (!result?.played) return false;

    // Lock the Hero from any further Actions this turn. Standard
    // per-hero `_actionLockedTurn` flag — blocks Spell/Attack/Creature
    // plays AND ability activations for the rest of this turn,
    // cleared automatically at turn-start.
    targetHero._actionLockedTurn = engine.gs.turn;

    engine.log('cute_familiar_extra_action', {
      player: ps.username,
      hero: targetHero.name,
      played: result.cardName,
      cardType: result.cardType,
    });
    engine.sync();
    return true;
  },

  // ── 2. DISCARD-SUMMON  +  4. END-OF-TURN REVIVE ────────────────
  hooks: {
    onDiscard: async (ctx) => {
      // Same gating as Cute Dog: only the just-discarded copy fires.
      if (!ctx._fromHand) return;
      if (ctx.discardedCardName !== CARD_NAME) return;
      if (ctx.playerIdx !== ctx.cardOwner) return;
      if (ctx.card?.zone !== 'discard') return;

      const engine = ctx._engine;
      const pi     = ctx.cardOwner;
      const ps     = engine.gs.players[pi];
      if (!ps) return;

      // Uniqueness pre-check — if a Familiar is already in support,
      // canSummon would refuse anyway. Skip prompting in that case.
      const dummyCtx = { _engine: engine, cardOwner: pi, card: { id: -1 } };
      if (!module.exports.canSummon(dummyCtx)) return;

      const hosts = getDiscardSummonHosts(engine, pi);
      if (hosts.length === 0) return;

      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Immediately summon ${CARD_NAME} as an additional Action?`,
        confirmLabel: '✨ Summon!',
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true, // True "you may" — opt-in summon.
      });
      if (!confirmed) return;

      // Pick destination zone
      const zones = [];
      for (const hi of hosts) {
        const sup = ps.supportZones?.[hi] || [];
        for (let s = 0; s < 3; s++) {
          if ((sup[s] || []).length === 0) {
            zones.push({ heroIdx: hi, slotIdx: s, label: `${ps.heroes[hi].name} — Support ${s + 1}` });
          }
        }
      }
      if (zones.length === 0) return;

      let chosen;
      if (zones.length === 1) {
        chosen = zones[0];
      } else {
        const picked = await engine.promptGeneric(pi, {
          type: 'zonePick',
          zones,
          title: CARD_NAME,
          description: `Choose a Support Zone to summon ${CARD_NAME} into.`,
          cancellable: true,
        });
        if (!picked || picked.cancelled) return;
        chosen = zones.find(z => z.heroIdx === picked.heroIdx && z.slotIdx === picked.slotIdx) || zones[0];
      }

      // Pop one copy out of the discard pile array & untrack the
      // listener instance to avoid an orphan tracked in 'discard'.
      const dpIdx = (ps.discardPile || []).indexOf(CARD_NAME);
      if (dpIdx < 0) return;
      ps.discardPile.splice(dpIdx, 1);

      const oldInst = ctx.card;
      if (oldInst && oldInst.zone === 'discard') {
        engine._untrackCard(oldInst.id);
      }

      await engine.summonCreatureWithHooks(
        CARD_NAME, pi, chosen.heroIdx, chosen.slotIdx,
        { source: CARD_NAME }
      );
      engine.log('cute_familiar_discard_summon', {
        player: ps.username, heroIdx: chosen.heroIdx,
      });
      engine.sync();
    },

    // ── 4. END-OF-TURN REVIVE (setup) ──
    // When the live Familiar dies, re-track a fresh instance in the
    // discard zone with a death-turn stamp. The instance survives the
    // engine's `_untrackCard` of the original (different `id`) and
    // listens for `onTurnEnd` to attempt the placement once.
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.instId !== ctx.card.id) return;

      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      // Re-track a discard-zone listener for this turn's revive
      // attempt. Using `_trackCard` directly (not `safePlaceInSupport`)
      // because this isn't a placement — just a parking-spot for the
      // hooks until end-of-turn.
      const reviveInst = engine._trackCard(CARD_NAME, pi, 'discard');
      if (reviveInst) {
        reviveInst._cuteFamiliarDiedTurn = engine.gs.turn;
        reviveInst._cuteFamiliarReviveOwner = pi;
      }
    },

    // ── 4. END-OF-TURN REVIVE (resolve) ──
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      // Only the discard-side parking instance with a same-turn death
      // stamp acts. Live support copies (or stale parked instances
      // from past turns) skip out.
      if (ctx.card?.zone !== 'discard') return;
      if (ctx.card._cuteFamiliarDiedTurn !== engine.gs.turn) return;

      const pi = ctx.card._cuteFamiliarReviveOwner ?? ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;

      // Defensive: don't double-revive if a Familiar is already
      // back on the field somehow (e.g., manually re-summoned this
      // turn). The uniqueness rule still applies.
      const alreadyAlive = engine.cardInstances.some(c =>
        c.zone === 'support' && c.name === CARD_NAME && (c.controller ?? c.owner) === pi
      );
      if (alreadyAlive) {
        engine._untrackCard(ctx.card.id);
        return;
      }

      const hosts = eligibleReviveHosts(engine, pi);
      if (hosts.length === 0) {
        // "if possible" — silently skip and clean up the parker.
        engine._untrackCard(ctx.card.id);
        return;
      }

      // Auto-pick when only one eligible host; prompt otherwise.
      let chosen;
      if (hosts.length === 1) {
        const hi = hosts[0];
        const sup = ps.supportZones?.[hi] || [];
        const slot = sup.findIndex(s => (s || []).length === 0);
        chosen = { heroIdx: hi, slotIdx: slot >= 0 ? slot : -1 };
      } else {
        const zones = [];
        for (const hi of hosts) {
          const sup = ps.supportZones?.[hi] || [];
          for (let s = 0; s < 3; s++) {
            if ((sup[s] || []).length === 0) {
              zones.push({ heroIdx: hi, slotIdx: s, label: `${ps.heroes[hi].name} — Support ${s + 1}` });
            }
          }
        }
        const picked = await engine.promptGeneric(pi, {
          type: 'zonePick',
          zones,
          title: CARD_NAME,
          description: `Place ${CARD_NAME} into the free Support Zone of a Charme 2+ Hero you control.`,
          cancellable: false,
        });
        chosen = zones.find(z => z.heroIdx === picked?.heroIdx && z.slotIdx === picked?.slotIdx) || zones[0];
      }

      // Pop from discard pile array (the dead Familiar) and untrack
      // the parker before placing.
      const dpIdx = (ps.discardPile || []).indexOf(CARD_NAME);
      if (dpIdx >= 0) ps.discardPile.splice(dpIdx, 1);
      engine._untrackCard(ctx.card.id);

      // Use safePlaceInSupport + manual on-play hooks (Necromancy's
      // pattern) — placements bypass the regular summon path so we
      // don't increment _creaturesSummonedThisTurn at end-of-turn.
      const placeRes = engine.safePlaceInSupport(CARD_NAME, pi, chosen.heroIdx, chosen.slotIdx);
      if (!placeRes) return;
      const { inst, actualSlot } = placeRes;

      engine._broadcastEvent('summon_effect', {
        owner: pi, heroIdx: chosen.heroIdx, zoneSlot: actualSlot, cardName: CARD_NAME,
      });

      await engine.runHooks('onPlay', {
        _onlyCard: inst, playedCard: inst, cardName: CARD_NAME,
        zone: 'support', heroIdx: chosen.heroIdx, zoneSlot: actualSlot,
        _skipReactionCheck: true,
      });
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: chosen.heroIdx,
        _skipReactionCheck: true,
      });

      engine.log('cute_familiar_eot_revive', {
        player: ps.username, heroIdx: chosen.heroIdx, zoneSlot: actualSlot,
      });
      engine.sync();
    },
  },

  cpuMeta: {
    // Death is heavily mitigated by the end-of-turn revive AND the
    // hand value of an additional discard-summon path.
    onDeathBenefit: 30,
  },
};
