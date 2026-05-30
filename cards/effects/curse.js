// ═══════════════════════════════════════════
//  CARD EFFECT: "Curse"
//  Spell (Decay Magic Lv0, Attachment)
//
//  Attach to ANY Hero (either side). While
//  attached, the host Hero's Attack stat is
//  forced to 0 — the engine's `actionGrantAtk` /
//  `actionRevokeAtk` / `grantTempHeroAtk` and the
//  temp-atk-expiry sweep all detect `cursed` and
//  route ATK mutations into a hidden
//  `hero._cursedAtkSuppressed` accumulator
//  instead of `hero.atk`. The displayed stat
//  stays pinned at 0 for the duration; on
//  cleanse, the accumulator restores the full
//  pre-curse + during-curse total.
//
//  Inherent additional Action: while 1+ Heroes
//  on the board fulfil the condition (carry a
//  cleansable status AND have no Spell already
//  attached to them), Curse is playable as a
//  free additional Action.
//
//  Two play modes — distinguished by Action-Phase
//  state at the moment of cast:
//
//    A) "Normal Action mode" — Action Phase,
//       caster Hero has NOT yet acted this turn.
//       Target list shows EVERY alive Hero with
//       a free Support Zone. If the picked Hero
//       happens to qualify (status + no spell),
//       the engine's inherent grant covers it
//       and Action Phase continues. If the picked
//       Hero does NOT qualify, this play converts
//       to a normal Action — `gs._spellForcesActionConsume`
//       is stamped, server.js's post-onPlay flip
//       rebinds `isInherentAction = false`, and
//       the standard auto-advance to Main Phase 2
//       fires.
//
//    B) "Inherent additional mode" — Main Phase 1
//       / Main Phase 2 / Action Phase post-acted.
//       Target list restricted to QUALIFYING
//       Heroes only (status + no spell).
//
//  Boolean status — multiple Curse copies on the
//  same Hero all bind the same single `cursed`
//  status (no extra suppression from a second
//  copy). The card still occupies a Support slot
//  per Attachment rules; cleanse routes every
//  attached copy to its caster's discard.
//
//  Cleansable — Juice / Beer / Cure / anything
//  with the `_viaCleanse` flag triggers the
//  `onStatusRemoved` cascade that restores the
//  host's ATK and discards every Curse copy.
// ═══════════════════════════════════════════

const { getCleansableStatuses } = require('./_hooks');

const CARD_NAME = 'Curse';
const STATUS_NAME = 'cursed';

/** True iff the hero qualifies for Curse's inherent grant: carries
 *  at least one cleansable status, has no Spell currently attached,
 *  AND has at least one free Support Zone slot to host Curse.
 *
 *  The free-slot check is load-bearing for the inherent-action gate
 *  (`_anyHeroQualifies` below): without it, a hero whose Support Zone
 *  is completely full of non-Spell cards (3 Equipment artifacts, say)
 *  would still "qualify", `inherentAction` would return true, Curse
 *  would appear playable in Main Phase / post-acted Action Phase, the
 *  player would click it… and the cast would silently fizzle inside
 *  `onPlay` (the `if (targetSlot === undefined) return;` branch). The
 *  card text — and the inherent grant — only makes sense for a Hero
 *  that can physically receive the Attachment, so the free-slot
 *  requirement belongs in the qualification predicate.
 */
function _heroQualifiesForCurse(engine, hero, ownerIdx, heroIdx) {
  if (!hero?.name || hero.hp <= 0) return false;
  const cleansable = getCleansableStatuses();
  const hasStatus = cleansable.some(k => hero.statuses?.[k]);
  if (!hasStatus) return false;
  // Walk the Support Zones once: a) require at least one empty slot,
  // b) reject if any slot's top card is a Spell (Curse can't stack
  // onto a Hero already carrying a Spell attachment).
  const cardDB = engine._getCardDB();
  const zones = engine.gs.players[ownerIdx]?.supportZones?.[heroIdx] || [];
  let hasFreeSlot = false;
  for (let si = 0; si < zones.length; si++) {
    const slot = zones[si] || [];
    if (slot.length === 0) { hasFreeSlot = true; continue; }
    const top = slot[slot.length - 1];
    const cd = cardDB[top];
    if (cd?.cardType === 'Spell') return false;
  }
  if (!hasFreeSlot) return false;
  return true;
}

/** Walks both sides for any Hero meeting the Curse condition. Used
 *  by `inherentAction` (engine-level "any qualifying target?") and
 *  by the post-target reclassification in onPlay. */
function _anyHeroQualifies(engine) {
  const gs = engine.gs;
  for (let p = 0; p < 2; p++) {
    const ps = gs.players[p];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      if (_heroQualifiesForCurse(engine, ps.heroes[hi], p, hi)) return true;
    }
  }
  return false;
}

/** Count live Curse Attachments on a (owner, heroIdx) slot. */
function _countCursesOnHero(engine, ownerIdx, heroIdx, excludeInstId = null) {
  let n = 0;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.name !== CARD_NAME) continue;
    if (inst.owner !== ownerIdx) continue;
    if (inst.heroIdx !== heroIdx) continue;
    if (excludeInstId != null && inst.id === excludeInstId) continue;
    n++;
  }
  return n;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  // ── Inherent grant ──
  // True iff ANY alive Hero on the board (own or opp) qualifies for
  // Curse's condition. Mirrors the engine's pattern of script-driven
  // inherentAction — `getValidationContext` sees the grant and lets
  // the play through in Main Phase / Action-Phase-post-acted without
  // consuming the main slot. The Action-Phase-pre-acted "normal
  // Action mode" flips this back via `gs._spellForcesActionConsume`
  // when the picked target doesn't qualify (see onPlay).
  inherentAction: (gs, pi, hi, engine) => _anyHeroQualifies(engine),

  // Need at least one Hero (any side) with a free Support slot to
  // physically attach to.
  spellPlayCondition(gs) {
    for (let p = 0; p < 2; p++) {
      const ps = gs.players[p];
      for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        const zones = ps.supportZones?.[hi] || [];
        for (let si = 0; si < 3; si++) {
          if (((zones[si] || []).length === 0)) return true;
        }
      }
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      // Self-cast gate: only fire when this card's own onPlay
      // invocation is for THIS instance in hand.
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;

      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const casterHeroIdx = ctx.cardHeroIdx;
      const casterPs = gs.players[pi];

      // ── Determine play mode ──
      //   A = Action Phase + caster Hero hasn't acted yet → wide
      //       target list, post-pick reclassification.
      //   B = otherwise (Main Phase, or Action Phase post-acted) →
      //       restricted target list (qualifying Heroes only).
      const isActionPhase = gs.currentPhase === 3;
      const casterActed = (casterPs?.heroesActedThisTurn || []).includes(casterHeroIdx);
      const isNormalActionMode = isActionPhase && !casterActed;

      // ── Build target list ──
      // Heroes with a free Support slot are eligible to host the
      // attachment in the first place; mode A widens to all such
      // Heroes, mode B narrows to those that also qualify for the
      // inherent grant.
      const targets = [];
      for (let p = 0; p < 2; p++) {
        const tps = gs.players[p];
        for (let hi = 0; hi < (tps?.heroes || []).length; hi++) {
          const hero = tps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          const zones = tps.supportZones?.[hi] || [];
          let hasFreeZone = false;
          for (let si = 0; si < 3; si++) {
            if (((zones[si] || []).length === 0)) {
              hasFreeZone = true;
              break;
            }
          }
          if (!hasFreeZone) continue;
          // Mode B: filter to qualifying only.
          if (!isNormalActionMode && !_heroQualifiesForCurse(engine, hero, p, hi)) continue;

          for (let si = 0; si < zones.length; si++) {
            if (((zones[si] || []).length === 0)) {
              targets.push({
                id: `equip-${p}-${hi}-${si}`,
                type: 'equip',
                owner: p, heroIdx: hi, slotIdx: si,
                cardName: '',
              });
            }
          }
          targets.push({
            id: `hero-${p}-${hi}`,
            type: 'hero',
            owner: p, heroIdx: hi,
            cardName: hero.name,
          });
        }
      }
      if (targets.length === 0) {
        // Fizzle to discard — NOT a player-cancel.
        //
        // Mode B (inherent additional Action) — Reactions between
        // hand-cast validation and resolve-time (the chain window
        // already ran inside `executeCardWithChain`) can scrub the
        // last qualifying target: an opponent Cure'ing the
        // Berserked / Frozen / etc. host, or attaching another Spell
        // to it, both empty the qualifying-only filter applied
        // above. Per the user's spec, "if no eligible target exists
        // at moment of resolution, move Curse from hand to discard,
        // it fizzles!" → DON'T set `_spellCancelled` (which would
        // refund the play and keep the card in hand). Just return —
        // server.js's post-resolve path routes the card to the
        // caster's discard pile normally.
        //
        // Mode A (Action Phase pre-acted) — the same shape applies
        // if every Hero with a free Support Zone is reacted away,
        // though `spellPlayCondition` typically prevents this at
        // validation. Either way the card fizzles to discard with
        // no Action consumed (the Mode A flip only fires AFTER a
        // target pick, which never happens here).
        engine.log('curse_fizzle', {
          player: gs.players[pi]?.username,
          reason: isNormalActionMode ? 'no_free_support_slots' : 'no_qualifying_targets_at_resolve',
        });
        return;
      }

      // ── Pick target ──
      let targetOwner, targetHeroIdx, targetSlot;
      const heroTargets = targets.filter(t => t.type === 'hero');
      const zoneTargets = targets.filter(t => t.type === 'equip');
      if (heroTargets.length === 1 && zoneTargets.length === 1) {
        targetOwner = heroTargets[0].owner;
        targetHeroIdx = heroTargets[0].heroIdx;
        targetSlot = zoneTargets[0].slotIdx;
      } else {
        const description = isNormalActionMode
          ? 'Attach Curse to any Hero. If the target carries a cleansable status and has no Spell attached, this play becomes an additional Action.'
          : 'Attach Curse to a Hero that carries a cleansable status and has no Spell attached. (Inherent additional Action.)';
        const picked = await engine.promptEffectTarget(pi, targets, {
          title: CARD_NAME,
          description,
          confirmLabel: '🧿 Curse!',
          confirmClass: 'btn-danger',
          cancellable: true,
          exclusiveTypes: false,
          maxPerType: { hero: 1, equip: 1 },
          greenSelect: true,
        });
        if (!picked || picked.length === 0) { gs._spellCancelled = true; return; }
        const target = targets.find(t => t.id === picked[0]);
        if (!target) { gs._spellCancelled = true; return; }
        targetOwner = target.owner;
        if (target.type === 'equip') {
          targetHeroIdx = target.heroIdx;
          targetSlot = target.slotIdx;
        } else {
          targetHeroIdx = target.heroIdx;
          const tps = gs.players[targetOwner];
          for (let si = 0; si < 3; si++) {
            if (((tps.supportZones[targetHeroIdx] || [])[si] || []).length === 0) {
              targetSlot = si;
              break;
            }
          }
        }
      }
      if (targetSlot === undefined) return;

      const tps = gs.players[targetOwner];
      const targetHero = tps.heroes[targetHeroIdx];
      if (!targetHero?.name || targetHero.hp <= 0) return;

      // ── Surprise window ──
      // Curse picks its target through `promptEffectTarget` (non-
      // damage targeting). That hub does NOT fire
      // `_checkSurpriseWindow` — only the damage-target pickers
      // (`promptDamageTarget`, `promptMultiTarget`) and the AoE / direct-
      // damage paths do. So a face-down Surprise on the host Hero that
      // fires "when the user is chosen by an Attack or Spell"
      // (Booby Trap, Flooding, Frost Rune, Mountain Tear River, …)
      // never sees the Curse cast unless we open the window manually
      // here. The host Hero is the implicit target regardless of
      // whether the player clicked the hero portrait or a specific
      // free Support slot — both mean "Curse is being attached to
      // this Hero". `ctx.card` is the Curse hand instance, which the
      // surprise scripts read via `sourceInfo.cardInstance` to gate
      // on cardType / _isAoeCheck / etc.
      const surpriseResult = await engine._checkSurpriseWindow(
        [{ type: 'hero', owner: targetOwner, heroIdx: targetHeroIdx, cardName: targetHero.name }],
        ctx.card,
        {},
      );
      if (surpriseResult?.effectNegated) {
        // Counter resolved — the Spell is consumed (not refunded).
        // `_spellNegatedByEffect` is the engine's canonical "Spell
        // was countered" signal and overrides `_spellCancelled` per
        // the API contract (see card_api.md "Game State Communication
        // Flags"), so the server's post-resolve path routes Curse to
        // the caster's discard pile.
        gs._spellNegatedByEffect = true;
        engine.log('curse_negated_by_surprise', {
          player: gs.players[pi]?.username,
          target: targetHero.name,
        });
        engine.sync();
        return;
      }

      // ── Anti Magic gate ──
      // Curse is a Lv 0 Spell — any Anti Magic Lv 1+ attached to
      // the chosen Hero covers it. Bail BEFORE the support-zone
      // push + `_spellPlacedOnBoard` so the server's standard
      // post-resolve path routes the card to the caster's discard.
      if (engine._isHeroSpellProtected(targetHero, CARD_NAME)) {
        engine.log('curse_blocked', { target: targetHero.name, reason: 'magic_immune' });
        engine._playAntiMagicBlockedAnim(targetHero);
        engine.sync();
        return;
      }

      // ── Mode A post-pick reclassification ──
      // In normal-Action mode, if the picked Hero does NOT qualify,
      // flip the engine's inherent classification back to "consumes
      // a main Action". server.js's post-onPlay logic reads this
      // flag and rebinds `isInherentAction = false`, so the
      // downstream auto-advance to Main Phase 2 fires normally.
      if (isNormalActionMode
          && !_heroQualifiesForCurse(engine, targetHero, targetOwner, targetHeroIdx)) {
        gs._spellForcesActionConsume = true;
      }

      // ── Place Curse in target's Support Zone ──
      if (!tps.supportZones[targetHeroIdx]) tps.supportZones[targetHeroIdx] = [[], [], []];
      if (!tps.supportZones[targetHeroIdx][targetSlot]) tps.supportZones[targetHeroIdx][targetSlot] = [];
      tps.supportZones[targetHeroIdx][targetSlot].push(CARD_NAME);

      // Re-track from caster's hand → target's support zone. The
      // `originalOwner` override matches the Berserk pattern: a
      // cleanse-driven destroy on this card routes the card back
      // to the caster's discard (not the host's).
      const oldInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === CARD_NAME && c.zone === 'hand'
      );
      if (oldInst) engine._untrackCard(oldInst.id);
      const inst = engine._trackCard(CARD_NAME, targetOwner, 'support', targetHeroIdx, targetSlot);
      inst.originalOwner = pi;

      // Tell the server not to discard — the card lives on the board.
      gs._spellPlacedOnBoard = true;

      // ── Apply the boolean cursed status + ATK snapshot ──
      // The engine's grant/revoke/temp-atk paths all key off
      // `hero.statuses.cursed`, so the status MUST land before we
      // zero out `hero.atk` — otherwise a re-entrant ATK mutation
      // during the apply step could touch the wrong slot.
      // Multiple-copy boolean rule: if the status already exists
      // (a prior Curse on this Hero), skip the snapshot + zero so
      // the second copy is the documented no-op.
      if (!targetHero.statuses?.cursed) {
        // Snapshot the live ATK so the cleanse path can restore it.
        // Subsequent grant/revoke/temp-atk while cursed will accumulate
        // into this same slot (see _isHeroAtkSuppressed in _engine.js).
        targetHero._cursedAtkSuppressed = targetHero.atk || 0;
        const dropAmount = targetHero.atk || 0;
        targetHero.atk = 0;
        if (dropAmount > 0) {
          engine._broadcastEvent('fighting_atk_change', {
            owner: targetOwner, heroIdx: targetHeroIdx, amount: -dropAmount,
          });
        }
        await engine.addHeroStatus(targetOwner, targetHeroIdx, STATUS_NAME, {
          appliedBy: pi,
          source: CARD_NAME,
          animationType: 'dark_swarm',
        });
      } else {
        engine.log('curse_extra_copy_noop', {
          player: gs.players[pi]?.username,
          target: targetHero.name,
        });
      }

      // ── Attach burst animation ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'dark_swarm', owner: targetOwner,
        heroIdx: targetHeroIdx, zoneSlot: -1,
      });
      await engine._delay(400);

      // Fire enter-zone hook so listeners observe the new support card.
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: targetHeroIdx,
        _skipReactionCheck: true,
      });

      engine.log('curse_attached', {
        player: gs.players[pi]?.username,
        target: targetHero.name,
        mode: isNormalActionMode ? 'normal_action' : 'inherent_additional',
      });
      engine.sync();
    },

    /**
     * Cleanse routing — Juice / Beer / Cure / anything that fires
     * onStatusRemoved with `_viaCleanse: true` destroys every Curse
     * Attachment bound to the Hero. Each goes to its `originalOwner`'s
     * discard pile per the override set in onPlay.
     *
     * The host's ATK restore is now handled by the engine's
     * `cleanseHeroStatuses` chokepoint directly (single source of
     * truth) — without that, this hook would only restore ATK when a
     * Curse card INSTANCE existed on the board (the hook iterates
     * cardInstances), so puzzle-authored Cursed Heroes with no Curse
     * card would stay pinned at 0 ATK after cleanse. Additionally, the
     * old per-instance restore would zero `host.atk` on the 2nd / 3rd
     * / … fire (after the first call already deleted the accumulator),
     * silently reverting the restore the first call did.
     *
     * Same idempotency + recursion guard as Berserk: the
     * `_curseCleanseInProgress` flag suppresses the
     * onCardLeaveZone "last copy gone" path during the destroy
     * cascade so we don't re-enter status removal mid-loop.
     */
    onStatusRemoved: async (ctx) => {
      if (ctx.status !== STATUS_NAME) return;
      if (!ctx._viaCleanse) return;

      const engine = ctx._engine;
      const ownerIdx = ctx.heroOwner;
      const heroIdx = ctx.heroIdx;
      if (typeof ownerIdx !== 'number' || typeof heroIdx !== 'number') return;

      const host = engine.gs.players[ownerIdx]?.heroes?.[heroIdx];

      const copies = engine.cardInstances.filter(c =>
        c.zone === 'support'
        && c.name === CARD_NAME
        && c.owner === ownerIdx
        && c.heroIdx === heroIdx
      );
      if (copies.length > 0) {
        const targets = [...copies];
        engine.gs._curseCleanseInProgress = true;
        try {
          for (const inst of targets) {
            await engine.actionDestroyCard(
              { name: CARD_NAME, owner: ctx.cardOwner ?? ownerIdx, heroIdx: ctx.cardHeroIdx ?? heroIdx },
              inst,
            );
          }
        } finally {
          delete engine.gs._curseCleanseInProgress;
        }
        engine.log('curse_cleansed', {
          target: host?.name,
          copies: targets.length,
        });
      }
      engine.sync();
    },

    /**
     * Last-copy safety — if a Curse attachment leaves its slot for
     * any non-cleanse reason (Spell removal, bounce, etc.) and no
     * other Curse copies remain on the same Hero, clear the
     * `cursed` status and restore ATK. Suppressed during the
     * cleanse cascade above (the status is already gone, the ATK
     * already restored).
     */
    onCardLeaveZone: async (ctx) => {
      const card = ctx.card;
      if (!card || card.name !== CARD_NAME) return;
      if (ctx.leavingCard?.id !== card.id) return;
      if (ctx.fromZone !== 'support') return;

      const engine = ctx._engine;
      const gs = engine.gs;
      if (gs._curseCleanseInProgress) return;

      const hostOwner = card.owner;
      const hostHeroIdx = ctx.fromHeroIdx ?? card.heroIdx;
      const hostPs = gs.players[hostOwner];
      const hero = hostPs?.heroes?.[hostHeroIdx];
      if (!hero?.name) return;

      // Other Curse copies still attached?
      if (_countCursesOnHero(engine, hostOwner, hostHeroIdx, card.id) > 0) return;

      // Restore ATK + clear status. Both must fire even if the
      // status was already missing (defensive sync); the
      // accumulator key only exists while cursed.
      if (hero.statuses?.cursed) {
        delete hero.statuses.cursed;
        const restored = hero._cursedAtkSuppressed || 0;
        hero.atk = restored;
        delete hero._cursedAtkSuppressed;
        if (restored > 0) {
          engine._broadcastEvent('fighting_atk_change', {
            owner: hostOwner, heroIdx: hostHeroIdx, amount: restored,
          });
        }
        await engine.runHooks('onStatusRemoved', {
          target: hero, status: STATUS_NAME,
          heroOwner: hostOwner, heroIdx: hostHeroIdx,
          _viaCleanse: false, _skipReactionCheck: true,
        });
        engine.sync();
      }
    },
  },
};
