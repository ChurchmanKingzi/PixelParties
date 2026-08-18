// ═══════════════════════════════════════════
//  CARD EFFECT: "Infinitely Reproducing Slime"
//  Creature (Summoning Magic Lv0, Normal, Slimes) — 1 HP
//
//  "Your deck may contain any number of \"Infinitely Reproducing
//   Slime\". At the beginning of your turn, you may choose an
//   \"Infinitely Reproducing Slime\" from your hand or deck and place it
//   into the Support Zone of any Hero you control, but negate its
//   effect until the beginning of your next turn."
//
//  ── Zwei Haelften, zwei Orte ──
//  1. DIE DECKBAU-KLAUSEL steht NICHT hier. Deckbauregeln liegen im
//     Deck-Editor, nicht im Kartenskript (dieselbe Trennung wie bei
//     Nicolas und Cecilia): `UNLIMITED_COPY_CARDS` in
//     `public/app-shared.jsx` (`getCardMax` → Infinity) und dessen
//     Spiegel in `server.js` fuer den Deckgenerator. Die tatsaechliche
//     Schranke bleibt die Deckgroesse — 60 Hauptdeck, 15 Nebendeck.
//  2. DIE FORTPFLANZUNG steht hier: `onTurnStart` auf jedem Slime, der
//     auf dem Brett liegt.
//
//  ── Wer loest aus ──
//  Der Effekt gehoert dem Slime AUF DEM BRETT (`activeIn: ['support']`),
//  nicht der Karte auf der Hand. Der erste Slime muss also normal
//  beschworen werden; ab dann holt jeder liegende Slime zu Rundenbeginn
//  einen weiteren. Genau daher der Name: 1 → 2 → 4 → 8, gedeckelt
//  allein durch die freien Support-Zonen (drei Helden mal drei Plaetze).
//  ★ Das ist auch der Grund, warum Al diese Karte zusammen mit „Alice,
//  the Transfer Student" angefragt hat — Alice hebt genau diesen Deckel.
//
//  ── Die Negation ──
//  „negate its effect until the beginning of your next turn" ist exakt
//  das Necromancy-Muster: `actionNegateCreature` mit
//  `expiresAtTurn: gs.turn + 2` (die naechste eigene Runde) und
//  `expiresForPlayer: pi`. `selfInflicted: true`, weil der Spieler die
//  Negation selbst waehlt — das unterdrueckt die
//  Nach-Ablauf-Immunitaet, die nur gegen fremde CC gedacht ist, und
//  laesst Defending the Gate zu Recht stumm.
//  Der frisch gelegte Slime ist damit in DIESER Runde stumm; ab der
//  naechsten pflanzt er sich selbst fort.
//
//  ── Reihenfolge am Rundenbeginn ──
//  Die Engine laeuft die Instanzen der Reihe nach durch. Ein Slime, der
//  in DIESER Runde erst gelegt wird, kann also nicht mehr selbst
//  ausloesen — sein `onTurnStart` ist bereits vorbei oder er ist
//  negiert. Beides fuehrt zum selben, gewollten Ergebnis: eine
//  Verdopplung je Runde, keine Kettenreaktion innerhalb einer Runde.
//  Zur Sicherheit steht zusaetzlich ein Rundenstempel auf der Instanz.
//
//  ── Der Heldenzustand ist egal ──
//  „place" heisst: der Held der Zielzone muss nichts koennen. Auch ein
//  gefallener, eingefrorener oder betaeubter Held nimmt weiter Slimes
//  auf. Siehe die Regel im Kopf von `placementZones` — sie gilt
//  ALLGEMEIN fuer jede Karte, deren Text „place" sagt.
//
//  ── „from your hand or deck" ──
//  Beide Quellen in EINER Galerie, jede Karte mit ihrer Herkunft. Liegt
//  der Slime in beiden, erscheinen zwei Eintraege — Hand zuerst, damit
//  der Spieler seine Hand entlasten kann, ohne das Deck anzugreifen.
//  Kein `revealSearchedCards`: der Kartentext sagt nichts von Aufdecken,
//  und die Karte landet ohnehin sichtbar auf dem Brett.
// ═══════════════════════════════════════════

const CARD_NAME = 'Infinitely Reproducing Slime';

/**
 * Plaetze, auf die ein weiterer Slime darf.
 *
 * ★ ALS REGEL (18.8., ALLGEMEIN — nicht nur fuer diese Karte):
 * **Der Kartentext sagt „place". Bei „place" ist der Zustand des
 * zugehoerigen Helden komplett egal.** Tot, eingefroren, betaeubt,
 * gebunden, negiert, gar kein Held in der Spalte — die Support-Zone
 * bleibt ein gueltiges Ziel. „Summon" ist das Gegenteil: dort MUSS der
 * Held handlungsfaehig sein, weil er beschwoert.
 * Deshalb steht hier KEIN `livingHeroesOnly` mehr. Genau das war der
 * Fehler: der Slime konnte nicht zu einem gefallenen Helden nachlegen.
 *
 * `shareableFor` nimmt mit „Alice, the Transfer Student" zusaetzlich
 * jede Zone dazu, in der schon Slimes liegen — daran haengt die
 * Kombination: ohne Alice ist bei neun Zonen Schluss, mit ihr teilen
 * sich beliebig viele Slimes eine einzige.
 */
function placementZones(engine, pi) {
  return engine.getFreeSupportZones(pi, {
    shareableFor: CARD_NAME,
  });
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    onTurnStart: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const self = ctx.card;
      if (!self || self.zone !== 'support') return;
      // Nur zu Beginn der EIGENEN Runde.
      if (gs.activePlayer !== pi) return;
      // Negierte Slimes schweigen. (Die Engine filtert negierte
      // Instanzen aus dem Hook-Lauf bereits heraus; der Riegel steht
      // hier trotzdem, weil dieser Effekt der einzige Grund ist,
      // warum die Karte ueberhaupt negiert wird.)
      if (self.counters?.negated || self.counters?.nulled) return;
      // Ein Slime pflanzt sich hoechstens einmal je Runde fort.
      if (self.counters?._slimeSpawnedTurn === gs.turn) return;

      const ps = gs.players[pi];
      if (!ps) return;

      const zones = placementZones(engine, pi);
      if (zones.length === 0) return;

      // Kandidaten aus Hand UND Deck, Hand zuerst.
      const inHand = (ps.hand || []).filter(n => n === CARD_NAME).length;
      const inDeck = (ps.mainDeck || []).filter(n => n === CARD_NAME).length;
      if (inHand === 0 && inDeck === 0) return;
      const cards = [];
      if (inHand > 0) cards.push({ name: CARD_NAME, source: 'hand', count: inHand });
      if (inDeck > 0) cards.push({ name: CARD_NAME, source: 'deck', count: inDeck });

      const picked = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards,
        title: CARD_NAME,
        description: 'Place another Slime into a free Support Zone? (Its effect is negated until your next turn.)',
        confirmLabel: '🟢 Reproduce!',
        confirmClass: 'btn-success',
        cancellable: true,
      });
      if (!picked || picked.cancelled || picked.cardName !== CARD_NAME) return;
      const source = picked.source === 'deck' ? 'deck' : 'hand';
      // Nachpruefen: die gewaehlte Quelle muss die Karte wirklich noch
      // fuehren (zwischen Abfrage und Aufloesung kann sich etwas
      // verschoben haben).
      const pool = source === 'deck' ? ps.mainDeck : ps.hand;
      if (!Array.isArray(pool) || pool.indexOf(CARD_NAME) < 0) return;

      // Zielzone waehlen — bei nur einer freien Zone ohne Rueckfrage.
      let dest = zones[0];
      if (zones.length > 1) {
        const zonePick = await engine.promptGeneric(pi, {
          type: 'zonePick',
          zones: zones.map(z => ({ heroIdx: z.heroIdx, slotIdx: z.slotIdx, ownerIdx: pi })),
          title: CARD_NAME,
          description: 'Choose a free Support Zone for the new Slime.',
          cancellable: true,
        });
        if (!zonePick || zonePick.cancelled
            || typeof zonePick.heroIdx !== 'number' || typeof zonePick.slotIdx !== 'number') return;
        const match = zones.find(z => z.heroIdx === zonePick.heroIdx && z.slotIdx === zonePick.slotIdx);
        if (!match) return;
        dest = match;
      }

      // ★ `actionPlaceCreature` kennt nur die Quellen 'hand' und
      // 'discard' — fuer 'deck' gibt es KEINEN Zweig, die Karte bliebe
      // im Deck liegen und das Brett bekaeme eine Kopie obendrauf
      // (Kartenvervielfachung; im Repro aufgefallen). Fuer das Deck
      // nehmen wir die Karte deshalb selbst heraus, genau wie
      // `living-illusion.js` es tut, und melden die Decksuche an den
      // Client.
      if (source === 'deck') {
        const deckIdx = ps.mainDeck.indexOf(CARD_NAME);
        if (deckIdx < 0) return;
        ps.mainDeck.splice(deckIdx, 1);
        engine._broadcastEvent('deck_search_add', { cardName: CARD_NAME, playerIdx: pi });
      }

      // ★ `actionPlaceCreature` liefert `{ inst }`, NICHT die Instanz
      // selbst. Ohne das Auspacken laeuft die Negation gleich darunter
      // auf ein Objekt ohne `counters` — im Repro sofort aufgefallen.
      const placed = await engine.actionPlaceCreature(CARD_NAME, pi, dest.heroIdx, dest.slotIdx, {
        source,
        sourceName: CARD_NAME,
        selfPlacement: true,
      });
      const inst = placed?.inst || null;
      if (!inst) return;

      // „negate its effect until the beginning of your next turn" —
      // Necromancy-Muster. gs.turn ist die laufende eigene Runde, die
      // naechste eigene ist gs.turn + 2.
      await engine.actionNegateCreature(inst, CARD_NAME, {
        expiresAtTurn: gs.turn + 2,
        expiresForPlayer: pi,
        selfInflicted: true,
      });

      if (source === 'deck') engine.shuffleDeck(pi);
      self.counters = self.counters || {};
      self.counters._slimeSpawnedTurn = gs.turn;

      engine._broadcastEvent('play_zone_animation', {
        type: 'heart_burst', owner: pi, heroIdx: dest.heroIdx, zoneSlot: dest.slotIdx,
      });
      engine.log('slime_reproduce', {
        player: ps.username, from: source,
        heroIdx: dest.heroIdx, zoneSlot: dest.slotIdx,
      });
      engine.sync();
    },
  },
};
