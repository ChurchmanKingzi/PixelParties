// Pixel Academy — Kampagne, Tag 1 (Überfahrt und Ankunft auf Caldera Key).
// Stand aus dem Artefakt „Academy Playtest“. Dieser Unterordner wird vom Spiel noch NICHT geladen (der Server listet nur die Dateien direkt in scenes/).
// Beim Übertragen: helpers.story (= { world, scenes }) und helpers.data (Personen, Bezeichnungen; siehe data.json) muss der Lader bereitstellen;
// io.popup({ type: 'aff' | 'met' | 'deck', … }) ist optional (ohne es entfallen nur die Einblendungen).
// Der Runner muss Texte als Funktion erlauben (text: (s) => …, ausgewertet mit dem Spielstand) und beim card-Schritt die Seltenheit (rarity) beachten; s.deck = Rowans aktuelles Deck, s.owned = Sammlung je Seltenheit.
const { AFF, MET, DECK, NOTE, REL, PHOTO, DECKCOUNT, WORDS } = helpers;
scene("ferry_maisie", {
  steps: [
    { when: (s)=>!!s.flags["met_maisie"], jump: "again" },
    { text: "The port side is a narrow walkway under the lifeboats, out of the worst of the wind. Halfway along it a girl in oil-stained overalls is standing on an upturned bucket with her arm up to the elbow in a bulkhead lamp. The lamp's wire cage hangs open. A black jacket is knotted round her waist by the sleeves, and a pair of welding goggles is holding back a great deal of copper-brown hair." },
    { text: "The lamp is on, in broad daylight. It is also ticking." },
    { say: "maisie", alias: "Girl in welding goggles", text: "\"Flickering since the harbour, this. Broad daylight, sun out, and it's sat there going tick, tick, tick like it wants a word with somebody.\"" },
    { say: "maisie", alias: "Girl in welding goggles", text: "\"You're in me light, love.\" She has not looked round. \"No, don't move. I'm lying. You're not.\"" },
    { choice: [
      { text: "\"Are you allowed to take the ship apart?\"", steps: [
        { say: "rowan", text: "\"Are you allowed to take the ship apart?\"" },
        { say: "maisie", alias: "Girl in welding goggles", text: "\"Allowed's a strong word. Nobody said I couldn't. Nobody was up.\"" },
        { say: "maisie", alias: "Girl in welding goggles", text: "\"And I'm not taking it apart, I'm having a look. Taking apart's when there's bits left over.\"" },
        { say: "rowan", text: "\"Are there bits left over?\"" },
        { text: "She opens her free hand. Two screws and a washer." },
        { say: "maisie", alias: "Girl in welding goggles", text: "\"Not yet.\"" },
        AFF("maisie", 1, "Fair question, fairly asked")
      ] },
      { text: "\"What's wrong with it?\"", hint: "Curious", steps: [
        { say: "rowan", text: "\"What's wrong with it?\"" },
        { text: "Now she looks round. Freckles, a smear of something grey on one cheek, and the expression of a person who has been waiting all morning for exactly that question." },
        { say: "maisie", alias: "Girl in welding goggles", text: "\"Contact's furred up. Salt gets in, see, goes green, and then the poor thing can't decide if it's on or off.\"" },
        { say: "maisie", alias: "Girl in welding goggles", text: "\"It's not broken. It's confused. There's a difference, and nobody ever checks.\"" },
        AFF("maisie", 2, "Asked what was wrong")
      ] },
      { text: "Hold the lamp cage steady for her.", hint: "Quiet", steps: [
        { text: "The wire cage swings with the ship and catches her on the elbow, and by the look of the elbow not for the first time. You put a hand under it and hold it still." },
        { say: "maisie", alias: "Girl in welding goggles", text: "\"Ooh. Ta. Stay exactly there.\"" },
        { text: "A scrape, a small click. She works for a moment in silence." },
        { say: "maisie", alias: "Girl in welding goggles", text: "\"You did that without being asked. D'you know how rare that is? Me dad'd have watched it hit me and then told me it had hit me.\"" },
        AFF("maisie", 2, "Held the cage")
      ] }
    ] },
    { say: "maisie", alias: "Girl in welding goggles", text: "\"Hold that a sec.\" Two screws and a washer land in your palm, warm from hers. \"Don't drop 'em. The sea's had enough off me today, it had my good pencil at the gangway.\"" },
    { say: "maisie", alias: "Girl in welding goggles", text: "\"Maisie Voltage. Table tech — black jacket, when I've got it on.\" She nods down at the knotted sleeves, then at you. \"And you've not got one at all.\"" },
    MET("maisie", "Maisie Voltage"),
    { flag: "maisie_ferry_met" },
    { choice: [
      { text: "\"Rowan Vance. They're still finding me one.\"", steps: [
        { say: "rowan", text: "\"Rowan Vance. They're still finding me one.\"" },
        { say: "maisie", text: "\"Still *finding* — it's a jacket, not a kidney.\"" },
        { say: "maisie", text: "\"Well. More room for your arms. Pleased to meet you, Rowan.\"" }
      ] },
      { text: "\"Voltage? Is that your real name?\"", steps: [
        { say: "rowan", text: "\"Voltage? Is that your real name?\"" },
        { say: "maisie", text: "\"On the birth certificate and everything. Me dad says it's destiny. Me mum says it's why she nearly didn't marry him.\"" },
        { say: "rowan", text: "\"Rowan Vance. Nothing on mine but the name.\"" },
        { say: "maisie", text: "\"That's a proper name, that. You could be a solicitor with that.\"" }
      ] },
      { text: "\"Rowan Vance. Table tech — you mend the holo-tables?\"", steps: [
        { say: "rowan", text: "\"Rowan Vance. Table tech — you mend the holo-tables?\"" },
        { say: "maisie", text: "\"Mend 'em, build 'em, find out why they do what they do. Mostly the last one.\"" },
        { say: "maisie", text: "\"Nobody ever tells you why, Rowan. You have to open it and ask it yourself.\"" },
        AFF("maisie", 1, "Knew what table tech is")
      ] }
    ] },
    { text: "The ticking stops. The lamp burns steady, a pale and entirely pointless yellow in the morning sun." },
    { say: "maisie", text: "\"There. Look at that. Happy as anything.\" She pats the bulkhead the way you would pat a horse. \"Screws, please.\"" },
    { text: "You hand them up one at a time. The cage goes back on before she so much as glances at her work." },
    { say: "maisie", text: "\"What d'you play, then? Go on. I'm nosy, and I've a screwdriver in me hand.\"" },
    { choice: [
      { text: "\"Online, mostly. I've never sat at a real table.\"", hint: "Honest", steps: [
        { say: "rowan", text: "\"Online, mostly. I've never sat at a real table.\"" },
        { say: "maisie", text: "\"*Never?* Oh, you're in for it. The table's half the game. It hums at you. The good ones hum in tune.\"" },
        { say: "maisie", text: "\"I'll show you where the fan is on yours. Everybody should know where their fan is.\"" },
        AFF("maisie", 2, "Told her straight")
      ] },
      { text: "\"Whatever wins. What about you?\"", steps: [
        { say: "rowan", text: "\"Whatever wins. What about you?\"" },
        { say: "maisie", text: "\"Robots that run on credit. Brilliant until the bill arrives, same as me dad's van.\"" },
        { say: "rowan", text: "\"Does the bill arrive?\"" },
        { say: "maisie", text: "\"Every time.\" She says it with real affection. \"Trick is to have won by then.\"" },
        AFF("maisie", 1, "Asked about the bill")
      ] }
    ] },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"She FIXED the BOAT! Can you make it go FASTER?\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"Don't.\"" },
    { when: (s)=>!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"Good bucket.\"" },
    { add: { ferry_talked: 1 } },
    { time: 8 },
    { scene: "chat_maisie_ferry" },
    { end: true },
    { label: "again" },
    { text: "The bulkhead lamp is burning steady. Maisie has moved two yards down the walkway, bucket and all, and is giving a lifeboat davit the look she gave the lamp." },
    { say: "maisie", text: "\"Rowan! Don't lean on that.\" A pause. \"It's fine. It's completely fine. Just don't lean on it.\"" },
    { choice: [
      { text: "\"What have you found now?\"", when: (s)=>!s.flags["chat_maisie_ferry_done"], steps: [
        { say: "rowan", text: "\"What have you found now?\"" },
        { say: "maisie", text: "\"A hinge with opinions. It'll keep. Go on, what did you want?\"" },
        { scene: "chat_maisie_ferry" }
      ] },
      { text: "\"Is the lamp still behaving?\"", when: (s)=>!!s.flags["chat_maisie_ferry_done"], steps: [
        { say: "rowan", text: "\"Is the lamp still behaving?\"" },
        { say: "maisie", text: "\"Good as gold. I've said good morning to it twice. You have to keep on at them a bit, after, or they sulk.\"" }
      ] },
      { text: "Leave her to the davit.", steps: [
        { text: "You leave her to it. Behind you, something small and metal hits the deck, and a cheerful voice calls it a name." }
      ] }
    ] },
    { time: 3 }
  ]
});

scene("chat_maisie_ferry", {
  steps: [
    { label: "top" },
    { when: (s)=>!(s.flags["chat_maisie_ferry_1"] && s.flags["chat_maisie_ferry_2"] && s.flags["chat_maisie_ferry_3"]), jump: "menu" },
    { flag: "chat_maisie_ferry_done" },
    { say: "maisie", text: "\"Right, I've to see a hinge about a noise. Find me on the island, Rowan. I'll be wherever summat's ticking.\"" },
    { end: true },
    { label: "menu" },
    { choice: [
      { text: "\"Those are welding goggles. Did you bring them just for the ferry?\"", when: (s)=>!s.flags["chat_maisie_ferry_1"], steps: [
        { say: "rowan", text: "\"Those are welding goggles. Did you bring them just for the ferry?\"" },
        { say: "maisie", text: "\"They go where I go. Had 'em since I was eleven. They were too big then. I grew into them, or me head did.\"" },
        { choice: [
          { text: "\"What does an eleven-year-old weld?\"", steps: [
            { say: "rowan", text: "\"What does an eleven-year-old weld?\"" },
            { say: "maisie", text: "\"Owt she's told not to. Biscuit tins, mostly.\"" }
          ] },
          { text: "\"Where does an eleven-year-old get welding goggles?\"", steps: [
            { say: "rowan", text: "\"Where does an eleven-year-old get welding goggles?\"" },
            { say: "maisie", text: "\"Off a hook in a shed, when nobody's looking. Then you get told off, and then you get given 'em, because it's cheaper than a new pair of eyes.\"" }
          ] }
        ] },
        { say: "maisie", text: "\"Me dad's got a scrapyard. Sheffield. Dead tellies up to the roof, it was the best place in the world to be small in.\"" },
        { say: "maisie", text: "\"First thing I ever built was a projector. Car headlamp, biscuit tin, a lens out of some old feller's glasses. Threw a picture of our dog on the side of a van, big as a house.\"" },
        { choice: [
          { text: "\"Did it work?\"", steps: [
            { say: "rowan", text: "\"Did it work?\"" },
            { say: "maisie", text: "\"For eleven seconds. Then the tin got hot and the dog went brown at the edges.\"" },
            { say: "maisie", text: "\"Best eleven seconds of me life, that. I've been after the twelfth ever since.\"" }
          ] },
          { text: "\"What did your dad say?\"", steps: [
            { say: "rowan", text: "\"What did your dad say?\"" },
            { say: "maisie", text: "\"He said, 'That's coming out of your pocket money.'\"" },
            { say: "maisie", text: "\"And then he stood and watched it a good long while before he said owt else. So I knew.\"" }
          ] }
        ] },
        AFF("maisie", 2, "Asked about the goggles"),
        NOTE("maisie", "Grew up in her father's scrapyard in Sheffield and built her first projector from a car headlamp at eleven."),
        { flag: "chat_maisie_ferry_1" },
        { time: 3 }
      ] },
      { text: "\"Table tech. What do you actually want to do with it?\"", when: (s)=>!s.flags["chat_maisie_ferry_2"], steps: [
        { say: "rowan", text: "\"Table tech. What do you actually want to do with it?\"" },
        { text: "Her hands stop moving. It is the first time you have seen them do that." },
        { say: "maisie", text: "\"Oh, now. You've seen a holo-table going? On a screen, even?\"" },
        { say: "rowan", text: "\"On streams.\"" },
        { say: "maisie", text: "\"Right. So the Hero comes up, and the Hero's flat. It flickers. Walk round the side and there's nowt there. Every hologram I've ever seen is a lantern slide with ambitions.\"" },
        { say: "maisie", text: "\"I want one you can shake hands with.\" Slowly, as if the words might spill." },
        { choice: [
          { text: "\"Solid light? Is that even possible?\"", steps: [
            { say: "rowan", text: "\"Solid light? Is that even possible?\"" },
            { say: "maisie", text: "\"Nobody's ever told me why not, and I've asked. 'It just isn't, Maisie.' That's not a reason. That's a teacher wanting his dinner.\"" }
          ] },
          { text: "\"Why hands?\"", steps: [
            { say: "rowan", text: "\"Why hands?\"" },
            { say: "maisie", text: "\"Because that's how you know a thing's there. Your eyes'll be lied to all day and thank you for it. Hands won't have it.\"" }
          ] },
          { text: "\"The dog. You want to pat the dog off the side of the van.\"", when: (s)=>!!s.flags["chat_maisie_ferry_1"], hint: "From what she said", steps: [
            { say: "rowan", text: "\"The dog. You want to pat the dog off the side of the van.\"" },
            { text: "She looks at you for a second with her mouth slightly open." },
            { say: "maisie", text: "\"…Well, I do *now*. Bloody hell, Rowan. That's going on the list. That's going top.\"" },
            AFF("maisie", 1, "Remembered the dog")
          ] }
        ] },
        { say: "maisie", text: "\"Is it daft? You can say. I'd rather be told.\"" },
        { choice: [
          { text: "\"It's not daft. The way you say it, it's a when.\"", steps: [
            { say: "rowan", text: "\"It's not daft. The way you say it, it's a when.\"" },
            { say: "maisie", text: "\"It IS a when. Ta. I'm having that.\"" }
          ] },
          { text: "\"It's a bit daft. I'd still queue to see it.\"", hint: "Honest", steps: [
            { say: "rowan", text: "\"It's a bit daft. I'd still queue to see it.\"" },
            { say: "maisie", text: "\"Honest. Good.\" She grins. \"I'll put you down for the first handshake, then, and you can take it back to its face.\"" }
          ] }
        ] },
        AFF("maisie", 2, "Took the idea seriously"),
        NOTE("maisie", "Wants to build a hologram solid enough to shake hands with."),
        { flag: "maisie_ferry_holo" },
        { flag: "chat_maisie_ferry_2" },
        { time: 3 }
      ] },
      { text: "\"Do you mend everything you walk past?\"", when: (s)=>!s.flags["chat_maisie_ferry_3"], steps: [
        { say: "rowan", text: "\"Do you mend everything you walk past?\"" },
        { say: "maisie", text: "\"Only what ticks at me. If it ticks I can't sit still. Me mum says I mended the toaster that often it gave up and worked.\"" },
        { when: (s)=>!s.flags["met_fiona"], text: "She glances along the walkway to the stern end, where a girl in black lace is sitting under a parasol, striking a match at a small lantern. The match goes out. The girl lays it down in a row with the others." },
        { when: (s)=>!!s.flags["met_fiona"] && !s.flags["fiona_ferry_candle"], text: "She glances along the walkway to the stern end, where Fiona is sitting under her parasol, striking a match at the small lantern. The match goes out. Fiona lays it down in the row with the others." },
        { when: (s)=>!!s.flags["fiona_ferry_candle"], text: "She glances along the walkway to the stern end, where Fiona is sitting under her parasol beside the small lantern. The flame inside it ducks and shivers with every gust. Fiona watches it, one hand resting on a box of matches." },
        { say: "maisie", text: "\"See that? Draught's coming in at the hinge side of the little door. Bit of card, thirty seconds. It's doing me head in.\"" },
        { say: "maisie", text: "\"But she's not asked. And you don't mend folk's things unasked. Learnt that one off next door's doorbell. It played three tunes, after. They only wanted the one.\"" },
        { choice: [
          { text: "\"You could offer.\"", steps: [
            { say: "rowan", text: "\"You could offer.\"" },
            { say: "maisie", text: "\"I could. I'm working up to it. She looks like she might put a curse on me, and I've a soldering iron in me luggage I'd rather stayed lucky.\"" }
          ] },
          { text: "\"Maybe she likes striking the matches.\"", steps: [
            { say: "rowan", text: "\"Maybe she likes striking the matches.\"" },
            { say: "maisie", text: "\"Nobody *likes* striking matches, Rowan.\"" },
            { when: (s)=>!s.flags["met_fiona"], text: "The girl in black strikes another, with ceremony." },
            { when: (s)=>!!s.flags["met_fiona"] && !s.flags["fiona_ferry_candle"], text: "Fiona strikes another, with ceremony." },
            { when: (s)=>!!s.flags["fiona_ferry_candle"], text: "Fiona takes a match out of the box, considers it, and lays it ready on the locker, with ceremony." },
            { say: "maisie", text: "\"…Oh, heck. Maybe she does.\"" }
          ] }
        ] },
        { say: "maisie", text: "\"People are the same as lamps, really. Half of them aren't broken. They just want asking first.\"" },
        AFF("maisie", 1, "Noticed she can't sit still"),
        NOTE("maisie", "Mends whatever ticks near her, but tries not to mend other people's things unasked."),
        { flag: "chat_maisie_ferry_3" },
        { time: 3 }
      ] },
      { text: "\"I'll leave you to it. Mind the bucket.\"", steps: [
        { say: "rowan", text: "\"I'll leave you to it. Mind the bucket.\"" },
        { say: "maisie", text: "\"The bucket minds me, love. Ta-ra!\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" }
  ]
});

scene("ferry_fiona", {
  steps: [
    { when: (s)=>!!s.flags["met_fiona"], jump: "again" },
    { text: "At the stern end of the port walkway, in the deepest shade a lifeboat can throw, a girl in black lace is sitting very straight on a life-jacket locker under a black parasol. Black lipstick. Black hair, dead straight to the waist. A red jacket whose grey collar is pinned with a small silver coffin. A leather-bound book lies shut in her lap." },
    { text: "On the locker beside her stands a little storm lantern with its door open. She strikes a match. The wind takes it. She lays it down next to six others, in a row." },
    { say: "fiona", alias: "Girl in black lace", text: "\"Seven.\" Low, slow, each syllable set down with care. \"The sea does not care for atmosphere.\"" },
    { choice: [
      { text: "Crouch and cup your hands round the lantern.", hint: "Quiet", steps: [
        { text: "You crouch by the locker and make a wall of your hands. She looks at them, then at you, and strikes the eighth match. It holds. The wick takes. She shuts the little door with one black fingernail." },
        { say: "fiona", alias: "Girl in black lace", text: "\"Thank you.\"" },
        { say: "fiona", alias: "Girl in black lace", text: "\"You have warm hands. Enjoy them while they last.\"" },
        { flag: "fiona_ferry_candle" },
        AFF("fiona", 2, "Sheltered the flame")
      ] },
      { text: "\"It's broad daylight. What's the candle for?\"", steps: [
        { say: "rowan", text: "\"It's broad daylight. What's the candle for?\"" },
        { say: "fiona", alias: "Girl in black lace", text: "\"For the occasion. One leaves the mainland for the first time only once. It ought to be marked by something other than a seagull.\"" },
        { say: "rowan", text: "\"And the parasol? You're already in the shade.\"" },
        { say: "fiona", alias: "Girl in black lace", text: "\"The shade moves. I do not intend to.\"" },
        AFF("fiona", 1, "Asked instead of staring")
      ] },
      { text: "\"You could move out of the wind.\"", steps: [
        { say: "rowan", text: "\"You could move out of the wind.\"" },
        { say: "fiona", alias: "Girl in black lace", text: "\"I could.\"" },
        { text: "She lets that stand for a while." },
        { say: "fiona", alias: "Girl in black lace", text: "\"The wind could also move. One of us will give way, and I have brought more matches than it has brought morning.\"" },
        AFF("fiona", 1, "Didn't back away")
      ] }
    ] },
    { text: "The ferry drops off the back of a wave. The lantern slides for the edge of the locker —" },
    { say: "fiona", alias: "Girl in black lace", text: "\"Oh, *flip* —\"" },
    { text: "— light and quick and a full octave higher: a different girl entirely. She has the lantern trapped against her knee. She sits very still. When she speaks again, the voice has been put back where it was." },
    { say: "fiona", alias: "Girl in black lace", text: "\"You did not hear that.\"" },
    { flag: "fiona_slip" },
    { choice: [
      { text: "\"Hear what?\"", steps: [
        { say: "rowan", text: "\"Hear what?\"" },
        { text: "A long look, head tilted, the way you might consider a painting you had not expected to like." },
        { say: "fiona", alias: "Girl in black lace", text: "\"Good. You may stay.\"" },
        AFF("fiona", 2, "Heard nothing")
      ] },
      { text: "\"It was a nice voice.\"", hint: "Bold", steps: [
        { say: "rowan", text: "\"It was a nice voice.\"" },
        { say: "fiona", alias: "Girl in black lace", text: "\"It is not mine. It belongs to a girl who says 'flip'. We are not in touch.\"" },
        { text: "The corner of her mouth moves. She presses it flat." },
        AFF("fiona", 1, "Liked the wrong voice")
      ] },
      { text: "Look at the horizon and say nothing.", steps: [
        { text: "You find the horizon suddenly very interesting. There is an island on it, with a mountain, getting slowly larger." },
        { say: "fiona", alias: "Girl in black lace", text: "\"Tactful. I had not expected tact before breakfast.\"" },
        AFF("fiona", 2, "Tact")
      ] }
    ] },
    { think: "Was that her real voice? It sounded like a different person." },
    { say: "fiona", alias: "Girl in black lace", text: "\"Fiona Blackwood.\" She does not offer a hand. She inclines her head, which is somehow more. \"And you are the one they have not dressed.\"" },
    MET("fiona", "Fiona Blackwood"),
    { flag: "fiona_ferry_met" },
    { say: "rowan", text: "\"Rowan Vance.\"" },
    { say: "fiona", text: "\"Rowan Vance.\" She says it as though reading it off a stone. \"It will do.\"" },
    { say: "fiona", text: "\"Tell me, Rowan Vance. Are you frightened of me? Most people decide within the first minute. You are running late.\"" },
    { choice: [
      { text: "\"No. Should I be?\"", steps: [
        { say: "rowan", text: "\"No. Should I be?\"" },
        { say: "fiona", text: "\"It would be polite.\"" },
        { say: "fiona", text: "\"…No.\" A small breath. \"I find I am rather relieved.\"" },
        AFF("fiona", 2, "Not frightened")
      ] },
      { text: "\"A little. Mostly of the matches.\"", hint: "Dry", steps: [
        { say: "rowan", text: "\"A little. Mostly of the matches.\"" },
        { text: "A sound gets halfway out of her and is caught, like a cat at a door." },
        { say: "fiona", text: "\"Nearly.\" She clears her throat. \"You very nearly had one. Do not grow confident.\"" },
        AFF("fiona", 2, "Nearly made her laugh")
      ] },
      { text: "\"I'm too tired to be frightened of anyone.\"", steps: [
        { say: "rowan", text: "\"I'm too tired to be frightened of anyone.\"" },
        { say: "fiona", text: "\"Then you have reached the correct condition for a sea voyage. I have been cultivating it for years. You have simply stayed up.\"" },
        AFF("fiona", 1, "Honest about being tired")
      ] }
    ] },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"She's got a COFFIN on her COLLAR! Is it a REAL one? Is there a TINY PERSON in it?\"" },
    { when: (s)=>!!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"Nathan.\"" },
    { when: (s)=>!s.flags["follow_nathan"] && !!s.flags["follow_baylee"], say: "baylee", text: "\"Ma'am.\" He takes his hat off to her. It seems the thing to do." },
    { add: { ferry_talked: 1 } },
    { time: 8 },
    { scene: "chat_fiona_ferry" },
    { end: true },
    { label: "again" },
    { text: "Fiona has not moved. The shade has, by about a hand's width, and the parasol has been tilted to deny it." },
    { when: (s)=>!!s.flags["fiona_ferry_candle"], text: "The lantern is still burning behind its little door." },
    { when: (s)=>!s.flags["fiona_ferry_candle"], text: "The row of dead matches beside the lantern has grown." },
    { say: "fiona", text: "\"Rowan Vance. You came back. People generally discover a preference for the other side of the ship.\"" },
    { choice: [
      { text: "Sit down on the end of the locker.", when: (s)=>!s.flags["chat_fiona_ferry_done"], steps: [
        { text: "You sit on the end of the locker. She moves the lantern two inches to make room, which from her appears to be a great deal." },
        { scene: "chat_fiona_ferry" }
      ] },
      { text: "\"This side's got the better shade.\"", when: (s)=>!!s.flags["chat_fiona_ferry_done"], steps: [
        { say: "rowan", text: "\"This side's got the better shade.\"" },
        { say: "fiona", text: "\"It has. I chose it at the harbour, before the sun had made up its mind. One plans ahead, or one burns.\"" }
      ] },
      { text: "Leave her to the shade.", steps: [
        { text: "You nod. She inclines her head by exactly the same amount, and returns to her book without opening it." }
      ] }
    ] },
    { time: 3 }
  ]
});

scene("chat_fiona_ferry", {
  steps: [
    { label: "top" },
    { when: (s)=>!(s.flags["chat_fiona_ferry_1"] && s.flags["chat_fiona_ferry_2"] && s.flags["chat_fiona_ferry_3"]), jump: "menu" },
    { flag: "chat_fiona_ferry_done" },
    { say: "fiona", text: "\"That is quite enough of me for one crossing. Go and stand in the sun, Rowan Vance. Somebody ought to.\"" },
    { end: true },
    { label: "menu" },
    { choice: [
      { text: "\"That pin on your collar. Is it a coffin?\"", when: (s)=>!s.flags["chat_fiona_ferry_1"], steps: [
        { say: "rowan", text: "\"That pin on your collar. Is it a coffin?\"" },
        { say: "fiona", text: "\"It is. A gift. From my mother.\"" },
        { text: "A very small, very private pause." },
        { say: "fiona", text: "\"She owns a funeral home. It is a family business.\" A beat. \"I know. It's too good.\"" },
        { flag: "fiona_funeral_home" },
        { choice: [
          { text: "\"So the lace isn't a costume. It's the uniform.\"", steps: [
            { say: "rowan", text: "\"So the lace isn't a costume. It's the uniform.\"" },
            { say: "fiona", text: "\"The lace is entirely a costume. My mother wears grey wool and sensible shoes, and has the kindest telephone voice in Whitby.\"" },
            { say: "fiona", text: "\"Death is not black lace. Death is a casserole on the doorstep and a great many forms. I simply prefer the lace.\"" },
            AFF("fiona", 2, "Asked about the lace")
          ] },
          { text: "\"Did you help? In the business?\"", hint: "Plain", steps: [
            { say: "rowan", text: "\"Did you help? In the business?\"" },
            { say: "fiona", text: "\"From the age of nine. I did the flowers. And I sat with the people who had come too early and did not know where to put their hands.\"" },
            { say: "fiona", text: "\"One learns to keep still. People find it eerie. It is only manners.\"" },
            AFF("fiona", 2, "Asked without flinching")
          ] },
          { text: "\"Was it strange, growing up there?\"", steps: [
            { say: "rowan", text: "\"Was it strange, growing up there?\"" },
            { say: "fiona", text: "\"It is strange growing up anywhere. We merely had fewer illusions and better cars.\"" },
            AFF("fiona", 1, "Asked about home")
          ] }
        ] },
        { say: "fiona", text: "\"And your people, Rowan Vance? What do they do, that you have been sent to sea without a coat?\"" },
        { say: "rowan", text: "\"My aunt has a laundromat. I grew up over it. I fold sheets.\"" },
        { say: "fiona", text: "\"Then we are both children of clean linen. Ours was simply used for longer.\"" },
        { flag: "fiona_knows_laundromat" },
        NOTE("fiona", "Her mother owns a funeral home; the silver coffin pin was her gift."),
        { flag: "chat_fiona_ferry_1" },
        { time: 3 }
      ] },
      { text: "\"Somebody keeps walking past us.\"", when: (s)=>!s.flags["chat_fiona_ferry_2"], steps: [
        { text: "A boy with a blue collar comes along the walkway, not for the first time, deeply interested in the lifeboats. He looks at the lace, then at the sea, then at his own shoes, and is gone round the corner." },
        { say: "rowan", text: "\"Somebody keeps walking past us.\"" },
        { say: "fiona", text: "\"That was his fourth. You missed one while you were arriving.\"" },
        { say: "fiona", text: "\"They do not speak. They orbit.\"" },
        { choice: [
          { text: "\"Does it bother you?\"", steps: [
            { say: "rowan", text: "\"Does it bother you?\"" },
            { say: "fiona", text: "\"It bores me. One would like to be spoken to as though one might answer. I do answer. I am told it is quite an experience.\"" }
          ] },
          { text: "\"You could say hello first.\"", steps: [
            { say: "rowan", text: "\"You could say hello first.\"" },
            { say: "fiona", text: "\"I could. And he would tell his friends that the girl in black had spoken to him, and it would be about the black.\"" },
            { say: "fiona", text: "\"You spoke. In a whole sentence, and not about the black. It is a low bar, and you are the only one over it this morning.\"" }
          ] }
        ] },
        { say: "fiona", text: "\"The manner was meant to keep people at a civil distance. It does. I had not foreseen that it would also work as a lamp does on moths.\"" },
        { choice: [
          { text: "\"You could drop it for a day and see who's still there.\"", hint: "Bold", steps: [
            { say: "rowan", text: "\"You could drop it for a day and see who's still there.\"" },
            { text: "She is quiet for long enough that you wonder whether you have been dismissed." },
            { say: "fiona", text: "\"That is either very wise or very rude. I shall decide which on the island.\"" },
            AFF("fiona", 2, "Said the risky thing")
          ] },
          { text: "\"Keep the lace. Change the moths.\"", hint: "Dry", steps: [
            { say: "rowan", text: "\"Keep the lace. Change the moths.\"" },
            { say: "fiona", text: "\"Change the —\" She looks out to sea for some time. \"Yes. I shall put up a notice.\"" },
            AFF("fiona", 2, "Matched her deadpan")
          ] }
        ] },
        NOTE("fiona", "Boys stare at her and do not speak; it bores her more than it flatters her."),
        { flag: "chat_fiona_ferry_2" },
        { time: 3 }
      ] },
      { text: "\"Grey collar. So you're in the bungalows as well?\"", when: (s)=>!s.flags["chat_fiona_ferry_3"], steps: [
        { say: "rowan", text: "\"Grey collar. So you're in the bungalows as well?\"" },
        { say: "fiona", text: "\"Bungalow four. With three strangers. I have packed a length of black lace for the window, and I am prepared to negotiate.\"" },
        { choice: [
          { text: "\"What if they like sunlight?\"", steps: [
            { say: "rowan", text: "\"What if they like sunlight?\"" },
            { say: "fiona", text: "\"Then they may have it. Outside.\"" },
            { say: "fiona", text: "\"I have also packed earplugs, a spare candle and a tin of shortbread to be shared. I am not a monster. I am merely firm about curtains.\"" }
          ] },
          { text: "\"What are you hoping they'll be like?\"", steps: [
            { say: "rowan", text: "\"What are you hoping they'll be like?\"" },
            { say: "fiona", text: "\"Quiet. Kind. Not frightened.\"" },
            { say: "fiona", text: "\"People who will say good morning and mean nothing whatever by it. It is a great deal to ask of three strangers. I have brought shortbread, in case it helps.\"" }
          ] }
        ] },
        { when: (s)=>!s.flags["met_maisie"], text: "Up the walkway something small and metal hits the deck, and a cheerful voice calls a lamp a name it has probably earned." },
        { when: (s)=>!!s.flags["met_maisie"], text: "Up the walkway something small and metal hits the deck, and Maisie's voice, cheerfully, calls it a name it has probably earned." },
        { say: "fiona", text: "\"If that one is mine, I shall need more lace.\"" },
        { when: (s)=>!!s.flags["leona_told_b4"], think: "Bungalow four. According to Leona, the girl with the lamp is in four as well. I think I'll let the door tell her." },
        { say: "fiona", text: "\"And you? Where have they put you?\"" },
        { say: "rowan", text: "\"Seven.\"" },
        { say: "fiona", text: "\"Three doors along. Near enough to borrow a candle; far enough not to hear it.\"" },
        AFF("fiona", 1, "Asked where she'll live"),
        NOTE("fiona", "Is in bungalow 4 and has brought black lace for the window, and shortbread for her roommates."),
        { flag: "chat_fiona_ferry_3" },
        { time: 3 }
      ] },
      { text: "\"I'll leave you to your book.\"", steps: [
        { say: "rowan", text: "\"I'll leave you to your book.\"" },
        { say: "fiona", text: "\"It will be here. So, regrettably, will the sun.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" }
  ]
});

scene("ferry_leona", {
  steps: [
    { when: (s)=>!!s.flags["met_leona"], jump: "again" },
    { text: "There is a muster notice screwed to the bulkhead at the bow end of the port walkway: a plan of the ship, two lifeboats, a column of small print. You have walked past it twice this morning." },
    { text: "The third time there is a girl standing in front of it, and you have the uncomfortable feeling that she was there the other two times as well." },
    { text: "Medium everything. Mousy-brown hair parted in the middle, grey-blue eyes, a red jacket with its grey collar buttoned exactly as issued, a canvas satchel with a broken buckle. A steel wristwatch a size too large slides down her arm as she lifts a finger to the plan." },
    { say: "leona", alias: "Girl with a satchel", text: "\"Two boats. Thirty persons each.\" An even, mild voice. \"That is enough. I wanted to be sure before I sat down.\"" },
    { choice: [
      { text: "\"Sorry. I didn't see you there.\"", steps: [
        { say: "rowan", text: "\"Sorry. I didn't see you there.\"" },
        { say: "leona", alias: "Girl with a satchel", text: "\"No.\" She is not offended in the least. \"People don't. It isn't a talent. It's a face.\"" },
        { say: "rowan", text: "\"It's a perfectly good face.\"" },
        { say: "leona", alias: "Girl with a satchel", text: "\"Thank you. That is exactly what is the matter with it.\"" },
        { flag: "leona_said_face" }
      ] },
      { text: "\"You counted the lifeboats?\"", hint: "Curious", steps: [
        { say: "rowan", text: "\"You counted the lifeboats?\"" },
        { say: "leona", alias: "Girl with a satchel", text: "\"And the life jackets. Forty-eight, in four lockers. One of the lockers is being sat on.\"" },
        { say: "leona", alias: "Girl with a satchel", text: "\"I like to know how a thing is arranged before I trust it. It takes very little time, and then one can enjoy the view.\"" },
        AFF("leona", 2, "Asked what she was doing")
      ] },
      { text: "\"Is it enough? I never thought to check.\"", steps: [
        { say: "rowan", text: "\"Is it enough? I never thought to check.\"" },
        { say: "leona", alias: "Girl with a satchel", text: "\"Most people don't. That is why somebody prints the notice.\"" },
        { say: "leona", alias: "Girl with a satchel", text: "\"It is enough. With places over, even counting the crew. You may stop not worrying about it.\"" },
        AFF("leona", 1, "Admitted he hadn't checked")
      ] }
    ] },
    { say: "leona", alias: "Girl with a satchel", text: "\"I'm Leona.\"" },
    { say: "rowan", text: "\"Rowan Vance.\"" },
    MET("leona", "Leona"),
    { flag: "leona_ferry_met" },
    { say: "leona", text: "\"Rowan.\" She says it once, carefully, the way you would hang a key on its hook. \"You have no jacket.\"" },
    { say: "rowan", text: "\"They're still finding me one.\"" },
    { say: "leona", text: "\"I see.\"" },
    { text: "She agrees with it so pleasantly that the subject simply closes. You have the feeling you have just been done a courtesy." },
    { choice: [
      { text: "\"What would you have done if there weren't enough boats?\"", steps: [
        { say: "rowan", text: "\"What would you have done if there weren't enough boats?\"" },
        { say: "leona", text: "\"Stood near one.\"" },
        { text: "She is entirely serious. Then, very faintly, she smiles." },
        { say: "leona", text: "\"And told you, I think. You asked what I thought. People mostly ask who I am, and lose interest halfway through the answer.\"" },
        AFF("leona", 2, "Asked what she thinks")
      ] },
      { text: "\"How did you get in? Which qualifier?\"", steps: [
        { say: "rowan", text: "\"How did you get in? Which qualifier?\"" },
        { say: "leona", text: "\"The same way everyone did. There was a form.\"" },
        { text: "The mildness does not change at all. That is how you can tell." },
        { say: "leona", text: "\"Do you know how many decks this ship has? I make it three, but there is a door marked CREW that goes down.\"" },
        { say: "rowan", text: "\"…Three, I think.\"" },
        { say: "leona", text: "\"Thank you.\"" },
        { flag: "leona_asked_form" }
      ] },
      { text: "\"Then if anything happens, I'll stand near you.\"", hint: "Dry", steps: [
        { say: "rowan", text: "\"Then if anything happens, I'll stand near you.\"" },
        { say: "leona", text: "\"That is sensible. I shall be here, or at the foot of the stern stairs on this side. It is the shorter way to the boats.\"" },
        { say: "leona", text: "\"I don't expect anything to happen. But it is nice to have been included in somebody's plan.\"" },
        AFF("leona", 2, "Put her in his plan")
      ] }
    ] },
    { say: "leona", text: "\"And you, Rowan? Do you check things, or do you find out as you go?\"" },
    { choice: [
      { text: "\"I find out as I go. It's worked so far. Mostly.\"", steps: [
        { say: "rowan", text: "\"I find out as I go. It's worked so far. Mostly.\"" },
        { say: "leona", text: "\"'Mostly' is an honest word. I shall remember that you used it.\"" }
      ] },
      { text: "\"I check the cards. Never the boat.\"", steps: [
        { say: "rowan", text: "\"I check the cards. Never the boat.\"" },
        { say: "leona", text: "\"Then between us the ship is covered. You may have the cards.\"" }
      ] }
    ] },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"WHO are you talking to? — OH! There's a GIRL there! HELLO!\"" },
    { when: (s)=>!!s.flags["follow_baylee"], say: "baylee", text: "\"Was there before.\"" },
    { add: { ferry_talked: 1 } },
    { time: 8 },
    { scene: "chat_leona_ferry" },
    { end: true },
    { label: "again" },
    { text: "This time you look for her, and it still takes a moment. Leona is by the muster notice with her satchel on her shoulder, watching the walkway the way other people watch television." },
    { say: "leona", text: "\"Rowan.\" Mild as ever. \"You looked for me. I saw you doing it.\"" },
    { choice: [
      { text: "Stand at the rail beside her for a while.", when: (s)=>!s.flags["chat_leona_ferry_done"], steps: [
        { text: "You lean on the rail beside her. She makes room that was already there." },
        { scene: "chat_leona_ferry" }
      ] },
      { text: "\"Still enough lifeboats?\"", when: (s)=>!!s.flags["chat_leona_ferry_done"], steps: [
        { say: "rowan", text: "\"Still enough lifeboats?\"" },
        { say: "leona", text: "\"Two. I look now and then. It would be embarrassing to have been right once and wrong later.\"" }
      ] },
      { text: "Nod and walk on.", steps: [
        { text: "You nod. She nods back, and by the time you reach the corner you would have trouble swearing she was there." }
      ] }
    ] },
    { time: 3 }
  ]
});

scene("chat_leona_ferry", {
  steps: [
    { label: "top" },
    { when: (s)=>!(s.flags["chat_leona_ferry_1"] && s.flags["chat_leona_ferry_2"] && s.flags["chat_leona_ferry_3"]), jump: "menu" },
    { flag: "chat_leona_ferry_done" },
    { say: "leona", text: "\"That is everything I have this morning, Rowan. It was more than I usually part with. I didn't mind.\"" },
    { end: true },
    { label: "menu" },
    { choice: [
      { text: "\"That watch is a size too big for you.\"", when: (s)=>!s.flags["chat_leona_ferry_1"], steps: [
        { say: "rowan", text: "\"That watch is a size too big for you.\"" },
        { say: "leona", text: "\"Yes.\" She pushes it back up her wrist. It begins, at once, to come down again. \"It keeps good time. Five minutes fast.\"" },
        { choice: [
          { text: "\"Why five minutes fast?\"", steps: [
            { say: "rowan", text: "\"Why five minutes fast?\"" },
            { say: "leona", text: "\"Because the person who comes in late is the person everybody looks at. I prefer to be there already.\"" },
            { say: "leona", text: "\"Nobody remembers who was in a room first. Try it. It is very restful.\"" },
            AFF("leona", 1, "Asked a small exact question")
          ] },
          { text: "\"Whose was it?\"", steps: [
            { say: "rowan", text: "\"Whose was it?\"" },
            { text: "The mildness goes flat and exact, like a form being filled in." },
            { say: "leona", text: "\"It is mine.\"" },
            { say: "leona", text: "\"It was somebody's before. That is true of most good things.\"" },
            { choice: [
              { text: "\"Sorry. I shouldn't pry.\"", steps: [
                { say: "rowan", text: "\"Sorry. I shouldn't pry.\"" },
                { say: "leona", text: "\"You asked once and you stopped. That is not prying. That is manners.\"" },
                AFF("leona", 2, "Asked once and stopped")
              ] },
              { text: "\"All right. It suits you.\"", steps: [
                { say: "rowan", text: "\"All right. It suits you.\"" },
                { say: "leona", text: "\"It doesn't. But thank you. It is kind to lie about a watch.\"" },
                AFF("leona", 1, "Let it go")
              ] }
            ] }
          ] }
        ] },
        { say: "leona", text: "\"What time do you make it?\"" },
        { text: "You look at your phone. She looks at her wrist." },
        { say: "leona", text: "\"Then I am right, and five minutes ahead of you. It is a comfortable place to be.\"" },
        NOTE("leona", "Wears a steel wristwatch a size too large, set five minutes fast."),
        { flag: "chat_leona_ferry_1" },
        { time: 3 }
      ] },
      { text: "\"You've been standing here a while. What have you seen?\"", when: (s)=>!s.flags["chat_leona_ferry_2"], steps: [
        { say: "rowan", text: "\"You've been standing here a while. What have you seen?\"" },
        { text: "She turns her head and looks at you with something that, in a louder person, would be surprise." },
        { say: "leona", text: "\"The girl in the overalls has mended a lamp that nobody asked her to mend. The girl in black has a great many matches and is patient with them. A boy with a blue collar has walked past her several times and has not managed a word.\"" },
        { say: "leona", text: "\"People tell me things because they forget I am in the room. On a ship there is not even a room. They simply do it in front of me.\"" },
        { choice: [
          { text: "\"Anything about me?\"", hint: "Bold", steps: [
            { say: "rowan", text: "\"Anything about me?\"" },
            { say: "leona", text: "\"You put your right hand in your pocket when somebody looks at it.\"" },
            { text: "It is in your pocket now. You had not noticed putting it there." },
            { say: "leona", text: "\"I have not asked why. I am not asking now.\"" },
            { choice: [
              { text: "\"…Thanks.\"", steps: [
                { say: "rowan", text: "\"…Thanks.\"" },
                { say: "leona", text: "\"It is nothing. I have a satchel with a broken buckle that I have not replaced. Everybody has one thing they would rather not explain.\"" },
                AFF("leona", 2, "A fair exchange")
              ] },
              { text: "\"It's cold out here, that's all.\"", steps: [
                { say: "rowan", text: "\"It's cold out here, that's all.\"" },
                { say: "leona", text: "\"Yes. That will be it.\"" },
                { text: "She agrees, and the subject shuts like a drawer. You are fairly sure she has filed it under the right letter anyway." }
              ] }
            ] }
          ] },
          { text: "\"Do they ever notice you noticing?\"", steps: [
            { say: "rowan", text: "\"Do they ever notice you noticing?\"" },
            { say: "leona", text: "\"You did. Just now. You are the first today.\"" },
            { say: "leona", text: "\"I am not sure whether I mind. I will let you know.\"" },
            AFF("leona", 2, "Noticed her noticing")
          ] }
        ] },
        NOTE("leona", "Watches how things and people are arranged; people forget she is there."),
        { flag: "chat_leona_ferry_2" },
        { time: 3 }
      ] },
      { text: "\"The girl in the overalls, with the lamp. Do you know her?\"", when: (s)=>!!s.flags["chat_leona_ferry_2"] && !s.flags["chat_leona_ferry_3"], hint: "From what she said", steps: [
        { say: "rowan", text: "\"The girl in the overalls, with the lamp. Do you know her?\"" },
        { say: "leona", text: "\"No. But she has her acceptance letter in her back pocket, folded with the room line outwards. Commons, bungalow four.\"" },
        { say: "leona", text: "\"So does mine. Say bungalow four, I mean. I keep it in the satchel.\"" },
        { choice: [
          { text: "\"You haven't told her?\"", steps: [
            { say: "rowan", text: "\"You haven't told her?\"" },
            { say: "leona", text: "\"No. She will find out at the door, and it will be a nice surprise for her. She seems like a person who enjoys them.\"" },
            { say: "rowan", text: "\"And you don't?\"" },
            { say: "leona", text: "\"I have had mine. I prefer them early.\"" }
          ] },
          { text: "\"How do you read a letter in somebody's back pocket?\"", hint: "Dry", steps: [
            { say: "rowan", text: "\"How do you read a letter in somebody's back pocket?\"" },
            { say: "leona", text: "\"Sideways. She bends over a great deal.\"" },
            { text: "There is no change in her face whatever. It takes you a second to be sure that was a joke." },
            AFF("leona", 1, "Caught the joke")
          ] }
        ] },
        { say: "leona", text: "\"She talks to the lamp while she works on it. Kindly. I think she will be easy to live with.\"" },
        { say: "leona", text: "\"I would be glad if you did not mention it, Rowan. It is hers to find.\"" },
        { say: "rowan", text: "\"I won't.\"" },
        { say: "leona", text: "\"No. I didn't think you would. That is why I said.\"" },
        { flag: "leona_told_b4" },
        REL("maisie", "leona"),
        AFF("leona", 1, "Kept it to himself"),
        NOTE("leona", "Is in bungalow 4, and worked out on the ferry that the girl in overalls who mended the lamp is too."),
        { flag: "chat_leona_ferry_3" },
        { time: 3 }
      ] },
      { text: "\"I'll let you get back to the notice.\"", steps: [
        { say: "rowan", text: "\"I'll let you get back to the notice.\"" },
        { say: "leona", text: "\"I have finished the notice. But thank you, Rowan.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" }
  ]
});

scene("ferry_sammy", {
  steps: [
    { when: (s)=>!!s.flags["met_sammy"], jump: "again" },
    { text: "The fore deck has three benches bolted to it and all the wind there is. Beyond the last bench, alone at the rail, a slight boy in a long black coat is brooding at the horizon." },
    { text: "It is a good brood: chin down, one eye lost under a black fringe, a silver cuff on one ear. It would be better if the coat were not flying straight out behind him like a flag, and better still if one corner of it were not hooked fast on a deck cleat." },
    { text: "He tugs at it without looking down, the way you would tug a dog's lead. The cleat keeps it." },
    { say: "sammy", alias: "Boy in a long black coat", text: "\"The sea —\" Low, slow, ominous. Then he sees you, and his voice jumps an octave into something ordinary and rather sweet: \"Oh. Hello. Sorry. I'm not stuck.\"" },
    { choice: [
      { text: "Unhook the coat without a word.", hint: "Kind", steps: [
        { text: "You crouch, slip the hem off the cleat and stand up again, looking at the island as though that were what you came for." },
        { say: "sammy", alias: "Boy in a long black coat", text: "\"Oh — thanks, it's been about ten minutes, I didn't want to bend down in case somebody —\"" },
        { text: "He stops. He clears his throat. The voice goes back down." },
        { say: "sammy", alias: "Boy in a long black coat", text: "\"I was aware of the cleat.\"" },
        AFF("sammy", 3, "Freed him and said nothing")
      ] },
      { text: "\"You look a bit stuck.\"", steps: [
        { say: "rowan", text: "\"You look a bit stuck.\"" },
        { say: "sammy", alias: "Boy in a long black coat", text: "\"It's deliberate. I'm — moored.\"" },
        { text: "The coat cracks in the wind. The cleat holds." },
        { say: "sammy", alias: "Boy in a long black coat", text: "\"…Could you?\" Very small. \"I can't really bend in it. It's quite a stiff coat.\"" },
        { text: "You unhook it. He checks the hem for damage with the tenderness of a man examining a horse's leg." },
        AFF("sammy", 2, "Helped when he asked")
      ] },
      { text: "\"What about the sea?\"", hint: "Curious", steps: [
        { say: "rowan", text: "\"What about the sea?\"" },
        { say: "sammy", alias: "Boy in a long black coat", text: "\"The — sorry?\"" },
        { say: "rowan", text: "\"You were saying something. 'The sea —'\"" },
        { say: "sammy", alias: "Boy in a long black coat", text: "\"Oh. Yes.\" He squares his shoulders and drops his voice. \"The sea keeps what it is given.\"" },
        { say: "sammy", alias: "Boy in a long black coat", text: "\"…Was that all right? I've only ever said it to a mirror.\"" },
        { say: "rowan", text: "\"It was good. I think the coat upstaged it.\"" },
        { text: "He looks down, at last, at the cleat." },
        { say: "sammy", alias: "Boy in a long black coat", text: "\"Oh no.\"" },
        { text: "You unhook it for him." },
        { flag: "sammy_ferry_line" },
        AFF("sammy", 2, "Asked to hear the line")
      ] }
    ] },
    { flag: "sammy_ferry_cleat" },
    { say: "sammy", alias: "Boy in a long black coat", text: "\"Sammy Counts.\" Low and slow. Then, spoiling it: \"Samuel, properly, but — Sammy.\"" },
    MET("sammy", "Sammy Counts"),
    { flag: "sammy_ferry_met" },
    { say: "rowan", text: "\"Rowan Vance.\"" },
    { say: "sammy", text: "\"Rowan Vance.\" He repeats it under his breath, like somebody saving a file. \"You haven't got a jacket. That's quite striking, actually. Everyone's looked at you. I've been counting.\"" },
    { say: "sammy", text: "\"Is it on purpose?\"" },
    { choice: [
      { text: "\"No. They just haven't found me one.\"", steps: [
        { say: "rowan", text: "\"No. They just haven't found me one.\"" },
        { say: "sammy", text: "\"Oh.\" Real sympathy, and then, close behind it, real envy. \"It works, though. I spent four months on the coat.\"" },
        AFF("sammy", 1, "Didn't pretend")
      ] },
      { text: "\"Is the coat on purpose?\"", steps: [
        { say: "rowan", text: "\"Is the coat on purpose?\"" },
        { say: "sammy", text: "\"Very.\" In the low voice. Then, in the other: \"I chose it in February. It was an extremely convincing coat in February.\"" },
        AFF("sammy", 2, "Asked about the coat")
      ] },
      { text: "\"They look at me because I look lost.\"", hint: "Honest", steps: [
        { say: "rowan", text: "\"They look at me because I look lost.\"" },
        { say: "sammy", text: "\"That's allowed? Just — looking lost, and people come over?\"" },
        { text: "He sounds as though you have told him about a door in his own house that he had never noticed." },
        AFF("sammy", 2, "Told him how it's done")
      ] }
    ] },
    { say: "sammy", text: "\"Can I ask you something? When you came over. Did I look mysterious? From a distance, I mean. Before the cleat.\"" },
    { choice: [
      { text: "\"From a distance, very.\"", steps: [
        { say: "rowan", text: "\"From a distance, very.\"" },
        { text: "A very small, genuine smile, which he immediately tries to hide in his collar." },
        { say: "sammy", text: "\"From a distance. Right. I can work with distance.\"" },
        AFF("sammy", 2, "Said it worked")
      ] },
      { text: "\"You looked like somebody who wanted company.\"", hint: "Honest", steps: [
        { say: "rowan", text: "\"You looked like somebody who wanted company.\"" },
        { say: "sammy", text: "\"…Oh.\" The ordinary voice, quite quiet. \"That's not what I was going for.\"" },
        { say: "sammy", text: "\"It's not wrong, though. You came over. So in a way it worked better.\"" },
        AFF("sammy", 2, "Saw him, kindly")
      ] }
    ] },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"WHY are you dressed like a WET UMBRELLA?\"" },
    { when: (s)=>!!s.flags["follow_nathan"], text: "The brooding stare goes out like a pilot light." },
    { when: (s)=>!!s.flags["follow_nathan"], flag: "sammy_ferry_umbrella" },
    { when: (s)=>!!s.flags["follow_baylee"], say: "baylee", text: "\"Good coat.\"" },
    { add: { ferry_talked: 1 } },
    { time: 8 },
    { scene: "chat_sammy_ferry" },
    { end: true },
    { label: "again" },
    { text: "Sammy has moved a bench-length inboard, well clear of the cleat, and is brooding from there. The coat has been gathered in one fist as a precaution." },
    { say: "sammy", text: "\"Rowan Vance.\" Low and slow; he has plainly been saving it. Then, at ordinary speed: \"Hello. Sorry. Hello.\"" },
    { choice: [
      { text: "Stand at the rail with him.", when: (s)=>!s.flags["chat_sammy_ferry_done"], steps: [
        { text: "You take the rail next to him. He adjusts his brood to leave room for you in it." },
        { scene: "chat_sammy_ferry" }
      ] },
      { text: "\"That was a good one. The name.\"", when: (s)=>!!s.flags["chat_sammy_ferry_done"], steps: [
        { say: "rowan", text: "\"That was a good one. The name.\"" },
        { say: "sammy", text: "\"Was it?\" Delighted, and then, hastily, grave. \"I mean. Yes. I thought so.\"" }
      ] },
      { text: "Leave him to the horizon.", steps: [
        { text: "You leave him to the horizon. When you glance back he has lifted one hand, about three inches, in what on anybody else would be a wave." }
      ] }
    ] },
    { time: 3 }
  ]
});

scene("chat_sammy_ferry", {
  steps: [
    { label: "top" },
    { when: (s)=>!(s.flags["chat_sammy_ferry_1"] && s.flags["chat_sammy_ferry_2"] && s.flags["chat_sammy_ferry_3"]), jump: "menu" },
    { flag: "chat_sammy_ferry_done" },
    { say: "sammy", text: "\"I should return to my vigil.\" A pause. \"That means standing here. But thanks, Rowan. Really.\"" },
    { end: true },
    { label: "menu" },
    { choice: [
      { text: "\"You've got two voices. Which one's yours?\"", when: (s)=>!s.flags["chat_sammy_ferry_1"], steps: [
        { say: "rowan", text: "\"You've got two voices. Which one's yours?\"" },
        { say: "sammy", text: "\"The low one.\" In the low one." },
        { text: "You wait. The wind fills in." },
        { say: "sammy", text: "\"The other one. Obviously. The low one's new. I'm breaking it in, like shoes.\"" },
        { choice: [
          { text: "\"Why break it in at all?\"", steps: [
            { say: "rowan", text: "\"Why break it in at all?\"" },
            { say: "sammy", text: "\"Because nobody ever asked the other one anything.\"" }
          ] },
          { text: "\"I liked the other one. It said hello.\"", steps: [
            { say: "rowan", text: "\"I liked the other one. It said hello.\"" },
            { say: "sammy", text: "\"It says hello to everyone. That's the trouble with it. Nobody wonders about a person who says hello.\"" }
          ] }
        ] },
        { say: "sammy", text: "\"There's five of us at home. I'm the middle one. You know how in every photograph there's somebody half behind somebody else's shoulder?\"" },
        { say: "sammy", text: "\"Nobody here's seen the photographs. So I thought — new voice. New coat. Start as the one at the front.\"" },
        { choice: [
          { text: "\"So the coat's so they can find you in the picture.\"", steps: [
            { say: "rowan", text: "\"So the coat's so they can find you in the picture.\"" },
            { say: "sammy", text: "\"Yes. That's exactly — yes.\"" },
            { say: "sammy", text: "\"I'd not have put it like that. Can I have that? I won't say where I got it.\"" },
            AFF("sammy", 2, "Understood the coat")
          ] },
          { text: "\"I asked the other one something. Just now.\"", steps: [
            { say: "rowan", text: "\"I asked the other one something. Just now.\"" },
            { say: "sammy", text: "\"…You did.\" He turns this over with great care. \"I noticed. I just didn't think it counted.\"" },
            AFF("sammy", 2, "Asked the real one")
          ] }
        ] },
        NOTE("sammy", "Middle child of five; the low voice and the coat are new, so that for once he is noticed."),
        { flag: "chat_sammy_ferry_1" },
        { time: 3 }
      ] },
      { text: "\"It's going to be hot on that island. What happens to the coat?\"", when: (s)=>!s.flags["chat_sammy_ferry_2"], steps: [
        { say: "rowan", text: "\"It's going to be hot on that island. What happens to the coat?\"" },
        { say: "sammy", text: "\"It stays on.\" Low. \"Outdoors. I've decided.\"" },
        { say: "rowan", text: "\"There's a volcano on it, Sammy.\"" },
        { say: "sammy", text: "\"I know. I looked it up. After I'd bought the coat. The average is twenty-nine.\"" },
        { say: "sammy", text: "\"I've brought talc.\"" },
        { choice: [
          { text: "\"That's commitment.\"", steps: [
            { say: "rowan", text: "\"That's commitment.\"" },
            { say: "sammy", text: "\"It's the only thing I've ever seen through. I gave up the recorder, swimming and a paper round.\"" },
            { say: "sammy", text: "\"I'm not giving up a coat. A coat doesn't even have a teacher.\"" },
            AFF("sammy", 2, "Respected the coat")
          ] },
          { text: "\"You could carry it over one arm. Still counts.\"", steps: [
            { say: "rowan", text: "\"You could carry it over one arm. Still counts.\"" },
            { text: "He considers this as a serious tactical proposal. He tries the arm, without the coat." },
            { say: "sammy", text: "\"Over one arm. Like a — like a duellist. Hm.\"" },
            { say: "sammy", text: "\"No. If I take it off once, I'm the boy who used to have a coat. I'd rather be damp.\"" },
            AFF("sammy", 1, "Tried to help")
          ] }
        ] },
        NOTE("sammy", "Means to keep the coat on outdoors whatever the island's weather. Has brought talc."),
        { flag: "chat_sammy_ferry_2" },
        { time: 3 }
      ] },
      { text: "\"Do you know the two on the benches behind us?\"", when: (s)=>!s.flags["chat_sammy_ferry_3"], steps: [
        { when: (s)=>!s.flags["met_tobias"] && !s.flags["met_dmitri"], text: "On the middle bench a broad boy with a broken nose is sitting with his hands in his pockets. On the bench nearest the bow somebody long is laid out flat under a grey blanket." },
        { when: (s)=>!!s.flags["met_tobias"] && !s.flags["met_dmitri"], text: "On the middle bench Tobias is sitting with his hands in his pockets. On the bench nearest the bow somebody long is laid out flat under a grey blanket." },
        { when: (s)=>!s.flags["met_tobias"] && !!s.flags["met_dmitri"], text: "On the middle bench a broad boy with a broken nose is sitting with his hands in his pockets. On the bench nearest the bow Dmitri is laid out flat under his grey blanket." },
        { when: (s)=>!!s.flags["met_tobias"] && !!s.flags["met_dmitri"], text: "On the middle bench Tobias is sitting with his hands in his pockets. On the bench nearest the bow Dmitri is laid out flat under his grey blanket." },
        { say: "rowan", text: "\"Do you know the two on the benches behind us?\"" },
        { say: "sammy", text: "\"No. The one with the nose looked at me when I came up the steps, and I checked my pockets. I don't know why. Then he looked at the coat and he didn't laugh.\"" },
        { say: "sammy", text: "\"And the one under the blanket hasn't moved since the harbour. I've been checking he's breathing. From here. I didn't want to be rude.\"" },
        { choice: [
          { text: "\"You've been watching over a stranger all morning?\"", steps: [
            { say: "rowan", text: "\"You've been watching over a stranger all morning?\"" },
            { say: "sammy", text: "\"Not watching *over*. Brooding in his direction. It's different.\"" }
          ] },
          { text: "\"You could go and ask them where they're sleeping. You might be neighbours.\"", steps: [
            { say: "rowan", text: "\"You could go and ask them where they're sleeping. You might be neighbours.\"" },
            { say: "sammy", text: "\"I can't just *ask*. The other voice does that.\"" },
            { say: "sammy", text: "\"Six. I'm in bungalow six. If it happens to come up.\"" },
            { flag: "sammy_said_six" }
          ] }
        ] },
        { say: "dmitri", alias: "Boy under a blanket", text: "\"…I am breathing. Thank you. Continue.\"" },
        { text: "The blanket has not moved. Sammy has gone scarlet to the ears." },
        { say: "sammy", text: "\"Oh no.\" In a whisper, in the ordinary voice. \"How long has he been able to hear?\"" },
        AFF("sammy", 1, "Asked about the others"),
        NOTE("sammy", "Kept an eye on the sleeping boy on the bench all morning, from a polite distance."),
        { flag: "chat_sammy_ferry_3" },
        { time: 3 }
      ] },
      { text: "\"I'll leave you to the horizon.\"", steps: [
        { say: "rowan", text: "\"I'll leave you to the horizon.\"" },
        { say: "sammy", text: "\"Yes. It — awaits.\" A pause. \"See you, Rowan.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" }
  ]
});

scene("ferry_tobias", {
  steps: [
    { when: (s)=>!!s.flags["met_tobias"], jump: "again" },
    { text: "On the middle bench of the fore deck a broad boy with a broken nose is sitting with his boots crossed and his hands in his pockets, a grey hood hanging down over the plain collar of his red jacket." },
    { text: "A yard along the same bench lies a deck box: silver, engraved, the kind with a clasp. He is not looking at it so thoroughly that it amounts to a conversation." },
    { say: "tobias", alias: "Boy with a broken nose", text: "\"Not mine.\" He has not turned his head. \"Before you ask. Lad with a blue collar put it down to tie his shoe, twenty minutes back, and walked off with both laces done.\"" },
    { choice: [
      { text: "\"And you've been guarding it ever since.\"", steps: [
        { say: "rowan", text: "\"And you've been guarding it ever since.\"" },
        { say: "tobias", alias: "Boy with a broken nose", text: "\"Sitting near it. Different thing.\"" },
        { say: "tobias", alias: "Boy with a broken nose", text: "\"Guarding's when your hands are out.\"" },
        AFF("tobias", 1, "Saw what he was doing")
      ] },
      { text: "\"Why not take it back to him?\"", steps: [
        { say: "rowan", text: "\"Why not take it back to him?\"" },
        { say: "tobias", alias: "Boy with a broken nose", text: "\"Because then I'm the lad off the bungalows stood in front of him with his silver in my fist.\"" },
        { say: "tobias", alias: "Boy with a broken nose", text: "\"I know how that story goes. I've been in it.\"" }
      ] },
      { text: "\"Somebody could walk off with that.\"", steps: [
        { say: "rowan", text: "\"Somebody could walk off with that.\"" },
        { say: "tobias", alias: "Boy with a broken nose", text: "\"Somebody could.\"" },
        { text: "For the first time he looks at you: a once-over so smooth you would not know it was a once-over." },
        { say: "tobias", alias: "Boy with a broken nose", text: "\"Not you. You looked at me first and the box second. A thief does it the other way about.\"" },
        AFF("tobias", 1, "Looked at him first")
      ] }
    ] },
    { say: "tobias", alias: "Boy with a broken nose", text: "\"Plate, that. Not solid. Forty quid, and he'll have been told two hundred.\"" },
    { say: "tobias", alias: "Boy with a broken nose", text: "\"No jacket. So you're not one of his lot, and you're not one of mine yet. What do they call you?\"" },
    { say: "rowan", text: "\"Rowan Vance.\"" },
    { say: "tobias", alias: "Boy with a broken nose", text: "\"Tobias.\"" },
    { text: "The hands stay in the pockets. He nods instead, once, and means it." },
    MET("tobias", "Tobias"),
    { flag: "tobias_ferry_met" },
    { text: "A boy with a blue collar comes round the end of the lounge at a fast walk that is trying hard not to be a run. He sees the box. He sees Tobias. He picks the box up, undoes the clasp and counts what is inside it, standing right there." },
    { say: "tobias", text: "\"All there, is it?\" Pleasant. Quiet." },
    { text: "The boy goes pink, says something that might be thanks, and leaves a good deal faster than he came." },
    { choice: [
      { text: "\"He counted them. In front of you.\"", steps: [
        { say: "rowan", text: "\"He counted them. In front of you.\"" },
        { say: "tobias", text: "\"They always count. Wouldn't have been worth sitting by if he was the sort that didn't.\"" },
        { say: "tobias", text: "\"Doesn't sting. It's information. Now I know what he thinks a grey collar's for.\"" },
        AFF("tobias", 2, "Saw the insult")
      ] },
      { text: "\"You could have said something.\"", steps: [
        { say: "rowan", text: "\"You could have said something.\"" },
        { say: "tobias", text: "\"I did. I said, 'All there, is it.'\"" },
        { say: "tobias", text: "\"He'll hear that tonight when he's trying to get to sleep. That's plenty.\"" },
        AFF("tobias", 1, "Wanted better for him")
      ] },
      { text: "Say nothing. Sit down where the box was.", hint: "Quiet", steps: [
        { text: "You sit down where the box was. The bench is warm from the sun and smells of salt and old paint. Neither of you says anything for a while. The island gets a little larger." },
        { say: "tobias", text: "\"Most people fill that up with talk.\"" },
        { say: "tobias", text: "\"Ta.\"" },
        AFF("tobias", 2, "Sat and said nothing")
      ] }
    ] },
    { say: "tobias", text: "\"What about you, then, Vance. What've you got on you that's worth counting?\"" },
    { choice: [
      { text: "\"A deck and a phone with a cracked screen.\"", steps: [
        { say: "rowan", text: "\"A deck and a phone with a cracked screen.\"" },
        { say: "tobias", text: "\"Then you're safe as houses. Sit where you like.\"" },
        AFF("tobias", 2, "Straight answer")
      ] },
      { text: "\"Nothing. I checked before I left.\"", hint: "Dry", steps: [
        { say: "rowan", text: "\"Nothing. I checked before I left.\"" },
        { text: "A short breath through the broken nose. It may have been a laugh." },
        { say: "tobias", text: "\"Good answer. Keep giving it, whoever asks.\"" },
        AFF("tobias", 2, "Nothing to hide")
      ] }
    ] },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"Your nose goes TWO WAYS! How did you DO that?\"" },
    { when: (s)=>!!s.flags["follow_baylee"], say: "baylee", text: "\"Sorry about him.\"" },
    { add: { ferry_talked: 1 } },
    { time: 8 },
    { scene: "chat_tobias_ferry" },
    { end: true },
    { label: "again" },
    { text: "Tobias is on the same bench, the same boots crossed, hands in his pockets. The space beside him is still empty. It has the look of a space that is being kept." },
    { say: "tobias", text: "\"Vance. Bench is free.\"" },
    { choice: [
      { text: "Sit down.", when: (s)=>!s.flags["chat_tobias_ferry_done"], steps: [
        { text: "You sit. He shifts his boots an inch, which you take for a welcome." },
        { scene: "chat_tobias_ferry" }
      ] },
      { text: "\"Anybody else leave their silver lying about?\"", when: (s)=>!!s.flags["chat_tobias_ferry_done"], steps: [
        { say: "rowan", text: "\"Anybody else leave their silver lying about?\"" },
        { say: "tobias", text: "\"A parasol, a fountain pen and a lad's whole wallet. All back where they belong, and not by me. I just cough when the owner goes past.\"" }
      ] },
      { text: "\"Another time.\"", steps: [
        { say: "rowan", text: "\"Another time.\"" },
        { say: "tobias", text: "\"It'll be here. Bolted down, like.\"" }
      ] }
    ] },
    { time: 3 }
  ]
});

scene("chat_tobias_ferry", {
  steps: [
    { label: "top" },
    { when: (s)=>!(s.flags["chat_tobias_ferry_1"] && s.flags["chat_tobias_ferry_2"]) || (!!s.flags["chat_sammy_ferry_3"] && !s.flags["chat_tobias_ferry_3"]), jump: "menu" },
    { flag: "chat_tobias_ferry_done" },
    { say: "tobias", text: "\"That's me talked out till dinner, Vance. No offence in it. Mind how you go.\"" },
    { end: true },
    { label: "menu" },
    { choice: [
      { text: "\"The nose. Do I ask?\"", when: (s)=>!s.flags["chat_tobias_ferry_1"], steps: [
        { say: "rowan", text: "\"The nose. Do I ask?\"" },
        { say: "tobias", text: "\"You just did.\"" },
        { say: "tobias", text: "\"Twice. First was a lad called Dean at a church boxing club. Fair and square. I'd dropped my left.\"" },
        { say: "tobias", text: "\"Second one wasn't in a ring.\"" },
        { choice: [
          { text: "\"Do you still box?\"", steps: [
            { say: "rowan", text: "\"Do you still box?\"" },
            { say: "tobias", text: "\"When there's a bag to hit. There a gym on this rock, d'you know?\"" },
            { say: "rowan", text: "\"No idea. I've only seen the brochure.\"" },
            { say: "tobias", text: "\"Then I'll find out. Boxing done properly's the politest thing two people can do to each other. There's rules, and there's a bell, and after it you shake hands.\"" },
            AFF("tobias", 2, "Asked about the boxing")
          ] },
          { text: "\"What happened the second time?\"", steps: [
            { say: "rowan", text: "\"What happened the second time?\"" },
            { say: "tobias", text: "\"Nothing I'm telling a lad I met this morning.\" Level; not unfriendly. \"Ask me at Christmas.\"" },
            { say: "rowan", text: "\"Fair.\"" },
            { say: "tobias", text: "\"It is, yeah. You'll find I like fair. It's about all I'm fussy on.\"" },
            AFF("tobias", 1, "Took no for an answer")
          ] }
        ] },
        NOTE("tobias", "His nose has been broken twice; he learned to box at a church club."),
        { flag: "chat_tobias_ferry_1" },
        { time: 3 }
      ] },
      { text: "\"Where's the accent from? I can't place it.\"", when: (s)=>!s.flags["chat_tobias_ferry_2"], steps: [
        { say: "rowan", text: "\"Where's the accent from? I can't place it.\"" },
        { say: "tobias", text: "\"Saltgate.\" A dry beat. \"It's a mill town. Nobody's heard of it.\"" },
        { flag: "tobias_said_saltgate" },
        { choice: [
          { text: "\"I've heard of mills.\"", hint: "Dry", steps: [
            { say: "rowan", text: "\"I've heard of mills.\"" },
            { say: "tobias", text: "\"Then you're a length ahead of this boat.\"" }
          ] },
          { text: "\"What's it like?\"", steps: [
            { say: "rowan", text: "\"What's it like?\"" },
            { say: "tobias", text: "\"Wet. Brick. One mill left, and it makes carpet for hotels none of us'll ever stop in.\"" }
          ] }
        ] },
        { say: "tobias", text: "\"You?\"" },
        { say: "rowan", text: "\"Over a laundromat. My aunt's.\"" },
        { say: "tobias", text: "\"Her name over the door, or somebody else's?\"" },
        { say: "rowan", text: "\"Hers.\"" },
        { say: "tobias", text: "\"Good. Tell her to keep it that way.\"" },
        { flag: "tobias_knows_laundromat" },
        { text: "He looks down the deck, to where the white-and-gold collars have collected in the sun like something expensive that has been spilled." },
        { say: "tobias", text: "\"Every one of them's got a house to go back to if this goes wrong. I've a holdall.\"" },
        { choice: [
          { text: "\"Is it a good holdall?\"", hint: "Dry", steps: [
            { say: "rowan", text: "\"Is it a good holdall?\"" },
            { say: "tobias", text: "\"It's a cracking holdall.\" Not a flicker. \"Two zips. One of them works.\"" },
            AFF("tobias", 2, "No pity, one joke")
          ] },
          { text: "\"Then this had better not go wrong.\"", steps: [
            { say: "rowan", text: "\"Then this had better not go wrong.\"" },
            { say: "tobias", text: "\"That's the plan, yeah. It's not a long plan. It's a good one, though.\"" },
            AFF("tobias", 1, "Took it seriously")
          ] }
        ] },
        NOTE("tobias", "From Saltgate, a mill town. Everything he owns is in one holdall."),
        { flag: "chat_tobias_ferry_2" },
        { time: 3 }
      ] },
      { text: "\"The boy in the black coat says you looked at him and he checked his pockets.\"", when: (s)=>!!s.flags["chat_sammy_ferry_3"] && !s.flags["chat_tobias_ferry_3"], hint: "From Sammy", steps: [
        { say: "rowan", text: "\"The boy in the black coat says you looked at him and he checked his pockets.\"" },
        { say: "tobias", text: "\"I looked at everybody's pockets. His have a notebook, a comb and a bag of mints in. He's safe.\"" },
        { say: "rowan", text: "\"He also said you didn't laugh at the coat.\"" },
        { say: "tobias", text: "\"Why would I? He's skint, by the shoes, and he's spent what he had on turning up as somebody. That's the bravest thing on this deck.\"" },
        { choice: [
          { text: "\"You should tell him that.\"", steps: [
            { say: "rowan", text: "\"You should tell him that.\"" },
            { say: "tobias", text: "\"I should not. He'd write it down. Then he'd read it back to me.\"" }
          ] },
          { text: "\"He thinks you're terrifying.\"", steps: [
            { say: "rowan", text: "\"He thinks you're terrifying.\"" },
            { say: "tobias", text: "\"Good. So will anybody who fancies a go at him. Saves me getting up.\"" }
          ] }
        ] },
        { say: "tobias", text: "\"Don't pass it on, Vance. Lad wants to be a mystery. Let him be one.\"" },
        AFF("tobias", 2, "Spoke up for the kid"),
        NOTE("tobias", "Thinks the boy in the black coat is the bravest person on the fore deck, and does not want him told."),
        { flag: "chat_tobias_ferry_3" },
        { time: 3 }
      ] },
      { text: "\"I'll leave you the bench.\"", steps: [
        { say: "rowan", text: "\"I'll leave you the bench.\"" },
        { say: "tobias", text: "\"It's not mine, Vance. That's the whole point of a bench.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" }
  ]
});

scene("ferry_dmitri", {
  steps: [
    { when: (s)=>!!s.flags["met_dmitri"], jump: "again" },
    { text: "The bench nearest the bow has been taken whole. A long, loose-limbed boy is laid out along it under a grey blanket, a beanie pulled down to his eyebrows, dark stubble, one hand trailing on the deck beside a dented steel thermos." },
    { text: "His eyes are open. He is looking at the sky, or through it." },
    { choice: [
      { text: "\"Morning.\"", steps: [
        { say: "rowan", text: "\"Morning.\"" },
        { text: "Nothing. Not a blink. A gull goes over. You count to five." },
        { say: "dmitri", alias: "Boy under a blanket", text: "\"…That is an accusation. Not a greeting.\"" }
      ] },
      { text: "\"Are you all right?\"", hint: "Kind", steps: [
        { say: "rowan", text: "\"Are you all right?\"" },
        { text: "A long pause, in which the engine does all the talking." },
        { say: "dmitri", alias: "Boy under a blanket", text: "\"…Yes. I was asleep. You have ended it. It was not a good one, so I forgive you.\"" },
        { say: "rowan", text: "\"Your eyes were open.\"" },
        { say: "dmitri", alias: "Boy under a blanket", text: "\"They do that. They have never trusted me.\"" },
        AFF("dmitri", 1, "Checked on him")
      ] },
      { text: "Step round him quietly.", hint: "Quiet", steps: [
        { text: "You go wide round the thermos. A hand comes out from under the blanket, without the head turning, and moves it four inches out of your way." },
        { say: "dmitri", alias: "Boy under a blanket", text: "\"…Thank you. Most people kick it. Then they apologise, loudly, which is worse.\"" },
        AFF("dmitri", 2, "Walked softly")
      ] }
    ] },
    { text: "He does not sit up. He turns his head, which seems to cost him something." },
    { say: "dmitri", alias: "Boy under a blanket", text: "\"Dmitri Volkov.\" Slow, dry, each word paid for separately." },
    MET("dmitri", "Dmitri Volkov"),
    { flag: "dmitri_ferry_met" },
    { say: "rowan", text: "\"Rowan Vance.\"" },
    { say: "dmitri", text: "\"You are the one with no jacket. You came along the quay at nineteen minutes past six and stopped at the foot of the gangway. As if the boat might still say no.\"" },
    { choice: [
      { text: "\"You were watching the quay at six in the morning?\"", steps: [
        { say: "rowan", text: "\"You were watching the quay at six in the morning?\"" },
        { say: "dmitri", text: "\"I was watching it at four. At four it is interesting. There was a fox.\"" },
        { say: "dmitri", text: "\"By six there are only students.\"" },
        AFF("dmitri", 1, "Asked what he saw")
      ] },
      { text: "\"I thought it might. Say no.\"", hint: "Honest", steps: [
        { say: "rowan", text: "\"I thought it might. Say no.\"" },
        { text: "He looks at you properly, for the first time. It is like a lamp being turned a little way up." },
        { say: "dmitri", text: "\"Hm. Boats do not say no. That is people. Boats only come, or do not come.\"" },
        { say: "dmitri", text: "\"This one came. You are on it. The rest is weather.\"" },
        AFF("dmitri", 2, "Answered honestly")
      ] },
      { text: "\"You were on the quay at six. Don't you sleep?\"", steps: [
        { say: "rowan", text: "\"You were on the quay at six. Don't you sleep?\"" },
        { say: "dmitri", text: "\"Constantly. In small coins. Never a note.\"" },
        AFF("dmitri", 1, "Didn't call him lazy")
      ] }
    ] },
    { say: "dmitri", text: "\"Tell me something. They say there is an island. Is it true?\"" },
    { say: "rowan", text: "\"It's right there. Off the bow.\"" },
    { say: "dmitri", text: "\"I am facing the other way. I will take your word. Is it large?\"" },
    { choice: [
      { text: "\"Large enough. There's a volcano on it.\"", steps: [
        { say: "rowan", text: "\"Large enough. There's a volcano on it.\"" },
        { say: "dmitri", text: "\"Good. A thing that also does nothing all day, and is respected for it.\"" },
        { say: "dmitri", text: "\"We shall get on.\" A slow, dry smile, there and gone." },
        AFF("dmitri", 2, "Looked for him")
      ] },
      { text: "\"Sit up and look for yourself.\"", steps: [
        { say: "rowan", text: "\"Sit up and look for yourself.\"" },
        { say: "dmitri", text: "\"Later. At the docks, when there is no choice. I have one sitting-up before noon, and I am saving it for the gangway.\"" },
        { say: "dmitri", text: "\"Describe it to me instead. You may be brief.\"" },
        { say: "rowan", text: "\"Green. Steep. A mountain with its top missing.\"" },
        { say: "dmitri", text: "\"Thank you. That is exactly as much island as I can manage.\"" },
        AFF("dmitri", 1, "Described it anyway")
      ] }
    ] },
    { when: (s)=>!!s.flags["follow_nathan"], say: "nathan", text: "\"Is he DEAD? — He's not dead! HELLO!\"" },
    { when: (s)=>!!s.flags["follow_baylee"], say: "baylee", text: "\"Shh. Sleeping.\"" },
    { add: { ferry_talked: 1 } },
    { time: 8 },
    { scene: "chat_dmitri_ferry" },
    { end: true },
    { label: "again" },
    { text: "Dmitri is exactly where he was. The blanket has been pulled an inch higher against the sun." },
    { when: (s)=>!!s.flags["dmitri_ferry_tea"], text: "The thermos lid is standing on the bench by his elbow, empty, where you put it down." },
    { say: "dmitri", text: "\"Rowan Vance. You are back. I did not move, so that you could find me.\"" },
    { choice: [
      { text: "Sit down on the deck by the thermos.", when: (s)=>!s.flags["chat_dmitri_ferry_done"], steps: [
        { text: "You sit down on the warm planks with your back against the bench. It turns out to be the only place on the fore deck that is out of the wind. He has known this for hours." },
        { scene: "chat_dmitri_ferry" }
      ] },
      { text: "\"Still keeping an eye on things?\"", when: (s)=>!!s.flags["chat_dmitri_ferry_done"], steps: [
        { say: "rowan", text: "\"Still keeping an eye on things?\"" },
        { say: "dmitri", text: "\"One. The other is resting. They take turns.\"" }
      ] },
      { text: "Let him rest.", steps: [
        { text: "You step round the thermos. The hand comes out, finds it without looking, and draws it in under the blanket like a cat." }
      ] }
    ] },
    { time: 3 }
  ]
});

scene("chat_dmitri_ferry", {
  steps: [
    { label: "top" },
    { when: (s)=>!(s.flags["chat_dmitri_ferry_1"] && s.flags["chat_dmitri_ferry_2"] && s.flags["chat_dmitri_ferry_3"]), jump: "menu" },
    { flag: "chat_dmitri_ferry_done" },
    { say: "dmitri", text: "\"That was more words than I had budgeted until evening. They were well spent. Now go away, kindly.\"" },
    { end: true },
    { label: "menu" },
    { choice: [
      { text: "\"What's in the thermos?\"", when: (s)=>!s.flags["chat_dmitri_ferry_1"], steps: [
        { say: "rowan", text: "\"What's in the thermos?\"" },
        { say: "dmitri", text: "\"Tea. From last night. It was strong at midnight. By now it is a geological layer.\"" },
        { say: "dmitri", text: "\"Do you want some? I warn you honestly.\"" },
        { choice: [
          { text: "\"Go on, then.\"", hint: "Brave", steps: [
            { say: "rowan", text: "\"Go on, then.\"" },
            { text: "He unscrews the lid, which is also the cup, and pours something black into it without sitting up or spilling a drop. It is lukewarm. It tastes like a harbour wall." },
            { say: "rowan", text: "\"…That's terrible.\"" },
            { say: "dmitri", text: "\"Yes.\" The slow smile. \"But you are awake now. That is what it is for.\"" },
            { say: "dmitri", text: "\"On the island I will make it fresh. Come at night, wherever they put me. Fresh, it is a different drink.\"" },
            { flag: "dmitri_ferry_tea" },
            AFF("dmitri", 2, "Drank the tea")
          ] },
          { text: "\"I'll wait for a fresh one.\"", steps: [
            { say: "rowan", text: "\"I'll wait for a fresh one.\"" },
            { say: "dmitri", text: "\"Wise. Come at night, on the island, wherever they put me. I make it at midnight. At midnight it is good.\"" },
            { say: "dmitri", text: "\"You are the first today to ask what is in it and not why I am lying down. I have noted that.\"" },
            AFF("dmitri", 1, "Asked about the tea")
          ] }
        ] },
        NOTE("dmitri", "Carries a dented thermos of ferociously strong tea, and shares it."),
        { flag: "chat_dmitri_ferry_1" },
        { time: 3 }
      ] },
      { text: "\"You clocked me at six nineteen. How long had you been on that quay?\"", when: (s)=>!s.flags["chat_dmitri_ferry_2"], steps: [
        { say: "rowan", text: "\"You clocked me at six nineteen. How long had you been on that quay?\"" },
        { say: "dmitri", text: "\"Since the night train. The waiting room was locked, so I sat on a bollard.\"" },
        { say: "dmitri", text: "\"It is not a hardship. I am awake then in any case.\"" },
        { say: "rowan", text: "\"Every night?\"" },
        { say: "dmitri", text: "\"Where I am from, in summer the sun does not set, and in winter it does not rise. After a time the body stops asking which it is.\"" },
        { say: "dmitri", text: "\"Murmansk. You may look it up. It is at the top.\"" },
        { choice: [
          { text: "\"That sounds lonely.\"", steps: [
            { say: "rowan", text: "\"That sounds lonely.\"" },
            { say: "dmitri", text: "\"It is quiet. That is not the same thing.\"" },
            { say: "dmitri", text: "\"…Sometimes it is the same thing. It is better when somebody else is awake. You would be surprised how few people try.\"" },
            AFF("dmitri", 2, "Saw the lonely part")
          ] },
          { text: "\"So the night is your daytime.\"", steps: [
            { say: "rowan", text: "\"So the night is your daytime.\"" },
            { say: "dmitri", text: "\"Yes. You have it at once.\"" },
            { say: "dmitri", text: "\"Most people tell me to try going to bed earlier. As if I had never heard of bed.\"" },
            AFF("dmitri", 2, "Understood at once")
          ] }
        ] },
        NOTE("dmitri", "From Murmansk. Awake all night, every night; sat on the quay from the night train until the ferry."),
        { flag: "chat_dmitri_ferry_2" },
        { time: 3 }
      ] },
      { text: "\"You saw everybody come aboard. What did you see?\"", when: (s)=>!s.flags["chat_dmitri_ferry_3"], steps: [
        { say: "rowan", text: "\"You saw everybody come aboard. What did you see?\"" },
        { say: "dmitri", text: "\"A great deal. I will tell you a tenth.\"" },
        { say: "dmitri", text: "\"A boy in a black coat practised his walk on the quay three times before he let anybody see it. It is a good walk. The third was the best.\"" },
        { say: "dmitri", text: "\"One with a broken nose carried an old woman's bag down the harbour steps, and put it down and was gone before she could find a coin.\"" },
        { say: "dmitri", text: "\"And a girl stood at the rail and counted the lifeboats before she would come aboard. I do not remember her face. I remember the counting.\"" },
        { choice: [
          { text: "\"And the other nine tenths?\"", steps: [
            { say: "rowan", text: "\"And the other nine tenths?\"" },
            { say: "dmitri", text: "\"Theirs. I see; I do not sell. That is the whole system, and it has only the two parts.\"" },
            { say: "dmitri", text: "\"If you come home late one night, you will be glad of the second part.\"" }
          ] },
          { text: "\"You like them. You picked three kind things.\"", hint: "Observant", steps: [
            { say: "rowan", text: "\"You like them. You picked three kind things.\"" },
            { text: "The eye that is open closes, briefly. It may be a wince. It may be a smile that did not want witnesses." },
            { say: "dmitri", text: "\"…I have not met them. But yes. One can like people from a bollard. It is the safest distance for it.\"" },
            AFF("dmitri", 2, "Caught him being kind")
          ] }
        ] },
        AFF("dmitri", 1, "Asked what he saw"),
        NOTE("dmitri", "Notices who does what, and when, and repeats very little of it."),
        { flag: "dmitri_ferry_saw" },
        { flag: "chat_dmitri_ferry_3" },
        { time: 3 }
      ] },
      { text: "\"I'll let you get back to it.\"", steps: [
        { say: "rowan", text: "\"I'll let you get back to it.\"" },
        { say: "dmitri", text: "\"To nothing. Yes. Somebody must.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" }
  ]
});

scene("row_b4", {
  steps: [
    { when: (s)=>!s.flags["row_b4_seen"], jump: "first" },
    { text: "The workbench on the porch of bungalow 4 is still humming, not quite as it should." },
    { scene: "chat_row_b4" },
    { time: 10 },
    { end: true },
    { label: "first" },
    { flag: "row_b4_seen" },
    { when: (s)=>!s.flags["met_maisie"] || !s.flags["met_fiona"] || !s.flags["met_leona"], flag: "row_b4_names" },
    { when: (s)=>!s.flags["met_maisie"], text: "A trestle workbench on the porch of bungalow 4 is covered in the entrails of a projector. A girl in oil-stained overalls and welding goggles is leaning over it, tongue between her teeth, with a soldering iron in one fist." },
    { when: (s)=>!!s.flags["met_maisie"], text: "A trestle workbench on the porch of bungalow 4 is covered in the entrails of a projector. Maisie is leaning over it, goggles down, tongue between her teeth, with a soldering iron in one fist." },
    { text: "A wet towel and a pair of diving goggles have been hung over the porch rail to dry. Whoever owns them is not at home." },
    { say: "maisie", alias: "Girl in welding goggles", text: "\"It's meant to hum. It's not meant to hum like THAT. Stand a bit further back, love.\"" },
    { when: (s)=>!s.flags["met_maisie"], say: "maisie", alias: "Girl in welding goggles", text: "\"Maisie Voltage. Table tech. Don't touch the hot end — it's the other end.\"" },
    { when: (s)=>!!s.flags["maisie_ferry_met"], say: "maisie", text: "\"Oh — Rowan! Lamp lad!\" The goggles go up. \"And they've found you a jacket. Look at you. You could pass for one of us.\"" },
    { when: (s)=>!!s.flags["maisie_ferry_met"], say: "maisie", text: "\"Look what I've got. A porch! Well. Nobody gave it me. It was here, and so was a socket.\"" },
    { when: (s)=>!!s.flags["met_maisie"] && !s.flags["maisie_ferry_met"], say: "maisie", text: "\"Oh, it's you — Rowan, in't it? From up the row.\" The goggles go up. \"Mind the cable. Nobody's approved it, so it's a bit shy.\"" },
    MET("maisie", "Maisie Voltage"),
    { when: (s)=>!!s.flags["met_freddie"], say: "maisie", text: "\"You've missed Freddie. She's gone back in the sea. She's only been out of it long enough to choose a bed.\"" },
    { when: (s)=>!s.flags["met_fiona"], jump: "fiona_new" },
    { when: (s)=>!!s.flags["fiona_ferry_met"], text: "Next to the bench, in the deep shade of the porch, Fiona sits very straight under her parasol with a leather-bound book. A candle is burning on the rail beside her, steadily, with no lantern round it at all." },
    { when: (s)=>!s.flags["fiona_ferry_met"], text: "Next to the bench, in the deep shade of the porch, Fiona sits very straight under a black parasol with a leather-bound book, a small silver coffin pinned to her grey collar. A candle is burning on the rail beside her, steadily, in broad daylight." },
    { when: (s)=>!!s.flags["fiona_ferry_candle"], say: "fiona", text: "\"Rowan Vance.\" Low, slow. \"Observe. It stays lit. On land it does not require your hands. I find I rather miss the ceremony.\"" },
    { when: (s)=>!!s.flags["fiona_ferry_met"] && !s.flags["fiona_ferry_candle"], say: "fiona", text: "\"Rowan Vance.\" Low, slow. \"Observe. One match. The island has better manners than the sea.\"" },
    { when: (s)=>!s.flags["fiona_ferry_met"], say: "fiona", text: "\"Rowan Vance.\" Low, slow, each syllable placed like a candle. \"You have found the only civilised shade on the row.\"" },
    { jump: "fiona_done" },
    { label: "fiona_new" },
    { text: "Next to her, in the deep shade of the porch, a girl in black lace with a candle and a parasol sits very straight, reading a leather-bound book. The grey collar of her red jacket is pinned with a small silver coffin." },
    { say: "fiona", alias: "Girl in black lace", text: "\"You've a pleasant face.\"" },
    { text: "Low, slow, each syllable placed like a candle." },
    { say: "fiona", alias: "Girl in black lace", text: "\"It will make a lovely skull, eventually. That was a compliment.\"" },
    { say: "rowan", text: "\"…Thank you?\"" },
    { say: "fiona", alias: "Girl in black lace", text: "\"Fiona Blackwood.\"" },
    { text: "And then, a split second too fast, a little too light and clear and high:" },
    { say: "fiona", alias: "Girl in black lace", text: "\"I mean — pleased to meet you!\"" },
    { text: "A beat. Her face clenches. She lowers her voice again." },
    { say: "fiona", alias: "Girl in black lace", text: "\"…Pleased to meet you.\"" },
    MET("fiona", "Fiona Blackwood"),
    { think: "Was that her real voice? It sounded like a different person." },
    { flag: "fiona_slip" },
    { label: "fiona_done" },
    { when: (s)=>!s.flags["met_leona"], jump: "leona_new" },
    { when: (s)=>!!s.flags["leona_ferry_met"], text: "This time you look at the step first. Leona is sitting on it, satchel on her knee, as much a part of the porch as the boards." },
    { when: (s)=>!!s.flags["leona_ferry_met"], say: "leona", text: "\"Rowan.\" Even and mild. \"You looked at the step before you looked at the bench. Thank you.\"" },
    { when: (s)=>!s.flags["leona_ferry_met"], text: "It takes you a moment to see that there is a third person: Leona, on the step, satchel on her knee, as much a part of the porch as the boards." },
    { when: (s)=>!s.flags["leona_ferry_met"], say: "leona", text: "\"Hello, Rowan.\" Even and mild. \"It's all right. It took Maisie an hour.\"" },
    { jump: "leona_done" },
    { label: "leona_new" },
    { text: "A third girl is sitting on the step, so ordinary that for a second you take her for part of the porch. Medium everything: mousy-brown hair parted in the middle, grey-blue eyes, a canvas satchel on her knee." },
    { say: "leona", alias: "Girl with a satchel", text: "\"Hello.\" An even, mild voice. \"I'm Leona.\"" },
    MET("leona", "Leona"),
    { say: "maisie", text: "\"She's ours an' all. Sat there an hour before I clocked her. I asked which qualifier she came through, and d'you know what she said?\"" },
    { say: "leona", text: "\"I got in the same way everyone did. There was a form.\"" },
    { label: "leona_done" },
    { when: (s)=>!!s.flags["row_b4_names"], say: "rowan", text: "\"Rowan Vance. Bungalow seven. I'm doing the row.\"" },
    { when: (s)=>!!s.flags["row_b4_names"], say: "maisie", text: "\"Seven! With the loud one. We've heard him. We've heard him from in here with the door shut.\"" },
    { say: "maisie", text: "\"Four of us to a bungalow, and I'd not have picked better off a list. Not one of us knew till the door. What are the odds?\"" },
    { say: "leona", text: "\"Small.\"" },
    { when: (s)=>!!s.flags["leona_told_b4"], text: "Leona's eyes meet yours for exactly as long as it takes to say nothing. Then she is looking at her satchel again." },
    { when: (s)=>!!s.flags["leona_told_b4"], think: "Not one of them. She knew before the ferry was halfway over, and it's still hers to keep." },
    { choice: [
      { text: "\"What are you building, Maisie? Is that a hologram projector?\"", when: (s)=>!s.flags["maisie_ferry_holo"], hint: "Tech", steps: [
        { say: "rowan", text: "\"What are you building, Maisie? Is that a hologram projector?\"" },
        { say: "maisie", text: "\"Oh! Oh, you're a person who asks.\" She comes alive. \"Every hologram on this island is a lantern slide with ambitions. I've not been here a day and I've checked. I want one you can shake hands with.\"" },
        { flag: "maisie_holo_island" },
        AFF("maisie", 3, "Asked about her work")
      ] },
      { text: "\"Is that the one you mean to shake hands with, Maisie?\"", when: (s)=>!!s.flags["maisie_ferry_holo"], hint: "From the ferry", steps: [
        { say: "rowan", text: "\"Is that the one you mean to shake hands with, Maisie?\"" },
        { say: "maisie", text: "\"You remembered!\" She comes alive. \"This is its great-great-grandad. But yes. Same family.\"" },
        { say: "maisie", text: "\"I've had a look at theirs now, an' all. I was right. Lantern slides with ambitions, every one. So nobody's got there before me.\"" },
        { flag: "maisie_holo_island" },
        AFF("maisie", 3, "Remembered the handshake")
      ] },
      { text: "\"That is a very good pin, Fiona. Where did it come from?\"", when: (s)=>!s.flags["fiona_funeral_home"], hint: "Aesthetic", steps: [
        { say: "rowan", text: "\"That is a very good pin, Fiona. Where did it come from?\"" },
        { say: "fiona", text: "\"A gift. From my mother.\"" },
        { text: "A very small, very private pause." },
        { say: "fiona", text: "\"She owns a funeral home. It is a family business.\" A beat. \"I know. It's too good.\"" },
        AFF("fiona", 3, "Asked about the pin"),
        { flag: "fiona_funeral_home" }
      ] },
      { text: "\"Have you written to your mother yet, Fiona? About the island?\"", when: (s)=>!!s.flags["fiona_funeral_home"], hint: "From the ferry", steps: [
        { say: "rowan", text: "\"Have you written to your mother yet, Fiona? About the island?\"" },
        { say: "fiona", text: "\"I have written a postcard. It says: 'Arrived. Sunny. Regrettable. The pin has been admired.'\"" },
        { text: "A very small, very private pause." },
        { say: "fiona", text: "\"By you. I did not give your name. She would open a file.\"" },
        AFF("fiona", 3, "Remembered her mother")
      ] },
      { text: "Sit with Leona.", hint: "Quiet", steps: [
        { text: "You sit down on the step beside Leona. She moves her satchel to her other knee to make room." },
        { when: (s)=>!s.flags["leona_said_face"], say: "leona", text: "\"Thank you.\" A small pause. \"People rarely do. It isn't a talent. It's a face.\"" },
        { when: (s)=>!!s.flags["leona_said_face"], say: "leona", text: "\"Thank you.\" A small pause. \"People rarely do. On the ship you apologised for not seeing me. Now you sit down. I am keeping count.\"" },
        AFF("leona", 3, "Sat with her")
      ] }
    ] },
    { scene: "chat_row_b4" },
    { add: { ferry_talked: 1 } },
    { time: 15 }
  ]
});

scene("chat_row_b4", {
  steps: [
    { label: "top" },
    { when: (s)=>!(s.flags["chat_maisie_done"] && s.flags["chat_fiona_done"] && s.flags["chat_leona_done"]), jump: "menu" },
    { flag: "chat_row_b4_done" },
    { say: "maisie", text: "\"Right! That's the lot of us that's dry. You can come by any time. Just mind the hot end.\"" },
    { end: true },
    { label: "menu" },
    { choice: [
      { text: "Watch Maisie work.", when: (s)=>!s.flags["chat_maisie_done"], steps: [
        { text: "You go round to the open side of the bench. Lenses, a lamp housing, a coil of wire, a mug with a paintbrush in it. Maisie does not look up, but she shifts a box of screws out of range of your elbow." },
        { choice: [
          { text: "\"How does it work? The projector, I mean.\"", when: (s)=>!s.flags["chat_maisie_1"], steps: [
            { say: "rowan", text: "\"How does it work? The projector, I mean.\"" },
            { say: "maisie", text: "\"A lamp, some lenses and a lot of faith.\"" },
            { text: "She holds up the coil of wire like a trophy." },
            { when: (s)=>!s.flags["maisie_holo_island"] && !s.flags["maisie_ferry_holo"], say: "maisie", text: "\"Every hologram on the island is a slide with ambitions. I'm trying to make the light *stay put* long enough to be a thing. A thing you could shake hands with.\"" },
            { when: (s)=>!!s.flags["maisie_holo_island"] || !!s.flags["maisie_ferry_holo"], say: "maisie", text: "\"Slides with ambitions, like I said. I'm trying to make the light *stay put* long enough to be a thing.\"" },
            { say: "rowan", text: "\"Is that possible?\"" },
            { say: "maisie", text: "\"Not yet. But 'not yet' is the best phrase in any language. It's got hope in it.\"" },
            { choice: [
              { text: "\"What's stopping it?\"", steps: [
                { say: "rowan", text: "\"What's stopping it?\"" },
                { text: "She goes quiet. The soldering iron hangs in the air, forgotten. It is the look of somebody listening to a far room." },
                { say: "maisie", text: "\"Light won't sit still. Soon as you stop feeding it, it's off. I've to find out how you make it *wait*.\"" },
                { say: "maisie", text: "\"…Sorry. I went somewhere.\" The iron comes back down. \"I do that. Tap the bench if it's longer than a minute.\"" }
              ] },
              { text: "\"And if it never works?\"", steps: [
                { say: "rowan", text: "\"And if it never works?\"" },
                { say: "maisie", text: "\"Then I'll know every single way it isn't. That's a map, that is. Somebody'll want it.\"" },
                { say: "maisie", text: "\"It will, though. I'm only saying, to be polite.\"" }
              ] }
            ] },
            AFF("maisie", 2, "Asked how it works"),
            { flag: "chat_maisie_1" }
          ] },
          { text: "\"Can I hold something? I'm not much use, but I can hand you things.\"", when: (s)=>!s.flags["chat_maisie_2"], steps: [
            { say: "rowan", text: "\"Can I hold something? I'm not much use, but I can hand you things.\"" },
            { say: "maisie", text: "\"A helper! Right. Screwdriver, the flat one — no, the *other* flat one. Ta.\"" },
            { text: "For a few minutes she says nothing at all, and you hold things in the places she points. It is the most quietly useful you have felt all day." },
            { say: "maisie", text: "\"You've got steady hands, you. Don't waste them.\"" },
            { think: "Steady. Nobody has ever said that about my hands with other people in the room." },
            { choice: [
              { text: "\"They're not, usually.\"", hint: "Honest", steps: [
                { say: "rowan", text: "\"They're not, usually.\"" },
                { say: "maisie", text: "\"They are when they've summat to hold. Most hands are. It's empty ones that shake.\"" },
                { say: "maisie", text: "\"Come and hold things whenever you like. I've no end of things.\"" }
              ] },
              { text: "Say nothing. Hand her the next lens.", steps: [
                { text: "You pick the next lens out of the tray, by its edges, and hold it where she will want it." },
                { say: "maisie", text: "\"See? Didn't even ask which. You'll do, Rowan.\"" }
              ] }
            ] },
            AFF("maisie", 3, "Lent a hand"),
            { flag: "chat_maisie_2" }
          ] },
          { text: "Back to the porch.", steps: [] }
        ] },
        { when: (s)=>!!s.flags["chat_maisie_1"] && !!s.flags["chat_maisie_2"], flag: "chat_maisie_done" }
      ] },
      { text: "Sit beside Fiona's candle.", when: (s)=>!s.flags["chat_fiona_done"], steps: [
        { text: "You take the other chair in the shade. The candle on the rail burns straight up, in sunshine, like a small act of defiance." },
        { choice: [
          { text: "\"That candle's lit in broad daylight. Does it ever go out?\"", when: (s)=>!s.flags["chat_fiona_1"] && !s.flags["fiona_ferry_met"], steps: [
            { say: "rowan", text: "\"That candle's lit in broad daylight. Does it ever go out?\"" },
            { scene: "row_b4_candle" }
          ] },
          { text: "\"No lantern, and it's still alight. How long has it lasted?\"", when: (s)=>!s.flags["chat_fiona_1"] && !!s.flags["fiona_ferry_met"], hint: "From the ferry", steps: [
            { say: "rowan", text: "\"No lantern, and it's still alight. How long has it lasted?\"" },
            { scene: "row_b4_candle" }
          ] },
          { text: "\"What are you reading?\"", when: (s)=>!s.flags["chat_fiona_2"], steps: [
            { say: "rowan", text: "\"What are you reading?\"" },
            { say: "fiona", text: "\"A book of very old, very upsetting poems. They are all about rain.\"" },
            { text: "She turns the leather cover so you can see the title." },
            { say: "fiona", text: "\"Do you like rain?\"" },
            { when: (s)=>!s.flags["fiona_knows_laundromat"], say: "rowan", text: "\"I grew up above a laundromat. I like anywhere with the windows closed and something warm in the next room.\"" },
            { when: (s)=>!!s.flags["fiona_knows_laundromat"], say: "rowan", text: "\"Over the laundromat, rain meant every dryer going and the windows steamed white. I like anywhere with the windows closed and something warm in the next room.\"" },
            { say: "fiona", text: "\"…\" A long, slow pause. \"That is the best thing anybody has said to me today. I shall not tell you so.\"" },
            { say: "fiona", text: "\"Shall I read you the least upsetting one?\"" },
            { choice: [
              { text: "\"Go on.\"", steps: [
                { say: "rowan", text: "\"Go on.\"" },
                { text: "She reads eight lines in the low voice, very slowly. There is a shepherd in it, and a river, and it does not go well for the shepherd." },
                { say: "fiona", text: "\"It rhymes 'ewe' with 'dew'. Twice.\"" },
                { say: "rowan", text: "\"That's upsetting in a different way.\"" },
                { say: "fiona", text: "\"Quite.\" The corner of her mouth has to be pressed flat again. \"I keep it for the rhymes.\"" }
              ] },
              { text: "\"After dark, maybe. It seems wrong in sunshine.\"", steps: [
                { say: "rowan", text: "\"After dark, maybe. It seems wrong in sunshine.\"" },
                { say: "fiona", text: "\"Correct. That was a test, and you have passed it. You may come back after dark.\"" }
              ] }
            ] },
            AFF("fiona", 3, "Answered honestly"),
            { flag: "chat_fiona_2" }
          ] },
          { text: "Back to the porch.", steps: [] }
        ] },
        { when: (s)=>!!s.flags["chat_fiona_1"] && !!s.flags["chat_fiona_2"], flag: "chat_fiona_done" }
      ] },
      { text: "Sit with Leona on the step.", when: (s)=>!s.flags["chat_leona_done"], steps: [
        { text: "You sit on the step. From here you can see the whole row, end to end: eight porches, the path, the gap where the beach shows through. Leona has been looking at it for some time." },
        { choice: [
          { text: "\"You can see the whole row from here. What are you looking at?\"", when: (s)=>!s.flags["chat_leona_1"], steps: [
            { say: "rowan", text: "\"You can see the whole row from here. What are you looking at?\"" },
            { say: "leona", text: "\"How it works. Where the paths go. Who has the keys.\"" },
            { say: "leona", text: "\"It is what I like to do, when I am not playing.\" Even, mild, entirely unhurried. \"It is relaxing. Everything has an order, if you look.\"" },
            { say: "rowan", text: "\"Have you found out anything here?\"" },
            { say: "leona", text: "\"That the Commons has one front door and four ways out.\" A very small pause. \"That is a good number.\"" },
            { choice: [
              { text: "\"Good for what?\"", steps: [
                { say: "rowan", text: "\"Good for what?\"" },
                { say: "leona", text: "\"For not needing them. The best ways out are the ones you only ever count.\"" }
              ] },
              { text: "\"Show me one.\"", steps: [
                { say: "rowan", text: "\"Show me one.\"" },
                { say: "leona", text: "\"The laundry at the end has a back door onto the beach. It sticks. Lift the handle as you push.\"" },
                { say: "leona", text: "\"Now you know one. That seems a fair trade for sitting down.\"" }
              ] }
            ] },
            AFF("leona", 1, "Asked what she likes"),
            { flag: "chat_leona_1" }
          ] },
          { text: "\"Have you been in the bungalow long? Which bed is yours?\"", when: (s)=>!s.flags["chat_leona_2"], steps: [
            { say: "rowan", text: "\"Have you been in the bungalow long? Which bed is yours?\"" },
            { say: "leona", text: "\"Since noon. The one by the window. I have made the bed.\"" },
            { when: (s)=>!s.flags["leona_ferry_met"], say: "leona", text: "\"I remember what you told me. 'Rowan.'\" A beat. \"That is an easy name to remember.\"" },
            { when: (s)=>!!s.flags["leona_ferry_met"], say: "leona", text: "\"I remember what you told me, by the muster notice. 'Rowan Vance.'\" A beat. \"It is an easy name to remember. I would have managed a hard one.\"" },
            { say: "rowan", text: "\"Thank you for remembering.\"" },
            { say: "leona", text: "\"People rarely say that.\" The faintest, mildest smile. \"I make a point of it.\"" },
            { choice: [
              { text: "\"What else do you remember?\"", steps: [
                { say: "rowan", text: "\"What else do you remember?\"" },
                { say: "leona", text: "\"That you sat down. Most people stand over the step and talk across me to Maisie.\"" },
                { say: "leona", text: "\"It is not a great deal to remember. But I shall have it this evening, and you will have forgotten you did it.\"" }
              ] },
              { text: "\"The bed by the window. I'll remember that back.\"", steps: [
                { say: "rowan", text: "\"The bed by the window. I'll remember that back.\"" },
                { say: "leona", text: "\"Do. If you ever need to find me and cannot, that is where I am not, most of the time.\"" },
                { say: "leona", text: "\"But it is a start. Nobody else has one.\"" }
              ] }
            ] },
            AFF("leona", 2, "Thanked her for remembering"),
            { flag: "chat_leona_2" }
          ] },
          { text: "Back to the porch.", steps: [] }
        ] },
        { when: (s)=>!!s.flags["chat_leona_1"] && !!s.flags["chat_leona_2"], flag: "chat_leona_done" }
      ] },
      { text: "\"I should get on. It was good to see you all.\"", steps: [
        { say: "rowan", text: "\"I should get on. It was good to see you all.\"" },
        { say: "maisie", text: "\"Mind the cable, love!\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" }
  ]
});

scene("row_b4_candle", {
  steps: [
    { say: "fiona", text: "\"It has not gone out since I set it on this rail.\" Low, slow, very grave. \"It is the only thing in the bungalow with any sense of occasion.\"" },
    { say: "rowan", text: "\"Is it hard, keeping it alight?\"" },
    { say: "fiona", text: "\"Not at all. On the porch there is no wind, and indoors I simply don't open the window.\"" },
    { text: "The corner of her mouth moves, and she presses it flat again." },
    { say: "fiona", text: "\"That was a joke. Do not tell the others I make them.\"" },
    { choice: [
      { text: "\"Your secret's safe. It was a good one.\"", steps: [
        { say: "rowan", text: "\"Your secret's safe. It was a good one.\"" },
        { say: "fiona", text: "\"It was adequate. I have better. I am rationing them; it is a long year.\"" }
      ] },
      { text: "\"I think Maisie may have worked it out.\"", steps: [
        { say: "rowan", text: "\"I think Maisie may have worked it out.\"" },
        { say: "fiona", text: "\"Maisie believes I am 'a right laugh'. I have asked her to keep it from the rest of the row.\"" },
        { say: "maisie", text: "\"She IS a right laugh!\"" },
        { say: "fiona", text: "\"You see what I live with. Since noon.\"" }
      ] }
    ] },
    AFF("fiona", 2, "Matched her deadpan"),
    { flag: "chat_fiona_1" }
  ]
});

scene("row_b6", {
  steps: [
    { when: (s)=>!s.flags["row_b6_seen"], jump: "first" },
    { text: "The long shade on the porch of bungalow 6 has moved a little, and everybody in it is where they were." },
    { scene: "chat_row_b6" },
    { time: 10 },
    { end: true },
    { label: "first" },
    { flag: "row_b6_seen" },
    { when: (s)=>!!s.flags["met_tobias"] && !s.flags["tobias_ferry_met"], flag: "tobias_said_saltgate" },
    { when: (s)=>!s.flags["met_sammy"] || !s.flags["met_tobias"] || !s.flags["met_dmitri"], flag: "row_b6_names" },
    { text: "The porch of bungalow 6 has a long shade, a hammock, a dented steel thermos on the boards, and three people keeping carefully out of one another's way." },
    { when: (s)=>!s.flags["met_sammy"], jump: "sammy_new" },
    { text: "At the edge of the shade Sammy is brooding at the horizon in the long black coat, well away from anything a hem could catch on." },
    { when: (s)=>!!s.flags["sammy_ferry_met"], say: "sammy", text: "\"Rowan Vance.\" Low, slow, and for once it arrives exactly as planned. Then, in the other voice: \"I've been saving that since the gangway. Was it — never mind. Hello.\"" },
    { when: (s)=>!s.flags["sammy_ferry_met"], say: "sammy", text: "\"Rowan.\" Low, slow, ominous. Then, an octave up: \"Oh. Hello. Sorry. I was — never mind.\"" },
    { jump: "sammy_done" },
    { label: "sammy_new" },
    { text: "A boy in a long black coat is standing at the edge of the shade, brooding at the horizon with the stiffness of someone who has practised it in a mirror." },
    { say: "sammy", alias: "Boy in a long black coat", text: "\"I am —\"" },
    { text: "Low, slow, ominous. He catches your eye. His voice jumps up an octave into something ordinary and sweet and northern:" },
    { say: "sammy", alias: "Boy in a long black coat", text: "\"Oh. Hello. Sorry. I was — never mind.\"" },
    { text: "He clears his throat and drops it again." },
    { say: "sammy", alias: "Boy in a long black coat", text: "\"Sammy Counts.\"" },
    MET("sammy", "Sammy Counts"),
    { label: "sammy_done" },
    { when: (s)=>!s.flags["met_tobias"], jump: "tobias_new" },
    { text: "Tobias is sitting on the step with a grey hoodie under his red jacket and his hands in his pockets." },
    { when: (s)=>!!s.flags["tobias_ferry_met"], say: "tobias", text: "\"Vance.\" A nod from the step. \"They found you a jacket, then. It's new. Sleeves still creased. Better than none.\"" },
    { when: (s)=>!s.flags["tobias_ferry_met"], say: "tobias", text: "\"Vance.\" A once-over so smooth you would not know it was one. \"Nice jacket. It's new. Standard issue. Thought so.\"" },
    { jump: "tobias_done" },
    { label: "tobias_new" },
    { text: "A broad boy with a broken nose is sitting on the step with a grey hoodie under his red jacket and his hands in his pockets." },
    { say: "tobias", alias: "Boy with a broken nose", text: "\"Tobias.\"" },
    { text: "He does not take his hands out of his pockets. He gives you a once-over so smooth you would not know it was a once-over." },
    { say: "tobias", alias: "Boy with a broken nose", text: "\"Nice jacket. It's new. Standard issue. Thought so.\"" },
    MET("tobias", "Tobias"),
    { label: "tobias_done" },
    { when: (s)=>!s.flags["met_dmitri"], jump: "dmitri_new" },
    { text: "In the hammock, under a grey blanket, Dmitri has one eye open." },
    { when: (s)=>!!s.flags["dmitri_ferry_met"], say: "dmitri", text: "\"Rowan Vance. You find me horizontal again. They tell me it is afternoon now, which is apparently worse.\"" },
    { when: (s)=>!!s.flags["dmitri_ferry_tea"], say: "dmitri", text: "\"I have not forgotten the tea. You are owed a fresh one. I pay my debts at midnight.\"" },
    { when: (s)=>!s.flags["dmitri_ferry_met"], say: "dmitri", text: "\"…Rowan. You find me horizontal. I am keeping my strength.\"" },
    { jump: "dmitri_done" },
    { label: "dmitri_new" },
    { text: "A hollow-eyed boy in a grey beanie is lying in the hammock under a blanket, one eye open." },
    { say: "dmitri", alias: "Boy under a blanket", text: "\"…Dmitri.\"" },
    { text: "Slow, dry, one word at a time as if each cost something." },
    { say: "dmitri", alias: "Boy under a blanket", text: "\"Morning is a rumour. It is afternoon. I am keeping my strength.\"" },
    MET("dmitri", "Dmitri"),
    { label: "dmitri_done" },
    { when: (s)=>!!s.flags["row_b6_names"], say: "rowan", text: "\"Rowan Vance. Seven, next door.\"" },
    { when: (s)=>!!s.flags["row_b6_names"], say: "tobias", text: "\"We know. We can hear seven.\"" },
    { when: (s)=>!!s.flags["chat_sammy_ferry_3"], say: "sammy", text: "\"It was them.\" Quietly, to you, in the ordinary voice. \"The two off the benches. Both of them. In six. With me.\"" },
    { when: (s)=>!!s.flags["chat_sammy_ferry_3"], say: "tobias", text: "\"He checked his pockets when I came through the door. Then he offered me a mint.\"" },
    { when: (s)=>!!s.flags["chat_sammy_ferry_3"], say: "dmitri", text: "\"He also asked whether I was breathing. Twice in one day. I am touched.\"" },
    { choice: [
      { text: "\"That is quite a coat, Sammy. Isn't it hot in that?\"", when: (s)=>!s.flags["chat_sammy_ferry_2"], hint: "Kind", steps: [
        { say: "rowan", text: "\"That is quite a coat, Sammy. Isn't it hot in that?\"" },
        { say: "sammy", text: "\"I chose it before I knew about the weather here. I'm committed now.\"" },
        { text: "A very small, genuine smile, which he immediately tries to hide." },
        { say: "sammy", text: "\"Did that sound deliberate?\"" },
        AFF("sammy", 3, "Asked about the coat")
      ] },
      { text: "\"Twenty-nine in the shade, Sammy. How's the talc holding out?\"", when: (s)=>!!s.flags["chat_sammy_ferry_2"], hint: "From the ferry", steps: [
        { say: "rowan", text: "\"Twenty-nine in the shade, Sammy. How's the talc holding out?\"" },
        { say: "sammy", text: "\"It's gone.\" With dignity. \"It went at the docks. I'm committed now.\"" },
        { text: "A very small, genuine smile, which he immediately tries to hide." },
        { say: "sammy", text: "\"You remembered the talc. Nobody remembers things I've said.\"" },
        AFF("sammy", 3, "Remembered the talc")
      ] },
      { text: "\"Where are you from, Tobias? I can't place the accent.\"", when: (s)=>!s.flags["tobias_said_saltgate"], hint: "Plain", steps: [
        { say: "rowan", text: "\"Where are you from, Tobias? I can't place the accent.\"" },
        { say: "tobias", text: "\"Saltgate.\" A dry beat. \"It's a mill town. Nobody's heard of it.\"" },
        { flag: "tobias_said_saltgate" },
        { say: "rowan", text: "\"I've heard of mills.\"" },
        { say: "tobias", text: "\"Good. That's the first right answer today.\"" },
        AFF("tobias", 3, "Plain question")
      ] },
      { text: "\"Is the row anything like Saltgate, Tobias?\"", when: (s)=>!!s.flags["tobias_said_saltgate"], hint: "From what he said", steps: [
        { say: "rowan", text: "\"Is the row anything like Saltgate, Tobias?\"" },
        { say: "tobias", text: "\"It's got a beach. Saltgate's got a canal with a trolley in it.\"" },
        { say: "tobias", text: "\"Same sort of people, mind.\" A dry beat. \"That's a compliment to the row.\"" },
        AFF("tobias", 3, "Remembered Saltgate")
      ] },
      { text: "\"Why are you in the hammock, Dmitri, and not in a bed?\"", hint: "Curious", steps: [
        { say: "rowan", text: "\"Why are you in the hammock, Dmitri, and not in a bed?\"" },
        { when: (s)=>!s.flags["dmitri_ferry_tea"], say: "dmitri", text: "\"Because I am not in the bed.\" A slow, dry smile. \"You will find that the night is more interesting. Come and see, if you like. Bring tea. I have some, but it is a good habit in a guest.\"" },
        { when: (s)=>!!s.flags["dmitri_ferry_tea"], say: "dmitri", text: "\"Because I am not in the bed.\" A slow, dry smile. \"You will find that the night is more interesting. Come and see, if you like. Bring nothing. This time the tea is on me, and hot.\"" },
        AFF("dmitri", 3, "Curious")
      ] }
    ] },
    { scene: "chat_row_b6" },
    { add: { ferry_talked: 1 } },
    { time: 15 }
  ]
});

scene("chat_row_b6", {
  steps: [
    { label: "top" },
    { when: (s)=>!(s.flags["chat_sammy_done"] && s.flags["chat_tobias_done"] && s.flags["chat_dmitri_done"]), jump: "menu" },
    { flag: "chat_row_b6_done" },
    { say: "dmitri", text: "\"Hm.\" He draws the blanket up. \"That was a very full afternoon for bungalow 6. We shall need the evening to recover from it.\"" },
    { end: true },
    { label: "menu" },
    { choice: [
      { text: "Stay by Sammy at the edge of the shade.", when: (s)=>!s.flags["chat_sammy_done"], steps: [
        { text: "You stand at the edge of the shade with Sammy. There is a line of sweat along his hairline, under the fringe. He is ignoring it with everything he has." },
        { choice: [
          { text: "\"Do you keep that coat on all the time?\"", when: (s)=>!s.flags["chat_sammy_1"] && !s.flags["chat_sammy_ferry_2"], steps: [
            { say: "rowan", text: "\"Do you keep that coat on all the time?\"" },
            { scene: "row_b6_coat" }
          ] },
          { text: "\"You said the coat stays on outdoors. Is that still the rule, now you've felt the sun?\"", when: (s)=>!s.flags["chat_sammy_1"] && !!s.flags["chat_sammy_ferry_2"], hint: "From the ferry", steps: [
            { say: "rowan", text: "\"You said the coat stays on outdoors. Is that still the rule, now you've felt the sun?\"" },
            { scene: "row_b6_coat" }
          ] },
          { text: "\"What brings you here, Sammy?\"", when: (s)=>!s.flags["chat_sammy_2"], steps: [
            { say: "rowan", text: "\"What brings you here, Sammy?\"" },
            { say: "sammy", text: "\"The cards. And the — the chance to be somebody.\" He tries it again, lower. \"Somebody who stands at the edge of a room and is *looked at*, not *looked past*.\"" },
            { say: "sammy", text: "\"It's a bit more difficult than I planned.\"" },
            { choice: [
              { text: "\"I'm looking at you.\"", steps: [
                { say: "rowan", text: "\"I'm looking at you.\"" }
              ] },
              { text: "\"What was the plan?\"", steps: [
                { say: "rowan", text: "\"What was the plan?\"" },
                { say: "sammy", text: "\"That I'd stand somewhere and people would wonder about me. They mostly wonder if I'm lost. One lady at the docks tried to find my mum.\"" },
                { say: "rowan", text: "\"I'm looking at you. I'm not wondering if you're lost.\"" }
              ] }
            ] },
            { say: "sammy", text: "\"…Yes.\" Normal voice, quite quiet. \"You are. That's — that was nice. Thank you.\"" },
            AFF("sammy", 3, "Looked at him"),
            { flag: "chat_sammy_2" }
          ] },
          { text: "Back to the porch.", steps: [] }
        ] },
        { when: (s)=>!!s.flags["chat_sammy_1"] && !!s.flags["chat_sammy_2"], flag: "chat_sammy_done" }
      ] },
      { text: "Lean on the rail by Tobias.", when: (s)=>!s.flags["chat_tobias_done"], steps: [
        { text: "You lean on the porch rail above the step. Tobias glances up, once, at your collar, and then goes back to watching the path." },
        { choice: [
          { text: "\"Is the new jacket really that obvious?\"", when: (s)=>!s.flags["chat_tobias_1"], steps: [
            { say: "rowan", text: "\"Is the new jacket really that obvious?\"" },
            { say: "tobias", text: "\"Stiff. Smells of the shop. Sleeves still creased.\"" },
            { text: "He does not take his hands out of his pockets." },
            { say: "tobias", text: "\"Don't worry. Give it a week. Then nobody can tell the new ones from the old ones.\"" },
            { say: "rowan", text: "\"Is that a good thing?\"" },
            { say: "tobias", text: "\"It's the only thing. A place like this works hardest at hiding who's new.\"" },
            { choice: [
              { text: "\"And the ones with no money? Do they get hidden too?\"", steps: [
                { say: "rowan", text: "\"And the ones with no money? Do they get hidden too?\"" },
                { say: "tobias", text: "\"No. Us you can always tell. We press our own collars.\"" },
                { say: "tobias", text: "\"Yours is pressed wrong, by the way. Hold still.\"" },
                { text: "One hand comes out of its pocket, for the first time since you met him: scarred knuckles, surprisingly careful. He turns your collar down flat. The hand goes back." },
                { say: "tobias", text: "\"There. Now you're only new.\"" }
              ] },
              { text: "\"You don't seem worried about blending in.\"", steps: [
                { say: "rowan", text: "\"You don't seem worried about blending in.\"" },
                { say: "tobias", text: "\"I'm not here to blend. I'm here to be let through the door. After that they can look all they like.\"" },
                { say: "tobias", text: "\"You blend, Vance. You've the face for it. I'll stand next to you and be the one they watch.\"" }
              ] }
            ] },
            AFF("tobias", 2, "Asked his opinion"),
            { flag: "chat_tobias_1" }
          ] },
          { text: "\"What do you make of the Academy so far?\"", when: (s)=>!s.flags["chat_tobias_2"], steps: [
            { say: "rowan", text: "\"What do you make of the Academy so far?\"" },
            { when: (s)=>!!s.flags["tobias_said_saltgate"], say: "tobias", text: "\"A club for fat cats.\" Flat. \"Nothing against the cats. They can't help it. But I want a sister out of Saltgate, and this is the only door with my name on it.\"" },
            { when: (s)=>!s.flags["tobias_said_saltgate"], say: "tobias", text: "\"A club for fat cats.\" Flat. \"Nothing against the cats. They can't help it. But I want a sister out of Saltgate — that's home, don't bother looking for it — and this is the only door with my name on it.\"" },
            { flag: "tobias_said_saltgate" },
            { choice: [
              { text: "\"That's a good reason.\"", steps: [
                { say: "rowan", text: "\"That's a good reason.\"" },
                { say: "tobias", text: "\"It's the *only* reason.\"" }
              ] },
              { text: "\"How old is she?\"", steps: [
                { say: "rowan", text: "\"How old is she?\"" },
                { say: "tobias", text: "\"Sixteen. Sharper than me, and she knows it.\"" },
                { say: "tobias", text: "\"She's the reason. The only one. I've not got a spare.\"" }
              ] }
            ] },
            { say: "tobias", text: "\"And that's the last you'll hear of it.\" A dry, level glance. \"Where I come from, you tell people your reasons, they know how to use them. So tell nobody yours. And mind your pockets.\"" },
            AFF("tobias", 2, "Heard his reason"),
            { flag: "chat_tobias_2" }
          ] },
          { text: "Back to the porch.", steps: [] }
        ] },
        { when: (s)=>!!s.flags["chat_tobias_1"] && !!s.flags["chat_tobias_2"], flag: "chat_tobias_done" }
      ] },
      { text: "Sit by Dmitri's hammock.", when: (s)=>!s.flags["chat_dmitri_done"], steps: [
        { text: "You sit down on the boards by the hammock. The thermos stands between you like a third person who is not saying much either." },
        { choice: [
          { text: "\"Do you ever actually sleep, Dmitri?\"", when: (s)=>!s.flags["chat_dmitri_1"], steps: [
            { say: "rowan", text: "\"Do you ever actually sleep, Dmitri?\"" },
            { say: "dmitri", text: "\"In the mornings. At school it was in class, with my eyes open. Here it will be the same.\" The open eye considers you. \"It is a very efficient system. Nobody has ever noticed, apart from the teachers.\"" },
            { say: "rowan", text: "\"And the nights?\"" },
            { say: "dmitri", text: "\"The nights I watch. Tea, a thermos, a very good view of who comes home when.\" A beat. \"I do not repeat it. That is the other half of the system.\"" },
            { choice: [
              { text: "\"So if I come home late, you'll know.\"", steps: [
                { say: "rowan", text: "\"So if I come home late, you'll know.\"" },
                { say: "dmitri", text: "\"To the minute. And nobody else will. That is the offer; it is the same for everybody on the row.\"" }
              ] },
              { text: "\"Doesn't anybody sit up with you?\"", hint: "Kind", steps: [
                { say: "rowan", text: "\"Doesn't anybody sit up with you?\"" },
                { say: "dmitri", text: "\"It has been offered. Never twice by the same person. Around two o'clock people discover they are fond of their beds.\"" },
                { say: "dmitri", text: "\"You may be the first to manage a second night. I will not hold you to it.\"" }
              ] }
            ] },
            AFF("dmitri", 2, "Asked about his nights"),
            { flag: "chat_dmitri_1" }
          ] },
          { text: "\"What kind of tea is in the thermos?\"", when: (s)=>!s.flags["chat_dmitri_2"] && !s.flags["chat_dmitri_ferry_1"], steps: [
            { say: "rowan", text: "\"What kind of tea is in the thermos?\"" },
            { say: "dmitri", text: "\"Strong. Black. Harbour-strong, which is a different kind of strong.\"" },
            { text: "For the first time he opens his eyes fully." },
            { say: "dmitri", text: "\"You ask about the tea. Not the name, not the deck. The tea.\"" },
            { scene: "row_b6_tea" }
          ] },
          { text: "\"Is the tea any better on dry land?\"", when: (s)=>!s.flags["chat_dmitri_2"] && !!s.flags["chat_dmitri_ferry_1"], hint: "From the ferry", steps: [
            { say: "rowan", text: "\"Is the tea any better on dry land?\"" },
            { say: "dmitri", text: "\"It is still strong. Black. Harbour-strong, which is a different kind of strong. But it will be made at midnight and drunk at midnight, and not carried over a sea.\"" },
            { text: "For the first time today he opens his eyes fully." },
            { say: "dmitri", text: "\"You asked about it on the ship, and now you come back and ask again. Most people learn their lesson from the thermos.\"" },
            { scene: "row_b6_tea" }
          ] },
          { text: "Back to the porch.", steps: [] }
        ] },
        { when: (s)=>!!s.flags["chat_dmitri_1"] && !!s.flags["chat_dmitri_2"], flag: "chat_dmitri_done" }
      ] },
      { text: "\"I should get on. Good to see you all.\"", steps: [
        { say: "rowan", text: "\"I should get on. Good to see you all.\"" },
        { say: "sammy", text: "\"Good — afternoon. Yes. Good afternoon.\"" },
        { end: true }
      ] }
    ] },
    { jump: "top" }
  ]
});

scene("row_b6_coat", {
  steps: [
    { say: "sammy", text: "\"Always.\"" },
    { text: "Low, slow, ominous. Then, normal speed, very quickly:" },
    { say: "sammy", text: "\"Well — outside. Inside I hang it up. It's very heavy.\"" },
    { text: "He clears his throat and drops it again." },
    { say: "sammy", text: "\"It lends a certain atmosphere.\"" },
    { say: "rowan", text: "\"Does it work?\"" },
    { say: "sammy", text: "\"…Three people have asked me if I'm unwell since the harbour.\" A very small, hopeful pause. \"That is a very good result, I think.\"" },
    { choice: [
      { text: "\"It's a start. Unwell means they looked.\"", steps: [
        { say: "rowan", text: "\"It's a start. Unwell means they looked.\"" },
        { say: "sammy", text: "\"That's what I thought!\" Ordinary voice, eager. \"You can't be asked if you're unwell by somebody who hasn't seen you.\"" },
        { say: "sammy", text: "\"The next stage is 'who is that'. I haven't worked out the next stage.\"" }
      ] },
      { text: "\"Sammy. Drink some water.\"", hint: "Kind", steps: [
        { say: "rowan", text: "\"Sammy. Drink some water.\"" },
        { say: "sammy", text: "\"I'm perfectly —\" He sways, very slightly. \"Yes. All right. Water.\"" },
        { say: "tobias", text: "\"There's a jug inside the door. I put it there an hour back. He's been walking round it.\"" }
      ] }
    ] },
    AFF("sammy", 2, "Asked about the coat"),
    { flag: "chat_sammy_1" }
  ]
});

scene("row_b6_tea", {
  steps: [
    { say: "dmitri", text: "\"Come by after midnight. I will pour you a cup. It will be, I think, the best conversation you have this week.\"" },
    { choice: [
      { text: "\"After midnight. I'll bring my own mug.\"", steps: [
        { say: "rowan", text: "\"After midnight. I'll bring my own mug.\"" },
        { say: "dmitri", text: "\"Bring two. Mine has a history.\"" }
      ] },
      { text: "\"I'm usually asleep by then.\"", steps: [
        { say: "rowan", text: "\"I'm usually asleep by then.\"" },
        { say: "dmitri", text: "\"Yes. Everybody is. That is what makes it a good hour.\"" },
        { say: "dmitri", text: "\"The offer does not go off. Unlike the tea.\"" }
      ] }
    ] },
    AFF("dmitri", 3, "Asked about the tea"),
    { flag: "chat_dmitri_2" }
  ]
});
