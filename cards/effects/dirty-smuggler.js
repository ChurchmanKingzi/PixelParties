// ═══════════════════════════════════════════
//  CARD EFFECT: "Dirty Smuggler"
//  Creature (Summoning Magic Lv 1, 50 HP) — Archetyp Smugglers
//
//  „Whenever your opponent draws 1 or more cards through an effect, you may
//   steal four times that much Gold. If your opponent has no Gold, draw twice
//   that many cards instead and then negate this Creature's effect for the
//   rest of the turn."
//
//  (Neuer Effekt — Als Vorgabe 2.10.: ×4 Gold bzw. ×2 Karten.)
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Hoert auf `onDraw` (je gezogener Karte); „1 or more cards" = EIN Ziehvorgang,
//    entprellt an `_drawBatch` (Muster Cute Meanie Melissa). „that much" = die
//    bestellte Menge (`_drawCount`). „Through an effect": der Rundenzug
//    (`_isResourceDraw`) zaehlt nicht. Nur Ziehvorgaenge des GEGNERS.
//  • „you may": Rueckfrage; CPU und Puzzle sagen ja.
//  • Gold: bis zu 4 × Menge stehlen (nur so viel, wie der Gegner hat). Hat der Gegner
//    schon KEIN Gold, wird nicht gestohlen, sondern 2 × Menge gezogen — und
//    die Creature ist fuer den Rest des Zuges negiert (Ablauf am Beginn des naechsten
//    Zuges; eigenverursacht, ohne Immunitaets-Nachwirkung).
// ═══════════════════════════════════════════

const CARD_NAME = 'Dirty Smuggler';
const GOLD_FAKTOR = 4;
const KARTEN_FAKTOR = 2;

module.exports = {
  activeIn: ['support'],

  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'confirm') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    return { confirmed: true };
  },

  hooks: {
    onDraw: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      const pi = ctx.cardOwner;
      if (!inst || inst.zone !== 'support' || inst.faceDown) return;
      if (ctx.playerIdx === pi) return;              // der GEGNER muss ziehen
      if (ctx._isResourceDraw) return;               // „through an effect"
      // Ein Ziehvorgang = eine Antwort (je Smuggler).
      const batch = ctx._drawBatch;
      if (batch != null) {
        if (inst.counters?._smugglerBatch === batch) return;
        inst.counters = inst.counters || {};
        inst.counters._smugglerBatch = batch;
      }
      const menge = Math.max(1, ctx._drawCount || 1);
      const ps = gs.players[pi];
      const opp = gs.players[ctx.playerIdx];
      if (!ps || !opp) return;
      const keinGold = (opp.gold || 0) <= 0;
      const gold = Math.min(GOLD_FAKTOR * menge, Math.max(0, opp.gold || 0));
      if (!keinGold && gs.firstTurnProtectedPlayer === ctx.playerIdx) return;   // Erstrunden-Schonung: kein Diebstahl moeglich
      const karten = KARTEN_FAKTOR * menge;
      if (keinGold && (ps.mainDeck || []).length === 0) return;

      const ja = await engine.promptGeneric(pi, {
        type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
        message: keinGold
          ? `${opp.username || 'Your opponent'} drew ${menge} via an effect and has no Gold — draw ${karten} card${karten === 1 ? '' : 's'} instead? (${CARD_NAME} is then negated for the rest of the turn.)`
          : `${opp.username || 'Your opponent'} drew ${menge} via an effect — steal ${gold} Gold?`,
        confirmLabel: keinGold ? `🃏 Draw ${karten}` : `💰 Steal ${gold}`,
        cancelLabel: 'No',
        cancellable: true,
        _ownerIdx: pi,
      });
      if (!engine._confirmSaidYes(ja)) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      if (!keinGold) {
        // Kein Gold mehr nach der Zahlung des Zugs? Der Diebstahl nimmt, was da ist.
        await engine.actionStealGold(pi, gold, { sourceName: CARD_NAME });
        engine.log('dirty_smuggler_steal', { player: ps.username, gold });
      } else {
        await engine.actionDrawCards(pi, karten, { source: CARD_NAME });
        engine.log('dirty_smuggler_draw', { player: ps.username, cards: karten });
        // „negate this Creature's effect for the rest of the turn": Ablauf am Beginn des naechsten Zuges.
        const naechster = engine.opponentOf(gs.activePlayer);
        await engine.actionNegateCreature(inst, CARD_NAME, {
          selfInflicted: true,
          expiresAtTurn: gs.turn + 1,
          expiresForPlayer: naechster,
        });
      }
      engine.sync();
    },
  },
};
