// ═══════════════════════════════════════════
//  CARD EFFECT: "Trial of Loyalty"
//  Spell (Support Magic Lv1, Normal, Trials)
//
//  "You cannot play other Attacks or Spells the turn you play this
//   card. Search your deck for up to 5 \"Trial of\" Attacks/Spells with
//   different names, reveal them, and add them to your hand. You can
//   only play 1 \"Trial of Loyalty\" per game."
//
//  Loyalty ist der ANSCHIEBER des Archetyps: eine Karte holt bis zu
//  vier weitere Pruefungen auf die Hand und macht „The Final Trial"
//  damit ueberhaupt planbar.
//
//  Umsetzung
//  ─────────
//  • Einmal pro Spiel + symmetrischer Riegel aus `_trials-shared.js`
//    (gleiche Huelle wie Coolness und Dominance).
//  • „Attacks/Spells" woertlich: der Filter laesst beide Kartentypen
//    zu, auch wenn heute nur Spells den Namensteil tragen. Kommt
//    einmal ein „Trial of"-Attack dazu, greift er von selbst.
//  • „mit verschiedenen Namen": die Galerie zeigt jeden Namen EINMAL,
//    `cardGalleryMulti` liefert deshalb automatisch nur Verschiedene.
//    Muster von `divine-gift-of-creation.js`.
//  • KEINE erfundenen Ausschluesse (Als Ruling 18.8.): auch eine
//    zweite Kopie von Loyalty selbst und bereits gespielte Pruefungen
//    duerfen gesucht werden. Der Text schraenkt nicht ein.
//  • Leeres Ergebnis ist KEIN Fehlschlag: der Riegel wird gestempelt
//    (die Pruefung wurde abgelegt), der Spell wandert normal ab.
//  • ABBRUCH in der Galerie heisst „nicht gespielt": `_spellCancelled`,
//    kein Riegel, Karte bleibt auf der Hand (Als Regel 18.8.).
//  • Reihenfolge am Ende wie beim Vorbild: erst Deck→Hand je Karte
//    (damit `ON_CARD_ADDED_TO_HAND` je Zugang feuert), dann EIN
//    gesammeltes Aufdecken, dann mischen.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const {
  TRIAL_KEYS, isTrialOfName, trialTurnIsClean, stampTrialLock,
} = require('./_trials-shared');

const CARD_NAME = 'Trial of Loyalty';
const MAX_PICKS = 5;

/**
 * Verschiedene „Trial of"-Attacks/Spells im Deck, die dieses Spiel
 * ueberhaupt noch spielbar waeren. Gibt [{ name, source, count }].
 */
function eligibleDeckTrials(engine, ps) {
  if (!ps?.mainDeck?.length) return [];
  const cardDB = engine._getCardDB();
  const counts = new Map();
  for (const name of ps.mainDeck) {
    // ★ ALS BEFUND 18.8.: „Trial of Loyalty kann aktuell keine Kopie von
    // sich selbst suchen, was inkorrekt ist." Hier standen ZWEI von mir
    // erfundene Ausschluesse — die eigene Karte und bereits gespielte
    // Pruefungen. Beide sind Bevormundung: der Kartentext sagt schlicht
    // „up to 5 \"Trial of\" Attacks/Spells with different names", ohne
    // jede Einschraenkung. Was der Spieler mit einer unspielbaren Kopie
    // anfaengt, ist seine Sache (Abwurfkosten, Bluff, Recycling).
    if (!isTrialOfName(name)) continue;
    const cd = cardDB[name];
    if (!cd) continue;
    if (!hasCardType(cd, 'Spell') && !hasCardType(cd, 'Attack')) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, source: 'deck', count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  oncePerGame: true,
  oncePerGameKey: TRIAL_KEYS[CARD_NAME],

  // Vorderer Riegel — die Runde muss Trial-oder-nichts sein.
  // Anders als bei Coolness/Dominance KEINE zusaetzliche
  // Ziel-/Inhaltspruefung: Loyalty darf auch mit leerem Deck gespielt
  // werden (der Riegel ist dann der ganze Effekt), genau wie
  // Dominance gegen ein leeres Gegnerbrett gespielt werden darf.
  spellPlayCondition(gs, pi) {
    return trialTurnIsClean(gs, pi);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // ★ ALS REGEL 18.8.: „Wird Trial of Loyalty — oder *irgendein*
      // Trial — gecancelt, soll er NICHT fizzeln, sondern schlicht
      // nicht aktiviert werden, wie andere Spells auch."
      // Deshalb wird der Rundenriegel jetzt ERST gesetzt, wenn der
      // Spieler wirklich zugreift. Vorher stand er hier oben — eine
      // Absage kostete damit die Karte UND sperrte die Runde.
      // `gs._spellCancelled = true` ist der Hausweg fuer „nicht
      // aktiviert": der Server erstattet die Aktion und die Karte
      // bleibt auf der Hand (server.js ~7015).
      const candidates = eligibleDeckTrials(engine, ps);
      if (candidates.length === 0) {
        // KEIN Abbruch: die Pruefung wurde gespielt, sie findet nur
        // nichts. Wie Dominance gegen ein leeres Gegnerbrett.
        stampTrialLock(gs, pi);
        engine.log('trial_of_loyalty', {
          player: ps.username, found: 0, note: 'no_eligible_trials_in_deck',
        });
        engine.sync();
        return;
      }

      const maxPicks = Math.min(MAX_PICKS, candidates.length);
      const result = await engine.promptGeneric(pi, {
        type: 'cardGalleryMulti',
        cards: candidates,
        selectCount: maxPicks,
        minSelect: 1,
        title: CARD_NAME,
        description: `Search your deck for up to ${maxPicks} "Trial of" card${maxPicks > 1 ? 's' : ''} with different names.`,
        confirmLabel: '📜 Summon the Trials!',
        confirmClass: 'btn-success',
        cancellable: true,
      });
      if (!result || result.cancelled
          || !Array.isArray(result.selectedCards)
          || result.selectedCards.length === 0) {
        // Absage → die Karte wurde NICHT gespielt. Kein Riegel, keine
        // Kosten, sie bleibt auf der Hand.
        gs._spellCancelled = true;
        return;
      }
      // Ab hier ist es verbindlich.
      stampTrialLock(gs, pi);

      // Nur Namen behalten, die wirklich im Deck liegen und im
      // Kandidatensatz standen (Doppelte fallen ueber das Set weg).
      const allowed = new Set(candidates.map(c => c.name));
      const chosen = [...new Set(result.selectedCards)]
        .filter(n => allowed.has(n))
        .slice(0, MAX_PICKS);

      // ★ ALS VORGABE 18.8.: „sollte seine Searches einen nach dem
      // anderen animieren, wie Magic Lamp" — plus „für jede vom Deck
      // auf die Hand fliegende Karte kleine weiße Vögelchen und
      // Herzchen".
      // Muster von `magic-lamp.js`: je Karte einzeln holen, danach
      // `sync()` und eine kurze Pause, damit der Flug sichtbar wird.
      // Ohne die Pause landen alle fuenf im selben Bild.
      const added = [];
      for (const name of chosen) {
        if (ps.mainDeck.indexOf(name) < 0) continue;
        await engine.actionAddCardFromDeckToHand(pi, name, {
          source: CARD_NAME,
          reveal: false, // gesammeltes Aufdecken gleich darunter
        });
        added.push(name);
        // ★ ALS VORGABE 18.8.: „sollte auf der gerade hinzugefügten
        // (ganz rechten!) Karte spielen." Verankert ueber den
        // KARTENNAMEN; der Verteiler nimmt davon den LETZTEN Treffer,
        // also die neueste (rechteste) Kopie. Der Index taugt nicht:
        // Loyalty selbst verlaesst die Hand im selben Zug, alle Indizes
        // rutschen.
        // Der Gegner sieht die Karte aus dem Deck kommen — dieselbe
        // Buchhaltung, die `revealSearchedCards` sonst macht.
        // ★ KEINE eigene `deck_search`-Zeile: `actionAddCardFromDeckToHand`
        // schreibt sie bereits (der Repro zeigte prompt vier statt zwei
        // Eintraege).
        engine.noteKnownCard(pi === 0 ? 1 : 0, name, 'deck');
        engine.noteKnownCard(pi === 0 ? 1 : 0, name, 'hand');
        // ★ ERST der Spielstand, DANN die Animation (Als Befund 18.8.:
        // die Voegel sassen nicht auf der frisch geholten Karte). Die
        // Reihenfolge auf der Leitung bleibt erhalten; der Client
        // rendert also erst die neue Handkarte und sucht dann ihren
        // Anker. Vorher suchte er einen Slot, den es noch nicht gab.
        engine.sync();
        engine._broadcastEvent('play_zone_animation', {
          type: 'loyalty_birds', owner: pi, heroIdx: -1, zoneSlot: -1,
          // ★ Der INDEX ist der eindeutige Anker: die Karte wurde
          // gerade hinten angehaengt, steht also fest. Liegt schon eine
          // gleichnamige Karte auf der Hand, traefe eine reine
          // Namenssuche die falsche. Der Name bleibt als Rueckfall.
          // Loyalty selbst verlaesst die Hand erst NACH dieser
          // Schleife, die Indizes rutschen also zwischendurch nicht.
          handIdx: ps.hand.length - 1,
          handCardName: name,
        });
        await engine._delay(500);
      }

      // ★ ALS BEFUND 18.8.: „einen ewig langen Delay zwischen dem
      // Hinzufügen der letzten Handkarte und dem Entfernen von Trial of
      // Loyalty selbst."
      // Ursache war `revealSearchedCards`: die Funktion flog JEDE Karte
      // ein ZWEITES Mal (`deck_search_add`), wartete je 500 ms UND
      // oeffnete dem Gegner je Karte ein Bestaetigungsfenster. Bei fuenf
      // Karten summiert sich das zu einer halben Ewigkeit, nachdem auf
      // dem Brett laengst alles passiert ist.
      // Die Schleife oben erledigt Flug, Log und Kartengedaechtnis
      // bereits einzeln — der zweite Durchlauf entfaellt ersatzlos.
      engine.shuffleDeck(pi);

      engine.log('trial_of_loyalty', {
        player: ps.username, found: added.length, cards: added,
      });
      engine.sync();
    },
  },
};
