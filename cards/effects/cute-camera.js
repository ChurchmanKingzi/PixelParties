// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Camera"
//  Artifact (Reaction) — When your opponent
//  plays a Reaction, negate it.
//  Pay 3G extra to close the chain (prevent
//  further reactions).
//  Camera itself is a Reaction, so another
//  Camera can negate it.
//
//  Zwei Wege (N5-04): ① KETTENFENSTER (`reactionCondition`,
//  `onChainAdd`/`resolve`) und ② HAND-REAKTIONSFENSTER der Engine
//  (Post-Target, vor/nach Schaden, Held/Kreatur besiegt … – KEINE
//  Kette): Hook `onReactionPlayed` (Bauform Front Soldier, Weg ③;
//  CARD_API „FRONT SOLDIER"). Die Kamera wird angeboten, wenn der
//  GEGNER eine Reaction (Spell/Attack/Artifact – keine Creature) auf
//  eine Karte/einen Effekt des Kamerabesitzers spielt (Quelle bekannt:
//  `ctx.sourceOwner`; W26a: unbekannt = KEIN Angebot), und negiert sie
//  (`_reactionNegated`). Kosten 4 Gold (+3: der Gegner kann nicht
//  reagieren – dann ohne `onReactionPlayed` für die Kamera selbst).
// ═══════════════════════════════════════════

const CARD_NAME = 'Cute Camera';
const EXTRA = 3;

module.exports = {
  isReaction: true,
  isTargetingArtifact: true,
  activeIn: ['hand'],   // N5-04: Hand-Hook `onReactionPlayed`

  /** CPU: die Hand-Fenster-Frage (②) bejahen wie Front Soldier; das +3-Gold-Angebot nicht. */
  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'confirm' && payload.title === CARD_NAME && payload._kameraHandFenster) return { confirmed: true };
    return undefined;
  },

  hooks: {
    /** ② Der Gegner spielt eine Reaction in einem Hand-Reaktionsfenster der Engine. */
    onReactionPlayed: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOriginalOwner;
      if (ctx.reactionOwner == null || ctx.reactionOwner === pi) return;   // nur Reaktionen des GEGNERS
      if (ctx._reactionNegated) return;                                     // schon negiert (andere Kamera / Front Soldier)
      if (ctx.reactionCardType === 'Creature') return;                      // Text: „Reaction Spell or Artifact"
      // W26a (Al, Welle 26): NUR in Reaktion auf eine gespielte Gegner-Reaktion, die deine Karte/deinen Effekt beantwortet: ist die Quelle des Fensters unbekannt
      // (z. B. Tod-Fenster ohne bekannten Verursacher), gibt es kein Angebot.
      if (!Number.isInteger(ctx.sourceOwner) || ctx.sourceOwner !== pi) return;   // „in reaction to YOUR card or effect"
      const inst = ctx.card;
      if (!inst || inst.zone !== 'hand') return;
      const ps = gs.players[pi];
      if (!ps || ps.hand.indexOf(CARD_NAME) < 0) return;
      // Dieselben Tore wie die Hand-Reaktionsfenster: Erst-Zug-Schutz, Dark Ocean, Hand-Spielsperre (Reaktions-/Artefaktsperre), Gold.
      if (gs.firstTurnProtectedPlayer === pi) return;
      if (engine.darkOceanBlocksReaction(pi, null)) return;
      if (engine._handPlayLockedFor(ps, CARD_NAME)) return;
      const script = module.exports;
      const cost = engine._getCardDB()[CARD_NAME]?.cost || 0;
      if (!engine._rxCanAfford(ps, cost, CARD_NAME)) return;

      const antwort = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        _handReactionWindow: true,
        _kameraHandFenster: true,
        message: `Your opponent played "${ctx.reactionCardName}" in reaction to your card or effect. Play ${CARD_NAME} to negate it?`,
        showCard: CARD_NAME,
        confirmLabel: '📸 Negate!',
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true,
      });
      if (!engine._confirmSaidYes(antwort)) return;
      if (ctx._reactionNegated) return;                                     // nach der Abfrage neu prüfen
      if (ps.hand.indexOf(CARD_NAME) < 0) return;

      // „You may increase this Artifact's Cost by 3 …"
      let zusatz = 0;
      if (engine._rxCanAfford(ps, cost + EXTRA, CARD_NAME) && !engine.goldSpendBlocked(pi)) {
        const zu = await engine.promptGeneric(pi, {
          type: 'confirm', title: CARD_NAME,
          message: `Spend ${EXTRA} Gold extra so your opponent cannot react to ${CARD_NAME}?`,
          confirmLabel: `📸 Close it! (${EXTRA}G)`, cancelLabel: 'No', cancellable: true,
          gerrymanderEligible: true,
        });
        if (engine._confirmSaidYes(zu)) zusatz = EXTRA;
      }
      if (ps.hand.indexOf(CARD_NAME) < 0) return;

      const rxCast = engine._rxCastPlan(ps, CARD_NAME, script);
      if (!rxCast) return;
      // Einsetzen wie jede Hand-Reaction (Flug, Ablage, Kosten, Aufdecken); der Gegner darf der Kamera ihrerseits mit einer Kamera/Front Soldier
      // begegnen – außer mit dem +3-Gold-Aufschlag.
      const ok = await engine._rxHandkarteEinsetzen(pi, CARD_NAME, script, rxCast, {
        zusatzKosten: zusatz, ohneReaktion: zusatz > 0, sourceOwner: ctx.reactionOwner,
      });
      if (!ok) return;                                                      // die Kamera selbst wurde negiert

      engine._broadcastEvent('camera_flash', { owner: pi });
      await engine._delay(600);
      ctx.setFlag('_reactionNegated', true);
      ctx.setFlag('_reactionNegatedBy', CARD_NAME);
      if (zusatz) engine.log('chain_closed', { card: CARD_NAME, player: ps.username, extraCost: zusatz });
      engine.sync();
    },
  },

  /**
   * Camera only reacts to opponent's reactions in the chain.
   * chainCtx.chain must have a non-initial link owned by the opponent.
   */
  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;
    const lastLink = chainCtx.chain[chainCtx.chain.length - 1];
    // Must be a non-initial card owned by the opponent
    return !lastLink.isInitialCard && lastLink.owner !== pi;
  },

  // Not proactively activatable (reaction only)
  canActivate: () => false,
  getValidTargets: () => [],
  targetingConfig: {
    description: 'Cute Camera can only be activated as a Reaction.',
    confirmLabel: 'OK',
    confirmClass: 'btn-info',
    cancellable: true,
    alwaysConfirmable: true,
  },
  validateSelection: () => true,

  /**
   * Called after Camera is added to the chain but before resolution.
   * Prompts owner to pay 3G extra to close the chain.
   */
  onChainAdd: async (engine, pi, chain, myLink) => {
    const ps = engine.gs.players[pi];
    if (!ps) return;

    // Check if player can afford the 3G chain-close cost
    if ((ps.gold || 0) >= 3 && !engine.goldSpendBlocked(pi)) {   // G1 (A09-11): Goldsperre
      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: 'Cute Camera',
        message: 'Spend 3 Gold extra to prevent further reactions?',
        confirmLabel: '📸 Close it! (3G)',
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true, // True "you may" — opt-in 3G chain close.
      });

      if (confirmed) {
        await engine._payCardCost(pi, 3);
        myLink.chainClosed = true;
        engine.log('chain_closed', { card: 'Cute Camera', player: ps.username, extraCost: 3 });
        engine.sync();
      }
    }
  },

  /**
   * Resolve: negate the chain link directly below this one.
   * Also plays the camera flash animation.
   */
  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;

    // Play camera flash on all screens
    engine._broadcastEvent('camera_flash', { owner: pi });
    await engine._delay(600);

    // Negate the link below me
    if (myIndex > 0) {
      engine.negateChainLink(chain, myIndex - 1);
      engine.log('reaction_negated', {
        negator: 'Cute Camera',
        negated: chain[myIndex - 1]?.cardName,
        owner: pi,
      });
    }
  },
};
