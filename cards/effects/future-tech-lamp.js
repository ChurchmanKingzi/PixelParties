// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Lamp"
//  Artifact (Normal, Cost 4)
//
//  "Look at as many of the top cards of your deck as there are
//   \"Future Tech Lamp\" cards in your discard pile +1. Add all
//   Artifacts you find among those cards to your hand and shuffle the
//   rest of the cards back into your deck."
//
//  ── Die einzige Karte des Archetyps mit „+1" ──
//  Sie funktioniert also auch mit leerer Ablage: eine Karte anschauen.
//  Das „+1" steht ausdrücklich im Text und ist KEIN Selbstzählen (Als
//  Ruling 21.8.) — die Lampe zählt sich nicht mit, der Text gibt ihr
//  schlicht einen Grundwert.
//
//  ── „shuffle the rest back" ──
//  Wörtlich: die Nicht-Artefakte gehen zurück ins Deck und das Deck
//  wird gemischt. Sie bleiben also NICHT oben liegen — die Lampe ist
//  kein Deckstapel-Sortierer, sondern ein Artefakt-Filter.
//
//  ── Ablauf auf dem Bildschirm (Als Vorgabe 21.8.) ──
//  Das Show-Cards-Protokoll von Cute Cat: die Karten fliegen VERDECKT
//  aus dem Deck, halten in der Bildschirmmitte, werden dort UMGEDREHT
//  und fliegen weiter — hier aber nicht in die Ablage, sondern die
//  Artefakte zur HAND und der Rest zurueck ins DECK. Dafuer nimmt
//  `mill_center_reveal` das neue Feld `dest`.
//
//  Der Zustand wird ueber `actionAddCardFromDeckToHand` nachgezogen
//  (damit `ON_CARD_ADDED_TO_HAND` feuert), aber mit unterdruecktem
//  Eigenflug — sonst liefen zwei Animationen fuer dieselbe Karte —
//  und ERST NACH der Landung, Karte fuer Karte.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Lamp';
const GRUND = 1;
/** Flugdauer je Karte im Show-Cards-Protokoll (Deck → Mitte → Ziel). */
const SCHAU_MS = 1100;

module.exports = {
  isTargetingArtifact: false,
  blockedByHandLock: true,

  canActivate(gs, pi) {
    return (gs.players[pi]?.mainDeck || []).length > 0;
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    const wieViele = GRUND + zaehleInAblage(gs, pi, CARD_NAME);
    const oben = (ps.mainDeck || []).slice(0, wieViele);
    if (oben.length === 0) return { cancelled: true };

    const db = engine._getCardDB();
    const artefakte = oben.filter(n => {
      const cd = db[n];
      return cd && hasCardType(cd, 'Artifact');
    });

    engine.log('ft_lamp', {
      player: ps.username, looked: oben.length, found: artefakte.length,
      cards: artefakte,
    });

    // ── Das SHOW-CARDS-PROTOKOLL (Als Vorgabe 21.8.) ──
    // Genau der Ablauf, den Cute Cat benutzt: die Karten fliegen
    // verdeckt aus dem Deck, bleiben in der Bildschirmmitte stehen,
    // werden dort umgedreht — und fliegen dann weiter. Nur ist das
    // Ziel hier NICHT die Ablage, sondern je nach Karte die Hand oder
    // zurueck ins Deck. Dafuer nimmt `mill_center_reveal` seit v530
    // ein `dest`-Feld.
    //
    // ── EINE Karte nach der anderen (Als Rueckmeldung 21.8.) ──
    // Jedes Artefakt fliegt EINZELN, und die Handkarte entsteht erst,
    // wenn der Flug gelandet ist — genau wie beim normalen Ziehen.
    // Deshalb: Flug losschicken, volle Flugdauer abwarten, DANN
    // umbuchen. Fliegt die Karte, waehrend sie schon in der Hand
    // liegt, sieht man sie doppelt.
    //
    // Nebeneffekt, der so gewollt ist: weil die Hand beim Start des
    // Fluges noch die alte Groesse hat, projiziert der Client den
    // Landepunkt auf den NEUEN letzten Handslot — die Karte kommt dort
    // an, wo sie danach liegt.
    const rest = oben.filter(n => !artefakte.includes(n));

    for (const name of artefakte) {
      engine._broadcastEvent('mill_center_reveal', {
        owner: pi, cardNames: [name], dest: 'hand', revealMs: SCHAU_MS,
      });
      await engine._delay(SCHAU_MS);
      await engine.actionAddCardFromDeckToHand(pi, name, {
        source: CARD_NAME, reveal: false, _skipFlight: true,
      });
      engine.sync();
    }

    // Der Rest geht zurueck ins Deck — als eine Welle, die Karten sind
    // ja ununterscheidbar, sobald sie wieder im Stapel stecken.
    if (rest.length > 0) {
      engine._broadcastEvent('mill_center_reveal', {
        owner: pi, cardNames: rest, dest: 'deck', revealMs: SCHAU_MS,
      });
      await engine._delay(rest.length * SCHAU_MS + 150);
      // „shuffle the rest back into your deck": die Nicht-Artefakte
      // sind nie aus dem Deck heraus — einmal mischen genuegt.
      engine.shuffleDeck(pi, 'main');
    }
    engine.sync();
    return { ok: true };
  },
};
