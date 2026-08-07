// ═══════════════════════════════════════════
//  CARD EFFECT: "Doom Prophecy"
//  Spell (Normal), Lv1, Decay Magic, PP MSAZ
//
//  "Search your deck for a 'Doom Clock' and place it
//   into your Area Zone. If the user has at least
//   Decay Magic 2, you may place it into your
//   opponent's Area Zone instead. Then, place 3 Doom
//   Counters onto it. Immediately end your turn
//   afterwards."
//
//  Als Rulings (5.8.)
//  ──────────────────
//  • Liegt KEINE Doom Clock im Deck, fizzelt die
//    Karte KOMPLETT — auch der Zug endet dann nicht.
//  • Zugende: offene Phasen werden uebersprungen,
//    eine laufende Kette laeuft aber zu Ende. Genau
//    das leistet Terrors Mechanik
//    (`gs._terrorForceEndTurn`): der Server wartet in
//    sendGameState, bis Prompt, Effekt und Kette
//    durch sind, und faehrt dann die End Phase.
// ═══════════════════════════════════════════

const D = require('./_doom-clock-shared');

const CARD_NAME = 'Doom Prophecy';
const START_COUNTERS = 3;

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const ps = gs.players[pi];

      const idx = (ps.mainDeck || []).indexOf(D.CLOCK_NAME);
      if (idx < 0) {
        // Kein Ziel im Deck -> die Karte fizzelt komplett, der Zug
        // laeuft normal weiter (Als Ruling).
        engine.log('doom_prophecy_fizzle', { player: ps.username });
        engine.sync();
        return;
      }

      // Gegnerische Area-Zone nur mit Decay Magic 2 auf dem Anwender.
      let ziel = pi;
      const decayLv = engine.countAbilitiesForSchool(
        'Decay Magic', ps.abilityZones?.[ctx.cardHeroIdx] || [],
      );
      if (decayLv >= 2) {
        const wahl = await engine.promptGeneric(pi, {
          type: 'optionPicker',
          title: CARD_NAME,
          message: `Into which Area Zone? (Decay Magic ${decayLv})`,
          options: [
            { id: 'self', label: '🏠 My Area Zone', color: '#44aaff' },
            { id: 'opp',  label: "☠️ Opponent's Area Zone", color: '#e04040' },
          ],
          cancellable: false,
        });
        if (wahl?.optionId === 'opp') ziel = oi;
      }

      ps.mainDeck.splice(idx, 1);
      const inst = engine._trackCard(D.CLOCK_NAME, ziel, 'deck');
      await engine.placeArea(ziel, inst);
      engine.log('doom_prophecy_place', {
        player: ps.username,
        into: gs.players[ziel]?.username,
        decayLevel: decayLv,
      });
      engine.shuffleDeck?.(pi);
      engine.sync();

      // Die drei Startzaehler legt der ANWENDER — bei nur 3 Stueck kann
      // das noch niemanden das Spiel kosten, der Weg ist aber derselbe
      // wie ueberall (Hook feuert, Grenze wird geprueft).
      for (let n = 0; n < START_COUNTERS; n++) {
        const ende = await D.placeCounter(engine, inst, pi, { sourceName: CARD_NAME });
        if (ende) return;
      }

      // Zug sofort beenden — Terror-Mechanik: der Server wartet, bis
      // Prompts, Effekte und eine laufende Kette durch sind.
      gs._terrorForceEndTurn = pi;
      engine.log('doom_prophecy_end_turn', { player: ps.username });
      engine.sync();
    },
  },
};
