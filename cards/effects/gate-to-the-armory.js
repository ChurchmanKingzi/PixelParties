// ═══════════════════════════════════════════
//  CARD EFFECT: "Gate to the Armory"
//  Spell (Magic Arts Lv 1) — Normal.
//
//  Choose an Artifact from your deck or discard
//  pile and add it to your hand. If the Artifact
//  can be equipped to a Hero, you may immediately
//  equip it to the user of this Spell without
//  paying its cost. You may make this Spell count
//  as an additional Action, but if you do,
//  immediately end your turn afterwards.
//
//  ── Action economy ───────────────────────────
//  `inherentAction` is a function — returns FALSE
//  when an Action slot is available so the engine
//  consumes that slot (the player's main turn
//  Action in Action Phase pre-acted, or an external
//  additional-Action source like Coffee / Spider
//  Silk Bridge / etc.). Returns TRUE only when no
//  slot is available (Main Phase with no additional
//  source). In that case the engine treats the play
//  as the inherent grant; onPlay reads the engine's
//  `gs._spellWasInherent` stash (set by server.js's
//  `doPlaySpell` after the slot decision) and ends
//  the turn via `engine.advanceToPhase(pi, 5)` after
//  the resolve completes.
//
//  ── Direct-equip ─────────────────────────────
//  If the picked Artifact is Equipment AND the
//  caster has 1+ free Support Zones AND the
//  Equipment's `canEquipToHero` predicate (if any)
//  passes for the caster AND the card isn't
//  `neverPlayable` (Modnir / Swellpnir — Coolness-
//  Stack-only) AND it doesn't violate a oncePerGame
//  lock, prompt "Equip <name> directly to <user>?".
//  Choosing yes places the Equipment in the caster's
//  first free Support Zone (skipping the gold cost)
//  and fires the onPlay + onCardEnterZone hooks so
//  passive effects (ATK grants, on-equip triggers)
//  compose normally.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Gate to the Armory';

/** Eligible Artifact card names in `pi`'s deck and discard, deduped. */
function _getEligibleArtifacts(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const seen = new Set();
  const out = [];
  // Deck first — entries the picker shows as `source: 'deck'`.
  for (const cardName of (ps.mainDeck || [])) {
    if (seen.has(cardName)) continue;
    const cd = cardDB[cardName];
    if (!cd || !hasCardType(cd, 'Artifact')) continue;
    seen.add(cardName);
    out.push({ name: cardName, source: 'deck' });
  }
  // Discard
  for (const cardName of (ps.discardPile || [])) {
    if (seen.has(cardName)) continue;
    const cd = cardDB[cardName];
    if (!cd || !hasCardType(cd, 'Artifact')) continue;
    seen.add(cardName);
    out.push({ name: cardName, source: 'discard' });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** First free Support-Zone slot index on the caster's Hero, or -1. */
function _firstFreeSlot(ps, heroIdx) {
  const zones = ps.supportZones?.[heroIdx] || [];
  for (let si = 0; si < 3; si++) {
    if (((zones[si] || []).length === 0)) return si;
  }
  return -1;
}

module.exports = {
  /**
   * Inherent gate — returns FALSE when an Action slot is available
   * (so the engine consumes that slot and the turn keeps going).
   * Returns TRUE only when no slot is available (Main Phase, no
   * additional source) — the inherent grant kicks in and onPlay
   * forces an end-turn. Frozen / Stunned / Negated Heroes are gated
   * by the engine's universal validateActionPlay path before this
   * runs, so we don't re-check them here.
   */
  inherentAction: (gs, pi, heroIdx, engine) => {
    if (!engine) return true; // optimistic fallback
    const ps = gs.players[pi];
    if (!ps) return true;
    const isActionPhase = gs.currentPhase === 3;
    const heroActed = (ps.heroesActedThisTurn || []).includes(heroIdx);

    // Action Phase + caster hasn't acted yet → main slot available.
    if (isActionPhase && !heroActed) return false;

    // External additional-Action source matches this Spell → engine
    // consumes that source (no end-turn).
    if (engine.findAdditionalActionForCard(pi, CARD_NAME, heroIdx)) return false;

    // No slot available — fall back to the inherent grant. The
    // post-resolve clause in onPlay will end the turn.
    return true;
  },

  /**
   * Playable iff the player has at least one Artifact in deck OR
   * discard. The direct-equip clause is optional — the Spell still
   * resolves with just the tutor portion.
   */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    return _getEligibleArtifacts(engine, pi).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const heroIdx = ctx.cardHeroIdx;
      if (!ps) { gs._spellCancelled = true; return; }

      // Cache the engine's inherent-mode signal IMMEDIATELY. The
      // server's doPlaySpell stashes `gs._spellWasInherent` right
      // after deciding whether to consume a main / additional slot;
      // any sub-cast or follow-on play we trigger from here on out
      // could overwrite it (each cast computes its own), so snapshot
      // now and read the local at the end of resolve.
      const wasInherent = gs._spellWasInherent === true;

      // ── Pick an Artifact ──
      const eligible = _getEligibleArtifacts(engine, pi);
      if (eligible.length === 0) { gs._spellCancelled = true; return; }

      const picked = await ctx.promptCardGallery(eligible, {
        title: CARD_NAME,
        description: 'Choose an Artifact from your deck or discard pile to add to your hand.',
        confirmLabel: '🗝️ Take!',
        confirmClass: 'btn-success',
        cancellable: true,
      });
      if (!picked || !picked.cardName) { gs._spellCancelled = true; return; }
      const pickedName = picked.cardName;
      // Re-resolve the source entry since the picker echoes only the
      // card name back. Prefer deck if both piles contain a copy.
      const pickedEntry = eligible.find(e => e.name === pickedName);
      if (!pickedEntry) { gs._spellCancelled = true; return; }

      // Remove the chosen copy from its source pile.
      const sourcePile = pickedEntry.source === 'deck' ? ps.mainDeck : ps.discardPile;
      const idx = sourcePile.indexOf(pickedName);
      if (idx < 0) { gs._spellCancelled = true; return; }
      sourcePile.splice(idx, 1);

      // Reshuffle the deck after a deck-tutor (standard convention so
      // the opponent doesn't gain free knowledge of the deck order).
      if (pickedEntry.source === 'deck') {
        engine.shuffleDeck(pi);
      }

      // Add the tutored Artifact to the caster's hand.
      ps.hand.push(pickedName);
      // Track the new hand instance so subsequent hooks have an
      // instance to fire on (some Artifacts listen from hand).
      engine._trackCard(pickedName, pi, 'hand');

      engine._broadcastEvent('card_reveal', { cardName: pickedName, playerIdx: pi });
      engine.log('gate_to_armory_tutor', {
        player: ps.username, card: pickedName, source: pickedEntry.source,
      });
      engine.sync();
      await engine._delay(450);

      // ── Direct-equip clause ──
      const cardDB = engine._getCardDB();
      const pickedData = cardDB[pickedName];
      const isEquipment = !!(pickedData
        && hasCardType(pickedData, 'Artifact')
        && (pickedData.subtype || '').toLowerCase() === 'equipment');

      const userHero = (heroIdx >= 0) ? ps.heroes?.[heroIdx] : null;
      const canOfferEquip = (() => {
        if (!isEquipment) return false;
        if (!userHero?.name || userHero.hp <= 0) return false;
        // Frozen / charmed Heroes can't accept new gear (matches the
        // server's standard equip gate in `doPlayArtifact`).
        if (userHero.statuses?.frozen || userHero.statuses?.charmed) return false;
        // Free slot required to host the Equipment.
        if (_firstFreeSlot(ps, heroIdx) < 0) return false;

        const equipScript = loadCardEffect(pickedName);
        // Stack-only Equips (Modnir, Swellpnir) carry `neverPlayable`
        // — they refuse hand-play and the spec rule "the Artifact CAN
        // be equipped to a Hero" excludes them.
        if (equipScript?.neverPlayable) return false;
        // Per-card preconditions (Lunatic Cycle chain ordering,
        // Lifeforce Howitzer's HP threshold, …) gate via
        // `canEquipToHero(gs, pi, heroIdx, engine)`.
        if (typeof equipScript?.canEquipToHero === 'function') {
          try {
            if (!equipScript.canEquipToHero(gs, pi, heroIdx, engine)) return false;
          } catch { return false; }
        }
        // oncePerGame already-used lockout (Smug Coin, etc.).
        if (equipScript?.oncePerGame) {
          const opgKey = equipScript.oncePerGameKey || pickedName;
          if (ps._oncePerGameUsed?.has(opgKey)) return false;
        }
        return true;
      })();

      if (canOfferEquip) {
        const confirmed = await ctx.promptConfirmEffect({
          title: CARD_NAME,
          message: `Equip ${pickedName} directly to ${userHero.name}?`,
          confirmLabel: '⚔️ Equip!',
          cancelLabel: 'No',
        });
        if (confirmed) {
          const freeSlot = _firstFreeSlot(ps, heroIdx);
          if (freeSlot >= 0) {
            // Pull the just-tutored copy out of hand (untrack the hand
            // instance so it doesn't double-track once we place it in
            // support).
            const handIdx = ps.hand.lastIndexOf(pickedName);
            if (handIdx >= 0) ps.hand.splice(handIdx, 1);
            const handInst = engine.cardInstances.find(c =>
              c.owner === pi && c.zone === 'hand' && c.name === pickedName,
            );
            if (handInst) engine._untrackCard(handInst.id);

            // Place in the caster's first free Support Zone. Gold
            // cost is skipped per card text ("without paying its
            // cost"). `safePlaceInSupport` returns the new
            // CardInstance; the caller (us) fires onPlay +
            // onCardEnterZone as per the API contract.
            const placed = engine.safePlaceInSupport(pickedName, pi, heroIdx, freeSlot);
            if (placed?.inst) {
              engine._broadcastEvent('summon_effect', {
                owner: pi, heroIdx, zoneSlot: placed.actualSlot, cardName: pickedName,
              });

              await engine.runHooks('onPlay', {
                _onlyCard: placed.inst, playedCard: placed.inst,
                cardName: pickedName, zone: 'support', heroIdx,
                zoneSlot: placed.actualSlot,
                _skipReactionCheck: true,
              });
              await engine.runHooks('onCardEnterZone', {
                enteringCard: placed.inst, toZone: 'support',
                toHeroIdx: heroIdx, _skipReactionCheck: true,
              });

              const equipScript = loadCardEffect(pickedName);
              if (equipScript?.oncePerGame) {
                const opgKey = equipScript.oncePerGameKey || pickedName;
                if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
                ps._oncePerGameUsed.add(opgKey);
              }

              engine.log('gate_to_armory_equip', {
                player: ps.username, equip: pickedName, hero: userHero.name,
              });
              engine.sync();
              await engine._delay(350);
            }
          }
        }
      }

      // ── End-turn clause ──
      // Only when this play actually used the inherent grant (no main
      // slot, no additional source consumed). The server's
      // doPlaySpell stamps `gs._spellWasInherent` to exactly that.
      //
      // The advance is DEFERRED via `queuePostChainAction` because
      // `engine.advanceToPhase` early-returns false while
      // `gs._spellResolutionDepth > 0` (set by `doPlaySpell` BEFORE
      // onPlay and released only after this resolve returns). Calling
      // it inline from inside onPlay would no-op silently — the turn
      // would never end. The engine drains the queue from the
      // `doPlaySpell` socket handler's `.finally`
      // (`room.engine._runPostChainActions()`), at which point the
      // depth counter is back to 0 and the phase transition can fire.
      // Same pattern Lunar Eclipse uses for its post-chain
      // replacement-Action prompt.
      if (wasInherent) {
        engine.log('gate_to_armory_end_turn', { player: ps.username });
        engine.queuePostChainAction(async () => {
          if (gs.result) return; // game already over
          const cur = gs.currentPhase;
          if (cur >= 2 && cur <= 4) {
            await engine.advanceToPhase(pi, 5);
          }
        });
      }

      engine.sync();
    },
  },
};
