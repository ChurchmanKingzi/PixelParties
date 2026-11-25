// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
scene("ferry_prologue", {
  once: true,
  background: "ferry_deck",
  music: "menu",
  steps: [
    {
      text: "Salt on your lips. An engine thrumming somewhere under your shoes. You must have dozed off against the railing again."
    },
    {
      text: "The ferry left the mainland at nine last night. Nine and a half hours of black water, one bench under a lifeboat, a cocoa you paid for with the last of your real money, and a string of naps that never quite counted as sleep."
    },
    {
      text: "Now the sky over the bow has gone the colour of weak tea, and on the very edge of it, where the water stops, there is something that is not cloud."
    },
    {
      text: "An island. It is still far off, a grey smudge slowly deciding to become a cone, with a thin thread of smoke above it. Caldera Key. Pixel Academy."
    },
    {
      text: "Two weeks ago you were folding other people's sheets in Aunt Dee's laundromat, phone propped against the detergent shelf, climbing the online ladder one match at a time between dryer cycles."
    },
    {
      text: "Best_Tarleinn. Top ten on the ladder for your age bracket. Winner of the Wildcard Qualifier, the last open seat of the year."
    },
    {
      text: "You have never once played this game on a real table. Never shuffled a real deck in front of a real person who was looking at your hands."
    },
    {
      text: "Your deck box sits in the pocket of your old rain jacket. Gather That Storm. Seventy-four cards, counting the three heroes and their six starting abilities, and you know every one of them by heart."
    },
    {
      text: "The acceptance letter is still in your bag, folded so often it has gone soft. You know it by heart now, down to the line about Bungalow 7."
    },
    {
      text: "Folded inside the letter, a small canvas pouch: a hundred and forty Smug Coins, one starting purse for every student on the island, each stamped with a smirking little face. The Academy's own money. Good here, and nowhere else. The few folded notes in your sock, which are every scrap of mainland money you own, are worth exactly nothing past the arch."
    },
    { text: "You do not know yet what that means." },
    {
      text: "Behind the pouch, a single stiff page: the uniform guide. It is the only part of the letter written like a rulebook, so you have learned it by heart as well."
    },
    {
      text: "The JACKET is your major. Red is Competitive Play, gold is Game Design, black is Auxiliary. The COLLAR is your rank, which means your dorm, and the Academy does not pretend otherwise: white with a gold edge for Spectral at the top, blue for Rare in the middle, plain grey for the Commons at the foot."
    },
    { text: "At the bottom, in smaller print: \"Rank is where you start. It is not where you finish.\"" },
    { think: "Red jacket, grey collar. Competitive Play, and the bottom rung. Fine. I've started from lower." },
    { text: "Yours will be issued on arrival, the letter says. The others received theirs in the post a month ago." },
    {
      text: "The deck around you is filling up: duffel bags, deck boxes, thirty-odd people your age in stiff new jackets, mostly red, some gold, a few black, each with a collar of white-and-gold, blue or grey. Every one of them is a stranger. You are the only person on deck in a rain jacket, and the only one who looks like it."
    },
    { text: "A loudspeaker crackles above the wheelhouse." },
    {
      name: "Loudspeaker",
      text: "\"Morning, all. Captain Stroud speaking. Thirty-eight new heads aboard, I counted twice. Reef's in the way, so we go round the long side: tie-up at ten-forty. There is coffee in the lounge. Hold on to your hats.\""
    },
    { enter: "nathan", x: 30, y: 98, h: 64 },
    {
      say: "nathan",
      alias: "Spiky-haired boy",
      text: "\"**DUDE.** Is that it? That's *IT*, right? That's the island! Hey — **HEY**, big guy, look, that's the island!\"",
      mood: "laughing",
      shake: true
    },
    {
      text: "The shout comes from about a foot behind your ear. Its owner has a square face, spiky charcoal hair standing up like a crown with one magenta clip at the temple, a chipped front tooth and the widest grin you have seen all week. He points at the volcano with his whole arm."
    },
    { enter: "baylee", x: 14, y: 99, h: 78 },
    {
      text: "The \"big guy\" is not hard to find. He is the tallest person on the deck by a head and a half, in a straw hat as wide as a cartwheel, sunburnt, built like a barn door, his jacket slung over one shoulder, and he stands with his shoulders pulled in so that people can get past him."
    },
    { say: "baylee", alias: "Very tall boy in a straw hat", text: "\"…I see it.\"", mood: "shy" },
    {
      say: "nathan",
      alias: "Spiky-haired boy",
      text: "\"Nathan Whisper! War Counselors, best deck in the format, don't let anyone tell you different. You look wrecked. You a first-year too? What dorm? I'm the Commons, grey collar, I figure grey's the best colour, it goes with everything.\"",
      mood: "happy"
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["nathan"]) s.names["nathan"] = "Nathan Whisper"; if (io && io.popup && !s.flags["met_nathan"]) io.popup({ type: 'met', id: "nathan", name: "Nathan Whisper" }); }
    },
    { flag: "met_nathan" },
    {
      run: (s,io)=>{ if (io && io.popup && !s.flags["deck_known_nathan"]) io.popup({ type: 'deck', id: "nathan" }); }
    },
    { flag: "deck_known_nathan" },
    { text: "He sticks out a hand. Behind him the giant gives you a small nod." },
    {
      say: "baylee",
      alias: "Very tall boy in a straw hat",
      text: "\"Baylee. Commons too. …He has been like this since the harbour.\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["baylee"]) s.names["baylee"] = "Baylee"; if (io && io.popup && !s.flags["met_baylee"]) io.popup({ type: 'met', id: "baylee", name: "Baylee" }); }
    },
    { flag: "met_baylee" },
    { flag: "flag_prologue_done" },
    { learn: "ferry_lounge" },
    { learn: "ferry_stern" },
    { learn: "ferry_bridge" },
    {
      text: "Nathan's hand is still out. Two strangers are waiting to find out who you are, and nobody has told you yet how much of it you have to say."
    },
    {
      prompt: "How do you introduce yourself?",
      choice: [
        {
          text: "\"Rowan Vance. Yes, first-year, and I think I'm in the Commons as well, bungalow seven. I only got my housing two weeks ago, so I'm still catching up on what any of this means.\"",
          goto: "opt_2"
        },
        {
          text: "\"Rowan. Just Rowan for now. I'm in the Commons too, apparently. Have you had a look round the ship yet? Anything worth finding?\"",
          goto: "opt_3"
        },
        {
          text: "Shake his hand and say only that you are tired and new, and that you would rather listen for a while.",
          goto: "opt_4"
        }
      ]
    },
    { jump: "choiceend_1" },
    { label: "opt_2" },
    {
      say: "rowan",
      text: "\"Rowan Vance. Yes, first-year, and I think I'm in the Commons as well, bungalow seven. I only got my housing two weeks ago, so I'm still catching up on what any of this means.\""
    },
    {
      add: { aff_nathan: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "nathan", n: 1, why: "Introduced himself properly" }); }
    },
    { flag: "follow_nathan" },
    { flag: "follow_baylee" },
    { text: "You take the hand. It shakes yours the way a pump handle would, if the pump were delighted." },
    { say: "nathan", text: "\"SEVEN! That's — hold on. Hold on. Vance? Vance, R.?\"", mood: "happy" },
    { text: "He lets go of your hand and stares at you with the kind of expression normally reserved for a UFO." },
    {
      say: "nathan",
      text: "\"There's a name on the passenger list. By the wheelhouse door. In INK, like somebody added it with a fountain pen at the last minute. 'Vance, R. — Wildcard.' Nobody knows who it is! There's a whole betting pool going on the lounge benches about who it is! That's YOU?\"",
      mood: "laughing"
    },
    {
      think: "A list. By the wheelhouse door, with my name on it, in ink. Nobody mentioned a list. And I've just handed him the surname to match it."
    },
    { flag: "nathan_read_list" },
    {
      choice: [
        {
          text: "\"Yes, that's me. I won the Wildcard Qualifier two weeks ago, the last open seat of the year. I still feel a bit strange saying it out loud.\"",
          goto: "opt_6"
        },
        {
          text: "\"Yes. But I would honestly rather the whole boat didn't hear about it before I've even found the lounge.\"",
          goto: "opt_7"
        },
        { text: "\"That's me. Does the betting pool pay out to the winner of the mystery? I'd like a cut.\"", goto: "opt_8" }
      ]
    },
    { jump: "choiceend_5" },
    { label: "opt_6" },
    {
      say: "rowan",
      text: "\"Yes, that's me. I won the Wildcard Qualifier two weeks ago, the last open seat of the year. I still feel a bit strange saying it out loud.\""
    },
    {
      say: "nathan",
      text: "\"THE LAST OPEN SEAT! Baylee, he got the last seat! That's like winning the lottery but with cards!\"",
      mood: "happy"
    },
    { say: "baylee", text: "\"Congratulations.\"" },
    {
      say: "nathan",
      text: "\"That's — Rowan. Rowan! You're famous! You're the whole boat's mystery! I've got to tell everyone!\"",
      mood: "grin"
    },
    { say: "rowan", text: "\"Please don't tell everyone. I only just got here.\"" },
    { say: "nathan", text: "\"I'm already telling everyone!\"", mood: "laughing" },
    { flag: "told_wildcard" },
    { flag: "ship_knows_wildcard" },
    { jump: "choiceend_5" },
    { label: "opt_7" },
    {
      say: "rowan",
      text: "\"Yes. But I would honestly rather the whole boat didn't hear about it before I've even found the lounge.\""
    },
    {
      say: "nathan",
      text: "\"Oh. OH. You're shy! That's fine! I get it! I'll only tell, like, half the boat!\"",
      mood: "happy"
    },
    { say: "baylee", text: "\"Nathan.\"" },
    { say: "nathan", text: "\"A quarter! A QUARTER of the boat.\"", mood: "grin" },
    { say: "baylee", text: "\"He will tell all of it.\"" },
    { say: "nathan", text: "\"I will tell all of it.\"", mood: "laughing" },
    { flag: "told_wildcard" },
    { flag: "ship_knows_wildcard" },
    { jump: "choiceend_5" },
    { label: "opt_8" },
    { say: "rowan", text: "\"That's me. Does the betting pool pay out to the winner of the mystery? I'd like a cut.\"" },
    {
      say: "nathan",
      text: "\"A CUT! Baylee, he wants a CUT! Tomi is holding the pool, Tomi is going to cry!\"",
      mood: "laughing"
    },
    { say: "baylee", text: "\"Tomi will not cry. Tomi will invoice.\"" },
    {
      say: "nathan",
      text: "\"Rowan, you're my favourite! I've known you for ninety seconds and you're my favourite!\"",
      mood: "grin"
    },
    { flag: "told_wildcard" },
    { flag: "ship_knows_wildcard" },
    { jump: "choiceend_5" },
    { label: "choiceend_5" },
    { jump: "choiceend_1" },
    { label: "opt_3" },
    {
      say: "rowan",
      text: "\"Rowan. Just Rowan for now. I'm in the Commons too, apparently. Have you had a look round the ship yet? Anything worth finding?\""
    },
    { flag: "follow_nathan" },
    { flag: "follow_baylee" },
    { say: "nathan", text: "\"ROWAN! Just Rowan! Like a wizard!\"", mood: "laughing" },
    { say: "baylee", text: "\"Like a bartender.\"" },
    {
      say: "nathan",
      text: "\"Like a WIZARD bartender. Okay. I like you. You asked ME a question. Nobody asked me a question since the harbour, they all just ran away!\"",
      mood: "grin"
    },
    {
      add: { aff_nathan: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "nathan", n: 1, why: "Asked him something" }); }
    },
    { flag: "nathan_gave_tour" },
    { jump: "choiceend_1" },
    { label: "opt_4" },
    { flag: "follow_nathan" },
    { flag: "follow_baylee" },
    {
      say: "rowan",
      text: "\"Rowan. Tired, and new. I'm going to listen for a bit, if that's all right. I think I came here with too many questions.\""
    },
    {
      say: "nathan",
      text: "\"Rowan! A listener! Okay, okay, I can talk for TWO people. That's my second-best skill!\"",
      mood: "happy"
    },
    { say: "baylee", text: "\"What's the first?\"" },
    { say: "nathan", text: "\"Talking for three!\"", mood: "grin" },
    { jump: "choiceend_1" },
    { label: "choiceend_1" },
    {
      say: "nathan",
      text: "\"Okay, listen. Down those steps there's a lounge with an actual card table, green felt and everything. A guy in white gloves has sat at it since before dawn. Gideon something. Won three in a row.\"",
      mood: "laughing"
    },
    {
      say: "nathan",
      text: "\"And there's this tiny girl with green hair, Inya, she's been waiting twenty minutes to play him and he won't. He just sits there. And a kid called Tomi is taking bets on it. Bets! On a boat!\"",
      mood: "grin"
    },
    {
      say: "nathan",
      text: "\"Also, at the back there's a girl with three treasure chests. Real ones. I counted. And the captain lets you look at the steering wheel if you ask nice.\"",
      mood: "happy"
    },
    {
      text: "Under the wheelhouse a door stands open on a flight of steps. You can hear it from here: cards slapping on felt, a girl's voice, quick and sharp, and a second voice that stays low and does not hurry. A few people on the benches have turned their heads that way."
    },
    {
      text: "A side deck runs aft past the funnel to the stern, where gulls hang over the wake. An iron stair climbs to the wheelhouse door. The island lies ahead, still small. The clock over the lounge door says half past six."
    },
    {
      prompt: "What do you do?",
      choice: [
        { text: "\"Show me this card table. I want to see how he plays.\"", goto: "opt_10" },
        { text: "\"I'd like to have a look at the whole ship first. Come with me, if you want.\"", goto: "opt_11" },
        { text: "Stay at the rail and watch the island come closer.", goto: "opt_12" }
      ]
    },
    { jump: "choiceend_9" },
    { label: "opt_10" },
    { say: "rowan", text: "\"Show me this card table. I want to see how he plays.\"" },
    { say: "nathan", text: "\"THAT'S what I'm talking about. Baylee, he's a table guy!\"", mood: "happy" },
    { say: "baylee", text: "\"Seems so.\"" },
    { time: 3 },
    { jump: "toward_lounge" },
    { jump: "choiceend_9" },
    { label: "opt_11" },
    { say: "rowan", text: "\"I'd like to have a look at the whole ship first. Come with me, if you want.\"" },
    { say: "nathan", text: "\"Tour! Yes! I'm basically a tour guide! Baylee, we're a tour!\"", mood: "grin" },
    { say: "baylee", text: "\"We're a tour.\"" },
    { time: 5 },
    { jump: "stay" },
    { jump: "choiceend_9" },
    { label: "opt_12" },
    {
      text: "Nathan's mouth opens, thinks better of it, and closes. It is perhaps the longest he has been silent since the harbour."
    },
    { say: "baylee", text: "\"Let him look, Nathan.\"" },
    { say: "nathan", text: "\"I'll be around! I'm always around! I'm on the whole ship!\"" },
    {
      text: "The two of them peel away along the rail. The island does not look any nearer, but it does look more real."
    },
    { time: 10 },
    { jump: "stay" },
    { jump: "choiceend_9" },
    { label: "choiceend_9" },
    { label: "toward_lounge" },
    { goto: "ferry_lounge", travel: 2 },
    { scene: "lounge_first" },
    { end: true },
    { label: "stay" },
    { think: "Calm down. Nobody here has seen you play. Nobody even knows who Best_Tarleinn is." },
    {
      text: "The deck is yours for the moment. The ship has several places in it, and a lot of people who have not yet decided what they think of you."
    },
    { end: true }
  ]
});

scene("ship_figures_it_out", {
  steps: [
    {
      text: "A cheer goes up near the lounge steps, a sharp ripple of laughter, and then a girl's voice, high and delighted, calling across the whole deck: \"It's the one without the jacket! It's the jacket!\""
    },
    {
      text: "Heads turn. Thirty-odd people check the collar of every other person, then the single rain jacket, and arrive, one by one, at the same conclusion."
    },
    {
      text: "The passenger list has been read, the arithmetic has been done, and the ship has worked out which of its passengers was added in ink."
    },
    { think: "Well. That didn't take long." },
    { flag: "ship_knows_wildcard" },
    { time: 0 }
  ]
});

scene("deck_rail", {
  steps: [
    { text: "The bow rail is cold and wet and exactly the right height for elbows." },
    { when: (s)=>!((s.minutes<540)), jump: "next_2" },
    { text: "The island is still a smudge with ambitions. You can only tell it from the clouds by its edges." },
    { jump: "end_1" },
    { label: "next_2" },
    { when: (s)=>!((s.minutes<600)), jump: "next_3" },
    {
      text: "The island has grown a mountain. A real one: a grey cone with a thread of smoke and jungle running down its flanks to pale sand. A white speck at its foot has become a lighthouse."
    },
    { jump: "end_1" },
    { label: "next_3" },
    {
      text: "You can make out the shape of the bay now, the pier, a line of low roofs. A white building on the hill catches the sun like a dropped coin."
    },
    { label: "end_1" },
    { think: "In two weeks I will be on a real table in front of real people. I will be fine. I will be fine." },
    { when: (s)=>!(!!!s.flags["follow_nathan"]), jump: "next_6" },
    { text: "Somewhere behind you Nathan is telling somebody about the plate." },
    { jump: "end_5" },
    { label: "next_6" },
    {
      say: "nathan",
      text: "\"Look at it! It's got a MOUNTAIN! Baylee, we're going to live on a MOUNTAIN!\"",
      mood: "happy"
    },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_9" },
    { say: "baylee", text: "\"It has smoke on it.\"" },
    { label: "next_9" },
    { label: "end_8" },
    { label: "end_5" },
    { when: (s)=>!(!!!s.flags["found_rail_coins"]), jump: "next_11" },
    {
      text: "Down by the foot of the rail, between two planks beside the lifebuoy, something small and gold winks at you. Two Smug Coins, wedged tight, that somebody lost their nerve over. You prise them out with a thumbnail."
    },
    { coins: 2 },
    { flag: "found_rail_coins" },
    { label: "next_11" },
    { label: "end_10" },
    { time: 10 }
  ]
});

scene("deck_collars", {
  steps: [
    { text: "You lean against a bollard and count collars." },
    {
      text: "Jackets first, because they are easy: red for Competitive Play, and red is most of the deck, perhaps twenty-five of them. A handful of gold for Game Design, who carry sketchbooks. A few black for Auxiliary, who carry clipboards and look as if they are already running something."
    },
    {
      text: "Then collars, which are the interesting part. The white-and-gold ones, Spectral, stand a little apart from the others without seeming to try. The blue ones, Rare, are scattered through the crowd. The grey ones, the Commons, hold their bags in both arms."
    },
    {
      text: "You count seven white, twelve blue, eighteen grey. That makes thirty-seven, and the one without a collar at all is the thirty-eighth."
    },
    { text: "Rank, printed on every shoulder. You wonder how long it takes for people to stop reading it." },
    { flag: "counted_collars" },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_2" },
    { say: "nathan", text: "\"Grey is the BEST colour, I decided. It goes with EVERYTHING.\"", mood: "happy" },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_4" },
    { say: "baylee", text: "\"The white-and-gold ones have a tower.\"" },
    { say: "nathan", text: "\"I HEARD about the tower! I heard it has a fountain!\"", mood: "grin" },
    { label: "next_4" },
    { label: "end_3" },
    { label: "next_2" },
    { label: "end_1" },
    { time: 5 }
  ]
});

scene("deck_lighthouse", {
  steps: [
    {
      text: "You borrow the captain's trick of squinting at the horizon, and there it is: a white pencil stroke on the cliff south of the bay. The lighthouse."
    },
    {
      text: "Beyond it, as the ferry swings its nose, you catch a second tower on the cliff and a thin white line of beach with a row of tiny roofs along it. The Commons, if the rumours are true. They look like a row of sugar cubes."
    },
    { flag: "saw_commons_roofs" },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_2" },
    { say: "baylee", text: "\"That is a long way up.\"" },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_4" },
    { say: "nathan", text: "\"Can we climb it? Are there stairs? Rowan, I am going to climb it.\"", mood: "happy" },
    { label: "next_4" },
    { label: "end_3" },
    { label: "next_2" },
    { label: "end_1" },
    { time: 5 }
  ]
});

scene("deck_seasick", {
  steps: [
    { text: "You have not been seasick for the whole crossing. This seems a waste of an opportunity." },
    {
      text: "You try it anyway, leaning over the leeward rail with a look of great suffering. A gull lands on the rail and stares at you with open scorn."
    },
    { think: "Not even the birds are fooled." },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_2" },
    { say: "nathan", text: "\"Are you actually seasick? Baylee, he's seasick, get a bucket!\"", mood: "happy" },
    { when: (s)=>!(!!s.flags["follow_baylee"]), jump: "next_4" },
    { say: "baylee", text: "\"He is not.\"" },
    { say: "nathan", text: "\"He's doing a very GOOD seasick!\"", mood: "laughing" },
    { label: "next_4" },
    { label: "end_3" },
    { label: "next_2" },
    { label: "end_1" },
    { time: 5 }
  ]
});
