// ═══════════════════════════════════════════
//  CARD EFFECT: "Berserk"
//  Spell (Decay Magic Lv2, Attachment)
//
//  Attach to ANY Hero (either side). While
//  attached, that Hero:
//    • Cannot cast Spells (engine `validateActionPlay`
//      gates the Spell branch on the `berserked`
//      status).
//    • Cannot summon Creatures (same gate, Creature
//      branch).
//    • Is granted a once-per-turn free additional
//      Attack — the engine's `getValidationContext`
//      sees the status and treats the bearer's
//      Attacks as inherent until the charge is
//      spent. Charge slot lives on
//      `hero._berserkChargeUsedTurn` (stamped to
//      `gs.turn` post-resolution, reset implicitly
//      by the per-turn flag wipe).
//    • Cannot perform more than 2 Attacks per turn
//      (hard cap on `hero._attacksThisTurn` in
//      validateActionPlay).
//
//  Boolean status — multiple Berserk Attachments
//  on the same Hero all bind the same single
//  `berserked` status (no extra charge from a
//  second copy). The card itself still attaches
//  to a Support slot per the Attachment rules.
//
//  Cleansable. When `berserked` is removed via
//  Juice / Beer / Cure (anything with the
//  `_viaCleanse` flag), every Berserk Attachment
//  on the Hero is destroyed and routed to its
//  ORIGINAL owner's discard pile (the player who
//  cast it, not the host) — `inst.originalOwner`
//  is overridden to the caster at attach time so
//  `actionDestroyCard` → `_addCardToState` routes
//  to the right pile automatically.
//
//  Animation: per-card attach glow + the
//  persistent "berserked" hero overlay (dark
//  magic + red smoke) lives in app-board.jsx,
//  keyed off `hero.statuses.berserked`.
// ═══════════════════════════════════════════

const CARD_NAME = 'Berserk';
const STATUS_NAME = 'berserked';

/** Count live Berserk Attachments on a (owner, heroIdx) slot. */
function _countBerserksOnHero(engine, ownerIdx, heroIdx, excludeInstId = null) {
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

  // Need at least one Hero (any side) with a free Support slot.
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
      // Self-cast gate: only fire when this card's own onPlay invocation
      // is for THIS instance in hand.
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;

      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const casterHeroIdx = ctx.cardHeroIdx;

      // ── Build target list: any living Hero on either side with a
      //    free Support slot. Both `hero` and per-zone `equip` entries
      //    are added so the prompt accepts either click; matches the
      //    Anti Magic pattern so the UI feels identical between
      //    attachment Spells.
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
              targets.push({
                id: `equip-${p}-${hi}-${si}`,
                type: 'equip',
                owner: p, heroIdx: hi, slotIdx: si,
                cardName: '',
              });
            }
          }
          if (hasFreeZone) {
            targets.push({
              id: `hero-${p}-${hi}`,
              type: 'hero',
              owner: p, heroIdx: hi,
              cardName: hero.name,
            });
          }
        }
      }
      if (targets.length === 0) {
        gs._spellCancelled = true;
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
        const picked = await engine.promptEffectTarget(pi, targets, {
          title: CARD_NAME,
          description: 'Attach Berserk to any Hero. That Hero can only Attack (max 2/turn) but gets one free additional Attack per turn.',
          confirmLabel: '😡 Attach!',
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

      // ── Anti Magic gate ──
      // If the target Hero is Anti-Magic-immune at Berserk's level
      // (Lv 2 Spell → magic_immune.level >= 2 covers it), the card
      // must NOT attach. Per the user spec for Anti-Magic-blocked
      // Attachments: route straight to the original owner's discard
      // pile and leave the Support Zone slot free. Achieved by
      // bailing BEFORE the support-zone push + the
      // `gs._spellPlacedOnBoard = true` flag — server.js's
      // post-resolve path then runs the standard discard routing
      // (hand splice → originalOwner's discardPile push) for free.
      if (engine._isHeroSpellProtected(targetHero, CARD_NAME)) {
        engine.log('berserk_blocked', { target: targetHero.name, reason: 'magic_immune' });
        engine._playAntiMagicBlockedAnim(targetHero);
        engine.sync();
        return;
      }

      // ── Place Berserk in target's Support Zone ──
      if (!tps.supportZones[targetHeroIdx]) tps.supportZones[targetHeroIdx] = [[], [], []];
      if (!tps.supportZones[targetHeroIdx][targetSlot]) tps.supportZones[targetHeroIdx][targetSlot] = [];
      tps.supportZones[targetHeroIdx][targetSlot].push(CARD_NAME);

      // Re-track the live inst in the target's support zone; untrack
      // the hand copy.
      const oldInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === CARD_NAME && c.zone === 'hand'
      );
      if (oldInst) engine._untrackCard(oldInst.id);
      const inst = engine._trackCard(CARD_NAME, targetOwner, 'support', targetHeroIdx, targetSlot);
      // Discard routing override — the user spec says "all copies of
      // Berserk on it automatically go to their ORIGINAL OWNER's
      // discard pile". `_addCardToState` for ZONES.DISCARD reads
      // `inst.originalOwner`, which `_trackCard` defaults to `owner`
      // (the host of the support zone — wrong here). Re-bind it to
      // the caster (`pi`) so when the cleanse path destroys this
      // copy, it routes to the caster's pile, not the host's.
      inst.originalOwner = pi;

      // Tell the server not to discard — the card lives on the board.
      gs._spellPlacedOnBoard = true;

      // ── Apply the boolean berserked status ──
      // If the target already has `berserked` (a prior Berserk Attachment),
      // this second copy still occupies a Support slot but contributes
      // nothing extra: same status, same single per-turn charge. Per
      // the card text: "multiple copies on the same Hero do nothing".
      if (!targetHero.statuses?.berserked) {
        await engine.addHeroStatus(targetOwner, targetHeroIdx, STATUS_NAME, {
          appliedBy: pi,
          source: CARD_NAME,
          animationType: 'dark_swarm',
        });
      } else {
        engine.log('berserk_extra_copy_noop', {
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

      engine.log('berserk_attached', {
        player: gs.players[pi]?.username,
        target: targetHero.name,
      });
      engine.sync();
    },

    /**
     * Cleanse routing. When `berserked` is removed via Juice / Beer /
     * Cure (anything that fires onStatusRemoved with `_viaCleanse:
     * true`), destroy ALL Berserk Attachments currently bound to that
     * Hero. Each goes to its `originalOwner`'s discard pile per the
     * override we set in onPlay.
     *
     * Multiple Berserk copies all listen to the same status removal —
     * the first one fires, destroys every copy (including itself),
     * and the subsequent fires find nothing to do (idempotent).
     *
     * The `_skipBerserkStatusGuard` flag suppresses the
     * onCardLeaveZone hook's own "last copy gone → remove status"
     * path, which would otherwise recursively re-enter status removal
     * during the destroy loop.
     */
    onStatusRemoved: async (ctx) => {
      if (ctx.status !== STATUS_NAME) return;
      // Only react to cleanse-driven removal — engine-driven internal
      // removes (e.g. our own onCardLeaveZone safety clear when the
      // last copy departs for an unrelated reason) carry no
      // `_viaCleanse` flag and shouldn't trigger the destroy cascade.
      if (!ctx._viaCleanse) return;

      const engine = ctx._engine;
      const ownerIdx = ctx.heroOwner;
      const heroIdx = ctx.heroIdx;
      if (typeof ownerIdx !== 'number' || typeof heroIdx !== 'number') return;

      const copies = engine.cardInstances.filter(c =>
        c.zone === 'support'
        && c.name === CARD_NAME
        && c.owner === ownerIdx
        && c.heroIdx === heroIdx
      );
      if (copies.length === 0) return;

      // Snapshot a list of insts — destroy mutates cardInstances.
      const targets = [...copies];
      engine.gs._berserkCleanseInProgress = true;
      try {
        for (const inst of targets) {
          await engine.actionDestroyCard(
            { name: CARD_NAME, owner: ctx.cardOwner ?? ownerIdx, heroIdx: ctx.cardHeroIdx ?? heroIdx },
            inst,
            // Cleanse-driven destroy doesn't need the cosmic-malfunction
            // / gate-shield interaction — it's the natural cleanup
            // path. `skipPileTransfer` left default; multiple
            // simultaneous flights would stagger via the standard
            // diff-animator if we didn't, but with the canonical
            // per-destroy `play_pile_transfer` baseline already in
            // place the flights read fine.
          );
        }
      } finally {
        delete engine.gs._berserkCleanseInProgress;
      }

      engine.log('berserk_cleansed', {
        target: engine.gs.players[ownerIdx]?.heroes?.[heroIdx]?.name,
        copies: targets.length,
      });
      engine.sync();
    },

    /**
     * Last-copy safety. If a Berserk Attachment leaves the support
     * zone for ANY non-cleanse reason (destroyed by a Spell removal,
     * bounced, etc.) and no other Berserk copies remain on the same
     * Hero, the bearer should no longer carry the `berserked` status.
     *
     * Suppressed during the cleanse-driven destroy cascade above —
     * the status is already gone, and re-entering the removal path
     * would just no-op anyway.
     */
    onCardLeaveZone: async (ctx) => {
      const card = ctx.card;
      if (!card || card.name !== CARD_NAME) return;
      if (ctx.leavingCard?.id !== card.id) return;
      if (ctx.fromZone !== 'support') return;

      const engine = ctx._engine;
      const gs = engine.gs;
      if (gs._berserkCleanseInProgress) return;

      const hostOwner = card.owner;
      const hostHeroIdx = ctx.fromHeroIdx ?? card.heroIdx;
      const hostPs = gs.players[hostOwner];
      const hero = hostPs?.heroes?.[hostHeroIdx];
      if (!hero?.name) return;

      // Other Berserk copies still attached?
      if (_countBerserksOnHero(engine, hostOwner, hostHeroIdx, card.id) > 0) return;

      // Clear the status if still present. Pass through the standard
      // hero-status removal path so onStatusRemoved listeners (other
      // cards in the future) observe the change. `_viaCleanse` is
      // explicitly false — this is a self-clean, not a cleanse.
      if (hero.statuses?.berserked) {
        delete hero.statuses.berserked;
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
