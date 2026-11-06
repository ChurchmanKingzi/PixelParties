// ═══════════════════════════════════════════
//  CARD EFFECT: "Willy, the Valiant Leprechaun"
//  Hero — At the end of your first turn, choose:
//  Draw 5 cards OR Gain 30 Gold.
//  No hand size limit until the start of your second turn (W16f: bis einschliesslich der Gegnerrunde dazwischen).
//  ★ W69a (Al, 23.10.2026: „Nein, sie sollen nur 'echte' eigene Züge zählen!"): „first"/„second turn" sind der erste/zweite TATSAECHLICH gespielte
//  eigene Zug (`engine.echterEigenerZugIndex` / `echteEigeneZuegeBis`); `_willyFirstTurn` ist nur die Zugnummer, ab der gezaehlt wird (der
//  nominell erste Zug). Wird der nominell erste Zug uebersprungen (Hand-of-Death-Rider im ersten Zug des Startspielers), ist der naechste echte Zug der erste.
// ═══════════════════════════════════════════

// Als Ruling 17.8. ("Tuscan Aristocrat"): eine Gold-OPTION faellt weg,
// solange der Gewinn gesperrt ist — statt eine Wahl anzubieten, die
// nichts bringt. Auslegung in `_gold-block-shared.js`.
const { goldGainWouldBeBlocked } = require('./_gold-block-shared');

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  // CPU valuation hook. Once Willy's first-turn Draw 5 / Gain 30 has
  // fired, Willy is essentially a vanilla body — his only real
  // contribution to the team was that one-time payout. Marks him as
  // a low-priority target so the CPU doesn't waste big spells on him.
  cpuMeta: {
    oneShotEffectSpent: (_engine, _pi, _hi, hero) => !!hero?._willyEffectUsed,
  },

  // Gerrymander redirect — 5 cards has higher long-term value than 30
  // gold (≈ 6 gold per card via Wisdom). Pick `gold` to deny opp the
  // bigger payoff.
  cpuGerrymanderResponse(/* engine, gerryOwnerPi, promptData */) {
    return { optionId: 'gold' };
  },

  /**
   * "You do not have a hand size limit until the start of your second turn." (W16f: bis einschliesslich der Gegnerrunde dazwischen;
   * 2 Spieler: firstTurn + 1). Die Engine fragt nur lebende, nicht stillgelegte Helden (`_isHeroEffectSilenced`, Welle 7).
   */
  bypassHandLimit(engine, pi, hero) {
    const first = hero?._willyFirstTurn;
    if (first == null) return false;
    if ((engine.gs.turn || 1) < first) return true;   // vor dem nominell ersten Zug (Aufbau)
    return engine.echteEigeneZuegeBis(pi, engine.gs.turn || 1, first) < 2;   // bis zum BEGINN des zweiten echten eigenen Zuges
  },

  hooks: {
    /**
     * On game start: record the owner's first turn number
     * and set the hand-limit bypass flag.
     */
    onGameStart: (ctx) => {
      const gs = ctx.gameState;
      // Styx 28.9.: „you" = Kontrolleur; Willy selbst auf der Brettseite.
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const hero = ctx.attachedHero ?? gs.players[ctx.cardHeroOwner ?? ctx.cardOriginalOwner]?.heroes?.[ctx.cardHeroIdx];
      if (!hero || !ps) return;

      // Compute first turn number: player who goes first = turn 1, second = turn 2
      const firstTurn = (gs.activePlayer === pi) ? (gs.turn || 1) : (gs.turn || 1) + 1;
      hero._willyFirstTurn = firstTurn;
      hero._willyEffectUsed = false;

      // W17a (H04-08, Al 19.10.2026): die handlimitfreie Phase ist KEIN Spielerzustand mehr, sondern haengt an Willys aktuellem Zustand
      // (`bypassHandLimit` unten, von `_shouldBypassHandLimit` gelesen): stirbt Willy oder ist er gefroren/betaeubt/negiert, gilt das
      // Handlimit sofort wieder; endet das vor dem Start seines zweiten Zuges, gilt die Freiheit bis dahin wieder.
    },

    /**
     * End Phase of owner's first turn: prompt for Draw 5 or Gain 30 Gold.
     */
    onPhaseEnd: async (ctx) => {
      if (ctx.phaseIndex !== 5) return; // Only End Phase
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;   // Styx 28.9.: „you" = Kontrolleur
      const heroIdx = ctx.cardHeroIdx;
      const hero = ctx.attachedHero;
      if (!hero || hero._willyEffectUsed) return;
      if (gs.activePlayer !== pi) return; // Only on owner's turn
      if (engine.echterEigenerZugIndex(pi, gs.turn || 1, hero._willyFirstTurn) !== 1) return; // Only first (real) turn

      // Must be alive and not incapacitated
      if (hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      hero._willyEffectUsed = true;

      const ps = gs.players[pi];
      const oppIdx = engine.opponentOf(pi);

      // Reveal Willy to opponent
      const oppSid = gs.players[oppIdx]?.socketId;
      if (oppSid && engine.io) {
        engine.io.to(oppSid).emit('card_reveal', { cardName: 'Willy, the Valiant Leprechaun' });
      }
      await engine._delay(300);

      // Prompt for choice
      const choice = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: 'Willy, the Valiant Leprechaun',
        description: "Willy's Luck! Choose your reward:",
        options: [
          { id: 'draw', label: '🃏 Draw 5 Cards', description: 'Draw 5 cards from your deck.', color: '#4488ff' },
          // Gold-Option nur, wenn der Gewinn nicht gesperrt ist.
          ...(goldGainWouldBeBlocked(engine, pi)
            ? [] : [{ id: 'gold', label: '💰 Gain 30 Gold', description: 'Add 30 Gold to your treasury.', color: '#ffcc00' }]),
        ],
        cancellable: false,
        gerrymanderEligible: true, // 5 cards vs 30 gold are distinct mechanical effects.
      });

      const picked = choice?.optionId || 'draw';

      // Leprechaun animation on Willy's hero zone (plays BEFORE effect resolves)
      engine._broadcastEvent('willy_leprechaun', { owner: ctx.cardHeroOwner ?? pi, heroIdx });   // Brettseite
      await engine._delay(800);

      if (picked === 'draw') {
        // Draw 5 cards (engine handles one-by-one visual pacing)
        await engine.actionDrawCards(pi, 5);
        engine.log('willy_draw', { player: ps.username, count: 5 });
      } else {
        // Gain 30 Gold with sparkle animation
        await engine.actionGainGold(pi, 30);
        engine.log('willy_gold', { player: ps.username, amount: 30 });
        // Extra gold sparkle on the gold counter
        const goldSel = `[data-gold-player="${pi}"]`;
        engine._broadcastEvent('play_zone_animation', { type: 'gold_sparkle', selector: goldSel });
      }

      engine.sync();
    },
  },
};
