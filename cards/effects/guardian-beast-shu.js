// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian Beast Shu" (Rat)
//  Creature (Summoning Magic Lv0, 60 HP).
//  Archetype: Guardian Beasts.
//
//  EFFECT (once/turn): delete a multiple of 4
//    cards from the discard piles → choose a
//    Creature on YOUR side of the board that
//    you still have copies of in your deck,
//    then pull that many ÷ 4 copies of that
//    Creature from your deck into your hand.
//
//  Deletes 4  → 1 copy
//  Deletes 8  → 2 copies
//  Deletes 12 → 3 copies, etc.
//
//  Constraints:
//   • Only on-board own Creatures whose name
//     still appears at least once in the
//     player's deck are eligible targets.
//   • The delete-cost picker caps the multiples-
//     of-4 list at copiesInDeck × 4 — picking
//     more would just waste cards with nothing
//     to pull.
//   • The first pulled copy is streamed to the
//     opponent via the standard `deck_search_add`
//     broadcast + `deckSearchReveal` prompt, so
//     the opponent sees the searched name once
//     (subsequent identical copies don't re-prompt).
// ═══════════════════════════════════════════

const {
  canSummonGuardianBeast,
  inherentActionForFirstSummon,
  promptAndDeleteFromBothDiscards,
  multiplesOfK,
} = require('./_guardian-beasts-shared');
const CARD_NAME = 'Guardian Beast Shu';

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: canSummonGuardianBeast,
  inherentAction: (gs, pi) => inherentActionForFirstSummon(gs, pi),

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const total = (engine.gs.players[0]?.discardPile?.length || 0)
      + (engine.gs.players[1]?.discardPile?.length || 0);
    if (total < 4) return false;
    // Need at least one own on-board creature whose name still appears
    // in our deck — otherwise there's nothing to search up. Token
    // instances naturally fall out of this filter (their name typically
    // isn't deck-listed), which is the desired behaviour.
    const deck = engine.gs.players[pi]?.mainDeck || [];
    if (deck.length === 0) return false;
    const deckSet = new Set(deck);
    return engine.cardInstances.some(c =>
      c.controller === pi && c.zone === 'support' && !c.faceDown
      && deckSet.has(c.name));
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    const total = (engine.gs.players[0]?.discardPile?.length || 0)
      + (engine.gs.players[1]?.discardPile?.length || 0);
    if (total < 4) return false;

    // Surface ALL own on-board Creatures so the player can see what
    // their options are, but mark Creatures with zero remaining deck
    // copies as `ineligible` so the picker dims them and rejects
    // clicks. Counting copies up-front so we know per-target how many
    // copies remain (also drives the per-target delete-cost cap below).
    const deckCounts = new Map();
    for (const n of (ps.mainDeck || [])) deckCounts.set(n, (deckCounts.get(n) || 0) + 1);
    const ownCreatures = engine.cardInstances.filter(c =>
      c.controller === pi && c.zone === 'support' && !c.faceDown);
    if (ownCreatures.length === 0) return false;
    // Need at least one Creature WITH deck copies — otherwise everything
    // would be grayed out and the prompt has no valid pick.
    if (!ownCreatures.some(c => (deckCounts.get(c.name) || 0) > 0)) return false;
    const targets = ownCreatures.map(c => ({
      id: `equip-${pi}-${c.heroIdx}-${c.zoneSlot}`, type: 'equip',
      owner: pi, heroIdx: c.heroIdx, slotIdx: c.zoneSlot,
      cardName: c.name, cardInstance: c,
      ineligible: (deckCounts.get(c.name) || 0) <= 0,
    }));
    const pickedIds = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: 'Choose a Creature you control (must still have copies in your deck). Copies will be pulled by name (1 per 4 cards deleted).',
      confirmLabel: '🐀 Search',
      cancellable: true,
      maxTotal: 1, minSelect: 1,
      exclusiveTypes: false,
    });
    if (!pickedIds || pickedIds.length === 0) return false;
    const pickedTarget = targets.find(t => t.id === pickedIds[0]);
    if (!pickedTarget) return false;
    const targetName = pickedTarget.cardName;
    const copiesInDeck = deckCounts.get(targetName) || 0;
    if (copiesInDeck <= 0) return false;

    // Cap the delete-cost picker so the player can't waste cards on
    // copies that don't exist. Max useful delete = copiesInDeck × 4.
    const maxDelete = Math.min(total, copiesInDeck * 4);
    const validCounts = multiplesOfK(4, maxDelete);
    if (validCounts.length === 0) return false;
    const deleted = await promptAndDeleteFromBothDiscards(ctx, {
      validCounts,
      title: CARD_NAME,
      description: `Pick a multiple of 4 cards (up to ${maxDelete}) from the discard piles to delete. You'll pull that many ÷ 4 copies of "${targetName}" from your deck. (${copiesInDeck} cop${copiesInDeck === 1 ? 'y' : 'ies'} left in deck.)`,
      sourceName: CARD_NAME,
      cancellable: true,
    });
    if (!deleted || deleted.length === 0 || deleted.length % 4 !== 0) return false;
    const copies = Math.min(Math.floor(deleted.length / 4), copiesInDeck);

    // Pull copies from deck only. Stops early if the deck runs out
    // (shouldn't happen given the cap, but defensive). The FIRST pull
    // routes through the canonical helper so it streams the deck-
    // search animation, opens the opp reveal, AND fires
    // ON_CARD_ADDED_TO_HAND (Cosmic Depths Analyzer / Gatherer counter
    // listener). Subsequent pulls of the SAME name happen silently —
    // re-broadcasting would produce duplicate reveals, and the per-
    // effect counter rule means Analyzer should gain only 1 counter
    // for this single Shu activation regardless of copy count.
    let pulled = 0;
    for (let i = 0; i < copies; i++) {
      if (i === 0) {
        const ok = await engine.actionAddCardFromDeckToHand(pi, targetName, {
          source: CARD_NAME,
          reveal: false, // explicit deckSearchReveal at the bottom
        });
        if (!ok) break;
      } else {
        const deckIdx = ps.mainDeck.indexOf(targetName);
        if (deckIdx < 0) break;
        ps.mainDeck.splice(deckIdx, 1);
        ps.hand.push(targetName);
      }
      pulled++;
    }
    if (pulled > 0) engine.shuffleDeck(pi, 'main');

    engine.log('guardian_beast_shu_search', {
      player: ps.username, target: targetName, copies, pulled, deleted: deleted.length,
    });
    engine.sync();

    // Show the searched name to the opponent (mirrors Angry Cheese,
    // Brilliant Idea, Argos, etc.). One reveal per activation regardless
    // of how many copies were pulled — they all share the same name.
    if (pulled > 0) {
      await engine._delay(500);
      const oi = pi === 0 ? 1 : 0;
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        cardName: targetName,
        searcherName: ps.username,
        title: CARD_NAME,
        cancellable: false,
      });
    }
    return true;
  },
};
