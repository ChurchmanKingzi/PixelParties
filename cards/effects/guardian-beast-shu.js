// COST-DISCARD-CHANNEL: n/a — Beschwoerungsbedingung, keine Abwurfkosten (v1041)
// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian Beast Shu" (Rat)
//  Creature (Summoning Magic Lv0, 60 HP).
//  Archetype: Guardian Beasts.
//
//  EFFECT (once/turn): delete a multiple of 4
//    cards from the discard piles → choose a
//    Creature on YOUR side of the board that
//    you still have copies of in your deck
//    and/or discard pile, then pull that many
//    ÷ 4 copies of that Creature from your deck
//    and/or discard pile into your hand.
//    (W16d, A07-09: Text „deck and/or discard
//    pile" – Ablage-Kopien zählen mit; Deck
//    zuerst, dann die eigene Ablage, wie bei
//    den anderen Tutoren.)
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
const { ablageLoeschKostenMoeglich } = require('./_guardian-beasts-shared');   // v1398
const CARD_NAME = 'Guardian Beast Shu';

/** Kopien des Namens in der eigenen Auswahlmenge (Deck + eigene Ablage); eine Such-Sperre nimmt ihren Stapel heraus. */
function kopienZaehlen(engine, pi, name) {
  const ps = engine.gs.players[pi];
  const deck = engine._isSearchBlocked(pi, {}, 'deck') ? 0 : (ps?.mainDeck || []).filter(n => n === name).length;
  const ablage = engine._isSearchBlocked(pi, {}, 'discard') ? 0 : (ps?.discardPile || []).filter(n => n === name).length;
  return { deck, ablage, summe: deck + ablage };
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: canSummonGuardianBeast,
  inherentAction: (gs, pi) => inherentActionForFirstSummon(gs, pi),

  canActivateCreatureEffect(ctx) {
    // v1398 (Als Ruling 25.9.): Löschkosten aus der Ablage unter Knight-[B]-Lockdown → nicht aktivierbar.
    if (!ablageLoeschKostenMoeglich(ctx)) return false;
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    // Z6 (A07-23): die Kopien kommen aus Deck/Ablage auf die Hand - sind beide Stapel gesperrt (Hand-/Such-Sperre), waeren nur die Kosten weg.
    if (engine._isSearchBlocked(pi, {}, 'deck') && engine._isSearchBlocked(pi, {}, 'discard')) return false;
    const total = (engine.gs.players[0]?.discardPile?.length || 0)
      + (engine.gs.players[1]?.discardPile?.length || 0);
    if (total < 4) return false;
    // Need at least one own on-board creature whose name still appears
    // in our deck — otherwise there's nothing to search up. Token
    // instances naturally fall out of this filter (their name typically
    // isn't deck-listed), which is the desired behaviour.
    return engine.cardInstances.some(c =>
      c.controller === pi && c.zone === 'support' && !c.faceDown
      && kopienZaehlen(engine, pi, c.name).summe > 0
      && engine.isChoosableAsCreature(c, engine.getEffectiveCardData(c)));   // A07-08: nur Kreaturen
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    if (engine._isSearchBlocked(pi, {}, 'deck') && engine._isSearchBlocked(pi, {}, 'discard')) return false;   // Z6 (A07-23)
    const total = (engine.gs.players[0]?.discardPile?.length || 0)
      + (engine.gs.players[1]?.discardPile?.length || 0);
    if (total < 4) return false;

    // Surface ALL own on-board Creatures so the player can see what
    // their options are, but mark Creatures with zero remaining deck
    // copies as `ineligible` so the picker dims them and rejects
    // clicks. Counting copies up-front so we know per-target how many
    // copies remain (also drives the per-target delete-cost cap below).
    const deckCounts = new Map();   // Kopien in Deck + eigener Ablage (A07-09)
    for (const c of engine.cardInstances) {
      if (c.controller === pi && c.zone === 'support' && !deckCounts.has(c.name)) deckCounts.set(c.name, kopienZaehlen(engine, pi, c.name).summe);
    }
    // „Creature": Ausrüstung/Anhängsel in der Support-Zone zählen nicht (A07-08).
    const ownCreatures = engine.cardInstances.filter(c =>
      c.controller === pi && c.zone === 'support' && !c.faceDown
      && engine.isChoosableAsCreature(c, engine.getEffectiveCardData(c)));
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
      description: 'Choose a Creature you control (must still have copies in your deck and/or discard pile). Copies will be pulled by name (1 per 4 cards deleted).',
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
      description: `Pick a multiple of 4 cards (up to ${maxDelete}) from the discard piles to delete. You'll pull that many ÷ 4 copies of "${targetName}" from your deck and/or discard pile. (${copiesInDeck} cop${copiesInDeck === 1 ? 'y' : 'ies'} left in deck/discard pile.)`,
      sourceName: CARD_NAME,
      cancellable: true,
    });
    if (!deleted || deleted.length === 0 || deleted.length % 4 !== 0) return false;
    // Die Kosten können Ablage-Kopien mitgelöscht haben: nach dem Löschen neu zählen.
    const nachLoeschen = kopienZaehlen(engine, pi, targetName);
    const copies = Math.min(Math.floor(deleted.length / 4), nachLoeschen.summe);

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
    let ausDeck = 0;
    for (let i = 0; i < copies; i++) {
      const deckNoch = nachLoeschen.deck - ausDeck > 0;
      if (!deckNoch) {
        // Deck-Kopien aufgebraucht: die Rest-Kopien kommen aus der eigenen Ablage (A07-09).
        if (!(await engine.addFromPileToHand(pi, 'discard', targetName, { source: CARD_NAME }))) break;
      } else if (pulled === 0) {
        const ok = await engine.actionAddCardFromDeckToHand(pi, targetName, {
          source: CARD_NAME,
          reveal: false, // explicit deckSearchReveal at the bottom
        });
        if (!ok) break;
        ausDeck++;
      } else {
        const _taken_deckIdx = await engine.takeFromPile(ps, 'deck', targetName, { source: CARD_NAME, toHand: true });   // v820: Stapel-Schicht
        if (!_taken_deckIdx) break;
        await engine.handZugang(ps, targetName, { von: 'deck', source: CARD_NAME });   // v1395: jetzt MIT Hand-Instanz (fehlte)
        ausDeck++;
      }
      pulled++;
    }
    if (ausDeck > 0) engine.shuffleDeck(pi, 'main');

    engine.log('guardian_beast_shu_search', {
      player: ps.username, target: targetName, copies, pulled, deleted: deleted.length,
    });
    engine.sync();

    // Show the searched name to the opponent (mirrors Angry Cheese,
    // Brilliant Idea, Argos, etc.). One reveal per activation regardless
    // of how many copies were pulled — they all share the same name.
    if (ausDeck > 0) {
      await engine._delay(500);
      const oi = engine.opponentOf(pi);
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        searchToHand: true, searchPile: 'deck',   // v1121
        cardName: targetName,
        searcherName: ps.username,
        title: CARD_NAME,
        cancellable: false,
      });
    }
    return true;
  },
};
