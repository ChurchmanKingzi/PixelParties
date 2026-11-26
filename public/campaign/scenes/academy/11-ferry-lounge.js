// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
// Der Runner muss Texte als Funktion erlauben (text: (s) => …, ausgewertet mit dem Spielstand) und beim card-Schritt die Seltenheit (rarity) beachten; s.deck = Rowans aktuelles Deck, s.owned = Sammlung je Seltenheit.
scene("lounge_plate", {
  steps: [
    {
      text: "The brass plate is screwed to the edge of the table and polished by a thousand sleeves. It reads, in small engraved capitals:"
    },
    { text: "WINNER STAYS" },
    {
      text: "Underneath, in a smaller and much more recent hand, somebody has scratched with a key: *(he doesn't have to play you though)*. On the bench behind it, four matched cases wait beside a neat card: STAKES: THE LOSER CARRIES THE WINNER'S LUGGAGE UP THE HILL."
    },
    { think: "The plate says who keeps the seat. It says nothing about who gets to sit down opposite." },
    { flag: "read_plate" },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_2" },
    {
      say: "nathan",
      text: "\"WINNER STAYS. That's the best rule I've ever read! Why don't we have that rule everywhere?\"",
      mood: "happy"
    },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_4" },
    { say: "baylee", text: "\"Because you would never leave the table.\"" },
    { label: "next_4" },
    { label: "end_3" },
    { label: "next_2" },
    { label: "end_1" },
    { time: 2 }
  ]
});

scene("lounge_watch", {
  steps: [
    { when: (s)=>!(!!s.flags["table_resolved"]), jump: "next_2" },
    {
      text: "Gideon has gone back to squaring his deck. The crowd has thinned. There is nothing left to watch that you have not already seen."
    },
    { end: true },
    { label: "next_2" },
    { label: "end_1" },
    { when: (s)=>!(!!s.flags["saw_counter"]), jump: "next_4" },
    { text: "You have seen enough of how he plays." },
    { end: true },
    { label: "next_4" },
    { label: "end_3" },
    {
      text: "A freckled deckhand on his break, a mug of tea in one hand and a deck of cards in the other, says, \"Go on, then. One. I've got eleven minutes.\""
    },
    { text: "Gideon inclines his head a quarter of an inch. \"How kind.\"" },
    { text: "You find a spot at the rail of the crowd where you can see both hands." },
    { text: "The deckhand leads with everything he has: an attack on turn one, another on turn two, a Creature behind it. Gideon does nothing. He builds." },
    { text: "A single Guardian Beast, two, then a third, set one beside the other like fence posts. The deckhand commits again on turn three and the board blinks." },
    {
      text: "Gideon has not attacked once. He has not needed to. Every blow the deckhand swung came back at him, and then some."
    },
    { text: "The game ends on turn five." },
    {
      think: "He never attacks first. He sits behind the Guardians and lets you commit. He wins entirely on the counter-swing."
    },
    { think: "Which means the only way to beat him is to wait. Longer than he can." },
    { text: "The deckhand looks at the board for a while, shrugs, finishes his tea and goes back to work." },
    {
      text: "Gideon looks up, finds you across the felt, and for a half-second something very quiet and very attentive lives behind his grey eyes."
    },
    { say: "gideon", alias: "Boy in white gloves", text: "\"Did you find that instructive?\"" },
    { flag: "saw_beasts" },
    {
      choice: [
        { text: "\"Very. You build well.\"", goto: "opt_6" },
        { text: "\"Not especially. Nothing happened.\"", goto: "opt_7" }
      ]
    },
    { jump: "choiceend_5" },
    { label: "opt_6" },
    { say: "rowan", text: "\"Very. You build well.\"" },
    { say: "gideon", alias: "Boy in white gloves", text: "\"How resourceful of you to notice.\"" },
    { jump: "choiceend_5" },
    { label: "opt_7" },
    { say: "rowan", text: "\"Not especially. Nothing happened.\"" },
    { say: "gideon", alias: "Boy in white gloves", text: "\"A pity. It is the whole of the art.\"" },
    { jump: "choiceend_5" },
    { label: "choiceend_5" },
    { flag: "saw_counter" },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_9" },
    { say: "nathan", text: "\"GO ON, DECKHAND! GO ON!\"", mood: "happy" },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_11" },
    { say: "baylee", text: "\"He's drinking tea, Nathan. He lost.\"" },
    { label: "next_11" },
    { label: "end_10" },
    { label: "next_9" },
    { label: "end_8" },
    { time: 25 }
  ]
});

scene("lounge_galley", {
  steps: [
    {
      text: "A galley hatch with a hand-lettered sign: COFFEE 2 · CINNAMON ROLL 3. A cheerful woman in an apron is working it with the weary patience of someone who has watched four hundred first-years pretend not to be hungry."
    },
    {
      choice: [
        { text: "Buy a coffee. (2 Smug Coins)", goto: "opt_2", when: (s)=>((s.coins||0)>=2) },
        { text: "Buy a cinnamon roll. (3 Smug Coins)", goto: "opt_3", when: (s)=>((s.coins||0)>=3) },
        { text: "Leave it.", goto: "opt_4" }
      ]
    },
    { jump: "choiceend_1" },
    { label: "opt_2" },
    { coins: -2 },
    {
      text: "The coffee is dreadful, scalding and the best thing that has happened to you since breakfast. You wrap both hands round the cup."
    },
    { flag: "had_coffee" },
    { jump: "choiceend_1" },
    { label: "opt_3" },
    { coins: -3 },
    {
      text: "The roll is soft, warm, and slightly flattened where somebody stacked something on it. You eat it in four bites and feel almost optimistic."
    },
    { flag: "had_roll" },
    { jump: "choiceend_1" },
    { label: "opt_4" },
    { text: "Eight Smug Coins' worth of will power. You move off." },
    { jump: "choiceend_1" },
    { label: "choiceend_1" },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_6" },
    { say: "nathan", text: "\"A ROLL! Rowan, do you have three coins? I have… a button.\"", mood: "happy" },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_8" },
    { say: "baylee", text: "\"No.\"" },
    { label: "next_8" },
    { label: "end_7" },
    { label: "next_6" },
    { label: "end_5" },
    { time: 3 }
  ]
});

scene("lounge_benches", {
  steps: [
    {
      text: "The padded benches run the whole length of the saloon, and every one of them has a duffel on it and a gap beneath. You get down on one knee and work your way along."
    },
    {
      text: "A tin whistle. A sock. Eleven pretzel crumbs, arranged almost artistically. And, behind the third duffel, a heavy teal stapler with TEOBALT F. stencilled neatly on its base, and below that, in smaller letters, IF FOUND, PLEASE STAPLE NOTHING."
    },
    { think: "Somebody on this ship is missing this very badly." },
    { item: "Teobalt's stapler" },
    { flag: "found_stapler" },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_2" },
    { say: "nathan", text: "\"What are you looking for? Is it a sock? I lost a sock!\"", mood: "grin" },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_4" },
    { say: "baylee", text: "\"You lost four.\"" },
    { label: "next_4" },
    { label: "end_3" },
    { label: "next_2" },
    { label: "end_1" },
    { time: 6 }
  ]
});

scene("lounge_binder", {
  steps: [
    {
      text: "On the bench by the galley lies a trade binder, left open on its back, unattended. Someone has written TRADES — ASK TOMI in marker on the cover."
    },
    {
      text: "You page through it. Every sleeve holds a card, every card has a price in pencil, and every price has been crossed out and rewritten at least once. The cheapest is a common at one Smug Coin. The most expensive is a rare at fourteen, and it has a sleeve of its own."
    },
    {
      text: "You find, tucked into the back pocket, a small notebook. On the first page: a column of initials and numbers. G.P. 3–0. Then, next to it, in smaller letters: *never first. counters. 3 for 3.*"
    },
    { text: "You close it. It is not yours, and you have a conscience, or at least a very strict aunt." },
    { flag: "saw_counter" },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_2" },
    {
      say: "nathan",
      text: "\"Is that Tomi's binder? You can't touch it, it's CURSED, it takes your coins!\"",
      mood: "happy"
    },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_4" },
    { say: "baylee", text: "\"That is a rumour.\"" },
    { label: "next_4" },
    { label: "end_3" },
    { label: "next_2" },
    { label: "end_1" },
    { time: 5 }
  ]
});











scene("table_vouch", {
  background: "ferry_lounge",
  steps: [
    { when: (s)=>!(!!s.flags["table_resolved"]), jump: "next_2" },
    { end: true },
    { label: "next_2" },
    { label: "end_1" },
    { flag: "vouch_tried" },
    { text: "You cross to the brass-rimmed table. The boy in the white gloves does not look up." },
    { say: "rowan", text: "\"I'd like to speak for Inya Bell.\"" },
    { say: "gideon", text: "\"How kind. And what, exactly, is your standing?\"" },
    {
      when: (s)=>!(((!!s.flags["beat_magnus"]||!!s.flags["beat_georgie"])||!!s.flags["beat_ashton"])),
      jump: "next_4"
    },
    {
      choice: [
        {
          text: "\"I've beaten people of standing aboard this ship this morning, and I'd say she plays at least as well. Take my word for it, or ask them.\"",
          goto: "opt_6"
        },
        {
          text: "\"Never mind my standing. She's waited twenty minutes and she's beaten three people. That should be enough for anyone.\"",
          goto: "opt_7"
        }
      ]
    },
    { jump: "choiceend_5" },
    { label: "opt_6" },
    {
      say: "rowan",
      text: "\"I've beaten people of standing aboard this ship this morning, and I'd say she plays at least as well. Take my word for it, or ask them.\""
    },
    { text: "A pause. The grey eyes narrow, thoughtfully." },
    { say: "gideon", text: "\"I did hear that Prospero's tablet recorded something unusual.\"" },
    { text: "Or Santa. Or Beaumont-Lyle. He does not say which." },
    {
      say: "gideon",
      text: "\"Very well. A voucher is only as good as the vouchee's wins, and yours are on record. Miss Bell. Sit.\""
    },
    { flag: "inya_qualified" },
    {
      add: { aff_gideon: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "gideon", n: 1, why: "Backed up with results" }); }
    },
    {
      add: { aff_inya: 3 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 3, why: "Vouched for her" }); } },
    { scene: "table_inya_vs_gideon" },
    { jump: "choiceend_5" },
    { label: "opt_7" },
    {
      say: "rowan",
      text: "\"Never mind my standing. She's waited twenty minutes and she's beaten three people. That should be enough for anyone.\""
    },
    {
      say: "gideon",
      text: "\"Three nobodies, by her own account.\" Mild. \"It does not become more with repetition.\""
    },
    {
      add: { aff_gideon: 0 }
    },
    {
      add: { aff_inya: 1 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 1, why: "Tried for her" }); } },
    { jump: "choiceend_5" },
    { label: "choiceend_5" },
    { jump: "end_3" },
    { label: "next_4" },
    {
      choice: [
        {
          text: "\"I haven't played anybody yet, if I'm honest. But I'd put my word behind her anyway. She seems to me very good.\"",
          goto: "opt_10"
        },
        {
          text: "\"She's earned a game by standing there. Isn't that enough for a table that says winner stays?\"",
          goto: "opt_11"
        }
      ]
    },
    { jump: "choiceend_9" },
    { label: "opt_10" },
    {
      say: "rowan",
      text: "\"I haven't played anybody yet, if I'm honest. But I'd put my word behind her anyway. She seems to me very good.\""
    },
    { say: "gideon", text: "\"An honest man. How rare. And how entirely without effect.\"" },
    {
      say: "gideon",
      text: "\"A voucher is only as good as his wins. Beat somebody of standing aboard this ship, Vance, and I shall listen to you with great attention.\""
    },
    {
      add: { aff_gideon: 1 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "gideon", n: 1, why: "Was honest" }); } },
    {
      add: { aff_inya: 1 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 1, why: "Tried for her" }); } },
    { jump: "choiceend_9" },
    { label: "opt_11" },
    {
      say: "rowan",
      text: "\"She's earned a game by standing there. Isn't that enough for a table that says winner stays?\""
    },
    { say: "gideon", text: "\"It says who stays. I have always found it a very fair plate.\"" },
    {
      add: { aff_gideon: 0 }
    },
    { jump: "choiceend_9" },
    { label: "choiceend_9" },
    { label: "end_3" },
    { time: 5 }
  ]
});

scene("table_settle", {
  background: "ferry_lounge",
  steps: [
    { when: (s)=>!(!!s.flags["table_resolved"]), jump: "next_2" },
    { end: true },
    { label: "next_2" },
    { label: "end_1" },
    { when: (s)=>!(!!!s.flags["noor_ruled"]), jump: "next_4" },
    { think: "I don't know enough about the plate to argue it. Somebody on this ship does." },
    { end: true },
    { label: "next_4" },
    { label: "end_3" },
    { text: "You cross the saloon to the bench where Noor is reading. She looks up at once." },
    { say: "rowan", text: "\"If a second table isn't forbidden — \"" },
    { say: "noor", text: "\"It is not.\"" },
    { say: "rowan", text: "\"Then I'd like to build one.\"" },
    { say: "noor", text: "\"To be precise,\"" },
    { text: "and there is, for the first time, something almost like delight under the dry courtesy," },
    { say: "noor", text: "\"you may use the hatch side. The benches are bolted in. You will need a bag.\"" },
    {
      text: "Between you, you pull two benches into an L, set a duffel across the gap, and lay a rolled-up jacket on top for a surface. It wobbles. You smooth it with both hands."
    },
    { say: "inya", text: "\"That's the worst table I've ever seen.\"" },
    { text: "But she has already sat down on one end of it." },
    { say: "rowan", text: "\"Gideon.\"" },
    { text: "You say it loud enough to carry." },
    { say: "rowan", text: "\"There's a free table at the galley end. No luggage. A game for the plate.\"" },
    {
      text: "A silence. He looks at the new table. At Noor, standing beside it with her rulebook open to a marked page. At the crowd, who are starting, slowly, to look at the new table too."
    },
    { text: "The room has two centres. His is no longer the only one." },
    { say: "noor", text: "\"To be precise, a winner who declines every challenger has not defended the seat.\"" },
    { say: "gideon", text: "\"No luggage.\"" },
    { say: "rowan", text: "\"No stake. Nobody carries anything.\"" },
    { say: "gideon", text: "\"I do not play for nothing.\"" },
    {
      say: "rowan",
      text: "\"Then play for the room. Everyone's going to watch, whatever you do. You may as well win in front of them.\""
    },
    {
      text: "He considers that for a long moment. And then, slowly, a thin smile appears on his face, the first real one all morning."
    },
    { say: "gideon", text: "\"How resourceful.\"" },
    { text: "He crosses the saloon, takes off his gloves, and sits at the worst table on the ship." },
    {
      text: "The game takes twenty minutes, and it is, by all accounts, quite good. Inya waits him out for six turns, and he finally attacks first, and she loses by the width of a single rabbit. She shakes his hand afterwards and says \"Rematch\" and he says \"I should be delighted.\""
    },
    { text: "Nobody carries anything." },
    { flag: "ferry_table_settled" },
    { flag: "table_resolved" },
    {
      add: { aff_inya: 4 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 4, why: "Found a peaceful way" }); }
    },
    {
      add: { aff_gideon: 2 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "gideon", n: 2, why: "Played for the room" }); }
    },
    {
      add: { aff_noor: 3 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "noor", n: 3, why: "Read the Charter" }); } },
    { scene: "table_payout" },
    { time: 30 }
  ]
});


scene("inya_rematch", {
  steps: [
    { when: (s)=>!(!!!s.flags["met_inya"]), jump: "next_2" },
    { end: true },
    { label: "next_2" },
    { label: "end_1" },
    { when: (s)=>!(!!s.flags["flag_inya_played"]), jump: "next_4" },
    { say: "inya", text: "\"We did that. I remember. I'm still thinking about it.\"" },
    { end: true },
    { label: "next_4" },
    { label: "end_3" },
    { text: "A bench near the galley. Two decks. The cards held down with a coffee cup." },
    {
      say: "inya",
      text: "\"Don't let me win. Loser pays for the rolls. Two cinnamon rolls, six Smug Coins, no arguments.\""
    },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_6" },
    { say: "nathan", text: "\"I'll hold the bets! Nobody's betting! I'll hold the NOT-bets!\"", mood: "happy" },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_8" },
    { say: "baylee", text: "\"He means he'll watch.\"" },
    { label: "next_8" },
    { label: "end_7" },
    { label: "next_6" },
    { label: "end_5" },
    {
      duel: "ferry_inya",
      opponent: "inya",
      opponentName: "Inya Bell",
      mustWin: false,
      onWin: [
        { say: "inya", text: "\"Rude.\"" },
        { text: "Instantly. Four seconds of furious sulking pass across her face. Then, very fast:" },
        { say: "inya", text: "\"Rematch. Not now. Later. On a real table. You owe me a real table.\"" },
        { say: "inya", text: "\"And I owe you rolls. I know. I pay what I owe.\"" },
        {
          add: { aff_inya: 3 }
        },
        { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 3, why: "Fair fight" }); } },
        { flag: "inya_paid_rolls" }
      ],
      onLose: [
        { say: "inya", text: "\"HA.\"" },
        { text: "She slaps the table. Then, remembering herself:" },
        { say: "inya", text: "\"Good game. Accurate. Your storm was wrong for my bunnies and I told you so.\"" },
        { say: "inya", text: "\"I'll take the rolls. Six Smug Coins. You said.\"" },
        {
          add: { aff_inya: 4 }
        },
        { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 4, why: "Won fairly" }); } },
        { flag: "rowan_paid_rolls" }
      ]
    },
    { scene: "inya_rolls" },
    { scene: "post_inya" },
    { flag: "flag_inya_played" },
    { time: 25 }
  ]
});


scene("table_payout", {
  steps: [
    {
      when: (s)=>!((!!s.flags["bet_gideon"]&&(!!s.flags["ferry_table_lost"]||!!s.flags["ferry_inya_lost"]))),
      jump: "next_2"
    },
    { coins: 20 },
    {
      text: "Tomi finds you in the crowd afterwards and presses twenty Smug Coins into your palm. \"Gideon came in. As written. You were good for ten, wasn't it?\""
    },
    { jump: "end_1" },
    { label: "next_2" },
    {
      when: (s)=>!((!!s.flags["bet_inya"]&&(!!s.flags["ferry_inya_won"]||!!s.flags["ferry_table_won"]))),
      jump: "next_3"
    },
    { coins: 20 },
    {
      text: "Tomi finds you in the crowd afterwards and presses twenty Smug Coins into your palm. \"Against Gideon came in. You and four other optimists. I'm a poorer man, but a happier one.\""
    },
    { jump: "end_1" },
    { label: "next_3" },
    {
      when: (s)=>!(((!!s.flags["bet_gideon"]||!!s.flags["bet_inya"])&&(!!s.flags["ferry_table_settled"]||!!s.flags["ferry_table_denied"]))),
      jump: "next_4"
    },
    { coins: 10 },
    {
      text: "Tomi finds you afterwards and presses your ten Smug Coins back into your hand. \"No result, no money. All bets void.\""
    },
    { jump: "end_1" },
    { label: "next_4" },
    { when: (s)=>!((!!s.flags["bet_gideon"]||!!s.flags["bet_inya"])), jump: "next_5" },
    { text: "The bookmaker in the yellow bandana, passing, taps the lid of his binder, shrugs sympathetically, and does not stop walking." },
    { label: "next_5" },
    { label: "end_1" }
  ]
});
