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

const { HOOKS, PHASES } = require('./_hooks');

/**
 * Flug „Gegnerdeck → eigene Hand": NUR der Nehmende sieht die echte Karte fliegen. Gegner und Zuschauer bekommen einen verdeckten
 * Flug (`cardName: '?'`, `faceDown: true` — der Client zeichnet den Kartenrücken), wie bei jedem normalen Ziehen. Sonst sähe der
 * Gegner die Karte aus SEINEM Deck offen davonfliegen und wüsste, was gezogen wurde.
 */
function flugDeckZuHand(engine, pi, daten) {
  const andere = [];
  for (let i = 0; i < engine.playerCount(); i++) if (i !== pi) andere.push(i);
  engine._broadcastEvent('play_pile_transfer', daten, { toPlayers: [pi], toSpectators: false });
  engine._broadcastEvent('play_pile_transfer', { ...daten, cardName: '?', faceDown: true }, { toPlayers: andere });
}

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
  const oi = engine.opponentOf(pi);
  const ps = gs.players[pi];
  const ops = gs.players[oi];
  if (!ps || !ops) return null;
  if ((ops.mainDeck || []).length === 0) return null;
  // v1396 (Als Ruling 25.9.): keine Suche, nicht „from your deck" — aber
  // „add to hand": unter einer Hand-Sperre geht es nicht.
  if (engine.handZugangGesperrt(pi)) return null;

  const cardName = ops.mainDeck[0];

  // ① Flug ZUERST — siehe Kopf.
  flugDeckZuHand(engine, pi, {
    fromOwner: oi, toOwner: pi, cardName, from: 'deck', to: 'hand',
    toHandIdx: ps.hand.length,
  });
  await engine._delay(opts.delay ?? 700);

  // ② Zustand.
  // v1396: Entnahme über die Stapel-Schicht (Deckkopf-Sicht, Log), Zugang
  // über die Hand-Stelle — mit Instanz und Herkunfts-Merker.
  if (!engine.takeFromPileSync(ops, 'deck', 0, { source: opts.source || null, sourceOwner: pi })) return null;
  const inst = engine.handZugangSync(ps, cardName, { von: 'fremdesDeck', source: opts.source || null, originalOwner: oi });
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
      playerIdx: pi, card: null, cardName, drawnCard: inst || null, drawnCardName: cardName,   // v1307
      _isResourceDraw: false,
      // Cell Escape (W78): ein Ziehvorgang MIT mehreren Karten reicht Kennung/Menge/Platz durch (`opts.drawBatch/drawCount/drawIndex`, vergeben von
      // `zieheAusGegnerDeck`) — Melissa/Dirty Smuggler entprellen daran, Smuggler liest `_drawCount`. Ohne Angabe (Love Shot): ein Vorgang mit einer Karte.
      _drawBatch: opts.drawBatch ?? `oppdeck-${Date.now()}-${Math.random()}`,
      _drawCount: opts.drawCount ?? 1, _drawIndex: opts.drawIndex ?? 0,
      _drawSource: opts.source || null,
    });
  }

  return cardName;
}

/**
 * ★ Welle 78 (Cell Escape): „Draw N cards from your opponent's deck" als EIN Ziehvorgang — die Karten gehen nacheinander (oberste zuerst) vom Gegnerdeck auf
 * die eigene Hand (Herkunft bleibt beim Gegner, `takeTopFromOpponentDeck`), und der Vorgang laeuft durch dieselben Ziehfenster wie `actionDrawCards`:
 *   • Sperren: Hand-Sperre (`handLocked`) und Zieh-Sperre (`drawLocked`) des ZIEHENDEN; Erste-Runden-Immunitaet des Deck-Besitzers (`ersterZugGeschuetzt`);
 *   • `beforeDrawBatch` (Tuscan Artist negiert genau 2/3, Intrude negiert/kopiert; die Menge darf sinken) und das Vor-Zieh-Fenster der Surprises
 *     (`_checkSurpriseBeforeOppDraw`, Cybug Centipede) — nur bei echter Ziehung, die `asDraw`-Karten des Gegner-Decks sind Ziehen (Tuscan-Artist-Ruling 16.8.: „Auch ein Zug aus dem
 *     GEGNERISCHEN Deck zaehlt (Cell Escape)");
 *   • je Karte `onCardTakenFromOpponent` (Lilly) und `onDraw` (Melissa, Dirty Smuggler, Analyzer …) mit gemeinsamer Vorgangs-Kennung (`_drawBatch/_drawCount/_drawIndex`);
 *   • danach Handlimit-Waechter (Pollution) und die vorgemerkten Surprise-Zuege (Pure Advantage Camel).
 * Hat das Deck weniger Karten als bestellt, werden so viele gezogen, wie da sind (das Deck des Gegners leert sich — es ist nicht SEIN Zug, kein Deck-out-Sieg fuer niemanden).
 *
 * @param {object} engine
 * @param {number} pi         wer zieht
 * @param {number} count      bestellte Menge
 * @param {object} [opts]     `source` (Kartenname fuers Log), `delay` (Flug je Karte, Standard 600 ms), `trailing` (Wartezeit nach der letzten Karte, Standard 250 ms)
 * @returns {Promise<string[]>} die gezogenen Kartennamen (leer: nichts gezogen)
 */
async function zieheAusGegnerDeck(engine, pi, count, opts = {}) {
  const gs = engine.gs;
  const oi = engine.opponentOf(pi);
  const ps = gs.players[pi];
  const ops = gs.players[oi];
  const gezogen = [];
  if (!ps || !ops || !(count > 0)) return gezogen;
  if (ps.handLocked || ps.drawLocked) return gezogen;                       // wie `actionDrawCards`
  if (engine.ersterZugGeschuetzt(oi, pi)) return gezogen;                   // Nicht-Schadens-Effekt gegen den geschuetzten Gegner
  if ((ops.mainDeck || []).length === 0) return gezogen;

  // Vor-Zieh-Fenster: Tuscan Artist / Intrude (Menge aendern), Surprises (Cybug Centipede).
  const batchCtx = { playerIdx: pi, amount: count, deckType: 'main', _skipReactionCheck: true };
  await engine.runHooks(HOOKS.BEFORE_DRAW_BATCH, batchCtx);
  count = Math.max(0, batchCtx.amount);
  if (count === 0) return gezogen;
  const vorher = await engine._checkSurpriseBeforeOppDraw(pi, count);
  if (vorher?.drawRedirected) return gezogen;

  engine._drawBatchSeq = (engine._drawBatchSeq || 0) + 1;                   // dieselbe Zaehlung wie `actionDrawCards` — keine Kennungs-Kollision
  const batchId = engine._drawBatchSeq;
  for (let i = 0; i < count; i++) {
    const name = await takeTopFromOpponentDeck(engine, pi, {
      source: opts.source || null, asDraw: true, delay: opts.delay ?? 600,
      drawBatch: batchId, drawCount: count, drawIndex: i,
    });
    if (!name) break;                                                       // Deck leer oder Hand-Sperre mitten im Vorgang
    gezogen.push(name);
    engine.sync();
  }

  if (gezogen.length > 0) {
    await engine._checkReactiveHandLimits(pi);
    if (gs.currentPhase !== PHASES.RESOURCE) {
      if (!engine._pendingSurpriseDraws) engine._pendingSurpriseDraws = {};
      engine._pendingSurpriseDraws[pi] = (engine._pendingSurpriseDraws[pi] || 0) + gezogen.length;
      await engine._delay(opts.trailing ?? 250);                            // die letzte Karte landet, bevor der Aufrufer weitermacht
    }
  }
  return gezogen;
}

module.exports = { takeTopFromOpponentDeck, flugDeckZuHand, zieheAusGegnerDeck };
