// ═══════════════════════════════════════════
//  CARD EFFECT: "Wheels"
//  Artifact — Two modes:
//    Draw 3: Draw 3 cards, then discard 1.
//    Draw 4: Draw 4 cards, then delete 2.
//  Hard once per turn.
//
//  Both costs route through the engine's
//  `actionPromptForceDiscard` (Als Multi-
//  Discard-Ruling): per-card hand→pile flight,
//  DISCARD_PACE_MS stagger between the two
//  deletes, delete-rescue gate, batched
//  ON_DISCARD / ON_DELETE hooks. The mid-
//  resolution Wheels copy is excluded from the
//  pick via a PER-PICK `eligibleIndices`
//  function (indices shift after each splice).
// ═══════════════════════════════════════════

module.exports = {
  isTargetingArtifact: true,

  // Gerrymander redirect — when opp activates Wheels, our Gerrymander
  // picks for them. Pick `draw4` so opp deletes 2 cards (permanent
  // loss vs draw3's recoverable discard).
  cpuGerrymanderResponse(/* engine, gerryOwnerPi, promptData */) {
    return { optionId: 'draw4' };
  },

  canActivate(gs, pi) {
    // HOPT check
    const hoptKey = `wheels:${pi}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    return true;
  },

  animationType: 'gold_sparkle',

  resolve: async (engine, pi) => {
    const ps = engine.gs.players[pi];
    if (!ps) return { cancelled: true };

    // Prompt for mode selection (with cancel)
    const choice = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      title: 'Wheels',
      description: 'Choose your ride:',
      options: [
        { id: 'draw3', label: 'Draw 3, Discard 1', description: 'Draw 3 cards, then discard 1 from your hand.', color: '#44cc88' },
        { id: 'draw4', label: 'Draw 4, Delete 2', description: 'Draw 4 cards, then delete 2 from your hand.', color: '#ff8844' },
      ],
      cancellable: true,
      gerrymanderEligible: true, // 2 distinct effects (Draw3+Discard1 vs Draw4+Delete2).
    });

    if (!choice || choice.cancelled) return { cancelled: true };

    // Claim HOPT only after confirming a mode (cancel doesn't consume it)
    if (!engine.claimHOPT('wheels', pi)) return;

    // Compute the hand index of THIS Wheels copy so we can exclude it
    // from the prompts below — Wheels is mid-resolution and shouldn't
    // be a valid target of its own forced-discard / forced-delete cost.
    // The natural cleanup at the end of doUseArtifactEffect moves it
    // to discard; allowing the CPU (or a confused human) to pick it
    // here just sends Wheels to the deletedPile by mistake.
    const resolvingHandIdx = () => {
      const r = ps._resolvingCard;
      if (!r || r.name !== 'Wheels') return -1;
      const target = r.nth || 1;
      let count = 0;
      for (let i = 0; i < ps.hand.length; i++) {
        if (ps.hand[i] !== 'Wheels') continue;
        count++;
        if (count === target) return i;
      }
      return -1;
    };
    const buildEligibleIndices = () => {
      const exclude = resolvingHandIdx();
      if (exclude < 0) return undefined;
      const out = [];
      for (let i = 0; i < ps.hand.length; i++) if (i !== exclude) out.push(i);
      return out.length > 0 ? out : undefined;
    };

    if (choice.optionId === 'draw3') {
      // ── Mode A: Draw 3, Discard 1 ──
      await engine.actionDrawCards(pi, 3);

      if ((ps.hand || []).length === 0) return;

      // Als Multi-Discard-Ruling: über den v53-Engine-Helfer statt des
      // alten Hand-Splice — der Helfer broadcastet den Hand→Pile-Flug
      // (play_pile_transfer mit exaktem Hand-Slot), glowt die Quelle
      // und feuert die ON_DISCARD-Hooks, die der rohe Splice komplett
      // übersprang (Cute Dog / Glass of Marbles etc. triggerten bei
      // Wheels-Abwürfen nie).
      await engine.actionPromptForceDiscard(pi, 1, {
        source: 'Wheels',
        selfInflicted: true,
        title: 'Wheels — Draw 3',
        description: 'You must discard 1 card from your hand.',
        eligibleIndices: buildEligibleIndices,
      });

    } else if (choice.optionId === 'draw4') {
      // ── Mode B: Draw 4, Delete 2 ──
      await engine.actionDrawCards(pi, 4);

      // Als Multi-Discard-Ruling: 2+ Deletes auf einmal laufen
      // NACHEINANDER mit kurzem Delay von der Hand zum Deleted Pile.
      // Der v53-Helfer liefert genau das: DISCARD_PACE_MS-Takt
      // zwischen den Picks (CPU-Burst-Fix), Einzel-Flug je Karte via
      // play_pile_transfer to:'deleted', Delete-Rescue-Gate
      // (_tryBeforeDelete — vom alten Hand-Splice übersprungen),
      // Batch-Zähler + deferred ON_DELETE-Hooks. `eligibleIndices`
      // als FUNKTION, weil sich der Ausschluss-Index der mid-
      // resolution Wheels-Kopie nach jedem Splice verschiebt.
      await engine.actionPromptForceDiscard(pi, 2, {
        source: 'Wheels',
        selfInflicted: true,
        deleteMode: true,
        title: 'Wheels — Draw 4',
        instruction: 'Click a card in your hand to delete it.',
        eligibleIndices: buildEligibleIndices,
      });
    }
  },
};
