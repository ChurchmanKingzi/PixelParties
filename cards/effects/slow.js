// ═══════════════════════════════════════════
//  CARD EFFECT: "Slow"
//  Spell (Decay Magic Lv1, Normal)
//
//  Your opponent chooses and discards:
//    Lv1: 2 cards
//    Lv2: 3 cards
//    Lv3: 4 cards
//
//  Afterwards: the caster cannot interact with
//  the opponent's hand for the rest of the turn
//  (ps.oppHandLocked = true).
//
//  Cannot be played if oppHandLocked is already
//  set (covers re-casting and other hand-lock
//  effects sharing the same flag).
//
//  Animation: purple dark-magic sparkles burst
//  over the opponent's hand for each card
//  discarded (slow_dark_magic event).
// ═══════════════════════════════════════════

const CARD_NAME = 'Slow';

/** Number of forced discards per Decay Magic level. */
const DISCARD_BY_LEVEL = { 1: 2, 2: 3, 3: 4 };

module.exports = {
  // ★ Welle 12 (B-06, Al: „Eine Karte, deren Effekt komplett nutzlos wäre, ist nicht spielbar."): trifft NUR den Gegner — gegen den durch die
  // Erste-Runden-Immunität geschützten Spieler unspielbar (Karte bleibt auf der Hand, keine Aktion/Kosten; `engine.ersterZugGeschuetzt`).
  blockedByFirstTurnProtection: true,
  cpuMeta: { scalesWithSchool: 'Decay Magic' },
  /** Block play if the caster's opp-hand interaction is already locked. */
  spellPlayCondition(gs, playerIdx) {
    // W16g (S03-02): EINE Regel („cannot interact with your opponent's hand“), zwei Flaggen — beide lesen (Spreading Rumor sperrt Slow).
    return !gs.players[playerIdx]?.oppHandLocked && gs.players[playerIdx]?._oppHandInteractionLockedTurn !== gs.turn;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps      = gs.players[pi];
      const oppIdx  = engine.opponentOf(pi);
      const oppPs   = gs.players[oppIdx];

      if (!ps || !oppPs) return;

      // Caster-aware Decay Magic level — honours engine overrides
      // (Demon's Gate "as if Decay Magic 3").
      const decayLevel  = engine.effectiveSchoolLevelForCaster('Decay Magic', pi, heroIdx);
      const discardCount = DISCARD_BY_LEVEL[Math.min(decayLevel, 3)] ?? DISCARD_BY_LEVEL[1];

      // ★ W74c: EIN Abwurf-Stapel statt einer Einzelabfrage je Karte — Ambush the Scout und Boris werden einmal gefragt (vorher je Karte: Boris fragte
      // zweimal, ein Ambush-Fenster je Karte). Das violette Dunkelmagie-Aufblitzen läuft einmal zu Beginn.
      if ((oppPs.hand || []).length > 0) {
        // Purple dark-magic burst over the opponent's hand
        engine._broadcastEvent('slow_dark_magic', { ownerIdx: oppIdx });
        await engine._delay(300);

        await engine.actionPromptForceDiscard(oppIdx, discardCount, {
          title: CARD_NAME,
          source: CARD_NAME,
          description: `Slow — discard ${discardCount} card${discardCount > 1 ? 's' : ''}.`,
        });

        await engine._delay(200);
      }

      // Lock: no more hand interaction with the opponent this turn
      ps.oppHandLocked = true;
      ps._oppHandInteractionLockedTurn = gs.turn;   // W16g (S03-02): auch fuer Spreading Rumor, Rain of Spores, Accusation, Gather Intel, Live Show, Letter of Misinformations

      engine.log('slow_resolved', {
        player: ps.username, discards: discardCount, decayLevel,
      });
      engine.sync();
    },
  },
};
