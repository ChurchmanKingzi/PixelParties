// ═══════════════════════════════════════════
//  CARD EFFECT: "Spatial Crevice"
//  Spell (Area, Magic Arts Lv1)
//
//  "You may control up to 3 different Areas. At
//   the end of each turn, the turn player may
//   search their deck for an Area, reveal it and
//   add it to their hand."
//
//  ── ZWEI HAELFTEN, ZWEI BESONDERHEITEN ────────
//  ① Das Limit ist KEIN Effekt dieser Datei,
//     sondern der generische Engine-Vertrag
//     `areaLimit` (v1050). Die Engine nimmt den
//     HOECHSTWERT ueber alle kontrollierten Areas,
//     nicht die Summe — zwei Crevices ergeben also
//     weiter 3.
//
//     ★ "DIFFERENT" (Als Praezisierung 14.9.): zwei
//     Kopien DERSELBEN Area sind nie zugleich
//     kontrollierbar. Der Riegel sitzt generisch in
//     `canPlaceAnotherArea`, nicht hier — beim
//     Grundlimit 1 aendert er nichts, und jede
//     kuenftige Limit-Karte erbt ihn von selbst.
//
//     ★ Crevice zaehlt sich selbst mit (Als Ruling
//     14.9.): effektiv zwei "echte" Areas plus
//     Crevice. Das ergibt sich von allein, weil
//     die Engine die Zonengroesse gegen das Limit
//     prueft und Crevice in der Zone liegt.
//
//     ★ Verlaesst Crevice das Brett, raeumt
//     `enforceAreaLimit` den Ueberhang ab — der
//     BESITZER waehlt, was in die Ablage geht
//     (Als Ruling 14.9.). Der Aufruf haengt an
//     `removeArea`; der Leave-Hook unten deckt die
//     Wege ab, die daran vorbeilaufen.
//
//  ② "the TURN PLAYER" — nicht "you". Der Trigger
//     gehoert also dem Spieler, der gerade am Zug
//     ist, ganz gleich wem Crevice gehoert. Al
//     14.9. ausdruecklich: "es ist absolut
//     moeglich, dass der Gegner den Effekt nutzt".
//     Deshalb KEIN `cardOwner`-Filter hier, sondern
//     `gs.activePlayer`.
// ═══════════════════════════════════════════

const CARD_NAME = 'Spatial Crevice';

/** Traegt diese Karte den Untertyp "Area"? */
function istArea(cardData) {
  return (cardData?.subtype || '').toLowerCase() === 'area';
}

module.exports = {
  // 'hand' ist Pflicht, sonst feuert onPlay beim Spielen nicht
  // (check-areas erzwingt das — Lehre aus dem Pangaia-Fall).
  activeIn: ['hand', 'area'],

  // ★ Der generische Limit-Vertrag. Kein Kartenname in der Engine.
  areaLimit: 3,

  hooks: {
    onPlay: async (ctx) => {
      // Areas landen NICHT von selbst in der Zone — ohne `placeArea`
      // greift in jedem Spielpfad die Standard-Entsorgung Hand → Ablage
      // (Lehre aus dem Cottage-Fall v186).
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },

    /**
     * Die Suche am Rundenende. Laeuft fuer den ZUGSPIELER, nicht fuer
     * den Besitzer.
     *
     * Reihenfolge der Riegel, alle aus vorhandenen Vertraegen:
     *   • nur solange Crevice wirklich in der Area-Zone liegt;
     *   • `handLocked` / Stapel-Ausgangssperre pruefen wir nicht selbst
     *     nach — `actionAddCardFromDeckToHand` fizzelt dort von allein;
     *   • ohne Area im Deck gibt es nichts zu fragen, also auch keinen
     *     Prompt (eine Abfrage ohne Auswahl ist nur Zugverzoegerung).
     */
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'area') return;

      const pi = engine.gs.activePlayer;
      const ps = engine.gs.players[pi];
      if (!ps) return;
      if (ps.handLocked) return;

      const cardDB = engine._getCardDB();
      const anzahl = {};
      for (const name of (ps.mainDeck || [])) {
        if (!istArea(cardDB[name])) continue;
        anzahl[name] = (anzahl[name] || 0) + 1;
      }
      const galerie = Object.entries(anzahl)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'deck', count }));
      if (galerie.length === 0) return;

      // „may" — erst fragen. Der generische Entscheidungs-Kanal
      // (`_decision-log`) zeichnet diese Abfrage je Karte auf; ein
      // deckweiter Rueckfall waere laut Als Ruling 24.8. ausdruecklich
      // falsch, weil verschiedene „you may" gegenlaeufige Regeln haben.
      const ja = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        showCard: CARD_NAME,
        message: 'Search your deck for an Area and add it to your hand?',
        confirmLabel: '🔍 Search', cancelLabel: 'No thanks',
        cancellable: true,
      });
      if (!ja) return;

      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        searchToHand: true, searchPile: 'deck',   // v1121
        cards: galerie,
        title: CARD_NAME,
        description: 'Choose an Area to add to your hand.',
        cancellable: false,
      });
      if (!wahl || !wahl.cardName) return;

      await engine.actionAddCardFromDeckToHand(pi, wahl.cardName, {
        source: CARD_NAME,
        reveal: true,
        searchSpec: { label: 'Area', filter: (cd) => istArea(cd) },
      });
      engine.sync();
    },

    /**
     * ★ HIER STAND EIN RUECKFALL — und er war stiller Schrott (v1055,
     * Als Befund 14.9.: „ich werde NICHT aufgefordert zu waehlen").
     *
     * Zwei Fehler auf einmal, beide lehrreich:
     *   ① Der Leave-Hook feuert VOR dem Zonenwechsel. Die Karte stand
     *      also noch in `areaZones`, das Limit war noch 3, und die
     *      Pruefung „zu viele?" sagte korrekt nein.
     *   ② Der Ausweg dagegen — `queueMicrotask` plus ein Promise ohne
     *      `await` und mit leerem `catch` — lief immer noch VOR den
     *      offenen `await`s des Umzugs, und haette er geworfen, haette
     *      es niemand erfahren.
     *
     * Beide Funnels sind jetzt engine-seitig gedeckt: `removeArea` am
     * Ende und `actionMoveCard` fuer den Zerstoerungs-Weg. Ein
     * Karten-Rueckfall ist damit ueberfluessig — und ein abgekoppelter
     * async-Aufruf in einem Hook ist genau die Bauform, die Fehler
     * verschluckt statt sie zu zeigen.
     */
  },

  /**
   * CPU-Antwort auf das „may" (Als Ruling 24.8.: je Karte, kein
   * deckweiter Kanal).
   *
   * Ja, ausser die Suche waere der Weg ins Deckout: der Griff nimmt dem
   * Deck genau wie ein Draw eine Karte. Dieselbe Vorsicht wie beim
   * optionalen Ziehen — unter der Restdeck-Schwelle lieber verzichten.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type !== 'confirm') return undefined;
    // Der Prompt geht immer an den Zugspieler — und im CPU-Zug ist das
    // die CPU selbst.
    const pi = engine.gs.activePlayer;
    const rest = (engine.gs.players?.[pi]?.mainDeck || []).length;
    return { confirmed: rest > 3 };
  },
};
