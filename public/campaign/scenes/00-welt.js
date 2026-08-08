// ═══════════════════════════════════════════════════════════════════
//  DIE WELT — Orte, Figuren, zeitgebundene Ereignisse
// ═══════════════════════════════════════════════════════════════════
//  Diese Datei beschreibt, WO man sein kann und WER dort steht.
//  Was PASSIERT, steht in den Szenendateien daneben.
//
//  Alle SICHTBAREN Texte sind Englisch; die Bezeichner (Ort-Ids,
//  Figuren-Ids, Flags) bleiben, wie sie sind — sie stehen nie auf dem
//  Bildschirm, und ein Umbenennen würde alte Speicherstände brechen.
//
//  Koordinaten sind immer Prozent des Bildfelds:
//     x = waagerechte MITTE der Figur   (0 = links, 100 = rechts)
//     y = FUSSPUNKT der Figur           (100 = untere Bildkante)
//     h = Höhe in Feld-Pixeln (von 180) — je näher am Betrachter,
//         desto größer; ohne Angabe gilt Dateiauflösung / spriteUnit.
//  `objects` sind DINGE AUF DEM BILD und brauchen deshalb Koordinaten,
//  die zum Hintergrund passen — sinnvoll für Figuren (Sprite) und für
//  Klickflächen, die du selbst auf ein Bilddetail legst (w/h in Prozent).
//  `actions` sind dagegen ortsgebundene Handlungen OHNE Koordinaten:
//  sie erscheinen als Knopfleiste links unter der Uhr. Alles, was kein
//  sichtbares Objekt ist (schlafen, Deck bauen, sich umsehen), gehört
//  dorthin — dann hängt nichts daran, ob eine geratene Fläche zufällig
//  über der richtigen Stelle liegt.
// ═══════════════════════════════════════════════════════════════════

world({
  title: 'Seren Academy',

  // Sprites und Portraits liegen als 10-fach vergrößerte Pixelart vor.
  // Ändere das nur, wenn du Dateien in nativer Auflösung ablegst.
  assets: { spriteUnit: 10, avatarUnit: 10 },

  start: {
    location: 'schiff',
    day: 1,
    time: '09:00',
    coins: 0,
    deck: 'spieler_start',      // public/campaign/decks/spieler_start.txt
  },

  music: 'menu',                 // Standardmusik, wenn ein Ort nichts sagt
  defaultTravel: 10,             // Minuten je Ortswechsel, wenn nichts anderes dasteht

  dayEnd: { at: '23:00', wake: '07:30', scene: 'schlafen', location: 'zimmer' },

  // ── Figuren ────────────────────────────────────────────────────
  cast: {
    ich:     { name: 'You',     portrait: null,      color: '#00f0ff' },
    tobi:    { name: 'Tobi',    portrait: 'Tobi',    sprite: 'Tobi',    color: '#ffe14d', h: 62 },
    wendy:   { name: 'Wendy',   portrait: 'Wendy',   sprite: 'Wendy',   color: '#c98b5a', h: 60 },
    mithuru: { name: 'Mithuru', portrait: 'Mithuru', sprite: 'Mithuru', color: '#b08b3a', h: 66 },
    ethan:   { name: 'Ethan',   portrait: 'Ethan',   sprite: 'Ethan',   color: '#7ee081', h: 64, side: 'right' },
    ellie:   { name: 'Ellie',   portrait: 'Ellie',   sprite: 'Ellie',   color: '#c58bff', h: 60 },
    crum:    { name: 'Crum',    portrait: 'Crum',    sprite: 'Crum',    color: '#6cc0ff', h: 56 },
  },

  // ── Orte ───────────────────────────────────────────────────────
  locations: {
    schiff: {
      name: 'Ferry Deck',
      background: 'bg_ship',
      known: true,
      music: 'menu',
      lockedText: 'The ferry has left',
      onArrive: 'prolog',
      // Diese beiden Figuren stehen NACH dem Prolog auf dem Deck und
      // sind anklickbar: kurzer Dialog, dann ein Duell mit Münzen.
      objects: [
        { id: 'wendy',   sprite: 'Wendy',   x: 27, y: 99, h: 74, label: 'Wendy',   scene: 'ferry_wendy' },
        { id: 'mithuru', sprite: 'Mithuru', x: 70, y: 93, h: 64, flip: true, label: 'Mithuru', scene: 'ferry_mithuru' },
      ],
      actions: [
        { id: 'railing', label: 'Look over the railing',
          text: 'The mainland is a thin grey line by now. Whatever you brought with you is all you get for a while.' },
      ],
    },

    hafen: {
      name: 'Seren Harbour',
      background: 'bg_dock',
      // Von Anfang an in der Ortsliste: von Bord zu gehen läuft über
      // dasselbe Menü wie jeder andere Weg, statt über eine Klickfläche
      // auf dem Schiffsbild.
      known: true,
      travel: 20,
      onArrive: 'go_ashore',
      actions: [
        { id: 'meer', label: 'Look out to sea',
          text: 'The ferry is already pulling away. No way back this week — not that anyone here would call that a problem.' },
        { id: 'kisten', label: 'Check the cargo crates', when: { notFlag: 'kisten_gesehen' },
          text: 'Card shipments for the Academy. Somebody has already broken the seals.',
          time: 5, flag: 'kisten_gesehen' },
      ],
    },

    dorf: {
      name: 'Island Village',
      background: 'bg_village',
      travel: 12,
      actions: [
        { id: 'laden', label: 'Try the card shop',
          text: 'Closed. A note on the door reads: *"Restock arrives Friday."*' },
      ],
    },

    akademie: {
      name: 'Seren Academy',
      background: 'bg_castle',
      travel: 15,
      travelFrom: { hafen: 20, hof: 2, halle: 2 },
    },

    hof: {
      name: 'Courtyard',
      background: 'bg_courtyard',
      travel: 5,
      travelFrom: { akademie: 2, halle: 3, bibliothek: 3, wohnheim: 3 },
      actions: [
        { id: 'brunnen', label: 'Read the fountain rim',
          text: 'Generations of students have carved their names into the rim. Some of them have been crossed out.' },
      ],
    },

    halle: {
      name: 'Duel Hall',
      background: 'bg_hall',
      travel: 8,
      travelFrom: { hof: 3, akademie: 2 },
      music: 'menu',
      // Beim ersten Betreten stellt sich Ethan quer (Pflichtduell).
      onArrive: 'ethan_halle',
    },

    bibliothek: {
      name: 'Library',
      background: 'bg_library',
      travel: 8,
      travelFrom: { hof: 3 },
      // Öffnungszeiten — ein Ort, der nachts schlicht nicht geht.
      when: { from: '08:00', to: '21:00' },
      closedText: 'Closed (open 8–21)',
    },

    wohnheim: {
      name: 'Dorm Common Room',
      background: 'bg_dorm2',
      travel: 8,
      travelFrom: { hof: 3, zimmer: 1 },
    },

    zimmer: {
      name: 'Your Room',
      background: 'bg_dorm1',
      travel: 9,
      travelFrom: { wohnheim: 1 },
      onArrive: [{ scene: 'zimmer_erstmals' }],
      // Hier hängt alles an `actions`: der Schreibtisch ist der EINZIGE
      // Ort, an dem das Kampagnen-Deck bearbeitet werden kann.
      actions: [
        { id: 'schreibtisch', label: 'Edit Deck', deckEdit: true },
        { id: 'bett', label: 'Sleep until morning', scene: 'schlafen' },
        { id: 'fenster', label: 'Look out the window', when: { notFlag: 'huegel_gehoert' },
          text: 'You can see the hill behind the Academy from here. They say it turns completely gold at sunset.',
          flag: 'huegel_gehoert', learn: 'huegel' },
      ],
    },

    huegel: {
      name: 'Hill Behind the Academy',
      background: 'bg_hill',
      travel: 20,
      travelFrom: { hof: 15, akademie: 15 },
    },

    kueste: {
      name: 'Coast Path',
      background: 'bg_plains',
      travel: 14,
    },
  },

  // ── Zeitgebundene Ereignisse ───────────────────────────────────
  // Werden geprüft, sobald der Spieler an dem Ort ANKOMMT. Ist das
  // Zeitfenster vorbei, passiert nichts mehr — solche Ereignisse
  // kann man also endgültig VERPASSEN. Genau dafür ist die Uhr da.
  events: [
    {
      id: 'ellie_sonnenuntergang',
      scene: 'ellie_huegel',
      at: 'huegel',
      from: '17:00', to: '19:00',
      day: 1,
      once: true,
    },
    {
      id: 'mithuru_bibliothek',
      scene: 'mithuru_bibliothek',
      at: 'bibliothek',
      from: '10:00', to: '20:00',
      once: true,
    },
  ],
});
