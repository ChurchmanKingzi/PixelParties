// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Bird"
//  Creature (Summoning Magic Lv 1, 20 HP — Cute archetype)
//
//  ON-DEATH RECOVERY — when this Cute Bird is
//  defeated, the controller MAY discard 2 cards
//  from hand to immediately place a "Cute
//  Phoenix" from their deck into the SAME
//  Support Zone the Bird occupied.
//
//  Wiring notes:
//    • Self-detection via `creature.instId === card.id`
//      (Phoenix's pattern). Without this, every
//      Bird in play would prompt on every Bird
//      death.
//    • Cost is optional → confirm prompt first;
//      bail out if the player declines OR has
//      <2 cards in hand OR no Phoenix in deck.
//    • Cost paid via `actionPromptForceDiscard`
//      with `selfInflicted: true` (skips first-
//      turn shield, mirrors Phoenix's revive
//      cost).
//    • Phoenix is summoned with full hooks via
//      `summonCreatureWithHooks` so its own
//      `canSummon` (uniqueness gate) is respected
//      AND its on-play / counter setup runs. If
//      `canSummon` returns false (you already
//      control a Phoenix) the placement fizzles
//      and the Phoenix returns to deck — the
//      discard cost is still paid.
//    • The "§" glyph in the card-text spec is a
//      UI hint (deck/highlight marker) — the
//      actual card name is "Cute Phoenix".
// ═══════════════════════════════════════════

const CARD_NAME    = 'Cute Bird';
const TUTOR_TARGET = 'Cute Phoenix';
const DISCARD_COST = 2;

module.exports = {
  activeIn: ['support'],

  hooks: {
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.instId !== ctx.card.id) return;

      const engine  = ctx._engine;
      const pi      = ctx.cardOwner;
      const ps      = engine.gs.players[pi];
      if (!ps) return;

      // Cost check: ≥2 cards in hand to pay the discard.
      if ((ps.hand || []).length < DISCARD_COST) return;
      // Payoff check: at least one Cute Phoenix in deck.
      if (!(ps.mainDeck || []).includes(TUTOR_TARGET)) return;

      // Original slot — same Support Zone the Bird died in. Phoenix
      // tries this slot first; safePlaceInSupport falls back to any
      // other free zone on the same hero if the slot got reused
      // (rare but possible after on-death effects).
      const heroIdx  = death.heroIdx;
      const zoneSlot = death.zoneSlot;

      // The host hero must still exist & be alive — Phoenix can't
      // anchor to a corpse's column.
      const hostHero = ps.heroes?.[heroIdx];
      if (!hostHero?.name || hostHero.hp <= 0) return;

      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${CARD_NAME} was defeated! Discard ${DISCARD_COST} cards to place a "${TUTOR_TARGET}" from your deck into the same Support Zone?`,
        confirmLabel: '🔥 Tutor!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) return;

      // Pay the discard cost.
      await engine.actionPromptForceDiscard(pi, DISCARD_COST, {
        title: `${CARD_NAME} — Discard ${DISCARD_COST}`,
        source: CARD_NAME,
        selfInflicted: true,
      });

      // Re-verify Phoenix is still in deck (a discard hook MIGHT have
      // moved it — defensive). If gone, fizzle silently; cost is paid.
      const deckIdx = (ps.mainDeck || []).indexOf(TUTOR_TARGET);
      if (deckIdx < 0) {
        engine.log('cute_bird_fizzle', { player: ps.username, reason: 'no_phoenix_in_deck' });
        return;
      }

      // Pull Phoenix out, shuffle deck, broadcast deck-search reveal.
      ps.mainDeck.splice(deckIdx, 1);
      engine.shuffleDeck(pi, 'main');
      engine._broadcastEvent('deck_search_add', { cardName: TUTOR_TARGET, playerIdx: pi });

      // Summon with full hooks. summonCreatureWithHooks handles slot-
      // occupied fallback via summonCreature → safePlaceInSupport, runs
      // Phoenix's canSummon (uniqueness) gate, and fires onPlay /
      // onCardEnterZone (so Phoenix's counters & subscriptions activate).
      const summonRes = await engine.summonCreatureWithHooks(
        TUTOR_TARGET, pi, heroIdx, zoneSlot,
        { source: CARD_NAME }
      );

      if (!summonRes) {
        // canSummon refused (already control 1 Phoenix) or no free slot.
        // Return Phoenix to deck so the player doesn't lose the copy
        // outright; the discard cost is still paid.
        ps.mainDeck.push(TUTOR_TARGET);
        engine.shuffleDeck(pi, 'main');
        engine.log('cute_bird_fizzle', { player: ps.username, reason: 'canSummon_or_noSlot' });
        return;
      }

      // Reveal the searched card to the opponent (gallery animation).
      const oi = pi === 0 ? 1 : 0;
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        cardName: TUTOR_TARGET,
        searcherName: ps.username,
        title: CARD_NAME,
        cancellable: false,
      });

      engine.log('cute_bird_tutor', {
        player: ps.username,
        summoned: TUTOR_TARGET,
        heroIdx,
        zoneSlot: summonRes.actualSlot,
      });
      engine.sync();
    },
  },

  // CPU hint: dying Bird is a near-free Phoenix tutor (≈ Lv3 swap).
  cpuMeta: {
    onDeathBenefit: 35,
  },
};
