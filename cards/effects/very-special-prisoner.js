// ═══════════════════════════════════════════
//  CARD EFFECT: "Very Special Prisoner"
//  Spell (Reaction, Magic Arts Lv 1)
//
//  Play immediately when you take control of an
//  opponent's target. Attach a Divinity Ability
//  from your hand or deck to a Hero you control.
//
//  Reaction-only: `canActivate: () => false` so
//  the card is never proactively playable. The
//  trigger is the engine's `onTakeControl` hook,
//  fired by every control-change primitive:
//    • `actionStealCreature` (Aligning Goals,
//      Treacherous Crystal, Deepsea Succubus —
//      temporary creature steal that auto-reverts
//      at next turn-start)
//    • `actionTransferCreature` (Dark Gear,
//      Diplomacy — permanent transfer onto own
//      side)
//    • `actionStealHero` (Charme Lv3 — temporary
//      hero steal)
//    • Controlled Attack's direct
//      `tgtHero.controlledBy = pi` write
//
//  All four paths now `runHooks('onTakeControl',
//  {...})` after committing the control change,
//  with a `kind:` discriminator. The reaction
//  condition below gates only on `controllerPi`
//  matching the playing side and the trigger
//  being the take-control event — every kind
//  qualifies per the card text.
// ═══════════════════════════════════════════

const DIVINITY = 'Divinity';
const CARD_NAME = 'Very Special Prisoner';

/**
 * Total copies of "Divinity" reachable from the player's hand or deck.
 * Returns 0 when no copies exist anywhere — used by
 * `reactionCondition` to grey the card out when the attach would
 * fizzle for lack of a Divinity to fetch.
 */
function _availableDivinitySources(ps) {
  if (!ps) return [];
  const out = [];
  const handCount = (ps.hand || []).filter(n => n === DIVINITY).length;
  const deckCount = (ps.mainDeck || []).filter(n => n === DIVINITY).length;
  if (handCount > 0) out.push({ source: 'hand', count: handCount });
  if (deckCount > 0) out.push({ source: 'deck', count: deckCount });
  return out;
}

/** Hero columns that can legally receive a fresh Divinity attachment. */
function _eligibleHeroIdxs(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    // `allowRestricted: true` so Divinity's normal restrictedAttachment
    // block doesn't filter us out — same pattern Sacrifice to Divinity
    // uses (sacrifice-to-divinity.js:113).
    if (engine.canAttachAbilityToHero(pi, DIVINITY, hi, { allowRestricted: true })) {
      out.push(hi);
    }
  }
  return out;
}

module.exports = {
  isReaction: true,
  // Reaction-only — never proactively playable.
  canActivate: () => false,

  /**
   * Triggered by the engine's `onTakeControl` hook. The chainCtx
   * forwards the originating hook name + ctx so we can pin the
   * activation strictly to the take-control event AND to the side
   * that gained control (the playing player must be the new
   * controller, never the original owner).
   *
   * Also requires at least one Divinity reachable AND a Hero that
   * can legally receive it — otherwise the reaction can't do
   * anything productive and is silently unavailable.
   */
  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx) return false;
    if (chainCtx.hookName !== 'onTakeControl') return false;
    const hctx = chainCtx.hookCtx || {};
    if (hctx.controllerPi !== pi) return false;
    const ps = gs.players[pi];
    if (!ps) return false;
    if (_availableDivinitySources(ps).length === 0) return false;
    if (_eligibleHeroIdxs(engine, pi).length === 0) return false;
    return true;
  },

  /**
   * Resolve: pick a source (hand or deck), pick a Hero, splice the
   * Divinity out of its source pile, push into the chosen ability
   * slot, fire the standard onPlay / onCardEnterZone hooks. Pattern
   * mirrors Sacrifice to Divinity's attach branch, minus the
   * discard-pile source (this card's text restricts to hand or deck).
   */
  resolve: async (engine, pi, _selectedIds, _validTargets, _chain) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return;

    const sources = _availableDivinitySources(ps);
    if (sources.length === 0) return; // Defensive — reactionCondition gated this.

    // Source pick — only prompt when both hand and deck have copies.
    let pickedSource;
    if (sources.length === 1) {
      pickedSource = sources[0].source;
    } else {
      const sourceRes = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: 'Pick a "Divinity" from where?',
        options: sources.map(s => ({
          id: s.source,
          label: `${s.source === 'hand' ? '✋' : '📚'}  From your ${s.source} (${s.count} available)`,
        })),
        cancellable: false,
      });
      pickedSource = sourceRes?.optionId || sources[0].source;
    }

    // Hero pick.
    const eligibleHeroIdxs = _eligibleHeroIdxs(engine, pi);
    if (eligibleHeroIdxs.length === 0) return;

    let targetHeroIdx = -1;
    let explicitZone = -1;
    if (eligibleHeroIdxs.length === 1) {
      targetHeroIdx = eligibleHeroIdxs[0];
    } else {
      const pickRes = await engine.promptGeneric(pi, {
        type: 'abilityAttachTarget',
        cardName: DIVINITY,
        eligibleHeroIdxs,
        // Reaction-cast attachment doesn't consume the per-turn
        // hand-attach budget (`abilityGivenThisTurn`). Same shortcut
        // Sacrifice to Divinity takes.
        skipAbilityGiven: true,
        title: CARD_NAME,
        description: 'Attach "Divinity" to one of your Heroes.',
        cancellable: false,
      });
      if (!pickRes || pickRes.cancelled) {
        // No graceful cancel in a reaction — the trigger has already
        // been consumed by the reaction window. Fall back to first
        // eligible hero so the card resolves productively.
        targetHeroIdx = eligibleHeroIdxs[0];
      } else {
        targetHeroIdx = typeof pickRes.heroIdx === 'number' ? pickRes.heroIdx : eligibleHeroIdxs[0];
        explicitZone = typeof pickRes.zoneSlot === 'number' ? pickRes.zoneSlot : -1;
      }
    }

    // Defensive re-check — state could shift through an inner prompt.
    if (!engine.canAttachAbilityToHero(pi, DIVINITY, targetHeroIdx, { allowRestricted: true })) {
      engine.log('very_special_prisoner_attach_failed', {
        player: ps.username, reason: 'no_legal_zone',
      });
      engine.sync();
      return;
    }

    // Splice the Divinity out of its source pile.
    const removeFromPile = (pile) => {
      const idx = pile.indexOf(DIVINITY);
      if (idx >= 0) { pile.splice(idx, 1); return true; }
      return false;
    };
    let pulled = false;
    if (pickedSource === 'hand') pulled = removeFromPile(ps.hand);
    if (pickedSource === 'deck') pulled = removeFromPile(ps.mainDeck);
    if (!pulled) {
      engine.log('very_special_prisoner_attach_failed', {
        player: ps.username, reason: 'pile_empty',
      });
      engine.sync();
      return;
    }

    // Resolve the destination zone slot. Honour the explicit drag slot
    // when given, else stack onto an existing Divinity slot (cap 3) or
    // fall back to the first free slot. Same tie-breaker the standard
    // ability-attach path uses.
    const abZones = ps.abilityZones[targetHeroIdx] || [[], [], []];
    ps.abilityZones[targetHeroIdx] = abZones;
    const isLegalZone = (z) => {
      const slot = abZones[z] || [];
      if (slot.length === 0) return true;
      if (slot[0] === DIVINITY && slot.length < 3) return true;
      return false;
    };
    let targetZone = -1;
    if (explicitZone >= 0 && explicitZone < 3 && isLegalZone(explicitZone)) {
      targetZone = explicitZone;
    } else {
      for (let z = 0; z < 3; z++) {
        const slot = abZones[z] || [];
        if (slot.length > 0 && slot[0] === DIVINITY && slot.length < 3) { targetZone = z; break; }
      }
      if (targetZone < 0) {
        for (let z = 0; z < 3; z++) {
          if ((abZones[z] || []).length === 0) { targetZone = z; break; }
        }
      }
    }
    if (targetZone < 0) {
      // Race: zones filled between the canAttach check and the splice.
      // Refund the Divinity back to its source pile so it isn't lost.
      if (pickedSource === 'hand') ps.hand.push(DIVINITY);
      if (pickedSource === 'deck') { ps.mainDeck.push(DIVINITY); engine.shuffleDeck(pi, 'main'); }
      engine.log('very_special_prisoner_attach_failed', {
        player: ps.username, reason: 'no_target_zone',
      });
      engine.sync();
      return;
    }

    if (!abZones[targetZone]) abZones[targetZone] = [];
    abZones[targetZone].push(DIVINITY);

    const inst = engine._trackCard(DIVINITY, pi, 'ability', targetHeroIdx, targetZone);

    // Deck-source etiquette — reveal to opponent and reshuffle. Mirrors
    // Sacrifice to Divinity's deck-source branch.
    if (pickedSource === 'deck') {
      engine._broadcastEvent('deck_search_add', { cardName: DIVINITY, playerIdx: pi });
      engine.shuffleDeck(pi, 'main');
      const oi = pi === 0 ? 1 : 0;
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        cardName: DIVINITY,
        searcherName: ps.username,
        title: CARD_NAME,
        cancellable: false,
      });
    }

    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst, cardName: DIVINITY,
      zone: 'ability', heroIdx: targetHeroIdx, _skipReactionCheck: true,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'ability', toHeroIdx: targetHeroIdx,
      _skipReactionCheck: true,
    });

    engine._broadcastEvent('ability_activated', {
      owner: pi, heroIdx: targetHeroIdx, zoneIdx: targetZone,
      abilityName: DIVINITY,
    });

    engine.log('very_special_prisoner_attach', {
      player: ps.username,
      from: pickedSource,
      to: ps.heroes[targetHeroIdx]?.name,
      zone: targetZone,
    });
    engine.sync();
  },
};
