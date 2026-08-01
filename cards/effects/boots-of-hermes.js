// ═══════════════════════════════════════════
//  CARD EFFECT: "Boots of Hermes"
//  Artifact (Reaction) — cost 0
//
//  EFFECT:
//   "Play this card immediately when your opponent
//    activates a Surprise. Negate that Surprise and
//    draw a card."
//
//  IMPLEMENTATION — pure hand trap:
//   • This card can ONLY ever do anything through
//     its own onSurpriseActivated hook below. It is
//     NEVER proactively playable and NEVER joins a
//     reaction chain:
//       – cards.json subtype is "Reaction" and this
//         script does NOT export `proactivePlay`, so
//         `validateActionPlay` refuses every attempt
//         to click it in hand ("Reaction subtype:
//         not proactively playable unless script
//         opts in").
//       – It does NOT export `isReaction`, so the
//         generic reaction-chain collector skips it
//         (`if (!script?.isReaction) continue;`), and
//         `onSurpriseActivated` is in REACTION_SKIP_
//         HOOKS anyway — Surprise activation opens no
//         generic reaction window.
//   • `activeIn: ['hand']` — the trap only listens
//     while the card sits in its owner's hand
//     (mirrors the hand-listener pattern in
//     cute-bunny.js).
//   • Negation is delivered to the engine via
//     `ctx.setFlag('_surpriseNegated', true)`. The
//     engine's `_activateSurprise` reads this flag
//     immediately after the onSurpriseActivated hook
//     and, when set, skips the Surprise's effect +
//     afterSpellResolved, fires ON_EFFECT_NEGATED,
//     and consumes the Surprise to the discard pile
//     (no Creature is placed) — exactly like a
//     negated Spell.
//   • The draw routes through `actionDrawCards`
//     (same as Alleria's onSurpriseActivated draw).
//     We are inside `_inSurpriseResolution`, so the
//     draw does not open a nested surprise-draw
//     window.
// ═══════════════════════════════════════════

const CARD_NAME = 'Boots of Hermes';

module.exports = {
  // Trap listens only from hand. No proactive / chain entry points by
  // design (see header) — this is the card's sole behaviour.
  activeIn: ['hand'],

  hooks: {
    onSurpriseActivated: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;

      // React ONLY to the OPPONENT activating a Surprise.
      const bootsOwner = ctx.cardOriginalOwner;
      const surpriseOwner = ctx.surpriseOwner;
      if (surpriseOwner == null || surpriseOwner === bootsOwner) return;

      // Already negated this activation (a prior copy / effect). Each
      // listener gets a fresh ctx spread from the live hook ctx, so
      // this reflects a flag set by an earlier listener in this loop.
      if (ctx._surpriseNegated) return;

      // The Boots instance must still be a real card in the owner's
      // hand (defends against a discarded/relocated copy whose tracked
      // instance lingered a tick).
      const bootsInst = ctx.card;
      if (!bootsInst || bootsInst.zone !== 'hand') return;
      const ps = gs.players[bootsOwner];
      if (!ps || ps.hand.indexOf(CARD_NAME) < 0) return;

      const surpriseName = ctx.surpriseCardName || 'that Surprise';

      // "You may" — opt-in. cancellable + gerrymanderEligible so the
      // engine treats it like every other genuine "you may" choice
      // (the opponent's Gerrymander, if any, may choose for you —
      // identical handling to cute-bunny.js's hand-summon prompt).
      // `showCard` renders the just-activated Surprise's image in the
      // pop-up (frontend looks it up in CARDS_BY_NAME — pass the real
      // card name, not the 'that Surprise' fallback).
      const confirmed = await engine.promptGeneric(bootsOwner, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Your opponent activated "${surpriseName}". Play "${CARD_NAME}" to Negate that Surprise and draw a card?`,
        showCard: ctx.surpriseCardName || undefined,
        confirmLabel: '👟 Negate!',
        cancelLabel: 'Pass',
        cancellable: true,
        gerrymanderEligible: true,
      });
      if (!confirmed) return;

      // Re-validate after the async prompt: still in hand, still not
      // negated by something resolved during the prompt.
      if (ctx._surpriseNegated) return;
      if (ps.hand.indexOf(CARD_NAME) < 0) return;

      // ── Activation visual #1: stream Boots' card image to BOTH
      // players + spectators as an activated effect. `_broadcastEvent`
      // fans the event out to every socket (both players' clients +
      // spectators); the frontend's `onReveal` shows the centered
      // CardRevealOverlay for all of them. Brief beat so the reveal
      // registers before the card physically flies away — mirrors the
      // 800ms `_activateSurprise` uses after its own surprise flip.
      engine._broadcastEvent('card_reveal', {
        cardName: CARD_NAME, playerIdx: bootsOwner,
      });
      await engine._delay(800);

      // Re-read the live hand index (defensive — nothing else acts
      // during the delay since we're mid surprise-resolution, but the
      // splice + flight below must target the slot that's actually
      // rendered right now, including its exact index).
      const handIdx = ps.hand.indexOf(CARD_NAME);
      if (handIdx < 0) return;

      // ── Activation visual #2: physical hand → discard flight,
      // anchored at Boots' EXACT hand index. Broadcast BEFORE the hand
      // mutation so the source slot is still rendered when the client
      // captures its rect; the `from:'hand' → to:'discard'` shape also
      // pre-arms `onPileTransfer`'s diff-animator suppression bucket so
      // the card flies exactly once (canonical pattern — see
      // lunatic-cycle-new-moon.js / draw.js).
      // `asPlay: 'sole'` = einziges Play-Signal dieser Karte für den
      // Trainings-Recorder (Als Befund "Boots of Hermes nie gespielt",
      // 0 Plays in 1248 Spielen). Boots spielt sich per Hook
      // (onSurpriseActivated) selbst aus der Hand: sie nutzt keines der
      // 13 Reaktionsfenster der Engine, und der direkte hand.splice
      // unten umgeht den CARD_MOVED-Hook, auf dem die Zonen-Erfassung
      // des Recorders sitzt. Ohne Marker sah der Recorder nur einen
      // gewöhnlichen Pile-Transfer und zählte ihn nicht — dieselbe
      // Klasse wie Divine Gift of the Guardian.
      engine._broadcastEvent('play_pile_transfer', {
        owner: bootsOwner, cardName: CARD_NAME,
        from: 'hand', to: 'discard', asPlay: 'sole', fromHandIdx: handIdx,
      });

      // Commit: Boots leaves hand → discard. Cost is 0, so no gold is
      // deducted. Direct push (no onDiscard) matches the engine's own
      // spent-Surprise / spent-Spell consumption — Boots is played &
      // spent, not discarded. Untrack the hand instance so no orphan
      // listener lingers in the hand zone.
      ps.hand.splice(handIdx, 1);
      ps.discardPile.push(CARD_NAME);
      if (bootsInst.id != null) engine._untrackCard(bootsInst.id);

      // Negate the Surprise — engine reads these after this hook.
      ctx.setFlag('_surpriseNegated', true);
      ctx.setFlag('_surpriseNegatedBy', CARD_NAME);

      // Draw a card.
      await engine.actionDrawCards(bootsOwner, 1);

      engine.log('boots_of_hermes', {
        player: ps.username,
        negated: surpriseName,
      });
      engine.sync();
    },
  },
};
