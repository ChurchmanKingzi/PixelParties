// ═══════════════════════════════════════════
//  CARD EFFECT: "Traveler from the Future"
//  Creature (Normal, Lv 0, 50 HP, Summoning Magic) — Mini-Archetyp
//
//  „When you draw this card as part of your starting hand: You may
//   immediately summon it as an additional Action. While you control this
//   Creature: All cards you draw during your Resource Phase count as being
//   part of your starting hand."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Startblatt-Effekt (siehe Glimpse of the Future): die Beschwoerung laeuft
//    ueber die normale Zusatzaktions-Abfrage (`performImmediateActionAnyHero`,
//    nur diese Kreatur, abbrechbar) — wie bei Aggressive Town Guard braucht
//    sie einen Helden mit freiem, nicht gesperrten Support-Platz. Ohne
//    passenden Platz entfaellt das Angebot still.
//  • Passiv: solange ich sie kontrolliere, zaehlt JEDE Karte, die ich in
//    meiner Resource Phase ziehe (auch durch Effekte, die in der Phase
//    ziehen), als Teil der Starthand → ihr Startblatt-Effekt wird angeboten.
//    Ziehungen innerhalb einer laufenden Startblatt-Auswertung (z. B. Glimpse)
//    werden dort schon gezaehlt und hier uebersprungen (`_startingHandDepth`).
// ═══════════════════════════════════════════

const { PHASES } = require('./_hooks');

const CARD_NAME = 'Traveler from the Future';

module.exports = {
  activeIn: ['support'],

  /** CPU: beim Angebot die Kreatur waehlen ist Sache der Zusatzaktions-Abfrage. */
  startingHand: {
    async resolve(engine, pi) {
      const ps = engine.gs.players[pi];
      if (!ps || !(ps.hand || []).includes(CARD_NAME)) return null;
      const res = await engine.performImmediateActionAnyHero(pi, {
        title: CARD_NAME,
        description: `You may immediately summon "${CARD_NAME}" as an additional Action.`,
        allowedCardTypes: ['Creature'],
        cardNameFilter: (n) => n === CARD_NAME,
        skipAbilities: true, skipHeroEffects: true,
        autoArmCard: CARD_NAME,   // Helden/Zonen sofort anklickbar (Drag&Drop geht weiter)
        cancellable: true,
      });
      engine.log('traveler_from_the_future', { player: ps.username, summoned: !!res?.played });
      engine.sync();
      return null;
    },
  },

  hooks: {
    onDraw: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardController ?? ctx.cardOwner;
      if (ctx.playerIdx !== pi) return;
      // ★ TEMPORAER (zum Testen im Puzzle-Editor): JEDE gezogene Karte zaehlt als
      // Starthand. Urspruenglich nur die der eigenen Resource Phase:
      //   if (gs.activePlayer !== pi || gs.currentPhase !== PHASES.RESOURCE) return;
      // TODO(temp): wieder einschalten, sobald der Test durch ist.
      if ((engine._startingHandDepth || 0) > 0) return;     // schon in einer Auswertung
      const name = ctx.drawnCardName;
      if (!name) return;
      // Nur EIN Traveler wertet die Karte aus (mehrere Kopien wuerden sie sonst mehrfach anbieten).
      const meine = engine.cardInstances.filter(c => c.name === CARD_NAME && c.zone === 'support'
        && (c.controller ?? c.owner) === pi && !c.faceDown).map(c => c.id).sort();
      if (meine.length > 0 && meine[0] !== ctx.card.id) return;
      await engine.processStartingHandDraw(pi, [name], { window: 'resource' });
    },
  },
};
