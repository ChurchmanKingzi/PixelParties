// ═══════════════════════════════════════════
//  CARD EFFECT: "Elven Rider"
//  Creature / Reaction (Summoning Magic Lv1) — 50 HP
//
//  Rules text:
//    "You cannot summon this Creature, except with
//     its own effect. You may immediately summon
//     this Creature from your hand as an additional
//     Action when an 'Elven' Creature you control
//     leaves the board, but you must summon it into
//     the same Support Zone that Creature occupied.
//     When you summon this Creature, search your
//     deck for any 'Elven' Creature, except 'Elven
//     Rider', reveal it and add it to your hand."
//
//  Design notes:
//    • No-summon-from-hand: the engine already
//      blocks Reaction-subtype cards from proactive
//      play (`validateActionPlay` line ~5375). We
//      deliberately do NOT export `proactivePlay`,
//      so the hand gate is automatic. No custom
//      `canSummon` / `spellPlayCondition` needed.
//    • Reaction trigger: `onCreatureDeath`. That
//      hook fires without the `_onlyCard` filter,
//      so every Rider listening in hand actually
//      receives the event (in contrast to
//      `onCardLeaveZone` which the engine targets
//      at the leaving card only).
//    • Same-slot constraint: we capture the slot
//      from `deathInfo.heroIdx/zoneSlot`. At hook
//      firing time the engine has already removed
//      the dying creature from its slot, so the
//      slot is guaranteed empty. We then call
//      `summonCreatureWithHooks` with that exact
//      slot — `safePlaceInSupport` will honour a
//      free target slot exactly; if (impossibly)
//      the slot is no longer free, it would
//      relocate, so we pre-verify emptiness and
//      fizzle if violated.
//    • Bypass of normal summon path: we go through
//      `summonCreatureWithHooks`, which routes
//      through `safePlaceInSupport` + fires onPlay.
//      `canSummon` / spell-school / action-phase
//      checks are skipped — that's the whole point
//      of "except with its own effect".
//    • Opposing-turn safety: the reaction can
//      trigger during the opponent's turn. That's
//      correct per card text. The summon does not
//      consume any action or gold.
//    • On-summon tutor: fires in `onPlay` when
//      Rider lands in support zone. Reveals an
//      Elven from deck (excluding Rider) and adds
//      to hand. Uses the standard deck-search
//      reveal flow mirrored from Reality Crack and
//      Elven Druid.
//    • Once Rider is on the board, it simply counts
//      as another Elven Creature for Archer's
//      `inherentAction` gate — no extra per-Rider
//      bookkeeping needed. Listens for
//      `onCreatureDeath` in BOTH 'hand' and
//      'support' zones, but the hook body gates on
//      `ctx.cardZone === 'hand'` so on-board Riders
//      don't self-trigger.
// ═══════════════════════════════════════════

const {
  isElvenCreature,
} = require('./_elven-shared');

const CARD_NAME    = 'Elven Rider';
const EXCLUDE_NAME = 'Elven Rider';

// Key used on the player state to mark "Rider is mid-resolve — don't
// trigger the same physical hand card twice for overlapping events."
// Scoped per-player (`_elvenRiderResolving[pi]`) and cleared in finally.
const RESOLVING_KEY = '_elvenRiderResolving';

/**
 * Narrow check: is this `onCreatureDeath` event a valid trigger for a
 * Rider in our hand? Requires the deceased to be an Elven Creature we
 * controlled at the time of death, AND the slot it occupied to now be
 * empty so Rider can land there.
 */
function isValidRiderTrigger(engine, deathInfo, ownerIdx) {
  if (!deathInfo) return false;
  // Must have been ours. `originalOwner` tolerates stolen Elven returning
  // to us via death (the standard engine rule that a stolen creature's
  // discard goes to the original owner, and we mirror the "controller"
  // semantic for the live check via `owner`).
  if (deathInfo.owner !== ownerIdx) return false;
  const cardDB = engine._getCardDB();
  const cd = cardDB[deathInfo.name];
  if (!isElvenCreature(cd)) return false;
  const ps = engine.gs.players[ownerIdx];
  if (!ps) return false;
  // Slot must be empty RIGHT NOW. The engine clears the slot just
  // before firing this hook, so this normally passes — but another
  // reaction in the batch could conceivably have filled it.
  const slot = ps.supportZones?.[deathInfo.heroIdx]?.[deathInfo.zoneSlot];
  if (slot && slot.length > 0) return false;
  return true;
}

/**
 * On-summon tutor: pick an Elven from deck (excluding Rider), reveal it,
 * add to hand, shuffle. Mirrors the deck-search-reveal flow used by
 * Reality Crack, Madaga, Elven Druid.
 */
async function runRiderTutor(engine, pi) {
  const gs     = engine.gs;
  const ps     = gs.players[pi];
  const cardDB = engine._getCardDB();

  // Hand-lock fizzles only the search step — the summon itself already
  // resolved. No prompt, no shuffle, silent skip.
  if (ps?.handLocked) {
    engine.log('elven_rider_tutor_handlocked', { player: ps.username });
    return;
  }

  const counts = {};
  for (const name of (ps.mainDeck || [])) {
    if (name === EXCLUDE_NAME) continue;
    if (!isElvenCreature(cardDB[name])) continue;
    counts[name] = (counts[name] || 0) + 1;
  }
  const gallery = Object.entries(counts)
    .map(([name, count]) => ({ name, source: 'deck', count, level: cardDB[name]?.level || 0 }))
    .sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));

  if (gallery.length === 0) {
    engine.log('elven_rider_tutor_empty', { player: ps.username });
    // Still shuffle — the card text says "search your deck", which
    // typically implies a shuffle afterwards even on no-find.
    engine.shuffleDeck(pi, 'main');
    return;
  }

  const picked = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    cards: gallery,
    title: CARD_NAME,
    description: 'Choose an Elven Creature from your deck to add to your hand.',
    cancellable: true,
  });

  // Even cancellation triggers the shuffle per "search your deck" convention
  if (!picked || picked.cancelled || !picked.cardName) {
    engine.shuffleDeck(pi, 'main');
    engine.log('elven_rider_tutor_cancelled', { player: ps.username });
    return;
  }

  const chosenName = picked.cardName;
  const idx = (ps.mainDeck || []).indexOf(chosenName);
  if (idx < 0) {
    engine.shuffleDeck(pi, 'main');
    return;
  }
  ps.mainDeck.splice(idx, 1);
  engine.shuffleDeck(pi, 'main');
  ps.hand.push(chosenName);

  engine._broadcastEvent('deck_search_add', { cardName: chosenName, playerIdx: pi });
  engine.log('elven_rider_tutor', { player: ps.username, added: chosenName });

  // Opponent-side reveal modal
  const oi = pi === 0 ? 1 : 0;
  await engine.promptGeneric(oi, {
    type: 'deckSearchReveal',
    cardName: chosenName,
    searcherName: ps.username,
    title: CARD_NAME,
    cancellable: false,
  });
}

module.exports = {
  // Must listen while in hand AND act like a normal Elven while on the
  // board. Hook bodies gate on `ctx.cardZone` to split behaviour.
  activeIn: ['hand', 'support'],

  hooks: {
    // ── Reaction trigger: an Elven Creature we control dies ──
    onCreatureDeath: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;

      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const ps      = gs.players[pi];
      if (!ps) return;

      const death = ctx.creature;
      if (!isValidRiderTrigger(engine, death, pi)) return;

      // Re-entry guard: one Rider per trigger event. Without this, two
      // Rider copies in hand could both be prompted for the same dying
      // Elven — which is technically fine by rules, but the second
      // would find the slot already filled by the first. Instead of
      // letting the second fizzle, we gate on an event key so only
      // ONE prompt per death.
      gs._elvenRiderTriggered = gs._elvenRiderTriggered || {};
      const evtKey = `${pi}:${death.heroIdx}:${death.zoneSlot}:${death.name}:${gs.turn}`;
      if (gs._elvenRiderTriggered[evtKey]) return;

      // Also a per-player in-flight guard against overlapping effects
      if (gs[RESOLVING_KEY]?.[pi]) return;

      // ── Prompt the player ──
      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `An Elven Creature you controlled (${death.name}) just left the board. Summon Elven Rider into its slot?`,
        showCard: CARD_NAME,
        confirmLabel: 'Summon!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) return;

      // Still have a Rider in hand? (The player could, in theory, have
      // lost it between the prompt and confirm via another effect.)
      const handIdx = ps.hand.indexOf(CARD_NAME);
      if (handIdx < 0) return;

      // Re-verify the slot is empty (belt-and-suspenders)
      const slot = ps.supportZones?.[death.heroIdx]?.[death.zoneSlot];
      if (slot && slot.length > 0) {
        engine.log('elven_rider_fizzle', { player: ps.username, reason: 'slot_occupied' });
        return;
      }

      // Claim the trigger + in-flight flag
      gs._elvenRiderTriggered[evtKey] = true;
      if (!gs[RESOLVING_KEY]) gs[RESOLVING_KEY] = {};
      gs[RESOLVING_KEY][pi] = true;

      try {
        // Consume the hand copy NOW — before summonCreatureWithHooks
        // can fire hooks that might inspect the hand.
        ps.hand.splice(handIdx, 1);

        engine._broadcastEvent('card_reveal', { cardName: CARD_NAME });

        // Summon into the EXACT slot. `safePlaceInSupport` relocates
        // on occupied — we've already verified empty, so it lands
        // where requested.
        const res = await engine.summonCreatureWithHooks(
          CARD_NAME, pi, death.heroIdx, death.zoneSlot,
          { source: `${CARD_NAME} reaction`, skipBeforeSummon: false }
        );
        if (!res) {
          // Extremely unlikely (no free slot after all). Put back.
          ps.hand.push(CARD_NAME);
          engine.log('elven_rider_fizzle', { player: ps.username, reason: 'place_refused' });
          return;
        }

        engine.log('elven_rider_summoned', {
          player: ps.username,
          triggered_by: death.name,
          hero: death.heroIdx,
          slot: death.zoneSlot,
        });
        engine.sync();
      } finally {
        gs[RESOLVING_KEY][pi] = false;
      }
    },

    // ── On-summon: search deck, add an Elven (not Rider) to hand ──
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'support') {
        // While in hand, the "onPlay" hook isn't meaningful — but a
        // generic onPlay fire (e.g. from a future bulk-hook) shouldn't
        // misfire the tutor.
        return;
      }
      const engine = ctx._engine;
      const pi     = ctx.cardOwner;
      // The tutor is explicit card text: fires every time Rider is
      // summoned (not just on the first one). No HOPT guard.
      await runRiderTutor(engine, pi);
    },
  },
};
