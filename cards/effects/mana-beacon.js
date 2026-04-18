// ═══════════════════════════════════════════
//  CARD EFFECT: "Mana Beacon"
//  Spell (Support Magic Lv0, Normal)
//  Pollution archetype.
//
//  Discard any number of cards from your hand and
//  remove the same number of Pollution Tokens from
//  the board (either side). You may then immediately
//  use a Spell whose effect includes placing Pollution
//  Tokens as an additional Action.
//
//  Two-step interaction:
//    1. The player clicks hand cards to MARK them
//       for discard (the standard `handPick` prompt,
//       capped at the number of Pollution Tokens on
//       the board across both sides). On confirm,
//       every marked card is discarded together.
//    2. The player then clicks that many Pollution
//       Tokens on the board to remove. If they
//       discarded the max possible — one per token
//       on the board — every Token is removed
//       automatically without a click prompt.
//
//  Removed Tokens evaporate visually (pollution
//  evaporate animation fires per token via
//  `_pollution-shared`'s `_removeTokenInstance`,
//  which also untracks the instance so the Token
//  isn't sent to any pile — it's gone from the
//  game entirely).
//
//  Gated by spellPlayCondition: grayed out in
//  hand while there are zero Pollution Tokens on
//  the board.
// ═══════════════════════════════════════════

const {
  countAllPollutionTokens,
  getAllPollutionTokens,
} = require('./_pollution-shared');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Mana Beacon';

module.exports = {
  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Need a card in hand to discard (plus the spell itself, still in hand
    // while spellPlayCondition runs).
    if ((ps.hand || []).length < 2) return false;
    // At least one Pollution Token somewhere on the board — either side.
    // Permissive without engine (pre-engine-available paths), strict with.
    if (!engine) return true;
    return countAllPollutionTokens(engine) > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) return;

      const totalTokens = countAllPollutionTokens(engine);
      if (totalTokens === 0) {
        engine.log('mana_beacon_fizzle', { player: ps.username, reason: 'no_tokens' });
        gs._spellCancelled = true;
        return;
      }

      // Eligible hand cards = everything except the spell itself (still in
      // hand during resolution). Track by hand INDEX so duplicate names
      // don't collapse into one pick.
      const eligibleIndices = [];
      for (let i = 0; i < ps.hand.length; i++) {
        if (i === ps.hand.indexOf(ctx.cardName) && ps.hand[i] === ctx.cardName) {
          // Skip the first occurrence of Mana Beacon itself — the resolving copy.
          continue;
        }
        eligibleIndices.push(i);
      }
      if (eligibleIndices.length === 0) {
        engine.log('mana_beacon_fizzle', { player: ps.username, reason: 'no_hand_cards' });
        gs._spellCancelled = true;
        return;
      }

      const maxExchange = Math.min(eligibleIndices.length, totalTokens);

      // ── Step 1: handPick — click hand cards to MARK for discard ──
      // Uses the same in-hand click UI as Wheels / Horn / Shard of Chaos:
      // player marks 1…maxExchange cards, then presses the confirm button.
      const pickResult = await engine.promptGeneric(pi, {
        type: 'handPick',
        title: CARD_NAME,
        description: `Mark 1 to ${maxExchange} cards to discard. You'll then remove that many Pollution Tokens from the board.`,
        eligibleIndices,
        maxSelect: maxExchange,
        minSelect: 1,
        confirmLabel: '📡 Discard',
        cancellable: true,
      });
      if (!pickResult || pickResult.cancelled) {
        gs._spellCancelled = true;
        return;
      }

      const selected = pickResult.selectedCards || [];
      if (selected.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      // Commit discards — sort by hand index descending so the splices don't
      // shift later indices mid-loop.
      const sortedDescend = [...selected].sort((a, b) => b.handIndex - a.handIndex);
      for (const { handIndex, cardName } of sortedDescend) {
        if (handIndex < 0 || handIndex >= ps.hand.length) continue;
        const actualName = ps.hand[handIndex];
        if (actualName !== cardName) {
          // Name drifted between prompt and commit — be conservative and skip.
          continue;
        }
        ps.hand.splice(handIndex, 1);
        ps.discardPile.push(actualName);
        await engine.runHooks('onDiscard', {
          playerIdx: pi, cardName: actualName, discardedCardName: actualName,
          _fromHand: true, _skipReactionCheck: true,
        });
        engine.log('mana_beacon_discard', { player: ps.username, card: actualName });
      }
      const discardedCount = selected.length;
      engine.sync();
      await engine._delay(250);

      // ── Step 2: remove `discardedCount` Pollution Tokens ──
      // If the player discarded the maximum — one card per token on the
      // board — every Token is removed automatically, no click prompt.
      // Otherwise, the player clicks which tokens to remove.
      const allTokens = getAllPollutionTokens(engine);

      let removalList = [];
      if (discardedCount >= allTokens.length) {
        // All of them — auto-select the entire pool.
        removalList = allTokens.slice();
      } else {
        // Click-to-target N tokens. Build the target list with the standard
        // equip-style IDs so the board highlights / click-toggles each
        // token slot normally.
        const targets = allTokens.map(inst => ({
          id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
          cardName: inst.name, cardInstance: inst,
        }));

        const selectedIds = await engine.promptEffectTarget(pi, targets, {
          title: `${CARD_NAME} — Remove Pollution`,
          description: `Click ${discardedCount} Pollution Token${discardedCount === 1 ? '' : 's'} to evaporate.`,
          confirmLabel: '☁️ Evaporate!',
          confirmClass: 'btn-info',
          cancellable: false,
          maxTotal: discardedCount,
          minRequired: discardedCount,
        });
        removalList = (selectedIds || [])
          .map(id => targets.find(t => t.id === id)?.cardInstance)
          .filter(Boolean);
      }

      // Actually evaporate them (broadcasts pollution_evaporate per token,
      // untracks instance, clears board slot — no pile routing).
      for (const inst of removalList) {
        await _removeOneToken(engine, inst);
      }

      engine.sync();
      await engine._delay(300);

      // ── Step 3: offer an immediate Pollution-placing Spell ──
      // Unchanged from the previous implementation — register a one-shot
      // additional-action type keyed to `placesPollutionTokens: true`.
      const cardDB = engine._getCardDB();
      const typeId = 'mana_beacon_placer';
      engine.registerAdditionalActionType(typeId, {
        label: 'Play a Pollution Spell',
        allowedCategories: ['spell'],
        filter: (cardData) => {
          if (!cardData) return false;
          if (cardData.cardType !== 'Spell') return false;
          const script = loadCardEffect(cardData.name);
          return !!script?.placesPollutionTokens;
        },
      });
      engine.grantAdditionalAction(ctx.card, typeId);

      const eligibleHandSpells = (ps.hand || []).filter(n => {
        const cd = cardDB[n];
        if (!cd || cd.cardType !== 'Spell') return false;
        const script = loadCardEffect(n);
        return !!script?.placesPollutionTokens;
      });

      if (eligibleHandSpells.length === 0) {
        engine.expireAdditionalAction(ctx.card);
        engine.log('mana_beacon', {
          player: ps.username, discarded: discardedCount,
          removed: removalList.length, cast: false, reason: 'no_eligible_spell',
        });
        return;
      }

      const actionResult = await engine.performImmediateAction(pi, heroIdx, {
        title: CARD_NAME,
        description: 'You may immediately play a Pollution-placing Spell.',
        allowedCardTypes: ['Spell'],
        skipAbilities: true,
      });
      engine.expireAdditionalAction(ctx.card);

      engine.log('mana_beacon', {
        player: ps.username,
        discarded: discardedCount,
        removed: removalList.length,
        cast: !!actionResult?.played,
        castCard: actionResult?.cardName || null,
      });
      engine.sync();
    },
  },
};

/**
 * Internal: strip a single Pollution Token. Mirrors the loop body inside
 * `removePollutionTokens`, but takes a specific instance so Mana Beacon
 * can drive it from a cross-side target list (the shared remover is
 * per-player by design). Goes through `engine`'s broadcast so the
 * pollution_evaporate animation fires, then splices the board slot and
 * untracks the instance — Tokens are removed from the game entirely,
 * no pile routing.
 */
async function _removeOneToken(engine, inst) {
  if (!inst) return;
  const gs = engine.gs;
  const ps = gs.players[inst.owner];
  if (!ps) return;

  engine._broadcastEvent('play_zone_animation', {
    type: 'pollution_evaporate',
    owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
  });

  const slotArr = ps.supportZones?.[inst.heroIdx]?.[inst.zoneSlot];
  if (Array.isArray(slotArr)) {
    const nameIdx = slotArr.indexOf('Pollution Token');
    if (nameIdx >= 0) slotArr.splice(nameIdx, 1);
  }
  engine._untrackCard(inst.id);

  engine.log('pollution_removed', {
    player: ps.username,
    heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
    by: CARD_NAME,
  });

  // Still fire the generic onCardLeaveZone + Pollution-specific hook so
  // reactive cards (Pollution Spewer) see the removal. _skipReactionCheck
  // so we don't open nested reaction windows mid-effect.
  await engine.runHooks('onCardLeaveZone', {
    card: inst, fromZone: 'support',
    fromOwner: inst.owner, fromHeroIdx: inst.heroIdx, fromZoneSlot: inst.zoneSlot,
    _skipReactionCheck: true,
  });
  await engine.runHooks('onPollutionTokenRemoved', {
    removedInst: inst, ownerIdx: inst.owner,
    heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, by: CARD_NAME,
    _skipReactionCheck: true,
  });

  engine.sync();
  await engine._delay(200);
}
