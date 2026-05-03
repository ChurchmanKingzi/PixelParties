// ═══════════════════════════════════════════
//  CARD EFFECT: "Rebelliokai Kind Kitsune"
//  Creature (Summoning Magic Lv1) — 50 HP
//  Archetype: Rebelliokai
//
//  Self-deletes when sent to discard from
//  outside hand or board.
//
//  Trigger: when Kitsune is discarded from hand
//  by a Rebelliokai Creature's effect, the
//  controller may choose a non-Creature card
//  from their discard pile and add it to their
//  hand. They cannot play cards with that name
//  for the rest of the turn afterwards.
//
//  Wiring:
//    • activeIn: ['discard'] — the listener that
//      acts on the trigger is the just-discarded
//      Kitsune. `actionDiscardHandCard` updates
//      `inst.zone` to 'discard' before firing
//      onDiscard, so the dying Kitsune's listener
//      passes the activeIn filter while sibling
//      copies still in hand do not. This neatly
//      gives us self-detection without a manual
//      instId match.
//    • Source filter: only triggers when the
//      discard was tagged with `DISCARD_SOURCE_TAG`
//      ('rebelliokai') — Camouflaged Kappa's
//      search-and-discard, Kirin's reaction
//      cost, future Rebelliokai Spells / Attacks
//      that discard hand cards all set this tag.
//      Magenta's hand-discard cost is NOT a
//      Rebelliokai effect, so Kitsune does NOT
//      trigger when Magenta discards Kitsune as
//      her own cost.
//    • Lock-name: writes the chosen card's name
//      into `ps._creationLockedNames` (the same
//      Set the engine reads at play-time to gate
//      the "cannot play this name" rule — used
//      by Cosmic Malfunction, Brilliant Idea,
//      Alchemic Journal, etc.). Auto-cleared on
//      the controller's next turn-start.
// ═══════════════════════════════════════════

const { DISCARD_SOURCE_TAG } = require('./_rebelliokai-shared');

const CARD_NAME = 'Rebelliokai Kind Kitsune';

module.exports = {
  selfDeleteOnExternalDiscard: true,
  // Listen exclusively while in discard — keeps the trigger self-
  // detecting (only the just-discarded Kitsune's inst is at
  // zone='discard' when onDiscard fires through the canonical
  // `actionDiscardHandCard` path). Hand-zoned sibling Kitsunes are
  // filtered out by the activeIn check.
  activeIn: ['discard'],

  cpuMeta: {
    // Kitsune's discard trigger is essentially "you got a free card
    // back from your discard pile, with a name lock". Roughly
    // equivalent to a Spell's worth of value (~+15 hand value). The
    // name-lock downside is mild — usually the picked card is the
    // single best non-Creature option already, and one-shot non-
    // Creatures rarely repeat in the same turn. Net ≈+13.
    onDeathBenefit: 13,
  },

  hooks: {
    onDiscard: async (ctx) => {
      // Only the just-discarded Kitsune's listener should act.
      if (!ctx._fromHand) return;
      if (ctx.discardedCardName !== CARD_NAME) return;
      if (ctx.playerIdx !== ctx.cardOwner) return;
      // Strict source filter — must be a Rebelliokai-tagged discard.
      if (ctx.source !== DISCARD_SOURCE_TAG) return;
      // Self-detect via instance id. Without this, a previously-
      // discarded Kitsune sitting in the discard pile would ALSO
      // pass the "name matches" filter when a sibling Kitsune is
      // freshly discarded — and fire its own recovery prompt off
      // the same event. The engine's actionDiscardHandCard /
      // actionDiscardCards now carries the discarded inst's id in
      // `ctx.discardedInstId`; only the listener whose inst matches
      // is the JUST-discarded copy that the rule is talking about.
      if (ctx.discardedInstId == null) return;
      if (ctx.discardedInstId !== ctx.card?.id) return;

      const engine = ctx._engine;
      const ps     = engine.gs.players[ctx.cardOwner];
      if (!ps) return;
      // Hand-lock gate: the recovery would silently fizzle and waste
      // the player's prompt. Bail before the prompt UI fires.
      if (ps.handLocked) return;

      // Build the non-Creature gallery from the controller's discard
      // pile (excluding Kitsune itself — the rule says "a card from
      // your discard pile that is not a Creature", and Kitsune just
      // landed there a moment ago, but it's a Creature anyway, so
      // the cardType filter handles the exclusion automatically).
      const cardDB = engine._getCardDB();
      const counts = {};
      for (const cn of (ps.discardPile || [])) {
        const cd = cardDB[cn];
        if (!cd) continue;
        if (cd.cardType === 'Creature') continue;
        counts[cn] = (counts[cn] || 0) + 1;
      }
      const gallery = Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'discard', count }));
      if (gallery.length === 0) return;

      const picked = await engine.promptGeneric(ctx.cardOwner, {
        type:        'cardGallery',
        cards:       gallery,
        title:       CARD_NAME,
        description: 'Choose a non-Creature card from your discard pile to add to your hand. You cannot play cards with that name for the rest of the turn.',
        confirmLabel: '🦊 Recover!',
        cancellable: true,
        gerrymanderEligible: true,
      });
      if (!picked || picked.cancelled || !picked.cardName) return;
      const chosenName = picked.cardName;

      // Defensive re-check: the discard pile may have shifted during
      // the prompt (rare — but a parallel reaction could move it).
      if ((ps.discardPile || []).indexOf(chosenName) < 0) return;
      const cd = cardDB[chosenName];
      if (!cd || cd.cardType === 'Creature') return;

      // Pile-transfer animation: chosen card visibly flies from the
      // discard pile rect into the controller's hand slot, mirroring
      // the explicit-flight pattern Bakus's recur uses. Without this
      // the hand-grew auto-detector might pick the wrong source rect
      // when the discard ALSO grew this hook tick (Kitsune itself
      // landed there a moment ago — net hand delta is 0, net discard
      // delta is 0, the auto-branches go nowhere).
      engine._broadcastEvent('play_pile_transfer', {
        owner:     ctx.cardOwner,
        cardName:  chosenName,
        from:      'discard',
        to:        'hand',
        toHandIdx: (ps.hand || []).length, // landing slot
      });

      // Move the card from discardPile → hand via the canonical
      // helper so ON_CARD_ADDED_FROM_DISCARD_TO_HAND fires (Bamboo
      // Staff, Bamboo Shield reveal, etc.).
      const handInst = await engine.addCardFromDiscardToHand(
        ctx.cardOwner, chosenName, ctx.cardOwner,
        { source: CARD_NAME },
      );
      if (!handInst) return;

      // Lock the name for the rest of the turn. The engine's hand-
      // play and ability-play paths consult `_creationLockedNames`
      // before allowing a card to be played, so this is the same
      // gate Cosmic Malfunction / Alchemic Journal / Brilliant Idea
      // all reuse. Cleared automatically at turn-start.
      if (!ps._creationLockedNames) ps._creationLockedNames = new Set();
      ps._creationLockedNames.add(chosenName);

      engine.log('rebelliokai_kind_kitsune', {
        player:   ps.username,
        recovered: chosenName,
      });
      engine.sync();
    },
  },
};
