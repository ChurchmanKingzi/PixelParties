// ═══════════════════════════════════════════
//  CARD EFFECT: „Brainstorming"
//  Spell (Normal, Magic Arts Lv1)
//
//  "You can only play this card when there are 4 cards with the same
//   name in your discard pile. Search your deck for any card, reveal it
//   and add it to your hand. Then, shuffle 4 cards with the same name
//   from your discard pile back into your deck. This counts as an
//   additional Action."
//
//  ── DIE SPIELBEDINGUNG IST EINE NAMENSGRUPPE ─────────────────────
//  „4 cards with the same NAME" — vier Kopien EINER Karte, nicht vier
//  beliebige. Es genuegt, dass IRGENDEIN Name viermal vorkommt.
//
//  ★ Gemischt werden am Ende genau vier Karten DESSELBEN Namens. Gibt
//  es mehrere solche Gruppen, waehlt der Spieler — die Wahl ist real,
//  weil die zurueckgemischten Karten aus der Ablage verschwinden
//  (Necromancy, Soul Shard & Co. verlieren ihr Material).
//
//  ── SUCHE ZUERST, DANN MISCHEN ───────────────────────────────────
//  ★ Die Reihenfolge steht auf der Karte („Search … THEN shuffle") und
//  ist nicht beliebig: die vier Karten gehen ins Deck zurueck, NACHDEM
//  gesucht wurde. Wer erst mischt, koennte eine gerade
//  zurueckgemischte Karte sofort wieder heraussuchen.
//
//  ── VOLLSTAENDIG GESPERRT UNTER DER SUCH-SPERRE ──────────────────
//  ★ Al 15.9. ausdruecklich: „Brainstorming (der Search ist
//  Voraussetzung fuer den restlichen Effekt!)". Ohne die Suche bliebe
//  nur das Zurueckmischen — also reiner Verlust. Deshalb
//  `blockedBySearchLock`: die Karte ist in der Hand gar nicht erst
//  anklickbar.
// ═══════════════════════════════════════════

const CARD_NAME = 'Brainstorming';
const GRUPPE = 4;

/** Namen, die MINDESTENS viermal im Ablagestapel liegen. */
function namensGruppen(ps) {
  const zaehler = {};
  for (const n of (ps?.discardPile || [])) zaehler[n] = (zaehler[n] || 0) + 1;
  return Object.keys(zaehler).filter(n => zaehler[n] >= GRUPPE).sort();
}

module.exports = {
  // ★ Reine Such-Karte im Sinne der Sperre (Al 15.9.).
  blockedBySearchLock: true,

  /**
   * „You can only play this card when there are 4 cards with the same
   * name in your discard pile."
   */
  spellPlayCondition(gs, pi) {
    return namensGruppen(gs.players[pi]).length > 0;
  },

  // „This counts as an additional Action."
  inherentAction: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      const gruppen = namensGruppen(ps);
      if (gruppen.length === 0) { gs._spellCancelled = true; return; }
      if ((ps.mainDeck || []).length === 0) { gs._spellCancelled = true; return; }

      // ★ Der Selbst-Flug steht WEITER UNTEN — siehe die Begruendung
      // dort. Vor der Zielwahl waere er eine Luege.

      // ── ① Suchen ─────────────────────────────────────────────────
      const deckNamen = [...new Set(ps.mainDeck)].sort();
      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        title: CARD_NAME,
        // ★ Kennzeichnung fuer die Such-Sperre (v1118): diese Galerie
        // fuehrt auf die HAND.
        searchToHand: true,
        searchPile: 'deck',
        description: 'Choose a card from your deck to add to your hand.',
        cards: deckNamen.map(n => ({ name: n, source: 'deck' })),
        cancellable: true,
      });
      const gesucht = wahl?.cardName;
      if (!gesucht) { gs._spellCancelled = true; return; }

      const ok = await engine.actionAddCardFromDeckToHand(pi, gesucht, { source: CARD_NAME });
      if (!ok) { gs._spellCancelled = true; return; }

      // ★★ v1122 (Als Befund 15.9.): „Brainstorming verlaesst aktuell
      // die Hand, BEVOR sie confirmed wurde! Man kann also noch
      // abbrechen, nachdem sie visuell schon weggeflogen ist!"
      //
      // Genau die Regel, die seit v736 in dieser Datei steht — nur galt
      // sie dort dem Trigger-Auftritt, und ich habe sie mit einem FLUG
      // verletzt: Jede Sichtbarkeit gehoert HINTER die letzte Stelle,
      // an der der Spieler noch abbrechen kann. Hier ist das der
      // geglueckte Hand-Add eine Zeile darueber; danach laeuft die Karte
      // sicher durch.
      {
        const handIdx = (ps.hand || []).indexOf(CARD_NAME);
        engine._broadcastEvent('play_pile_transfer', {
          owner: pi, cardName: CARD_NAME, from: 'hand', to: 'discard',
          sfx: 'draw',
          ...(handIdx >= 0 ? { fromHandIdx: handIdx } : {}),
        });
        await engine._delay(240);
      }

      // ── ② Vier gleichnamige Karten zurueckmischen ────────────────
      // Nach der Suche neu bestimmen: die gesuchte Karte kam aus dem
      // DECK, der Ablagestapel ist unveraendert — aber ein Effekt
      // waehrend der Suche koennte ihn angefasst haben.
      const gruppenJetzt = namensGruppen(ps);
      if (gruppenJetzt.length === 0) { engine.sync(); return; }

      let name = gruppenJetzt[0];
      if (gruppenJetzt.length > 1) {
        const w = await engine.promptGeneric(pi, {
          type: 'optionPicker',
          title: CARD_NAME,
          description: `Which 4 cards go back into your deck?`,
          options: gruppenJetzt.map(n => ({ id: n, label: `4× ${n}` })),
          cancellable: false,
        });
        // ★ v1137: der Client antwortet mit `optionId` — derselbe
        // Fehler wie bei „Festive Werz", hier vorsorglich mitgefixt.
        const gewaehlt = w?.optionId ?? w?.id;
        if (gewaehlt && gruppenJetzt.includes(gewaehlt)) name = gewaehlt;
      }

      // ★ v1121 (Als Testbefund 15.9.: „Da fehlen aktuell die visuellen
      // Wege, wenn die Karten vom Discard wieder zurueck ins Deck
      // fliegen"). Vier Fluege, leicht versetzt, damit man sie einzeln
      // sieht statt als einen Klumpen.
      for (let k = 0; k < GRUPPE; k++) {
        // ★ FLUG VOR DER UMBUCHUNG — sonst startet er an einem Platz,
        // den es nicht mehr gibt (Weathercock-Lehre; „Future Tech Copy
        // Device" macht es an derselben Kante genauso). Mein erster
        // Entwurf hatte die Reihenfolge andersherum.
        engine._broadcastEvent('play_pile_transfer', {
          owner: pi, cardName: name, from: 'discard', to: 'deck',
          sfx: 'draw',   // v1122: Woosh je Karte (Al)
        });
        await engine._delay(180);
        const genommen = await engine.takeFromPile(pi, 'discard', name, { source: CARD_NAME });
        if (!genommen) break;
        ps.mainDeck.push(name);
      }
      await engine._delay(220);
      engine.shuffleDeck(pi, 'main');

      engine.log('brainstorming', {
        player: ps.username, searched: gesucht, shuffledBack: name,
      });
      engine.sync();
    },
  },

  /** CPU: die Gruppe mit den meisten Kopien zurueckmischen. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type !== 'optionPicker') return undefined;
    const id = (promptData.options || [])[0]?.id;
    return id ? { id } : undefined;
  },
};
