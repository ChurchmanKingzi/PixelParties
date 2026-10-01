// ═══════════════════════════════════════════
//  CARD EFFECT: "Heart of Cards"
//  Artifact (Subtyp Normal, Kosten 4, gebannt — implementiert trotzdem)
//
//  „Declare a card name and reveal the top card of your deck. If it is
//   the declared card, add it to your hand and draw 2 cards. Otherwise,
//   delete the revealed card. You can only play 1 \"Heart of Cards\" per
//   turn."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Ein ganz normales Artefakt (Subtyp Normal — die Datenbank sagte
//    faelschlich "Reaction", korrigiert): nur in der EIGENEN Runde
//    spielbar, ueber `canActivate` zusaetzlich auf den aktiven Spieler
//    festgenagelt.
//  • „Declare a card name": `cardNamePicker` ueber alle Karten (ohne
//    Token), abbrechbar — Abbruch heisst „nichts ist passiert". Die
//    Ansage wird dem GEGNER als Kartenbild gestreamt (`card_reveal`,
//    nur an ihn), damit sofort erkennbar ist, was gerade geschieht
//    (Als Vorgabe).
//  • „reveal the top card": die oberste Karte wird beiden Seiten gezeigt.
//    Treffer = Name-Gleichheit ueber `baseCardName` (die [B]/[W]-Hinweise
//    sind kein Teil des Namens, v875). Treffer → auf die Hand
//    (`actionAddCardFromDeckToHand`), danach 2 Karten ziehen. Sonst wird
//    sie GELOESCHT (`deleteFromPile`).
//  • „1 per turn": Stempel pro Spieler und Zug (`gs.hoptUsed`), gesetzt
//    erst NACH der Ansage — ein Abbruch verbraucht nichts. Spielbar nur
//    mit mindestens einer Karte im Deck.
// ═══════════════════════════════════════════

const { baseCardName } = require('./_hooks');

const CARD_NAME = 'Heart of Cards';
const HOPT_KEY = 'heart-of-cards';

function schonGespielt(gs, pi) {
  return gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn;
}

module.exports = {
  canActivate(gs, pi, engine) {
    if (gs.activePlayer !== pi) return false;   // nur in der eigenen Runde
    if (schonGespielt(gs, pi)) return false;
    return (gs.players[pi]?.mainDeck || []).length > 0;
  },

  /** CPU: die haeufigste Karte im eigenen Deck ansagen (beste Trefferchance). */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type !== 'cardNamePicker') return undefined;
    const pi = engine?._cpuPlayerIdx;
    const deck = engine?.gs?.players?.[pi]?.mainDeck || [];
    if (deck.length === 0) return undefined;
    const zaehler = new Map();
    for (const n of deck) zaehler.set(n, (zaehler.get(n) || 0) + 1);
    let beste = null;
    for (const [n, k] of zaehler) if (!beste || k > beste.k) beste = { n, k };
    return beste ? { cardName: beste.n } : undefined;
  },

  cpuShouldPlay(engine, pi) {
    return (engine?.gs?.players?.[pi]?.mainDeck || []).length > 0;
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const oi = pi === 0 ? 1 : 0;
    if (!ps || schonGespielt(gs, pi) || (ps.mainDeck || []).length === 0) return { cancelled: true };

    // ① Ansage — abbrechbar, dann ist nichts verbraucht.
    const db = engine._getCardDB();
    const alleNamen = Object.keys(db)
      .filter(n => db[n] && db[n].cardType !== 'Token')
      .sort((a, b) => a.localeCompare(b));
    const wahl = await engine.promptGeneric(pi, {
      type: 'cardNamePicker',
      title: CARD_NAME,
      description: 'Declare a card name. The top card of your deck is revealed — if it is the declared card, add it to your hand and draw 2 cards. Otherwise it is deleted.',
      cardNames: alleNamen,
      cancellable: true,
    });
    if (!wahl || wahl.cancelled || !wahl.cardName) return { cancelled: true };
    const genannt = wahl.cardName;

    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[`${HOPT_KEY}:${pi}`] = gs.turn;

    // ② Die angesagte Karte als BILD an den Gegner streamen.
    engine._broadcastEvent('card_reveal', { cardName: genannt }, { toPlayers: [oi] });
    engine.log('heart_of_cards_declare', { player: ps.username, declared: genannt });
    await engine._delay(1200);

    // ③ Oberste Karte aufdecken (beide Seiten).
    const oben = ps.mainDeck[0];
    if (oben == null) return true;
    engine._broadcastEvent('card_reveal', { cardName: oben });
    await engine._delay(1200);

    const treffer = baseCardName(oben) === baseCardName(genannt);
    engine.log('heart_of_cards_reveal', { player: ps.username, declared: genannt, revealed: oben, hit: treffer });

    if (treffer) {
      await engine.actionAddCardFromDeckToHand(pi, oben, { source: CARD_NAME, reveal: true });
      await engine.actionDrawCards(pi, 2, { source: CARD_NAME });
    } else {
      await engine.deleteFromPile(pi, 'deck', oben, { source: CARD_NAME });
    }
    engine.sync();
    return true;
  },
};
