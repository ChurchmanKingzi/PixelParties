// ═══════════════════════════════════════════
//  CARD EFFECT: „Moonlight Butterfly"
//  Creature (Summoning Magic Lv 0, 10 HP, PP ART)
//
//  „At the end of your opponent's turn, you may add this Creature you
//   control back to your hand, and if you do, deal 150 damage to the
//   opponent's Hero in the same position as the corresponding Hero."
//
//  BAUART
//  ──────
//  • Ausloeser `onTurnEnd` mit `if (ctx.isMyTurn) return;` — es ist der
//    Zug des GEGNERS, der endet. Der Prompt laeuft damit im fremden Zug
//    und wird in `beginHumanWait`/`endHumanWait` geklammert, sonst
//    zaehlt die Bedenkzeit des Spielers gegen die Zug-Uhr.
//
//  • „the opponent's Hero in the same position as the corresponding
//    Hero": der Gegnerheld mit DEMSELBEN Index wie der Wirt des
//    Falters — die Spalte gegenueber. Steht dort kein lebender Held,
//    faellt nur der Schaden aus; die Ruecknahme ist trotzdem
//    geschehen („you MAY add … and IF YOU DO" — die Ruecknahme ist die
//    Bedingung, nicht der Schaden).
//
//  • Reihenfolge: erst zurueck auf die Hand, dann der Schlag. Der
//    Falter ist beim Schaden also nicht mehr auf dem Brett — die
//    Schadensquelle traegt deshalb nur Namen und Besitzer.
//
//  • Ruecknahme ueber `returnSupportCreatureToHand` (die eine Stelle,
//    die Zone raeumt, Flug sendet, `onCardLeaveZone` feuert und die
//    Instanz abmeldet). Sie nimmt seit v966 einen Animationstyp
//    entgegen — der Falter steigt ins MONDLICHT statt in Blasen.
//
//  • ANIMATION `moonlight_beam` (v966, Als Vorgabe): blaeuliches
//    Mondlicht, das von oben auf das Ziel faellt.
// ═══════════════════════════════════════════

const { returnSupportCreatureToHand } = require('./_deepsea-shared');

const CARD_NAME = 'Moonlight Butterfly';
const SCHADEN = 150;

module.exports = {
  activeIn: ['support'],

  // Der „you may"-Confirm ist abbrechbar; ohne Antwort bricht die
  // Engine ihn fuer die CPU pauschal ab (Befund v828). Sie nimmt den
  // Tausch: 150 Schaden gegen eine 10-HP-Kreatur, die zurueck auf die
  // Hand geht und erneut beschworen werden kann.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'confirm') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    return { confirmed: true };
  },

  hooks: {
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      if (ctx.isMyTurn) return;                       // nur am Ende des GEGNERzuges

      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const gs = engine.gs;
      const heroIdx = inst.heroIdx;

      // Wen traefe es? Fuer den Prompt-Text, nicht als Tor.
      const gegenueber = gs.players[oi]?.heroes?.[heroIdx];
      const zielText = (gegenueber?.name && gegenueber.hp > 0)
        ? `${gegenueber.name} takes ${SCHADEN} damage.`
        : 'No Hero stands opposite — no damage.';

      // ★ Prompt im Gegnerzug: Bedenkzeit ausklammern.
      engine.beginHumanWait?.();
      let antwort;
      try {
        antwort = await engine.promptGeneric(pi, {
          type: 'confirm',
          title: CARD_NAME,
          message: `Return ${CARD_NAME} to your hand? ${zielText}`,
          showCard: CARD_NAME,
          confirmLabel: '🌙 Fly back',
          cancelLabel: 'Stay',
          cancellable: true,
        });
      } finally {
        engine.endHumanWait?.();
      }
      const ja = typeof engine._confirmSaidYes === 'function'
        ? engine._confirmSaidYes(antwort)
        : !!(antwort && !antwort.cancelled);
      if (!ja) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      // ── Zurueck auf die Hand ────────────────────────────────────
      const zurueck = await returnSupportCreatureToHand(engine, inst, CARD_NAME, {
        animationType: 'moonlight_beam',
      });
      if (!zurueck?.returned) return;                 // z.B. Cardinal-Immunitaet

      // ── „and if you do": der Schlag gegenueber ──────────────────
      const ziel = gs.players[oi]?.heroes?.[heroIdx];
      if (!ziel?.name || ziel.hp <= 0) {
        engine.log('moonlight_butterfly', {
          player: gs.players[pi]?.username, target: null, amount: 0,
        });
        engine.sync();
        return;
      }

      engine._broadcastEvent('play_zone_animation', {
        type: 'moonlight_beam', owner: oi, heroIdx, zoneSlot: -1,
        duration: 1400,
      });
      await engine._delay(700);

      await engine.actionDealDamage(
        { name: CARD_NAME, owner: pi, heroIdx },
        ziel, SCHADEN, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );

      engine.log('moonlight_butterfly', {
        player: gs.players[pi]?.username, target: ziel.name, amount: SCHADEN,
      });
      engine.sync();
    },
  },
};
