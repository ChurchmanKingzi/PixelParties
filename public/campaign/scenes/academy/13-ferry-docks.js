// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
scene("ferry_docks", {
  background: "ferry_deck",
  steps: [
    { clear: true },
    {
      text: "The gangway comes down with a rattle, a long, iron-voiced slide of chain and a final, ringing thump against the planks of the pier."
    },
    {
      text: "The decks empty at once, the way a bath empties: a few big gulps, a swirl, and then the whole crowd is pouring towards the head of the gangway, duffels bumping, deck boxes clutched, voices rising."
    },
    {
      text: "Captain Stroud is standing at the top of it, with his bowler in one hand and a small brass clicker in the other, and a look of grim, sentimental concentration."
    },
    { enter: "abel" },
    {
      say: "abel",
      text: "ONE AT A TIME! One at a time, folks, I want every one of you off this ship in the same number as you came on! Thirty-eight! I will count you out and I will count you in!"
    },
    { text: "Click. Click. He says \"Welcome\" to each head as it passes, as if signing it for." },
    { when: (s)=>!(!!s.flags["freddie_jumped"]), jump: "next_2" },
    { say: "abel", text: "\"Thirty-six, and two in the harbour.\"" },
    { text: "He taps the clicker once against his chest." },
    {
      say: "abel",
      text: "\"They're both good swimmers. They're also both on my list. I will have a word with the young ladies about regulation four-oh-one.\""
    },
    { label: "next_2" },
    { label: "end_1" },
    { enter: "nathan" },
    { enter: "baylee" },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_4" },
    {
      say: "nathan",
      text: "ROWAN! Stay close! Don't lose us! I've got Baylee's bag and my bag and a hat that isn't mine!",
      mood: "laughing"
    },
    { say: "baylee", text: "That's my hat." },
    { say: "nathan", text: "That's what I SAID!", mood: "grin" },
    { jump: "end_3" },
    { label: "next_4" },
    {
      say: "nathan",
      text: "ROWAN! Over here! We're going down together! I've decided! It's a rule!",
      mood: "laughing"
    },
    { say: "baylee", text: "He decided at the funnel." },
    { label: "end_3" },
    { when: (s)=>!(!!s.flags["has_snapper"]), jump: "next_7" },
    { say: "abel", text: "\"A word, young man.\"" },
    {
      text: "He has not taken his eyes off the stream of students, but one enormous hand has found your elbow and steered you, very gently, a half-step out of the line."
    },
    { say: "abel", text: "\"The crate from under the tarp. You have it?\"" },
    { say: "rowan", text: "Yes, Captain." },
    { say: "abel", text: "\"Good.\"" },
    { text: "A very long pause. His beard works." },
    { say: "abel", text: "\"Mind the step.\"" },
    { say: "rowan", text: "I will." },
    {
      say: "abel",
      text: "…No. Not the gangway step. *The* step. At the top of the bungalow row. It's got a loose board. She'll tell you she's fixed it. She hasn't."
    },
    {
      add: { aff_abel: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "abel", n: 2, why: "Carried the snapper" }); } },
    { label: "next_7" },
    { label: "end_6" },
    { when: (s)=>!(!!s.flags["met_georgie"]), jump: "next_9" },
    { enter: "georgie" },
    {
      text: "A very small girl is standing at the head of the line with her plush dragon held out in front of her, at arm's length, like a lantern."
    },
    {
      say: "georgie",
      text: "…Is it all right if I go first? Ember wanted to see it. She's — it's the first time she's been somewhere that's not a hotel."
    },
    {
      say: "abel",
      text: "\"Little miss, you go as first as you like.\" He tips his hat. \"Mind the plank. It's got opinions.\""
    },
    {
      text: "She goes down it with both hands tight round the plush and the corners of her mouth curving, very slowly, upward."
    },
    { exit: "georgie" },
    { label: "next_9" },
    { label: "end_8" },
    { when: (s)=>!(!!s.flags["met_jessica"]), jump: "next_11" },
    { enter: "jessica" },
    { say: "jessica", text: "\"Rowan.\"" },
    {
      text: "She passes, with two ship's porters behind her wheeling three leather caskets on a trolley, and a graciousness so complete that nobody dares to hurry her."
    },
    { say: "jessica", text: "\"I shall see you on the island. It is not a large one.\"" },
    { say: "rowan", text: "I'll look out for you." },
    { say: "jessica", text: "\"Do.\" A small smile. \"Cross the lawn.\"" },
    { exit: "jessica" },
    { label: "next_11" },
    { label: "end_10" },
    { when: (s)=>!(!!s.flags["met_marit"]), jump: "next_13" },
    { enter: "marit" },
    { say: "marit", text: "\"**FAREWELL, SHIP!**\"", shake: true },
    { text: "She is already at the head of the gangway, scarf flapping, hand pressed to her brow." },
    { say: "marit", text: "\"*Thou hast carried us well!* **Thou art free to go!**\"", shake: true },
    { name: "Captain Stroud", text: "It is a FERRY, Miss Solberg." },
    { say: "marit", text: "**IT IS A VESSEL OF DESTINY!**", shake: true },
    { exit: "marit" },
    { label: "next_13" },
    { label: "end_12" },
    { when: (s)=>!(!!s.flags["met_ed"]), jump: "next_15" },
    { enter: "ed" },
    { say: "ed", text: "\"Is the plank dangerous? It looks dangerous! It looks really good!\"" },
    {
      text: "He is already halfway down it with both arms out, like a tightrope walker, to the unconcealed horror of the deckhand beside him."
    },
    { exit: "ed" },
    { label: "next_15" },
    { label: "end_14" },
    { when: (s)=>!(!!s.flags["met_inya"]), jump: "next_17" },
    { enter: "inya" },
    { when: (s)=>!(!!s.flags["ferry_inya_won"]), jump: "next_19" },
    { say: "inya", text: "\"Hey. Hey, Wildcard.\"" },
    {
      text: "She goes by with her chin high and her deck box under her arm. Behind her, ten paces back, Gideon is carrying her rucksack with a face like a man being photographed with a tax inspector."
    },
    { say: "inya", text: "\"Watch this.\"" },
    { jump: "end_18" },
    { label: "next_19" },
    { when: (s)=>!(!!s.flags["ferry_inya_lost"]), jump: "next_20" },
    { say: "inya", text: "\"I'm fine.\" She does not look back. \"Don't say anything. I'll see you on the sand.\"" },
    { jump: "end_18" },
    { label: "next_20" },
    { say: "inya", text: "\"Bunkhouse three. Bunkhouse number three. Come and find me on the beach.\"" },
    { text: "She says it fast, like a challenge." },
    { say: "inya", text: "\"I want that game.\"" },
    { label: "end_18" },
    { exit: "inya" },
    { label: "next_17" },
    { label: "end_16" },
    { say: "abel", text: "…Thirty. Thirty-one. Thirty-two. Mind your heads. Mind your elbows." },
    { text: "And then it is your turn." },
    {
      text: "The gangway is steeper than it looked. The planks ring, one after another, under your feet, and the rail is warm from the sun. Halfway down you stop, for no reason, and look back at the ship."
    },
    {
      text: "The Second Chance is not very big. She has a funnel with a chip in it, a lifeboat painted twice in two different blues, and a line of washing hung from the stern. You have been on her for two and a half hours, and you are going to miss her."
    },
    {
      say: "abel",
      text: "Don't dawdle, son! The island waits for no man! It does, in fact, but it likes to pretend otherwise!"
    },
    { exit: "abel" },
    { fx: "fadeout", ms: 400 },
    { goto: "ferry_dock", travel: 0 },
    { bg: "ferry_dock" },
    { clear: true },
    { fx: "fadein", ms: 400 },
    { text: "And then your foot is on wood that does not move." },
    {
      text: "It is a long timber pier on barnacled piles, stretching ahead of you towards a pale beach and a wall of jungle. At its head stands a blue arch with gold lettering and a little golden gem on top: WELCOME, DUELISTS."
    },
    {
      text: "Palms lean over the sand behind it, the volcano trails its thread of smoke above the trees, and a small red cable car creaks along a wire over the canopy."
    },
    {
      text: "Under the arch, a line of older students in red, gold and black jackets stand beside luggage carts, calling out dorm names like market traders."
    },
    { name: "Older student", text: "Spectral! Spectral first-years, this way, mind the step!" },
    { name: "Older student", text: "Rare! Rare Hall over here, blue collars!" },
    {
      name: "Older student",
      text: "Commons — Commons — grey collars, please, bungalows on the beach, follow the sign!"
    },
    {
      text: "The water under the planks is so clear you can see crabs arguing on the bottom. The air smells of tar, kelp and wet rope."
    },
    { enter: "cati" },
    {
      text: "At the mooring bollard an old man with a face like driftwood is checking the lines with the minute, unhurried care of someone who has done it every day for forty years. A girl with a mail sack, bright-eyed, hair in a braid, is catching the bow rope as it sails across from the deck above."
    },
    { say: "cati", alias: "???", text: "Got it! Got it, Captain! You've got the aim of a retired postman!" },
    { name: "Captain Stroud", text: "I AM a retired postman!" },
    {
      say: "cati",
      alias: "???",
      text: "I'm Cati! Campus post! If you've got a letter for home, you give it to me, and if you don't, I'll find you one!"
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["cati"]) s.names["cati"] = "Cati"; if (io && io.popup && !s.flags["met_cati"]) io.popup({ type: 'met', id: "cati", name: "Cati" }); }
    },
    { flag: "met_cati" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["cati"] = s.notes["cati"] || []); if (a.indexOf("Runs the campus post. Talks to the ferry captain like an old friend.") < 0) a.push("Runs the campus post. Talks to the ferry captain like an old friend."); }
    },
    { think: "Everyone on this island seems to have been doing this a very long time." },
    { when: (s)=>!(!!s.flags["freddie_jumped"]), jump: "next_23" },
    { enter: "freddie" },
    { enter: "sunny" },
    {
      text: "At the far side of the pier a dripping figure with red hair, a stripe of green algae and a pair of diving goggles shoved up on her forehead is hauling herself up a ladder, grinning, with a towel-wrapped lifeguard hauling after her and shouting something about \"a *week* of nothing but breaststroke.\""
    },
    { say: "freddie", text: "ROWAN! JACKETLESS! IT WAS EIGHT AND A HALF MINUTES! I TOLD YOU!" },
    { say: "sunny", text: "Seven and a half, you absolute liar." },
    { exit: "freddie" },
    { exit: "sunny" },
    { label: "next_23" },
    { label: "end_22" },
    {
      text: "Halfway down the pier a pale boy in white gloves holds out a thick fold of mainland notes to a deckhand who has offered to take a case. The deckhand looks at the money the way a person looks at a leaf."
    },
    { name: "Deckhand", text: "Smug Coins only, sir. Mainland paper's no good past the arch." },
    {
      text: "The pale boy looks at the notes. For a moment the most self-possessed person on the ship has nothing at all to say."
    },
    { when: (s)=>!(!!s.flags["has_snapper"]), jump: "next_25" },
    {
      text: "You shift the small crate of snapper from one arm to the other. It smells, if anything, more of snapper than it did on the ship."
    },
    { label: "next_25" },
    { label: "end_24" },
    { flag: "arrived_dock" },
    { lock: "ferry_deck" },
    { lock: "ferry_lounge" },
    { lock: "ferry_stern" },
    { lock: "ferry_bridge" },
    { scene: "dock_consequences" }
  ]
});

scene("dock_consequences", {
  steps: [
    { when: (s)=>!(!!s.flags["ferry_table_lost"]), jump: "next_2" },
    { scene: "dock_cases_lost" },
    { jump: "end_1" },
    { label: "next_2" },
    { when: (s)=>!(!!s.flags["ferry_inya_won"]), jump: "next_3" },
    {
      text: "Down the jetty a pale boy in white gloves is walking behind a small girl with mint-green hair and a single rucksack, which he is carrying. She is eating a cinnamon roll. He has the look of a man who has lost a bet and intends never to mention it. Tomi, passing, pays somebody out of a pocket binder."
    },
    { jump: "end_1" },
    { label: "next_3" },
    { when: (s)=>!(!!s.flags["ferry_table_won"]), jump: "next_4" },
    {
      text: "Gideon, ahead of you on the jetty, is looking at his four cases with the grave disinterest of a man who has been told he owes somebody a duffel and is deciding when to start. Three of his things are being rolled on a cart by an upper-year in a gold jacket. The fourth, you notice, is not."
    },
    { jump: "end_1" },
    { label: "next_4" },
    { when: (s)=>!(!!s.flags["ferry_table_settled"]), jump: "next_5" },
    {
      text: "Gideon, a dozen paces ahead, glances back once. He inclines his head a quarter of an inch, as one does to an equal. Beside him, Inya walks with her deck box tucked under her arm and a spring in her step."
    },
    { jump: "end_1" },
    { label: "next_5" },
    { when: (s)=>!(!!s.flags["ferry_table_denied"]), jump: "next_6" },
    {
      text: "Down the jetty a small girl with mint-green hair is walking alone, deck box clamped to her chest, looking at nobody. A little way ahead, a pale boy in white gloves strides up the planks with his hands entirely free and four matched cases being rolled behind him on a cart by an upper-year. Nobody carries anything. It is, somehow, worse."
    },
    { when: (s)=>!(!!s.flags["lounge_seen"]), jump: "next_8" },
    { text: "She sees you watching. Her chin comes up. She does not say anything, and neither do you." },
    { label: "next_8" },
    { label: "end_7" },
    { jump: "end_1" },
    { label: "next_6" },
    {
      text: "Down the jetty a small girl with mint-green hair is staggering under two matched cases, with two more waiting behind her on the planks. She lets nobody take one. A pale boy in white gloves walks ahead of her with his hands entirely free. Tomi, paying out his book, does not look at her."
    },
    { when: (s)=>!(!!s.flags["lounge_seen"]), jump: "next_11" },
    { text: "She sees you watching. Her chin comes up. She does not say anything, and neither do you." },
    { think: "I could have said something. I know I could." },
    { label: "next_11" },
    { label: "end_10" },
    { label: "end_1" },
    { scene: "dock_to_quad" }
  ]
});

scene("dock_cases_lost", {
  steps: [
    {
      say: "gideon",
      text: "Four cases, Vance. To the Spectral Tower, which is at the top of the hill. I will lead the way."
    },
    {
      text: "He does not carry anything. He does not need to. He has just turned the dock into a stage, and the whole jetty is the audience."
    },
    {
      text: "The cases are matched, dark leather with brass corners, heavier than they have any right to be. You lift one. You lift two. Your back remembers the laundromat."
    },
    {
      choice: [
        { text: "Take two and come back for the rest.", goto: "opt_2" },
        { text: "Try to carry all four at once.", goto: "opt_3", hint: "Bad idea" },
        { text: "Accept Nathan's offer of help.", goto: "opt_4", when: (s)=>!!s.flags["flag_prologue_done"] },
        { text: "Accept Baylee's quiet help.", goto: "opt_5", when: (s)=>!!s.flags["flag_prologue_done"] }
      ]
    },
    { jump: "choiceend_1" },
    { label: "opt_2" },
    {
      text: "You do it in two trips. The first is fine. The second is not. By the top of the avenue your arms are burning and your shirt is stuck to you and you understand, a little late, that the Spectral Tower is genuinely at the top of a hill."
    },
    { flag: "carried_two_trips" },
    { jump: "choiceend_1" },
    { label: "opt_3" },
    {
      text: "You do not make it to the foot of the jetty. The third case slips. The fourth, which was balanced precariously on the top, falls into your arms in a way that is technically carrying. Behind you somebody gasps. Somebody else, Nathan, says very loudly: \"He's doing it! He's CARRYING them ALL!\""
    },
    {
      text: "You do not drop a case. You do, however, discover muscles you did not know you had, and they are all in agony."
    },
    { flag: "carried_all_four" },
    { jump: "choiceend_1" },
    { label: "opt_4" },
    { say: "nathan", text: "\"I'll take two! Give me two! Gimme gimme gimme!\"" },
    { text: "He has already grabbed a case in each hand, shouting to the jetty at large:" },
    { say: "nathan", text: "\"HE LOST! HE LOST FAIR AND SQUARE! He's paying! I'm helping!\"" },
    { say: "gideon", text: "I do not recall asking for a second carrier." },
    { say: "nathan", text: "It wasn't in the terms!" },
    {
      text: "Gideon looks at Nathan. Nathan looks at Gideon. It is, for a moment, a contest of two different species of confidence, and the loser, you suspect, is whoever has to sit next to either of them at lunch."
    },
    { say: "gideon", text: "…Very well. The terms did not forbid it." },
    {
      add: { aff_nathan: 3 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "nathan", n: 3, why: "Helped carry" }); } },
    { flag: "nathan_carried" },
    { jump: "choiceend_1" },
    { label: "opt_5" },
    {
      text: "Baylee has not said a word. He has simply picked up the heaviest case in one hand, as if it were a loaf of bread, and is waiting, politely, for you to say it is all right."
    },
    { say: "baylee", text: "…Okay?" },
    { say: "gideon", text: "I do not recall asking for a second carrier." },
    { text: "Baylee looks at him for a long moment, from a considerable height." },
    { say: "baylee", text: "Wasn't in the rules. Was it." },
    { say: "gideon", text: "…No." },
    {
      add: { aff_baylee: 3 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "baylee", n: 3, why: "Helped carry" }); } },
    { flag: "baylee_carried" },
    { jump: "choiceend_1" },
    { label: "choiceend_1" },
    {
      text: "The Spectral Tower stands on the hill above the Quad, a white spire with gold at the lip of its balconies and a doorman who has plainly seen better luggage. Gideon gives the concierge your name so that you are let in. The atrium floor is marble, the staircase is lined with portraits of previous year-captains, and you set four cases down in a neat row beside a very large, very silent potted palm."
    },
    { say: "gideon", text: "Thank you, Vance. That will be all." },
    { text: "He says it quite courteously. He does not gloat. He does not need to." },
    { when: (s)=>!(!!!s.flags["carried_all_four"]), jump: "next_7" },
    { when: (s)=>!((!!!s.flags["nathan_carried"]&&!!!s.flags["baylee_carried"])), jump: "next_9" },
    {
      text: "Beside you, a small girl with mint-green hair has been walking all the way up the avenue as well, a few steps behind, with her hands in her hoodie pockets. She stops at the tower door."
    },
    { say: "inya", text: "\"I'd have been carrying those.\" Quietly. \"If you hadn't asked.\"" },
    { say: "rowan", text: "I know." },
    { say: "inya", text: "Rude. Accurate. Thank you." },
    {
      add: { aff_inya: 3 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 3, why: "Carried them instead" }); }
    },
    { label: "next_9" },
    { label: "end_8" },
    { label: "next_7" },
    { label: "end_6" },
    { time: 40 }
  ]
});

scene("dock_to_quad", {
  steps: [
    { goto: "main_gate", travel: 8 },
    {
      text: "The road climbs from the pier between tall palms. At its top the main gate stands open: two pillars of dark brick with lamps on top, a brass plaque set into the left-hand one, and an iron arch fanned out above the gates like a hand of cards, each card holding a coloured gem. Beyond it a sandy path runs between more palms to a white building with a red roof."
    },
    {
      text: "People flow through it in knots. Nobody speaks very loudly. It is the kind of silence that comes over a crowd entering a church or an exam hall, only here it is not reverence but plain, shared, delighted terror."
    },
    { scene: "quad_address" }
  ]
});

scene("quad_address", {
  background: "quad",
  steps: [
    { goto: "quad", travel: 3 },
    { when: (s)=>!(!!s.flags["ferry_table_lost"]), jump: "next_2" },
    {
      text: "You come up through the rear colonnade at a stagger, soaked in sweat, arms trembling, just as a tall woman on the steps is finishing her first sentence. Nobody turns round. You slide into the back of the crowd like a coat onto a hook."
    },
    { label: "next_2" },
    { label: "end_1" },
    { text: "The Quad opens before you like a held breath." },
    {
      text: "A wide green lawn with palms leaning over it, framed on one side by white arcades under red-tiled roofs. At the far end a clock tower with a blue roof stands guard, and at its foot a tall split-flap display clatters as a rank changes: the ladder board, 144 names long."
    },
    {
      text: "To the right, where a sandy path bends round the grass, a fountain: a bronze figure flinging a spray of bronze cards from which the water jumps. Above the roofs the volcano trails its thread of smoke. Students lie on blankets with playmats, argue over rulings, trade out of binders."
    },
    { think: "There I am. Somewhere on the bottom of that board, in about an hour." },
    {
      text: "The thirty-eight new faces collect on the lawn at the foot of the clock tower, in uneasy clumps, each according to its collar, the way oil gathers on water."
    },
    {
      text: "In front of the tower, a tall woman in a navy suit stands completely still. Grey-streaked braids coiled high, reading glasses on a silver chain. She waits for silence, and gets it in about four seconds."
    },
    { say: "okonkwo", text: "Good morning." },
    { text: "A hundred new heartbeats, all in tempo." },
    {
      say: "okonkwo",
      text: "I am Dr Marguerite Vicar. I am Chancellor of Pixel Academy, and I have been for a very long time."
    },
    {
      say: "okonkwo",
      text: "You have been admitted to this school out of two thousand, one hundred and fourteen applicants. That is not a boast. It is a statistic, and I distrust everything else I might say about it."
    },
    {
      say: "okonkwo",
      text: "Over the next two hundred and ten days you will be taught the game, the rules of the game, and the history of the game. You will learn what a good loss looks like. Most of you will lose a great deal. I recommend you do it well."
    },
    { text: "A ripple of nervous laughter, instantly suppressed." },
    {
      say: "okonkwo",
      text: "There is one law on this island above all the others. Every conflict here may be settled at a table. Every one. You will be given the Charter tomorrow. Read it. The position is that there are no exceptions."
    },
    {
      say: "okonkwo",
      text: "For today, you will be assigned a dormitory. The lists will be read in rank order. Do not take your assignment as a verdict. It is merely an arrangement. Verdicts, on this island, are earned at the table."
    },
    { say: "okonkwo", text: "Miss Sterling." },
    {
      text: "She steps aside. The woman who takes her place is taller, silver-blonde in a flawless chignon, with a dark council sash worn over a gold jacket like a rank. She opens a leather folio with the air of someone opening a ledger."
    },
    { say: "octavia", text: "\"Spectral Tower.\"" },
    { text: "A single, crisp, unhurried syllable at a time." },
    {
      say: "octavia",
      text: "\"Santa, Georgie. Montclair, Jessica. Brandt, Anneliese. Beaumont-Lyle, Ashton. Pryce, Gideon. Prospero, Magnus. Sunflower, Branden.\""
    },
    { when: (s)=>!(!!s.flags["met_branden"]), jump: "next_4" },
    {
      text: "From somewhere near knee height a high voice shouts \"HERE!\" and then, a moment later, \"AND ALSO I'M HERE!\" Several people in the crowd, you notice, look for the lifebuoy."
    },
    { jump: "end_3" },
    { label: "next_4" },
    {
      text: "From somewhere near knee height a high voice shouts \"HERE!\" and then, a moment later, \"AND ALSO I'M HERE!\""
    },
    { label: "end_3" },
    { when: (s)=>!(!!s.flags["met_gideon"]), jump: "next_7" },
    { text: "From somewhere to your left, a thin, courteous voice murmurs, \"Here.\" You do not turn round." },
    { label: "next_7" },
    { label: "end_6" },
    {
      text: "The names go on. Each one is a small door closing behind a face in the crowd, and each face crosses the grass to join an older student in a white-and-gold collar and vanishes up the hill."
    },
    {
      say: "octavia",
      text: "Rare Hall. Von Düsterwald, Eberhart. Yamaguchi, Mikoto. Park, Jun-ho. Fullington, Teobalt. Abernathy, Caspian. Okonjo, Rafael. Lafayette, Eloise. Solberg, Marit. Al-Sayed, Noor. Aldane, Sunniva. Lund, Pippa. Capulet, Victoria."
    },
    { when: (s)=>!(!!s.flags["met_sunny"]), jump: "next_9" },
    { run: (s)=>{ s.names = s.names || {}; s.names["sunny"] = "Sunniva \"Sunny\" Aldane"; } },
    { flag: "fullname_sunny" },
    { label: "next_9" },
    { label: "end_8" },
    {
      text: "It is a long list. You start counting, and stop, and start again, because it is easier than thinking about what it means that your name has not been read."
    },
    {
      text: "The Spectral cluster is gone. The Rare cluster is gone. The lawn has a hole in it where thirty-eight people used to be, and the remainder are all clutching their bags a little tighter."
    },
    { say: "octavia", text: "The Commons." },
    { text: "The word lands with a small, flat, administrative thud." },
    {
      say: "octavia",
      text: "Bungalows one through eight. Bungalow two: Nordlicht, Freya. Njord, Hedda. Hollis, Beatrix."
    },
    { say: "octavia", text: "Bungalow three: Bell, Inya. Thana, Olivia. Marika, Rana." },
    { say: "octavia", text: "Bungalow four: Voltage, Maisie. Blackwood, Fiona. Helical, Leona. Camara, Winifred." },
    { say: "octavia", text: "Bungalow five: Venture, Ed. Reyes, Tomás. Hale, Viktor." },
    { say: "octavia", text: "Bungalow six: Counts, Samuel. Crowe, Tobias. Volkov, Dmitri." },
    {
      text: "Out at the edge of the lawn, a boy in a long black coat flinches at \"Samuel\" as if it were a draught."
    },
    { when: (s)=>!(!!s.flags["met_livvie"]), jump: "next_11" },
    { run: (s)=>{ s.names = s.names || {}; s.names["livvie"] = "Olivia \"Livvie\" Thana"; } },
    { flag: "fullname_livvie" },
    { label: "next_11" },
    { label: "end_10" },
    { when: (s)=>!(!!s.flags["met_tomi"]), jump: "next_13" },
    { run: (s)=>{ s.names = s.names || {}; s.names["tomi"] = "Tomás \"Tomi\" Reyes"; } },
    { flag: "fullname_tomi" },
    { label: "next_13" },
    { label: "end_12" },
    { when: (s)=>!(!!s.flags["met_freddie"]), jump: "next_15" },
    { run: (s)=>{ s.names = s.names || {}; s.names["freddie"] = "Winifred \"Freddie\" Camara"; } },
    { flag: "fullname_freddie" },
    { label: "next_15" },
    { label: "end_14" },
    { text: "A pause. She turns a page." },
    { say: "octavia", text: "Bungalow seven. Halvorsen, Baylee. Whisper, Nathan." },
    { flag: "rel_nathan_baylee" },
    { text: "Another pause, a precise one." },
    { say: "octavia", text: "Vance, Rowan. Late admission. The Wildcard entrant." },
    {
      text: "Somebody, near the back, says \"oh,\" in the way people say it when they have just worked something out. A girl in a ruffled dress turns her head. A boy with a clipboard looks at his clipboard."
    },
    { think: "Last. Of course I'm last." },
    { when: (s)=>!(!!s.flags["ferry_table_won"]), jump: "next_17" },
    {
      text: "Nathan, at your elbow, whispers with a volume that is not, in any sense, a whisper: \"You BEAT the glove guy and they read you out LAST? That's criminal!\""
    },
    { jump: "end_16" },
    { label: "next_17" },
    { when: (s)=>!(!!s.flags["ferry_table_lost"]), jump: "next_18" },
    {
      text: "Nathan, at your elbow, whispers with a volume that is not, in any sense, a whisper: \"Four cases up a HILL and they read you out LAST? That is a CRIME.\""
    },
    { jump: "end_16" },
    { label: "next_18" },
    {
      text: "Nathan, at your elbow, whispers with a volume that is not, in any sense, a whisper: \"LAST. You're LAST. That's the best spot, Wildcard, that's the closing act!\""
    },
    { label: "end_16" },
    { flag: "heard_lists" },
    { scene: "quad_jacket" }
  ]
});

scene("quad_jacket", {
  steps: [
    {
      text: "The crowd breaks up. A young woman with a clipboard of her own, black-haired and brisk, points you towards a large wooden crate set at the foot of the tower, from which a jacket is being issued with grim ceremony to each of the Commons. A senior in a gold jacket is reading names off a list and pulling out jackets by size."
    },
    { name: "Upper-year", text: "Vance. Medium. Hold your arms out." },
    {
      text: "The jacket is red, stiff and smells of new fabric. It has a plain grey collar. The sleeves are exactly the right length, which feels like a small personal insult."
    },
    { text: "A shadow falls across the crate." },
    { say: "okonkwo", text: "Mr Vance." },
    { text: "She does not offer a hand. Her glasses swing on their silver chain." },
    { say: "okonkwo", text: "The Wildcard entrant. You arrived by the back door. See that you leave by the front." },
    {
      choice: [
        { text: "Yes, ma'am. I'll try to leave by the front, and I'll try not to be late.", goto: "opt_2" },
        {
          text: "I'll do my best, Chancellor. I'm not sure it will be enough, but it is what I have.",
          goto: "opt_3",
          hint: "Honest"
        },
        { text: "Say nothing and nod.", goto: "opt_4" }
      ]
    },
    { jump: "choiceend_1" },
    { label: "opt_2" },
    { say: "rowan", text: "Yes, ma'am. I'll try to leave by the front, and I'll try not to be late." },
    { say: "okonkwo", text: "\"Good.\"" },
    { text: "A single, dry inclination of the head." },
    {
      say: "okonkwo",
      text: "\"I find that you may be the only person today who has said that without being asked.\""
    },
    {
      add: { aff_okonkwo: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "okonkwo", n: 2, why: "Respectful" }); } },
    { jump: "choiceend_1" },
    { label: "opt_3" },
    { say: "rowan", text: "I'll do my best, Chancellor. I'm not sure it will be enough, but it is what I have." },
    { say: "okonkwo", text: "\"You will do better than that, or you will do something else.\"" },
    { text: "She does not smile. Something in the line of her mouth, however, has moved a millimetre." },
    { say: "okonkwo", text: "\"We shall see.\"" },
    {
      add: { aff_okonkwo: 1 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "okonkwo", n: 1, why: "Honest" }); } },
    { jump: "choiceend_1" },
    { label: "opt_4" },
    { say: "okonkwo", text: "Quite." },
    { jump: "choiceend_1" },
    { label: "choiceend_1" },
    { text: "She moves on. The crate has gone quiet." },
    { think: "I'm wearing the jacket. I'm actually wearing the jacket. I'm one of them now." },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["okonkwo"]) s.names["okonkwo"] = "Chancellor Vicar"; if (io && io.popup && !s.flags["met_okonkwo"]) io.popup({ type: 'met', id: "okonkwo", name: "Chancellor Vicar" }); }
    },
    { flag: "met_okonkwo" },
    { scene: "commons_march" }
  ]
});

scene("commons_march", {
  steps: [
    {
      text: "A large woman in a flowered apron, with grey-black hair under a red kerchief and gold hoops swinging from her ears, has planted herself at the foot of the tower and is calling out, over the din, in a voice that arrives a full room before she does:"
    },
    {
      say: "odalys",
      alias: "???",
      text: "COMMONS! Commons, over here! Nineteen of you, I counted, don't make me count again! Every one of you has a stomach, and I have a stove!"
    },
    {
      text: "There is a wooden spoon in her apron string like a sidearm. She raises it. Nineteen new first-years drift towards her as if drawn by gravity."
    },
    {
      say: "odalys",
      alias: "???",
      text: "I am Mama Odalys! Mrs Fuentes to the staff, Mama to everyone with sense! I run the kitchen, I run the row, and I run you! Rules!"
    },
    {
      say: "odalys",
      text: "One! Nobody eats alone! Two! Nobody skips breakfast! Three! Lights out means quiet! Four! If you are sad, tell somebody! If you cannot tell somebody, tell me! If you cannot tell me, tell the spoon! Come!"
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["odalys"]) s.names["odalys"] = "Mama Odalys"; if (io && io.popup && !s.flags["met_odalys"]) io.popup({ type: 'met', id: "odalys", name: "Mama Odalys" }); }
    },
    { flag: "met_odalys" },
    {
      text: "She turns and sets off down the hill at a pace that belies her age. The Commons follow her down towards the sea, in a loose, gaggling river of grey collars, with Nathan somewhere at its head, already asking her what is for lunch."
    },
    { when: (s)=>!((!!s.flags["has_snapper"]&&!!!s.flags["snapper_delivered"])), jump: "next_2" },
    {
      text: "You are still carrying a small crate of snapper. It smells, increasingly, of snapper. You catch up with her at the head of the line."
    },
    {
      choice: [
        {
          text: "Mrs Fuentes? Captain Stroud asked me to bring you this. He said you would know what it is.",
          goto: "opt_4"
        },
        { text: "Keep quiet about it and carry on.", goto: "opt_5", hint: "Awkward" }
      ]
    },
    { jump: "choiceend_3" },
    { label: "opt_4" },
    {
      say: "rowan",
      text: "Mrs Fuentes? Captain Stroud asked me to bring you this. He said you would know what it is."
    },
    { text: "She stops walking so abruptly that three people walk into her." },
    { say: "odalys", text: "Captain — Abel? He sent—" },
    {
      text: "She looks into the crate. For a long moment she does not say anything at all. The wooden spoon, for once, hangs entirely still."
    },
    {
      say: "odalys",
      text: "\"…He always sends the good lot.\" Very quietly, to the fish. \"Twenty-two years, and he's never once said a thing. Not one word.\""
    },
    { say: "odalys", text: "Thank you, mijo. You have a face like a good man. Come eat." },
    {
      add: { aff_odalys: 5 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "odalys", n: 5, why: "Brought the snapper" }); }
    },
    { flag: "snapper_delivered" },
    { flag: "odalys_snapper" },
    { jump: "choiceend_3" },
    { label: "opt_5" },
    { text: "The snapper stays in your arms. It gets heavier with every step." },
    { jump: "choiceend_3" },
    { label: "choiceend_3" },
    { label: "next_2" },
    { label: "end_1" },
    { learn: "commons_kitchen" },
    { learn: "commons_room" },
    { goto: "commons_beach", travel: 15 },
    { scene: "commons_arrival" }
  ]
});

scene("commons_arrival", {
  background: "commons_beach",
  steps: [
    { text: "The path drops through a stand of wind-bent palms and ends, abruptly, on sand." },
    {
      text: "A crooked row of weathered bungalows stands on stilts along the curve of a cove, shingle roofs dark with age, walls in salmon-pink, mint and sun-bleached blue, joined by a path of mismatched paving stones, pink, teal and brown, some replaced, some missing. Laundry flaps on lines strung between the palms. A hand-painted sign on two posts says THE COMMONS — EVERYBODY STARTS SOMEWHERE."
    },
    {
      text: "A red hammock, surfboards leaning on the porch rails, a small blue folding table with a duel mat taped across it. Geckos on the eaves. The surf breathing, in and out. It is the most beautiful place you have ever seen, and it has a washing line."
    },
    { think: "Well. It's not the ferry." },
    {
      say: "odalys",
      text: "\"Number one is my kitchen! Number eight is the laundry!\" A sweep of the spoon. \"Your numbers are on the doors! Dinner is at six! Go!\""
    },
    { when: (s)=>!(!!s.flags["ferry_table_won"]), jump: "next_2" },
    {
      text: "From the path behind you comes the measured crunch of a man who is not hurrying. Gideon Pryce, gloves on, a single duffel in his hand, passes through the crowd of grey collars like a dagger through silk, to the step of bungalow 7. He sets the duffel down on the boards beside it."
    },
    { text: "The whole row watches a white collar do it." },
    { say: "gideon", text: "Vance. A small courtesy, paid in full. I congratulate you on a well-played game." },
    { text: "He pauses. A quarter-inch smile." },
    { say: "gideon", text: "I should dislike it very much if it were an accident." },
    {
      text: "He turns and goes back up the path without hurrying, having looked, you notice, at absolutely everything on the way."
    },
    { say: "nathan", text: "He CARRIED it. The glove guy CARRIED IT. Baylee, did you see that, he —" },
    { say: "baylee", text: "I saw it." },
    {
      add: { aff_nathan: 2 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "nathan", n: 2, why: "Saw you beat Gideon" }); }
    },
    { label: "next_2" },
    { label: "end_1" },
    { when: (s)=>!(!!s.flags["odalys_snapper"]), jump: "next_4" },
    {
      text: "Mama Odalys has taken the snapper to the kitchen, and the whole row, by some magic of smell, is already drifting towards it."
    },
    { label: "next_4" },
    { label: "end_3" },
    { scene: "bungalow_seven_first" }
  ]
});

scene("bungalow_seven_first", {
  background: "commons_room",
  steps: [
    { goto: "commons_room", travel: 3 },
    {
      text: "Bungalow 7 is the last one on the row, a narrow box of weathered boards on stilts, with a single step and a teal door that squeaks. You push it open."
    },
    {
      text: "A long plank room that smells of paint and old salt. Three iron beds stand in a row against the back wall, each with a footlocker at its head: one under a blue blanket, one under a red, one under a teal. There is a curtained window at the left end of the wall, and another above a wobbly desk and chair in the right-hand corner, and between them a faded tournament poster with a golden cup on it. A plant by the door. A low bookshelf. A teal rug. A ceiling fan that ticks on every fourth turn."
    },
    { text: "Nobody's things are in it yet. Not a sock." },
    {
      say: "nathan",
      text: "OKAY! Three beds! Three of us! Nobody's touched anything! This is the fairest moment in the history of the room!",
      mood: "happy"
    },
    { text: "He turns on the spot with his arms wide, like a man who has just been handed a country." },
    { say: "baylee", text: "\"The middle one will hold me.\"" },
    { text: "He sets his hat on the red blanket. The bed gives a worried creak." },
    { say: "baylee", text: "\"If somebody else wants the corners.\"" },
    {
      say: "nathan",
      text: "The corners are the BEST. The left one has the sea in its window, I can see it from here, I can *smell* it. The right one has the desk. The desk has a window too, but it looks at the neighbours' wall.",
      mood: "grin"
    },
    { say: "nathan", text: "DIBS ON THE SEA! Left window! Dibs!", mood: "laughing" },
    {
      prompt: "The sea bed, or the desk?",
      choice: [
        { text: "Take the sea, Nathan. I'd rather have the desk, I need a table to lay out my deck.", goto: "opt_2" },
        {
          text: "I'd like the sea too. Let's duel for it: the winner gets the left bed, the loser gets the desk.",
          goto: "opt_3"
        },
        { text: "I don't mind. I'll take whatever is left.", goto: "opt_4" }
      ]
    },
    { jump: "choiceend_1" },
    { label: "opt_2" },
    { say: "rowan", text: "Take the sea, Nathan. I'd rather have the desk, I need a table to lay out my deck." },
    { say: "nathan", text: "REALLY? You're giving me the SEA? Baylee, he's giving me the sea!", mood: "happy" },
    { say: "baylee", text: "I heard." },
    {
      say: "nathan",
      text: "Best roommate in the history of the room! The room has no history! You're the FIRST best roommate!",
      mood: "laughing"
    },
    {
      set: { bed_rowan: "right" }
    },
    {
      add: { aff_nathan: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "nathan", n: 1, why: "Gave him the sea bed" }); }
    },
    { jump: "choiceend_1" },
    { label: "opt_3" },
    {
      say: "rowan",
      text: "I'd like the sea too. Let's duel for it: the winner gets the left bed, the loser gets the desk."
    },
    {
      say: "nathan",
      text: "A DUEL FOR A BED! Baylee! Baylee, we're doing a duel for a BED! That's the best thing that's ever happened to me!",
      mood: "happy"
    },
    { say: "baylee", text: "Be quick. I'd like my dinner." },
    {
      text: "You sit on the teal blanket with the duffel for a table. Nathan drops cross-legged on the rug opposite, with his deck box in both hands, and the room goes very quiet in the way rooms go quiet round two people who care about the answer."
    },
    {
      duel: "bed_duel",
      opponent: "nathan",
      opponentName: "Nathan Whisper",
      mustWin: false,
      onWin: [
        {
          say: "nathan",
          text: "\"You BEAT the War Counselors! On the FIRST DAY! In my OWN ROOM!\" A short, very honest pause. \"…Fine. FINE. It's a good window. You earned it.\"",
          mood: "laughing"
        },
        {
          say: "nathan",
          text: "I'll take the desk! I'll be the *scholar* of the family! I'll be very scholarly at it!",
          mood: "happy"
        },
        {
          set: { bed_rowan: "left" }
        },
        {
          add: { aff_nathan: 2 }
        },
        { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "nathan", n: 2, why: "Beat him fairly" }); } }
      ],
      onLose: [
        { say: "nathan", text: "\"THE SEA IS MINE! I'm going to say that again! THE SEA IS MINE!\"", mood: "laughing" },
        { text: "He drops onto the blue blanket with his arms spread." },
        {
          say: "nathan",
          text: "\"The desk is a very good desk, Rowan. It has a window on a wall. Walls are underrated.\"",
          mood: "laughing"
        },
        {
          set: { bed_rowan: "right" }
        },
        {
          add: { aff_nathan: 1 }
        },
        {
          run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "nathan", n: 1, why: "Played for the bed" }); }
        }
      ]
    },
    { jump: "choiceend_1" },
    { label: "opt_4" },
    { say: "rowan", text: "I don't mind. I'll take whatever is left." },
    { say: "nathan", text: "THE SEA! Baylee, I got the sea!", mood: "happy" },
    { say: "baylee", text: "You did." },
    {
      set: { bed_rowan: "right" }
    },
    { jump: "choiceend_1" },
    { label: "choiceend_1" },
    { when: (s)=>!((s.vars["bed_rowan"]==="left")), jump: "next_6" },
    {
      text: "You drop your duffel on the blue blanket. The mattress gives a small, sullen creak. The sea hushes at the window just above the headboard."
    },
    { jump: "end_5" },
    { label: "next_6" },
    {
      text: "You drop your duffel on the teal blanket. The mattress gives a small, sullen creak. The desk is a few steps away, with the window over it, which does indeed look at the neighbours' wall."
    },
    { label: "end_5" },
    { say: "nathan", text: "Also I snore! So you know!" },
    { say: "baylee", text: "He does." },
    { say: "nathan", text: "I DO! My mom says it's like living next to a chainsaw. A friendly chainsaw!" },
    {
      text: "There is a footlocker at the head of your bed. You open it. Inside is a folded letter in Aunt Dee's handwriting. You do not open it yet."
    },
    { think: "I live here now. This is where I live." },
    {
      text: "Nathan turns to his corner and tips an entire duffel out onto his blanket. Baylee unpacks exactly four things, a folded blanket, a framed photograph, a tin of liniment and a coiled lasso, and sets each of them on his footlocker like a very small altar. Neither of them is going anywhere. Neither of them, you notice, is in a hurry to follow you either."
    },
    { flag: "unpacked_started" },
    { unflag: "follow_nathan" },
    { unflag: "follow_baylee" },
    { time: 15 }
  ]
});

scene("bungalow_nathan", {
  steps: [
    { when: (s)=>!(!!!s.flags["nathan_room_talked"]), jump: "next_2" },
    {
      text: "Nathan has tipped the whole contents of his duffel onto his blanket and is sorting it, with enormous seriousness, into piles. The piles do not seem to have a system."
    },
    {
      say: "nathan",
      text: "Rowan! I'm making a BASE! Everything has a place! The socks go over there! The… other socks go over there!",
      mood: "happy"
    },
    { flag: "nathan_room_talked" },
    { jump: "end_1" },
    { label: "next_2" },
    { say: "nathan", text: "Hey! Come to admire the base?", mood: "grin" },
    { label: "end_1" },
    {
      choice: [
        { text: "Can I ask you something, Nathan?", goto: "opt_5", when: (s)=>!!!s.flags["chat_nathan_done"] },
        {
          text: "Talk me through your deck, if you've got a minute.",
          goto: "opt_6",
          when: (s)=>!!!s.flags["shop_nathan_done"]
        },
        { text: "How are you finding it so far?", goto: "opt_7", when: (s)=>!!!s.flags["nathan_room_feel"] },
        { text: "Carry on. I'll leave you to the base.", goto: "opt_8" }
      ]
    },
    { jump: "choiceend_4" },
    { label: "opt_5" },
    { say: "rowan", text: "Can I ask you something, Nathan?" },
    { scene: "chat_nathan" },
    { jump: "choiceend_4" },
    { label: "opt_6" },
    { say: "rowan", text: "Talk me through your deck, if you've got a minute." },
    { scene: "shop_nathan" },
    { jump: "choiceend_4" },
    { label: "opt_7" },
    { say: "rowan", text: "How are you finding it so far?" },
    {
      say: "nathan",
      text: "Loud! It's LOUD! The sea's loud, the geckos are loud, Baylee's *breathing* is loud, and I'm — I'm the loudest. It's like coming home, except nobody's yelled at me yet.",
      mood: "happy"
    },
    { say: "nathan", text: "Don't tell Baylee about the breathing.", mood: "grin" },
    { flag: "nathan_room_feel" },
    { jump: "choiceend_4" },
    { label: "opt_8" },
    { say: "rowan", text: "Carry on. I'll leave you to the base." },
    { jump: "choiceend_4" },
    { label: "choiceend_4" },
    { time: 4 }
  ]
});

scene("bungalow_baylee", {
  steps: [
    { when: (s)=>!(!!!s.flags["baylee_room_talked"]), jump: "next_2" },
    {
      text: "The four things on Baylee's footlocker have not moved by a hair. He is sitting on the edge of the red bed with his hat in his hands, looking at the tournament poster as if it were a person he had been introduced to."
    },
    { say: "baylee", text: "\"…Rowan.\" A small nod. \"It's a good room.\"" },
    { flag: "baylee_room_talked" },
    { jump: "end_1" },
    { label: "next_2" },
    { say: "baylee", text: "Mm." },
    { label: "end_1" },
    {
      choice: [
        { text: "Can I ask you a few things, Baylee?", goto: "opt_5", when: (s)=>!!!s.flags["chat_baylee_done"] },
        { text: "Do you want to talk about your deck?", goto: "opt_6", when: (s)=>!!!s.flags["deck_known_baylee"] },
        {
          text: "Is it all right, sharing with Nathan? He's a lot.",
          goto: "opt_7",
          when: (s)=>!!!s.flags["baylee_room_feel"]
        },
        { text: "Carry on. I'll leave you in peace.", goto: "opt_8" }
      ]
    },
    { jump: "choiceend_4" },
    { label: "opt_5" },
    { say: "rowan", text: "Can I ask you a few things, Baylee?" },
    { scene: "chat_baylee" },
    { jump: "choiceend_4" },
    { label: "opt_6" },
    { say: "rowan", text: "Do you want to talk about your deck?" },
    { scene: "deck_baylee" },
    { jump: "choiceend_4" },
    { label: "opt_7" },
    { say: "rowan", text: "Is it all right, sharing with Nathan? He's a lot." },
    { say: "baylee", text: "\"He talks. I listen. It evens out.\"" },
    { text: "A very long pause, with a gull in it." },
    { say: "baylee", text: "\"He's a good one. He just doesn't know where the volume knob is.\"" },
    { flag: "baylee_room_feel" },
    { jump: "choiceend_4" },
    { label: "opt_8" },
    { say: "rowan", text: "Carry on. I'll leave you in peace." },
    { jump: "choiceend_4" },
    { label: "choiceend_4" },
    { time: 4 }
  ]
});
