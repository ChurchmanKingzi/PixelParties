// ═══════════════════════════════════════════
//  CARD EFFECT: "Kitsune Transformation"
//  Spell (Magic Arts Lv0, Normal)
//  Archetype: Rebelliokai
//
//  Effect:
//    Choose up to 3 Creatures with different
//    names from your discard pile, including
//    "Rebelliokai Kind Kitsune", and shuffle them
//    back into your deck. Then, choose the same
//    number of Creatures with different names
//    from each other and from the Creatures you
//    shuffled back, from your deck, reveal them
//    and add them to your hand. Then, discard the
//    same number of cards. If this is the first
//    Magic Arts Spell you use this turn, this
//    counts as an additional Action.
//
//  Wiring:
//    • `spellPlayCondition` enforces three gates:
//        1. Kitsune in the controller's discard
//           pile (the chosen recycle set must
//           include Kitsune).
//        2. Hand is NOT locked. Hand-locked debuffs
//           silently bail every hand-add path
//           (draws, tutors); without this gate the
//           spell could be cast and then fizzle on
//           the tutor step. Greying it in hand
//           matches every other unmet-cost Spell.
//        3. Deck holds at least one differently-
//           named non-Kitsune Creature. The
//           minimum-viable play is "recycle Kitsune
//           only, tutor 1 from deck"; if no such
//           tutor target exists the Spell can't
//           function and is unplayable.
//    • Step 1 — gallery shows EVERY differently-
//      named Creature in the discard pile (Kitsune
//      included). Two simultaneous gates:
//        • requiredUniqueNames=[KITSUNE_NAME] +
//          requiredUniqueCount=1 → confirm button
//          stays disabled until Kitsune is chosen
//          AND, once 2 non-Kitsune Creatures are
//          picked, every other card dims so only
//          Kitsune can fill the 3rd slot.
//        • maxBudget=|D| (deck distinct Creature
//          count) + per-entry cost=2 if name∈D else
//          1, with hideCostUI suppressing the gold-
//          cost UI. Models the feasibility rule
//          |R|+|R∩D| ≤ |D| (so the player can never
//          pick more recycle names than the deck
//          can satisfy after exclusion).
//      Cancel = abort the entire Spell — no
//      Creature is recycled. `actionRecycleCards`
//      handles the visual flight
//      (`discard_to_deck_animation`) + the actual
//      splice + post-recycle shuffle.
//    • Step 2 — tutor `recycled.length` Creatures
//      from the deck via `cardGalleryMulti` with the
//      recycled-name filter applied (rule: tutored
//      names must differ from each other AND from
//      every recycled name). Each tutor routes
//      through `actionAddCardFromDeckToHand` for
//      the canonical reveal modal + hand-add hook.
//      An explicit `play_pile_transfer` from deck
//      → hand is broadcast per tutor BEFORE the
//      hand-add helper runs. Without it, the hand-
//      grew auto-detector reads the recycle step's
//      lingering `discardDecreased = true` signal
//      and animates the first tutor flying out of
//      the discard pile — the pile-transfer pre-
//      register suppresses that phantom.
//    • Step 3 — forced discard of `recycled.length`
//      cards via `actionPromptForceDiscard` with
//      `selfInflicted: true` (matches the cost-
//      style discards used by Cute Familiar /
//      Magenta — bypasses first-turn protection).
//    • Step 4 — first-Magic-Arts-this-turn check
//      runs BEFORE any prompts, mirroring Fire Bolts'
//      `isFirstDMSpellThisTurn` pattern. The
//      `_pendingPlayLog` for THIS Spell hasn't fired
//      yet at top-of-onPlay (prompts trigger the
//      reveal which fires the log) — so a clean
//      scan of `actionLog` correctly excludes
//      Kitsune Transformation itself.
//    • `inherentAction(gs, pi, heroIdx, engine)` —
//      the Main-Phase self-provider. When this is
//      the player's first Magic Arts Spell of the
//      turn AND the current phase is Main 1 / Main
//      2, the engine treats the cast as an inherent
//      additional Action (no Action-slot consumed,
//      no provider needed). Action-Phase plays go
//      through the normal Action-slot path; the
//      onPlay refund (`gs._spellFreeAction = true`)
//      handles the rule symmetrically for that
//      phase.
// ═══════════════════════════════════════════

const { inFlightSpellMultiset } = require('./_log-scan-shared.js');

const CARD_NAME    = 'Kitsune Transformation';
const KITSUNE_NAME = 'Rebelliokai Kind Kitsune';
const MAX_PICK     = 3;
const SPELL_SCHOOL = 'Magic Arts';

/**
 * True when no Magic Arts Spell has been logged for this player on
 * this turn yet. Mirrors `isFirstDMSpellThisTurn` from `fire-bolts.js`
 * but pivots on Magic Arts.
 * IN-FLIGHT-SCHUTZ (siehe _log-scan-shared.js): Bei LIVE-CPU-Plays
 * feuert der eigene spell_played-Eintrag via maybeFireCpuRevealEarly
 * VOR onPlay — die alte "pending-play-log ist noch nicht geschrieben"-
 * Annahme galt nur für Menschen-Plays; die CPU sah sich selbst und
 * verlor den First-Spell-Rider still. Rückwärts-Scan + Multiset.
 */
function isFirstMagicArtsSpellThisTurn(engine, playerIdx) {
  const currentTurn = engine.gs.turn;
  const playerName = engine.gs.players[playerIdx]?.username;
  const cardDB = engine._getCardDB();
  const inFlight = inFlightSpellMultiset(engine);
  const entries = engine.actionLog;
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.turn !== currentTurn) continue;
    if (entry.type !== 'spell_played' && entry.type !== 'immediate_action') continue;
    if (entry.player !== playerName) continue;
    const cd = cardDB[entry.card];
    if (!cd) continue;
    if (cd.spellSchool1 === SPELL_SCHOOL || cd.spellSchool2 === SPELL_SCHOOL) {
      if (inFlight[entry.card] > 0) { inFlight[entry.card]--; continue; }
      return false;
    }
  }
  return true;
}

module.exports = {
  // Mischt aus HAND bzw. ABLAGE ins eigene Deck zurueck. Von
  // Distracting Crystal gesperrt und von Hatusbal, the Leader of
  // Tusca mitgelesen. Als Ruling 16.8.: der Krystall deckt NUR
  // Hand und Ablage ab — Brett/Loeschstapel ausdruecklich nicht.
  shufflesFromHandOrDiscardIntoDeck: true,   // Herkunft: Ablage

  /**
   * Dynamic `inherentAction` — Main Phase plays self-provide as an
   * additional Action when this is the player's first Magic Arts
   * Spell this turn. Mirrors Fire Bolts' DM3 self-provider pattern:
   * the engine queries `inherentAction` during play-eligibility
   * checks, so returning true in Main Phase lets the card be cast
   * outside the Action Phase without a separate additional-action
   * provider.
   *
   * Action Phase plays always return false here — the standard
   * Action-slot consumption + the `_spellFreeAction` rider in onPlay
   * handle the "first Magic Arts Spell ⇒ additional Action" rule for
   * that path.
   */
  inherentAction(gs, playerIdx, heroIdx, engine) {
    const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
    if (!isMainPhase) return false;
    if (engine) return isFirstMagicArtsSpellThisTurn(engine, playerIdx);
    // Fallback: assume eligible when engine isn't supplied (rare —
    // the play-eligibility path always passes the engine through).
    return true;
  },

  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Hand-locked debuff blocks all hand-augmenting effects (draws,
    // tutors, this Spell's deck-search step). Gate the play here so
    // the card greys out in hand the same way it would with any
    // unmet cost — instead of letting the player commit and then
    // silently fizzling on the tutor step.
    if (ps.handLocked) return false;
    if ((ps.discardPile || []).indexOf(KITSUNE_NAME) < 0) return false;

    // Tutor-feasibility precheck. After recycling N Creatures (which
    // MUST include Kitsune), the player tutors N Creatures from deck
    // with names that aren't in the recycled set. The minimum viable
    // play is "recycle Kitsune only, tutor 1 non-Kitsune Creature" —
    // so the deck must hold ≥ 1 differently-named Creature whose
    // name is not Kitsune. If only Kitsune (or nothing) is in deck,
    // there's no legal tutor target and the Spell can't be cast.
    if (!engine?._getCardDB) return true; // engine not supplied — defer
    const cardDB = engine._getCardDB();
    for (const cn of (ps.mainDeck || [])) {
      if (cn === KITSUNE_NAME) continue;
      const cd = cardDB[cn];
      if (cd?.cardType === 'Creature') return true;
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

      // Snap "first Magic Arts Spell this turn" BEFORE any prompt fires —
      // otherwise the pending-play-log for this Spell triggers on the
      // first reveal and the scan would see Kitsune Transformation
      // itself in actionLog (false-negative, no refund).
      const isFirstMagicArts = isFirstMagicArtsSpellThisTurn(engine, pi);

      // Defensive re-check: the discard pile may have shifted between
      // play-time and onPlay (rare, but a parallel reaction could have
      // moved Kitsune). spellPlayCondition gates the initial play, but
      // not subsequent state mutations.
      if ((ps.discardPile || []).indexOf(KITSUNE_NAME) < 0) {
        gs._spellCancelled = true;
        return;
      }

      // ── Step 1: pick 1-3 differently-named Creatures (must include Kitsune) ──
      // Build the gallery showing EVERY differently-named Creature in
      // the player's discard pile (including Kitsune itself) — the
      // player has to manually select Kitsune. Cancel = abort the
      // entire Spell.
      const cardDB = engine._getCardDB();
      const distinctNames = new Set();
      for (const cn of (ps.discardPile || [])) {
        if (distinctNames.has(cn)) continue;
        const cd = cardDB[cn];
        if (!cd) continue;
        if (cd.cardType !== 'Creature') continue;
        distinctNames.add(cn);
      }
      // Sort with Kitsune at the top so the required pick is the first
      // visible card in the gallery.
      const galleryNames = Array.from(distinctNames).sort((a, b) => {
        if (a === KITSUNE_NAME) return -1;
        if (b === KITSUNE_NAME) return 1;
        return a.localeCompare(b);
      });

      // Deck-pool feasibility budget. The rule: tutored Creatures must
      // have names different from each other AND from each recycled
      // name. If the player picks K names, the deck needs ≥ K
      // differently-named Creatures whose names aren't in the picked
      // set.
      //
      // Let D = set of distinct Creature names in deck, R = recycled
      // selection. Feasibility:
      //   |R| ≤ |D \ R|  ⇔  |R| + |R ∩ D| ≤ |D|.
      //
      // That maps cleanly to the picker's existing maxBudget+costKey
      // dim-gate: each gallery entry costs 2 if its name is in D,
      // 1 otherwise; budget = |D|. The picker then auto-dims any
      // candidate whose addition would push totalCost over |D|, which
      // is exactly the "you've used up the deck pool" gate.
      //
      // hideCostUI: true suppresses the "Cost: X/Y" + "{n}G" badges
      // (gold-cost convention) that would otherwise read confusingly
      // here. The (Selected: X/Y) counter still surfaces (see picker
      // — the conditional was relaxed to also fire when hideCostUI
      // is set).
      const deckCreatureSet = new Set();
      for (const cn of (ps.mainDeck || [])) {
        const cd = cardDB[cn];
        if (cd?.cardType === 'Creature') deckCreatureSet.add(cn);
      }
      const gallery = galleryNames.map(name => ({
        name,
        source: 'discard',
        cost:   deckCreatureSet.has(name) ? 2 : 1,
      }));

      const cap = Math.min(MAX_PICK, gallery.length);
      // Two gates active simultaneously:
      //   • requiredUniqueNames + requiredUniqueCount: must include
      //     Kitsune. Confirm button stays disabled until Kitsune is
      //     selected; once 2 non-Kitsune cards are picked and Kitsune
      //     still isn't, all other cards dim so only Kitsune can fill
      //     the third slot.
      //   • maxBudget + costKey (hidden UI): deck-pool feasibility.
      //     Cards that would over-spend the tutor budget go dim.
      const pick = await engine.promptGeneric(pi, {
        type:                'cardGalleryMulti',
        cards:               gallery,
        selectCount:         cap,
        minSelect:           1,
        requiredUniqueNames: [KITSUNE_NAME],
        requiredUniqueCount: 1,
        uniqueGateLabel:     'Kitsune required',
        maxBudget:           deckCreatureSet.size,
        hideCostUI:          true,
        title:               CARD_NAME,
        description:         `Choose up to ${cap} Creature${cap === 1 ? '' : 's'} with different names from your discard pile to shuffle into your deck. Must include Rebelliokai Kind Kitsune. (You will tutor the same number of differently-named Creatures from your deck — picks that would exhaust your deck-pool are greyed out.)`,
        confirmLabel:        '🦊 Transform!',
        cancellable:         true,
      });
      if (!pick || pick.cancelled || !Array.isArray(pick.selectedCards) || pick.selectedCards.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      const recycleNames = pick.selectedCards.slice(0, cap);
      // Defensive re-check: the gate already prevents confirm without
      // Kitsune, but a malformed payload would otherwise fall through
      // and recycle the wrong set.
      if (!recycleNames.includes(KITSUNE_NAME)) {
        gs._spellCancelled = true;
        return;
      }

      const recycled = await engine.actionRecycleCards(pi, recycleNames, {
        source:  CARD_NAME,
        shuffle: true,
      });

      const N = recycled.length;
      if (N === 0) {
        // Recycling fizzled (Kitsune was pulled out from under us).
        gs._spellCancelled = true;
        return;
      }

      // ── Step 2: tutor N differently-named Creatures from deck ──
      const recycledSet = new Set(recycled);
      const deckCounts = {};
      for (const cn of (ps.mainDeck || [])) {
        if (recycledSet.has(cn)) continue;
        const cd = cardDB[cn];
        if (!cd) continue;
        if (cd.cardType !== 'Creature') continue;
        deckCounts[cn] = (deckCounts[cn] || 0) + 1;
      }
      const deckGallery = Object.entries(deckCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'deck', count }));

      const tutored = [];
      if (deckGallery.length > 0) {
        const tutorCap = Math.min(N, deckGallery.length);
        // Mandatory pick — rule says "choose the same number". We let
        // `minSelect = tutorCap` enforce that the player can't bail out
        // (if the deck has fewer eligible Creatures than N, they pick
        // the deck-floor count instead — interpreted as "as many as
        // possible up to N"; the discard-N step still uses N below).
        const pickDeck = await engine.promptGeneric(pi, {
          type:        'cardGalleryMulti',
          cards:       deckGallery,
          selectCount: tutorCap,
          minSelect:   tutorCap,
          title:       CARD_NAME,
          description: `Choose ${tutorCap} Creature${tutorCap === 1 ? '' : 's'} with different names from your deck to add to your hand.`,
          confirmLabel: '✨ Search!',
          cancellable:  false,
        });
        if (pickDeck && Array.isArray(pickDeck.selectedCards)) {
          for (const name of pickDeck.selectedCards.slice(0, tutorCap)) {
            // Explicit deck → hand flight. The hand-grew auto-detector
            // would otherwise read the recycle step's lingering
            // `discardDecreased = true` signal (recycling shrank the
            // discard pile, hand watcher refs only update on hand
            // changes) and animate the FIRST tutor flying out of the
            // discard pile. Pre-registering the pile-transfer here
            // bumps `pileTransferToHandPendingMeRef` so the auto-
            // detector consumes one slot and skips its phantom for
            // this card — same handshake Bakus uses for its
            // discard→hand recur followed by an actionDrawCards.
            engine._broadcastEvent('play_pile_transfer', {
              owner:     pi,
              cardName:  name,
              from:      'deck',
              to:        'hand',
              toHandIdx: (ps.hand || []).length,
            });
            const ok = await engine.actionAddCardFromDeckToHand(pi, name, {
              source: CARD_NAME,
              reveal: true,
            });
            if (ok) tutored.push(name);
          }
          engine.shuffleDeck(pi, 'main');
          engine.sync();
        }
      }

      // ── Step 3: forced discard of N cards ──
      // "Then, discard the same number of cards" — always tied to the
      // recycled count, NOT the tutored count. If the tutor step hit
      // the deck-floor early, the discard count is still N.
      // selfInflicted: true bypasses first-turn protection (matches
      // Cute Familiar's discard cost).
      if (N > 0 && (ps.hand || []).length > 0) {
        await engine.actionPromptForceDiscard(pi, N, {
          source:        CARD_NAME,
          selfInflicted: true,
          title:         `${CARD_NAME} — Discard`,
          description:   `Discard ${N} card${N === 1 ? '' : 's'}.`,
        });
      }

      engine.log('kitsune_transformation', {
        player:         ps.username,
        recycled:       N,
        tutored:        tutored.length,
        firstMagicArts: isFirstMagicArts,
      });

      // ── Step 4: action-refund rider ──
      if (isFirstMagicArts) {
        gs._spellFreeAction = true;
      }
      engine.sync();
    },
  },
};
