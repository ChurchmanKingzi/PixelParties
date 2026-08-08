// ═══════════════════════════════════════════════════════════════════
//  PROLOG UND FÄHRDECK
// ═══════════════════════════════════════════════════════════════════
//  Eine Szene ist eine flache Liste von Schritten, die von oben nach
//  unten abgearbeitet wird. Jeder Schritt ist ein Objekt; welches Feld
//  du setzt, entscheidet, was passiert:
//
//    { text: '…' }                       Erzähler
//    { say: 'tobi', text: '…' }          Figur spricht (aus `cast`)
//    { think: '…' }                      Gedanke des Spielers
//    { bg: 'bg_dock' }                   Hintergrund wechseln
//    { enter: 'tobi', x: 30, h: 62 }     Figur betritt die Bühne
//    { move: 'tobi', x: 60, ms: 600 }    Figur geht (wartet automatisch)
//    { exit: 'tobi' }                    Figur geht ab
//    { wait: 700 }                       Pause
//    { fx: 'shake' | 'flash' | 'fadeout' | 'fadein' }
//    { time: 30 }                        30 Minuten vergehen
//    { flag: 'x' } { unflag: 'x' }       Story-Flag setzen/löschen
//    { set: { name: 'wert' } }           Variable
//    { item: 'Room key' }                Gegenstand (n: -1 nimmt weg)
//    { coins: 50 }                       Kampagnen-Münzen
//    { card: 'Coffee', n: 2 }            Karten in die Sammlung
//    { learn: 'huegel' }                 Ort bekannt machen
//    { lock: 'schiff' } { unlock: 'halle' }
//    { goto: 'hafen' }                   Spieler an einen Ort setzen
//    { music: 'bgm_hel' }                Musik (Datei in public/music)
//    { choice: [ { text: '…', goto: 'marke' } ] }
//    { label: 'marke' } { jump: 'marke' }
//    { scene: 'andere_szene' }           andere Szene einschieben
//    { deckEdit: true }                  Deck-Editor öffnen
//    { duel: … }                         siehe unten
//    { end: true }                       Szene beenden
//
//  Jeder Schritt darf zusätzlich `when` tragen und wird übersprungen,
//  wenn die Bedingung nicht zutrifft:
//    when: { flag: 'x' } | { notFlag: 'x' } | { from: '17:00', to: '19:00' }
//    when: { day: 2 } | { duelWon: 'tobi_1' } | { item: 'Room key' }
//    when: (s) => s.vars.mut > 3        (freie Funktion, wenn's komplex wird)
// ═══════════════════════════════════════════════════════════════════

scene('prolog', {
  once: true,
  music: 'menu',
  steps: [
    { bg: 'bg_ship' },
    { text: 'Two hours of open water, and there it is: Seren. One island, one harbour, one school — and, so they say, the sharpest duelists of your year.' },
    { think: 'Sixty cards and three Heroes. That is the whole of what I brought.' },

    { enter: 'tobi', x: 78, y: 100, flip: true },
    { wait: 400 },
    { say: 'tobi', text: 'Hey! You are new too, right?' },
    { move: 'tobi', x: 62, ms: 700 },
    { say: 'tobi', text: 'You can always tell. New ones stare at the water instead of the island.' },
    { say: 'ich', text: 'And you stare at the new ones.' },
    { say: 'tobi', text: 'Heh. Fair.' },
    { say: 'tobi', text: 'Tobi. Second year — well, *almost*. I did the first one twice.' },

    {
      prompt: 'What do you say?',
      choice: [
        { text: '"Impressive."', goto: 'frech', hint: 'Cheeky' },
        { text: '"So you know your way around, then."', goto: 'freundlich', hint: 'Friendly' },
        { text: 'Say nothing.', goto: 'still' },
      ],
    },

    { label: 'frech' },
    { say: 'tobi', text: 'Ha! I like that one. The polite ones only last a fortnight around here anyway.' },
    { flag: 'tobi_frech' },
    { jump: 'weiter' },

    { label: 'freundlich' },
    { say: 'tobi', text: 'Better than anyone. Ask me anything. Except about exams.' },
    { flag: 'tobi_freund' },
    { jump: 'weiter' },

    { label: 'still' },
    { say: 'tobi', text: '…all right. The quiet type. We could use more of those.' },
    { jump: 'weiter' },

    { label: 'weiter' },
    { say: 'tobi', text: 'We dock in a bit. And before you ask: yes, they test you straight away.' },
    { say: 'tobi', text: 'Not the teachers. *Us.*' },
    { wait: 500 },
    { say: 'tobi', text: 'So — one duel? Right here on the deck. Nobody is watching.' },

    // ── DUELL ────────────────────────────────────────────────────
    // duel:         eindeutige Kennung (landet im Speicherstand)
    // opponent:     Dateiname in public/campaign/decks (ohne .txt)
    // opponentName: Anzeigename im Kampf
    // mustWin:      true  -> Niederlage = Ende, Rücksetzpunkt
    // ante:         true  -> Kartensatz: der Sieger nimmt sich eine
    //                       Karte aus dem Bestand des Verlierers.
    //                       VORHER in der Szene aushandeln!
    // onWin/onLose: Schrittlisten, die danach laufen
    // reward:       { coins, items:{}, cards:{}, flags:[] } bei Sieg
    {
      duel: 'tobi_1',
      opponent: 'tobi',
      opponentName: 'Tobi',
      mustWin: false,
      reward: { coins: 120, cards: { 'Coffee': 1 }, flags: ['tobi_besiegt'] },
      onWin: [
        { say: 'tobi', text: 'Okay. *Okay!* That was not the warm-up I signed up for.' },
        { say: 'tobi', text: 'Here, take this. Coffee. You are going to need it, trust me.' },
        { text: 'You receive **1x Coffee** and **120 coins**.' },
      ],
      onLose: [
        { say: 'tobi', text: 'See? Two first years is still experience.' },
        { say: 'tobi', text: 'Chin up — everyone loses on day one. Almost everyone.' },
        { flag: 'tobi_verloren' },
      ],
    },

    { say: 'tobi', text: 'I am going below to grab my bag. Talk to the others while you can — once we land, everyone scatters.' },
    { exit: 'tobi' },
    { text: 'Two more passengers are out on deck. When you are ready, the places list in the bottom right will take you ashore.' },
    { end: true },
  ],
});

// ═══════════════════════════════════════════════════════════════════
//  DIE BEIDEN ANKLICKBAREN FIGUREN AUF DEM DECK
// ═══════════════════════════════════════════════════════════════════
//  Sie hängen als `objects` am Ort `schiff` (siehe 00-welt.js) und
//  rufen jeweils diese Szene auf. Muster für "einmal richtig, danach
//  nur noch ein Satz": der erste Schritt trägt ein `when` auf das Flag
//  und beendet die Szene sofort wieder.
// ═══════════════════════════════════════════════════════════════════

scene('ferry_wendy', {
  steps: [
    // Schon geredet? Dann nur ein kurzer Satz.
    { when: { flag: 'wendy_ferry_done' }, say: 'wendy',
      text: 'Still counting my cards. It is calming. Go on ahead.', end: true },

    { say: 'wendy', text: 'Oh — sorry. I was counting again.' },
    { say: 'wendy', text: 'Wendy. First year. I have shuffled this deck about nine times since we left port.' },
    { say: 'ich', text: 'Nervous?' },
    { say: 'wendy', text: 'Terrified. Everyone on this boat has been playing since they could hold a card.' },
    {
      prompt: 'How do you answer?',
      choice: [
        { text: '"So have I. That is why I am here."', goto: 'w_stolz' },
        { text: '"Then we are even. I am scared too."', goto: 'w_ehrlich' },
      ],
    },

    { label: 'w_stolz' },
    { say: 'wendy', text: '…right. Of course you have.' },
    { flag: 'wendy_stolz' },
    { jump: 'w_duell' },

    { label: 'w_ehrlich' },
    { say: 'wendy', text: 'Oh thank goodness. I thought it was just me.' },
    { flag: 'wendy_ehrlich' },
    { jump: 'w_duell' },

    { label: 'w_duell' },
    { say: 'wendy', text: 'Could we… try one? Just a short one. I would rather lose to you than to a stranger on the island.' },
    { say: 'ich', text: 'We *are* strangers.' },
    { say: 'wendy', text: 'Not after this.' },
    {
      duel: 'wendy_ferry',
      opponent: 'wendy',
      opponentName: 'Wendy',
      mustWin: false,
      rewardWin: { coins: 150, flags: ['wendy_besiegt'] },
      onWin: [
        { say: 'wendy', text: 'That was… actually fun. I forgot to be scared for a whole minute.' },
        { text: 'You receive **150 coins**.' },
      ],
      onLose: [
        { say: 'wendy', text: 'I won? I won! Sorry — I mean, good game. Really good game.' },
      ],
    },
    { flag: 'wendy_ferry_done' },
    { time: 15 },
    { end: true },
  ],
});

scene('ferry_mithuru', {
  steps: [
    { when: { flag: 'mithuru_ferry_done' }, say: 'mithuru',
      text: 'Data logged. See you on the island.', end: true },

    { say: 'mithuru', text: 'Forty-one. Forty-two.' },
    { say: 'ich', text: 'Counting what?' },
    { say: 'mithuru', text: 'Passengers. Every year I count them, and every year fewer go back on the same boat.' },
    { say: 'mithuru', text: 'Mithuru. I keep records of every duel on Seren. It is not a hobby, it is a discipline.' },
    { say: 'mithuru', text: 'You are unmeasured. That bothers me. Fix it — one duel, right now, and you exist in my numbers.' },
    {
      prompt: 'Well?',
      choice: [
        { text: '"Fine. Measure this."', goto: 'm_duell' },
        { text: '"What do I get out of it?"', goto: 'm_handel' },
        { text: '"Make it an ante. Winner takes a card."', goto: 'm_ante', hint: 'For keeps' },
      ],
    },

    { label: 'm_handel' },
    { say: 'mithuru', text: 'A number. And whatever is left in my pocket, since apparently that is what motivates people.' },
    { set: { mithuru_bezahlt: true } },
    { jump: 'm_duell' },

    // ── ANTE-ZWEIG ──
    // Das Einverständnis wird hier ausgehandelt; `ante: true` am
    // Duellschritt macht daraus einen echten Kartensatz.
    { label: 'm_ante' },
    { say: 'mithuru', text: 'An ante. Before you have even set foot on the island.' },
    { wait: 500 },
    { say: 'mithuru', text: 'You understand what that means? The winner takes a card out of the loser\'s deck. It does not come back.' },
    { say: 'ich', text: 'I understand.' },
    { say: 'mithuru', text: 'Then it is agreed. Both decks are on the table.' },
    { flag: 'mithuru_ante_vereinbart' },
    {
      duel: 'mithuru_ferry_ante',
      opponent: 'mithuru',
      opponentName: 'Mithuru',
      ante: true,
      mustWin: false,
      rewardWin: { coins: 220, flags: ['mithuru_ferry_gewonnen'] },
      onWin: [
        { say: 'mithuru', text: 'Take it. A deck that loses a card and still works was carrying it for nothing.' },
        { say: 'mithuru', text: 'Mine was not. I will feel that one.' },
      ],
      onLose: [
        { say: 'mithuru', text: 'Recorded. And thank you — I have wanted that card for a while.' },
        { say: 'mithuru', text: 'Your deck is one short now. Fix it before you duel again, or you will not be duelling at all.' },
        { flag: 'ante_verloren' },
      ],
    },
    { flag: 'mithuru_ferry_done' },
    { time: 20 },
    { end: true },

    { label: 'm_duell' },
    {
      duel: 'mithuru_ferry',
      opponent: 'mithuru',
      opponentName: 'Mithuru',
      mustWin: false,
      rewardWin: { coins: 180, flags: ['mithuru_ferry_gewonnen'] },
      onWin: [
        { say: 'mithuru', text: 'Recorded. You play three turns ahead and then stop thinking. Interesting flaw.' },
        { coins: 70, when: (s) => !!s.vars.mithuru_bezahlt },
        { text: 'You receive **70 extra coins** — he pays what he promised.', when: (s) => !!s.vars.mithuru_bezahlt },
        { text: 'You receive **180 coins**.' },
      ],
      onLose: [
        { say: 'mithuru', text: 'Recorded. My prediction was 68 percent. It is unsatisfying to be right this often.' },
      ],
    },
    { flag: 'mithuru_ferry_done' },
    { time: 15 },
    { end: true },
  ],
});

// ── VON BORD GEHEN ────────────────────────────────────────────────
// Läuft als ANKUNFTSSZENE des Hafens: der Weg dorthin geht über die
// Ortsliste wie jeder andere auch. Erst hier lernt der Spieler die
// Orte der Insel — vorher stehen in der Liste nur Deck und Hafen.
scene('go_ashore', {
  once: true,
  steps: [
    { text: 'The ferry ties up. The harbour smells of kelp, hot metal and cheap card sleeves.' },

    { enter: 'crum', x: 30, y: 100 },
    { say: 'crum', text: 'STOP. Name list. You are late.' },
    { say: 'ich', text: '…is the penguin talking?' },
    { say: 'crum', text: 'The penguin is **Crum**, dorm supervisor, and the penguin has had a long day.' },
    { say: 'crum', text: 'Room in the dormitory. Key here. And remember one thing:' },
    { say: 'crum', text: 'On Seren it is not only *what* you do that counts, but *when*. Lights out at 23:00, and whatever you did not get done by then simply was not important enough.' },
    { item: 'Room key' },
    { learn: 'akademie' },
    { learn: 'hof' },
    { learn: 'wohnheim' },
    { learn: 'zimmer' },
    { learn: 'halle' },
    { learn: 'bibliothek' },
    { learn: 'dorf' },
    { learn: 'kueste' },
    { lock: 'schiff' },
    { say: 'crum', text: 'You have the island in your head now. Bottom right. Get moving.' },
    { exit: 'crum' },
    { text: 'The clock in the top left runs from here on. Every walk costs time.' },
    { end: true },
  ],
});

scene('zimmer_erstmals', {
  once: true,
  steps: [
    { text: 'A bed, a desk, a window. Your deck lies fanned out on the table, neatly sorted, as if someone had done it for you.' },
    { say: 'ich', text: 'Home, I suppose.' },
    { text: 'At the desk — and **only** here — you can rebuild your campaign deck.' },
    { end: true },
  ],
});

scene('schlafen', {
  steps: [
    { fx: 'fadeout', ms: 700 },
    { text: 'You lie down. A bell rings somewhere outside, someone laughs too loudly, and then it is quiet.' },
    { run: (s) => { s.day += 1; s.minutes = 7 * 60 + 30; } },
    { goto: 'zimmer' },
    { fx: 'fadein', ms: 700 },
    { text: 'A new day on Seren.' },
    { end: true },
  ],
});
