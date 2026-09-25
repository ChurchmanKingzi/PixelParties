// ═══════════════════════════════════════════
//  CARD EFFECT: „Spice Mortar"
//  Artifact (Normal, Kosten 0, PP MSIN)
//
//  „Reveal the top 10 cards of your opponent's deck. Add a Potion from
//   among those cards to your hand, if possible. Your opponent may
//   shuffle their deck afterwards."
//
//  BAUART (Vorbild: „Enigma, the Seller of Secrets" — dieselbe
//  Grundfigur „oben ins Gegnerdeck schauen und etwas mitnehmen")
//  ──────────────────────────────────────────────────────────────────
//  • `stealsOpponentCards: true` — Boris-Sperre, weil die Karte etwas
//    aus dem Gegnerdeck auf die EIGENE Hand holt.
//
//  • Tore wie bei Enigma: Gegnerdeck nicht leer, eigene Hand nicht
//    gesperrt, keine Erstzug-Schonung des Gegners.
//
//  • ★ DIE KARTEN LIEGEN IN DER BILDMITTE (Als Vorgabe 12.9.). Sie
//    fliegen EINZELN vom Gegnerdeck in die Mitte — derselbe Weg, den
//    der Mitten-Auftritt des Mills (Cute Cat, Chaos Magic) nimmt — und
//    BLEIBEN dort liegen, statt in einen Stapel weiterzufliegen. Aus
//    den liegenden Karten wird die Galerie: Potions leuchten und sind
//    anklickbar, alles uebrige liegt abgedunkelt daneben. Umgesetzt
//    ueber `deck_peek_reveal` / Prompt `deckPeekPick` /
//    `deck_peek_clear` (v968).
//    NICHT `card_reveal`: das ist der Kanal fuer Karten-AUFTRITTE
//    (Als Hinweis 12.9.) und gehoert nicht hierher.
//
//  • Die Galerie hat IMMER einen Done-Knopf — schon damit sie sich
//    schliessen laesst, wenn gar keine Potion dabei war. Wer ihn bei
//    vorhandener Potion drueckt, nimmt nichts mit.
//
//  • Die Entnahme laeuft den Enigma-Weg: `takeFromPile`,
//    `_tagHandCardOrigin` (die Karte kehrt spaeter in den Stapel ihres
//    BESITZERS zurueck) und der Hook `onCardTakenFromOpponent`. Den
//    Flug uebernimmt hier die Mitten-Galerie (`deck_peek_clear`), nicht
//    `play_pile_transfer` — die Karte liegt ja schon in der Mitte.
//
//  • „may shuffle" ist die Entscheidung des GEGNERS — Bestaetigung bei
//    ihm, nicht beim Wirkenden.
// ═══════════════════════════════════════════

const CARD_NAME = 'Spice Mortar';
const TIEFE = 10;
const REVEAL_TAKT = 190;      // Staffelung je Karte, gleich der Client-Animation

module.exports = {
  // Greift auf das GEGNER-Deck zu: eigene Bewegung des Wirkenden, von
  // der Stapel-Ausgangssperre (Knight of Kings [B]) nicht erfasst. Ohne
  // das haette die Loader-Erkennung die ganze Karte unter der Sperre
  // blockiert (v826).
  blockedByPileLock: false,
  stealsOpponentCards: true,
  activeIn: ['hand'],

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    if (!ps || ps.handLocked) return false;
    const oi = pi === 0 ? 1 : 0;
    if (gs.firstTurnProtectedPlayer === oi) return false;
    return (gs.players[oi]?.mainDeck || []).length > 0;
  },

  // Die Potion-Galerie ist NICHT abbrechbar, die Mischfrage geht an den
  // GEGNER — der kann die CPU sein. Beides hier beantworten.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'deckPeekPick') {
      // Seit v967 stehen ALLE zehn Karten in der Galerie — waehlbar sind
      // nur die Potions.
      const erste = (promptData.cards || []).find(c => c.selectable !== false);
      return erste ? { cardName: erste.name, source: erste.source || 'deck' } : { cancelled: true };
    }
    // Mischen ja: der Gegner weiss jetzt, dass seine oberen zehn Karten
    // offenliegen — die CPU raeumt das lieber auf.
    if (promptData.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const oi = pi === 0 ? 1 : 0;
    const ps = gs.players[pi];
    const ops = gs.players[oi];
    if (!ps || !ops) return false;
    if (ps.handLocked) return false;
    if (gs.firstTurnProtectedPlayer === oi) return false;
    const oben = engine.revealTop(oi, TIEFE);
    if (oben.length === 0) return false;

    const cardDB = engine._getCardDB();
    engine.log('spice_mortar_reveal', {
      player: ps.username, opponent: ops.username,
      cards: oben, count: oben.length,
    });
    engine.sync();

    const istPotion = (n) => cardDB[n]?.cardType === 'Potion';
    const potions = oben.filter(istPotion);

    // ── Karten einzeln in die Bildmitte ziehen und liegen lassen ────
    const eintraege = oben.map(name => ({
      name, selectable: istPotion(name), highlight: istPotion(name),
    }));
    engine._broadcastEvent('deck_peek_reveal', {
      owner: oi, cards: eintraege,
      title: potions.length > 0
        ? `Top ${oben.length} cards of ${ops.username}'s deck — pick a Potion`
        : `Top ${oben.length} cards of ${ops.username}'s deck — no Potion among them`,
    });
    // Einflug: Staffelung (190 ms je Karte im Client) plus Flugzeit.
    await engine._delay(oben.length * REVEAL_TAKT + 450);

    // ── Die liegenden Karten SIND die Galerie ───────────────────────
    const wahl = await engine.promptGeneric(pi, {
      type: 'deckPeekPick',
      cards: eintraege,
      title: CARD_NAME,
      description: potions.length > 0
        ? 'Click a highlighted Potion to add it to your hand.'
        : 'No Potion among them.',
    });

    const gewaehlt = (wahl?.cardName && !wahl.cancelled && istPotion(wahl.cardName))
      ? wahl.cardName : null;

    // Aufloesung der Mitten-Galerie: die gewaehlte Karte fliegt von
    // ihrem Platz in die Hand, der Rest sinkt ab.
    engine._broadcastEvent('deck_peek_clear', { chosen: gewaehlt, toOwner: pi });
    await engine._delay(gewaehlt ? 700 : 420);

    if (gewaehlt) {
      if (await engine.takeFromPile(ops, 'deck', gewaehlt, { source: CARD_NAME })) {
        await engine.handZugang(ps, gewaehlt, { von: 'deck', source: CARD_NAME });   // v1395: jetzt MIT Hand-Instanz (fehlte)
        engine._tagHandCardOrigin(pi, gewaehlt, oi);
        engine.log('spice_mortar_take', {
          player: ps.username, card: gewaehlt, opponent: ops.username,
        });
        await engine.runHooks('onCardTakenFromOpponent', {
          takerPi: pi, fromZone: 'deck', cardName: gewaehlt,
        });
        engine.sync();
      }
    }

    // ── „Your opponent may shuffle their deck afterwards" ───────────
    if ((ops.mainDeck || []).length > 0) {
      const mischen = await engine.promptGeneric(oi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${ps.username} looked at the top ${oben.length} cards of your deck. Shuffle your deck?`,
        showCard: CARD_NAME,
        confirmLabel: '🔀 Shuffle',
        cancelLabel: 'Leave it',
        cancellable: true,
      });
      if (mischen && !mischen.cancelled) {
        engine.shuffleDeck(oi, 'main');
        engine.log('spice_mortar_shuffle', { player: ops.username });
        engine.sync();
      }
    }

    return true;
  },
};
