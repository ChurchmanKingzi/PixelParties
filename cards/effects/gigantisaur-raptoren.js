// ═══════════════════════════════════════════
//  CARD EFFECT: "Gigantisaur Raptoren"
//  Creature (Normal, Lv3, Summoning Magic) — Gigantisaurs
//  HP 100
//
//  ① UNIQUENESS — shared archetype rule.
//
//  ② CHAIN SUMMON — when you summon Raptoren,
//    you may immediately summon another
//    Gigantisaur Creature from your hand as an
//    additional Action.
//
//  ③ ACTIVE — Once per turn, draw cards equal
//    to the number of Gigantisaur Creatures you
//    currently control.
// ═══════════════════════════════════════════

const {
  gigantisaursCanSummon, isGigantisaurCreature,
  countGigantisaursInSupport,
} = require('./_gigantisaurs-shared');

const CARD_NAME = 'Gigantisaur Raptoren';

/**
 * Distinct (heroIdx, slotIdx) pairs Raptoren's controller can host a
 * given Gigantisaur Creature on RIGHT NOW. Filters: alive Hero, not
 * Frozen/Stunned, meets the card's level requirement, slot is empty,
 * and the chained creature's OWN `canSummon` allows this hero.
 *
 * The per-Hero `canSummon` consult is what lets King Trex target a
 * Gigantisaur-hosting Hero through Raptoren — Trex's relaxed gate
 * permits the host (auto-sacrificing the resident Gigantisaur in
 * beforeSummon), while the rest of the archetype keeps the strict
 * "1 Gigantisaur per Hero" rule via `gigantisaursCanSummon`. Without
 * this, Raptoren's local filter hardcoded the strict rule and the
 * Trex carve-out never applied here.
 */
function eligibleHostSlots(engine, pi, cardData) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  if (ps.summonLocked) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.frozen || h.statuses?.stunned) continue;
    if (!engine.heroMeetsLevelReq(pi, hi, cardData)) continue;
    // Per-creature canSummon check — handles the archetype's "1 per
    // Hero" rule for most Gigantisaurs (via gigantisaursCanSummon)
    // AND King Trex's relaxed "auto-sacrifice the resident" carve-
    // out without Raptoren needing to know either rule itself.
    if (!engine.isCreatureSummonable(cardData.name, pi, hi)) continue;
    const zones = ps.supportZones?.[hi] || [[], [], []];
    for (let z = 0; z < 3; z++) {
      if ((zones[z] || []).length === 0) out.push({ heroIdx: hi, slotIdx: z });
    }
  }
  return out;
}

module.exports = {
  activeIn: ['support'],
  canSummon: gigantisaursCanSummon,

  hooks: {
    /**
     * Chain-summon trigger. Filter to THIS Raptoren's own summon —
     * we only fan-out the "may summon another Gigantisaur" prompt
     * when Raptoren itself just landed, not for sibling Raptoren
     * onPlay fires.
     */
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id) return;
      if (ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;

      // Build the list of hand-slot indices that hold a Gigantisaur
      // Creature with at least one viable host. The picker lights up
      // those slots in hand (rather than opening a separate gallery)
      // and grays out everything else. Recomputed inside the loop so
      // mid-flow state changes (a discard cost paid by the chained
      // creature's `beforeSummon`, an evaluated host losing a slot
      // mid-resolution, …) refresh eligibility every retry.
      const cardDB = engine._getCardDB();
      const buildEligibleHandIndices = () => {
        const out = [];
        for (let i = 0; i < (ps.hand || []).length; i++) {
          const cn = ps.hand[i];
          if (!isGigantisaurCreature(cn, engine)) continue;
          const cd = cardDB[cn];
          if (!cd) continue;
          if (eligibleHostSlots(engine, pi, cd).length === 0) continue;
          out.push(i);
        }
        return out;
      };

      let initialEligible = buildEligibleHandIndices();
      if (initialEligible.length === 0) return;

      // No upfront Yes/No confirm — the player goes straight into the
      // picker. Cancelling the picker is the opt-out.
      //
      // ── Pick / summon loop ──
      // Each iteration: pick a hand card (+ optional zone via drag-to-
      // zone) → resolve any remaining zone choice → fire the actual
      // summon. Cancelling at the zone-pick OR inside the chained
      // creature's own beforeSummon brings the player BACK to the
      // hand picker IF there are 2+ legal targets — so they can
      // change their mind. With only one legal target left, re-
      // prompting the same picker would be pointless, so we exit.
      while (true) {
        const eligibleIndices = buildEligibleHandIndices();
        if (eligibleIndices.length === 0) return; // nothing legal left

        // Per-card host map. The client uses this to highlight valid
        // drop zones while a Gigantisaur is being dragged from hand;
        // dropping on one of those zones bypasses the separate zone-
        // pick prompt below and round-trips `targetHeroIdx` /
        // `targetSlotIdx` directly in the prompt response. Clicking
        // (no drag) returns just `{cardName, handIndex}` — same
        // path the click-only picker uses.
        const eligibleHostsByCardName = {};
        for (const idx of eligibleIndices) {
          const cn = ps.hand[idx];
          if (eligibleHostsByCardName[cn]) continue;
          const cd = cardDB[cn];
          if (!cd) continue;
          eligibleHostsByCardName[cn] = eligibleHostSlots(engine, pi, cd).map(h => ({
            heroIdx: h.heroIdx, slotIdx: h.slotIdx,
          }));
        }

        const pick = await engine.promptGeneric(pi, {
          type: 'pickHandCard',
          title: CARD_NAME,
          description: 'Summon another Gigantisaur from your hand as an additional Action.',
          instruction: 'Click a highlighted Gigantisaur — or drag it onto a Support Zone — to summon it.',
          eligibleIndices,
          eligibleHostsByCardName,
          dragSummonMode: true,
          cancellable: true,
        });
        if (!pick || pick.cancelled || pick.handIndex == null) return;
        const chosenHandIdx = pick.handIndex;
        const chosenName = ps.hand[chosenHandIdx];
        const chosenCd = cardDB[chosenName];
        if (!chosenCd) return;

        // Host-zone resolution. Drag-to-zone shortcut: when the
        // client carried `targetHeroIdx` + `targetSlotIdx` in the
        // response, re-validate (state may have shifted between
        // prompt fire and resolve) and use directly. Otherwise the
        // click-only path falls through to the existing zone-pick.
        const hosts = eligibleHostSlots(engine, pi, chosenCd);
        if (hosts.length === 0) {
          if (buildEligibleHandIndices().length >= 2) continue;
          return;
        }
        let slot = null;
        if (pick.targetHeroIdx != null && pick.targetSlotIdx != null) {
          slot = hosts.find(h => h.heroIdx === pick.targetHeroIdx && h.slotIdx === pick.targetSlotIdx);
          if (!slot) {
            // Drop landed on a stale zone — fall back to the zone-pick.
          }
        }
        if (!slot) {
          if (hosts.length === 1) {
            slot = hosts[0];
          } else {
            const zones = hosts.map(h => ({
              heroIdx: h.heroIdx, slotIdx: h.slotIdx,
              label: `${ps.heroes[h.heroIdx]?.name || 'Hero ' + (h.heroIdx + 1)} — Support ${h.slotIdx + 1}`,
            }));
            const zp = await engine.promptGeneric(pi, {
              type: 'zonePick',
              zones,
              title: CARD_NAME,
              description: `Place ${chosenName} into which Support Zone?`,
              cancellable: true,
            });
            if (!zp || zp.cancelled) {
              if (buildEligibleHandIndices().length >= 2) continue;
              return;
            }
            slot = hosts.find(h => h.heroIdx === zp.heroIdx && h.slotIdx === zp.slotIdx) || hosts[0];
          }
        }

        // Mark the in-flight copy via `_resolvingCard` (engine's
        // standard pattern) so the chained creature's beforeSummon
        // can skip the in-flight slot when iterating the hand —
        // Chimera's distinct-name discard prompt is the immediate
        // case. We DO NOT pre-splice; that mutation drove the
        // diff-detector animation bug where a rollback fired a
        // "fly in from opp's side" effect on whichever card the
        // hand-length diff happened to point at.
        const nth = ps.hand.slice(0, chosenHandIdx + 1).filter(c => c === chosenName).length;
        const prevResolving = ps._resolvingCard;
        ps._resolvingCard = { name: chosenName, nth };

        let placed = null;
        try {
          placed = await engine.summonCreatureWithHooks(
            chosenName, pi, slot.heroIdx, slot.slotIdx,
            {
              source: CARD_NAME,
              hookExtras: {
                _summonedBy: CARD_NAME,
                _summonedAsAdditional: true,
              },
            },
          );
        } finally {
          ps._resolvingCard = prevResolving;
        }

        if (!placed) {
          // Summon refused (beforeSummon cancelled, full zone, …).
          // No state to roll back — we never spliced. Re-prompt the
          // target picker if the player still has 2+ legal picks.
          if (buildEligibleHandIndices().length >= 2) continue;
          return;
        }

        // Success — now splice the chosen copy out of hand. Re-locate
        // by name (the slot index may have shifted during the chained
        // creature's beforeSummon discards) and untrack the hand inst.
        // Capture the post-splice hand index AS-WAS so the hand→board
        // flight animation below targets the correct source slot.
        const realIdx = ps.hand.indexOf(chosenName);
        if (realIdx >= 0) ps.hand.splice(realIdx, 1);
        const handInst = engine.cardInstances.find(c =>
          c.owner === pi && c.zone === 'hand' && c.name === chosenName,
        );
        if (handInst) engine._untrackCard(handInst.id);

        // Visual: card flies from the hand slot to the destination
        // support zone, and the slot glows on landing — mirrors the
        // normal-summon UX (`broadcastHandToBoard` + `summon_effect`
        // in server.js doPlayCreature). `_forceOwnerAnim: true` opts
        // both sides into the flight (default suppresses it for the
        // owner since a drag-and-drop summon already animates client-
        // side; chain summons that resolve via click DON'T have a
        // pre-existing drag animation, so the owner needs the flight
        // too).
        if (realIdx >= 0) {
          engine._broadcastEvent('hand_to_board_fly', {
            ownerIdx: pi, cardName: chosenName, handIndex: realIdx,
            zoneType: 'support', heroIdx: slot.heroIdx, slotIdx: slot.slotIdx,
            _forceOwnerAnim: true,
          });
        }
        engine._broadcastEvent('summon_effect', {
          owner: pi, heroIdx: slot.heroIdx, zoneSlot: slot.slotIdx,
          cardName: chosenName,
        });

        await engine.runHooks('onActionUsed', {
          actionType: 'creature', source: CARD_NAME, playerIdx: pi,
          cardName: chosenName, heroIdx: slot.heroIdx,
          _skipReactionCheck: true,
        });
        await engine.runHooks('onAdditionalActionUsed', {
          actionType: 'creature', source: CARD_NAME, playerIdx: pi,
          cardName: chosenName, heroIdx: slot.heroIdx,
          _skipReactionCheck: true,
        });

        engine.log('raptoren_chain_summon', {
          player: ps.username, summoned: chosenName,
          heroIdx: slot.heroIdx, zoneSlot: slot.slotIdx,
        });
        engine.sync();
        return;
      }
    },
  },

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    if (ps.handLocked) return false;
    // Effect is meaningless when there are no Gigantisaurs to count.
    return countGigantisaursInSupport(ctx.cardOwner, engine) > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    const count = countGigantisaursInSupport(pi, engine);
    if (count <= 0) return false;
    await engine.actionDrawCards(pi, count);
    engine.log('raptoren_draw', { player: ps.username, drew: count });
    engine.sync();
    return true;
  },
};
