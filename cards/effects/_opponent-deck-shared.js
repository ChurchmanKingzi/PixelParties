// ═══════════════════════════════════════════
//  GETEILTER HELFER: „Karte aus dem Gegnerdeck ziehen"  (v1106)
//
//  Anlass: „Love Shot" (Al 15.9.) zieht jetzt eine Karte aus dem
//  GEGNERDECK statt aus dem eigenen. Al ausdruecklich: „Draw from
//  opponent's deck existiert schon in Infiltration; achte darauf, dass
//  es z.B. Lillys Effekt triggert."
//
//  ★ GENAU DARUM STEHT ES HIER UND NICHT ZWEIMAL. Der Vorgang ist kein
//  Einzeiler, sondern eine Kette mit fuenf Gliedern, von denen jedes
//  einzeln vergessen werden kann:
//
//    ① der Flug-Broadcast MUSS VOR der Zustandsaenderung raus. Er
//       registriert auf dem Client die Maske, die den normalen
//       Zieh-Anim fuer genau diesen Handplatz unterdrueckt. Danach
//       gesendet, saehe die Karte aus, als kaeme sie aus dem EIGENEN
//       Deck;
//    ② Deck kuerzen und auf die Hand legen;
//    ③ `_tagHandCardOrigin` — die Karte kehrt am Ende zum urspruenglichen
//       Besitzer zurueck (v693);
//    ④ nur der EIGENEN Seite aufdecken: der Gegner kannte seine
//       Deckspitze nicht, er sieht bloss eine Karte gehen;
//    ⑤ `onCardTakenFromOpponent` — DER Hook, an dem „Lilly, the
//       Charming Infiltrator" haengt („Whenever you add a card from
//       your opponent's deck or hand to your hand, draw 1 card");
//    ⑥ bei `asDraw` zusaetzlich `onDraw` — der Hook von „Cute Meanie
//       Melissa" („Whenever your opponent DRAWS … via an effect").
//
//  Wer das nachbaut, vergisst ④ oder ⑤ — und der Fehler faellt nicht
//  auf, weil die Karte ja trotzdem auf der Hand landet. Lilly bliebe
//  einfach still.
// ═══════════════════════════════════════════

/**
 * Nimmt die oberste Karte aus dem Deck des Gegners auf die eigene Hand.
 *
 * @param {object} engine
 * @param {number} pi        wer nimmt
 * @param {object} [opts]
 * @param {string}  [opts.source]   Kartenname fuers Log
 * @param {number}  [opts.delay]    Flugdauer (Standard 700 ms)
 * @param {boolean} [opts.asDraw]   ★ zaehlt als ZIEHEN (siehe unten)
 * @returns {Promise<string|null>} der genommene Kartenname, oder null
 */
async function takeTopFromOpponentDeck(engine, pi, opts = {}) {
  const gs = engine.gs;
  const oi = pi === 0 ? 1 : 0;
  const ps = gs.players[pi];
  const ops = gs.players[oi];
  if (!ps || !ops) return null;
  if ((ops.mainDeck || []).length === 0) return null;

  const cardName = ops.mainDeck[0];

  // ① Flug ZUERST — siehe Kopf.
  engine._broadcastEvent('play_pile_transfer', {
    fromOwner: oi, toOwner: pi, cardName, from: 'deck', to: 'hand',
    toHandIdx: ps.hand.length,
  });
  await engine._delay(opts.delay ?? 700);

  // ② Zustand.
  ops.mainDeck.shift();
  ps.hand.push(cardName);

  // ③ Herkunft merken.
  engine._tagHandCardOrigin(pi, cardName, oi);
  engine.log('take_from_opp_deck', {
    player: ps.username, card: cardName, source: opts.source || null,
  });

  // ④ Nur der eigenen Seite zeigen.
  const mySid = ps.socketId;
  if (mySid && engine.io) engine.io.to(mySid).emit('card_reveal', { cardName });

  // ⑤ ★ Der Hook, an dem Lilly haengt.
  await engine.runHooks('onCardTakenFromOpponent', {
    takerPi: pi, fromZone: 'deck', cardName,
  });

  // ⑥ ★ ZAEHLT DAS ALS ZIEHEN? (v1110, Als Testbefund 15.9.)
  //
  // Al: „Zieht ein Spieler vom Deck seines Gegners, triggert das noch
  // NICHT Melissas Effekt." — „Cute Meanie Melissa": „Whenever your
  // opponent DRAWS 1 or more cards via an effect, you may draw 1 card."
  //
  // ★ DIE ANTWORT STEHT AUF DER JEWEILIGEN KARTE, nicht am Vorgang:
  //   • „Love Shot": „DRAW a card from your opponent's deck."  → ja
  //   • „Infiltration" Lv1: „ADD the top card of opponent's deck to
  //     your hand."                                            → nein
  //
  // Beide nehmen mechanisch dasselbe, aber nur eine nennt es Ziehen.
  // Deshalb entscheidet der Aufrufer, nicht dieser Helfer.
  //
  // Melissa entprellt ueber `_drawBatch` — wir vergeben eine eigene
  // Kennung, damit ein Vorgang genau EINE Antwort ausloest.
  if (opts.asDraw) {
    await engine.runHooks('onDraw', {
      playerIdx: pi, card: null, cardName, drawnCard: null, drawnCardName: cardName,   // v1307
      _isResourceDraw: false,
      _drawBatch: `oppdeck-${Date.now()}-${Math.random()}`,
      _drawCount: 1, _drawIndex: 0,
    });
  }

  return cardName;
}

module.exports = { takeTopFromOpponentDeck };
