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
const PHOENIX_REBIRTH_MS = 1150;      // = PP_FX71_REBIRTH_MS (public/app-fx-71.jsx), wie cute-phoenix.js
const PHOENIX_REBIRTH_LEBEN = 2900;   // = PP_FX71_REBIRTH_LEBEN

module.exports = {
  activeIn: ['support'],

  // ── CPU: Confirm-Prompts pauschal bejahen (Barker-Bugklasse) ──────
  // onCreatureDeath-Confirm — bei Gegner-Kill plan-los; der Hook prüft Kosten (2 Handkarten) und Payoff (Phoenix im Deck) bereits VOR dem Prompt, Confirm = "sofern möglich, feuern".
  // Ohne Intercept declined der Brain-Default cancellable Confirms in
  // plan-losen Kontexten und der Effekt verpufft still. Der generic-
  // Dispatch lädt dieses Skript nur für Prompts mit dem eigenen
  // Kartentitel — Pauschal-Confirm ist damit korrekt gescopet.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.instId !== ctx.card.id) return;

      const engine  = ctx._engine;
      // Styx 28.9.: seitenfremd beschworen (liegt auf B, gehoert A) — „du"
      // ist der Kontrolleur zum Todeszeitpunkt, die Zone liegt auf der
      // Brettseite (`feld`). Der Phoenix landet dort, mit `controller`.
      const pi      = death.controller ?? ctx.cardOwner;
      const feld    = engine.physicalSide(ctx.card);
      const ps      = engine.gs.players[pi];
      if (!ps) return;

      // Cost check: ≥2 cards in hand to pay the discard.
      if ((ps.hand || []).length < DISCARD_COST) return;
      // Payoff check: at least one Cute Phoenix in deck.
      if (!(ps.mainDeck || []).includes(TUTOR_TARGET)) return;
      // "You can only control 1 Cute Phoenix": die Beschwoerung wuerde verweigert -
      // gar nicht erst anbieten, damit keine Abwurfkosten fuer nichts anfallen (A04-cute-10).
      if (engine.nurEinerSchonKontrolliert(pi, TUTOR_TARGET)) return;

      // Original slot — same Support Zone the Bird died in. Phoenix
      // tries this slot first; safePlaceInSupport falls back to any
      // other free zone on the same hero if the slot got reused
      // (rare but possible after on-death effects).
      const heroIdx  = death.heroIdx;
      const zoneSlot = death.zoneSlot;

      // The host hero must still exist & be alive — Phoenix can't
      // anchor to a corpse's column.
      const hostHero = engine.gs.players[feld]?.heroes?.[heroIdx];
      if (!hostHero?.name || hostHero.hp <= 0) return;
      // v1360: „into the same Support Zone" — schon belegt → nichts anbieten.
      if (engine.supportSlotBelegt(feld, heroIdx, zoneSlot)) return;

      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${CARD_NAME} was defeated! Discard ${DISCARD_COST} cards to place a "${TUTOR_TARGET}" from your deck into the same Support Zone?`,
        confirmLabel: '🔥 Summon!',
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true, // True "you may" — opt-in tutor.
      });
      if (!confirmed) return;

      // Pay the discard cost.
      await engine.actionPromptForceDiscard(pi, DISCARD_COST, {
      costFor: CARD_NAME,          // ★ v1041: Kosten-Abwurf-Lernkanal
        title: `${CARD_NAME} — Discard ${DISCARD_COST}`,
        source: CARD_NAME,
        selfInflicted: true,
      });

      // v1360: der Platz kann waehrend der Kosten belegt worden sein.
      if (engine.supportSlotBelegt(feld, heroIdx, zoneSlot)) {
        engine.log('cute_bird_fizzle', { player: ps.username, reason: 'zone_taken' });
        await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'zone_taken' });   // v1360
        return;
      }
      // Auch Einzigkeit und Gastgeber koennen sich waehrend der Abwurf-Kosten geaendert haben (Abwurf-Trigger): dann gar nicht erst die Rebirth-Animation zeigen.
      const hostJetzt = engine.gs.players[feld]?.heroes?.[heroIdx];
      if (engine.nurEinerSchonKontrolliert(pi, TUTOR_TARGET) || !hostJetzt?.name || hostJetzt.hp <= 0) {
        engine.log('cute_bird_fizzle', { player: ps.username, reason: 'place_refused' });
        await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'place_refused' });
        return;
      }
      // Re-verify Phoenix is still in deck (a discard hook MIGHT have
      // moved it — defensive). If gone, fizzle; cost is paid.
      const deckIdx = (ps.mainDeck || []).indexOf(TUTOR_TARGET);
      if (deckIdx < 0) {
        engine.log('cute_bird_fizzle', { player: ps.username, reason: 'no_phoenix_in_deck' });
        await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'no_target' });   // v1360
        return;
      }

      // Pull Phoenix out, shuffle deck, broadcast deck-search reveal.
      if (!(await engine.deckEntnahme(ps,  deckIdx, { source: CARD_NAME, shuffle: true }))) {   // v820: Stapel-Schicht
        engine.log('cute_bird_fizzle', { player: ps.username, reason: 'deck_locked' });
        await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'deck_locked' });   // v1360
        return;
      }
      engine._broadcastEvent('deck_search_add', { cardName: TUTOR_TARGET, playerIdx: pi });

      // Optik (app-fx-71.jsx): Der Vogel wird zum Phönix — dieselbe Rebirth-Animation wie bei der Wiederbelebung (Flammensammeln, Feuer-Ei, Explosion). Die Engine wartet bis
      // zur Explosion (+ Mount-Vorlauf), dann erscheint die Karte unter dem Creme-Blitz. Konstanten = cute-phoenix.js / PP_FX71_REBIRTH_*.
      engine._broadcastEvent('play_zone_animation', {
        type: 'phoenix_rebirth', duration: PHOENIX_REBIRTH_LEBEN,
        owner: feld, heroIdx, zoneSlot,
      });
      await engine._delay(PHOENIX_REBIRTH_MS);

      // Die Wartezeit (1,15 s) liegt zwischen den Pruefungen und der Beschwoerung: Platz, Einzigkeit und Gastgeber nochmal pruefen. Praktisch kann hier nichts dazwischenkommen
      // (die Engine loest die Todes-Trigger nacheinander auf, niemand zieht dazwischen) — Phoenix geht sonst zurueck ins Deck, die Kosten bleiben bezahlt.
      const hostNach = engine.gs.players[feld]?.heroes?.[heroIdx];
      if (engine.supportSlotBelegt(feld, heroIdx, zoneSlot) || engine.nurEinerSchonKontrolliert(pi, TUTOR_TARGET) || !hostNach?.name || hostNach.hp <= 0) {
        engine.returnToPile(ps, 'deck', TUTOR_TARGET);
        engine.shuffleDeck(pi, 'main');
        engine.log('cute_bird_fizzle', { player: ps.username, reason: 'zone_taken_after_animation' });
        await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'zone_taken' });
        return;
      }

      // Summon with full hooks. summonCreatureWithHooks handles slot-
      // occupied fallback via summonCreature → safePlaceInSupport, runs
      // Phoenix's canSummon (uniqueness) gate, and fires onPlay /
      // onCardEnterZone (so Phoenix's counters & subscriptions activate).
      const summonRes = await engine.summonCreatureWithHooks(
        TUTOR_TARGET, feld, heroIdx, zoneSlot,
        {
          source: CARD_NAME,
          isPlacement: true,
          hookExtras: { _summonedBy: CARD_NAME, ...engine.deckHookExtras() },
          ...(feld !== pi ? { controller: pi } : {}),
        }
      );

      if (!summonRes) {
        // canSummon refused (already control 1 Phoenix) or no free slot.
        // Return Phoenix to deck so the player doesn't lose the copy
        // outright; the discard cost is still paid.
        engine.returnToPile(ps, 'deck', TUTOR_TARGET);
        engine.shuffleDeck(pi, 'main');
        engine.log('cute_bird_fizzle', { player: ps.username, reason: 'canSummon_or_noSlot' });
        await engine.zeigeFizzle(CARD_NAME, { playerIdx: pi, grund: 'place_refused' });   // v1360
        return;
      }

      // Reveal the searched card to the opponent (gallery animation). Erst nach dem Explosionsbild der Rebirth-Animation (Ringe/Strahlen ~0,8 s), damit das Fenster sie nicht abdunkelt.
      await engine._delay(700);
      const oi = engine.opponentOf(pi);
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
