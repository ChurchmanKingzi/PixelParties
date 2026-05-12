// ═══════════════════════════════════════════
//  CARD EFFECT: "Mischief Invasion"
//  Spell — Summoning Magic Lv1
//
//  N = Frozen targets on the board.
//
//  1) Choose up to N "Mischief Militia" Creatures
//     from your hand and summon each as an
//     additional Action. EACH chosen Creature is
//     summoned by a Hero capable of summoning it
//     normally (alive, sufficient ability levels
//     for the Creature's level / schools, not
//     Frozen / Stunned / Negated / Bound for
//     Lv > 0 Creatures, with a free Support
//     Zone). Per user spec, the total number of
//     Creatures selectable is the MAX BIPARTITE
//     MATCHING between MM Creatures in hand and
//     eligible (Hero, free-slot) pairs — so a
//     single Lv2-eligible slot allows at most one
//     Lv2 Creature, etc. Tighter Creatures
//     (fewest eligible slots) summon first so
//     looser ones don't gobble the constrained
//     slots.
//
//  2) Then choose `summonedCount` non-Frozen
//     targets and Freeze them for 1 turn —
//     `summonedCount` is how many actually
//     landed, not the cap.
//
//  Once per turn per player.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const {
  ARCHETYPE,
  countFrozenTargets,
  enumerateFreezableNonFrozenTargets,
  applyFreezeToTarget,
} = require('./_mischief-militia-shared');

const CARD_NAME = 'Mischief Invasion';

// ─── Helpers ─────────────────────────────────

function _isMmCreature(cd) {
  return !!cd && cd.archetype === ARCHETYPE && hasCardType(cd, 'Creature');
}

/**
 * Can hero `heroIdx` legally host this card right now?
 * Mirrors the standard summoning gate:
 *   • Hero alive.
 *   • For Lv > 0 Creatures: hero not Frozen / Stunned / Negated / Bound.
 *   • Spell-school requirement met via `heroMeetsLevelReq` (handles
 *     Performance, Mana Mining, Crystal multipliers, etc.).
 * Slot-level free-ness is checked separately when building slot list.
 */
function _heroCanHostCreature(engine, pi, heroIdx, cd) {
  const ps = engine.gs.players[pi];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if ((cd.level || 0) > 0) {
    const s = hero.statuses || {};
    if (s.frozen || s.stunned || s.negated || s.bound) return false;
  }
  if (!engine.heroMeetsLevelReq(pi, heroIdx, cd)) return false;
  return true;
}

/** Every free own-side Support Zone, with the host Hero index. */
function _enumerateFreeOwnSlots(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const slots = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    const zones = ps.supportZones?.[hi] || [];
    for (let zi = 0; zi < 3; zi++) {
      if ((zones[zi] || []).length === 0) {
        slots.push({ heroIdx: hi, slotIdx: zi, label: `${hero.name} — Slot ${zi + 1}` });
      }
    }
  }
  return slots;
}

/**
 * Free Support Zones whose Hero can legally host `cd` right now. Used
 * by the per-Creature destination prompt so the eligible-host list
 * reflects the live board state (a prior chained summon may have
 * killed a host, filled a slot, or otherwise narrowed the field).
 */
function _enumerateHostSlotsForCreature(engine, pi, cd) {
  const slots = _enumerateFreeOwnSlots(engine, pi);
  return slots.filter(s => _heroCanHostCreature(engine, pi, s.heroIdx, cd));
}

/**
 * Build the list of MM Creature copies in `pi`'s hand. Each copy is its
 * own match node so duplicates compete for slots independently. Returns
 * `[{ name, cd, handIdx, eligibleSlotIdxs }]`. `eligibleSlotIdxs` is
 * the subset of `slots` indices the copy could legally land in.
 */
function _buildHandCopies(engine, pi, slots) {
  const ps = engine.gs.players[pi];
  if (!ps?.hand) return [];
  const cardDB = engine._getCardDB();
  const copies = [];
  for (let handIdx = 0; handIdx < ps.hand.length; handIdx++) {
    const name = ps.hand[handIdx];
    const cd = cardDB[name];
    if (!_isMmCreature(cd)) continue;
    const eligibleSlotIdxs = [];
    for (let s = 0; s < slots.length; s++) {
      if (_heroCanHostCreature(engine, pi, slots[s].heroIdx, cd)) {
        eligibleSlotIdxs.push(s);
      }
    }
    if (eligibleSlotIdxs.length === 0) continue; // un-summonable copy — drop
    copies.push({ name, cd, handIdx, eligibleSlotIdxs });
  }
  return copies;
}

/**
 * Max-cardinality bipartite matching via DFS augmenting paths.
 * cards[i].eligibleSlotIdxs lists the slot indices card `i` may occupy.
 * Returns `{ cardToSlot, count }` — `cardToSlot[i]` is the slot index
 * matched to card `i` (-1 if unmatched), `count` is the matching size.
 *
 * Problem sizes here are tiny (≤ ~10 cards × ≤ 9 slots), so the simple
 * O(V·E) augmenting-path algorithm is more than fast enough.
 */
function _maxMatching(cards, slotCount) {
  const cardToSlot = new Array(cards.length).fill(-1);
  const slotToCard = new Array(slotCount).fill(-1);
  function augment(c, visited) {
    for (const s of cards[c].eligibleSlotIdxs) {
      if (visited.has(s)) continue;
      visited.add(s);
      if (slotToCard[s] === -1 || augment(slotToCard[s], visited)) {
        cardToSlot[c] = s;
        slotToCard[s] = c;
        return true;
      }
    }
    return false;
  }
  for (let c = 0; c < cards.length; c++) augment(c, new Set());
  let count = 0;
  for (const v of cardToSlot) if (v >= 0) count++;
  return { cardToSlot, count };
}

/**
 * Map handPick response entries (`{ handIndex, cardName }`) onto the
 * pre-computed copies — keyed by handIndex, which uniquely identifies
 * a copy. Same-name copies share `eligibleSlotIdxs` so the matching
 * works the same regardless of which copy is picked, but we keep the
 * original handIndex for the splice-and-summon step.
 */
function _pickSelectedCopies(selectedEntries, allCopies) {
  const byIdx = new Map();
  for (const c of allCopies) byIdx.set(c.handIdx, c);
  const picked = [];
  for (const sel of selectedEntries) {
    const c = byIdx.get(sel.handIndex);
    if (c && c.name === sel.cardName) picked.push(c);
  }
  return picked;
}

// ─── Card module ─────────────────────────────

module.exports = {
  /**
   * Eligibility gate: need at least 1 Frozen target (cap > 0), at least
   * one MM Creature in hand whose level/school can be hosted by SOME own
   * Hero with a free Support Zone, and the 1-per-turn slot must be
   * unused.
   */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    const ps = gs.players[pi];
    if (!ps) return false;
    if (ps._mischiefInvasionUsedTurn === gs.turn) return false;
    if (countFrozenTargets(engine) < 1) return false;
    const slots = _enumerateFreeOwnSlots(engine, pi);
    if (slots.length === 0) return false;
    // At least one MM Creature in hand must be summonable somewhere.
    return _buildHandCopies(engine, pi, slots).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;

      const frozenCount = countFrozenTargets(engine);
      if (frozenCount < 1) {
        engine.gs._spellCancelled = true;
        return;
      }

      const slots = _enumerateFreeOwnSlots(engine, pi);
      if (slots.length === 0) {
        engine.gs._spellCancelled = true;
        return;
      }

      const copies = _buildHandCopies(engine, pi, slots);
      if (copies.length === 0) {
        engine.gs._spellCancelled = true;
        return;
      }

      // ── Max matching across ALL summonable copies in hand. ──
      // The picker's cap is the matching size — bigger picks would
      // necessarily leave some Creature un-summonable.
      const fullMatch = _maxMatching(copies, slots.length);
      const cap = Math.min(frozenCount, fullMatch.count);
      if (cap < 1) {
        engine.gs._spellCancelled = true;
        return;
      }

      // ── handPick prompt: click MM Creatures directly in hand. ──
      // The picker:
      //   • Highlights eligible hand indices (clickable MM Creatures
      //     that have at least one valid host).
      //   • Dims everything else (non-MM cards, MM Creatures with no
      //     eligible host, AND — dynamically — any MM Creature whose
      //     per-name cap is already filled by current selections, or
      //     whose pick would exceed the global cap).
      //   • Clicking a selected card toggles it off.
      //
      // Per-name caps via `cardTypes` + `typeLimits`: each MM Creature
      // hand index reports its card NAME as its type; the type's
      // limit is `min(handCount, eligibleSlotCount)` for that name.
      // So if only one Lv2-eligible slot exists, only one Bear Rider
      // can be picked — clicking a second one is blocked and the
      // remaining Bear Riders dim. Global `maxSelect = cap` (max
      // matching) closes the picker once total picks fill, dimming
      // every still-eligible MM Creature.
      const eligibleIndices = copies.map(c => c.handIdx);
      const cardTypes = {};
      const typeLimits = {};
      for (const c of copies) {
        cardTypes[c.handIdx] = c.name;
        // Same-name copies share `eligibleSlotIdxs.length` (eligibility
        // is determined by card data, not by the in-hand position).
        // Last write wins — they're all equal.
        typeLimits[c.name] = Math.min(
          // hand count of this name (already-filtered to summonables)
          copies.reduce((n, x) => n + (x.name === c.name ? 1 : 0), 0),
          c.eligibleSlotIdxs.length,
        );
      }

      const picked = await engine.promptGeneric(pi, {
        type: 'handPick',
        title: CARD_NAME,
        description: `Click "Mischief Militia" Creatures in your hand to summon them as additional Actions. Up to ${cap} total. Click a selected card to deselect.`,
        eligibleIndices,
        cardTypes,
        typeLimits,
        // Summon button stays disabled at 0 — confirming requires at
        // least 1 pick. Cancel still exits the spell entirely.
        minSelect: 1,
        maxSelect: cap,
        cancellable: true,
        confirmLabel: '🪖 Summon!',
      });

      // Cancel before commit → refund the spell.
      if (!picked || picked.cancelled) {
        engine.gs._spellCancelled = true;
        return;
      }

      // Claim once-per-turn slot the moment the player commits the
      // prompt — even a 0-target confirm counts as casting.
      ps._mischiefInvasionUsedTurn = engine.gs.turn;

      const selectedEntries = Array.isArray(picked.selectedCards) ? picked.selectedCards : [];
      if (selectedEntries.length === 0) {
        engine.log('mischief_invasion', { player: ps.username, summoned: 0, frozen: 0 });
        engine.sync();
        return;
      }

      // ── Resolve picker entries → concrete card copies. ──
      const selectedCopies = _pickSelectedCopies(selectedEntries, copies);
      if (selectedCopies.length === 0) {
        engine.log('mischief_invasion', { player: ps.username, summoned: 0, frozen: 0 });
        engine.sync();
        return;
      }

      // ── Summon in DESCENDING LEVEL order, one at a time. Each
      // iteration uses a `zonePick` prompt for the destination — the
      // canonical zone-highlight UX. Every eligible (Hero, Support
      // Zone) pair lights up with the standard `zone-pick-target`
      // class (the same highlight the normal-summon drag lands on),
      // AND the Hero card itself is clickable as a shortcut to its
      // first eligible Support Zone (mirroring the normal hand-play
      // path's "drop on Hero → auto-pick free slot" behaviour).
      const summonOrder = selectedCopies
        .slice()
        .sort((a, b) => (b.cd.level || 0) - (a.cd.level || 0));

      const summonedNames = [];
      for (let i = 0; i < summonOrder.length; i++) {
        const c = summonOrder[i];
        // Re-resolve hand index — prior summons spliced their copies
        // out so positions have shifted. Re-find by name.
        const handIdx = ps.hand.indexOf(c.name);
        if (handIdx < 0) continue; // race

        // Re-compute eligible host slots from current board state.
        // A previous summon's onPlay may have killed a host, filled a
        // slot, or otherwise narrowed the field.
        const hosts = _enumerateHostSlotsForCreature(engine, pi, c.cd);
        if (hosts.length === 0) continue; // no longer summonable — skip

        // Compute the hand-side highlight set for the prompt — the
        // CURRENT creature gets the urgent highlight, every still-
        // queued creature (later iterations) gets a normal outline,
        // and every other hand card dims. Queued indices are resolved
        // by name, skipping the current index and any already-claimed
        // queued slot so duplicate-name copies map to distinct hand
        // positions.
        const remainingNames = summonOrder.slice(i + 1).map(x => x.name);
        const claimed = new Set([handIdx]);
        const queuedHandIdxs = [];
        for (const remName of remainingNames) {
          for (let h = 0; h < ps.hand.length; h++) {
            if (claimed.has(h)) continue;
            if (ps.hand[h] === remName) {
              queuedHandIdxs.push(h);
              claimed.add(h);
              break;
            }
          }
        }

        let chosenSlot;
        if (hosts.length === 1) {
          // Only one possible host — auto-place (no prompt).
          chosenSlot = hosts[0];
        } else {
          // Highlight every eligible (Hero, Support Zone) pair on the
          // board. `zonePick` zones default to OWN side (owner = pi),
          // so no explicit owner needed. The hand-highlight fields
          // tell the client which hand card is the active subject and
          // which ones are still queued so the player can track the
          // pipeline visually.
          const zones = hosts.map(h => ({
            heroIdx: h.heroIdx, slotIdx: h.slotIdx,
            label: `${ps.heroes[h.heroIdx]?.name || 'Hero ' + (h.heroIdx + 1)} — Support ${h.slotIdx + 1}`,
          }));
          const zp = await engine.promptGeneric(pi, {
            type: 'zonePick',
            zones,
            title: CARD_NAME,
            description: `Place ${c.name} into a Support Zone. Click a highlighted Hero or Support Zone.`,
            cancellable: false,
            highlightHandIdx: handIdx,
            queuedHandIdxs,
          });
          chosenSlot = (zp && hosts.find(h => h.heroIdx === zp.heroIdx && h.slotIdx === zp.slotIdx)) || hosts[0];
        }

        // Mark in-flight via `_resolvingCard` so any beforeSummon cost
        // on the chained Creature can recognise the hand slot it's
        // being pulled from (Chimera's distinct-name discard, etc.).
        // Splice AFTER successful summon — pre-splicing has been known
        // to confuse the client-side hand diff detector (see Raptoren's
        // matching comment block).
        const nth = ps.hand.slice(0, handIdx + 1).filter(x => x === c.name).length;
        const prevResolving = ps._resolvingCard;
        ps._resolvingCard = { name: c.name, nth };

        let summonResult = null;
        try {
          summonResult = await engine.summonCreatureWithHooks(
            c.name, pi, chosenSlot.heroIdx, chosenSlot.slotIdx,
            {
              source: CARD_NAME,
              hookExtras: { _summonedBy: CARD_NAME, _summonedAsAdditional: true },
            },
          );
        } finally {
          ps._resolvingCard = prevResolving;
        }

        if (!summonResult?.inst) continue; // beforeSummon refused etc.

        // Splice the consumed copy + untrack the hand inst, then play
        // the canonical hand→board flight animation so the visual
        // matches a normal-summon drag-and-drop.
        const realIdx = ps.hand.indexOf(c.name);
        if (realIdx >= 0) ps.hand.splice(realIdx, 1);
        const handInst = engine.cardInstances.find(ci =>
          ci.owner === pi && ci.zone === 'hand' && ci.name === c.name,
        );
        if (handInst) engine._untrackCard(handInst.id);
        if (realIdx >= 0) {
          engine._broadcastEvent('hand_to_board_fly', {
            ownerIdx: pi, cardName: c.name, handIndex: realIdx,
            zoneType: 'support', heroIdx: chosenSlot.heroIdx, slotIdx: chosenSlot.slotIdx,
            _forceOwnerAnim: true,
          });
        }

        // `onActionUsed` / `onAdditionalActionUsed` so any "additional
        // action consumed" listeners (Necromancy, Slime Rancher, future
        // chained-action gates) fire per summon, matching the normal-
        // summon path.
        await engine.runHooks('onActionUsed', {
          actionType: 'creature', source: CARD_NAME, playerIdx: pi,
          cardName: c.name, heroIdx: chosenSlot.heroIdx,
          _skipReactionCheck: true,
        });
        await engine.runHooks('onAdditionalActionUsed', {
          actionType: 'creature', source: CARD_NAME, playerIdx: pi,
          cardName: c.name, heroIdx: chosenSlot.heroIdx,
          _skipReactionCheck: true,
        });

        summonedNames.push(c.name);
        engine.sync();
      }

      // ── Freeze step: count = summoned, not cap. ──
      const summonedCount = summonedNames.length;
      if (summonedCount === 0) {
        engine.log('mischief_invasion', { player: ps.username, summoned: 0, frozen: 0 });
        engine.sync();
        return;
      }

      const freezeCandidates = enumerateFreezableNonFrozenTargets(engine);
      if (freezeCandidates.length === 0) {
        engine.log('mischief_invasion', { player: ps.username, summoned: summonedCount, frozen: 0 });
        engine.sync();
        return;
      }

      const freezeMax = Math.min(summonedCount, freezeCandidates.length);
      // The Freeze step is mandatory and exhaustive — `minRequired ===
      // maxTotal` keeps the Confirm button disabled until the player
      // has selected EXACTLY `freezeMax` targets, so they can't shave
      // the freeze count below the spec ("as many targets as Creatures
      // got summoned, or as many as possible").
      const freezePick = await engine.promptEffectTarget(pi, freezeCandidates, {
        title: CARD_NAME,
        description: `Choose ${freezeMax} target(s) to Freeze for 1 turn.`,
        confirmLabel: '❄️ Freeze!',
        confirmClass: 'btn-info',
        cancellable: false,
        maxTotal: freezeMax,
        minRequired: freezeMax,
      });
      let frozenCount2 = 0;
      if (freezePick) {
        for (const id of freezePick) {
          const t = freezeCandidates.find(c => c.id === id);
          if (!t) continue;
          if (await applyFreezeToTarget(engine, t, 1, pi)) frozenCount2++;
        }
      }

      engine.log('mischief_invasion', {
        player: ps.username, summoned: summonedCount, frozen: frozenCount2,
      });
      engine.sync();
    },
  },
};
