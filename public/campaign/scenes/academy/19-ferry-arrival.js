// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
scene("ferry_arrival", {
  background: "ferry_deck",
  steps: [
    { clear: true },
    {
      set: { arrival_visits: 0 }
    },
    { goto: "ferry_deck", travel: 0 },
    { fx: "fadeout", ms: 400 },
    { wait: 300 },
    { fx: "fadein", ms: 400 },
    { sfx: "heavy_impact" },
    {
      text: "A horn sounds, long and flat and enormous, so deep that the deck plates sing with it. The fixtures rattle in their brackets, and a gull that has been sitting on the rail since dawn gives up the whole business and leaves."
    },
    { text: "For a second nobody on the ship says anything at all." },
    { text: "Then the whole vessel seems to turn to face one way." },
    {
      text: "People abandon whatever they were doing. Bags are shouldered. Somebody calls \"Island!\" and somebody else, from the stern, calls \"We KNOW.\""
    },
    { text: "The captain's voice comes on the loudspeaker, unhurried and warm." },
    {
      name: "Loudspeaker",
      text: "Fifteen minutes, folks. Mind your luggage and your elbows. The ladies and gentlemen who are going to want a last look, the rail is wide enough for all of you. The gentleman with the lifebuoy knows who he is."
    },
    {
      text: "You are standing at the rail with your hands on the wet iron, and you are, for the first time since the harbour, entirely alone."
    },
    { text: "The island has stopped being a picture. It has trees on it now." },
    {
      text: "A grey cone of volcano, a thread of smoke leaning off its top. Jungle pouring down the flanks to a ribbon of pale sand, and, on the sand, tiny and perfect, a long wooden pier with a blue arch at its end. A little red cable car crawls along a wire over the canopy like a bead on a string. The sea around it is so clear that you can see, where the ship's shadow falls, a line where the green turns to blue."
    },
    { think: "That's it. That's where I live now." },
    { think: "Fifteen minutes. And then I won't be a person on a boat any more. I'll be a person on an island." },
    { text: "Behind you, the iron door of the saloon bangs open, and the whole ship starts to arrive." },
    { scene: "arrival_hub" },
    { run: (s)=>{ if (s.minutes < 640) s.minutes = 640; } },
    { scene: "arrival_finale" },
    { scene: "ferry_docks" }
  ]
});

scene("arrival_hub", {
  steps: [
    { label: "top" },
    { when: (s)=>!((s.vars["arrival_visits"]===3)), jump: "next_2" },
    { end: true },
    { label: "next_2" },
    { label: "end_1" },
    { clear: true },
    { when: (s)=>!((s.vars["arrival_visits"]===0)), jump: "next_4" },
    {
      text: "Four knots of people have formed along the rails: the bow, the saloon stairs, the stern, and the knot of small commotion in the middle of the deck. The ship is turning in towards the pier, slowly, like a very large animal making up its mind."
    },
    { jump: "end_3" },
    { label: "next_4" },
    { when: (s)=>!((s.vars["arrival_visits"]===1)), jump: "next_5" },
    {
      text: "The island has moved. It is no longer a place in the distance but a coast, with a surf line and a smell: wet earth and salt and something green, frying."
    },
    { jump: "end_3" },
    { label: "next_5" },
    { text: "The pier is a clear line now, with a speck on it that is waving. You have about five minutes." },
    { label: "end_3" },
    {
      prompt: "Where do you go?",
      choice: [
        {
          text: "Join the crowd at the bow rail.",
          goto: "opt_8",
          when: (s)=>!!!s.flags["arr_bow"],
          who: [
            "nathan",
            "baylee",
            "ed",
            "mikoto"
          ]
        },
        {
          text: "Go to the foot of the saloon stairs, where the table crowd is standing.",
          goto: "opt_9",
          when: (s)=>(!!s.flags["lounge_seen"]&&!!!s.flags["arr_stairs"]),
          who: [
            "gideon",
            "inya",
            "tomi",
            "noor",
            "livvie"
          ]
        },
        {
          text: "Go aft, to the stern rail.",
          goto: "opt_10",
          when: (s)=>!!!s.flags["arr_stern"],
          who: [
            "jessica",
            "ashton",
            "sunny",
            "freddie",
            "marit",
            "victoria"
          ]
        },
        {
          text: "Go to the middle of the deck, where somebody is organising a photograph.",
          goto: "opt_11",
          when: (s)=>!!!s.flags["arr_mid"],
          who: [
            "georgie",
            "pippa",
            "branden",
            "rana",
            "teobalt"
          ]
        },
        { text: "Stay where you are and watch the island come.", goto: "opt_12" }
      ]
    },
    { jump: "choiceend_7" },
    { label: "opt_8" },
    { scene: "arrival_bow" },
    { flag: "arr_bow" },
    {
      add: { arrival_visits: 1 }
    },
    { time: 4 },
    { jump: "top" },
    { jump: "choiceend_7" },
    { label: "opt_9" },
    { scene: "arrival_stairs" },
    { flag: "arr_stairs" },
    {
      add: { arrival_visits: 1 }
    },
    { time: 4 },
    { jump: "top" },
    { jump: "choiceend_7" },
    { label: "opt_10" },
    { scene: "arrival_stern" },
    { flag: "arr_stern" },
    {
      add: { arrival_visits: 1 }
    },
    { time: 4 },
    { jump: "top" },
    { jump: "choiceend_7" },
    { label: "opt_11" },
    { scene: "arrival_mid" },
    { flag: "arr_mid" },
    {
      add: { arrival_visits: 1 }
    },
    { time: 4 },
    { jump: "top" },
    { jump: "choiceend_7" },
    { label: "opt_12" },
    { think: "I've heard enough from everyone. I'd like to see it arrive." },
    { end: true },
    { jump: "choiceend_7" },
    { label: "choiceend_7" }
  ]
});

scene("arrival_bow", {
  steps: [
    { clear: true },
    { enter: "nathan" },
    { enter: "baylee" },
    { enter: "ed" },
    { enter: "mikoto" },
    { text: "The bow is the loudest place on the ship, which means that it is also where Nathan is." },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_2" },
    {
      say: "nathan",
      text: "ROWAN! Over here! Look! Look at it! I counted! There are TWELVE gulls! I counted every single one of them and Baylee did not argue once!",
      mood: "laughing"
    },
    { say: "baylee", text: "There were thirteen." },
    { say: "nathan", text: "Thirteen! He's right! He's always right! It's very annoying!", mood: "grin" },
    { jump: "end_1" },
    { label: "next_2" },
    {
      say: "nathan",
      text: "ROWAN! You came! I SAVED you a bit of rail! It's this bit! It's got a rivet! It's the best bit!",
      mood: "laughing"
    },
    { say: "baylee", text: "He's been guarding it for ten minutes." },
    { say: "nathan", text: "I've been GUARDING it! I was ready to FIGHT for it!", mood: "grin" },
    { label: "end_1" },
    { when: (s)=>!(((s.vars["aff_nathan"]||0)>=17)), jump: "next_5" },
    {
      text: "Nathan turns round with his back to the rail. For a moment the grin goes out of his face, and what is underneath it looks younger and more worried."
    },
    {
      say: "nathan",
      text: "Rowan. Can I say a thing? Before everybody comes. It's — I'm glad you took my hand. This morning. When I stuck it out. Everybody else has been running away from me since the harbour, and I was getting really loud about it, so nobody would notice."
    },
    { say: "rowan", text: "Nathan, you were extremely loud." },
    { say: "nathan", text: "It WORKED! You noticed!", mood: "happy" },
    { jump: "end_4" },
    { label: "next_5" },
    { when: (s)=>!(((s.vars["aff_nathan"]||0)>=11)), jump: "next_6" },
    {
      say: "nathan",
      text: "Big day, Wildcard! Big day! Do you know what they do on the first night? I read about it. There's a feast and a speech, and somebody gets thrown in the sea. I'm hoping it's not me. I'm hoping it's Baylee.",
      mood: "happy"
    },
    { say: "baylee", text: "I'd float." },
    { say: "nathan", text: "He WOULD.", mood: "laughing" },
    { jump: "end_4" },
    { label: "next_6" },
    {
      say: "nathan",
      text: "\"Hey.\" A pause, quite uncharacteristic. \"I hope we're okay. I think I talk a lot. People tell me. I'm trying to say that I know that, and I'll — I'll dial it back. For you. By, like, fifteen percent.\""
    },
    { say: "rowan", text: "Fifteen percent would be a start." },
    { say: "nathan", text: "FIFTEEN! Watch me!", mood: "happy" },
    { label: "end_4" },
    {
      text: "Baylee has been standing very still at the rail, with his hat pushed back and his huge forearms folded on the iron. He looks like something the ship was built round."
    },
    { when: (s)=>!(((s.vars["aff_baylee"]||0)>=14)), jump: "next_9" },
    { say: "baylee", text: "Rowan." },
    { text: "He steps aside, exactly one pace, which in Baylee's case opens up a space the width of a doorway." },
    { say: "baylee", text: "Better view from here. Sun's behind the funnel. You can see the whole row of roofs." },
    {
      text: "You look. A line of tiny weathered bungalows is strung along the curve of the cove, like a necklace of matchboxes."
    },
    { say: "baylee", text: "That's us. That's the last one. Seven." },
    { say: "rowan", text: "How can you tell?" },
    { say: "baylee", text: "It's the one that looks like it's trying not to be noticed." },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["baylee"] = s.notes["baylee"] || []); if (a.indexOf("Notices things and says very little. Likes quiet company.") < 0) a.push("Notices things and says very little. Likes quiet company."); }
    },
    { jump: "end_8" },
    { label: "next_9" },
    { say: "baylee", text: "\"Morning, Rowan. Almost afternoon.\" A pause. \"Almost there.\"" },
    { label: "end_8" },
    { when: (s)=>!(!!s.flags["met_ed"]), jump: "next_12" },
    { say: "ed", text: "\"THERE'S A WATERFALL!\"" },
    {
      text: "Ed is standing on the lowest bar of the rail with one hand wrapped round a stanchion and the other pointing at the cliff. The hat is holding on by a miracle."
    },
    {
      say: "ed",
      text: "\"On the north side! Between the green bit and the other green bit! See it? Does anyone see it? I think it goes all the way down!\""
    },
    { when: (s)=>!(((s.vars["aff_ed"]||0)>=12)), jump: "next_14" },
    {
      say: "ed",
      text: "Rowan! You've got to come with me when we land! There's a path! There's probably a path! There is DEFINITELY a place where a path should be!"
    },
    { say: "rowan", text: "Ed, if you fall off, I'm not rescuing you off the ship." },
    { say: "ed", text: "Is that dangerous? That's a bit dangerous! Good!" },
    {
      add: { aff_ed: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "ed", n: 1, why: "Cheered him on, from the rail's safe side" }); }
    },
    { jump: "end_13" },
    { label: "next_14" },
    {
      say: "ed",
      text: "\"Is it dangerous, that waterfall? Or only a bit dangerous?\" He considers. \"I'm hoping very dangerous.\""
    },
    { label: "end_13" },
    { jump: "end_11" },
    { label: "next_12" },
    {
      text: "A boy in a battered cowboy hat is standing on the lowest bar of the rail with one hand wrapped round a stanchion and the other pointing at the cliff. The hat is holding on by a miracle."
    },
    {
      say: "ed",
      alias: "Boy in a battered hat",
      text: "THERE'S A WATERFALL! On the north side! Between the green bit and the other green bit! Does anyone see it? I think it goes all the way down! Is it dangerous? I hope it's dangerous!"
    },
    {
      say: "nathan",
      text: "That's ED! Ed's from a RANCH! I've talked to him for four minutes and I know his horse's name!",
      mood: "grin"
    },
    { say: "ed", alias: "Boy in a battered hat", text: "Ed Venture! Lazy V Ranch! The horse is Pickles! Hello!" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["ed"]) s.names["ed"] = "Ed Venture"; if (io && io.popup && !s.flags["met_ed"]) io.popup({ type: 'met', id: "ed", name: "Ed Venture" }); }
    },
    { flag: "met_ed" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["ed"] = s.notes["ed"] || []); if (a.indexOf("Hangs off things. Asks whether everything is dangerous, hopefully.") < 0) a.push("Hangs off things. Asks whether everything is dangerous, hopefully."); }
    },
    { label: "end_11" },
    { when: (s)=>!(!!s.flags["met_mikoto"]), jump: "next_18" },
    {
      say: "mikoto",
      text: "\"Oh — oh, Rowan, hello. Sorry. Look, there's — I think I have to sit down. Everything is — everything is so much larger than the pictures.\""
    },
    { text: "He laughs, high and brief, and presses a hand over his mouth." },
    { say: "mikoto", text: "\"Sorry. I'm looking. I'm looking at it.\"" },
    { say: "rowan", text: "You can hold the rail if you need to." },
    { say: "mikoto", text: "\"Thank you.\"" },
    { text: "A quick, startled glance behind the lenses." },
    { say: "mikoto", text: "\"That's — very nice. That's nicer than 'calm down'.\"" },
    { jump: "end_17" },
    { label: "next_18" },
    {
      text: "A thin boy in round glasses is next to the gull-feeding rail, holding on with both hands and breathing very carefully."
    },
    {
      say: "mikoto",
      alias: "Apologetic boy",
      text: "Sorry. Sorry! I'm — it's just a very big volcano. I'm making a list. I'm — oh, you're looking at me. Mikoto. Yamaguchi. I'm Mikoto, I'm having a very good time, it just doesn't look like it."
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["mikoto"]) s.names["mikoto"] = "Mikoto Yamaguchi"; if (io && io.popup && !s.flags["met_mikoto"]) io.popup({ type: 'met', id: "mikoto", name: "Mikoto Yamaguchi" }); }
    },
    { flag: "met_mikoto" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["mikoto"] = s.notes["mikoto"] || []); if (a.indexOf("Laughs when frightened. Keeps lists.") < 0) a.push("Laughs when frightened. Keeps lists."); }
    },
    {
      say: "rowan",
      text: "Rowan. It's a big volcano. I'm having a good time too. It just doesn't look like it either."
    },
    { say: "mikoto", text: "\"Oh.\"" },
    { text: "His face does something complicated and grateful." },
    { say: "mikoto", text: "\"Oh, that's — thank you. Row-Row. Would it — sorry. May I? Row-Row?\"" },
    {
      add: { aff_mikoto: 2 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "mikoto", n: 2, why: "Said he was nervous too" }); }
    },
    { label: "end_17" },
    {
      text: "A bell rings somewhere, thin and bright. The deck lurches an inch to starboard as the ship comes round."
    },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_21" },
    { say: "nathan", text: "WE'RE TURNING! The island's TURNING! Baylee, the island is TURNING!", mood: "laughing" },
    { say: "baylee", text: "It's us." },
    { say: "nathan", text: "It's US! WE'RE TURNING!", mood: "grin" },
    { jump: "end_20" },
    { label: "next_21" },
    { say: "nathan", text: "WE'RE TURNING! The island's TURNING!", mood: "laughing" },
    { say: "baylee", text: "It's us, Nathan." },
    { label: "end_20" },
    { time: 3 }
  ]
});

scene("arrival_stairs", {
  steps: [
    { clear: true },
    { enter: "gideon" },
    { enter: "inya" },
    { enter: "tomi" },
    { enter: "noor" },
    { enter: "livvie" },
    {
      text: "The saloon stairs have turned into a gallery. The people from the table have come up with their drinks and their opinions, and have arranged themselves on the iron steps like an audience at the end of a play that nobody has quite agreed to applaud."
    },
    { when: (s)=>!(!!s.flags["ferry_table_won"]), jump: "next_2" },
    {
      text: "Gideon is standing on the bottom step with a single duffel at his feet. It is the first time you have seen him without all four of his cases within arm's reach. He is looking at the island with the controlled attention of a man re-reading a contract."
    },
    { say: "gideon", text: "Vance." },
    { say: "rowan", text: "Gideon." },
    {
      say: "gideon",
      text: "\"I should like to say something before this ship docks, because I shall not say it ashore.\""
    },
    { text: "A pause so level you could set a tray on it." },
    { say: "gideon", text: "\"That was well played. And I was wrong about the collar.\"" },
    { say: "gideon", text: "I do not say that, as a rule. You will want to note the date." },
    {
      add: { aff_gideon: 3 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "gideon", n: 3, why: "Heard him say it" }); } },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["gideon"] = s.notes["gideon"] || []); if (a.indexOf("Corrects himself when he has to, and hates it.") < 0) a.push("Corrects himself when he has to, and hates it."); }
    },
    { jump: "end_1" },
    { label: "next_2" },
    { when: (s)=>!(!!s.flags["ferry_table_lost"]), jump: "next_3" },
    {
      text: "Gideon is leaning against the rail, immaculate. Four dark leather cases stand at his heels like well-trained dogs."
    },
    { say: "gideon", text: "Vance. I trust you are rested. The hill is — considerable." },
    { say: "rowan", text: "I'll manage." },
    {
      say: "gideon",
      text: "\"I have no doubt.\" A quarter-inch of a smile. \"You carry a stake like a man who has carried a few. I find that I do not dislike it.\""
    },
    {
      add: { aff_gideon: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "gideon", n: 1, why: "Took the stake with grace" }); }
    },
    { jump: "end_1" },
    { label: "next_3" },
    { when: (s)=>!(!!s.flags["ferry_inya_won"]), jump: "next_4" },
    {
      text: "Gideon has two bruise-coloured shadows under his eyes that were not there at breakfast. He stands apart from the others, gloved hands folded. Beside his feet there is a small rucksack, which is not his. It belongs to someone shorter."
    },
    { say: "gideon", text: "I am told you have an opinion of the outcome, Vance." },
    { say: "rowan", text: "I think it was a very good game." },
    { say: "gideon", text: "\"It was a very good game.\"" },
    { text: "He says it like pulling a thread." },
    { say: "gideon", text: "\"She was patient. I had not accounted for patience.\"" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["gideon"] = s.notes["gideon"] || []); if (a.indexOf("Lost the table to Inya. Took it hard, and took it quietly.") < 0) a.push("Lost the table to Inya. Took it hard, and took it quietly."); }
    },
    { jump: "end_1" },
    { label: "next_4" },
    { when: (s)=>!(!!s.flags["ferry_table_settled"]), jump: "next_5" },
    {
      text: "Gideon is turning a pair of white gloves slowly over in his hands. He has the look of a man who has had an idea that he did not choose and is, against every instinct, quite pleased with."
    },
    {
      say: "gideon",
      text: "\"The second table, Vance. I am told it will be called the Commons Table, and that Miss Al-Sayed has taken the precaution of writing it into the Charter.\" A beat. \"I did not know it was possible to be outflanked by an article.\""
    },
    {
      add: { aff_gideon: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "gideon", n: 1, why: "Respected the second table" }); }
    },
    { jump: "end_1" },
    { label: "next_5" },
    {
      text: "Gideon has resumed his post at the end of the table, even though the table is now a long way below. The habit seems to be stronger than the room."
    },
    { say: "gideon", text: "\"Vance.\"" },
    { text: "A very small, very formal nod." },
    { say: "gideon", text: "\"The table remains closed. I find that I am less pleased about it than I expected.\"" },
    { label: "end_1" },
    { when: (s)=>!(!!s.flags["ferry_inya_won"]), jump: "next_8" },
    {
      say: "inya",
      text: "\"Hey.\" Fast, sharp, trembling. \"Hey, Wildcard. I won. I WON. You were there. You told me how.\""
    },
    { say: "rowan", text: "You waited." },
    { say: "inya", text: "\"I waited.\"" },
    { text: "She says it with a kind of wonder." },
    { say: "inya", text: "\"He never got to play me, not properly. I did it by not doing anything.\"" },
    {
      add: { aff_inya: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 2, why: "Shared her win" }); } },
    { jump: "end_7" },
    { label: "next_8" },
    { when: (s)=>!(!!s.flags["ferry_inya_lost"]), jump: "next_9" },
    {
      text: "Inya is at the very end of the step with her deck box pressed to her chest and her chin up. She is, you notice, not looking at anyone."
    },
    { say: "inya", text: "Don't say anything nice." },
    { say: "rowan", text: "I wasn't going to." },
    { say: "inya", text: "\"…Good.\" A beat. \"…What were you going to say?\"" },
    { say: "rowan", text: "That I'd like a game, on the island. On a bench. Loser buys the rolls." },
    { say: "inya", text: "\"…\"" },
    { text: "The amber eyes narrow, and something very small and very fierce flickers behind them." },
    { say: "inya", text: "\"Six Smug Coins.\"" },
    {
      add: { aff_inya: 3 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 3, why: "Offered a rematch" }); } },
    { flag: "inya_rematch_offered" },
    { jump: "end_7" },
    { label: "next_9" },
    { when: (s)=>!(!!s.flags["met_inya"]), jump: "next_10" },
    { say: "inya", text: "\"Hey.\"" },
    { text: "Flat, careful, as if she were testing a stair." },
    {
      say: "inya",
      text: "\"Are we — are you going to the Commons? Bungalow three. I asked. It was in the letter.\""
    },
    { say: "rowan", text: "Seven." },
    { say: "inya", text: "\"Seven.\"" },
    { text: "She considers it, with the air of a girl memorising a map." },
    { say: "inya", text: "\"That's — fine. That's four doors down. I'll know where to find you.\"" },
    {
      add: { aff_inya: 1 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 1, why: "Compared bungalows" }); } },
    { jump: "end_7" },
    { label: "next_10" },
    {
      text: "A small girl with mint-green tails held by a bunny clip is standing on the lowest step with a deck box pressed to her chest, and her eyes are fixed on Gideon as if he were an exam."
    },
    { say: "inya", alias: "Girl with the bunny clip", text: "…You. The one without the jacket." },
    { say: "rowan", text: "Rowan." },
    {
      say: "inya",
      alias: "Girl with the bunny clip",
      text: "\"Inya. Bell. Inya Bell.\" A beat. \"I'm in the Commons. Don't say anything about the bunny.\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["inya"]) s.names["inya"] = "Inya Bell"; if (io && io.popup && !s.flags["met_inya"]) io.popup({ type: 'met', id: "inya", name: "Inya Bell" }); }
    },
    { flag: "met_inya" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["inya"] = s.notes["inya"] || []); if (a.indexOf("Fiercely competitive. Keeps rabbits. Do not say 'bunny'.") < 0) a.push("Fiercely competitive. Keeps rabbits. Do not say 'bunny'."); }
    },
    { label: "end_7" },
    { when: (s)=>!(!!s.flags["met_tomi"]), jump: "next_13" },
    { say: "tomi", text: "\"Wildcard! Business is booming!\"" },
    {
      text: "He is at the middle of the stair, a binder open on his knee, accepting and refusing money at the same time, like a very small stock exchange."
    },
    {
      say: "tomi",
      text: "\"Everybody's got a take on whether you carried it right. I've got four to one that Gideon never speaks to you again, and three to one that he does. It's the second one that scares me.\""
    },
    { say: "rowan", text: "Who's winning?" },
    {
      say: "tomi",
      text: "\"The man who's not betting.\" He grins. \"Friend price, Rowan. Everything's friend price. It's very stressful.\""
    },
    {
      add: { aff_tomi: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "tomi", n: 1, why: "Joked with the bookie" }); }
    },
    { jump: "end_12" },
    { label: "next_13" },
    {
      text: "A boy in a yellow bandana, with a canvas bag of binders, is conducting business on the middle step with an air of tired joy."
    },
    {
      say: "tomi",
      alias: "Boy in a yellow bandana",
      text: "Wildcard! No — hold on — you're THE Wildcard. Don't move. Tomás Reyes. Tomi. I run the book."
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["tomi"]) s.names["tomi"] = "Tomás Reyes"; if (io && io.popup && !s.flags["met_tomi"]) io.popup({ type: 'met', id: "tomi", name: "Tomás Reyes" }); }
    },
    { flag: "met_tomi" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["tomi"] = s.notes["tomi"] || []); if (a.indexOf("Runs the book on the ship. Everything has a friend price.") < 0) a.push("Runs the book on the ship. Everything has a friend price."); }
    },
    { label: "end_12" },
    { when: (s)=>!(!!s.flags["met_noor"]), jump: "next_16" },
    { say: "noor", text: "\"Rowan.\"" },
    { text: "She does not look up from the Charter, which she is reading as the ship slides in." },
    {
      say: "noor",
      text: "\"I am on article seven again. I find it comforting that the ship has its own rules about arrival. Rule four: no one may disembark before the gangway. I thought you would like to know.\""
    },
    { say: "rowan", text: "Thank you, Noor." },
    {
      say: "noor",
      text: "\"It is not a favour. It is information.\" A faint, dry smile. \"It is possible that I am a little nervous.\""
    },
    {
      add: { aff_noor: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "noor", n: 1, why: "Accepted the rule with thanks" }); }
    },
    { jump: "end_15" },
    { label: "next_16" },
    {
      text: "A girl in a blue hijab is sitting on the second stair with a bound book open on her knee, and has marked her place with a pencil, as if the ship might not wait for her."
    },
    { say: "noor", alias: "Girl with a rulebook", text: "\"You are standing in the light. Forgive me.\"" },
    { text: "She does not seem to mind either way." },
    {
      say: "noor",
      alias: "Girl with a rulebook",
      text: "\"Noor Al-Sayed. You are the entrant in ink. I read the list twice. I find that it was nicely typed.\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["noor"]) s.names["noor"] = "Noor Al-Sayed"; if (io && io.popup && !s.flags["met_noor"]) io.popup({ type: 'met', id: "noor", name: "Noor Al-Sayed" }); }
    },
    { flag: "met_noor" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["noor"] = s.notes["noor"] || []); if (a.indexOf("Knows the Charter by heart. Wants to be a head judge.") < 0) a.push("Knows the Charter by heart. Wants to be a head judge."); }
    },
    { label: "end_15" },
    { when: (s)=>!((!!s.flags["met_livvie"]&&!!s.flags["livvie_fed"])), jump: "next_19" },
    { say: "livvie", text: "\"Quick thing.\"" },
    {
      text: "She is eating a cinnamon roll in tiny, exact bites, and keeping the other hand cupped under it to catch the crumbs."
    },
    { say: "livvie", text: "I said I'd pay you back in information. Here's the information." },
    {
      say: "livvie",
      text: "The Commons kitchen is the first bungalow. Mama Odalys runs it. Breakfast at six, supper at six. Do not be late. Do not be early. Do not say the word 'diet'."
    },
    { say: "rowan", text: "Is that all?" },
    { say: "livvie", text: "\"That's the whole payment. I've priced it. It's about right.\"" },
    { text: "A tiny, sideways look to see if it landed." },
    { say: "livvie", text: "…It's also about to be six. So go and eat something." },
    { flag: "livvie_tip_odalys" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["livvie"] = s.notes["livvie"] || []); if (a.indexOf("Pays back every favour in information. Counts everything.") < 0) a.push("Pays back every favour in information. Counts everything."); }
    },
    {
      add: { aff_livvie: 2 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "livvie", n: 2, why: "Paid you back in information" }); }
    },
    { jump: "end_18" },
    { label: "next_19" },
    { when: (s)=>!(!!s.flags["met_livvie"]), jump: "next_20" },
    { say: "livvie", text: "\"Quick thing.\"" },
    { text: "She does not look up from the clipboard." },
    {
      say: "livvie",
      text: "\"The Commons kitchen is the first bungalow. Mama Odalys. Breakfast at six, supper at six. Do not be late.\""
    },
    { say: "rowan", text: "That's useful. Thank you." },
    { say: "livvie", text: "\"That one was a free sample.\" A tiny, sideways look. \"Don't get used to it.\"" },
    { flag: "livvie_tip_odalys" },
    {
      add: { aff_livvie: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "livvie", n: 1, why: "Took the free sample" }); }
    },
    { jump: "end_18" },
    { label: "next_20" },
    {
      text: "A very pale, thin girl with a violet-black bob is standing at the bottom of the stairs with a pencil and a clipboard, and a cinnamon roll she is eating one tiny bite at a time, as if to make it last until Thursday."
    },
    { say: "livvie", alias: "Girl with a clipboard", text: "\"Quick thing. You look like you've not eaten.\"" },
    { text: "She says it to the clipboard." },
    { say: "livvie", alias: "Girl with a clipboard", text: "\"I've eaten. I had a big breakfast. Livvie Thana.\"" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["livvie"]) s.names["livvie"] = "Livvie Thana"; if (io && io.popup && !s.flags["met_livvie"]) io.popup({ type: 'met', id: "livvie", name: "Livvie Thana" }); }
    },
    { flag: "met_livvie" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["livvie"] = s.notes["livvie"] || []); if (a.indexOf("Trades, keeps lists, does not accept charity.") < 0) a.push("Trades, keeps lists, does not accept charity."); }
    },
    { label: "end_18" },
    { time: 3 }
  ]
});


scene("arrival_mid", {
  steps: [
    { clear: true },
    { enter: "georgie" },
    { enter: "pippa" },
    { enter: "branden" },
    { enter: "rana" },
    { enter: "teobalt" },
    {
      text: "In the middle of the deck, where the planks are widest and there is least to lean on, a small group has formed around a camera."
    },
    { when: (s)=>!(!!s.flags["met_pippa"]), jump: "next_2" },
    {
      say: "pippa",
      text: "\"ROWAN! Perfect. You're in the right place. Hang on — don't move —\" Click. \"That's the arrival. That's the face. I've shot twelve people now with that face. Everybody's got the same face. It's lovely.\""
    },
    { jump: "end_1" },
    { label: "next_2" },
    {
      text: "A girl with a heavy old film camera round her neck is standing on a crate with her eye pressed to the viewfinder, arranging four people with a series of small, firm hand-signals."
    },
    {
      say: "pippa",
      alias: "Girl with a camera",
      text: "\"You! Stranger! Yes, you! Stand there. No, there. No — in front of the lifeboat. Perfect. Hold it —\" Click. \"Pippa Lund. I'm the photographer. Nobody asked me to be. I've shot twelve people now. Everyone's got the same face when the island arrives. It's lovely.\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["pippa"]) s.names["pippa"] = "Pippa Lund"; if (io && io.popup && !s.flags["met_pippa"]) io.popup({ type: 'met', id: "pippa", name: "Pippa Lund" }); }
    },
    { flag: "met_pippa" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["pippa"] = s.notes["pippa"] || []); if (a.indexOf("Photographs everyone. Film only.") < 0) a.push("Photographs everyone. Film only."); }
    },
    { label: "end_1" },
    { when: (s)=>!(!!s.flags["met_georgie"]), jump: "next_5" },
    {
      text: "Georgie is standing on the lowest rung of the lifeboat ladder, with a deck box in one hand and the green dragon plush in the other, and her eyes are enormous. She has not said anything, but she is smiling, a small, astonished, private smile, the way you smile when you are alone with a thing you love."
    },
    {
      say: "georgie",
      text: "\"Hi, Rowan.\" Barely audible. \"Ember's looking. She's never — she's never seen an island. It's — it's bigger than the pictures. Is that normal?\""
    },
    { say: "rowan", text: "I think that's what an island's meant to be like." },
    { say: "georgie", text: "\"…Oh. Good.\"" },
    { text: "She holds the plush a little higher." },
    { say: "georgie", text: "\"She'll be pleased.\"" },
    {
      add: { aff_georgie: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "georgie", n: 1, why: "Told her it was normal" }); }
    },
    { jump: "end_4" },
    { label: "next_5" },
    {
      text: "A small girl in a jacket too big for her is standing on the lowest rung of the lifeboat ladder with a deck box in one hand and a green dragon plush in the other, and her eyes are enormous. She has not said anything, but she is smiling, a small, astonished, private smile."
    },
    { say: "georgie", alias: "Girl with the dark-blue feather", text: "…Sorry. Is this your ladder?" },
    { say: "rowan", text: "No, it's anybody's. I'm Rowan." },
    {
      say: "georgie",
      alias: "Girl with the dark-blue feather",
      text: "\"Georgie. Santa. Georgie Santa.\" She looks at the plush. \"This is Ember. She's — she hasn't seen the island.\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["georgie"]) s.names["georgie"] = "Georgie Santa"; if (io && io.popup && !s.flags["met_georgie"]) io.popup({ type: 'met', id: "georgie", name: "Georgie Santa" }); }
    },
    { flag: "met_georgie" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["georgie"] = s.notes["georgie"] || []); if (a.indexOf("Very shy. Very good at cards. Carries a dragon plush named Ember.") < 0) a.push("Very shy. Very good at cards. Carries a dragon plush named Ember."); }
    },
    { label: "end_4" },
    { when: (s)=>!(!!s.flags["met_branden"]), jump: "next_8" },
    { say: "branden", text: "\"ROWAN! Jacketless! Look! I've got it!\"" },
    {
      text: "He is holding the lifebuoy over his head like a trophy, and he is, with great delicacy, not looking at the bridge wing."
    },
    { say: "branden", text: "\"Nobody saw. Nobody saw anything. I have a lifebuoy and a clean conscience.\"" },
    {
      name: "Captain Stroud",
      text: "BRANDEN SUNFLOWER. I CAN SEE YOU. I HAVE SEEN YOU SINCE THE FUNNEL. I AM A CAPTAIN. MY WHOLE JOB IS SEEING."
    },
    { say: "branden", text: "…Technically it's an *exercise*." },
    { when: (s)=>!(!!s.flags["branden_prank_buddy"]), jump: "next_10" },
    { say: "branden", text: "Rowan! Tell him it's an exercise! You timed it! You're my WITNESS!" },
    { say: "rowan", text: "I timed it, Captain. It was eleven seconds." },
    { name: "Captain Stroud", text: "Eleven seconds is a *record*, young man. Put it back." },
    {
      add: { aff_branden: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "branden", n: 2, why: "Stood up for him" }); } },
    { jump: "end_9" },
    { label: "next_10" },
    { say: "branden", text: "…It's fine. It's FINE. Put it back. I know." },
    { label: "end_9" },
    { jump: "end_7" },
    { label: "next_8" },
    {
      text: "A small boy with flame-orange spikes of hair is holding a lifebuoy over his head, and is, with great delicacy, not looking up at the bridge wing."
    },
    {
      say: "branden",
      alias: "Flame-haired kid",
      text: "Nobody saw! Nobody saw anything! I have a lifebuoy and a clean conscience!"
    },
    {
      name: "Captain Stroud",
      text: "YOU, SIR. WITH THE HAIR. I CAN SEE YOU. I HAVE SEEN YOU SINCE THE FUNNEL. I AM A CAPTAIN. MY WHOLE JOB IS SEEING."
    },
    {
      say: "branden",
      alias: "Flame-haired kid",
      text: "\"…Technically it's an *exercise*.\" A sidelong look. \"Branden Sunflower. National champion. Under tens. Two years running. You can write it down.\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["branden"]) s.names["branden"] = "Branden Sunflower"; if (io && io.popup && !s.flags["met_branden"]) io.popup({ type: 'met', id: "branden", name: "Branden Sunflower" }); }
    },
    { flag: "met_branden" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["branden"] = s.notes["branden"] || []); if (a.indexOf("Ten, loud, and a national champion. Pranks everyone.") < 0) a.push("Ten, loud, and a national champion. Pranks everyone."); }
    },
    { label: "end_7" },
    { when: (s)=>!(!!s.flags["met_rana"]), jump: "next_14" },
    {
      text: "On the top step of the iron stair to the wheelhouse, a girl with two long blonde braids, each one tied off with a big red bow, is sitting, knees drawn up, with her back to the crowd and her eyes on the island."
    },
    { when: (s)=>!(((s.vars["aff_rana"]||0)>=11)), jump: "next_16" },
    { say: "rana", text: "…Hey." },
    { say: "rowan", text: "Hey." },
    { say: "rana", text: "Don't tell me it's pretty." },
    { say: "rowan", text: "I wasn't going to." },
    {
      say: "rana",
      text: "\"It's pretty. I know it's pretty. I know what it looks like when it's —\" She stops. \"…I've seen it before. Last year. Don't ask.\""
    },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["rana"] = s.notes["rana"] || []); if (a.indexOf("Has been to the island before. Will not say why.") < 0) a.push("Has been to the island before. Will not say why."); }
    },
    {
      add: { aff_rana: 3 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "rana", n: 3, why: "Didn't ask" }); } },
    { jump: "end_15" },
    { label: "next_16" },
    { say: "rana", text: "…What." },
    { say: "rowan", text: "Just standing." },
    { say: "rana", text: "\"Fine.\" A pause. \"Don't talk.\"" },
    { label: "end_15" },
    { jump: "end_13" },
    { label: "next_14" },
    {
      text: "On the top step of the iron stair to the wheelhouse a girl is sitting with her knees drawn up and her back to the crowd. Her hair hangs in two long blonde braids with big red bows, and her eyes are on the island."
    },
    { say: "rana", alias: "Scowling girl", text: "…No." },
    { say: "rowan", text: "I haven't said anything." },
    { say: "rana", alias: "Scowling girl", text: "Rana. That's all you get." },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["rana"]) s.names["rana"] = "Rana"; if (io && io.popup && !s.flags["met_rana"]) io.popup({ type: 'met', id: "rana", name: "Rana" }); }
    },
    { flag: "met_rana" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["rana"] = s.notes["rana"] || []); if (a.indexOf("Scowls. Keeps to herself.") < 0) a.push("Scowls. Keeps to herself."); }
    },
    { label: "end_13" },
    { when: (s)=>!(!!s.flags["met_teobalt"]), jump: "next_20" },
    { say: "teobalt", text: "\"Rowan. Excellent timing.\"" },
    {
      text: "He is standing perfectly straight next to the stair, in his long red coat, with the clipboard at chest height and the spare pen behind his ear, and he is counting heads aloud under his breath."
    },
    { say: "teobalt", text: "\"I am at forty-one on the starboard side. I shall need you at forty-two.\"" },
    { when: (s)=>!(!!s.flags["has_unloading_list"]), jump: "next_22" },
    {
      say: "teobalt",
      text: "The list is holding. The duffels will come off first, the trunks second, and the tuba third. I believe the order is correct. I will accept corrections until the gangway."
    },
    { say: "rowan", text: "It's teal." },
    { say: "teobalt", text: "\"It is *very* teal.\" A small, bright pleasure. \"Thank you for noticing.\"" },
    {
      add: { aff_teobalt: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "teobalt", n: 1, why: "Noticed the teal again" }); }
    },
    { jump: "end_21" },
    { label: "next_22" },
    {
      say: "teobalt",
      text: "I have drawn up an unloading order. You are somewhere in the middle. I am sorry. It is nothing personal. It is alphabetical."
    },
    { label: "end_21" },
    { jump: "end_19" },
    { label: "next_20" },
    {
      text: "A boy in a long red coat buttoned to the collar is standing perfectly straight beside the stair with a clipboard at chest height, counting heads aloud, under his breath, to the nearest crate."
    },
    {
      say: "teobalt",
      alias: "Boy with a clipboard",
      text: "Twenty-four. Twenty-five. Excuse me — you are in the way of the count. Not unkindly. It is a *fact*. Teobalt Fullington. I am making a list of the order in which we leave."
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["teobalt"]) s.names["teobalt"] = "Teobalt Fullington"; if (io && io.popup && !s.flags["met_teobalt"]) io.popup({ type: 'met', id: "teobalt", name: "Teobalt Fullington" }); }
    },
    { flag: "met_teobalt" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["teobalt"] = s.notes["teobalt"] || []); if (a.indexOf("Makes lists. Organises everything.") < 0) a.push("Makes lists. Organises everything."); }
    },
    { say: "rowan", text: "Rowan. How am I doing?" },
    { say: "teobalt", text: "You are in the middle. It is alphabetical. It is nothing personal." },
    { label: "end_19" },
    { when: (s)=>!(!!s.flags["met_pippa"]), jump: "next_26" },
    { text: "Pippa jumps off the crate with the camera held out in front of her like a lantern." },
    {
      say: "pippa",
      text: "Right! Everybody! Group photo! Everybody who's here! Georgie, you're at the front. Branden, drop the buoy. Rana — Rana, I can see your elbow, I'll take it. Teobalt, stand — no, you're fine, you're fine, you're always fine."
    },
    { when: (s)=>!(!!s.flags["pippa_photo_promised"]), jump: "next_28" },
    {
      say: "pippa",
      text: "And Rowan, you're in the middle, because you've earned it. I said you'd get a photograph. Well, now you're in one."
    },
    { label: "next_28" },
    { label: "end_27" },
    { say: "pippa", text: "Everyone say — I don't know — 'island'!" },
    { text: "All of you, awkwardly, in a ragged line, say \"island.\"" },
    { text: "Click." },
    {
      choice: [
        { text: "Wait. Give me the camera. You should be in one.", goto: "opt_30" },
        { text: "Smile for the picture and say nothing else.", goto: "opt_31" }
      ]
    },
    { jump: "choiceend_29" },
    { label: "opt_30" },
    { say: "rowan", text: "Wait. Give me the camera. You should be in one." },
    { say: "pippa", text: "\"Hm?\"" },
    { text: "The camera does not move for a moment, and then, very slowly, it comes down." },
    { say: "pippa", text: "\"…What?\"" },
    {
      say: "rowan",
      text: "You're in none of these. You've shot twelve people. I want one of you. In front of the island. Here."
    },
    { say: "pippa", text: "\"That's — nobody ever — it's a rule. There's always one person behind the —\"" },
    {
      text: "She stops. She looks at the camera, and at you, and at the lifeboat ladder behind her, where Georgie has stopped breathing."
    },
    { say: "pippa", text: "\"…Okay. Okay. Just — don't do anything clever. Just — hold it straight.\"" },
    {
      text: "You take the camera. It is heavier than you expected, with a cold brass weight that fits the heel of the hand. You look through the viewfinder. A freckled girl in a yellow bow tie is standing in front of an island, trying, with enormous effort, not to pose."
    },
    { say: "rowan", text: "Don't try. Just look at the island." },
    { text: "She looks at it. Her face does something you cannot name, and you press the shutter." },
    { text: "Click." },
    { say: "pippa", text: "\"…\" She is very quiet. \"Is that — how did it look?\"" },
    { say: "rowan", text: "Like you." },
    {
      say: "pippa",
      text: "\"…That's the nicest thing anyone's ever said about a photograph.\" A very small, unguarded smile. \"Thank you.\""
    },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["pippa"] = s.notes["pippa"] || []); if (a.indexOf("Never appears in her own photographs. You took one of her.") < 0) a.push("Never appears in her own photographs. You took one of her."); }
    },
    {
      add: { aff_pippa: 5 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "pippa", n: 5, why: "Took her photograph" }); }
    },
    { flag: "pippa_photographed" },
    { jump: "choiceend_29" },
    { label: "opt_31" },
    { say: "pippa", text: "Perfect. Lovely. *Everyone* looks good when the island arrives. It's a rule." },
    {
      add: { aff_pippa: 1 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "pippa", n: 1, why: "Was a good sport" }); } },
    { jump: "choiceend_29" },
    { label: "choiceend_29" },
    { jump: "end_25" },
    { label: "next_26" },
    { text: "The girl with the camera jumps down off the crate." },
    {
      say: "pippa",
      alias: "Girl with a camera",
      text: "Right! Everybody! Group photo! Georgie, you're at the front. Everyone say 'island'!"
    },
    { text: "All of you, awkwardly, in a ragged line, say \"island.\" Click." },
    { label: "end_25" },
    { time: 3 }
  ]
});

scene("arrival_finale", {
  steps: [
    { clear: true },
    {
      set: { fin_n: 0 }
    },
    {
      text: "The bell rings again, three times, loud and clear. The engine note drops. All round you, the ship, which has been a collection of separate little worlds all morning, slowly becomes one."
    },
    { text: "Everyone has come to the rails." },
    { enter: "nathan" },
    { enter: "baylee" },
    {
      add: { fin_n: 2 }
    },
    { when: (s)=>!((!!s.flags["met_georgie"]&&!(s.vars["fin_n"]===6))), jump: "next_2" },
    { enter: "georgie" },
    {
      add: { fin_n: 1 }
    },
    { label: "next_2" },
    { label: "end_1" },
    { when: (s)=>!((!!s.flags["met_pippa"]&&!(s.vars["fin_n"]===6))), jump: "next_4" },
    { enter: "pippa" },
    {
      add: { fin_n: 1 }
    },
    { label: "next_4" },
    { label: "end_3" },
    { when: (s)=>!((!!s.flags["met_ed"]&&!(s.vars["fin_n"]===6))), jump: "next_6" },
    { enter: "ed" },
    {
      add: { fin_n: 1 }
    },
    { label: "next_6" },
    { label: "end_5" },
    { when: (s)=>!((!!s.flags["met_inya"]&&!(s.vars["fin_n"]===6))), jump: "next_8" },
    { enter: "inya" },
    {
      add: { fin_n: 1 }
    },
    { label: "next_8" },
    { label: "end_7" },
    { when: (s)=>!((!!s.flags["met_marit"]&&!(s.vars["fin_n"]===6))), jump: "next_10" },
    { enter: "marit" },
    {
      add: { fin_n: 1 }
    },
    { label: "next_10" },
    { label: "end_9" },
    { when: (s)=>!((!!s.flags["met_branden"]&&!(s.vars["fin_n"]===6))), jump: "next_12" },
    { enter: "branden" },
    {
      add: { fin_n: 1 }
    },
    { label: "next_12" },
    { label: "end_11" },
    {
      say: "nathan",
      text: "THERE! THE PIER! Everybody look at the PIER! There's people on the pier! They're WAVING!",
      mood: "laughing"
    },
    { say: "baylee", text: "It's the welcome." },
    { say: "nathan", text: "WELCOME!!", mood: "grin" },
    { when: (s)=>!(!!s.flags["met_georgie"]), jump: "next_14" },
    {
      say: "georgie",
      text: "\"…They're very far away. They're — they're waving at us. All of us.\" A tiny pause. \"Is that all right? To be waved at?\""
    },
    { say: "pippa", text: "It's the best part. You wave back." },
    {
      text: "Georgie raises one hand an inch off the rail, and holds it there as if she were checking whether it would be taken away."
    },
    { label: "next_14" },
    { label: "end_13" },
    { when: (s)=>!(!!s.flags["met_ed"]), jump: "next_16" },
    {
      say: "ed",
      text: "They've got a CABLE CAR! Is that dangerous? Does it go over the volcano? Can we go on it? Can we go on it TODAY?"
    },
    { label: "next_16" },
    { label: "end_15" },
    { when: (s)=>!(!!s.flags["met_inya"]), jump: "next_18" },
    { say: "inya", text: "\"That's an arch.\"" },
    {
      text: "She is standing on tiptoe at the rail, with her deck box under her arm, looking at the blue gate at the end of the pier."
    },
    {
      say: "inya",
      text: "\"Gold letters. It says 'WELCOME, DUELISTS'. They know.\" A fierce pause. \"They know what we are.\""
    },
    { label: "next_18" },
    { label: "end_17" },
    { when: (s)=>!(!!s.flags["met_marit"]), jump: "next_20" },
    {
      say: "marit",
      text: "**FIN!** *CURTAIN!* **THE SEA PARTS, AND THE HEROES ARRIVE!** I am going to cry. I'm *prepared* to cry. I have a *handkerchief* —",
      shake: true
    },
    { label: "next_20" },
    { label: "end_19" },
    { when: (s)=>!(!!s.flags["met_branden"]), jump: "next_22" },
    {
      say: "branden",
      text: "I'm going to be the first one off the gangway! I've decided! I'll hold the rail! No-one will stop me!"
    },
    { say: "baylee", text: "I'll be on the gangway." },
    { say: "branden", text: "…I'll be the *second* one off." },
    { label: "next_22" },
    { label: "end_21" },
    {
      text: "The engine falls from a thrum to a murmur. The pier swings round, huge and brown, and all at once you can see individual planks, each with its own bleach of salt, and each stained in its own particular way by forty years of boots."
    },
    { when: (s)=>!(!!!s.flags["arr_bow"]), jump: "next_24" },
    { think: "I haven't talked to half of them. I'll have to." },
    { label: "next_24" },
    { label: "end_23" },
    { think: "Whatever I do on the island, I'll start it here." },
    {
      text: "A long, deep note from below, like a cello being played by a mountain. A ripple through the soles of your feet. The ship shudders once, very gently, and then stops."
    },
    { name: "Loudspeaker", text: "Ten-forty on the nose. Mind the gap." },
    { sfx: "heavy_impact" },
    { text: "Nobody moves." },
    { text: "And then somebody, near the bow, starts to cheer." },
    { clear: true }
  ]
});
