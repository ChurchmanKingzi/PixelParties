// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
// Der Runner muss Texte als Funktion erlauben (text: (s) => …, ausgewertet mit dem Spielstand) und beim card-Schritt die Seltenheit (rarity) beachten; s.deck = Rowans aktuelles Deck, s.owned = Sammlung je Seltenheit.
const STORY = helpers.story, DATA = helpers.data;
const { AFF, MET, DECK, NOTE, REL, PHOTO, DECKCOUNT, WORDS } = helpers;
scene("row_boardwalk", {
  steps: [
    {
      text: "The path along the row is a long, patched argument between paving stones. Some have been replaced, some have been painted over, one has a footprint in it that is plainly older than the school."
    },
    { text: "You walk its whole length, and learn the row the way you learn a coastline: by its details." },
    {
      text: "Bungalow 2 has a megaphone on its porch rail and a line of wet banners drying beside it, the letters running into each other: WHAT IS IN THE SAUSAGE. A bee hotel under its eaves is humming. A row of empty bottles stands along the step like trophies."
    },
    {
      text: "Bungalow 3 has bunny bunting over the door. Through the screen you glimpse a spreadsheet pinned inside a wardrobe and, in the far corner, a bed hidden behind a sheet someone has hung from the rafters like a wall."
    },
    {
      text: "Bungalow 4 has a workbench on the porch with an unauthorised soldering iron on it, and next to it, in the shade, a small black parasol and a candle that nobody lit."
    },
    {
      text: "Bungalow 5 has a hand-painted sign on its step: TRADES — ASK TOMI. Under it, a map of the island has been taped to the railing with every forbidden place circled in red."
    },
    {
      text: "Bungalow 6 has a thermos and a blanket and a long black coat, hung on a peg, over a pair of very worn hiking boots."
    },
    { text: "Bungalow 8, at the end, is the laundry. It smells of detergent, and of home." },
    { think: "Eight little worlds in a row. I'm going to have to learn all of them." },
    { when: (s)=>!(!!!s.flags["found_path_coins"]), jump: "next_2" },
    {
      text: "Between a pink paving stone and a teal one, where the sand has crept up, three Smug Coins are lying in a row like a dropped sentence. You pocket them. Nobody claims them."
    },
    { coins: 3 },
    { flag: "found_path_coins" },
    { label: "next_2" },
    { label: "end_1" },
    { flag: "walked_boardwalk" },
    { time: 15 }
  ]
});

scene("row_hammock", {
  steps: [
    {
      text: "A hammock hangs between a palm and a signpost on the beach side of the path, in the shade, with a very slight and inviting sag."
    },
    {
      text: "You lie in it. The rope creaks. The sun makes a lattice of light and shadow on your eyelids. Somewhere, a radio is playing a bolero. Somewhere else, a long way off, a crowd of strangers is laughing at something."
    },
    {
      text: "Nobody here knows who Best_Tarleinn is. For twenty minutes, nobody here knows who you are at all, and it feels, unexpectedly, like a very large and generous present."
    },
    { when: (s)=>!(!!!s.flags["found_hammock_card"]), jump: "next_2" },
    {
      text: "When you climb out, something slides from the netting and lands face-up on the sand: a single card, unsleeved, slightly bent. Cute Cheese. There is no name on it, and nobody is looking."
    },
    { card: "Cute Cheese" },
    { flag: "found_hammock_card" },
    { label: "next_2" },
    { label: "end_1" },
    { flag: "rowan_hammock" },
    { time: 20 }
  ]
});

scene("row_lunch", {
  steps: [
    {
      text: "The kitchen is the biggest bungalow on the row, one open room and one long table under a tin roof, with walls hung with dented pans and strings of garlic and twelve years of group photographs. A blackened range roars in the corner. A radio plays boleros through static."
    },
    {
      text: "Mama Odalys is at the range with her sleeves rolled to the elbow, singing. She sees you in the doorway and the song stops mid-line."
    },
    { say: "odalys", text: "\"You! Ven acá. You have not eaten.\"" },
    { say: "rowan", text: "\"I'm not — \"" },
    { say: "odalys", text: "\"That was not a question. Sit.\"" },
    {
      text: "A bowl appears on the bench in front of you, as if conjured: black beans, rice, fried plantain. It is the best thing you have eaten in a fortnight. It might be the best thing you have eaten in your life."
    },
    {
      say: "odalys",
      text: "\"My rules. One, nobody eats alone. Two, nobody skips breakfast. Three, lights out means quiet. Four, if you are sad — \""
    },
    { say: "rowan", text: "\"You said. On the quad.\"" },
    { say: "odalys", text: "\"Good. You were listening. That is already more than your roommate.\"" },
    {
      say: "odalys",
      text: "\"And do not make that face about the Commons. Everybody starts somewhere. I have been feeding this somewhere for twelve years.\""
    },
    { flag: "had_lunch" },
    {
      add: { aff_odalys: 3 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "odalys", n: 3, why: "Fed him" }); } },
    { time: 25 }
  ]
});

scene("row_mama", {
  steps: [
    { text: "Mama Odalys is stirring a pot that could comfortably contain a person." },
    {
      choice: [
        { text: "\"How long have you been running this kitchen, Mrs Fuentes?\"", goto: "opt_2" },
        { text: "\"Can I help? I'm no cook, but I can wash anything you hand me.\"", goto: "opt_3" },
        { text: "\"Who is on the row? I'd like to know whose bungalow is whose.\"", goto: "opt_4" }
      ]
    },
    { jump: "choiceend_1" },
    { label: "opt_2" },
    { say: "rowan", text: "\"How long have you been running this kitchen, Mrs Fuentes?\"" },
    { say: "odalys", text: "\"Twelve years with this stove. The left burner and I are not on speaking terms.\"" },
    { text: "She says it with great affection." },
    {
      say: "odalys",
      text: "\"Before that, the coast-road kitchens. Before that, the old country, but I do not talk about that before supper.\""
    },
    {
      add: { aff_odalys: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "odalys", n: 2, why: "Asked about her" }); } },
    { jump: "choiceend_1" },
    { label: "opt_3" },
    { say: "rowan", text: "\"Can I help? I'm no cook, but I can wash anything you hand me.\"" },
    {
      say: "odalys",
      text: "\"Wash these. And then peel those. And then I will tell you what I think of the way you hold a knife.\""
    },
    {
      text: "You wash, and peel, and are told, within two minutes, that you hold the knife like you are angry at the onion. She shows you how. It is a better way."
    },
    {
      add: { aff_odalys: 3 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "odalys", n: 3, why: "Helped in the kitchen" }); }
    },
    { time: 20 },
    { jump: "choiceend_1" },
    { label: "opt_4" },
    { say: "rowan", text: "\"Who is on the row? I'd like to know whose bungalow is whose.\"" },
    {
      say: "odalys",
      text: "\"Nineteen. Six bungalows' worth. Every one of them mine.\" A heavy, fond pause. \"Do not let the loud one tell you he is the most trouble. He is the most noise. It is different.\""
    },
    { jump: "choiceend_1" },
    { label: "choiceend_1" },
    { time: 8 }
  ]
});

scene("room_unpack", {
  steps: [
    { text: "You unpack the duffel, slowly, on the thin mattress. It is a short job. There is not much in it." },
    {
      text: "A rain jacket, which you are wearing. A second pair of jeans. Three T-shirts, one of which says LAUNDRY KING in Aunt Dee's hand-painted iron-on letters."
    },
    {
      text: "One good shirt, folded in tissue. A wire-bound notebook in which you have, over four years, kept a handwritten record of every deck you have faced on the ladder. The cracked phone, face-down, wrapped in a sock. And, at the bottom, tied with a ribbon, a small plastic tub of cinnamon sweets from Aunt Dee, which she must have slipped in when you were not looking."
    },
    {
      text: "At the bottom, in the seam, something stiff: a card in a sleeve that you did not pack. On the sleeve, in Aunt Dee's uphill handwriting: *for luck. Do not trade it. D.*"
    },
    { card: "Treasure Chest" },
    {
      text: "You set the good shirt on a hanger. You set the notebook on the desk. You put the phone on the windowsill, where it picks up exactly one bar."
    },
    { think: "That's everything I own. It fits in a duffel. It also fits in a window." },
    { flag: "unpacked_done" },
    { time: 15 }
  ]
});

scene("room_goldfish", {
  steps: [
    {
      text: (s) => { const d = DECKCOUNT(s), m = (s.deck && s.deck.main) || null; const storm = !m || (m["Gathering Storm"] || 0) > 0; return "You lay " + (d.name || "your deck") + " out on the bed, card by card, in the old pattern: heroes at the top, abilities down the left, " + (storm ? "the Storm itself centred and facing you." : "the gap where the Storm used to go centred and facing you."); }
    },
    {
      text: (s) => "\"Goldfishing,\" the forums call it: playing a deck against nobody, to see if it works. You shuffle " + WORDS(DECKCOUNT(s).main) + " cards, deal a seven, and play the hand out against an invisible opponent, turn by turn, all by yourself."
    },
    { text: "It is a comfort. It is the only table in the world where your hands do not shake." },
    {
      text: "Two hours later, a row of cards across the blanket, the phone unlocked, the sea hushing, you realise that it has become the sort of afternoon in which the future is a single, very large, very friendly turn that has not happened yet."
    },
    { flag: "goldfished" },
    { time: 25 }
  ]
});

scene("room_letter", {
  steps: [
    {
      text: "The letter is in a pale blue envelope, soft with folding. Aunt Dee's handwriting, which slopes uphill as if embarrassed by the paper."
    },
    { text: "*Rowan,*" },
    {
      text: "*If you are reading this, you are there, and I am very proud, and I have told every customer in the laundromat, including the ones who only came in to use the change machine.*"
    },
    {
      text: "*Don't be scared of the real table. A card on a table is the same card it is on a screen. It is the people who are different. They are scarier and better, and you have the second kind of courage already, you just haven't met the first.*"
    },
    { text: "*Call me when you land. Or text, if the signal is bad. Eat something green.*" },
    { text: "*The dryers are broken again. I am handling it.*" },
    { text: "*Love, Dee.*" },
    {
      text: "*P.S. I put sweets in the bottom of the bag. Don't tell your Uncle Marcus. He thinks they're for him.*"
    },
    {
      text: "You read it twice. The second time, you have to stop partway and look at the ceiling fan for a moment."
    },
    { flag: "read_letter" },
    { time: 10 }
  ]
});




scene("placement_call", {
  steps: [
    { text: "A boy in a yellow bandana is hammering up the boardwalk at a dead run." },
    {
      say: "tomi",
      text: "\"WILDCARD! Placement! Placement duels! They're calling the Commons, it's half one, you're drawn for Dome two, they're doing it in alphabetical order, you're V!\""
    },
    { say: "tomi", text: "\"Come ON. I've got ten Smug Coins on you not throwing up.\"" },
    { think: "I haven't thought about it all day. Not once. Which is exactly why it's here." },
    { goto: "trial_dome", travel: 12 },
    { scene: "placement_duel" }
  ]
});

scene("placement_duel", {
  background: "trial_dome",
  steps: [
    {
      text: "Four small white domes stand in a row like half-buried golf balls, each with a number over the door. You are Dome 2."
    },
    {
      text: "Inside, the roof is a lattice of cream and sky-blue triangles, bright as the inside of an egg. A single holo-table sits on a round dais with a glowing cyan ring, under a ring of lights, and three holographic cards drift above it like paper lanterns. A scoreboard on a stand blinks in one corner. A high-backed judge's chair waits by the door. Wooden benches along the wall are filling with people. The acoustics are odd: a whisper at the table reaches the back wall."
    },
    {
      text: "The benches fill. Forty strangers. They are, in their way, the first people who have ever looked at your hands."
    },
    {
      text: "A young woman in a pencil skirt, with a sleek black bob, red-framed glasses and a slim black brace on her right wrist stands at the judge's chair. A small, neat girl with black braids stands behind a table at the side with a stamp the size of her fist and the expression of someone who has never once misfiled anything."
    },
    {
      say: "hana",
      text: "\"Mr Vance. I am Ms Kirishima, Rules and Judging. This is a placement duel. It is not an examination. It is a measurement. Please be precise with your terminology and do not narrate your emotions.\""
    },
    { say: "hana", text: "\"Your opponent.\"" },
    {
      text: "A girl comes through the dome door and walks to the opposite side of the table without looking at anyone. Blonde hair in two long hanging braids, each tied off with a large red bow. Black polish, chipped. A plain grey collar studded with tiny silver studs, which she dares anyone to mention."
    },
    { say: "hana", text: "\"Rana Marika. Repeating year. Please be seated.\"" },
    { when: (s)=>!(!!s.flags["met_rana"]), jump: "next_2" },
    {
      text: "She glances at you. A very flat flicker of recognition goes across her face, followed by an even flatter one of dread."
    },
    { say: "rana", text: "\"…You.\" Under her breath. \"Of course it's you.\"" },
    { jump: "end_1" },
    { label: "next_2" },
    { say: "rana", alias: "Scowling girl", text: "\"Whatever.\"" },
    { label: "end_1" },
    {
      text: "A tall man in a black turtleneck has appeared in the doorway, hands in his pockets. Silver temples, a sharp goatee, a world-finalist's ring on his right hand that he is turning slowly with his thumb. He does not enter. He does not speak. He is, you understand, watching you."
    },
    {
      text: "Beside the door, a compact woman with cropped dark hair and a whistle round her neck is looking at your hands. She has a stopwatch in her fist. She does not click it."
    },
    {
      think: "Professor Santángel, from the prospectus. And Coach Rox, from the same page. They're watching. Of course they're watching."
    },
    { text: "Your hands begin to shake." },
    {
      text: "You put them on the table. They shake on the table. You put them in your lap. They shake in your lap. The tremor is small, fine, ugly, and entirely your own."
    },
    {
      choice: [
        { text: "Hide them under the table and breathe.", goto: "opt_5", hint: "Hide it" },
        { text: "\"My hands shake. It will pass once the first card goes down.\"", goto: "opt_6" },
        { text: "Look only at the cards.", goto: "opt_7" }
      ]
    },
    { jump: "choiceend_4" },
    { label: "opt_5" },
    {
      text: "You lock your fingers in your lap and breathe in for four counts, out for four. It does not work. It does, however, mean nobody can see it."
    },
    { say: "hana", text: "\"Mr Vance, hands where the table may see them. It is a rule.\"" },
    { flag: "nerve_hid" },
    { jump: "choiceend_4" },
    { label: "opt_6" },
    { say: "rowan", text: "\"My hands shake. It will pass once the first card goes down.\"" },
    { say: "hana", text: "\"Noted.\"" },
    { text: "Not unkindly. She looks at you for a moment longer than the rule requires." },
    { say: "hana", text: "\"Stating a problem aloud is the first step in resolving it. Please proceed.\"" },
    { text: "A quiet murmur goes through the benches. It is not a mocking one." },
    { flag: "nerve_admitted" },
    {
      add: { aff_hana: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "hana", n: 2, why: "Honest about nerves" }); } },
    {
      add: { aff_rox: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "rox", n: 2, why: "Honest about nerves" }); } },
    { jump: "choiceend_4" },
    { label: "opt_7" },
    {
      text: "You look at the cards. Not the benches. Not the doorway. The cards are the same cards they always were on the screen. You pick up the deck and your hands, very slowly, begin to do what you have asked them to do."
    },
    { flag: "nerve_cards" },
    { jump: "choiceend_4" },
    { label: "choiceend_4" },
    { say: "hana", text: "\"Deck check, both players.\" She holds out a hand, palm up, without looking at it." },
    { text: "Rana's deck goes across the felt in one flat, contemptuous slide. Yours goes across less elegantly. Ms Kirishima fans it in a single movement and reads it the way other people read a clock." },
    // Deckprüfung: zählt Rowans AKTUELLES Deck (er kann es umbauen); Abweichungen vom registrierten Preis-Deck benennt sie trocken.
    { say: "hana", text: (s) => {
      const d = DECKCOUNT(s), up = (w) => w.charAt(0).toUpperCase() + w.slice(1);
      let t = "\"" + up(WORDS(d.heroes)) + (d.heroes === 1 ? " Hero, " : " Heroes, ") + WORDS(d.abilities) + (d.abilities === 1 ? " starting Ability, " : " starting Abilities, ") + WORDS(d.main) + " in the main deck" + (d.potions ? ", " + WORDS(d.potions) + " in the Potion Deck." : ", and no Potion Deck.") + "\"";
      const mirror = ((s.deck && s.deck.main) || {})["The Sacred Mirror"] || 0;
      if (d.main !== 60 && mirror >= 4 && d.main > 60 && d.main <= 80) t += " A pause. \"Four Sacred Mirrors. Then " + WORDS(d.main) + " is permitted. I have checked that it is permitted.\"";
      else if (d.main !== 60) t += " A pause, during which she counts again. \"A sanctioned main deck is sixty cards, Mr Vance. This is a measurement, not a tournament, so I will allow it. I will also write it down.\"";
      if (d.heroes !== 3) t += " \"The customary number of Heroes is three. I assume you know that. I assume you have a reason. Neither assumption is my business.\"";
      return t;
    } },
    { say: "hana", text: (s) => {
      const d = DECKCOUNT(s), R = (typeof DATA !== "undefined" && DATA.rowan) || {}, k = s.deck;
      const list = (a) => { const o = {}; for (const c of a || []) o[c.name] = (o[c.name] || 0) + c.n; return o; };
      const same = (a, b) => { a = a || {}; b = b || {}; const ks = Object.keys(Object.assign({}, a, b)); return ks.every(n => (a[n] || 0) === (b[n] || 0)); };
      const changed = !!k && (!same(k.main, list(R.main)) || !same(k.potions, list(R.potions)) || (k.heroes && k.heroes.map(h => (h && h.name) || h).join("|") !== (R.heroes || []).map(h => h.name).join("|")));
      const renamed = !!k && !!k.name && R.name && k.name !== R.name;
      let t = "\"Registered as '" + (R.name || "Gather That Storm!") + "', Wildcard Qualifier, prize print.";
      if (renamed) t += " The box now says '" + k.name + "'. The register has not been told, and will be.";
      if (!changed) return t + "\" She squares it with one tap. \"Common throughout. New stock. The edges are unmarked.\"";
      t += " It is not the list that was registered. It is a relative of it.\" She squares it with one tap.";
      return t + (d.allCommon ? " \"Common throughout, still. The edges are, for the most part, unmarked.\"" : " \"Common, with exceptions. I will not ask where the exceptions came from. I will note that they came from somewhere.\"");
    } },
    { say: "hana", text: "\"Unsleeved, they will not stay unmarked, and a marked card is a matter for this office. Sleeves by Friday, Mr Vance. That is not a penalty. It is a forecast.\"" },
    { when: (s)=>!!s.flags["rowan_commons_seen"], think: "Everybody has had something to say about these cards today. She's the first one who can write it down." },
    { when: (s)=>!s.flags["rowan_commons_seen"], think: "Prize print. It sounds more official when she says it. It also sounds a lot like 'cheap'." },
    { when: (s)=>!!s.flags["met_rana"], say: "rana", text: "\"…The prize list.\" Under her breath, to her own deck. \"Lovely.\"" },
    { flag: "rowan_commons_seen" },
    { flag: "hana_checked_print" },
    { say: "hana", text: "\"Begin.\"" },
    {
      duel: "placement_rana",
      opponent: "rana",
      opponentName: "Rana Marika",
      mustWin: false,
      onWin: [
        { text: "Rana looks at the board for a very long time. It is, you realise, not a defeat. It is an autopsy." },
        {
          say: "rana",
          text: "\"…You held it.\" Flat, furious, fast. \"You held the Locust for three turns. I didn't — you could have just — whatever.\""
        },
        {
          text: "She stands. She does not shake your hand. She does not look at you. At the door she turns, very quickly, and says to nobody:"
        },
        { say: "rana", text: "\"It was good. Don't say anything.\"" },
        {
          set: { ladder: 124 }
        },
        { flag: "placement_won" },
        {
          add: { aff_rana: 2 }
        },
        { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "rana", n: 2, why: "Respected the game" }); } }
      ],
      onLose: [
        {
          text: "The last Hero goes down. The table settles. Your hands are, you notice, still shaking, and it is entirely possible they have been shaking the whole time."
        },
        { say: "rana", text: "\"…Good game.\"" },
        {
          text: "Flat, careful, a reflex. She does not look pleased. She looks, for a moment, like a person who has been given something she does not want to hold."
        },
        { say: "rana", text: "\"Whatever.\"" },
        {
          set: { ladder: 132 }
        },
        { flag: "placement_lost" },
        {
          add: { aff_rana: 1 }
        },
        {
          run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "rana", n: 1, why: "Won without gloating" }); }
        }
      ]
    },
    {
      text: "The tall man in the doorway gives you one slow, level look. He turns, once, the ring flashing on his thumb, and walks out. Four minutes, by the score clock. Nobody has said a word."
    },
    { say: "hana", text: "\"Result recorded. Ranking is a measurement, not a verdict, Mr Vance. Zeynep.\"" },
    { text: "The girl with the stamp stamps something with a brisk, authoritative thud, and hands you a card." },
    { say: "zeynep", alias: "???", text: "\"Ladder placement. Season one. Congratulations, you exist.\"" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["zeynep"]) s.names["zeynep"] = "Zeynep"; if (io && io.popup && !s.flags["met_zeynep"]) io.popup({ type: 'met', id: "zeynep", name: "Zeynep" }); }
    },
    { flag: "met_zeynep" },
    { when: (s)=>!(!!s.flags["placement_won"]), jump: "next_9" },
    { text: "The card reads: RANK 124 OF 144." },
    { jump: "end_8" },
    { label: "next_9" },
    { text: "The card reads: RANK 132 OF 144." },
    { label: "end_8" },
    { think: "A hundred and twenty-something. I was top ten on the ladder a month ago." },
    {
      think: "And I am, for the first time in my life, in a room where that number does not mean what I thought it meant."
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["hana"]) s.names["hana"] = "Ms. Kirishima"; if (io && io.popup && !s.flags["met_hana"]) io.popup({ type: 'met', id: "hana", name: "Ms. Kirishima" }); }
    },
    { flag: "met_hana" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["rox"]) s.names["rox"] = "Coach Rox"; if (io && io.popup && !s.flags["met_rox"]) io.popup({ type: 'met', id: "rox", name: "Coach Rox" }); }
    },
    { flag: "met_rox" },
    {
      text: "The woman with the stopwatch has not moved. She looks at you for a long moment, at your hands, at your shoulders, and then at the rest of you. She says nothing. She makes a very small mark on a clipboard."
    },
    { flag: "placement_done" },
    { time: 90 }
  ]
});

scene("supper_call", {
  steps: [
    {
      text: "The first sign is the smell. It comes up the beach on the breeze from the end of the row: cumin, garlic, frying plantain, something slow and dark with beans in it. It is warm and loud and unmistakably addressed to you."
    },
    {
      text: "Then a bell rings, once, with the particular, brassy authority of a woman who has been ringing it for twelve years. The whole boardwalk answers in a murmur of doors."
    },
    { say: "odalys", text: "\"SUPPER!\"" },
    { goto: "commons_kitchen", travel: 2 },
    { scene: "welcome_supper" }
  ]
});

scene("welcome_supper", {
  background: "commons_kitchen",
  steps: [
    { unflag: "follow_nathan" },
    { unflag: "follow_baylee" },
    { music: "friends" },
    {
      text: "Bungalow one, which is Mama's kitchen, is one long table, one blackened range, and nineteen strangers arriving in clumps."
    },
    {
      text: "The table is a single slab of dark wood under a tin roof, worn smooth by twelve years of elbows. The benches on both sides have been squeezed together. Dented pans hang from the walls. Twelve years of group photographs look down from the rafters. A radio on the sill plays boleros through static."
    },
    {
      text: "Mama Odalys is carrying a pot that ought to need two people. She sets it down in the centre of the table, in a cloud of steam, with a clang like the end of a bell."
    },
    { say: "odalys", text: "\"Sit! Sit! Nineteen of you, one bench each, no corners!\"" },
    { text: "Everyone sits. It takes four minutes, three arguments and one mild fire at the end of the table." },
    {
      say: "odalys",
      text: "\"Names! I want every one of you to say your bungalow, your name and one true thing. Left of me. Go!\""
    },
    {
      say: "freya",
      text: "\"Freya Nordlicht. Two. Where I come from the sun goes away for three months. You learn to make your own entertainment.\""
    },
    {
      say: "hedda",
      text: "\"Hedda Njord, bungalow two. Nothing in this stew was killed for it. I checked. The answer is 'mostly'.\""
    },
    { say: "trixie", text: "\"Beatrix! Trixie! Hollis! Two! Bees don't fib!\"" },
    {
      say: "inya",
      text: "\"Inya Bell. Three. A rabbit can turn ninety degrees at full speed. Name one of your storm clouds that can do that.\""
    },
    {
      say: "livvie",
      text: "\"Olivia Thana. Livvie. Three. I've eaten. I had a big breakfast.\" Everyone looks at her. \"Yesterday counts.\""
    },
    { say: "rana", text: "\"Rana. Three.\" Silence. \"That's all you get.\"" },
    { say: "maisie", text: "\"Maisie Voltage! Four! It's meant to hum like that, I swear.\"" },
    {
      say: "freddie",
      text: "\"Winifred Camara. Freddie. Four. Five brothers. Ask me anything. I have seen everything and I am unembarrassed by all of it.\""
    },
    { say: "fiona", text: "\"Fiona Blackwood. Four.\"" },
    { text: "Low, slow, a candle placed on every syllable." },
    { say: "fiona", text: "\"Things that are thrown away come back.\"" },
    { say: "leona", text: "\"Leona Helical. Four. I got in the same way everyone did. There was a form.\"" },
    { say: "ed", text: "\"ED VENTURE! Five! Lazy V Ranch, high plains! Is any of this dangerous?\"" },
    { say: "tomi", text: "\"Tomás Reyes. Tomi. Five. Friend price. Everybody's a friend, the price is the price.\"" },
    {
      say: "sammy",
      text: "\"Sammy Counts. Six.\" Low, slow, ominous. \"Nobody really knows me. That's — I mean, that's deliberate.\" A beat. \"Did that sound deliberate?\""
    },
    { say: "tobias", text: "\"Tobias Crowe. Six. Saltgate.\" And that, evidently, is all." },
    { say: "dmitri", text: "\"Dmitri Volkov. Six. Morning is a rumour. I have never seen evidence.\"" },
    { say: "nathan", text: "\"NATHAN WHISPER! SEVEN! WAR COUNSELORS! I SNORE!\"" },
    { say: "baylee", text: "\"Baylee Halvorsen. Seven.\" A long pause. \"…Yup.\"" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["freya"]) s.names["freya"] = "Freya Nordlicht"; if (io && io.popup && !s.flags["met_freya"]) io.popup({ type: 'met', id: "freya", name: "Freya Nordlicht" }); }
    },
    { flag: "met_freya" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["hedda"]) s.names["hedda"] = "Hedda Njord"; if (io && io.popup && !s.flags["met_hedda"]) io.popup({ type: 'met', id: "hedda", name: "Hedda Njord" }); }
    },
    { flag: "met_hedda" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["trixie"]) s.names["trixie"] = "Beatrix Hollis"; if (io && io.popup && !s.flags["met_trixie"]) io.popup({ type: 'met', id: "trixie", name: "Beatrix Hollis" }); }
    },
    { flag: "met_trixie" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["inya"]) s.names["inya"] = "Inya Bell"; if (io && io.popup && !s.flags["met_inya"]) io.popup({ type: 'met', id: "inya", name: "Inya Bell" }); }
    },
    { flag: "met_inya" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["livvie"]) s.names["livvie"] = "Olivia Thana"; if (io && io.popup && !s.flags["met_livvie"]) io.popup({ type: 'met', id: "livvie", name: "Olivia Thana" }); }
    },
    { flag: "met_livvie" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["rana"]) s.names["rana"] = "Rana"; if (io && io.popup && !s.flags["met_rana"]) io.popup({ type: 'met', id: "rana", name: "Rana" }); }
    },
    { flag: "met_rana" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["maisie"]) s.names["maisie"] = "Maisie Voltage"; if (io && io.popup && !s.flags["met_maisie"]) io.popup({ type: 'met', id: "maisie", name: "Maisie Voltage" }); }
    },
    { flag: "met_maisie" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["freddie"]) s.names["freddie"] = "Winifred Camara"; if (io && io.popup && !s.flags["met_freddie"]) io.popup({ type: 'met', id: "freddie", name: "Winifred Camara" }); }
    },
    { flag: "met_freddie" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["fiona"]) s.names["fiona"] = "Fiona Blackwood"; if (io && io.popup && !s.flags["met_fiona"]) io.popup({ type: 'met', id: "fiona", name: "Fiona Blackwood" }); }
    },
    { flag: "met_fiona" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["leona"]) s.names["leona"] = "Leona Helical"; if (io && io.popup && !s.flags["met_leona"]) io.popup({ type: 'met', id: "leona", name: "Leona Helical" }); }
    },
    { flag: "met_leona" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["ed"]) s.names["ed"] = "Ed"; if (io && io.popup && !s.flags["met_ed"]) io.popup({ type: 'met', id: "ed", name: "Ed" }); }
    },
    { flag: "met_ed" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["tomi"]) s.names["tomi"] = "Tomás Reyes"; if (io && io.popup && !s.flags["met_tomi"]) io.popup({ type: 'met', id: "tomi", name: "Tomás Reyes" }); }
    },
    { flag: "met_tomi" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["sammy"]) s.names["sammy"] = "Sammy Counts"; if (io && io.popup && !s.flags["met_sammy"]) io.popup({ type: 'met', id: "sammy", name: "Sammy Counts" }); }
    },
    { flag: "met_sammy" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["tobias"]) s.names["tobias"] = "Tobias Crowe"; if (io && io.popup && !s.flags["met_tobias"]) io.popup({ type: 'met', id: "tobias", name: "Tobias Crowe" }); }
    },
    { flag: "met_tobias" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["dmitri"]) s.names["dmitri"] = "Dmitri Volkov"; if (io && io.popup && !s.flags["met_dmitri"]) io.popup({ type: 'met', id: "dmitri", name: "Dmitri Volkov" }); }
    },
    { flag: "met_dmitri" },
    { run: (s)=>{ s.names = s.names || {}; s.names["livvie"] = "Olivia \"Livvie\" Thana"; } },
    { flag: "fullname_livvie" },
    { run: (s)=>{ s.names = s.names || {}; s.names["tomi"] = "Tomás \"Tomi\" Reyes"; } },
    { flag: "fullname_tomi" },
    { run: (s)=>{ s.names = s.names || {}; s.names["trixie"] = "Beatrix \"Trixie\" Hollis"; } },
    { flag: "fullname_trixie" },
    { run: (s)=>{ s.names = s.names || {}; s.names["freddie"] = "Winifred \"Freddie\" Camara"; } },
    { flag: "fullname_freddie" },
    { flag: "rel_freya_hedda" },
    { flag: "rel_freya_trixie" },
    { flag: "rel_hedda_trixie" },
    { flag: "rel_inya_livvie" },
    { flag: "rel_inya_rana" },
    { flag: "rel_livvie_rana" },
    { flag: "rel_maisie_fiona" },
    { flag: "rel_maisie_leona" },
    { flag: "rel_fiona_leona" },
    { flag: "rel_sammy_tobias" },
    { flag: "rel_sammy_dmitri" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["sammy"] = s.notes["sammy"] || []); if (a.indexOf("The Academy lists him as Samuel Counts. He goes by Sammy, and flinches at the full name.") < 0) a.push("The Academy lists him as Samuel Counts. He goes by Sammy, and flinches at the full name."); }
    },
    { flag: "rel_tobias_dmitri" },
    { flag: "rel_maisie_freddie" },
    { flag: "rel_fiona_freddie" },
    { flag: "rel_leona_freddie" },
    {
      say: "odalys",
      text: "\"And last, as in the list, the Wildcard. Stand up, mijo. Everybody is looking at you anyway.\""
    },
    {
      choice: [
        { text: "\"Rowan Vance. Seven. I'm — happy to be here.\"", goto: "opt_2" },
        { text: "\"Rowan. I fold sheets. Aunt Dee's laundromat.\"", goto: "opt_3" },
        { text: "\"Best_Tarleinn.\"", goto: "opt_4" }
      ]
    },
    { jump: "choiceend_1" },
    { label: "opt_2" },
    { say: "rowan", text: "\"Rowan Vance. Seven. I'm — happy to be here.\"" },
    { text: "A polite, warm murmur. Nathan, loudly: \"HE'S HAPPY! He said so! Write it down!\"" },
    {
      add: { aff_nathan: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "nathan", n: 1, why: "Introduced himself" }); }
    },
    { jump: "choiceend_1" },
    { label: "opt_3" },
    { say: "rowan", text: "\"Rowan. I fold sheets. Aunt Dee's laundromat.\"" },
    { text: "A ripple of laughter, entirely kind. Mama Odalys's spoon bangs the pan once in approval." },
    { say: "odalys", text: "\"A man who folds sheets knows how to look after a household. Good.\"" },
    {
      add: { aff_odalys: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "odalys", n: 2, why: "Honest about home" }); } },
    { flag: "told_row_laundromat" },
    { jump: "choiceend_1" },
    { label: "opt_4" },
    { say: "rowan", text: "\"Best_Tarleinn.\"" },
    { text: "For a moment, nothing. And then a whole row of faces tilts." },
    { say: "tomi", text: "\"Wait. Wait. Hold on.\"" },
    { text: "A pencil appears from behind his ear, as if from nowhere." },
    { say: "tomi", text: "\"The ladder guy. Number five. The Tarleinn guy.\"" },
    { say: "rana", text: "\"…The Storm deck.\"" },
    { text: "Flat. Sharp. Something in her face has shifted very slightly." },
    { say: "rana", text: "\"That was you.\"" },
    { say: "nathan", text: "\"WHAT. WHAT. WHAT!\"" },
    { say: "inya", text: "\"Ranked. Five. I've watched your replays.\"" },
    { text: "A very slight, very suspicious narrowing." },
    { say: "inya", text: "\"You better not be a fraud.\"" },
    {
      add: { aff_tomi: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "tomi", n: 2, why: "The ladder guy" }); } },
    {
      add: { aff_rana: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "rana", n: 2, why: "Knew the deck" }); } },
    {
      add: { aff_inya: 1 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 1, why: "Knew the name" }); } },
    { flag: "row_knows_handle" },
    { jump: "choiceend_1" },
    { label: "choiceend_1" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["odalys"]) s.names["odalys"] = "Mama Odalys"; if (io && io.popup && !s.flags["met_odalys"]) io.popup({ type: 'met', id: "odalys", name: "Mama Odalys" }); }
    },
    { flag: "met_odalys" },
    {
      prompt: "Where do you sit?",
      choice: [
        { text: "Between Nathan and Baylee.", goto: "opt_6", hint: "Your roommates" },
        { text: "At the end by the mint-green hair.", goto: "opt_7", hint: "Inya" },
        { text: "At the far end, by the scowl.", goto: "opt_8", hint: "Rana" },
        { text: "At the quiet end.", goto: "opt_9", hint: "Dmitri, Sammy, Tobias" }
      ]
    },
    { jump: "choiceend_5" },
    { label: "opt_6" },
    { text: "You take the gap between your roommates. Nathan has already made it, with an elbow." },
    { say: "nathan", text: "\"ROWAN! Sit, sit! You're on my right! Baylee's on my left! We're a unit!\"" },
    { say: "baylee", text: "\"…Pass the rice.\"" },
    { say: "nathan", text: "\"I'm passing the rice! I'm passing it LOUDLY!\"" },
    {
      add: { aff_nathan: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "nathan", n: 2, why: "Sat with him" }); } },
    {
      add: { aff_baylee: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "baylee", n: 2, why: "Sat with him" }); } },
    { flag: "supper_with_roommates" },
    { jump: "choiceend_5" },
    { label: "opt_7" },
    {
      text: "A small girl with long mint-green hair in two tails is sitting cross-legged on a bench, an oversized hoodie round her like a tent. She sees you coming. Her eyes narrow."
    },
    { say: "inya", text: "\"Don't sit here to be nice.\"" },
    { say: "rowan", text: "\"I'm sitting here because there's a seat.\"" },
    { say: "inya", text: "\"…Fine.\" A beat. \"That's better.\"" },
    {
      text: "Next to her, a pale girl with a violet-black bob is eating very fast and very neatly, as if each forkful is a transaction. She looks at your plate, looks at hers, and with a very slight movement pushes the last piece of plantain towards you."
    },
    { say: "livvie", text: "\"Quick thing. You can have that. I've had enough.\"" },
    { text: "She has not had enough. Nobody has ever, in the history of the world, had enough on that face." },
    {
      add: { aff_inya: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 2, why: "Sat with her" }); } },
    {
      add: { aff_livvie: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "livvie", n: 2, why: "Shared a plate" }); } },
    { flag: "supper_with_inya" },
    { jump: "choiceend_5" },
    { label: "opt_8" },
    {
      text: "Rana is at the far end of the long table with her back to the wall and a gap on either side of her that nobody has quite dared fill. She does not look up as you sit down."
    },
    { say: "rana", text: "\"…Why.\"" },
    { say: "rowan", text: "\"There's a seat.\"" },
    { say: "rana", text: "\"There's a hundred seats.\"" },
    { say: "rowan", text: "\"Nineteen. I counted.\"" },
    {
      text: "A very long pause. And then, very slightly, something moves in the corner of her mouth. It is not a smile. It is its cousin."
    },
    { say: "rana", text: "\"…Pass the salt.\"" },
    {
      add: { aff_rana: 3 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "rana", n: 3, why: "Sat by her" }); } },
    { flag: "supper_with_rana" },
    { jump: "choiceend_5" },
    { label: "opt_9" },
    {
      text: "The far corner of the bench is occupied by the three boys from bungalow 6. Sammy, in his coat, is sitting very upright. Tobias, in his hoodie, is eating like someone who counts meals. Dmitri is wrapped in a blanket and entirely, perfectly awake."
    },
    { say: "dmitri", text: "\"The only man at supper with the sun in his eyes. Hello.\"" },
    { say: "tobias", text: "\"Shove up, Sam.\"" },
    { say: "sammy", text: "\"Counts. It's — fine. Sorry.\"" },
    { text: "He shuffles, and the coat catches the stew, and nobody says anything about it." },
    {
      add: { aff_dmitri: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "dmitri", n: 2, why: "Sat with him" }); } },
    {
      add: { aff_tobias: 1 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "tobias", n: 1, why: "Sat with him" }); } },
    {
      add: { aff_sammy: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "sammy", n: 2, why: "Sat with him" }); } },
    { flag: "supper_quiet_end" },
    { jump: "choiceend_5" },
    { label: "choiceend_5" },
    { text: "The whole row, bungalow by bungalow, in the steam." },
    {
      text: "At the head of the table, in an upright chair with a high back that is quite clearly hers and nobody else's, Mama Odalys is ladling stew with the grave dispatch of a quartermaster."
    },
    {
      text: "Down the left side: Freya, very upright, very cool, hair in a pale braid, saying nothing to anyone with great elegance. Next to her Hedda, who is inspecting the stew with a fork and the narrowed eyes of an investigator. Next to her Trixie, who has something alive in a matchbox and is whispering to it. \"Don't tell Mama,\" she tells you. \"It's only a beetle.\""
    },
    {
      text: "Further down, from bungalow 4: Freddie, hair still wet, has taken two helpings and is explaining the anatomy of an octopus to an uninterested bench. Maisie is taking the pepper mill apart. Fiona, in black lace, is saying grace in a very deep voice. Leona, ordinary, pleasant, forgettable, has chosen the seat nearest the door."
    },
    {
      text: "From bungalow 5: Ed is leaning back on two legs of his chair asking Mama which part of the island is forbidden. Tomi is already trading something under the table, quietly, with a boy you do not recognise. Viktor Hale is not here."
    },
    {
      text: "From bungalow 6: Sammy, silent at people. Tobias, eating like someone who counts meals. Dmitri, wide awake when everyone else is fading."
    },
    { think: "Nineteen people. Nineteen names. I'm going to be here for two hundred days." },
    { say: "odalys", text: "\"House rules!\"" },
    { text: "The spoon hits a pan. The whole table goes silent." },
    {
      say: "odalys",
      text: "\"Nobody eats alone! Nobody skips breakfast! Lights out means quiet! And if you are sad, you tell somebody!\""
    },
    { say: "odalys", text: "\"If you cannot tell somebody, tell me! If you cannot tell me — \"" },
    {
      text: "The whole table, in ragged unison, from the people who have apparently been told this already: \"TELL THE SPOON.\""
    },
    { say: "odalys", text: "\"Good! Eat!\"" },
    { when: (s)=>!(!!!s.flags["met_viktor"]), jump: "next_11" },
    { text: "The door bangs open." },
    {
      text: "A lean, tanned boy in a red jacket worn like something borrowed, in a wide-brimmed grey-brown hat with a pale-blue feather in the band, mud to both knees, has arrived late. He carries a coil of rope and a brass compass."
    },
    {
      say: "viktor",
      alias: "???",
      text: "\"Sorry. I was — there's a path past the waterfall. I was exploring. It isn't on the map.\" A long pause. \"Mm.\""
    },
    { say: "odalys", text: "\"SIT. Wash your hands. You smell of mountain.\"" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["viktor"]) s.names["viktor"] = "Viktor Hale"; if (io && io.popup && !s.flags["met_viktor"]) io.popup({ type: 'met', id: "viktor", name: "Viktor Hale" }); }
    },
    { flag: "met_viktor" },
    { label: "next_11" },
    { label: "end_10" },
    {
      text: "Ed asks Mama which part of the island is forbidden, and is told, very kindly and very firmly, that she will not be answering that. He seems delighted. He makes a note."
    },
    { say: "nathan", text: "\"So I snore.\"" },
    { text: "He says it to the entire table, at his own volume." },
    {
      say: "nathan",
      text: "\"I'm telling you all now. So you know. My mom says it's like living next to a chainsaw, but a friendly chainsaw.\""
    },
    { say: "baylee", text: "\"He does.\"" },
    { say: "rowan", text: "\"Noted.\"" },
    { say: "nathan", text: "\"HA! 'Noted'! You hear that? He said 'noted'! Very formal! I like him!\"" },
    {
      text: "A very long, very loud, very good evening follows, in which nothing remotely important happens. Hedda finishes the stew, glares at the empty bowl and says, quietly, \"Fine. FINE. The rice is good.\" Freya laughs for the first time since you sat down, a low warm sound, and says \"To the ferry captain's hat.\" Nobody quite knows why. Everyone drinks. Livvie eats three helpings and does not look at anyone. Mama Odalys, noticing, slides a fourth in front of her without comment."
    },
    {
      text: "By the time the last plate is dry the stars have come out over the cove and the radio has gone to a slow song that Mama hums, quietly, over the sink."
    },
    { flag: "supper_done" },
    { time: 120 },
    { scene: "first_night" }
  ]
});

scene("first_night", {
  background: "commons_room",
  steps: [
    { music: "emotional" },
    { goto: "commons_room", travel: 2 },
    {
      text: "The row at night is a string of yellow windows. The surf breathes. The geckos chirp under the eaves. Every paving stone rocks a different note under your feet."
    },
    {
      text: "Back in bungalow 7, the ceiling fan ticks on every fourth turn. Three beds. Three footlockers. One bare bulb that is, at last, switched off."
    },
    { text: "In the dark, a voice from the bed at the other end of the room says, quite quietly for him:" },
    { say: "nathan", text: "\"Rowan. You awake?\"" },
    { say: "rowan", text: "\"…Yeah.\"" },
    { say: "nathan", text: "\"Can I ask you something?\"" },
    { say: "rowan", text: "\"Sure.\"" },
    { text: "A long, comfortable pause, full of surf." },
    {
      say: "nathan",
      text: "\"Were you scared? Today? When the little domes thing happened. I was in the back. I couldn't tell.\""
    },
    {
      text: "You look at the ceiling. The fan ticks. From the middle bed, the very large, very gentle shape of Baylee has gone entirely still, which means, you have already learned, that he is listening."
    },
    {
      choice: [
        { text: "\"They did, honestly. My hands shook the whole time.\"", goto: "opt_2" },
        { text: "\"It was fine, really. I've done harder things.\"", goto: "opt_3" },
        { text: "\"Were you, Nathan? Scared, I mean?\"", goto: "opt_4" }
      ]
    },
    { jump: "choiceend_1" },
    { label: "opt_2" },
    { say: "rowan", text: "\"They did, honestly. My hands shook the whole time.\"" },
    { say: "nathan", text: "\"…Huh.\" A pause. \"I would've said they didn't. I was watching. Honest.\"" },
    { say: "baylee", text: "\"Yup. Didn't see it.\"" },
    { say: "nathan", text: "\"The thing is, I'm scared all the time. Of everything. I just do it louder.\"" },
    { think: "I did not expect that. I did not expect a lot of things today." },
    {
      add: { aff_nathan: 3 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "nathan", n: 3, why: "Told him the truth" }); }
    },
    {
      add: { aff_baylee: 2 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "baylee", n: 2, why: "Told them both the truth" }); }
    },
    { flag: "told_roommates_nerves" },
    { jump: "choiceend_1" },
    { label: "opt_3" },
    { say: "rowan", text: "\"It was fine, really. I've done harder things.\"" },
    { say: "nathan", text: "\"Cool! Yeah! Cool! I'd have thrown up.\"" },
    { say: "baylee", text: "\"He would.\"" },
    { say: "nathan", text: "\"I WOULD.\"" },
    {
      add: { aff_nathan: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "nathan", n: 1, why: "Cheerful night talk" }); }
    },
    { jump: "choiceend_1" },
    { label: "opt_4" },
    { say: "rowan", text: "\"Were you, Nathan? Scared, I mean?\"" },
    {
      say: "nathan",
      text: "\"Me? NO.\" A pause. \"…A bit. Nobody here's from anywhere near where I'm from. Everyone's got like, a whole deck of people. I've got my mom and a hamster.\""
    },
    { say: "baylee", text: "\"I've got a lot of cows.\"" },
    { say: "nathan", text: "\"BAYLEE'S GOT COWS!\"" },
    { say: "baylee", text: "\"I've got cows.\"" },
    {
      add: { aff_nathan: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "nathan", n: 2, why: "Asked him back" }); } },
    {
      add: { aff_baylee: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "baylee", n: 2, why: "Joined in" }); } },
    { jump: "choiceend_1" },
    { label: "choiceend_1" },
    {
      text: "A very long, very comfortable silence follows. The surf hushes. Somewhere on the boardwalk, a gecko chirps twice, as if checking the room."
    },
    { say: "nathan", text: "\"'Night, Wildcard.\"" },
    { say: "baylee", text: "\"Night.\"" },
    { say: "rowan", text: "\"…Night.\"" },
    { text: "Within three minutes, the bed at the other end of the room begins to snore." },
    {
      text: "It is a tremendous snore. It is the snore of a chainsaw, a friendly chainsaw, at a very great distance, in a room designed for the purpose. You lie awake and listen to it for a very long time, and discover, somewhere around the fortieth minute, that you are smiling at the ceiling."
    },
    { think: "Day one. I'm still here. I didn't throw up." },
    {
      think: "Tomorrow the ranking starts for real. Tonight it is just a bed, and a ceiling, and a friendly chainsaw."
    },
    { flag: "day1_complete" },
    { time: 60 }
  ]
});

scene("sleep", {
  steps: [
    { fx: "fadeout", ms: 700 },
    { text: "You sleep. Somewhere on the island a bell rings. Somewhere on the row, a chainsaw, friendly, goes on." },
    { when: (s)=>!(!!s.flags["day1_complete"]), jump: "next_2" },
    { run: (s)=>{ s.day += 1; s.minutes = 420; } },
    { goto: "commons_room", travel: 0 },
    { fx: "fadein", ms: 700 },
    {
      gameOver: "END OF THE CURRENT BUILD. Day 1 is complete; Day 2 (Orientation Day) is not written yet. Your save is kept."
    },
    { jump: "end_1" },
    { label: "next_2" },
    { run: (s)=>{ s.day += 1; s.minutes = 420; } },
    { goto: "commons_room", travel: 0 },
    { fx: "fadein", ms: 700 },
    {
      text: "Morning on Caldera Key. Day 2 has not been written yet. You are free to wander the row, but there is nothing waiting for you."
    },
    { label: "end_1" }
  ]
});
