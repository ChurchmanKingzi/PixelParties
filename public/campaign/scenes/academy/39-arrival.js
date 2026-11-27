// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
// Der Runner muss Texte als Funktion erlauben (text: (s) => …, ausgewertet mit dem Spielstand) und beim card-Schritt die Seltenheit (rarity) beachten; s.deck = Rowans aktuelles Deck, s.owned = Sammlung je Seltenheit.
const { AFF, MET, DECK, NOTE, REL, PHOTO, DECKCOUNT, WORDS, ALPHA } = helpers;
scene("ferry_arrival", {
  background: "ferry_deck",
  steps: [
    { clear: true },
    // Das Horn ertönt immer um 10:25, egal wie spät das Ereignis nach der letzten Szene zum Zug kommt (die Uhr springt dorthin).
    { run: (s)=>{ s.minutes = 625; } },
    {
      set: { arrival_visits: 0 }
    },
    { goto: "ferry_deck", travel: 0 },
    // Pippa fotografiert die ganze Überfahrt, auch wo Rowan nicht hinsieht (Ids wie die gezeigten Fotos; doppelte entfallen).
    PHOTO("georgie_gangway", "Georgie coming up the gangway at the harbour, hands shaking before the crossing", { who: ["georgie"], off: true }),
    PHOTO("georgie_rope", "Georgie on the rope coil, feather to the light, looking at the volcano", { who: ["georgie"], off: true }),
    PHOTO("baylee_bench", "Baylee moving a whole bench by himself, so somebody else's bag is in the shade", { who: ["baylee"], off: true }),
    PHOTO("island_bow", "Caldera Key from the bow, the volcano trailing its thread of smoke", { who: [], off: true }),
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
    { when: (s)=>!s.flags["met_maisie"], text: "Along the port walkway a girl in oil-stained overalls climbs down off an upturned bucket, counts the screws in her palm, and seems satisfied with the number." },
    { when: (s)=>!!s.flags["met_maisie"], text: "Along the port walkway Maisie climbs down off her bucket, counts the screws in her palm, and seems satisfied with the number." },
    { when: (s)=>!s.flags["met_hedda"], text: "On the starboard side a tiny girl under a crown of wildflowers is working her way down the line of people with a pen on a string, faster than before, like somebody getting the washing in ahead of rain." },
    { when: (s)=>!!s.flags["met_hedda"], text: "On the starboard side Hedda is working her way down the line of people with the pen on its string, faster than before, like somebody getting the washing in ahead of rain." },
    { when: (s)=>!s.flags["met_freya"], text: "On the bench bolted to the deckhouse behind her, a paperback lifts a quarter of an inch off a face. One pale eye considers the horn. The book comes down again." },
    { when: (s)=>!!s.flags["met_freya"], text: "On the bench behind her, Freya's paperback lifts a quarter of an inch. One pale eye considers the horn. The book comes down again." },
    { text: "The captain's voice comes on the loudspeaker, unhurried and warm." },
    {
      name: "Loudspeaker",
      text: "\"Fifteen minutes, folks. Mind your luggage and your elbows. The ladies and gentlemen who are going to want a last look, the rail is wide enough for all of you. The gentleman with the lifebuoy knows who he is.\""
    },
    { when: (s)=>!s.flags["met_viktor"], text: "Up in the point of the bow a man in a wide-brimmed hat does not look up at the loudspeaker. He looks at a brass compass, and then at the island, like somebody checking the captain's arithmetic." },
    { when: (s)=>!!s.flags["met_viktor"], text: "Up in the point of the bow Viktor does not look up at the loudspeaker. He looks at the compass, and then at the island, like somebody checking the captain's arithmetic." },
    {
      text: "You are standing at the rail with your hands on the wet iron, and you are, for the first time since the harbour, entirely alone."
    },
    { text: "The island has stopped being a picture. It has trees on it now." },
    { text: "A grey cone of volcano, a thread of smoke leaning off its top. Jungle pouring down the flanks to a ribbon of pale sand, and, on the sand, tiny and perfect, a long wooden pier with a blue arch at its end." },
    { text: "A little red cable car crawls along a wire over the canopy like a bead on a string. The sea around it is so clear that you can see, where the ship's shadow falls, a line where the green turns to blue." },
    { think: "That's it. That's where I live now." },
    { think: "Fifteen minutes. And then I won't be a person on a boat any more. I'll be a person on an island." },
    { text: "Behind you, the iron door of the saloon bangs open, and the whole ship starts to arrive." },
    { when: (s)=>!s.flags["met_junho"], text: "The first one through it is a boy in a gold jacket carrying five identical deck boxes in a stack, with his chin on the top one, like a waiter with a difficult cake." },
    { when: (s)=>!!s.flags["met_junho"], text: "The first one through it is Jun-ho, carrying all five deck boxes in a stack, with his chin on the top one, like a waiter with a difficult cake." },
    { scene: "arrival_hub" },
    // Angelegt wird immer um 10:40 (Karte im Steuerhaus: „tie up 10.40“), gleich wie lange der Rundgang gedauert hat.
    { run: (s)=>{ s.minutes = 640; } },
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
    { text: "Between the knots the stragglers are still choosing. A black parasol crosses the deck at the pace of a procession. A long striped scarf goes aft, talking. Somebody you very nearly fail to see reads the muster notice one more time, and then follows the parasol." },
    { when: (s)=>!!s.flags["eloise_time_promise"]&&!s.flags["eloise_time_kept"]&&!s.flags["arr_stairs"]&&!!s.flags["lounge_seen"], think: "Nearly in. I told Eloise I'd come and say so. Not like a bell." },
    { jump: "end_3" },
    { label: "next_4" },
    { when: (s)=>!((s.vars["arrival_visits"]===1)), jump: "next_5" },
    {
      text: "The island has moved. It is no longer a place in the distance but a coast, with a surf line and a smell: wet earth and salt and something green, frying."
    },
    { text: "The frying is real. So is the ginger, from somewhere aft, and under both of them a thread of turpentine that has no business on a ship." },
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
            "mikoto",
            "viktor",
            "eberhart",
            "sammy",
            "tobias",
            "dmitri"
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
            "livvie",
            "anni",
            "junho",
            "eloise"
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
            "victoria",
            "cas",
            "rafa"
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
            "teobalt",
            "maisie",
            "fiona",
            "leona",
            "hedda",
            "freya",
            "trixie"
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
    { run: (s)=>{ s.minutes = 625 + 4 * (s.vars["arrival_visits"] || 0); } },
    { jump: "top" },
    { jump: "choiceend_7" },
    { label: "opt_9" },
    { scene: "arrival_stairs" },
    { flag: "arr_stairs" },
    {
      add: { arrival_visits: 1 }
    },
    { run: (s)=>{ s.minutes = 625 + 4 * (s.vars["arrival_visits"] || 0); } },
    { jump: "top" },
    { jump: "choiceend_7" },
    { label: "opt_10" },
    { scene: "arrival_stern" },
    { flag: "arr_stern" },
    {
      add: { arrival_visits: 1 }
    },
    { run: (s)=>{ s.minutes = 625 + 4 * (s.vars["arrival_visits"] || 0); } },
    { jump: "top" },
    { jump: "choiceend_7" },
    { label: "opt_11" },
    { scene: "arrival_mid" },
    { flag: "arr_mid" },
    {
      add: { arrival_visits: 1 }
    },
    { run: (s)=>{ s.minutes = 625 + 4 * (s.vars["arrival_visits"] || 0); } },
    { jump: "top" },
    { jump: "choiceend_7" },
    { label: "opt_12" },
    { think: "Everyone else can have the rails. I'd like to watch it arrive." },
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
      text: "\"ROWAN! Over here! Look! Look at it! I counted! There are TWELVE gulls! I counted every single one of them and Baylee did not argue once!\"",
      mood: "laughing"
    },
    { say: "baylee", text: "\"There were thirteen.\"" },
    { say: "nathan", text: "\"Thirteen! He's right! He's always right! It's very annoying!\"", mood: "grin" },
    { jump: "end_1" },
    { label: "next_2" },
    {
      say: "nathan",
      text: "\"ROWAN! You came! I SAVED you a bit of rail! It's this bit! It's got a rivet! It's the best bit!\"",
      mood: "laughing"
    },
    { say: "baylee", text: "\"He's been guarding it for ten minutes.\"" },
    { say: "nathan", text: "\"I've been GUARDING it! I was ready to FIGHT for it!\"", mood: "grin" },
    { label: "end_1" },
    { when: (s)=>!(((s.vars["aff_nathan"]||0)>=17)), jump: "next_5" },
    {
      text: "Nathan turns round with his back to the rail. For a moment the grin goes out of his face, and what is underneath it looks younger and more worried."
    },
    {
      say: "nathan",
      text: "\"Rowan. Can I say a thing? Before everybody comes. It's — I'm glad you took my hand. This morning. When I stuck it out. Everybody else has been running away from me since the harbour, and I was getting really loud about it, so nobody would notice.\""
    },
    { say: "rowan", text: "\"Nathan, you were extremely loud.\"" },
    { say: "nathan", text: "\"It WORKED! You noticed!\"", mood: "happy" },
    { jump: "end_4" },
    { label: "next_5" },
    { when: (s)=>!(((s.vars["aff_nathan"]||0)>=11)), jump: "next_6" },
    {
      say: "nathan",
      text: "\"Big day, Wildcard! Big day! Do you know what they do on the first night? I read about it. There's a feast and a speech, and somebody gets thrown in the sea. I'm hoping it's not me. I'm hoping it's Baylee.\"",
      mood: "happy"
    },
    { say: "baylee", text: "\"I'd float.\"" },
    { say: "nathan", text: "\"He WOULD.\"", mood: "laughing" },
    { jump: "end_4" },
    { label: "next_6" },
    {
      say: "nathan",
      text: "\"Hey.\" A pause, quite uncharacteristic. \"I hope we're okay. I think I talk a lot. People tell me. I'm trying to say that I know that, and I'll — I'll dial it back. For you. By, like, fifteen percent.\""
    },
    { say: "rowan", text: "\"Fifteen percent would be a start.\"" },
    { say: "nathan", text: "\"FIFTEEN! Watch me!\"", mood: "happy" },
    { label: "end_4" },
    {
      text: "Baylee has been standing very still at the rail, with his hat pushed back and his huge forearms folded on the iron. He looks like something the ship was built round."
    },
    { when: (s)=>!(((s.vars["aff_baylee"]||0)>=14)), jump: "next_9" },
    { say: "baylee", text: "\"Rowan.\"" },
    { text: "He steps aside, exactly one pace, which in Baylee's case opens up a space the width of a doorway." },
    { say: "baylee", text: "\"Better view from here. Sun's behind the funnel. You can see the whole row of roofs.\"" },
    {
      text: "You look. A line of tiny weathered bungalows is strung along the curve of the cove, like a necklace of matchboxes."
    },
    { say: "baylee", text: "\"That's us. That's the last one. Seven.\"" },
    { say: "rowan", text: "\"How can you tell?\"" },
    { say: "baylee", text: "\"It's the one that looks like it's trying not to be noticed.\"" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["baylee"] = s.notes["baylee"] || []); if (a.indexOf("Notices things and says very little. Likes quiet company.") < 0) a.push("Notices things and says very little. Likes quiet company."); }
    },
    { jump: "end_8" },
    { label: "next_9" },
    { say: "baylee", text: "\"Morning, Rowan. Nearly eleven.\" A pause. \"Nearly there.\"" },
    { label: "end_8" },
    { when: (s)=>!s.flags["met_eberhart"], text: "Baylee is not the only fixed point on the fore deck." },
    { when: (s)=>!s.flags["met_eberhart"], text: "Against the forward bulkhead the first-years' trunks stand in a stack so square that it looks drawn, and beside it, at something like parade rest, stands a tall boy with cropped ash-blond hair and an old, straight scar across one cheek." },
    { when: (s)=>!s.flags["met_eberhart"], text: "He is facing the island as if it had been assigned to him." },
    { when: (s)=>!!s.flags["met_eberhart"], text: "Baylee is not the only fixed point on the fore deck. Beside the trunks, which are still square, Eberhart stands at parade rest with his hands behind his back. He is facing the island as if it had been assigned to him." },
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
      text: "\"Rowan! You've got to come with me when we land! There's a path! There's probably a path! There is DEFINITELY a place where a path should be!\""
    },
    { say: "rowan", text: "\"Ed, if you fall off, I'm not jumping in after you.\"" },
    { say: "ed", text: "\"Is that dangerous? That's a bit dangerous! Good!\"" },
    {
      add: { aff_ed: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "ed", n: 1, why: "Didn't tell him to get down" }); }
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
      text: "\"THERE'S A WATERFALL! On the north side! Between the green bit and the other green bit! Does anyone see it? I think it goes all the way down! Is it dangerous? I hope it's dangerous!\""
    },
    {
      say: "nathan",
      text: "\"That's ED! Ed's from a RANCH! I've talked to him for four minutes and I know his horse's name!\"",
      mood: "grin"
    },
    { say: "ed", alias: "Boy in a battered hat", text: "\"Ed Venture! Lazy V Ranch! The horse is Pickles! Hello!\"" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["ed"]) s.names["ed"] = "Ed Venture"; if (io && io.popup && !s.flags["met_ed"]) io.popup({ type: 'met', id: "ed", name: "Ed Venture" }); }
    },
    { flag: "met_ed" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["ed"] = s.notes["ed"] || []); if (a.indexOf("Hangs off things. Asks whether everything is dangerous, hopefully.") < 0) a.push("Hangs off things. Asks whether everything is dangerous, hopefully."); }
    },
    { label: "end_11" },
    { when: (s)=>!s.flags["met_viktor"], text: "Right in the point of the bow, where the deck narrows to nothing, a lean man in a wide-brimmed hat with a pale-blue feather in the band has not looked up at any of this." },
    { when: (s)=>!s.flags["met_viktor"], text: "He holds a brass compass flat on his palm, sights along it at the cliff, and writes a small number on a creased map." },
    { when: (s)=>!!s.flags["met_viktor"], text: "Right in the point of the bow, Viktor has not looked up at any of this. He holds the compass flat on his palm, sights along it at the cliff, and writes a small number on the map." },
    { say: "viktor", alias: "Man with a compass", text: "\"A little east of the cone. High up. The printed map has trees there.\"" },
    { text: "He says it to the map. Ed hears it anyway, and looks round at him the way a dog looks at somebody who has just picked up a lead." },
    { when: (s)=>!!s.flags["viktor_notch"], say: "viktor", alias: "Man with a compass", text: "\"Water comes down from somewhere, Rowan. I would start at your notch.\"" },
    { when: (s)=>!(!!s.flags["met_mikoto"]), jump: "next_18" },
    {
      say: "mikoto",
      text: "\"Oh — oh, Rowan, hello. Sorry. Look, there's — I think I have to sit down. Everything is — everything is so much larger than the pictures.\""
    },
    { text: "He laughs, high and brief, and presses a hand over his mouth." },
    { say: "mikoto", text: "\"Sorry. I'm looking. I'm looking at it.\"" },
    { say: "rowan", text: "\"You can hold the rail if you need to.\"" },
    { say: "mikoto", text: "\"Thank you.\"" },
    { text: "A quick, startled glance behind the lenses." },
    { say: "mikoto", text: "\"That's — very nice. That's nicer than 'calm down'.\"" },
    { jump: "end_17" },
    { label: "next_18" },
    {
      text: "A thin boy in round glasses is at the rail, holding on with both hands and breathing very carefully."
    },
    {
      say: "mikoto",
      alias: "Apologetic boy",
      text: "\"Sorry. Sorry! I'm — it's just a very big volcano. I'm making a list. I'm — oh, you're looking at me. Mikoto. Yamaguchi. I'm Mikoto, I'm having a very good time, it just doesn't look like it.\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["mikoto"]) s.names["mikoto"] = "Mikoto Yamaguchi"; if (io && io.popup && !s.flags["met_mikoto"]) io.popup({ type: 'met', id: "mikoto", name: "Mikoto Yamaguchi" }); }
    },
    { flag: "met_mikoto" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["mikoto"] = s.notes["mikoto"] || []); if (a.indexOf("Apologises a lot, and is having a good time anyway. Keeps lists.") < 0) a.push("Apologises a lot, and is having a good time anyway. Keeps lists."); }
    },
    {
      say: "rowan",
      text: "\"Rowan. It's a big volcano. I'm having a good time too. It just doesn't look like it either.\""
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
    { when: (s)=>!s.flags["met_sammy"], text: "Behind the crowd, alone at the rail beyond the last bench, a slight boy in a long black coat is brooding at the island: chin down, one eye lost under a black fringe." },
    { when: (s)=>!s.flags["met_sammy"], text: "The coat is flying straight out behind him like a flag, and one corner of it is feeling its way towards a deck cleat." },
    { when: (s)=>!!s.flags["met_sammy"], text: "Behind the crowd, alone at the rail beyond the last bench, Sammy is brooding at the island, chin down. The coat is flying straight out behind him like a flag, and one corner of it is feeling its way back towards the deck cleat." },
    { when: (s)=>!s.flags["met_tobias"], text: "On the middle bench a broad boy with a broken nose, hands in his pockets, puts out one boot without turning his head and moves the hem aside. It is done so smoothly that the coat's owner never knows." },
    { when: (s)=>!!s.flags["met_tobias"], text: "On the middle bench Tobias, hands still in his pockets, puts out one boot without turning his head and moves the hem aside. It is done so smoothly that the coat's owner never knows." },
    { say: "sammy", alias: "Boy in a long black coat", text: "\"The island —\" Low, slow, ominous. A long pause. \"…is actually quite big, isn't it.\"" },
    { say: "tobias", alias: "Boy with a broken nose", text: "\"Coat like that wants a minder.\" Quietly, to you and not to him. \"Don't tell him it's got one.\"" },
    {
      text: "A bell rings somewhere, thin and bright. The deck lurches an inch to starboard as the ship comes round."
    },
    { when: (s)=>!s.flags["met_eberhart"], text: "The stack of trunks does not move. The boy with the scar looks at it once anyway, to make sure it has understood." },
    { when: (s)=>!!s.flags["met_eberhart"], text: "The stack of trunks does not move. Eberhart looks at it once anyway, to make sure it has understood." },
    { when: (s)=>!(!!s.flags["follow_nathan"]), jump: "next_21" },
    { say: "nathan", text: "\"WE'RE TURNING! The island's TURNING! Baylee, the island is TURNING!\"", mood: "laughing" },
    { say: "baylee", text: "\"It's us.\"" },
    { say: "nathan", text: "\"It's US! WE'RE TURNING!\"", mood: "grin" },
    { jump: "end_20" },
    { label: "next_21" },
    { say: "nathan", text: "\"WE'RE TURNING! The island's TURNING!\"", mood: "laughing" },
    { say: "baylee", text: "\"It's us, Nathan.\"" },
    { label: "end_20" },
    { when: (s)=>!s.flags["met_dmitri"], text: "On the bench nearest the bow a long boy under a grey blanket, beanie down to his eyebrows, has not got up for any of it. He is lying with the island behind his head, looking at the sky over the stern, one hand resting on a dented steel thermos." },
    { when: (s)=>!!s.flags["met_dmitri"], text: "On the bench nearest the bow, Dmitri has not got up for any of it. He is still facing the wrong way, with one hand on the thermos." },
    { say: "dmitri", alias: "Boy under a blanket", text: "\"…They say it turns.\" To the sky, slowly. \"Somebody tell me when it has finished. I am going to look at it once, and I would like it to be standing still.\"" },
    { say: "baylee", text: "\"Soon.\"" },
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
    { when: (s)=>!s.flags["met_eloise"], text: "Not everyone from the saloon has come up to look at the island. On the top step a girl in a wine-red beret is kneeling over a sketchbook too big for the stair, with dried paint in her hair and her back to the island. She is painting the stairs, and the people on them, as stripes." },
    { when: (s)=>!!s.flags["met_eloise"], text: "Not everyone from the saloon has come up to look at the island. On the top step Eloise is kneeling over the sketchbook with her back to the island. She is painting the stairs, and the people on them, as stripes." },
    { when: (s)=>!s.flags["met_junho"], text: "Two steps below her a boy in a gold jacket, a stylus behind his ear, has set five identical deck boxes along the tread and is squaring the row against the edge of the step. The step is not quite straight. He has noticed." },
    { when: (s)=>!!s.flags["met_junho"], text: "Two steps below her Jun-ho has set the five deck boxes along the tread and is squaring the row against the edge of the step. The step is not quite straight. He has noticed." },
    { when: (s)=>!(!!s.flags["ferry_table_won"]), jump: "next_2" },
    {
      text: "Gideon is standing on the bottom step with a single duffel at his feet. It is the first time you have seen him without all four of his cases within arm's reach. He is looking at the island with the controlled attention of a man re-reading a contract."
    },
    { say: "gideon", alias: "Boy in white gloves", text: "\"Vance.\"" },
    { say: "rowan", text: "\"Gideon.\"" },
    {
      say: "gideon",
      alias: "Boy in white gloves",
      text: "\"I should like to say something before this ship docks, because I shall not say it ashore.\""
    },
    { text: "A pause so level you could set a tray on it." },
    { say: "gideon", alias: "Boy in white gloves", text: "\"That was well played. And I was wrong about the collar.\"" },
    { say: "gideon", alias: "Boy in white gloves", text: "\"I do not say that, as a rule. You will want to note the date.\"" },
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
    { say: "gideon", alias: "Boy in white gloves", text: "\"Vance. I trust you are rested. The hill is — considerable.\"" },
    { say: "rowan", text: "\"I'll manage.\"" },
    {
      say: "gideon",
      alias: "Boy in white gloves",
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
    { when: (s)=>!!s.flags["met_gideon"], text: "Gideon has two bruise-coloured shadows under his eyes that were not there an hour ago. He stands apart from the others, gloved hands folded. Beside his feet there is a small rucksack, which is not his. It belongs to someone shorter." },
    { when: (s)=>!s.flags["met_gideon"], text: "The pale boy in the white gloves has two bruise-coloured shadows under his eyes that were not there an hour ago. He stands apart from the others, hands folded. Beside his feet there is a small rucksack, which is not his. It belongs to someone shorter." },
    { say: "gideon", alias: "Boy in white gloves", text: "\"I am told you have an opinion of the outcome, Vance.\"" },
    { say: "rowan", text: "\"I think it was a very good game.\"" },
    { say: "gideon", alias: "Boy in white gloves", text: "\"It was a very good game.\"" },
    { text: "He says it like pulling a thread." },
    { say: "gideon", alias: "Boy in white gloves", text: "\"She was patient. I had not accounted for patience.\"" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["gideon"] = s.notes["gideon"] || []); if (a.indexOf("Lost the table to Inya. Took it hard, and took it quietly.") < 0) a.push("Lost the table to Inya. Took it hard, and took it quietly."); }
    },
    { jump: "end_1" },
    { label: "next_4" },
    { when: (s)=>!s.flags["ferry_inya_lost"], jump: "gid_settled" },
    { when: (s)=>!!s.flags["met_gideon"], text: "Gideon is standing on the bottom step with his gloves on and nothing at all in his hands. His four dark cases stand three steps higher, round the feet of a girl who is not looking at them." },
    { when: (s)=>!s.flags["met_gideon"], text: "The pale boy in the white gloves is standing on the bottom step with nothing at all in his hands. Four dark leather cases stand three steps higher, round the feet of a girl who is not looking at them." },
    { say: "gideon", alias: "Boy in white gloves", text: "\"Vance.\"" },
    { say: "gideon", alias: "Boy in white gloves", text: "\"She attacked on turn one. People do.\" A glance up the stairs, and away again. \"I had rather hoped, this once, that somebody would not.\"" },
    { jump: "end_1" },
    { label: "gid_settled" },
    { when: (s)=>!(!!s.flags["ferry_table_settled"]), jump: "next_5" },
    { when: (s)=>!!s.flags["met_gideon"], text: "Gideon is turning a pair of white gloves slowly over in his hands. He has the look of a man who has had an idea that he did not choose and is, against every instinct, quite pleased with." },
    { when: (s)=>!s.flags["met_gideon"], text: "The pale boy from the card table is turning a pair of white gloves slowly over in his hands. He has the look of a man who has had an idea that he did not choose and is, against every instinct, quite pleased with." },
    {
      say: "gideon",
      alias: "Boy in white gloves",
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
    { when: (s)=>!!s.flags["met_gideon"], text: "Gideon is standing at the foot of the stairs exactly as he stood at the end of his table, gloves on, hands folded, although the table is now a deck below him. The habit seems to be stronger than the room." },
    { when: (s)=>!s.flags["met_gideon"], text: "The pale boy in the white gloves is standing at the foot of the stairs exactly as he stood at the end of the card table, hands folded, although the table is now a deck below him. The habit seems to be stronger than the room." },
    { say: "gideon", alias: "Boy in white gloves", text: "\"Vance.\"" },
    { text: "A very small, very formal nod." },
    { say: "gideon", alias: "Boy in white gloves", text: "\"The table remains closed. I find that I am less pleased about it than I expected.\"" },
    { label: "end_1" },
    { when: (s)=>!(!!s.flags["ferry_inya_won"]), jump: "next_8" },
    {
      say: "inya",
      alias: "Girl with the bunny clip",
      text: "\"Hey.\" Fast, sharp, trembling. \"Hey, Wildcard. I won. I WON. You were there. You told me how.\""
    },
    { say: "rowan", text: "\"You waited.\"" },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"I waited.\"" },
    { text: "She says it with a kind of wonder." },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"He never got to play me, not properly. I did it by not doing anything.\"" },
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
    { say: "inya", alias: "Girl with the bunny clip", text: "\"Don't say anything nice.\"" },
    { say: "rowan", text: "\"I wasn't going to.\"" },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"…Good.\" A beat. \"…What were you going to say?\"" },
    { say: "rowan", text: "\"That I'd like a game, on the island. On a bench. Loser buys the rolls.\"" },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"…\"" },
    { text: "The amber eyes narrow, and something very small and very fierce flickers behind them." },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"Six Smug Coins.\"" },
    {
      add: { aff_inya: 3 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 3, why: "Offered a rematch" }); } },
    { flag: "inya_rematch_offered" },
    { jump: "end_7" },
    { label: "next_9" },
    { when: (s)=>!(!!s.flags["met_inya"]), jump: "next_10" },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"Hey.\"" },
    { text: "Flat, careful, as if she were testing a stair." },
    {
      say: "inya",
      alias: "Girl with the bunny clip",
      text: "\"Are we — are you going to the Commons? Bungalow three. I asked. It was in the letter.\""
    },
    { say: "rowan", text: "\"Seven.\"" },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"Seven.\"" },
    { text: "She considers it, with the air of a girl memorising a map." },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"That's — fine. That's four doors down. I'll know where to find you.\"" },
    {
      add: { aff_inya: 1 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "inya", n: 1, why: "Compared bungalows" }); } },
    { jump: "end_7" },
    { label: "next_10" },
    { when: (s)=>!!s.flags["met_gideon"], text: "A small girl with mint-green tails held by a bunny clip is standing on the lowest step with a deck box pressed to her chest, and her eyes are fixed on Gideon as if he were an exam." },
    { when: (s)=>!s.flags["met_gideon"], text: "A small girl with mint-green tails held by a bunny clip is standing on the lowest step with a deck box pressed to her chest, and her eyes are fixed on the boy in the white gloves as if he were an exam." },
    { say: "inya", alias: "Girl with the bunny clip", text: "\"…You. The one without the jacket.\"" },
    { say: "rowan", text: "\"Rowan.\"" },
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
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["inya"] = s.notes["inya"] || []); if (a.indexOf("In the Commons. Does not want the bunny clip mentioned.") < 0) a.push("In the Commons. Does not want the bunny clip mentioned."); }
    },
    { label: "end_7" },
    { when: (s)=>!(!!s.flags["met_tomi"]), jump: "next_13" },
    { say: "tomi", text: "\"Wildcard! Business is booming!\"" },
    {
      text: "He is at the middle of the stair, a binder open on his knee, accepting and refusing money at the same time, like a very small stock exchange."
    },
    {
      when: (s)=>!!s.flags["ferry_table_won"]||!!s.flags["ferry_table_lost"],
      say: "tomi",
      text: "\"Everybody's got a take on how you played it. I've got four to one that Gideon never speaks to you again, and three to one that he does. It's the second one that scares me.\""
    },
    {
      when: (s)=>!s.flags["ferry_table_won"]&&!s.flags["ferry_table_lost"],
      say: "tomi",
      text: "\"Last book of the crossing. First one down the gangway, first one to cry on the pier, and whether the captain gets us tied up without saying 'folks'. That one's already paid out.\""
    },
    { say: "rowan", text: "\"Who's winning?\"" },
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
      text: "\"Wildcard! No — hold on — you're THE Wildcard. Don't move. Tomás Reyes. Tomi. I run the book.\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["tomi"]) s.names["tomi"] = "Tomás Reyes"; if (io && io.popup && !s.flags["met_tomi"]) io.popup({ type: 'met', id: "tomi", name: "Tomás Reyes" }); }
    },
    { flag: "met_tomi" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["tomi"] = s.notes["tomi"] || []); if (a.indexOf("Runs the book on the ship.") < 0) a.push("Runs the book on the ship."); }
    },
    { label: "end_12" },
    { when: (s)=>!s.flags["met_anni"], text: "On the step above him a very thin girl is standing, heels together, although there is room to sit: a black jacket that hangs from her shoulders, its white-and-gold collar ironed on, an auburn bun, large square glasses, a small grey booklet, and a red pen with its cap off." },
    { when: (s)=>!!s.flags["met_anni"], text: "On the step above him Anni is standing, heels together, although there is room to sit. The booklet is open. The red pen has its cap off." },
    { say: "anni", alias: "Girl with a red pen", text: "\"Organised wagering among students. Section nine, paragraph two. I am entering it a second time, because it is happening a second time.\"" },
    { text: "Tomi turns the binder a few degrees towards her, so that she can copy the odds down correctly." },
    { when: (s)=>!!s.flags["met_anni"], say: "anni", alias: "Girl with a red pen", text: "\"Mr Vance.\" The grey eyes come up for exactly one second. \"Your hood is straight. I am not noting that, either.\"" },
    { when: (s)=>!(!!s.flags["met_noor"]), jump: "next_16" },
    { say: "noor", text: "\"Rowan.\"" },
    { text: "She does not look up from the Charter, which she is reading as the ship slides in." },
    {
      say: "noor",
      text: "\"I am on article seven again. Arrival. I find it comforting that there is a rule for it. Clause four: no one may disembark before the gangway. I thought you would like to know.\""
    },
    { say: "rowan", text: "\"Thank you, Noor.\"" },
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
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["noor"] = s.notes["noor"] || []); if (a.indexOf("Carries a rulebook and reads everything twice.") < 0) a.push("Carries a rulebook and reads everything twice."); }
    },
    { label: "end_15" },
    { when: (s)=>!!s.flags["junho_v5"], say: "junho", alias: "Boy with a row of boxes", text: "\"Rowan. Version nine. Your queue is still in it. I have added the word 'please', and I am not sure it survives review.\"" },
    { when: (s)=>!((!!s.flags["met_livvie"]&&!!s.flags["livvie_fed"])), jump: "next_19" },
    { text: "Livvie has come up the stairs behind you, eating a cinnamon roll in tiny, exact bites, with the other hand cupped under it to catch the crumbs." },
    { say: "livvie", text: "\"Quick thing.\"" },
    { say: "livvie", text: "\"I said I'd pay you back in information. Here's the information.\"" },
    {
      say: "livvie",
      text: "\"The Commons kitchen is the first bungalow. Mama Odalys runs it. Breakfast at six, supper at six. Do not be late. Do not be early. Do not say the word 'diet'.\""
    },
    { say: "rowan", text: "\"Is that all?\"" },
    { say: "livvie", text: "\"That's the whole payment. I've priced it. It's about right.\"" },
    { text: "A tiny, sideways look to see if it landed." },
    { say: "livvie", text: "\"…It's also a long way to six. So eat something before then.\"" },
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
    { text: "At the foot of the stairs Livvie is adding up a column on her clipboard." },
    { say: "livvie", text: "\"Quick thing.\" She does not look up from it." },
    {
      say: "livvie",
      text: "\"The Commons kitchen is the first bungalow. Mama Odalys. Breakfast at six, supper at six. Do not be late.\""
    },
    { say: "rowan", text: "\"That's useful. Thank you.\"" },
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
      text: "A very pale, thin girl with a violet-black bob is standing at the bottom of the stairs with a pencil and a clipboard, adding up a column in short, exact strokes."
    },
    { say: "livvie", alias: "Girl with a clipboard", text: "\"Quick thing. You look like you've not eaten.\"" },
    { text: "She says it to the clipboard, and then, before you can answer, as if you had asked her the same:" },
    { say: "livvie", alias: "Girl with a clipboard", text: "\"I've eaten. I had a big breakfast. Livvie Thana.\"" },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["livvie"]) s.names["livvie"] = "Livvie Thana"; if (io && io.popup && !s.flags["met_livvie"]) io.popup({ type: 'met', id: "livvie", name: "Livvie Thana" }); }
    },
    { flag: "met_livvie" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["livvie"] = s.notes["livvie"] || []); if (a.indexOf("Says she has eaten. Says it to her clipboard.") < 0) a.push("Says she has eaten. Says it to her clipboard."); }
    },
    { label: "end_18" },
    { when: (s)=>!s.flags["eloise_time_promise"], jump: "eloise_plain" },
    { text: "You climb past the row of deck boxes and stand a step below Eloise, where the sun comes round the funnel, the way you stood for her at the window. You do not say it like a bell. You do not say anything." },
    { text: "The brush stops. She looks at your ear, and then at your face, and then at where your face is pointing, which is over her shoulder." },
    { say: "eloise", alias: "Girl in a red beret", text: "\"Oh. It's got *close*. It was only little when I looked. Nobody said. — No. You did. Just now. That was you saying it.\"" },
    { say: "eloise", alias: "Girl in a red beret", text: "\"Hold the corner of the book, would you? I'm going to turn round.\"" },
    { text: "You hold the corner. She turns round on her knees, sketchbook and all, and faces an island a good deal larger than any she has had to deal with so far. The lid of a jar goes down the stairs, one step at a time. Neither of you goes after it." },
    AFF("eloise", 2, "Came and stood, as promised"),
    { flag: "eloise_time_kept" },
    { jump: "eloise_end" },
    { label: "eloise_plain" },
    { when: (s)=>!!s.flags["met_eloise"], say: "eloise", alias: "Girl in a red beret", text: "\"Oh — the berry. Stay there a second. You've got the whole sky round you.\"" },
    { label: "eloise_end" },
    { time: 3 }
  ]
});

scene("arrival_stern", {
  steps: [
    { clear: true },
    { enter: "jessica" },
    { enter: "ashton" },
    { enter: "sunny" },
    { enter: "freddie" },
    { enter: "marit" },
    {
      text: "The stern is where the ship has put its grand gestures. The wake is long and white, the awning snaps in the breeze, and the stern rail is crowded with people who have each decided to be in a different film."
    },
    { when: (s)=>!s.flags["met_cas"], text: "At the flagstaff, with his back to the wake, a boy in a long striped scarf is talking steadily to a small microphone clipped to his lapel. Its lead comes out of the bottom of the scarf and stops." },
    { when: (s)=>!!s.flags["met_cas"], text: "At the flagstaff Cas is still on air, with his back to the wake and the lead of his microphone still plugged into nothing." },
    { say: "cas", alias: "Boy with a microphone", text: "\"…and we're into the closing minutes here on the stern deck. The wake is as straight as it has been all morning, the island is coming round onto the bow, and on the bollard the lady with the orange bows is about to address the nation.\"" },
    { when: (s)=>!(!!s.flags["met_marit"]), jump: "next_2" },
    {
      say: "marit",
      text: "\"**FRIENDS!** *ROMANS!* **COUNTRYMEN!** Lend me your ears — I'll give them *back* —\"",
      shake: true
    },
    {
      say: "marit",
      text: "\"**ACT ONE, SCENE LAST!** The *voyage ends!* The *island rises!* The *hero* — that is **YOU**, Rowan Vance — **steps ashore!**\"",
      shake: true
    },
    { say: "rowan", text: "\"Marit, please sit down. You're on a bollard.\"" },
    { say: "marit", text: "\"A bollard is a **PLINTH!**\"", shake: true },
    { when: (s)=>!(((s.vars["aff_marit"]||0)>=13)), jump: "next_4" },
    { text: "She drops, abruptly, out of the big voice, into the quick wry one." },
    {
      say: "marit",
      text: "\"I'm really glad you came to find me. I wasn't going to say that, there's a whole speech. It's got a pause in it. But you're here, and — it'd be silly not to say it.\""
    },
    {
      add: { aff_marit: 2 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "marit", n: 2, why: "Dropped the act for him" }); }
    },
    { label: "next_4" },
    { label: "end_3" },
    { jump: "end_1" },
    { label: "next_2" },
    {
      text: "A girl with two tall tufts of flame-orange hair, each tied up with an orange bow, is standing on a mooring bollard with her arms flung out, reciting at the island."
    },
    {
      say: "marit",
      alias: "Girl on a bollard",
      text: "\"**ACT ONE, SCENE LAST!** The voyage ends! The island RISES! And there — look! — a **STRANGER** on the stern deck, in a rain jacket, who has no idea what comes *next!*\"",
      shake: true
    },
    {
      say: "marit",
      alias: "Girl on a bollard",
      text: "\"Marit Solberg! Theatre kid **EXTRAORDINAIRE!** We have not met, and I already love you, I have *decided* you are the lead!\"",
      shake: true
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["marit"]) s.names["marit"] = "Marit Solberg"; if (io && io.popup && !s.flags["met_marit"]) io.popup({ type: 'met', id: "marit", name: "Marit Solberg" }); }
    },
    { flag: "met_marit" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["marit"] = s.notes["marit"] || []); if (a.indexOf("Treats everything as a stage. Narrates, loudly.") < 0) a.push("Treats everything as a stage. Narrates, loudly."); }
    },
    { say: "rowan", text: "\"Rowan. I'm not sure I'd know what to do with a lead.\"" },
    { say: "marit", text: "\"Nobody does! That's what *rehearsals* are for!\"", shake: true },
    { label: "end_1" },
    { when: (s)=>!(!!s.flags["met_sunny"]), jump: "next_7" },
    { say: "sunny", text: "\"Wildcard! Come and look at THIS, I'm going to have a heart attack.\"" },
    {
      text: "She has her feet up on the lowest rail bar and is pointing at the shallows, which are the colour of a swimming-pool advert."
    },
    {
      say: "sunny",
      text: "\"I can see the sand. From here. I can see the individual SHELLS. Do you know how long it's been since I was in water over a metre deep? Two days.\""
    },
    { say: "rowan", text: "\"Two days isn't that long.\"" },
    { say: "sunny", text: "\"It's an *eternity.*\"" },
    { jump: "end_6" },
    { label: "next_7" },
    {
      text: "A tall girl is sitting on the lowest bar of the rail with her bare feet dangling, a towel round her neck, grinning at the shallows as if they were an old friend."
    },
    {
      say: "sunny",
      alias: "Girl on the rail",
      text: "\"Hey, Wildcard! Hey! You see this? I can see the SAND from here. I can see individual SHELLS!\""
    },
    { say: "rowan", text: "\"Rowan. Hello.\"" },
    {
      say: "sunny",
      alias: "Girl on the rail",
      text: "\"Sunny Aldane. Lifeguard. Sports scholarship. I've been looking forward to a swim for two *days*, which I understand is not long, but it is to *me!*\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["sunny"]) s.names["sunny"] = "Sunny Aldane"; if (io && io.popup && !s.flags["met_sunny"]) io.popup({ type: 'met', id: "sunny", name: "Sunny Aldane" }); }
    },
    { flag: "met_sunny" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["sunny"] = s.notes["sunny"] || []); if (a.indexOf("Lifeguard on a sports scholarship. Says exactly what she thinks.") < 0) a.push("Lifeguard on a sports scholarship. Says exactly what she thinks."); }
    },
    { label: "end_6" },
    { when: (s)=>!s.flags["met_freddie"], text: "A girl with wet red hair and diving goggles pushed up on her forehead, a gold jacket with a white, gold-edged collar worn open over a swimsuit, is climbing the stern rail." },
    { when: (s)=>!!s.flags["met_freddie"], text: "Freddie is climbing the stern rail: wet red hair, diving goggles pushed up on her forehead, the gold jacket open over her swimsuit." },
    { when: (s)=>!(!!s.flags["met_freddie"]), jump: "next_10" },
    { say: "freddie", text: "\"Rowan! Jacketless! Hold this!\"" },
    { text: "She hands you the jacket without looking round, which is, you realise, an instruction." },
    {
      say: "freddie",
      text: "\"I've been timing it! Four hundred metres to the pier, a bit of a current, I can do it in eight minutes, easily. Eight and a half if the shark's about.\""
    },
    { say: "sunny", text: "\"Freddie. FREDDIE. Get down.\"" },
    { say: "freddie", text: "\"I've done the maths!\"" },
    { say: "sunny", text: "\"It's a *regulation*.\"" },
    { say: "freddie", text: "\"It's a very *short* regulation!\"" },
    { jump: "end_9" },
    { label: "next_10" },
    { say: "freddie", alias: "Girl with goggles on her head", text: "\"Hey! Jacketless! Hold this!\"" },
    { text: "She hands you the jacket without looking round, which is, you realise, an instruction." },
    {
      say: "freddie",
      alias: "Girl with goggles on her head",
      text: "\"I've been timing it! Four hundred metres to the pier, a bit of a current, eight minutes, easily. Eight and a half if the shark's about. Winifred Camara. Freddie. Hello!\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["freddie"]) s.names["freddie"] = "Winifred Camara"; if (io && io.popup && !s.flags["met_freddie"]) io.popup({ type: 'met', id: "freddie", name: "Winifred Camara" }); }
    },
    { flag: "met_freddie" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["freddie"] = s.notes["freddie"] || []); if (a.indexOf("Swimmer and diver. Wants to jump off the ship.") < 0) a.push("Swimmer and diver. Wants to jump off the ship."); }
    },
    { say: "sunny", alias: "Girl on the rail", text: "\"FREDDIE. Get *down*.\"" },
    { say: "freddie", alias: "Girl with goggles on her head", text: "\"It's a very short regulation!\"" },
    { label: "end_9" },
    {
      text: "The jacket is warm from the sun. The girl it belongs to is already halfway over the rail with one foot on the outer bar, and the sea is a long way down."
    },
    { say: "cas", alias: "Boy with a microphone", text: "\"A late entry at the stern rail. Goggles up, one foot outside the bar, four hundred metres of open water by her own figures. And the man in the rain jacket has been handed the jacket and, I'm afraid, the decision with it.\"" },
    {
      prompt: "What do you do?",
      choice: [
        { text: "\"Freddie, the captain will have your head. Come back over.\"", goto: "opt_13" },
        { text: "\"Go on, then. I'll hold the jacket.\"", goto: "opt_14" },
        { text: "Say nothing and hold out your hand for the goggles.", goto: "opt_15" }
      ]
    },
    { jump: "choiceend_12" },
    { label: "opt_13" },
    { say: "rowan", text: "\"Freddie, the captain will have your head. Come back over.\"" },
    { say: "freddie", text: "\"Oh, *you're* no fun. Neither of you is any fun. I've got *five brothers* at home for that.\"" },
    {
      text: "She comes back over the rail like a cat from a garden wall and lands on her feet beside Sunny, who is gripping the back of her swimsuit strap with an expression of pure loving violence."
    },
    { say: "sunny", text: "\"Thank you. I'd have caught her. I just didn't want to have to.\"" },
    {
      add: { aff_sunny: 2 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "sunny", n: 2, why: "Helped her stop Freddie" }); }
    },
    {
      add: { aff_freddie: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "freddie", n: 1, why: "Talked her down, kindly" }); }
    },
    { flag: "freddie_talked_down" },
    { jump: "choiceend_12" },
    { label: "opt_14" },
    { say: "rowan", text: "\"Go on, then. I'll hold the jacket.\"" },
    { say: "freddie", text: "\"YES! A *friend!*\"" },
    {
      text: "She is gone before the word has finished. A long, clean, glittering arc over the stern rail and a very small white splash a long way down."
    },
    {
      text: "From somewhere over the bridge wing comes the captain's voice, not on the loudspeaker this time, just a man at the end of his patience: \"THAT'S THIRTY-SEVEN. THAT'S THIRTY-SEVEN, AND NOT THIRTY-EIGHT, AND I WILL HAVE A WORD.\""
    },
    { say: "sunny", text: "\"I'm going in after her.\"" },
    { text: "She is already on the rail, towel and all." },
    { say: "sunny", text: "\"You — you're a *terrible* influence!\"" },
    { say: "rowan", text: "\"I'm very sorry.\"" },
    { say: "sunny", text: "\"Don't be! It's the *best* thing anyone's done all day!\"" },
    {
      text: "A whoop, a splash, and then two figures in the white water, one cheering, one swearing, both laughing."
    },
    { say: "cas", alias: "Boy with a microphone", text: "\"Two in the water! A clean entry from the first, an enthusiastic one from the second. The commentary box would like it on record that it advised nobody.\"" },
    {
      add: { aff_freddie: 4 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "freddie", n: 4, why: "Held the jacket" }); } },
    {
      add: { aff_sunny: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "sunny", n: 1, why: "Was a bad influence, in the best way" }); }
    },
    { flag: "freddie_jumped" },
    { exit: "freddie" },
    { exit: "sunny" },
    { jump: "choiceend_12" },
    { label: "opt_15" },
    { say: "freddie", text: "\"…Wait.\"" },
    { text: "She looks down at your outstretched hand, and then at you." },
    { say: "freddie", text: "\"That's not — you're after my *goggles*?\"" },
    { say: "rowan", text: "\"I'm holding them. So they don't fall in.\"" },
    { say: "freddie", text: "\"…That's actually the most responsible thing anyone's ever said to me.\"" },
    { text: "She comes back over the rail slowly, as if stepping out of a hot bath." },
    { say: "freddie", text: "\"I'm leaving you with a very strong opinion of me.\"" },
    {
      add: { aff_freddie: 2 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "freddie", n: 2, why: "Held the goggles, not the argument" }); }
    },
    { flag: "freddie_talked_down" },
    { jump: "choiceend_12" },
    { label: "choiceend_12" },
    { when: (s)=>!(!!s.flags["met_jessica"]), jump: "next_17" },
    { say: "jessica", text: "\"Rowan.\"" },
    {
      text: "She is the only person on the stern who is not in motion. She stands a little apart, with one ringed hand on the smallest of her caskets, and the gold chain at her throat catching the morning light."
    },
    { say: "jessica", text: "\"I wished to say, before we land, that it has been a pleasure to make the crossing with you.\"" },
    { say: "rowan", text: "\"The pleasure was mine, Jessica.\"" },
    { say: "jessica", text: "\"I shall hold you to that.\" A small, genuine smile. \"In writing, if necessary.\"" },
    {
      add: { aff_jessica: 1 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "jessica", n: 1, why: "Answered in kind" }); } },
    { jump: "end_16" },
    { label: "next_17" },
    { text: "A girl with a gold chain at her throat is standing a little apart from the commotion with one ringed hand on a small leather casket." },
    { text: "A small swallow charm hangs from the chain. Her face wears a look of patient serenity, like a lamp that has not yet been told it is the only light in the room." },
    {
      say: "jessica",
      alias: "Girl with the caskets",
      text: "\"You are watching the water. So am I. It is a pleasant thing to share.\""
    },
    { text: "She does not turn her head." },
    {
      say: "jessica",
      alias: "Girl with the caskets",
      text: "\"Jessica Montclair. I should offer my hand, but it is busy, and the casket does not like to be left.\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["jessica"]) s.names["jessica"] = "Jessica Montclair"; if (io && io.popup && !s.flags["met_jessica"]) io.popup({ type: 'met', id: "jessica", name: "Jessica Montclair" }); }
    },
    { flag: "met_jessica" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["jessica"] = s.notes["jessica"] || []); if (a.indexOf("Formal and gracious. Will not leave her casket.") < 0) a.push("Formal and gracious. Will not leave her casket."); }
    },
    { label: "end_16" },
    { when: (s)=>!(!!s.flags["met_ashton"]), jump: "next_20" },
    { say: "ashton", text: "\"Vance! Rescue me.\"" },
    {
      text: "He is, as before, at the rail with a rose in one hand, and a look of tender intent aimed squarely at Jessica's profile."
    },
    {
      say: "ashton",
      text: "\"I have prepared a speech. It has four paragraphs and a joke about gulls. She has looked at the sea for fourteen minutes. I think I'm making progress.\""
    },
    { say: "rowan", text: "\"You're not.\"" },
    { say: "ashton", text: "\"I am, old thing! I'm ten per cent less ignored than I was at breakfast.\"" },
    { jump: "end_19" },
    { label: "next_20" },
    {
      text: "A tall boy with violet hair swept into a smooth dome is standing at the rail with a single red rose, and the thorn of it pinched between finger and thumb of his other hand. His whole attention is directed at the girl with the gold chain."
    },
    {
      say: "ashton",
      alias: "Boy with a rose",
      text: "\"Ashton Beaumont-Lyle. You'll know the name. If you don't, nobody does.\" He does not look round. \"I'm told you are the entrant in ink. I have prepared a speech for the lady. It has four paragraphs and a joke about gulls.\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["ashton"]) s.names["ashton"] = "Ashton Beaumont-Lyle"; if (io && io.popup && !s.flags["met_ashton"]) io.popup({ type: 'met', id: "ashton", name: "Ashton Beaumont-Lyle" }); }
    },
    { flag: "met_ashton" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["ashton"] = s.notes["ashton"] || []); if (a.indexOf("Carries a rose, and a four-paragraph speech for the girl with the caskets.") < 0) a.push("Carries a rose, and a four-paragraph speech for the girl with the caskets."); }
    },
    { label: "end_19" },
    { when: (s)=>!s.flags["met_rafa"], text: "A round-faced, broad-shouldered boy in a chef's bandana, with a green stalk going from one corner of his mouth to the other, is working his way along the rail with an onion crate on his hip, taking tin mugs out of people's hands." },
    { when: (s)=>!!s.flags["met_rafa"], text: "Rafa is working his way along the rail with an onion crate on his hip, taking tin mugs out of people's hands. The green stalk has changed sides again." },
    { say: "rafa", alias: "Boy in a chef's bandana", text: "\"Mugs, please. Mugs. I promised the lady downstairs every one of them back, and I am two short and not looking at the sea.\"" },
    { text: "He takes one off the rail at Ashton's elbow, looks into it, and then at Ashton, with professional sorrow." },
    { say: "rafa", alias: "Boy in a chef's bandana", text: "\"Half. A speech in four paragraphs, and the man stops at half a mug. This is why she is looking at the water.\"" },
    { when: (s)=>!!s.flags["rafa_fed_rowan"], say: "rafa", alias: "Boy in a chef's bandana", text: "\"Rowan.\" The same look goes over you, and comes back better pleased. \"One mug better than this morning. On land I find you something you have to chew.\"" },
    { when: (s)=>!(!!s.flags["met_victoria"]), jump: "next_23" },
    { say: "victoria", text: "\"Rowan.\"" },
    {
      text: "She is sitting on the dry bench under the striped awning with her parasol open, although the awning is already doing the parasol's work."
    },
    {
      say: "victoria",
      text: "\"I have finished looking at the wake. It has become the sea. I should like to look at the island now.\""
    },
    { say: "rowan", text: "\"Would you like me to stand somewhere?\"" },
    {
      say: "victoria",
      text: "\"No. Sit, if you wish.\" A pause. \"It is a very large island. I should like company in looking at it.\""
    },
    {
      text: "You sit. Neither of you says anything for most of a minute, and it is, to your surprise, the best conversation you have had all morning."
    },
    {
      add: { aff_victoria: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "victoria", n: 2, why: "Sat with her" }); } },
    { jump: "end_22" },
    { label: "next_23" },
    {
      text: "On the dry bench under the awning a girl in a ruffled dress is sitting with a lace parasol open over her head, although she is already in the shade. Her wide sky-blue eyes are on the island, and her lips are moving very slightly, as if she were counting."
    },
    {
      say: "victoria",
      alias: "Girl with a parasol",
      text: "\"Forty-one.\" She turns her head, slowly. \"I was counting the palm trees on the nearest slope. There are forty-one. I wished to know. Victoria Capulet.\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["victoria"]) s.names["victoria"] = "Victoria Capulet"; if (io && io.popup && !s.flags["met_victoria"]) io.popup({ type: 'met', id: "victoria", name: "Victoria Capulet" }); }
    },
    { flag: "met_victoria" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["victoria"] = s.notes["victoria"] || []); if (a.indexOf("Speaks slowly and exactly. Sits under a parasol even in the shade.") < 0) a.push("Speaks slowly and exactly. Sits under a parasol even in the shade."); }
    },
    { say: "rowan", text: "\"Rowan. That's a good number.\"" },
    { say: "victoria", text: "\"Thank you. I think so as well.\"" },
    { label: "end_22" },
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
    PHOTO("rowan_arrival", "Rowan with the arrival face", { who: ["rowan"] }),
    PHOTO("arrival_twelve", "Twelve people with the same face as the island arrives", { who: [], off: true }),
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
    PHOTO("rowan_arrival", "Rowan in front of the lifeboat as the island arrives", { who: ["rowan"] }),
    PHOTO("arrival_twelve", "Twelve people with the same face as the island arrives", { who: [], off: true }),
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["pippa"]) s.names["pippa"] = "Pippa Lund"; if (io && io.popup && !s.flags["met_pippa"]) io.popup({ type: 'met', id: "pippa", name: "Pippa Lund" }); }
    },
    { flag: "met_pippa" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["pippa"] = s.notes["pippa"] || []); if (a.indexOf("Photographs everyone. Film only.") < 0) a.push("Photographs everyone. Film only."); }
    },
    { label: "end_1" },
    { when: (s)=>!(!!s.flags["met_georgie"]), jump: "next_5" },
    { text: "Georgie is standing on the lowest rung of the lifeboat ladder, with a deck box in one hand and the green dragon plush in the other, and her eyes are enormous." },
    { text: "She has not said anything, but she is smiling, a small, astonished, private smile, the way you smile when you are alone with a thing you love." },
    {
      say: "georgie",
      text: "\"Hi, Rowan.\" Barely audible. \"Ember's looking.\" The green plush dragon is held up to the rail. \"She's never — she's never seen an island. It's — it's bigger than the pictures. Is that normal?\""
    },
    { say: "rowan", text: "\"I think that's what an island's meant to be like.\"" },
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
    { say: "georgie", alias: "Girl with the plush dragon", text: "\"…Sorry. Is this your ladder?\"" },
    { say: "rowan", text: "\"No, it's anybody's. I'm Rowan.\"" },
    {
      say: "georgie",
      alias: "Girl with the plush dragon",
      text: "\"Georgie. Santa. Georgie Santa.\" She looks at the plush. \"This is Ember. She's — she hasn't seen the island.\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["georgie"]) s.names["georgie"] = "Georgie Santa"; if (io && io.popup && !s.flags["met_georgie"]) io.popup({ type: 'met', id: "georgie", name: "Georgie Santa" }); }
    },
    { flag: "met_georgie" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["georgie"] = s.notes["georgie"] || []); if (a.indexOf("Very shy. Carries a dragon plush named Ember.") < 0) a.push("Very shy. Carries a dragon plush named Ember."); }
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
      text: "\"BRANDEN SUNFLOWER. I CAN SEE YOU. I HAVE SEEN YOU SINCE THE FUNNEL. I AM A CAPTAIN. MY WHOLE JOB IS SEEING.\""
    },
    { say: "branden", text: "\"…Technically it's an *exercise*.\"" },
    { when: (s)=>!(!!s.flags["branden_prank_buddy"]), jump: "next_10" },
    { say: "branden", text: "\"Rowan! Tell him it's an exercise! You timed it! You're my WITNESS!\"" },
    { say: "rowan", text: "\"I timed it, Captain. It was eleven seconds.\"" },
    { name: "Captain Stroud", text: "Eleven seconds is a *record*, young man. Put it back." },
    {
      add: { aff_branden: 2 }
    },
    { run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "branden", n: 2, why: "Stood up for him" }); } },
    { jump: "end_9" },
    { label: "next_10" },
    { say: "branden", text: "\"…It's fine. It's FINE. Put it back. I know.\"" },
    { label: "end_9" },
    { jump: "end_7" },
    { label: "next_8" },
    {
      text: "A small boy with flame-orange spikes of hair is holding a lifebuoy over his head, and is, with great delicacy, not looking up at the bridge wing."
    },
    {
      say: "branden",
      alias: "Flame-haired kid",
      text: "\"Nobody saw! Nobody saw anything! I have a lifebuoy and a clean conscience!\""
    },
    {
      name: "Captain Stroud",
      text: "\"YOU, SIR. WITH THE HAIR. I CAN SEE YOU. I HAVE SEEN YOU SINCE THE FUNNEL. I AM A CAPTAIN. MY WHOLE JOB IS SEEING.\""
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
    { when: (s)=>!s.flags["met_maisie"], text: "A girl in oil-stained overalls, with a black jacket knotted round her waist and welding goggles holding back a great deal of copper-brown hair, has walked straight past him to the empty bracket on the rail, and is running a thumb along it." },
    { when: (s)=>!!s.flags["met_maisie"], text: "Maisie has walked straight past him to the empty bracket on the rail, and is running a thumb along it." },
    { say: "maisie", alias: "Girl in welding goggles", text: "\"No wonder it came away so easy. Spring's gone, look. That's not theft, love, that's gravity with a helper.\"" },
    { text: "She takes a screwdriver out of her hair and has the bracket tight again in four turns. The buoy will now have to be put back properly, which she seems to regard as the whole point." },
    { when: (s)=>!(!!s.flags["met_rana"]), jump: "next_14" },
    {
      text: "On the top step of the iron stair to the wheelhouse, a girl with two long blonde braids, each one tied off with a big red bow, is sitting, knees drawn up, with her back to the crowd and her eyes on the island."
    },
    { when: (s)=>!(((s.vars["aff_rana"]||0)>=11)), jump: "next_16" },
    { say: "rana", text: "\"…Hey.\"" },
    { say: "rowan", text: "\"Hey.\"" },
    { say: "rana", text: "\"Don't tell me it's pretty.\"" },
    { say: "rowan", text: "\"I wasn't going to.\"" },
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
    { say: "rana", text: "\"…What.\"" },
    { say: "rowan", text: "\"Just standing.\"" },
    { say: "rana", text: "\"Fine.\" A pause. \"Don't talk.\"" },
    { label: "end_15" },
    { jump: "end_13" },
    { label: "next_14" },
    {
      text: "On the top step of the iron stair to the wheelhouse a girl is sitting with her knees drawn up and her back to the crowd. Her hair hangs in two long blonde braids with big red bows, and her eyes are on the island."
    },
    { say: "rana", alias: "Scowling girl", text: "\"…No.\"" },
    { say: "rowan", text: "\"I haven't said anything.\"" },
    { say: "rana", alias: "Scowling girl", text: "\"Rana. That's all you get.\"" },
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
    { say: "teobalt", text: "\"I am at thirty-one. I shall need you at thirty-two.\"" },
    { when: (s)=>!(!!s.flags["has_unloading_list"]), jump: "next_22" },
    {
      say: "teobalt",
      text: "\"The list is holding. The duffels will come off first, the trunks second, and the tuba third. I believe the order is correct. I will accept corrections until the gangway.\""
    },
    { say: "rowan", text: "\"No corrections. There's still a lot of teal.\"" },
    { say: "teobalt", text: "\"The teal is mostly the tuba.\" A small, bright pleasure. \"Thank you for noticing it.\"" },
    {
      add: { aff_teobalt: 1 }
    },
    {
      run: (s,io)=>{ if (io && io.popup) io.popup({ type: 'aff', id: "teobalt", n: 1, why: "Noticed the teal" }); }
    },
    { jump: "end_21" },
    { label: "next_22" },
    {
      say: "teobalt",
      text: (s) => ({ first: "\"I have drawn up an unloading order. You are first. It is alphabetical. Please do not let it go to your head; it is not a merit.\"",
        front: "\"I have drawn up an unloading order. You are near the front. It is alphabetical. You may thank your surname; I had no part in it.\"",
        middle: "\"I have drawn up an unloading order. You are in the middle. It is alphabetical. It is the most restful place on any list.\"",
        end: "\"I have drawn up an unloading order. You are near the end. I am sorry. It is nothing personal. It is alphabetical.\"",
        last: "\"I have drawn up an unloading order. You are last. I am sorry. It is nothing personal. It is alphabetical.\"" })[ALPHA(s).where]
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
      text: "\"Twenty-four. Twenty-five. Excuse me — you are in the way of the count. Not unkindly. It is a *fact*. Teobalt Fullington. I am making a list of the order in which we leave.\""
    },
    {
      run: (s,io)=>{ s.names = s.names || {}; if (!s.names["teobalt"]) s.names["teobalt"] = "Teobalt Fullington"; if (io && io.popup && !s.flags["met_teobalt"]) io.popup({ type: 'met', id: "teobalt", name: "Teobalt Fullington" }); }
    },
    { flag: "met_teobalt" },
    {
      run: (s)=>{ s.notes = s.notes || {}; const a = (s.notes["teobalt"] = s.notes["teobalt"] || []); if (a.indexOf("Makes lists. Organises everything.") < 0) a.push("Makes lists. Organises everything."); }
    },
    { say: "rowan", text: "\"Rowan. How am I doing?\"" },
    { say: "teobalt", text: (s) => ({ first: "\"You are first. It is alphabetical. It is not a merit.\"", front: "\"You are near the front. It is alphabetical. It is not a merit.\"",
      middle: "\"You are in the middle. It is alphabetical. It is the most restful place on a list.\"", end: "\"You are near the end. It is alphabetical. It is nothing personal.\"",
      last: "\"You are last. It is alphabetical. It is nothing personal.\"" })[ALPHA(s).where] },
    { label: "end_19" },
    { when: (s)=>!s.flags["met_leona"], text: "A yard from his elbow, in plain view, a girl with mousy-brown hair and a canvas satchel with a broken buckle is waiting to be counted. He counts the crate beside her." },
    { when: (s)=>!!s.flags["met_leona"], text: "A yard from his elbow, in plain view, Leona is waiting to be counted. He counts the crate beside her." },
    { say: "leona", alias: "Girl with a satchel", text: "\"He has counted me twice and missed me three times. I think it comes out even.\"" },
    { when: (s)=>!(!!s.flags["met_pippa"]), jump: "next_26" },
    { text: "Pippa jumps off the crate with the camera held out in front of her like a lantern." },
    {
      say: "pippa",
      text: "\"Right! Everybody! Group photo! Everybody who's here! Georgie, you're at the front. Branden, drop the buoy. Rana — Rana, I can see your elbow, I'll take it. Teobalt, stand — no, you're fine, you're fine, you're always fine.\""
    },
    { when: (s)=>!(!!s.flags["pippa_photo_promised"]), jump: "next_28" },
    {
      say: "pippa",
      text: "\"And Rowan, you're in the middle, because you've earned it. I said you'd get a photograph. Well, now you're in one.\""
    },
    { label: "next_28" },
    { label: "end_27" },
    { when: (s)=>!s.flags["met_freya"], text: "The photograph has been gathering people the way a gutter gathers rain. In the back row a very long girl with an ice-blonde braid has arrived holding a paperback flat on top of her head, like a roof against the sun." },
    { when: (s)=>!!s.flags["met_freya"], text: "The photograph has been gathering people the way a gutter gathers rain. In the back row Freya has arrived, holding the paperback flat on top of her head, like a roof against the sun." },
    { when: (s)=>!s.flags["met_fiona"], text: "At the end of the line a girl in black lace comes to a halt under a black parasol, exactly where the shadow of the funnel stops." },
    { when: (s)=>!!s.flags["met_fiona"], text: "At the end of the line Fiona comes to a halt under the black parasol, exactly where the shadow of the funnel stops." },
    { say: "pippa", text: "\"Parasol! Could you smile? Only a bit. Only on one side.\"" },
    { say: "fiona", alias: "Girl in black lace", text: "\"No. I shall stand very still instead. It is the same service, and it lasts longer.\"" },
    { when: (s)=>!s.flags["met_trixie"], text: "The girl beside her is finding stillness a good deal harder. Yellow-striped socks, two bunches of honey-blonde hair, up on her toes and off them again — and one finger held out dead level, with something very small walking along it." },
    { when: (s)=>!!s.flags["met_trixie"], text: "Beside her Trixie is finding stillness a good deal harder: up on her toes and off them again, with one finger held out dead level for Belinda." },
    { when: (s)=>!s.flags["met_hedda"], text: "A megaphone comes up over the front row. Somewhere underneath it there is a crown of wildflowers." },
    { when: (s)=>!!s.flags["met_hedda"], text: "A megaphone comes up over the front row. Somewhere underneath it there is Hedda." },
    { when: (s)=>!s.flags["hedda_signed"], say: "hedda", alias: "Girl with a petition", text: "\"AFTER THE PHOTOGRAPH NOBODY LEAVES WITHOUT SIGNING! THE PEN IS ON A STRING! IT CAN'T GET AWAY EITHER!\"" },
    { when: (s)=>!!s.flags["hedda_signed"], say: "hedda", alias: "Girl with a petition", text: "\"AFTER THE PHOTOGRAPH NOBODY LEAVES WITHOUT SIGNING! — Not you, Vance. You're on the page. Stand there and look signed.\"" },
    { say: "pippa", text: "\"Everyone say — I don't know — 'island'!\"" },
    { text: "All of you, awkwardly, in a ragged line, say \"island.\"" },
    { text: "Click." },
    PHOTO("arrival_group", "Group photo amidships as the island arrives: everyone says \"island\"", { who: ["rowan", "georgie", "branden", "rana", "teobalt", "freya", "fiona", "trixie", "hedda"] }),
    {
      choice: [
        { text: "\"Wait. Give me the camera. You should be in one.\"", goto: "opt_30" },
        { text: "Smile for the picture and say nothing else.", goto: "opt_31" }
      ]
    },
    { jump: "choiceend_29" },
    { label: "opt_30" },
    { say: "rowan", text: "\"Wait. Give me the camera. You should be in one.\"" },
    { say: "pippa", text: "\"Hm?\"" },
    { text: "The camera does not move for a moment, and then, very slowly, it comes down." },
    { say: "pippa", text: "\"…What?\"" },
    {
      say: "rowan",
      text: "\"You're in none of these. You've shot twelve people. I want one of you. In front of the island. Here.\""
    },
    PHOTO("arrival_twelve", "Twelve people with the same face as the island arrives", { who: [], off: true }),
    { say: "pippa", text: "\"That's — nobody ever — it's a rule. There's always one person behind the —\"" },
    {
      text: "She stops. She looks at the camera, and at you, and at the lifeboat ladder behind her, where Georgie has stopped breathing."
    },
    { say: "pippa", text: "\"…Okay. Okay. Just — don't do anything clever. Just — hold it straight.\"" },
    {
      text: "You take the camera. It is heavier than you expected, with a cold brass weight that fits the heel of the hand. You look through the viewfinder. A freckled girl in a yellow bow tie is standing in front of an island, trying, with enormous effort, not to pose."
    },
    { say: "rowan", text: "\"Don't try. Just look at the island.\"" },
    { text: "She looks at it. Her face does something you cannot name, and you press the shutter." },
    { text: "Click." },
    PHOTO("pippa_by_rowan", "Pippa in front of the island, trying not to pose (taken by Rowan, with her camera)", { who: ["pippa"] }),
    { say: "pippa", text: "\"…\" She is very quiet. \"Is that — how did it look?\"" },
    { say: "rowan", text: "\"Like you.\"" },
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
    { say: "pippa", text: "\"Perfect. Lovely. *Everyone* looks good when the island arrives. It's a rule.\"" },
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
      text: "\"Right! Everybody! Group photo! Georgie, you're at the front. Everyone say 'island'!\""
    },
    { text: "All of you, awkwardly, in a ragged line, say \"island.\" Click." },
    PHOTO("arrival_group", "Group photo amidships as the island arrives: everyone says \"island\"", { who: ["rowan", "georgie"] }),
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
    { text: "Everyone on board has come to the rails." },
    { text: "You look along them, bow to stern, because for once they are all in one place." },
    { text: "In the point of the bow the wide-brimmed hat has at last looked up from its compass." },
    { text: "Beside the trunks a boy with a scar stands as if on parade, and a long black coat streams past a broken nose that is pretending not to see it. And on the nearest bench a grey blanket, which — you watch it happen — sits up." },
    { say: "dmitri", alias: "Boy under a blanket", text: "\"…So. It is true. There is an island.\"" },
    { text: "Amidships the photograph has come apart into a ragged line along the rail, with a pair of striped socks bobbing up on tiptoe at the end of it." },
    { text: "On the saloon stairs a red pen has, for once, got its cap on, and a wine-red beret has turned round to face the island. Aft, a chef's bandana is bent over a crate of tin mugs, counting them, and then looks up and counts heads instead." },
    { ...PHOTO("arrival_group", "Group photo amidships as the island arrives: everyone says \"island\"", { who: ["georgie", "branden", "rana", "teobalt", "freya", "fiona", "trixie", "hedda"], off: true }), when: (s)=>!s.flags["arr_mid"] },
    { when: (s)=>!!s.flags["eloise_time_promise"]&&!s.flags["eloise_time_kept"], think: "I told Eloise I'd say when we were nearly in. Somebody has turned her round. It wasn't me." },
    { when: (s)=>!s.flags["freddie_jumped"], text: "Thirty-eight, counting you. Red, gold and black, and one rain jacket." },
    { when: (s)=>!!s.flags["freddie_jumped"], text: "Thirty-eight came aboard, counting you. The rails hold thirty-six; the other two are dark heads in the water off the quarter, racing the ship to the pier. Red, gold and black, and one rain jacket with a gold one over its arm." },
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
      text: "\"THERE! THE PIER! Everybody look at the PIER! There's people on the pier! They're WAVING!\"",
      mood: "laughing"
    },
    { say: "baylee", text: "\"It's the welcome.\"" },
    { say: "nathan", text: "\"WELCOME!!\"", mood: "grin" },
    { when: (s)=>!(!!s.flags["met_georgie"]), jump: "next_14" },
    {
      say: "georgie",
      text: "\"…They're very far away. They're — they're waving at us. All of us.\" A tiny pause. \"Is that all right? To be waved at?\""
    },
    { say: "pippa", alias: "Girl with a camera", text: "\"It's the best part. You wave back.\"" },
    {
      text: "Georgie raises one hand an inch off the rail, and holds it there as if she were checking whether it would be taken away."
    },
    { label: "next_14" },
    { label: "end_13" },
    { say: "trixie", alias: "Girl in striped socks", text: "\"Wave slowly, though! Everybody, slowly! There's somebody very small on board who's never seen land before!\"" },
    { when: (s)=>!(!!s.flags["met_ed"]), jump: "next_16" },
    {
      say: "ed",
      text: "\"They've got a CABLE CAR! Does it go over the volcano? Can we go on it? Can we go on it TODAY?\""
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
    { say: "freya", alias: "Girl under a book", text: "\"It is too warm, and it is not yet eleven. I intend to complain about this island for years.\"" },
    { when: (s)=>!(!!s.flags["met_marit"]), jump: "next_20" },
    {
      say: "marit",
      text: "\"**FIN!** *CURTAIN!* **THE SEA PARTS, AND THE HEROES ARRIVE!** I am going to cry. I'm *prepared* to cry. I have a *handkerchief* —\"",
      shake: true
    },
    { label: "next_20" },
    { label: "end_19" },
    { when: (s)=>!(!!s.flags["met_branden"]), jump: "next_22" },
    {
      say: "branden",
      text: "\"I'm going to be the first one off the gangway! I've decided! I'll hold the rail! No-one will stop me!\""
    },
    { say: "baylee", text: "\"I'll be on the gangway.\"" },
    { say: "branden", text: "\"…I'll be the *second* one off.\"" },
    { label: "next_22" },
    { label: "end_21" },
    {
      text: "The engine falls from a thrum to a murmur. The pier swings round, huge and brown, and all at once you can see individual planks, each with its own bleach of salt, and each stained in its own particular way by forty years of boots."
    },
    { when: (s)=>(s.vars["ferry_talked"]||0)>=6, jump: "next_24" },
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
