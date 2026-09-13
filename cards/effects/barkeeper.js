// ═══════════════════════════════════════════
//  CARD EFFECT: „Barkeeper"
//  Creature (Summoning Magic Lv 0, 30 HP, PP WAW)
//
//  „When you summon this Creature, you may add copies of \"Beer\" from
//   outside the game to your hand until your hand contains 7 cards."
//
//  (Kompletter Effekttausch — Als Vorgabe 12.9., in cards.json.)
//
//  BAUART
//  ──────
//  • Ausloeser `onPlay` mit Selbsttest, Zonenpruefung und dem
//    `isPlacement`-Riegel: PLATZIEREN ist keine BESCHWOERUNG (Muster
//    Knight of Kings, Wire Hatchling, Gravedigger).
//
//  • ★ „FROM OUTSIDE THE GAME" — die Karten kommen aus KEINEM Stapel.
//    Also auch KEIN Flug: `card_reveal` (beide Spieler sehen, WAS
//    kommt), `hand_card_materialize` (Leuchten und Funken an der Hand,
//    v995), dann `hand.push` + `_trackCard`. Bewusst NICHT
//    `actionAddCardFromDeckToHand` — die Karte lag nie in einem Deck,
//    und der Stapel-Weg wuerde sie dort suchen.
//
//  • ★ „UNTIL YOUR HAND CONTAINS 7 CARDS" ist ein AUFFUELLEN, keine
//    feste Zahl: gezaehlt wird die Hand NACH der Beschwoerung (der
//    Barkeeper selbst ist da schon draussen). Sind es 7 oder mehr,
//    passiert nichts und es wird auch nicht gefragt.
//
//  • „you may" — eine Rueckfrage, kein Zwang. Sieben Handkarten sind
//    nicht immer gut: wer eine Handkarten-Sperre oder einen
//    Abwurf-Zwang gegen sich hat, will vielleicht nicht.
// ═══════════════════════════════════════════

const CARD_NAME = 'Barkeeper';
const NACHSCHUB = 'Beer';
const ZIEL_HANDGROESSE = 7;

module.exports = {
  // Der „you may"-Confirm ist abbrechbar; ohne Antwort bricht die
  // Engine ihn fuer die CPU pauschal ab (Befund v828). Gratis-Karten
  // nimmt sie mit — Beer heilt Statuseffekte und kostet nur, wenn sie
  // wirklich gespielt wird.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'confirm') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    return { confirmed: true };
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      if (ctx.playedCard?.id !== ctx.card?.id || ctx.card.zone !== 'support') return;
      if (ctx.card.counters?.isPlacement) return;        // platziert ≠ beschworen

      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      const fehlen = ZIEL_HANDGROESSE - (ps.hand || []).length;
      if (fehlen <= 0) return;                           // Hand ist schon voll genug

      const ja = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Add ${fehlen} × ${NACHSCHUB} from outside the game to fill your hand to ${ZIEL_HANDGROESSE}?`,
        showCard: CARD_NAME,
        confirmLabel: `🍺 Pour ${fehlen}`,
        cancelLabel: 'No thanks',
        cancellable: true,
      });
      const bestaetigt = typeof engine._confirmSaidYes === 'function'
        ? engine._confirmSaidYes(ja)
        : !!(ja && !ja.cancelled);
      if (!bestaetigt) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      // ★ KEIN FLUG (v995, Als Vorgabe 12.9.): die Karte kommt von
      // AUSSERHALB des Spiels und hat keinen Herkunftsort. Sie erscheint
      // in der Hand — `hand_card_materialize` zeigt Leuchten und Funken
      // und verbraucht zugleich die Gutschrift, mit der der
      // Handzuwachs-Erkenner sonst einen Flug „aus der Gegnerhand"
      // erfindet (dieselbe Klasse wie beim Deck-Peek, v969).
      let gezapft = 0;
      while ((ps.hand || []).length < ZIEL_HANDGROESSE) {
        engine._broadcastEvent('card_reveal', { cardName: NACHSCHUB });
        engine._broadcastEvent('hand_card_materialize', { cardName: NACHSCHUB, playerIdx: pi, count: 1 });
        ps.hand.push(NACHSCHUB);
        engine._trackCard(NACHSCHUB, pi, 'hand');
        gezapft++;
        engine.sync();
        await engine._delay(220);
      }

      engine.log('barkeeper_round', {
        player: ps.username, count: gezapft, card: NACHSCHUB,
      });
      engine.sync();
    },
  },
};
