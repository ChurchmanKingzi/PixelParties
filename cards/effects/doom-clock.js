// ═══════════════════════════════════════════
//  CARD EFFECT: "Doom Clock"
//  Spell (Area), Lv0, Destruction Magic, PP MBS1
//
//  "At the end of each turn, the turn player must put
//   1 Doom Counter onto this card. The first 4 times
//   every turn 1 or more targets are defeated, their
//   controller must place 1 Doom Counter onto this
//   card. The player that places the 20th Doom
//   Counter onto this card loses the game."
//
//  Als Rulings (5.8.)
//  ──────────────────
//  • Zwei Uhren koennen gleichzeitig liegen; am
//    Rundenende bekommt JEDE einen Counter vom
//    Zugspieler.
//  • Jede Uhr zaehlt EINZELN — erst der 20. auf
//    DIESER Uhr entscheidet.
//  • Die Besiegungs-Ausloesung zaehlt PRO ZUG
//    INSGESAMT (nicht je Spieler) und ist je
//    Ereignis EINE Ausloesung, also ein Counter je
//    Uhr — auch wenn mehrere Ziele gleichzeitig
//    fallen.
//
//  Der Zaehler `gs._doomDefeatTriggers` haengt am
//  SPIELZUSTAND, nicht an der Karte: er gilt fuer den
//  Zug als Ganzes und muss auch dann stimmen, wenn
//  waehrend des Zuges eine zweite Uhr dazukommt.
// ═══════════════════════════════════════════

const D = require('./_doom-clock-shared');

const CARD_NAME = 'Doom Clock';

module.exports = {
  hooks: {
    /**
     * Areas landen nicht von selbst im Slot — die Karte muss sich
     * selbst dorthin bringen (Cottage-Lehre v186). Beide Wachen sind
     * noetig, sonst platziert sie sich erneut, wenn eine FREMDE Karte
     * gespielt wird, waehrend sie schon liegt.
     */
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card?.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },

    /**
     * Rundenende: der ZUGSPIELER legt je einen Counter auf JEDE offene
     * Uhr. Der Hook feuert einmal pro Uhr-Instanz — damit nicht jede
     * Uhr die ganze Runde abarbeitet, macht das NUR die Uhr, die als
     * erste in der Liste steht.
     */
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      const uhren = D.getDoomClocks(engine);
      if (uhren[0]?.id !== ctx.card?.id) return;   // nur einmal je Zug

      const zugspieler = engine.gs.activePlayer;
      if (engine.spielerIstVonAreasAusgenommen(zugspieler)) return;   // W82 (Shipwrecked): der Zugspieler ist von Areas ausgenommen — kein Counter
      for (const uhr of uhren) {
        const ende = await D.placeCounter(engine, uhr, zugspieler, {
          sourceName: `${CARD_NAME} (Zugende)`,
        });
        if (ende) return;   // Spiel vorbei — keine weiteren Counter
      }
    },

    /**
     * Besiegungen. `onTargetsDefeated` (Sammel-Hook, W16b: Kreaturen UND
     * Helden — „targets", A01-pollution-06; Vorläufer `onCreaturesDefeated`
     * kannte nur Kreaturen) liefert die in EINEM
     * Vorgang besiegten Ziele EINMAL; die ersten vier solcher Ereignisse
     * pro Zug legen je einen Counter auf jede Uhr.
     *
     * "their controller" = der Kontrolleur der besiegten Ziele. Fallen
     * Ziele BEIDER Spieler in einem Ereignis, ist es laut Ruling
     * trotzdem EINE Ausloesung — den Counter legt dann der Spieler,
     * der die meisten Ziele verloren hat; bei Gleichstand der
     * Zugspieler.
     */
    onTargetsDefeated: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const uhren = D.getDoomClocks(engine);
      if (uhren[0]?.id !== ctx.card?.id) return;   // nur einmal je Ereignis

      const defeated = ctx.defeated || [];
      if (defeated.length === 0) return;
      // Ist die Partie schon entschieden (z. B. letzter Held eines Archer-Schusses, Welle 9), legt die Uhr nichts mehr.
      if (gs.result || gs._endGameLaeuft) return;

      const bisher = gs._doomDefeatTriggers || 0;
      if (bisher >= D.DEFEAT_TRIGGERS_PER_TURN) return;
      gs._doomDefeatTriggers = bisher + 1;

      // "their controller" = wer die besiegten Ziele kontrollierte; bei
      // Verlusten beider Seiten die meisten, bei Gleichstand der Zugspieler.
      const verluste = {};
      for (const d of defeated) {
        const k = d.controller ?? d.owner ?? gs.activePlayer;
        verluste[k] = (verluste[k] || 0) + 1;
      }
      let verlierer = gs.activePlayer;
      let meiste = verluste[verlierer] || 0;
      for (const k of Object.keys(verluste)) {
        if (verluste[k] > meiste) { verlierer = Number(k); meiste = verluste[k]; }
      }

      if (engine.spielerIstVonAreasAusgenommen(verlierer)) return;   // W82 (Shipwrecked): dessen Kontrolleur ist von Areas ausgenommen — kein Counter
      for (const uhr of uhren) {
        const ende = await D.placeCounter(engine, uhr, verlierer, {
          sourceName: `${CARD_NAME} (Besiegung ${gs._doomDefeatTriggers}/${D.DEFEAT_TRIGGERS_PER_TURN})`,
        });
        if (ende) return;
      }
    },

    /** Zaehler der Besiegungs-Ausloesungen ist PRO ZUG. */
    onTurnStart: async (ctx) => {
      delete ctx._engine.gs._doomDefeatTriggers;
    },
  },
};
