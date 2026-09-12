// ═══════════════════════════════════════════
//  CARD EFFECT: "Informant"
//  Creature (Summoning Magic Lv0, 50 HP, Normal)
//
//  „You may once per turn reveal the top 5 cards of your opponent's
//   deck. Place them on top or bottom of their deck in any order and
//   combination."
//
//  ── ABLAUF ────────────────────────────────────────────────────────
//  1) Die obersten bis zu 5 Karten werden AUFGEDECKT — „reveal" heisst
//     beide Spieler sehen sie. Deshalb eine Runde `showTriggeredEffect`
//     je Karte (das ist der Kanal an den ganzen Raum, nicht der an
//     einen Spieler), bevor irgendeine Abfrage kommt.
//  2) Der Informant-Spieler waehlt in EINER Galerie die Karten fuer
//     OBEN — in der Klickreihenfolge. Die Reihenfolge zaehlt: die zuerst
//     geklickte Karte wird als naechstes gezogen. `selectedCards` haelt
//     genau diese Reihenfolge (Client: `return [...prev, idx]`).
//  3) Alles Nichtgewaehlte geht nach UNTEN. Sind das mindestens zwei
//     Karten, kommt dafuer eine zweite Galerie; bei einer oder keiner
//     erspart sich das Spiel die Rueckfrage.
//  4) Keine Auswahl (alles nach unten) und „alles nach oben" sind beide
//     zulaessig — „in any order and combination".
//
//  ── WARUM ZWEI GALERIEN STATT EINER MIT ZWEI MARKIERUNGEN ─────────
//  Der Client kennt `cardGallery` (eine Karte) und `cardGalleryMulti`
//  (eine Menge, Klickreihenfolge erhalten). Eine Galerie mit ZWEI
//  Stapeln und zwei Zaehlreihen waere ein neuer Prompt-Typ mit eigenem
//  Zustand, eigener Bestaetigungslogik und eigener CPU-Anbindung. Die
//  zwei bestehenden Galerien liefern dasselbe Ergebnis mit hoechstens
//  zwei Klickrunden — und jede Runde zeigt beiden Spielern dieselben
//  Karten.
//
//  ── DECK-SICHTBARKEIT ─────────────────────────────────────────────
//  `deckTopVisible` fuehrt Buch darueber, welche obersten Karten
//  oeffentlich bekannt sind (Premonition & Co.). Die fuenf hier waren
//  aufgedeckt, also bleiben die oben einsortierten sichtbar; was unter
//  dem Fenster lag, behaelt seinen Zustand. Die nach unten gelegten
//  sind nicht mehr oben und fallen aus der Liste.
//
//  ── ERSTE RUNDE ───────────────────────────────────────────────────
//  Der Effekt greift in das Deck des Gegners — in der ersten Runde ist
//  er davor geschuetzt (Als Regel). Dann ist der Effekt nicht
//  aktivierbar (`canActivateCreatureEffect`), die Kreatur bleibt
//  ausgegraut statt ins Leere zu laufen.
// ═══════════════════════════════════════════

const CARD_NAME = 'Informant';
const PEEK = 5;

function gegner(pi) { return pi === 0 ? 1 : 0; }

module.exports = {
  activeIn: ['support'],
  // Pflichtfahne: ohne sie haelt der Loader ein Skript ohne `hooks` fuer
  // leer und verwirft es ganz (Cannon-Tower-Bauart).
  creatureEffect: true,

  /** „You may once per turn" — die Engine haelt die Rundensperre. */
  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const oi = gegner(pi);
    if (gs.firstTurnProtectedPlayer === oi) return false;
    return (gs.players[oi]?.mainDeck || []).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const oi = gegner(pi);
    const ps = gs.players[pi];
    const ops = gs.players[oi];
    if (!ps || !ops) return false;
    if (gs.firstTurnProtectedPlayer === oi) return false;

    const anzahl = Math.min(PEEK, (ops.mainDeck || []).length);
    if (anzahl === 0) return false;

    // ── 1) Aufdecken, fuer BEIDE sichtbar ───────────────────────────
    const gesehen = ops.mainDeck.slice(0, anzahl);
    engine.log('informant_reveal', {
      player: ps.username, opponent: ops.username,
      cards: gesehen, count: anzahl,
    });
    for (let i = 0; i < gesehen.length; i++) {
      // `source` je Karte, sonst schluckt die Entprellung Dubletten
      // (zwei gleiche Karten im Fenster sind moeglich).
      await engine.showTriggeredEffect(gesehen[i], {
        source: `informant:${gs.turn}:${i}`, delayMs: 420,
      });
    }

    // Die fuenf aus dem Deck nehmen, damit sie frei einsortiert werden
    // koennen. Schlaegt eine Entnahme fehl (Stapel gesperrt), bricht der
    // Effekt ab — die schon entnommenen wandern unveraendert zurueck.
    const entnommen = [];
    for (const name of gesehen) {
      const ok = await engine.takeFromPile(ops, 'deck', name, { source: CARD_NAME });
      if (!ok) break;
      entnommen.push(name);
    }
    if (entnommen.length === 0) return false;
    if (entnommen.length < gesehen.length) {
      // Teilweise entnommen: unveraendert zurueck und aussteigen.
      for (let i = entnommen.length - 1; i >= 0; i--) ops.mainDeck.unshift(entnommen[i]);
      engine.sync();
      return false;
    }

    // ── 2) Karten fuer OBEN waehlen (Reihenfolge = Klickreihenfolge) ─
    let oben = [];
    if (entnommen.length === 1) {
      // Eine Karte: nur noch oben oder unten — eine Ja/Nein-Frage.
      const rauf = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        showCard: entnommen[0],
        message: `Place "${entnommen[0]}" on TOP of ${ops.username}'s deck? (No = bottom)`,
        confirmLabel: '⬆️ Top', cancelLabel: '⬇️ Bottom',
        cancellable: true,
      });
      oben = rauf ? [entnommen[0]] : [];
    } else {
      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGalleryMulti',
        cards: entnommen.map((name, i) => ({ name, source: 'deck', _idx: i })),
        title: CARD_NAME,
        description: `Top ${entnommen.length} of ${ops.username}'s deck. Pick the cards to put back on TOP — in the order they will be drawn (first pick is drawn next). Everything you leave unpicked goes to the BOTTOM.`,
        minSelect: 0,
        // `selectCount` ist der Name, den der Galerie-Prompt fuehrt
        // (v864); `maxSelect` steht als Zweitname daneben, damit die
        // Absicht auch ohne Blick in den Client lesbar bleibt.
        selectCount: entnommen.length,
        maxSelect: entnommen.length,
        confirmLabel: '⬆️ Place on top',
        cancellable: false,
      });
      oben = Array.isArray(wahl?.selectedIndices)
        ? wahl.selectedIndices.map(i => entnommen[i]).filter(Boolean)
        : (wahl?.selectedCards || []).slice();
    }

    // Rest = unten. Ueber eine ZAEHLLISTE abziehen, damit gleichnamige
    // Karten richtig aufgeteilt werden (zwei „Fireball" im Fenster: eine
    // oben, eine unten).
    const rest = entnommen.slice();
    for (const name of oben) {
      const i = rest.indexOf(name);
      if (i >= 0) rest.splice(i, 1);
    }

    // ── 3) Reihenfolge fuer UNTEN, nur wenn es dort etwas zu ordnen gibt
    let unten = rest;
    if (rest.length > 1) {
      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGalleryMulti',
        cards: rest.map((name, i) => ({ name, source: 'deck', _idx: i })),
        title: CARD_NAME,
        description: `These go to the BOTTOM of ${ops.username}'s deck. Pick them in the order they should sit — first pick ends up closest to the rest of the deck (drawn first of this group).`,
        minSelect: rest.length,
        selectCount: rest.length,
        maxSelect: rest.length,
        confirmLabel: '⬇️ Place on bottom',
        cancellable: false,
      });
      const sortiert = Array.isArray(wahl?.selectedIndices)
        ? wahl.selectedIndices.map(i => rest[i]).filter(Boolean)
        : (wahl?.selectedCards || []);
      // Defensiv: kam nichts Brauchbares zurueck, bleibt die
      // urspruengliche Reihenfolge — es darf keine Karte verloren gehen.
      unten = (sortiert.length === rest.length) ? sortiert : rest;
    }

    // ── 4) Einsortieren ─────────────────────────────────────────────
    // Oben: rueckwaerts per unshift, damit die ZUERST gewaehlte Karte
    // ganz oben liegt.
    for (let i = oben.length - 1; i >= 0; i--) ops.mainDeck.unshift(oben[i]);
    // Unten: der zuerst Gewaehlte sitzt naeher am Rest des Decks, also
    // in der gewaehlten Reihenfolge anhaengen.
    for (const name of unten) ops.mainDeck.push(name);

    // Sichtbarkeit: die oben einsortierten sind beiden bekannt; was
    // darunter lag, behaelt seinen Zustand.
    // `deckTopVisible` ist eine Liste von KARTENNAMEN, top-first — der
    // Server prueft sie Stelle fuer Stelle gegen `mainDeck` und wirft
    // beim ersten Unterschied den Rest weg. Ein Wahrheitswert haette
    // die Pruefung sofort reissen lassen: die Sichtbarkeit waere still
    // verschwunden, statt die frisch oben einsortierten Karten zu
    // zeigen (mein Fehler in v863).
    const darunter = (ops.deckTopVisible || []).slice(anzahl);
    ops.deckTopVisible = oben.slice().concat(darunter);

    // ── 5) ERGEBNIS AN BEIDE (v865, Als Rueckfrage) ─────────────────
    // Der Gegner muss nicht nur wissen, WELCHE fuenf Karten oben lagen,
    // sondern auch, wo sie jetzt liegen — „reveal" macht den ganzen
    // Vorgang oeffentlich. Zwei Wege, weil sie Verschiedenes leisten:
    //  · Die Protokollzeile (unten) nennt beide Gruppen MIT Reihenfolge
    //    und bleibt nachlesbar.
    //  · Die Karten, die jetzt OBEN liegen, laufen noch einmal in ihrer
    //    endgueltigen Reihenfolge durch den Auftritt — das ist die
    //    Information, die den naechsten Zug des Gegners betrifft, und
    //    sie wirkt sofort. Die nach unten gelegten bleiben der
    //    Protokollzeile ueberlassen: sie aendern fuer lange Zeit nichts.
    for (let i = 0; i < oben.length; i++) {
      await engine.showTriggeredEffect(oben[i], {
        source: `informant-top:${gs.turn}:${i}`, delayMs: 300,
      });
    }

    engine.log('informant_placed', {
      player: ps.username, opponent: ops.username,
      top: oben.length, bottom: unten.length,
      topCards: oben, bottomCards: unten,
    });
    engine._broadcastEvent('play_zone_animation', {
      type: 'deck_shuffle', owner: oi, heroIdx: -1, zoneSlot: -1,
    });
    engine.sync();
    return true;
  },

  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    // Die CPU legt alles wieder nach oben, in unveraenderter Reihenfolge
    // — der neutrale Zug. Ohne diesen Eintrag lehnt der generische
    // Responder ab und der Effekt verpuffte.
    if (promptData?.type === 'cardGalleryMulti') {
      const n = (promptData.cards || []).length;
      return { selectedIndices: Array.from({ length: n }, (_, i) => i),
               selectedCards: (promptData.cards || []).map(c => c.name) };
    }
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  cpuMeta: {
    // Reine Aufklaerung plus Deckmanipulation: kein Schaden, aber der
    // Blick auf fuenf Karten ist bares Wissen.
    infoOnly: true,
  },
};
